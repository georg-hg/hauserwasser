require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const pool = require('./config/db');

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
