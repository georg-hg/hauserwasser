const express = require('express');
const ExcelJS = require('exceljs');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Alle Routen erfordern Admin-Rolle
router.use(auth, requireRole('admin'));

// ── GET /api/admin/fishers ──────────────────────────────────
// Alle registrierten Fischer mit Lizenzstatus
router.get('/fishers', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.role,
             u.fisher_card_nr, u.birth_date, u.created_at,
             u.blocked, u.blocked_at, u.blocked_reason,
             l.id AS license_id, l.season_year, l.activated_at, l.revoked_at,
             (SELECT COUNT(*) FROM catches c WHERE c.user_id = u.id
              AND EXTRACT(YEAR FROM c.catch_date) = $1) AS catch_count
      FROM users u
      LEFT JOIN licenses l ON l.user_id = u.id AND l.season_year = $1 AND l.revoked_at IS NULL
      WHERE u.role != 'admin'
      ORDER BY u.last_name, u.first_name
    `, [new Date().getFullYear()]);

    res.json(rows.map(r => ({
      id: r.id,
      email: r.email,
      firstName: r.first_name,
      lastName: r.last_name,
      role: r.role,
      fisherCardNr: r.fisher_card_nr,
      birthDate: r.birth_date,
      createdAt: r.created_at,
      blocked: r.blocked || false,
      blockedAt: r.blocked_at,
      blockedReason: r.blocked_reason,
      catchCount: parseInt(r.catch_count),
      license: r.license_id ? {
        id: r.license_id,
        seasonYear: r.season_year,
        activatedAt: r.activated_at,
        active: !r.revoked_at,
      } : null,
    })));
  } catch (err) {
    console.error('Admin fishers error:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Fischer.' });
  }
});

// ── POST /api/admin/fishers/:id/license ─────────────────────
// Jahreslizenz freischalten
router.post('/fishers/:id/license', async (req, res) => {
  try {
    const { id } = req.params;
    const year = req.body.year || new Date().getFullYear();

    // Prüfen ob User existiert
    const user = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'Fischer nicht gefunden.' });
    }

    // Upsert: Lizenz erstellen oder reaktivieren
    const { rows } = await pool.query(`
      INSERT INTO licenses (user_id, season_year, license_name, activated_by)
      VALUES ($1, $2, 'Hauserwasser', $3)
      ON CONFLICT (user_id, season_year, license_name)
      DO UPDATE SET revoked_at = NULL, activated_at = NOW(), activated_by = $3
      RETURNING *
    `, [id, year, req.user.id]);

    res.json({
      message: 'Lizenz freigeschaltet.',
      license: {
        id: rows[0].id,
        seasonYear: rows[0].season_year,
        activatedAt: rows[0].activated_at,
        active: true,
      },
    });
  } catch (err) {
    console.error('License activate error:', err);
    res.status(500).json({ error: 'Fehler beim Freischalten.' });
  }
});

// ── DELETE /api/admin/fishers/:id/license ────────────────────
// Jahreslizenz widerrufen
router.delete('/fishers/:id/license', async (req, res) => {
  try {
    const { id } = req.params;
    const year = req.query.year || new Date().getFullYear();

    await pool.query(`
      UPDATE licenses SET revoked_at = NOW()
      WHERE user_id = $1 AND season_year = $2 AND license_name = 'Hauserwasser' AND revoked_at IS NULL
    `, [id, year]);

    res.json({ message: 'Lizenz widerrufen.' });
  } catch (err) {
    console.error('License revoke error:', err);
    res.status(500).json({ error: 'Fehler beim Widerrufen.' });
  }
});

// ── GET /api/admin/fishers/:id/catches ──────────────────────
// Fangbuch eines bestimmten Fischers
router.get('/fishers/:id/catches', async (req, res) => {
  try {
    const { id } = req.params;
    const season = req.query.season || new Date().getFullYear();

    const { rows } = await pool.query(`
      SELECT c.*, cs.german_name, cs.min_size_cm
      FROM catches c
      LEFT JOIN closed_seasons cs ON cs.fish_species = c.fish_species
      WHERE c.user_id = $1 AND EXTRACT(YEAR FROM c.catch_date) = $2
      ORDER BY c.catch_date DESC, c.catch_time DESC
    `, [id, season]);

    // Fischer-Info
    const user = await pool.query(
      'SELECT first_name, last_name, email, fisher_card_nr FROM users WHERE id = $1',
      [id]
    );

    res.json({
      fisher: user.rows[0] ? {
        firstName: user.rows[0].first_name,
        lastName: user.rows[0].last_name,
        email: user.rows[0].email,
        fisherCardNr: user.rows[0].fisher_card_nr,
      } : null,
      catches: rows,
      total: rows.length,
    });
  } catch (err) {
    console.error('Admin catches error:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Fänge.' });
  }
});

// ── GET /api/admin/export/catches ───────────────────────────
// Excel-Export aller Fangbücher
router.get('/export/catches', async (req, res) => {
  try {
    const season = req.query.season || new Date().getFullYear();
    const fisherId = req.query.fisherId; // optional: nur ein Fischer

    let query = `
      SELECT c.catch_date, c.catch_time, c.fish_species,
             cs.german_name, c.length_cm, c.weight_kg,
             c.technique, c.kept, c.latitude, c.longitude,
             c.location_name, c.notes,
             u.first_name, u.last_name, u.email, u.fisher_card_nr
      FROM catches c
      JOIN users u ON u.id = c.user_id
      LEFT JOIN closed_seasons cs ON cs.fish_species = c.fish_species
      WHERE EXTRACT(YEAR FROM c.catch_date) = $1
    `;
    const params = [season];

    if (fisherId) {
      query += ' AND c.user_id = $2';
      params.push(fisherId);
    }

    query += ' ORDER BY u.last_name, u.first_name, c.catch_date, c.catch_time';

    const { rows } = await pool.query(query, params);

    // Excel-Workbook erstellen
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Hauserwasser Fangbuch';
    wb.created = new Date();

    const ws = wb.addWorksheet(`Fangbuch ${season}`, {
      headerFooter: {
        firstHeader: `Hauserwasser Fangbuch – Saison ${season}`,
      },
    });

    // Spalten definieren
    ws.columns = [
      { header: 'Fischer', key: 'fisher', width: 22 },
      { header: 'E-Mail', key: 'email', width: 25 },
      { header: 'Fischerkarten-Nr.', key: 'cardNr', width: 16 },
      { header: 'Datum', key: 'date', width: 12 },
      { header: 'Uhrzeit', key: 'time', width: 10 },
      { header: 'Fischart', key: 'species', width: 20 },
      { header: 'Länge (cm)', key: 'length', width: 12 },
      { header: 'Gewicht (kg)', key: 'weight', width: 12 },
      { header: 'Technik', key: 'technique', width: 16 },
      { header: 'Entnommen', key: 'kept', width: 12 },
      { header: 'Standort', key: 'location', width: 18 },
      { header: 'Breitengrad', key: 'lat', width: 14 },
      { header: 'Längengrad', key: 'lng', width: 14 },
      { header: 'Anmerkungen', key: 'notes', width: 30 },
    ];

    // Header-Zeile formatieren
    ws.getRow(1).font = { bold: true, size: 11 };
    ws.getRow(1).fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: 'FF1E3A5F' },
    };
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };

    // Daten eintragen
    rows.forEach(r => {
      ws.addRow({
        fisher: `${r.last_name} ${r.first_name}`,
        email: r.email,
        cardNr: r.fisher_card_nr || '',
        date: r.catch_date ? new Date(r.catch_date).toLocaleDateString('de-AT') : '',
        time: r.catch_time || '',
        species: r.german_name || r.fish_species,
        length: r.length_cm ? parseFloat(r.length_cm) : '',
        weight: r.weight_kg ? parseFloat(r.weight_kg) : '',
        technique: r.technique || '',
        kept: r.kept ? 'Ja' : 'Nein',
        location: r.location_name || '',
        lat: r.latitude ? parseFloat(r.latitude) : '',
        lng: r.longitude ? parseFloat(r.longitude) : '',
        notes: r.notes || '',
      });
    });

    // Zusammenfassung als zweites Sheet
    const summaryWs = wb.addWorksheet('Zusammenfassung');
    summaryWs.columns = [
      { header: 'Fischer', key: 'fisher', width: 25 },
      { header: 'Gesamtfänge', key: 'total', width: 14 },
      { header: 'Entnommen', key: 'kept', width: 14 },
      { header: 'Zurückgesetzt', key: 'released', width: 14 },
      { header: 'Fischtage', key: 'fishingDays', width: 14 },
    ];
    summaryWs.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    summaryWs.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };

    // Aggregation pro Fischer
    const fisherMap = {};
    rows.forEach(r => {
      const key = r.email;
      if (!fisherMap[key]) {
        fisherMap[key] = {
          fisher: `${r.last_name} ${r.first_name}`,
          total: 0, kept: 0, released: 0,
          dates: new Set(),
        };
      }
      fisherMap[key].total++;
      if (r.kept) fisherMap[key].kept++;
      else fisherMap[key].released++;
      if (r.catch_date) fisherMap[key].dates.add(r.catch_date.toISOString().slice(0, 10));
    });

    Object.values(fisherMap).forEach(f => {
      summaryWs.addRow({
        fisher: f.fisher,
        total: f.total,
        kept: f.kept,
        released: f.released,
        fishingDays: f.dates.size,
      });
    });

    // Response als Excel-Download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',
      `attachment; filename="Fangbuch_Hauserwasser_${season}.xlsx"`);

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Export fehlgeschlagen.' });
  }
});

// ── GET /api/admin/notifications ─────────────────────────────
// Admin-Inbox: alle Benachrichtigungen
router.get('/notifications', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT n.*, u.first_name, u.last_name, u.email, u.fisher_card_nr, u.blocked
      FROM admin_notifications n
      LEFT JOIN users u ON u.id = n.related_user_id
      ORDER BY n.created_at DESC
      LIMIT 100
    `);
    res.json(rows.map(r => ({
      id: r.id,
      type: r.type,
      title: r.title,
      message: r.message,
      read: r.read,
      createdAt: r.created_at,
      relatedUser: r.related_user_id ? {
        id: r.related_user_id,
        firstName: r.first_name,
        lastName: r.last_name,
        email: r.email,
        fisherCardNr: r.fisher_card_nr,
        blocked: r.blocked,
      } : null,
    })));
  } catch (err) {
    console.error('Notifications error:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Benachrichtigungen.' });
  }
});

