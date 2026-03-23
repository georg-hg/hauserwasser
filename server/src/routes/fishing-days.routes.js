const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const { checkQuota } = require('../services/quotaChecker');

const router = express.Router();

// ── GET /api/fishing-days ────────────────────────────────
// Alle Fischtage des Users (mit zugehörigen Fängen)
router.get('/', auth, async (req, res) => {
  try {
    const { season } = req.query;
    const year = season || new Date().getFullYear();

    const { rows: days } = await pool.query(`
      SELECT fd.*,
        (SELECT COUNT(*) FROM catches c WHERE c.fishing_day_id = fd.id) as catch_count,
        (SELECT COUNT(*) FROM catches c WHERE c.fishing_day_id = fd.id AND c.kept = true) as kept_count
      FROM fishing_days fd
      WHERE fd.user_id = $1 AND fd.season_year = $2
      ORDER BY fd.fishing_date DESC
    `, [req.user.id, year]);

    res.json({ fishingDays: days });
  } catch (err) {
    console.error('GET /fishing-days error:', err);
    res.status(500).json({ error: 'Fischtage konnten nicht geladen werden.' });
  }
});

// ── GET /api/fishing-days/:id ────────────────────────────
// Einzelner Fischtag mit allen Fängen
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows: dayRows } = await pool.query(
      'SELECT * FROM fishing_days WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (dayRows.length === 0) {
      return res.status(404).json({ error: 'Fischtag nicht gefunden.' });
    }

    const { rows: catches } = await pool.query(`
      SELECT c.*, cs.german_name, cs.min_size_cm
      FROM catches c
      LEFT JOIN closed_seasons cs ON cs.fish_species = c.fish_species
      WHERE c.fishing_day_id = $1
      ORDER BY c.catch_time ASC NULLS LAST, c.created_at ASC
    `, [req.params.id]);

    res.json({ fishingDay: dayRows[0], catches });
  } catch (err) {
    console.error('GET /fishing-days/:id error:', err);
    res.status(500).json({ error: 'Fischtag konnte nicht geladen werden.' });
  }
});

// ── POST /api/fishing-days ───────────────────────────────
// Neuen Fischtag anlegen
router.post('/', auth, async (req, res) => {
  try {
    const { fishingDate, technique, notes } = req.body;

    if (!fishingDate) {
      return res.status(400).json({ error: 'Datum ist ein Pflichtfeld.' });
    }

    const seasonYear = new Date(fishingDate).getFullYear();

    const { rows } = await pool.query(`
      INSERT INTO fishing_days (user_id, fishing_date, season_year, technique, notes)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, fishing_date) DO UPDATE SET
        technique = COALESCE(EXCLUDED.technique, fishing_days.technique),
        notes = COALESCE(EXCLUDED.notes, fishing_days.notes)
      RETURNING *
    `, [req.user.id, fishingDate, seasonYear, technique || null, notes || null]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /fishing-days error:', err);
    res.status(500).json({ error: 'Fischtag konnte nicht angelegt werden.' });
  }
});

// ── PUT /api/fishing-days/:id ─────────────────────────────
// Fischtag bearbeiten (Technik, Notizen)
router.put('/:id', auth, async (req, res) => {
  try {
    const { technique, notes } = req.body;

    const { rows } = await pool.query(`
      UPDATE fishing_days SET
        technique = $1,
        notes = $2
      WHERE id = $3 AND user_id = $4
      RETURNING *
    `, [technique || null, notes || null, req.params.id, req.user.id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Fischtag nicht gefunden.' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /fishing-days/:id error:', err);
    res.status(500).json({ error: 'Fischtag konnte nicht aktualisiert werden.' });
  }
});

// ── PUT /api/fishing-days/:id/complete ───────────────────
// Fischtag abschließen (mit oder ohne Fänge)
router.put('/:id/complete', auth, async (req, res) => {
  try {
    const { notes, technique } = req.body;

    const { rows } = await pool.query(`
      UPDATE fishing_days SET
        completed = true,
        notes = COALESCE($1, notes),
        technique = COALESCE($2, technique)
      WHERE id = $3 AND user_id = $4
      RETURNING *
    `, [notes || null, technique || null, req.params.id, req.user.id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Fischtag nicht gefunden.' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /fishing-days/:id/complete error:', err);
    res.status(500).json({ error: 'Fischtag konnte nicht abgeschlossen werden.' });
  }
});

// ── PUT /api/fishing-days/:id/position ───────────────────
// Live-GPS-Position aktualisieren (Client sendet alle 5 Min.)
router.put('/:id/position', auth, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: 'Latitude und Longitude sind Pflichtfelder.' });
    }

    const { rows } = await pool.query(`
      UPDATE fishing_days SET
        latitude = $1,
        longitude = $2,
        position_updated_at = NOW()
      WHERE id = $3 AND user_id = $4 AND completed = false
      RETURNING id, latitude, longitude, position_updated_at
    `, [parseFloat(latitude), parseFloat(longitude), req.params.id, req.user.id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Aktiver Fischtag nicht gefunden.' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /fishing-days/:id/position error:', err);
    res.status(500).json({ error: 'Position konnte nicht aktualisiert werden.' });
  }
});

