const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Keine Berechtigung.' });
  }
  next();
}
router.use(auth, adminOnly);

const pricePerKgExpr = `
  CASE
    WHEN s.price_per_kg_override IS NOT NULL THEN s.price_per_kg_override
    WHEN s.quantity_kg > 0 AND s.cost_eur IS NOT NULL
      THEN ROUND((s.cost_eur / s.quantity_kg)::numeric, 2)
    ELSE NULL
  END
`;

// GET /api/stockings
router.get('/', async (req, res) => {
  try {
    const year = req.query.season || new Date().getFullYear();
    const planned = req.query.planned;
    let filter = 'WHERE s.season_year = $1';
    if (planned === 'true')  filter += ' AND s.is_planned = true';
    if (planned === 'false') filter += ' AND s.is_planned = false';
    const { rows } = await pool.query(`
      SELECT s.*, (${pricePerKgExpr}) AS price_per_kg_calc,
             u.first_name AS created_by_first, u.last_name AS created_by_last
      FROM stockings s
      LEFT JOIN users u ON u.id = s.created_by
      ${filter}
      ORDER BY s.is_planned ASC, COALESCE(s.planned_date::timestamptz, s.stocked_at) DESC NULLS LAST
    `, [year]);
    res.json({ stockings: rows });
  } catch (err) {
    console.error('GET /stockings error:', err);
    res.status(500).json({ error: 'Besaetze konnten nicht geladen werden.' });
  }
});

// GET /api/stockings/stats
router.get('/stats', async (req, res) => {
  try {
    const year = req.query.season || new Date().getFullYear();
    const { rows: actual } = await pool.query(`
      SELECT fish_species, SUM(quantity_kg)::numeric AS total_kg, COUNT(*)::int AS events,
        COALESCE(SUM(cost_eur), 0)::numeric AS total_cost_eur,
        CASE WHEN SUM(quantity_kg) > 0 AND SUM(cost_eur) IS NOT NULL
          THEN ROUND((SUM(cost_eur) / SUM(quantity_kg))::numeric, 2) ELSE NULL END AS avg_price_per_kg
      FROM stockings WHERE season_year = $1 AND is_planned = false
      GROUP BY fish_species ORDER BY total_kg DESC
    `, [year]);
    const { rows: planned } = await pool.query(`
      SELECT fish_species, SUM(quantity_kg)::numeric AS planned_kg, COUNT(*)::int AS events,
        COALESCE(SUM(cost_eur), 0)::numeric AS planned_cost_eur,
        MIN(planned_date) AS earliest_planned_date,
        STRING_AGG(DISTINCT source, ', ') AS sources
      FROM stockings WHERE season_year = $1 AND is_planned = true
      GROUP BY fish_species ORDER BY planned_kg DESC NULLS LAST
    `, [year]);
    const { rows: totals } = await pool.query(`
      SELECT COUNT(*)::int AS total_events,
        COALESCE(SUM(quantity_kg), 0) AS total_kg,
        COALESCE(SUM(cost_eur), 0) AS total_cost_eur
      FROM stockings WHERE season_year = $1 AND is_planned = false
    `, [year]);
    const { rows: harvest } = await pool.query(`
      SELECT c.fish_species, cs.german_name,
        COUNT(*) FILTER (WHERE c.kept = true)::int AS kept_count,
        AVG(c.length_cm) FILTER (WHERE c.kept = true AND c.length_cm IS NOT NULL) AS avg_length_kept
      FROM catches c
      LEFT JOIN closed_seasons cs ON cs.fish_species = c.fish_species
      WHERE EXTRACT(YEAR FROM c.catch_date) = $1
      GROUP BY c.fish_species, cs.german_name ORDER BY kept_count DESC
    `, [year]);
    res.json({
      season: parseInt(year),
      actual: {
        totalEvents: totals[0].total_events,
        totalKg: parseFloat(totals[0].total_kg),
        totalCostEur: parseFloat(totals[0].total_cost_eur),
        bySpecies: actual.map(r => ({
          fishSpecies: r.fish_species, totalKg: parseFloat(r.total_kg),
          events: r.events, totalCostEur: parseFloat(r.total_cost_eur),
          avgPricePerKg: r.avg_price_per_kg ? parseFloat(r.avg_price_per_kg) : null,
        })),
      },
      planned: planned.map(r => ({
        fishSpecies: r.fish_species,
        plannedKg: r.planned_kg ? parseFloat(r.planned_kg) : null,
        events: r.events, plannedCostEur: parseFloat(r.planned_cost_eur),
        earliestPlannedDate: r.earliest_planned_date, sources: r.sources,
      })),
      harvestComparison: harvest.map(r => ({
        fishSpecies: r.fish_species, germanName: r.german_name || r.fish_species,
        keptCount: r.kept_count,
        avgLengthKept: r.avg_length_kept ? parseFloat(r.avg_length_kept).toFixed(1) : null,
      })),
    });
  } catch (err) {
    console.error('GET /stockings/stats error:', err);
    res.status(500).json({ error: 'Statistik konnte nicht geladen werden.' });
  }
});