// ── GET /api/admin/notifications/unread-count ────────────────
// Anzahl ungelesener Notifications (für Badge)
router.get('/notifications/unread-count', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT COUNT(*) AS count FROM admin_notifications WHERE read = false'
    );
    res.json({ count: parseInt(rows[0].count) });
  } catch (err) {
    console.error('Unread count error:', err);
    res.status(500).json({ error: 'Fehler.' });
  }
});

// ── PUT /api/admin/notifications/:id/read ────────────────────
// Einzelne Notification als gelesen markieren
router.put('/notifications/:id/read', async (req, res) => {
  try {
    await pool.query(
      'UPDATE admin_notifications SET read = true WHERE id = $1',
      [req.params.id]
    );
    res.json({ message: 'Gelesen.' });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Fehler.' });
  }
});

// ── PUT /api/admin/notifications/read-all ────────────────────
// Alle Notifications als gelesen markieren
router.put('/notifications/read-all', async (req, res) => {
  try {
    await pool.query('UPDATE admin_notifications SET read = true WHERE read = false');
    res.json({ message: 'Alle gelesen.' });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ error: 'Fehler.' });
  }
});

// ── PUT /api/admin/fishers/:id/block ─────────────────────────
// User sperren
router.put('/fishers/:id/block', async (req, res) => {
  try {
    const { reason } = req.body;
    await pool.query(
      `UPDATE users SET blocked = true, blocked_at = NOW(), blocked_reason = $2
       WHERE id = $1`,
      [req.params.id, reason || null]
    );
    res.json({ message: 'Fischer gesperrt.' });
  } catch (err) {
    console.error('Block error:', err);
    res.status(500).json({ error: 'Fehler beim Sperren.' });
  }
});

