require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const pool = require('./config/db');

const uploadsDir = path.join(__dirname, '../uploads/monitoring');
fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/', (req, res) => res.json({ status: 'ok', app: 'Hauserwasser API' }));

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

// Einmalige Migration catches.latitude/longitude nullable
app.get('/api/fix-catches', async (req, res) => {
  const results = {};
  const run = async (label, sql) => {
    try { await pool.query(sql); results[label] = 'ok'; }
    catch (e) { results[label] = e.message; }
  };
  await run('latitude DROP NOT NULL',  `ALTER TABLE catches ALTER COLUMN latitude DROP NOT NULL`);
  await run('longitude DROP NOT NULL', `ALTER TABLE catches ALTER COLUMN longitude DROP NOT NULL`);
  const { rows } = await pool.query(`
    SELECT column_name, is_nullable FROM information_schema.columns
    WHERE table_name = 'catches' AND column_name IN ('latitude','longitude')
  `).catch(() => ({ rows: [] }));
  res.json({ ok: true, migrations: results, columns: rows });
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 200,
  message: { error: 'Zu viele Anfragen - bitte warte kurz.' },
});
app.use('/api/', apiLimiter);

app.use('/api/auth',         require('./routes/auth.routes'));
app.use('/api/catches',      require('./routes/catches.routes'));
app.use('/api/seasons',      require('./routes/seasons.routes'));
app.use('/api/fish-id',      require('./routes/fish-id.routes'));
app.use('/api/admin',        require('./routes/admin.routes'));
app.use('/api/water',        require('./routes/water.routes'));
app.use('/api/fishing-days', require('./routes/fishing-days.routes'));
app.use('/api/weather',      require('./routes/weather.routes'));
app.use('/api/monitoring',   require('./routes/monitoring.routes'));
app.use('/api/predators',    require('./routes/predators.routes'));
app.use('/api/revier',       require('./routes/revier.routes'));
app.use('/api/stockings',    require('./routes/stockings.routes'));

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Ein Fehler ist aufgetreten.' : err.message,
  });
});

