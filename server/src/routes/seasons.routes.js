const express = require('express');
const pool = require('../config/db');

const router = express.Router();

// ── GET /api/seasons ───────────────────────────────────────
// Alle Schonzeiten und Mindestmaße
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM closed_seasons ORDER BY german_name'
    );

    // Aktuelle Schonzeit-Info hinzufügen
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const current = `${month}-${day}`;

    const enriched = rows.map((s) => {
      let isCurrentlyClosed = false;

      if (s.year_round) {
        isCurrentlyClosed = true;
      } else if (s.season_start <= s.season_end) {
        isCurrentlyClosed = current >= s.season_start && current <= s.season_end;
      } else {
        // Schonzeit über Jahreswechsel (z.B. 09-16 bis 03-15)
        isCurrentlyClosed = current >= s.season_start || current <= s.season_end;
      }

      return {
        ...s,
        isCurrentlyClosed,
        statusText: isCurrentlyClosed ? 'Schonzeit' : 'Befischbar',
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error('GET /seasons error:', err);
    res.status(500).json({ error: 'Schonzeiten konnten nicht geladen werden.' });
  }
});

// ── GET /api/seasons/check/:species ────────────────────────
// Prüfe ob eine bestimmte Art gerade Schonzeit hat
router.get('/check/:species', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM closed_seasons WHERE fish_species = $1',
      [req.params.species]
    );

    if (rows.length === 0) {
      return res.json({
        species: req.params.species,
        found: false,
        message: 'Keine Schonzeitdaten für diese Art.',
      });
    }

    const s = rows[0];
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const current = `${month}-${day}`;

    let isClosed = false;
    if (s.year_round) {
      isClosed = true;
    } else if (s.season_start <= s.season_end) {
      isClosed = current >= s.season_start && current <= s.season_end;
    } else {
      isClosed = current >= s.season_start || current <= s.season_end;
    }

    res.json({
      species: s.fish_species,
      germanName: s.german_name,
      found: true,
      isClosed,
      minSizeCm: s.min_size_cm,
      seasonStart: s.season_start,
      seasonEnd: s.season_end,
      yearRound: s.year_round,
      maxPerDay: s.max_per_day,
      maxPerYear: s.max_per_year,
      warning: isClosed
        ? s.year_round
          ? `${s.german_name} ist ganzjährig geschont!`
          : `${s.german_name}: Schonzeit bis ${s.season_end.replace('-', '.')}!`
        : null,
    });
  } catch (err) {
    console.error('GET /seasons/check error:', err);
    res.status(500).json({ error: 'Schonzeit-Prüfung fehlgeschlagen.' });
  }
});

module.exports = router;