// ── DELETE /api/fishing-days/:id ─────────────────────────
// Fischtag löschen (inkl. aller zugehörigen Fänge)
router.delete('/:id', auth, async (req, res) => {
  try {
    // Zuerst zugehörige Fänge löschen
    await pool.query(
      'DELETE FROM catches WHERE fishing_day_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    const { rowCount } = await pool.query(
      'DELETE FROM fishing_days WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Fischtag nicht gefunden.' });
    }

    res.json({ message: 'Fischtag gelöscht.' });
  } catch (err) {
    console.error('DELETE /fishing-days/:id error:', err);
    res.status(500).json({ error: 'Fischtag konnte nicht gelöscht werden.' });
  }
});

// ── POST /api/fishing-days/:id/catches ───────────────────
// Fang zu einem Fischtag hinzufügen
router.post('/:id/catches', auth, upload.single('photo'), async (req, res) => {
  try {
    // Prüfen ob Fischtag existiert
    const { rows: dayRows } = await pool.query(
      'SELECT * FROM fishing_days WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (dayRows.length === 0) {
      return res.status(404).json({ error: 'Fischtag nicht gefunden.' });
    }

    const day = dayRows[0];
    const {
      catchTime, latitude, longitude, locationName,
      fishSpecies, lengthCm, weightKg, kept, notes,
    } = req.body;

    if (!fishSpecies) {
      return res.status(400).json({ error: 'Fischart ist ein Pflichtfeld.' });
    }

    // Quotenprüfung
    const quotaCheck = await checkQuota(req.user.id, fishSpecies, kept === 'true' || kept === true);
    if (quotaCheck.exceeded) {
      return res.status(422).json({ error: quotaCheck.message, quotaInfo: quotaCheck });
    }

    const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const { rows } = await pool.query(`
      INSERT INTO catches (
        user_id, fishing_day_id, catch_date, catch_time, latitude, longitude, location_name,
        fish_species, length_cm, weight_kg, photo_url, technique, kept, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
    `, [
      req.user.id, req.params.id, day.fishing_date,
      catchTime || null,
      latitude ? parseFloat(latitude) : null,
      longitude ? parseFloat(longitude) : null,
      locationName || null,
      fishSpecies,
      lengthCm ? parseFloat(lengthCm) : null,
      weightKg ? parseFloat(weightKg) : null,
      photoUrl,
      day.technique || null,
      kept === 'true' || kept === true,
      notes || null,
    ]);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /fishing-days/:id/catches error:', err);
    res.status(500).json({ error: 'Fang konnte nicht gespeichert werden.' });
  }
});

module.exports = router;
