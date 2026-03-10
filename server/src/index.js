require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const pool = require('./config/db');

// Uploads-Ordner sicherstellen
const uploadsDir = path.join(__dirname, '../uploads/monitoring');
fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Zu viele Anfragen – bitte warte kurz.' },
});
app.use('/api/', apiLimiter);

// ── Health Check ───────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

// ── Routes ─────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/catches', require('./routes/catches.routes'));
app.use('/api/seasons', require('./routes/seasons.routes'));
app.use('/api/fish-id', require('./routes/fish-id.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/water', require('./routes/water.routes'));
app.use('/api/weather', require('./routes/weather.routes'));
app.use('/api/monitoring', require('./routes/monitoring.routes'));
app.use('/api/predators', require('./routes/predators.routes'));

// ── Error handler ──────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Ein Fehler ist aufgetreten.'
      : err.message,
  });
});

// ── Auto-Migration beim Start ───────────────────────────────
async function autoMigrate() {
  try {
    // Blocked-Felder auf users
    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'blocked'
        ) THEN
          ALTER TABLE users ADD COLUMN blocked BOOLEAN DEFAULT false;
          ALTER TABLE users ADD COLUMN blocked_at TIMESTAMPTZ;
          ALTER TABLE users ADD COLUMN blocked_reason TEXT;
        END IF;
      END $$;
    `);

    // Admin-Notifications Tabelle
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_notifications (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        type            VARCHAR(50) NOT NULL DEFAULT 'registration',
        title           VARCHAR(255) NOT NULL,
        message         TEXT,
        related_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        read            BOOLEAN DEFAULT false,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_admin_notifications_read
        ON admin_notifications(read, created_at DESC);
    `);

    // Monitoring-Daten Tabelle (Renaturierung Krems)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS monitoring_data (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        probe_name      VARCHAR(100) NOT NULL DEFAULT 'Ende',
        measured_at     TIMESTAMPTZ NOT NULL,
        ch1_ntu         DECIMAL(12,4),
        ch2_mg_l        DECIMAL(12,4),
        ch32_voltage    DECIMAL(8,4),
        created_at      TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_monitoring_probe_time
        ON monitoring_data(probe_name, measured_at);
      CREATE INDEX IF NOT EXISTS idx_monitoring_measured
        ON monitoring_data(measured_at DESC);
    `);

    // Import-Tracking Tabelle
    await pool.query(`
      CREATE TABLE IF NOT EXISTS monitoring_imports (
        id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        filename          VARCHAR(255) NOT NULL,
        probe_name        VARCHAR(100) DEFAULT 'Ende',
        records_total     INTEGER DEFAULT 0,
        records_imported  INTEGER DEFAULT 0,
        data_from         TIMESTAMPTZ,
        data_to           TIMESTAMPTZ,
        uploaded_by       UUID REFERENCES users(id) ON DELETE SET NULL,
        uploaded_at       TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_monitoring_imports_date
        ON monitoring_imports(uploaded_at DESC);
    `);

    // Prädatoren-Sichtungen Tabelle
    await pool.query(`
      CREATE TABLE IF NOT EXISTS predator_sightings (
        id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        sighted_at        TIMESTAMPTZ NOT NULL,
        latitude          DECIMAL(10, 7) NOT NULL,
        longitude         DECIMAL(10, 7) NOT NULL,
        predator_type     VARCHAR(100) NOT NULL,
        individual_count  INTEGER DEFAULT 1,
        behavior          VARCHAR(100),
        notes             TEXT,
        photo_url         TEXT,
        created_at        TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_predator_sightings_user_date
        ON predator_sightings(user_id, sighted_at DESC);
      CREATE INDEX IF NOT EXISTS idx_predator_sightings_date
        ON predator_sightings(sighted_at DESC);
    `);

    console.log('✓ Auto-Migration erfolgreich.');
  } catch (err) {
    console.error('⚠ Auto-Migration Fehler (nicht kritisch):', err.message);
  }
}

// ── Start ──────────────────────────────────────────────────
async function start() {
  try {
    const { rows } = await pool.query('SELECT NOW()');
    console.log('✓ PostgreSQL verbunden:', rows[0].now);

    await autoMigrate();

    app.listen(PORT, () => {
      console.log(`✓ Hauserwasser API läuft auf Port ${PORT}`);
    });
  } catch (err) {
    console.error('✗ Startfehler:', err.message);
    process.exit(1);
  }
}

start();
