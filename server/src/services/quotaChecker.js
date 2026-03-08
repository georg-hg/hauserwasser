const pool = require('../config/db');

/**
 * Prüft ob der Fisher seine Quoten überschreiten würde
 * Basierend auf den Sonderbestimmungen der Fischereierlaubnis Hauserwasser
 */
async function checkQuota(userId, fishSpecies, kept) {
  // Nicht entnommene Fische zählen nicht zur Quote
  if (!kept) {
    return { exceeded: false };
  }

  const year = new Date().getFullYear();
  const today = new Date().toISOString().split('T')[0];

  // ── Fischtage-Limit: 3 pro Woche, 36 pro Saison ──────────
  const weekDays = await pool.query(
    `SELECT COUNT(*) FROM fishing_days
     WHERE user_id = $1 AND fishing_date >= date_trunc('week', CURRENT_DATE)`,
    [userId]
  );
  if (parseInt(weekDays.rows[0].count) >= 3) {
    // Prüfe ob heute schon ein Fischtag ist
    const todayExists = await pool.query(
      'SELECT 1 FROM fishing_days WHERE user_id = $1 AND fishing_date = $2',
      [userId, today]
    );
    if (todayExists.rows.length === 0) {
      return {
        exceeded: true,
        type: 'fishing_days_week',
        message: 'Maximum 3 Fischtage pro Woche erreicht!',
      };
    }
  }

  const seasonDays = await pool.query(
    'SELECT COUNT(*) FROM fishing_days WHERE user_id = $1 AND season_year = $2',
    [userId, year]
  );
  if (parseInt(seasonDays.rows[0].count) >= 36) {
    const todayExists = await pool.query(
      'SELECT 1 FROM fishing_days WHERE user_id = $1 AND fishing_date = $2',
      [userId, today]
    );
    if (todayExists.rows.length === 0) {
      return {
        exceeded: true,
        type: 'fishing_days_season',
        message: 'Maximum 36 Fischtage pro Saison erreicht!',
      };
    }
  }

  // ── Salmoniden: 3 pro Tag, 60 pro Saison ──────────────────
  const salmonidSpecies = ['brown_trout', 'rainbow_trout', 'char', 'grayling'];
  if (salmonidSpecies.includes(fishSpecies)) {
    const todaySalmonids = await pool.query(
      `SELECT COUNT(*) FROM catches
       WHERE user_id = $1 AND catch_date = $2 AND kept = true
       AND fish_species = ANY($3)`,
      [userId, today, salmonidSpecies]
    );
    if (parseInt(todaySalmonids.rows[0].count) >= 3) {
      return {
        exceeded: true,
        type: 'salmonid_daily',
        message: 'Maximum 3 Salmoniden pro Tag erreicht! Fischen sofort einstellen.',
      };
    }

    const seasonSalmonids = await pool.query(
      `SELECT COUNT(*) FROM catches
       WHERE user_id = $1 AND kept = true
       AND fish_species = ANY($2)
       AND EXTRACT(YEAR FROM catch_date) = $3`,
      [userId, salmonidSpecies, year]
    );
    if (parseInt(seasonSalmonids.rows[0].count) >= 60) {
      return {
        exceeded: true,
        type: 'salmonid_season',
        message: 'Maximum 60 Salmoniden pro Saison erreicht!',
      };
    }
  }

  // ── Karpfenartige: 1 pro Tag ──────────────────────────────
  const carpSpecies = ['carp', 'barbel'];
  if (carpSpecies.includes(fishSpecies)) {
    const todayCarp = await pool.query(
      `SELECT COUNT(*) FROM catches
       WHERE user_id = $1 AND catch_date = $2 AND kept = true
       AND fish_species = ANY($3)`,
      [userId, today, carpSpecies]
    );
    if (parseInt(todayCarp.rows[0].count) >= 1) {
      return {
        exceeded: true,
        type: 'carp_daily',
        message: 'Maximum 1 karpfenartiger Fisch pro Tag erreicht!',
      };
    }
  }

  // ── Hecht & Zander: je 1 pro Jahr ────────────────────────
  if (fishSpecies === 'pike' || fishSpecies === 'zander') {
    const yearCount = await pool.query(
      `SELECT COUNT(*) FROM catches
       WHERE user_id = $1 AND kept = true AND fish_species = $2
       AND EXTRACT(YEAR FROM catch_date) = $3`,
      [userId, fishSpecies, year]
    );
    if (parseInt(yearCount.rows[0].count) >= 1) {
      const name = fishSpecies === 'pike' ? 'Hecht' : 'Zander';
      return {
        exceeded: true,
        type: `${fishSpecies}_yearly`,
        message: `Maximum 1 ${name} pro Jahr bereits entnommen!`,
      };
    }
  }

  // ── Huchen: ganzjährig geschont ───────────────────────────
  if (fishSpecies === 'huchen') {
    return {
      exceeded: true,
      type: 'protected',
      message: 'Huchen ist ganzjährig geschont! Darf NICHT entnommen werden!',
    };
  }

  return { exceeded: false };
}

module.exports = { checkQuota };
