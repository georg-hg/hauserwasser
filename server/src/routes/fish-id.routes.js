const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const { identifyFish } = require('../services/fishIdentification');

const router = express.Router();

// ── POST /api/fish-id/analyze ──────────────────────────────
// Foto hochladen und Fisch analysieren
router.post('/analyze', auth, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Kein Bild hochgeladen.' });
    }

    const imagePath = req.file.path;

    // Fischart erkennen
    const identification = await identifyFish(imagePath);

    // Schonzeit prüfen
    let closedSeasonWarning = null;
    let minSizeCm = null;
    let minSizeWarning = null;

    if (identification.species !== 'unknown') {
      const { rows } = await pool.query(
        'SELECT * FROM closed_seasons WHERE fish_species = $1',
        [identification.species]
      );

      if (rows.length > 0) {
        const s = rows[0];
        minSizeCm = s.min_size_cm;

        const now = new Date();
        const current = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        let isClosed = false;
        if (s.year_round) {
          isClosed = true;
          closedSeasonWarning = `${s.german_name} ist ganzjährig geschont! Sofort zurücksetzen!`;
        } else if (s.season_start <= s.season_end) {
          isClosed = current >= s.season_start && current <= s.season_end;
        } else {
          isClosed = current >= s.season_start || current <= s.season_end;
        }

        if (isClosed && !s.year_round) {
          closedSeasonWarning = `${s.german_name}: Schonzeit bis ${s.season_end.replace('-', '.')}! Zurücksetzen!`;
        }

        if (minSizeCm) {
          minSizeWarning = `Mindestmaß: ${minSizeCm} cm`;
        }
      }
    }

    res.json({
      ...identification,
      photoUrl: `/uploads/${req.file.filename}`,
      closedSeasonWarning,
      minSizeCm,
      minSizeWarning,
    });
  } catch (err) {
    console.error('Fish-ID error:', err);
    res.status(500).json({ error: 'Bildanalyse fehlgeschlagen.' });
  }
});

module.exports = router;
