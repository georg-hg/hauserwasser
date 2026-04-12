const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Middleware: Nur Admin
function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Keine Berechtigung.' });
  }
  next();
}

// ── GET /api/stockings ───────────────────────────────────────
// Alle Besätze (gefiltert nach Saison), für alle eingeloggten User sichtbar
router.get('/', auth, async (req, res) => {
  try {
    const { season } = req.query;
    const year = season || new Date().getFullYear();

    const { rows } = await pool.query(`
      SELECT s.*,
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
    res.status(500).json({ error: 'Besätze konnten nicht geladen werden.' });
  }
});

// ── GET /api/stockings/stats ─────────────────────────────────
// Besatz-Statistik pro Saison (Gesamtgewicht pro Fischart)
router.get('/stats', auth, async (req, res) => {
  try {
    const { season } = req.query;
    const year = season || new Date().getFullYear();

    // Besatz-Summen pro Art
    const { rows: bySpecies } = await pool.query(`
      SELECT fish_species, SUM(quantity_kg) AS total_kg, COUNT(*) AS stocking_events
      FROM stockings
      WHERE season_year = $1
      GROUP BY fish_species
      ORDER BY total_kg DESC
    `, [year]);

    // Gesamtgewicht
    const { rows: totals } = await pool.query(`
      SELECT
        COUNT(*)::int                AS total_events,
        COALESCE(SUM(quantity_kg), 0) AS total_kg
      FROM stockings
      WHERE season_year = $1
    `, [year]);

    // Entnahme-Vergleich: wieviel wurde eingesetzt vs. entnommen (kept=true)
    const { rows: harvest } = await pool.query(`
      SELECT
        c.fish_species,
        cs.german_name,
        COUNT(*) FILTER (WHERE c.kept = true)::int AS kept_count,
        AVG(c.length_cm) FILTER (WHERE c.kept = true AND c.length_cm IS NOT NULL) AS avg_length_kept
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
      bySpecies: bySpecies.map(r => ({
        fishSpecies: r.fish_species,
        totalKg: parseFloat(r.total_kg),
        stockingEvents: parseInt(r.stocking_events),
      })),
      harvestComparison: harvest.map(r => ({
        fishSpecies: r.fish_species,
        germanName: r.german_name || r.fish_species,
        keptCount: r.kept_count,
        avgLengthKept: r.avg_length_kept ? parseFloat(r.avg_length_kept).toFixed(1) : null,
      })),
    });
  } catch (err) {
    console.error('GET /stockings/stats error:', err);
    res.status(500).json({ error: 'Statistik konnte nicht geladen werden.' });
  }
});

// ── POST /api/stockings ──────────────────────────────────────
// Neuen Besatz eintragen (nur Admin)
router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const {
      stockedAt,    // ISO-Datum/Zeit des Besatzes
      fishSpecies,  // z.B. 'rainbow_trout', 'brown_trout'
      quantityKg,   // Gewicht in kg
      quantityCount,// Stückzahl (optional)
      source,       // Herkunft / Lieferant (optional)
      ageClass,     // z.B. 'fangfertig', 'soemmerlinge', 'jungfische'
      notes,
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
         source, age_class, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      stockedAt, seasonYear, fishSpecies,
      parseFloat(quantityKg),
      quantityCount ? parseInt(quantityCount) : null,
      source || null,
      ageClass || null,
      notes || null,
      req.user.id,
    ]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /stockings error:', err);
    res.status(500).json({ error: 'Besatz konnte nicht gespeichert werden.' });
  }
});

// ── PUT /api/stockings/:id ───────────────────────────────────
// Besatz bearbeiten (nur Admin)
router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const {
      stockedAt, fishSpecies, quantityKg, quantityCount,
      source, ageClass, notes,
    } = req.body;

    const { rows } = await pool.query(`
      UPDATE stockings SET
        stocked_at     = COALESCE($1, stocked_at),
        fish_species   = COALESCE($2, fish_species),
        quantity_kg    = COALESCE($3, quantity_kg),
        quantity_count = $4,
        source         = $5,
        age_class      = $6,
        notes          = $7,
        updated_at     = NOW()
      WHERE id = $8
      RETURNING *
    `, [
      stockedAt || null,
      fishSpecies || null,
      quantityKg ? parseFloat(quantityKg) : null,
      quantityCount ? parseInt(quantityCount) : null,
      source || null,
      ageClass || null,
      notes || null,
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
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM stockings WHERE id = $1',
      [req.params.id]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Besatz nicht gefunden.' });
    }
    res.json({ message: 'Besatz gelöscht.' });
  } catch (err) {
    console.error('DELETE /stockings/:id error:', err);
    res.status(500).json({ error: 'Besatz konnte nicht gelöscht werden.' });
  }
});

module.exports = router;
