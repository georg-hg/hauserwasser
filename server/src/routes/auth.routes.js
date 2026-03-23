const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { JWT_SECRET } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// ── E-Mail Transporter ─────────────────────────────────────
const mailTransporter = process.env.GMAIL_APP_PASSWORD
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'hauserwasser@gmail.com',
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })
  : null;

async function sendRegistrationNotification({ firstName, lastName, email, fisherCardNr }) {
  if (!mailTransporter) {
    console.warn('Mail nicht konfiguriert – GMAIL_APP_PASSWORD fehlt.');
    return;
  }
  try {
    await mailTransporter.sendMail({
      from: '"Hauserwasser Fangbuch" <hauserwasser@gmail.com>',
      to: 'hauserwasser@gmail.com',
      subject: `Neue Registrierung: ${firstName} ${lastName}`,
      html: `
        <h2>Neue Registrierung im Hauserwasser Fangbuch</h2>
        <p>Es hat sich eine neue Person für das digitale Fangbuch registriert:</p>
        <table style="border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:6px 12px;font-weight:bold;">Vorname:</td><td style="padding:6px 12px;">${firstName}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;">Nachname:</td><td style="padding:6px 12px;">${lastName}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;">E-Mail:</td><td style="padding:6px 12px;">${email}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;">Fischerkarte Nr.:</td><td style="padding:6px 12px;">${fisherCardNr || '–'}</td></tr>
        </table>
        <p style="color:#666;font-size:13px;">Diese E-Mail wurde automatisch vom Hauserwasser Fangbuch versendet.</p>
      `,
    });
    console.log('Registrierungs-Mail versendet für:', email);
  } catch (err) {
    console.error('Mail-Versand fehlgeschlagen:', err.message);
  }
}

// ── POST /api/auth/register ────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, birthDate, fisherCardNr } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Alle Pflichtfelder ausfüllen.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben.' });
    }

    // Prüfen ob Email schon existiert
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'E-Mail bereits registriert.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, birth_date, fisher_card_nr)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, first_name, last_name, role`,
      [email.toLowerCase(), passwordHash, firstName, lastName, birthDate || null, fisherCardNr || null]
    );

    const user = rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // E-Mail-Benachrichtigung (async, blockiert Response nicht)
    sendRegistrationNotification({ firstName, lastName, email, fisherCardNr });

    // Admin-Notification in DB speichern
    pool.query(
      `INSERT INTO admin_notifications (type, title, message, related_user_id)
       VALUES ('registration', $1, $2, $3)`,
      [
        `Neue Registrierung: ${firstName} ${lastName}`,
        `${firstName} ${lastName} (${email}) hat sich registriert. Fischerkarte: ${fisherCardNr || '–'}`,
        user.id,
      ]
    ).catch(err => console.error('Notification insert error:', err.message));

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registrierung fehlgeschlagen.' });
  }
});

// ── POST /api/auth/login ───────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'E-Mail und Passwort erforderlich.' });
    }

    const { rows } = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'E-Mail oder Passwort falsch.' });
    }

    const user = rows[0];

    if (user.blocked) {
      return res.status(403).json({ error: 'Dein Zugang wurde gesperrt. Bitte kontaktiere den Fischereiverband.' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'E-Mail oder Passwort falsch.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        fisherCardUrl: user.fisher_card_url || null,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Anmeldung fehlgeschlagen.' });
  }
});

// ── GET /api/auth/me ───────────────────────────────────────
router.get('/me', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, first_name, last_name, role, birth_date,
              fisher_card_nr, fisher_card_url, license_valid_from, license_valid_to
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User nicht gefunden.' });
    }

    const u = rows[0];
    res.json({
      id: u.id,
      email: u.email,
      firstName: u.first_name,
      lastName: u.last_name,
      role: u.role,
      birthDate: u.birth_date,
      fisherCardNr: u.fisher_card_nr,
      fisherCardUrl: u.fisher_card_url,
      licenseValidFrom: u.license_valid_from,
      licenseValidTo: u.license_valid_to,
    });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Fehler beim Laden des Profils.' });
  }
});

