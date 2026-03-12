const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { JWT_SECRET } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

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
