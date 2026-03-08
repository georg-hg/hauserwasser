require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const pool = require('../config/db');

const SCHEMA = `
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

  -- Users
  CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    address         TEXT,
    birth_date      DATE,
    fisher_card_nr  VARCHAR(50),
    license_valid_from DATE,
    license_valid_to   DATE,
    role            VARCHAR(20) DEFAULT 'fisher'
                    CHECK (role IN ('fisher', 'admin', 'warden')),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
  );

  -- Catches (Fangbuch)
  CREATE TABLE IF NOT EXISTS catches (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    catch_date      DATE NOT NULL,
    catch_time      TIME,
    latitude        DECIMAL(10, 7) NOT NULL,
    longitude       DECIMAL(10, 7) NOT NULL,
    location_name   VARCHAR(255),
    fish_species    VARCHAR(100) NOT NULL,
    length_cm       DECIMAL(5, 1),
    weight_kg       DECIMAL(5, 2),
    photo_url       TEXT,
    ai_species      VARCHAR(100),
    ai_confidence   DECIMAL(3, 2),
    ai_length_est   DECIMAL(5, 1),
    technique       VARCHAR(50)
                    CHECK (technique IS NULL OR technique IN (
                      'spinnfischen', 'fliegenfischen',
                      'ansitzangeln', 'blinkern'
                    )),
    kept            BOOLEAN DEFAULT false,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_catches_user_date ON catches(user_id, catch_date);
  CREATE INDEX IF NOT EXISTS idx_catches_species ON catches(fish_species);

  -- Closed Seasons (Schonzeiten)
  CREATE TABLE IF NOT EXISTS closed_seasons (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fish_species    VARCHAR(100) NOT NULL,
    german_name     VARCHAR(100),
    min_size_cm     DECIMAL(5, 1),
    season_start    VARCHAR(5) NOT NULL,
    season_end      VARCHAR(5) NOT NULL,
    year_round      BOOLEAN DEFAULT false,
    max_per_day     INTEGER,
    max_per_year    INTEGER,
    notes           TEXT,
    source          VARCHAR(100) DEFAULT 'Hauserwasser Sonderbestimmung',
    updated_at      TIMESTAMPTZ DEFAULT NOW()
  );

  -- Fishing Days (Fischtage-Tracking)
  CREATE TABLE IF NOT EXISTS fishing_days (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fishing_date    DATE NOT NULL,
    season_year     INTEGER NOT NULL,
    UNIQUE(user_id, fishing_date)
  );

  CREATE INDEX IF NOT EXISTS idx_fishing_days_user_season
    ON fishing_days(user_id, season_year);

  -- Jahreslizenzen (Freischaltung durch Admin)
  CREATE TABLE IF NOT EXISTS licenses (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    season_year     INTEGER NOT NULL,
    license_name    VARCHAR(200) NOT NULL DEFAULT 'Hauserwasser',
    activated_at    TIMESTAMPTZ DEFAULT NOW(),
    activated_by    UUID REFERENCES users(id),
    revoked_at      TIMESTAMPTZ,
    notes           TEXT,
    UNIQUE(user_id, season_year, license_name)
  );

  CREATE INDEX IF NOT EXISTS idx_licenses_user_year
    ON licenses(user_id, season_year);
`;

async function migrate() {
  console.log('Starte DB-Migration...');
  try {
    await pool.query(SCHEMA);
    console.log('✓ Migration erfolgreich.');
  } catch (err) {
    console.error('✗ Migration fehlgeschlagen:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