// ── PUT /api/auth/password ────────────────────────────────
// Passwort ändern (Self-Service)
router.put('/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Aktuelles und neues Passwort erforderlich.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Neues Passwort muss mindestens 8 Zeichen haben.' });
    }

    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User nicht gefunden.' });
    }

    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Aktuelles Passwort ist falsch.' });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, req.user.id]);

    res.json({ message: 'Passwort erfolgreich geändert.' });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ error: 'Passwortänderung fehlgeschlagen.' });
  }
});

// ── PUT /api/auth/profile ─────────────────────────────────
// Profildaten ändern (Self-Service: Name, E-Mail)
router.put('/profile', auth, async (req, res) => {
  try {
    const { firstName, lastName, email } = req.body;

    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: 'Vorname, Nachname und E-Mail sind Pflichtfelder.' });
    }
    if (!email.includes('@')) {
      return res.status(400).json({ error: 'Bitte eine gültige E-Mail-Adresse eingeben.' });
    }

    // Prüfen ob neue E-Mail schon vergeben (von jemand anderem)
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND id != $2',
      [email.toLowerCase(), req.user.id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Diese E-Mail-Adresse ist bereits vergeben.' });
    }

    await pool.query(
      `UPDATE users SET first_name = $1, last_name = $2, email = $3, updated_at = NOW()
       WHERE id = $4`,
      [firstName.trim(), lastName.trim(), email.toLowerCase().trim(), req.user.id]
    );

    res.json({
      message: 'Profil aktualisiert.',
      user: { firstName: firstName.trim(), lastName: lastName.trim(), email: email.toLowerCase().trim() },
    });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Profilaktualisierung fehlgeschlagen.' });
  }
});

// ── GET /api/auth/license ────────────────────────────────────
// Aktuelle Lizenz-Info für eingeloggten User
router.get('/license', auth, async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const { rows } = await pool.query(`
      SELECT id, season_year, license_name, activated_at, revoked_at
      FROM licenses
      WHERE user_id = $1 AND season_year = $2 AND revoked_at IS NULL
      ORDER BY activated_at DESC
    `, [req.user.id, year]);

    res.json({
      licenses: rows.map(r => ({
        id: r.id,
        seasonYear: r.season_year,
        licenseName: r.license_name,
        activatedAt: r.activated_at,
        active: !r.revoked_at,
      })),
    });
  } catch (err) {
    console.error('License check error:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Lizenz.' });
  }
});

// ── POST /api/auth/fisher-card ─────────────────────────────
// Fischerkarte hochladen (Wallet)
router.post('/fisher-card', auth, upload.single('card'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Kein Bild hochgeladen.' });
    }

    // Alte Karte löschen falls vorhanden
    const { rows: existing } = await pool.query(
      'SELECT fisher_card_url FROM users WHERE id = $1', [req.user.id]
    );
    if (existing[0]?.fisher_card_url) {
      const oldPath = path.join(__dirname, '../../', existing[0].fisher_card_url);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const cardUrl = `/uploads/${req.file.filename}`;
    await pool.query(
      'UPDATE users SET fisher_card_url = $1, updated_at = NOW() WHERE id = $2',
      [cardUrl, req.user.id]
    );

    res.json({ fisherCardUrl: cardUrl, message: 'Fischerkarte gespeichert.' });
  } catch (err) {
    console.error('Fisher card upload error:', err);
    res.status(500).json({ error: 'Upload fehlgeschlagen.' });
  }
});

// ── DELETE /api/auth/fisher-card ───────────────────────────
// Fischerkarte entfernen
router.delete('/fisher-card', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT fisher_card_url FROM users WHERE id = $1', [req.user.id]
    );
    if (rows[0]?.fisher_card_url) {
      const filePath = path.join(__dirname, '../../', rows[0].fisher_card_url);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await pool.query(
      'UPDATE users SET fisher_card_url = NULL, updated_at = NOW() WHERE id = $1',
      [req.user.id]
    );

    res.json({ message: 'Fischerkarte entfernt.' });
  } catch (err) {
    console.error('Fisher card delete error:', err);
    res.status(500).json({ error: 'Löschen fehlgeschlagen.' });
  }
});

module.exports = router;