async function autoMigrate() {
  try {
    await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='blocked') THEN ALTER TABLE users ADD COLUMN blocked BOOLEAN DEFAULT false; ALTER TABLE users ADD COLUMN blocked_at TIMESTAMPTZ; ALTER TABLE users ADD COLUMN blocked_reason TEXT; END IF; END $$;`);
    await pool.query(`CREATE TABLE IF NOT EXISTS admin_notifications (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), type VARCHAR(50) NOT NULL DEFAULT 'registration', title VARCHAR(255) NOT NULL, message TEXT, related_user_id UUID REFERENCES users(id) ON DELETE SET NULL, read BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW()); CREATE INDEX IF NOT EXISTS idx_admin_notifications_read ON admin_notifications(read, created_at DESC);`);
    await pool.query(`CREATE TABLE IF NOT EXISTS monitoring_data (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), probe_name VARCHAR(100) NOT NULL DEFAULT 'Ende', measured_at TIMESTAMPTZ NOT NULL, ch1_ntu DECIMAL(12,4), ch2_mg_l DECIMAL(12,4), ch32_voltage DECIMAL(8,4), created_at TIMESTAMPTZ DEFAULT NOW()); CREATE UNIQUE INDEX IF NOT EXISTS idx_monitoring_probe_time ON monitoring_data(probe_name, measured_at); CREATE INDEX IF NOT EXISTS idx_monitoring_measured ON monitoring_data(measured_at DESC);`);
    await pool.query(`CREATE TABLE IF NOT EXISTS monitoring_imports (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), filename VARCHAR(255) NOT NULL, probe_name VARCHAR(100) DEFAULT 'Ende', records_total INTEGER DEFAULT 0, records_imported INTEGER DEFAULT 0, data_from TIMESTAMPTZ, data_to TIMESTAMPTZ, uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL, uploaded_at TIMESTAMPTZ DEFAULT NOW()); CREATE INDEX IF NOT EXISTS idx_monitoring_imports_date ON monitoring_imports(uploaded_at DESC);`);
    await pool.query(`CREATE TABLE IF NOT EXISTS predator_sightings (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, sighted_at TIMESTAMPTZ NOT NULL, latitude DECIMAL(10,7) NOT NULL, longitude DECIMAL(10,7) NOT NULL, predator_type VARCHAR(100) NOT NULL, individual_count INTEGER DEFAULT 1, behavior VARCHAR(100), notes TEXT, photo_url TEXT, created_at TIMESTAMPTZ DEFAULT NOW()); CREATE INDEX IF NOT EXISTS idx_predator_sightings_user_date ON predator_sightings(user_id, sighted_at DESC); CREATE INDEX IF NOT EXISTS idx_predator_sightings_date ON predator_sightings(sighted_at DESC);`);
    await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_kontrolleur') THEN ALTER TABLE users ADD COLUMN is_kontrolleur BOOLEAN DEFAULT false; END IF; END $$;`);
    await pool.query(`CREATE TABLE IF NOT EXISTS water_history (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), station VARCHAR(50) NOT NULL, pegel DECIMAL(8,2), durchfluss DECIMAL(10,3), temperatur DECIMAL(5,2), recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()); CREATE INDEX IF NOT EXISTS idx_water_history_station_time ON water_history(station, recorded_at DESC);`);
    await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_seen') THEN ALTER TABLE users ADD COLUMN last_seen TIMESTAMPTZ; END IF; END $$;`);
    await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fishing_days' AND column_name='technique') THEN ALTER TABLE fishing_days ADD COLUMN technique VARCHAR(50); ALTER TABLE fishing_days ADD COLUMN notes TEXT; ALTER TABLE fishing_days ADD COLUMN completed BOOLEAN DEFAULT false; ALTER TABLE fishing_days ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW(); END IF; END $$;`);
    await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='catches' AND column_name='fishing_day_id') THEN ALTER TABLE catches ADD COLUMN fishing_day_id UUID REFERENCES fishing_days(id) ON DELETE SET NULL; END IF; END $$;`);
    await pool.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fishing_days' AND column_name='latitude') THEN ALTER TABLE fishing_days ADD COLUMN latitude DECIMAL(10,7); ALTER TABLE fishing_days ADD COLUMN longitude DECIMAL(10,7); ALTER TABLE fishing_days ADD COLUMN position_updated_at TIMESTAMPTZ; END IF; END $$;`);
    // catches latitude/longitude nullable
    await pool.query(`DO $$ BEGIN ALTER TABLE catches ALTER COLUMN latitude DROP NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;`);
    await pool.query(`DO $$ BEGIN ALTER TABLE catches ALTER COLUMN longitude DROP NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;`);

    await pool.query(`CREATE TABLE IF NOT EXISTS stockings (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), stocked_at TIMESTAMPTZ, planned_date DATE, season_year INTEGER NOT NULL, fish_species VARCHAR(100) NOT NULL, quantity_kg DECIMAL(8,2), quantity_count INTEGER, cost_eur DECIMAL(10,2), price_per_kg_override DECIMAL(8,2), source VARCHAR(255), age_class VARCHAR(50), is_planned BOOLEAN NOT NULL DEFAULT false, notes TEXT, created_by UUID REFERENCES users(id) ON DELETE SET NULL, updated_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()); CREATE INDEX IF NOT EXISTS idx_stockings_season ON stockings(season_year, is_planned, stocked_at DESC);`);
    await pool.query(`ALTER TABLE stockings ADD COLUMN IF NOT EXISTS cost_eur DECIMAL(10,2);`);
    await pool.query(`ALTER TABLE stockings ADD COLUMN IF NOT EXISTS price_per_kg_override DECIMAL(8,2);`);
    await pool.query(`ALTER TABLE stockings ADD COLUMN IF NOT EXISTS planned_date DATE;`);
    await pool.query(`ALTER TABLE stockings ADD COLUMN IF NOT EXISTS is_planned BOOLEAN NOT NULL DEFAULT false;`).catch(() => {});
    await pool.query(`DO $$ BEGIN ALTER TABLE stockings ALTER COLUMN stocked_at DROP NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;`);
    await pool.query(`DO $$ BEGIN ALTER TABLE stockings ALTER COLUMN quantity_kg DROP NOT NULL; EXCEPTION WHEN others THEN NULL; END $$;`);

    await pool.query(`INSERT INTO stockings (stocked_at, season_year, fish_species, quantity_kg, cost_eur, age_class, is_planned, notes) SELECT '2026-04-10 16:00:00+02', 2026, 'rainbow_trout', 120, 1264.00, 'fangfertig', false, 'Fruehjahrsbesatz 2026 - 16:00 bis 17:30 Uhr - EUR 10.53/kg' WHERE NOT EXISTS (SELECT 1 FROM stockings WHERE season_year=2026 AND fish_species='rainbow_trout' AND stocked_at IS NOT NULL AND stocked_at::date='2026-04-10');`);
    await pool.query(`UPDATE stockings SET cost_eur=1264.00, is_planned=false, notes='Fruehjahrsbesatz 2026 - 16:00 bis 17:30 Uhr - EUR 10.53/kg' WHERE season_year=2026 AND fish_species='rainbow_trout' AND stocked_at IS NOT NULL AND stocked_at::date='2026-04-10' AND cost_eur IS NULL;`);
    await pool.query(`INSERT INTO stockings (stocked_at, season_year, fish_species, quantity_kg, cost_eur, age_class, is_planned, notes) SELECT '2026-04-10 16:00:00+02', 2026, 'brown_trout', 30, 316.00, 'fangfertig', false, 'Fruehjahrsbesatz 2026 - 16:00 bis 17:30 Uhr - EUR 10.53/kg' WHERE NOT EXISTS (SELECT 1 FROM stockings WHERE season_year=2026 AND fish_species='brown_trout' AND stocked_at IS NOT NULL AND stocked_at::date='2026-04-10');`);
    await pool.query(`UPDATE stockings SET cost_eur=316.00, is_planned=false, notes='Fruehjahrsbesatz 2026 - 16:00 bis 17:30 Uhr - EUR 10.53/kg' WHERE season_year=2026 AND fish_species='brown_trout' AND stocked_at IS NOT NULL AND stocked_at::date='2026-04-10' AND cost_eur IS NULL;`);
    await pool.query(`INSERT INTO stockings (season_year, fish_species, price_per_kg_override, source, age_class, is_planned, notes) SELECT 2026, 'carp', 9.00, 'Fischzucht Maier', 'fangfertig', true, 'Besatzplanung 2026 - Menge und Termin noch offen - EUR 9.00/kg' WHERE NOT EXISTS (SELECT 1 FROM stockings WHERE season_year=2026 AND fish_species='carp' AND is_planned=true);`);
    await pool.query(`INSERT INTO stockings (season_year, fish_species, is_planned, notes) SELECT 2026, 'perch', true, 'Besatzplanung 2026 - Menge, Termin und Preis noch offen' WHERE NOT EXISTS (SELECT 1 FROM stockings WHERE season_year=2026 AND fish_species='perch' AND is_planned=true);`);
    await pool.query(`INSERT INTO stockings (season_year, fish_species, is_planned, notes) SELECT 2026, 'pike', true, 'Besatzplanung 2026 - Menge, Termin und Preis noch offen' WHERE NOT EXISTS (SELECT 1 FROM stockings WHERE season_year=2026 AND fish_species='pike' AND is_planned=true);`);

    console.log('Auto-Migration erfolgreich.');
  } catch (err) {
    console.error('Auto-Migration Fehler (nicht kritisch):', err.message);
  }
}

async function start() {
  try {
    const { rows } = await pool.query('SELECT NOW()');
    console.log('PostgreSQL verbunden:', rows[0].now);
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS fisher_card_url TEXT').catch(() => {});
    await autoMigrate();
    app.listen(PORT, () => console.log(`Hauserwasser API laeuft auf Port ${PORT}`));
  } catch (err) {
    console.error('Startfehler:', err.message);
    process.exit(1);
  }
}

start();