// ── PUT /api/admin/fishers/:id/unblock ───────────────────────
// User entsperren
router.put('/fishers/:id/unblock', async (req, res) => {
  try {
    await pool.query(
      `UPDATE users SET blocked = false, blocked_at = NULL, blocked_reason = NULL
       WHERE id = $1`,
      [req.params.id]
    );
    res.json({ message: 'Fischer entsperrt.' });
  } catch (err) {
    console.error('Unblock error:', err);
    res.status(500).json({ error: 'Fehler beim Entsperren.' });
  }
});

// ── DELETE /api/admin/fishers/:id ─────────────────────────────
// User komplett löschen (inkl. Fänge, Lizenzen, Notifications)
router.delete('/fishers/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Prüfen ob User existiert und kein Admin ist
    const { rows } = await pool.query('SELECT id, role, first_name, last_name FROM users WHERE id = $1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Fischer nicht gefunden.' });
    }
    if (rows[0].role === 'admin') {
      return res.status(403).json({ error: 'Admin-Accounts können nicht gelöscht werden.' });
    }

    const name = `${rows[0].first_name} ${rows[0].last_name}`;

    // Abhängige Daten löschen (Reihenfolge beachten wg. Foreign Keys)
    await pool.query('DELETE FROM catches WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM licenses WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM admin_notifications WHERE related_user_id = $1', [id]);
    await pool.query('DELETE FROM users WHERE id = $1', [id]);

    console.log(`[Admin] User gelöscht: ${name} (ID: ${id})`);
    res.json({ message: `Fischer "${name}" wurde gelöscht.` });
  } catch (err) {
    console.error('Delete fisher error:', err);
    res.status(500).json({ error: 'Fehler beim Löschen: ' + err.message });
  }
});

module.exports = router;
