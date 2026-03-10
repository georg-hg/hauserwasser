const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// ── GET /api/predators ────────────────────────────────────────
// Eigene Sichtungen des eingeloggten Users
router.get('/', auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const offset = (page - 1) * limit;

    const { rows } = await pool.query(`
      SELECT id, sighted_at, latitude, longitude, predator_type,
             individual_count, behavior, notes, photo_url, created_at
      FROM predator_sightings
      WHERE user_id = $1
      ORDER BY sighted_at DESC
      LIMIT $2 OFFSET $3
    `, [req.user.id, limit, offset]);

    const { rows: countRows } = await pool.query(
      'SELECT COUNT(*) FROM predator_sightings WHERE user_id = $1',
      [req.user.id]
    );

    res.json({
      sightings: rows.map(formatSighting),
      total: parseInt(countRows[0].count),
      page,
      limit,
    });
  } catch (err) {
    console.error('Predator list error:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Sichtungen.' });
  }
});

// ── GET /api/predators/all ────────────────────────────────────
// Alle Sichtungen kumuliert (nur Admin)
router.get('/all', auth, requireRole('admin'), async (req, res) => {
  try {
    const { type, from, to } = req.query;
    let query = `
      SELECT s.id, s.sighted_at, s.latitude, s.longitude, s.predator_type,
             s.individual_count, s.behavior, s.notes, s.photo_url, s.created_at,
             u.first_name, u.last_name
      FROM predator_sightings s
      LEFT JOIN users u ON u.id = s.user_id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (type) {
      query += ` AND s.predator_type = $${idx}`;
      params.push(type);
      idx++;
    }
    if (from) {
      query += ` AND s.sighted_at >= $${idx}`;
      params.push(from);
      idx++;
    }
    if (to) {
      query += ` AND s.sighted_at <= $${idx}`;
      params.push(to);
      idx++;
    }

    query += ' ORDER BY s.sighted_at DESC LIMIT 500';

    const { rows } = await pool.query(query, params);

    res.json({
      sightings: rows.map(r => ({
        ...formatSighting(r),
        userName: r.first_name ? `${r.first_name} ${r.last_name}` : 'Unbekannt',
      })),
      total: rows.length,
    });
  } catch (err) {
    console.error('Predator all error:', err);
    res.status(500).json({ error: 'Fehler beim Laden aller Sichtungen.' });
  }
});

// ── GET /api/predators/stats ──────────────────────────────────
// Statistik: Anzahl pro Art, letzte 12 Monate
router.get('/stats', auth, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const userFilter = isAdmin ? '' : 'WHERE user_id = $1';
    const params = isAdmin ? [] : [req.user.id];

    // Anzahl pro Art
    const { rows: byType } = await pool.query(`
      SELECT predator_type, COUNT(*) AS count, SUM(individual_count) AS total_individuals
      FROM predator_sightings
      ${userFilter}
      GROUP BY predator_type
      ORDER BY count DESC
    `, params);

    // Gesamt
    const { rows: totalRows } = await pool.query(`
      SELECT COUNT(*) AS sightings, COALESCE(SUM(individual_count), 0) AS individuals
      FROM predator_sightings
      ${userFilter}
    `, params);

    res.json({
      byType: byType.map(r => ({
        type: r.predator_type,
        sightings: parseInt(r.count),
        individuals: parseInt(r.total_individuals),
      })),
      total: {
        sightings: parseInt(totalRows[0].sightings),
        individuals: parseInt(totalRows[0].individuals),
      },
    });
  } catch (err) {
    console.error('Predator stats error:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Statistik.' });
  }
});

// ── POST /api/predators ───────────────────────────────────────
// Neue Sichtung erstellen
router.post('/', auth, upload.single('photo'), async (req, res) => {
  try {
    const {
      sightedAt, latitude, longitude, predatorType,
      individualCount, behavior, notes,
    } = req.body;

    // Validierung
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Bitte Ort auf der Karte markieren.' });
    }
    if (!predatorType) {
      return res.status(400).json({ error: 'Bitte Prädator-Art auswählen.' });
    }

    const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const { rows } = await pool.query(`
      INSERT INTO predator_sightings
        (user_id, sighted_at, latitude, longitude, predator_type,
         individual_count, behavior, notes, photo_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      req.user.id,
      sightedAt || new Date().toISOString(),
      parseFloat(latitude),
      parseFloat(longitude),
      predatorType,
      parseInt(individualCount) || 1,
      behavior || null,
      notes || null,
      photoUrl,
    ]);

    res.status(201).json(formatSighting(rows[0]));
  } catch (err) {
    console.error('Predator create error:', err);
    res.status(500).json({ error: 'Fehler beim Speichern der Sichtung.' });
  }
});

// ── DELETE /api/predators/:id ─────────────────────────────────
// Eigene Sichtung löschen
router.delete('/:id', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM predator_sightings WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Sichtung nicht gefunden.' });
    }

    res.json({ message: 'Sichtung gelöscht.', id: rows[0].id });
  } catch (err) {
    console.error('Predator delete error:', err);
    res.status(500).json({ error: 'Fehler beim Löschen der Sichtung.' });
  }
});

// ── Helper ────────────────────────────────────────────────────
function formatSighting(r) {
  return {
    id: r.id,
    sightedAt: r.sighted_at,
    latitude: parseFloat(r.latitude),
    longitude: parseFloat(r.longitude),
    predatorType: r.predator_type,
    individualCount: r.individual_count,
    behavior: r.behavior,
    notes: r.notes,
    photoUrl: r.photo_url,
    createdAt: r.created_at,
  };
}

module.exports = router;
