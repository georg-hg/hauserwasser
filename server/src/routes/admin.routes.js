const express = require('express');
const ExcelJS = require('exceljs');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Basis-Auth für alle Admin-Routen
router.use(auth);

// Middleware: Admin oder Kontrolleur (async DB-Check)
async function adminOrKontrolleur(req, res, next) {
  if (!req.user) return res.status(403).json({ error: 'Keine Berechtigung.' });
  if (req.user.role === 'admin') return next();
  try {
    const { rows } = await pool.query('SELECT is_kontrolleur FROM users WHERE id = $1', [req.user.id]);
    if (rows[0]?.is_kontrolleur) return next();
  } catch (e) { /* ignore */ }
  return res.status(403).json({ error: 'Keine Berechtigung.' });
}

// Middleware: Nur Admin
function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Keine Berechtigung.' });
  }
  next();
}

// ── GET /api/admin/fishers ──────────────────────────────────
// Alle registrierten Fischer mit Lizenzstatus
router.get('/fishers', adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.role,
             u.is_kontrolleur,
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
      isKontrolleur: r.is_kontrolleur || false,
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
router.post('/fishers/:id/license', adminOnly, async (req, res) => {
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
router.delete('/fishers/:id/license', adminOnly, async (req, res) => {
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
router.get('/fishers/:id/catches', adminOnly, async (req, res) => {
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
// Excel-Export aller Fangbücher (Fischtag-basiert)
router.get('/export/catches', adminOnly, async (req, res) => {
  try {
    const season = req.query.season || new Date().getFullYear();
    const fisherId = req.query.fisherId; // optional: nur ein Fischer

    // 1. Alle Fischtage mit zugehörigen Fängen laden
    let dayQuery = `
      SELECT fd.id as day_id, fd.fishing_date, fd.technique as day_technique,
             fd.notes as day_notes, fd.completed,
             u.first_name, u.last_name, u.email, u.fisher_card_nr, u.id as user_id
      FROM fishing_days fd
      JOIN users u ON u.id = fd.user_id
      WHERE fd.season_year = $1
    `;
    const dayParams = [season];

    if (fisherId) {
      dayQuery += ' AND fd.user_id = $2';
      dayParams.push(fisherId);
    }

    dayQuery += ' ORDER BY u.last_name, u.first_name, fd.fishing_date';

    const { rows: days } = await pool.query(dayQuery, dayParams);

    // 2. Alle Fänge der Saison laden (inkl. Fänge ohne fishing_day_id für Rückwärtskompatibilität)
    let catchQuery = `
      SELECT c.*, cs.german_name,
             u.first_name, u.last_name, u.email, u.fisher_card_nr
      FROM catches c
      JOIN users u ON u.id = c.user_id
      LEFT JOIN closed_seasons cs ON cs.fish_species = c.fish_species
      WHERE EXTRACT(YEAR FROM c.catch_date) = $1
    `;
    const catchParams = [season];

    if (fisherId) {
      catchQuery += ' AND c.user_id = $2';
      catchParams.push(fisherId);
    }

    catchQuery += ' ORDER BY u.last_name, u.first_name, c.catch_date, c.catch_time';

    const { rows: catches } = await pool.query(catchQuery, catchParams);

    // Excel-Workbook erstellen
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Hauserwasser Fangbuch';
    wb.created = new Date();

    // ── Sheet 1: Fischtage ────────────────────────────
    const dayWs = wb.addWorksheet(`Fischtage ${season}`, {
      headerFooter: { firstHeader: `Hauserwasser Fischtage – Saison ${season}` },
    });

    dayWs.columns = [
      { header: 'Fischer', key: 'fisher', width: 22 },
      { header: 'Datum', key: 'date', width: 14 },
      { header: 'Methode', key: 'technique', width: 16 },
      { header: 'Fänge', key: 'catchCount', width: 10 },
      { header: 'Entnommen', key: 'keptCount', width: 12 },
      { header: 'Abgeschlossen', key: 'completed', width: 14 },
      { header: 'Notizen', key: 'notes', width: 30 },
    ];

    dayWs.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    dayWs.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };

    days.forEach(d => {
      const dayCatches = catches.filter(c => c.fishing_day_id === d.day_id);
      dayWs.addRow({
        fisher: `${d.last_name} ${d.first_name}`,
        date: d.fishing_date ? new Date(d.fishing_date).toLocaleDateString('de-AT') : '',
        technique: d.day_technique || '',
        catchCount: dayCatches.length,
        keptCount: dayCatches.filter(c => c.kept).length,
        completed: d.completed ? 'Ja' : 'Offen',
        notes: d.day_notes || '',
      });
    });

    // ── Sheet 2: Fänge (Detail) ────────────────────────
    const ws = wb.addWorksheet(`Fangbuch ${season}`, {
      headerFooter: { firstHeader: `Hauserwasser Fangbuch – Saison ${season}` },
    });

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

    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };

    catches.forEach(r => {
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

    // ── Sheet 3: Zusammenfassung ───────────────────────
    const summaryWs = wb.addWorksheet('Zusammenfassung');
    summaryWs.columns = [
      { header: 'Fischer', key: 'fisher', width: 25 },
      { header: 'Fischtage', key: 'fishingDays', width: 14 },
      { header: 'Tage ohne Fang', key: 'emptyDays', width: 16 },
      { header: 'Gesamtfänge', key: 'total', width: 14 },
      { header: 'Entnommen', key: 'kept', width: 14 },
      { header: 'Zurückgesetzt', key: 'released', width: 14 },
    ];
    summaryWs.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    summaryWs.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };

    // Aggregation pro Fischer (aus echter fishing_days Tabelle)
    const fisherMap = {};

    // Fischtage zählen
    days.forEach(d => {
      const key = d.email;
      if (!fisherMap[key]) {
        fisherMap[key] = { fisher: `${d.last_name} ${d.first_name}`, fishingDays: 0, total: 0, kept: 0, released: 0 };
      }
      fisherMap[key].fishingDays++;
    });

    // Fänge zählen
    catches.forEach(r => {
      const key = r.email;
      if (!fisherMap[key]) {
        fisherMap[key] = { fisher: `${r.last_name} ${r.first_name}`, fishingDays: 0, total: 0, kept: 0, released: 0 };
      }
      fisherMap[key].total++;
      if (r.kept) fisherMap[key].kept++;
      else fisherMap[key].released++;
    });

    Object.values(fisherMap).forEach(f => {
      // Fischtage ohne Fang = Fischtage total - Tage mit mindestens einem Fang
      const daysWithCatch = new Set(
        catches.filter(c => c.email === Object.keys(fisherMap).find(k => fisherMap[k] === f))
          .map(c => c.catch_date?.toISOString?.()?.slice(0, 10))
          .filter(Boolean)
      ).size;
      summaryWs.addRow({
        fisher: f.fisher,
        fishingDays: f.fishingDays,
        emptyDays: Math.max(0, f.fishingDays - daysWithCatch),
        total: f.total,
        kept: f.kept,
        released: f.released,
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

// ── GET /api/admin/stats ─────────────────────────────────────
// Statistik-Daten für Admin-Dashboard Charts (Admin + Kontrolleur)
router.get('/stats', adminOrKontrolleur, async (req, res) => {
  try {
    const season = req.query.season || new Date().getFullYear();

    // 1. Fänge pro Monat (mit entnommen/zurückgesetzt)
    const { rows: monthlyRows } = await pool.query(`
      SELECT
        EXTRACT(MONTH FROM c.catch_date)::int AS month,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE c.kept = true)::int AS kept,
        COUNT(*) FILTER (WHERE c.kept = false)::int AS released
      FROM catches c
      WHERE EXTRACT(YEAR FROM c.catch_date) = $1
      GROUP BY month ORDER BY month
    `, [season]);

    // Alle 12 Monate füllen
    const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    const catchesPerMonth = monthNames.map((name, i) => {
      const row = monthlyRows.find(r => r.month === i + 1);
      return { month: name, total: row?.total || 0, kept: row?.kept || 0, released: row?.released || 0 };
    });

    // 2. Top Fischarten
    const { rows: speciesRows } = await pool.query(`
      SELECT COALESCE(cs.german_name, c.fish_species) AS species,
             COUNT(*)::int AS count
      FROM catches c
      LEFT JOIN closed_seasons cs ON cs.fish_species = c.fish_species
      WHERE EXTRACT(YEAR FROM c.catch_date) = $1
      GROUP BY species ORDER BY count DESC LIMIT 8
    `, [season]);

    // 3. Fischtage pro Fischer (Top 10)
    const { rows: fisherActivityRows } = await pool.query(`
      SELECT u.first_name || ' ' || LEFT(u.last_name, 1) || '.' AS fisher,
             COUNT(DISTINCT fd.id)::int AS fishing_days,
             COUNT(c.id)::int AS catches
      FROM users u
      LEFT JOIN fishing_days fd ON fd.user_id = u.id AND fd.season_year = $1
      LEFT JOIN catches c ON c.fishing_day_id = fd.id
      WHERE u.role != 'admin'
        AND (fd.id IS NOT NULL)
      GROUP BY u.id, u.first_name, u.last_name
      ORDER BY fishing_days DESC
      LIMIT 10
    `, [season]);

    // 4. Übersicht: Tage mit Fang vs. ohne Fang
    const { rows: dayStats } = await pool.query(`
      SELECT
        COUNT(*)::int AS total_days,
        COUNT(*) FILTER (WHERE sub.catch_count > 0)::int AS days_with_catch,
        COUNT(*) FILTER (WHERE sub.catch_count = 0)::int AS days_without_catch
      FROM (
        SELECT fd.id, COUNT(c.id) AS catch_count
        FROM fishing_days fd
        LEFT JOIN catches c ON c.fishing_day_id = fd.id
        WHERE fd.season_year = $1
        GROUP BY fd.id
      ) sub
    `, [season]);

    // 5. Gesamtzahlen
    const { rows: totals } = await pool.query(`
      SELECT
        (SELECT COUNT(DISTINCT id) FROM users WHERE role != 'admin') AS fisher_count,
        (SELECT COUNT(*) FROM fishing_days WHERE season_year = $1) AS total_days,
        (SELECT COUNT(*) FROM catches WHERE EXTRACT(YEAR FROM catch_date) = $1) AS total_catches,
        (SELECT COUNT(*) FROM catches WHERE EXTRACT(YEAR FROM catch_date) = $1 AND kept = true) AS total_kept
    `, [season]);

    res.json({
      season: parseInt(season),
      totals: {
        fisherCount: parseInt(totals[0].fisher_count),
        totalDays: parseInt(totals[0].total_days),
        totalCatches: parseInt(totals[0].total_catches),
        totalKept: parseInt(totals[0].total_kept),
      },
      catchesPerMonth,
      topSpecies: speciesRows,
      fisherActivity: fisherActivityRows,
      dayStats: dayStats[0] || { total_days: 0, days_with_catch: 0, days_without_catch: 0 },
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Statistiken.' });
  }
});

// ── GET /api/admin/notifications ─────────────────────────────
// Admin-Inbox: alle Benachrichtigungen
router.get('/notifications', adminOnly, async (req, res) => {
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
router.get('/notifications/unread-count', adminOnly, async (req, res) => {
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

// ── PUT /api/admin/notifications/read-all ────────────────────
// Alle Notifications als gelesen markieren (MUSS vor :id stehen!)
router.put('/notifications/read-all', adminOnly, async (req, res) => {
  try {
    await pool.query('UPDATE admin_notifications SET read = true WHERE read = false');
    res.json({ message: 'Alle gelesen.' });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ error: 'Fehler.' });
  }
});

// ── PUT /api/admin/notifications/:id/read ────────────────────
// Einzelne Notification als gelesen markieren
router.put('/notifications/:id/read', adminOnly, async (req, res) => {
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

// ── PUT /api/admin/fishers/:id/block ─────────────────────────
// User sperren
router.put('/fishers/:id/block', adminOnly, async (req, res) => {
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
router.put('/fishers/:id/unblock', adminOnly, async (req, res) => {
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

// ── PUT /api/admin/fishers/:id/reset-password ────────────────
// Passwort zurücksetzen (Admin setzt temporäres Passwort)
router.put('/fishers/:id/reset-password', adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben.' });
    }

    const { rows } = await pool.query('SELECT id, role, first_name, last_name FROM users WHERE id = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Fischer nicht gefunden.' });
    if (rows[0].role === 'admin') return res.status(403).json({ error: 'Admin-Passwort kann hier nicht geändert werden.' });

    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, id]);

    console.log(`[Admin] Passwort zurückgesetzt für: ${rows[0].first_name} ${rows[0].last_name} (ID: ${id})`);
    res.json({ message: `Passwort für "${rows[0].first_name} ${rows[0].last_name}" wurde zurückgesetzt.` });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Fehler beim Zurücksetzen des Passworts.' });
  }
});

// ── PUT /api/admin/fishers/:id/email ─────────────────────────
// E-Mail-Adresse ändern
router.put('/fishers/:id/email', adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const { newEmail } = req.body;

    if (!newEmail || !newEmail.includes('@')) {
      return res.status(400).json({ error: 'Gültige E-Mail-Adresse erforderlich.' });
    }

    const { rows } = await pool.query('SELECT id, role, first_name, last_name, email FROM users WHERE id = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Fischer nicht gefunden.' });
    if (rows[0].role === 'admin') return res.status(403).json({ error: 'Admin-E-Mail kann hier nicht geändert werden.' });

    // Prüfen ob neue E-Mail schon vergeben
    const existing = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [newEmail.toLowerCase(), id]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Diese E-Mail-Adresse ist bereits vergeben.' });
    }

    const oldEmail = rows[0].email;
    await pool.query('UPDATE users SET email = $1, updated_at = NOW() WHERE id = $2', [newEmail.toLowerCase(), id]);

    console.log(`[Admin] E-Mail geändert für: ${rows[0].first_name} ${rows[0].last_name} (${oldEmail} → ${newEmail})`);
    res.json({ message: `E-Mail für "${rows[0].first_name} ${rows[0].last_name}" geändert auf ${newEmail}.` });
  } catch (err) {
    console.error('Change email error:', err);
    res.status(500).json({ error: 'Fehler beim Ändern der E-Mail.' });
  }
});

// ── DELETE /api/admin/fishers/:id ─────────────────────────────
// User komplett löschen (inkl. Fänge, Lizenzen, Notifications)
router.delete('/fishers/:id', adminOnly, async (req, res) => {
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

// ── PUT /api/admin/fishers/:id/kontrolleur ───────────────────
// Kontrolleur-Flag toggeln
router.put('/fishers/:id/kontrolleur', adminOnly, async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query('SELECT id, role, is_kontrolleur, first_name, last_name FROM users WHERE id = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Fischer nicht gefunden.' });
    if (rows[0].role === 'admin') return res.status(403).json({ error: 'Admin kann nicht geändert werden.' });

    const newValue = !rows[0].is_kontrolleur;
    await pool.query('UPDATE users SET is_kontrolleur = $1, updated_at = NOW() WHERE id = $2', [newValue, id]);

    const label = newValue ? 'Kontrolleur' : 'Fischer';
    console.log(`[Admin] Kontrolleur-Flag geändert für: ${rows[0].first_name} ${rows[0].last_name} → ${label}`);
    res.json({ message: `"${rows[0].first_name} ${rows[0].last_name}" ist jetzt ${label}.` });
  } catch (err) {
    console.error('Toggle kontrolleur error:', err);
    res.status(500).json({ error: 'Fehler beim Ändern des Kontrolleur-Status.' });
  }
});

// ── GET /api/admin/am-wasser ─────────────────────────────────
// Wer ist gerade am Wasser? (Online-Status + aktiver Fischtag)
router.get('/am-wasser', adminOrKontrolleur, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const { rows } = await pool.query(`
      SELECT
        u.id, u.first_name, u.last_name, u.email, u.fisher_card_nr,
        u.last_seen,
        fd.id AS fishing_day_id,
        fd.fishing_date,
        fd.technique,
        fd.notes AS day_notes,
        fd.completed AS day_completed,
        fd.created_at AS day_started,
        (SELECT COUNT(*) FROM catches c WHERE c.fishing_day_id = fd.id)::int AS catch_count,
        -- Letzter Fang-Standort des heutigen Fischtags
        (SELECT latitude FROM catches c WHERE c.fishing_day_id = fd.id AND c.latitude IS NOT NULL ORDER BY c.created_at DESC LIMIT 1) AS last_lat,
        (SELECT longitude FROM catches c WHERE c.fishing_day_id = fd.id AND c.longitude IS NOT NULL ORDER BY c.created_at DESC LIMIT 1) AS last_lng,
        (SELECT location_name FROM catches c WHERE c.fishing_day_id = fd.id AND c.location_name IS NOT NULL ORDER BY c.created_at DESC LIMIT 1) AS last_location
      FROM users u
      LEFT JOIN fishing_days fd ON fd.user_id = u.id AND fd.fishing_date = $1 AND fd.completed = false
      WHERE u.role != 'admin'
      ORDER BY
        fd.id IS NOT NULL DESC,
        u.last_seen DESC NULLS LAST,
        u.last_name, u.first_name
    `, [today]);

    // Online = last_seen innerhalb der letzten 5 Minuten
    const ONLINE_THRESHOLD = 5 * 60 * 1000;
    const now = Date.now();

    res.json(rows.map(r => ({
      id: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      email: r.email,
      fisherCardNr: r.fisher_card_nr,
      online: r.last_seen ? (now - new Date(r.last_seen).getTime()) < ONLINE_THRESHOLD : false,
      lastSeen: r.last_seen,
      fishingDay: r.fishing_day_id ? {
        id: r.fishing_day_id,
        date: r.fishing_date,
        technique: r.technique,
        notes: r.day_notes,
        completed: r.day_completed,
        startedAt: r.day_started,
        catchCount: r.catch_count,
        lastPosition: r.last_lat ? {
          latitude: parseFloat(r.last_lat),
          longitude: parseFloat(r.last_lng),
          locationName: r.last_location,
        } : null,
      } : null,
    })));
  } catch (err) {
    console.error('Am-Wasser error:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Übersicht.' });
  }
});

module.exports = router;
