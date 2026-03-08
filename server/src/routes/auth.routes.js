const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { JWT_SECRET } = require('../middleware/auth');

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
              fisher_card_nr, license_valid_from, license_valid_to
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
      licenseValidFrom: u.license_valid_from,
      licenseValidTo: u.license_valid_to,
    });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Fehler beim Laden des Profils.' });
  }
});

module.exports = router;
