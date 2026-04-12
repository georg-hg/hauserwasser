const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();

// Alle Stockings-Endpoints: nur Admin
function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Keine Berechtigung.' });
  }
  next();
}

router.use(auth, adminOnly);

// ── GET /api/stockings ───────────────────────────────────────
// Alle Besaetze gefiltert nach Saison
router.get('/', async (req, res) => {
  try {
    const year = req.query.season || new Date().getFullYear();

    const { rows } = await pool.query(`
      SELECT
        s.*,
        CASE
          WHEN s.quantity_kg > 0 AND s.cost_eur IS NOT NULL
          THEN ROUND((s.cost_eur / s.quantity_kg)::numeric, 2)
          ELSE NULL
        END AS price_per_kg,
        u.first_name AS created_by_first,
        u.last_name  AS created_by_last
      FROM stockings s
      LEFT JOIN users u ON u.id = s.created_by
      WHERE s.season_year = $1
      ORDER BY s.stocked_at DESC
    `, [year]);

    res.json({ stockings: rows });
  } catch (err) {
    console.error('GET /stockings error:', err);
    res.status(500).json({ error: 'Besaetze konnten nicht geladen werden.' });
  }
});

// ── GET /api/stockings/stats ─────────────────────────────────
// Besatz-Statistik: Gewicht, Kosten, Kilopreis, Entnahme-Vergleich
router.get('/stats', async (req, res) => {
  try {
    const year = req.query.season || new Date().getFullYear();

    // Summen pro Fischart inkl. Kosten
    const { rows: bySpecies } = await pool.query(`
      SELECT
        fish_species,
        SUM(quantity_kg)::numeric                          AS total_kg,
        COUNT(*)::int                                       AS stocking_events,
        COALESCE(SUM(cost_eur), 0)::numeric                AS total_cost_eur,
        CASE
          WHEN SUM(quantity_kg) > 0 AND SUM(cost_eur) IS NOT NULL
          THEN ROUND((SUM(cost_eur) / SUM(quantity_kg))::numeric, 2)
          ELSE NULL
        END                                                AS avg_price_per_kg
      FROM stockings
      WHERE season_year = $1
      GROUP BY fish_species
      ORDER BY total_kg DESC
    `, [year]);

    // Gesamttotals
    const { rows: totals } = await pool.query(`
      SELECT
        COUNT(*)::int                        AS total_events,
        COALESCE(SUM(quantity_kg), 0)        AS total_kg,
        COALESCE(SUM(cost_eur), 0)           AS total_cost_eur
      FROM stockings
      WHERE season_year = $1
    `, [year]);

    // Entnahme-Vergleich (wieviel kept=true pro Art)
    const { rows: harvest } = await pool.query(`
      SELECT
        c.fish_species,
        cs.german_name,
        COUNT(*) FILTER (WHERE c.kept = true)::int   AS kept_count,
        AVG(c.length_cm) FILTER (
          WHERE c.kept = true AND c.length_cm IS NOT NULL
        )                                             AS avg_length_kept
      FROM catches c
      LEFT JOIN closed_seasons cs ON cs.fish_species = c.fish_species
      WHERE EXTRACT(YEAR FROM c.catch_date) = $1
      GROUP BY c.fish_species, cs.german_name
      ORDER BY kept_count DESC
    `, [year]);

    res.json({
      season: parseInt(year),
      totalEvents: totals[0].total_events,
      totalKg: parseFloat(totals[0].total_kg),
      totalCostEur: parseFloat(totals[0].total_cost_eur),
      bySpecies: bySpecies.map(r => ({
        fishSpecies: r.fish_species,
        totalKg: parseFloat(r.total_kg),
        stockingEvents: r.stocking_events,
        totalCostEur: parseFloat(r.total_cost_eur),
        avgPricePerKg: r.avg_price_per_kg ? parseFloat(r.avg_price_per_kg) : null,
      })),
      harvestComparison: harvest.map(r => ({
        fishSpecies: r.fish_species,
        germanName: r.german_name || r.fish_species,
        keptCount: r.kept_count,
        avgLengthKept: r.avg_length_kept
          ? parseFloat(r.avg_length_kept).toFixed(1) : null,
      })),
    });
  } catch (err) {
    console.error('GET /stockings/stats error:', err);
    res.status(500).json({ error: 'Statistik konnte nicht geladen werden.' });
  }
});

// ── POST /api/stockings ──────────────────────────────────────
// Neuen Besatz eintragen
router.post('/', async (req, res) => {
  try {
    const {
      stockedAt, fishSpecies, quantityKg, quantityCount,
      costEur, source, ageClass, notes,
    } = req.body;

    if (!stockedAt || !fishSpecies || !quantityKg) {
      return res.status(400).json({
        error: 'Datum, Fischart und Menge (kg) sind Pflichtfelder.',
      });
    }

    const seasonYear = new Date(stockedAt).getFullYear();

    const { rows } = await pool.query(`
      INSERT INTO stockings
        (stocked_at, season_year, fish_species, quantity_kg, quantity_count,
         cost_eur, source, age_class, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *,
        CASE WHEN quantity_kg > 0 AND cost_eur IS NOT NULL
          THEN ROUND((cost_eur / quantity_kg)::numeric, 2)
          ELSE NULL END AS price_per_kg
    `, [
      stockedAt, seasonYear, fishSpecies,
      parseFloat(quantityKg),
      quantityCount ? parseInt(quantityCount) : null,
      costEur ? parseFloat(costEur) : null,
      source || null, ageClass || null, notes || null,
      req.user.id,
    ]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /stockings error:', err);
    res.status(500).json({ error: 'Besatz konnte nicht gespeichert werden.' });
  }
});

// ── PUT /api/stockings/:id ───────────────────────────────────
// Besatz bearbeiten
router.put('/:id', async (req, res) => {
  try {
    const {
      stockedAt, fishSpecies, quantityKg, quantityCount,
      costEur, source, ageClass, notes,
    } = req.body;

    const { rows } = await pool.query(`
      UPDATE stockings SET
        stocked_at     = COALESCE($1, stocked_at),
        fish_species   = COALESCE($2, fish_species),
        quantity_kg    = COALESCE($3, quantity_kg),
        quantity_count = $4,
        cost_eur       = $5,
        source         = $6,
        age_class      = $7,
        notes          = $8,
        updated_at     = NOW()
      WHERE id = $9
      RETURNING *,
        CASE WHEN quantity_kg > 0 AND cost_eur IS NOT NULL
          THEN ROUND((cost_eur / quantity_kg)::numeric, 2)
          ELSE NULL END AS price_per_kg
    `, [
      stockedAt || null, fishSpecies || null,
      quantityKg ? parseFloat(quantityKg) : null,
      quantityCount != null ? parseInt(quantityCount) : null,
      costEur != null ? parseFloat(costEur) : null,
      source || null, ageClass || null, notes || null,
      req.params.id,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Besatz nicht gefunden.' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /stockings/:id error:', err);
    res.status(500).json({ error: 'Besatz konnte nicht aktualisiert werden.' });
  }
});

// ── DELETE /api/stockings/:id ────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM stockings WHERE id = $1', [req.params.id]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Besatz nicht gefunden.' });
    }
    res.json({ message: 'Besatz geloescht.' });
  } catch (err) {
    console.error('DELETE /stockings/:id error:', err);
    res.status(500).json({ error: 'Besatz konnte nicht geloescht werden.' });
  }
});

module.exports = router;
