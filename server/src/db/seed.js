require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

/**
 * Schonzeiten und Mindestmaße lt. Fischereierlaubnis Hauserwasser
 * Revier: Krems samt Fischlmayrbach, ON 30/5 BH Linz-Land
 */
const SEASONS = [
  {
    fish_species: 'brown_trout', german_name: 'Bachforelle',
    min_size_cm: 26, season_start: '09-16', season_end: '03-15',
    max_per_day: 3, max_per_year: 60,
    notes: 'Sondermaß 26cm! Salmoniden-Quote: max 3/Tag, 60/Saison',
  },
  {
    fish_species: 'rainbow_trout', german_name: 'Regenbogenforelle',
    min_size_cm: 26, season_start: '12-01', season_end: '03-15',
    max_per_day: 3, max_per_year: 60,
    notes: 'Sondermaß 26cm! Salmoniden-Quote: max 3/Tag, 60/Saison',
  },
  {
    fish_species: 'char', german_name: 'Saibling',
    min_size_cm: 26, season_start: '09-16', season_end: '03-15',
    max_per_day: 3, max_per_year: 60,
    notes: 'Sondermaß 26cm! Salmoniden-Quote: max 3/Tag, 60/Saison',
  },
  {
    fish_species: 'barbel', german_name: 'Barbe',
    min_size_cm: 35, season_start: '04-16', season_end: '05-31',
    max_per_day: 1, max_per_year: null,
    notes: 'Karpfenartige: max 1/Tag',
  },
  {
    fish_species: 'chub', german_name: 'Aitel (Döbel)',
    min_size_cm: 25, season_start: '03-16', season_end: '05-31',
    max_per_day: null, max_per_year: null,
    notes: 'Ohne Fangbeschränkung',
  },
  {
    fish_species: 'grayling', german_name: 'Äsche',
    min_size_cm: 30, season_start: '03-01', season_end: '04-30',
    max_per_day: 3, max_per_year: 60,
    notes: 'Zählt zu Salmoniden-Quote',
  },
  {
    fish_species: 'pike', german_name: 'Hecht',
    min_size_cm: 60, season_start: '02-01', season_end: '04-30',
    max_per_day: null, max_per_year: 1,
    notes: 'Max 1 Stück pro Jahr',
  },
  {
    fish_species: 'carp', german_name: 'Karpfen',
    min_size_cm: 35, season_start: '05-01', season_end: '05-31',
    max_per_day: 1, max_per_year: null,
    notes: 'Karpfenartige: max 1/Tag',
  },
  {
    fish_species: 'zander', german_name: 'Zander',
    min_size_cm: 50, season_start: '03-01', season_end: '04-30',
    max_per_day: null, max_per_year: 1,
    notes: 'Max 1 Stück pro Jahr',
  },
  {
    fish_species: 'perch', german_name: 'Flussbarsch',
    min_size_cm: 10, season_start: '03-01', season_end: '04-30',
    max_per_day: null, max_per_year: null,
    notes: 'Ohne Fangbeschränkung',
  },
  {
    fish_species: 'huchen', german_name: 'Huchen',
    min_size_cm: null, season_start: '01-01', season_end: '12-31',
    year_round: true, max_per_day: 0, max_per_year: 0,
    notes: 'Ganzjährig geschont! Darf NICHT entnommen werden.',
  },
];

async function seed() {
  console.log('Seede Schonzeiten...');
  try {
    // Bestehende Einträge löschen
    await pool.query('DELETE FROM closed_seasons');

    for (const s of SEASONS) {
      await pool.query(
        `INSERT INTO closed_seasons
         (fish_species, german_name, min_size_cm, season_start, season_end,
          year_round, max_per_day, max_per_year, notes, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          s.fish_species, s.german_name, s.min_size_cm,
          s.season_start, s.season_end, s.year_round || false,
          s.max_per_day, s.max_per_year, s.notes,
          'Fischereierlaubnis Hauserwasser 2026',
        ]
      );
    }

    console.log(`✓ ${SEASONS.length} Schonzeiten eingetragen.`);

    // Admin-User anlegen (idempotent)
    const adminEmail = 'hauserwasser@gmail.com';
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (existing.rows.length === 0) {
      const pwHash = await bcrypt.hash('hauser2026wasser', 12);
      await pool.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role)
         VALUES ($1, $2, 'Admin', 'Hauserwasser', 'admin')`,
        [adminEmail, pwHash]
      );
      console.log('✓ Admin-User angelegt (hauserwasser@gmail.com).');
    } else {
      console.log('✓ Admin-User existiert bereits.');
    }
  } catch (err) {
    console.error('✗ Seed fehlgeschlagen:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
