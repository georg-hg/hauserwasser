const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const { checkQuota } = require('../services/quotaChecker');

const router = express.Router();

// ── GET /api/catches ───────────────────────────────────────
// Alle Fänge des eingeloggten Users (mit Paging)
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 50, season } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT c.*, cs.german_name, cs.min_size_cm
      FROM catches c
      LEFT JOIN closed_seasons cs ON cs.fish_species = c.fish_species
      WHERE c.user_id = $1
    `;
    const params = [req.user.id];

    if (season) {
      query += ` AND EXTRACT(YEAR FROM c.catch_date) = $${params.length + 1}`;
      params.push(season);
    }

    query += ` ORDER BY c.catch_date DESC, c.catch_time DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const { rows } = await pool.query(query, params);

    // Gesamtzahl für Paging
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM catches WHERE user_id = $1',
      [req.user.id]
    );

    res.json({
      catches: rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      totalPages: Math.ceil(countResult.rows[0].count / limit),
    });
  } catch (err) {
    console.error('GET /catches error:', err);
    res.status(500).json({ error: 'Fänge konnten nicht geladen werden.' });
  }
});

// ── GET /api/catches/stats ─────────────────────────────────
// Statistiken: Fischtage, Quoten, Saisonübersicht
router.get('/stats', auth, async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();

    // Fischtage diese Saison
    const fishingDays = await pool.query(
      'SELECT COUNT(*) FROM fishing_days WHERE user_id = $1 AND season_year = $2',
      [req.user.id, year]
    );

    // Fischtage diese Woche
    const weekDays = await pool.query(
      `SELECT COUNT(*) FROM fishing_days
       WHERE user_id = $1 AND fishing_date >= date_trunc('week', CURRENT_DATE)`,
      [req.user.id]
    );

    // Salmoniden diese Saison (kept=true)
    const salmonids = await pool.query(
      `SELECT COUNT(*) FROM catches
       WHERE user_id = $1 AND kept = true
       AND fish_species IN ('brown_trout', 'rainbow_trout', 'char', 'grayling')
       AND EXTRACT(YEAR FROM catch_date) = $2`,
      [req.user.id, year]
    );

    // Hecht/Zander dieses Jahr
    const pikeZander = await pool.query(
      `SELECT fish_species, COUNT(*) as count FROM catches
       WHERE user_id = $1 AND kept = true
       AND fish_species IN ('pike', 'zander')
       AND EXTRACT(YEAR FROM catch_date) = $2
       GROUP BY fish_species`,
      [req.user.id, year]
    );

    // Gesamtfänge
    const totalCatches = await pool.query(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN kept THEN 1 ELSE 0 END) as kept,
              SUM(CASE WHEN NOT kept THEN 1 ELSE 0 END) as released
       FROM catches WHERE user_id = $1 AND EXTRACT(YEAR FROM catch_date) = $2`,
      [req.user.id, year]
    );

    // Fänge pro Art
    const bySpecies = await pool.query(
      `SELECT c.fish_species, cs.german_name, COUNT(*) as count,
              SUM(CASE WHEN c.kept THEN 1 ELSE 0 END) as kept
       FROM catches c
       LEFT JOIN closed_seasons cs ON cs.fish_species = c.fish_species
       WHERE c.user_id = $1 AND EXTRACT(YEAR FROM c.catch_date) = $2
       GROUP BY c.fish_species, cs.german_name
       ORDER BY count DESC`,
      [req.user.id, year]
    );

    const pikeCount = pikeZander.rows.find(r => r.fish_species === 'pike')?.count || 0;
    const zanderCount = pikeZander.rows.find(r => r.fish_species === 'zander')?.count || 0;

    res.json({
      season: year,
      fishingDays: {
        total: parseInt(fishingDays.rows[0].count),
        maxSeason: 36,
        thisWeek: parseInt(weekDays.rows[0].count),
        maxWeek: 3,
      },
      quotas: {
        salmonidsKept: parseInt(salmonids.rows[0].count),
        salmonidsMax: 60,
        pikeKept: parseInt(pikeCount),
        pikeMax: 1,
        zanderKept: parseInt(zanderCount),
        zanderMax: 1,
      },
      totals: totalCatches.rows[0],
      bySpecies: bySpecies.rows,
    });
  } catch (err) {
    console.error('GET /catches/stats error:', err);
    res.status(500).json({ error: 'Statistiken konnten nicht geladen werden.' });
  }
});

// ── POST /api/catches ──────────────────────────────────────
// Neuen Fang eintragen
router.post('/', auth, upload.single('photo'), async (req, res) => {
  try {
    const {
      catchDate, catchTime, latitude, longitude, locationName,
      fishSpecies, lengthCm, weightKg, technique, kept, notes,
      aiSpecies, aiConfidence, aiLengthEst,
    } = req.body;

    if (!catchDate || !latitude || !longitude || !fishSpecies) {
      return res.status(400).json({
        error: 'Datum, Position und Fischart sind Pflichtfelder.',
      });
    }

    // Quotenprüfung
    const quotaCheck = await checkQuota(req.user.id, fishSpecies, kept === 'true' || kept === true);
    if (quotaCheck.exceeded) {
      return res.status(422).json({
        error: quotaCheck.message,
        quotaInfo: quotaCheck,
      });
    }

    const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const { rows } = await pool.query(
      `INSERT INTO catches (
        user_id, catch_date, catch_time, latitude, longitude, location_name,
        fish_species, length_cm, weight_kg, photo_url, technique, kept, notes,
        ai_species, ai_confidence, ai_length_est
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *`,
      [
        req.user.id, catchDate, catchTime || null,
        parseFloat(latitude), parseFloat(longitude), locationName || null,
        fishSpecies, lengthCm ? parseFloat(lengthCm) : null,
        weightKg ? parseFloat(weightKg) : null, photoUrl,
        technique || null, kept === 'true' || kept === true, notes || null,
        aiSpecies || null, aiConfidence ? parseFloat(aiConfidence) : null,
        aiLengthEst ? parseFloat(aiLengthEst) : null,
      ]
    );

    // Fischtag registrieren
    await pool.query(
      `INSERT INTO fishing_days (user_id, fishing_date, season_year)
       VALUES ($1, $2, EXTRACT(YEAR FROM $2::date))
       ON CONFLICT (user_id, fishing_date) DO NOTHING`,
      [req.user.id, catchDate]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /catches error:', err);
    res.status(500).json({ error: 'Fang konnte nicht gespeichert werden.' });
  }
});

// ── PUT /api/catches/:id ───────────────────────────────────
router.put('/:id', auth, async (req, res) => {
  try {
    const { fishSpecies, lengthCm, weightKg, technique, kept, notes } = req.body;

    const { rows } = await pool.query(
      `UPDATE catches SET
        fish_species = COALESCE($1, fish_species),
        length_cm = COALESCE($2, length_cm),
        weight_kg = COALESCE($3, weight_kg),
        technique = COALESCE($4, technique),
        kept = COALESCE($5, kept),
        notes = COALESCE($6, notes),
        updated_at = NOW()
      WHERE id = $7 AND user_id = $8
      RETURNING *`,
      [fishSpecies, lengthCm, weightKg, technique, kept, notes, req.params.id, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Fang nicht gefunden.' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /catches error:', err);
    res.status(500).json({ error: 'Fang konnte nicht aktualisiert werden.' });
  }
});

// ── DELETE /api/catches/:id ────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM catches WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Fang nicht gefunden.' });
    }
    res.json({ message: 'Fang gelöscht.' });
  } catch (err) {
    console.error('DELETE /catches error:', err);
    res.status(500).json({ error: 'Fang konnte nicht gelöscht werden.' });
  }
});

module.exports = router;