// POST /api/stockings
router.post('/', async (req, res) => {
  try {
    const {
      stockedAt, plannedDate, fishSpecies, quantityKg, quantityCount,
      costEur, pricePerKgOverride, source, ageClass, notes, isPlanned,
    } = req.body;

    const planned = isPlanned === true || isPlanned === 'true';

    // Pflichtfelder: nur Fischart zwingend; Menge optional bei Planung
    if (!fishSpecies) {
      return res.status(400).json({ error: 'Fischart ist ein Pflichtfeld.' });
    }
    if (!planned && !stockedAt) {
      return res.status(400).json({ error: 'Datum ist Pflichtfeld fuer Ist-Besatz.' });
    }

    const effectiveDate = planned
      ? (plannedDate || new Date().toISOString())
      : stockedAt;
    const seasonYear = new Date(effectiveDate).getFullYear();

    // Kosten aus Kilopreis x Menge berechnen wenn noetig
    let resolvedCostEur = costEur ? parseFloat(costEur) : null;
    if (!resolvedCostEur && pricePerKgOverride && quantityKg) {
      resolvedCostEur = parseFloat(pricePerKgOverride) * parseFloat(quantityKg);
    }

    const { rows } = await pool.query(`
      INSERT INTO stockings (
        stocked_at, planned_date, season_year, fish_species,
        quantity_kg, quantity_count, cost_eur, price_per_kg_override,
        source, age_class, notes, is_planned, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
    `, [
      planned ? null : stockedAt,
      plannedDate || null,
      seasonYear,
      fishSpecies,
      quantityKg ? parseFloat(quantityKg) : null,
      quantityCount ? parseInt(quantityCount) : null,
      resolvedCostEur,
      pricePerKgOverride ? parseFloat(pricePerKgOverride) : null,
      source || null, ageClass || null, notes || null,
      planned,
      req.user.id,
    ]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /stockings error:', err.message);
    res.status(500).json({ error: 'Besatz konnte nicht gespeichert werden.', detail: err.message });
  }
});

// PUT /api/stockings/:id
router.put('/:id', async (req, res) => {
  try {
    const {
      stockedAt, plannedDate, fishSpecies, quantityKg, quantityCount,
      costEur, pricePerKgOverride, source, ageClass, notes, isPlanned,
    } = req.body;

    let resolvedCostEur = costEur != null && costEur !== '' ? parseFloat(costEur) : null;
    if (resolvedCostEur === null && pricePerKgOverride && quantityKg) {
      resolvedCostEur = parseFloat(pricePerKgOverride) * parseFloat(quantityKg);
    }

    const { rows } = await pool.query(`
      UPDATE stockings SET
        stocked_at            = $1,
        planned_date          = $2,
        fish_species          = COALESCE($3, fish_species),
        quantity_kg           = $4,
        quantity_count        = $5,
        cost_eur              = $6,
        price_per_kg_override = $7,
        source                = $8,
        age_class             = $9,
        notes                 = $10,
        is_planned            = COALESCE($11, is_planned),
        updated_at            = NOW()
      WHERE id = $12
      RETURNING *
    `, [
      stockedAt || null,
      plannedDate || null,
      fishSpecies || null,
      quantityKg != null && quantityKg !== '' ? parseFloat(quantityKg) : null,
      quantityCount != null && quantityCount !== '' ? parseInt(quantityCount) : null,
      resolvedCostEur,
      pricePerKgOverride != null && pricePerKgOverride !== '' ? parseFloat(pricePerKgOverride) : null,
      source || null, ageClass || null, notes || null,
      isPlanned != null ? (isPlanned === true || isPlanned === 'true') : null,
      req.params.id,
    ]);
    if (rows.length === 0) return res.status(404).json({ error: 'Besatz nicht gefunden.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /stockings/:id error:', err.message);
    res.status(500).json({ error: 'Besatz konnte nicht aktualisiert werden.', detail: err.message });
  }
});

// DELETE /api/stockings/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM stockings WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Besatz nicht gefunden.' });
    res.json({ message: 'Besatz geloescht.' });
  } catch (err) {
    console.error('DELETE /stockings/:id error:', err.message);
    res.status(500).json({ error: 'Besatz konnte nicht geloescht werden.' });
  }
});

module.exports = router;
