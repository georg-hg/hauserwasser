const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const rateLimit = require('express-rate-limit');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');

/**
 * Fotodokumentation Trübungsmonitoring
 * - Lesen: öffentlich (Liste, Bild, Vorschaubild)
 * - Schreiben: nur Admin
 * Die Bilder liegen als BYTEA in PostgreSQL, weil das Dateisystem auf Render
 * bei jedem Deployment geleert wird.
 */

const router = express.Router();

const MAX_EDGE = 1600;
const THUMB_EDGE = 480;
const MAX_FILES = 20;
const SEED_DIR = path.join(__dirname, '../../seed/monitoring-photos');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: MAX_FILES },
});

const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 3000,
  message: { error: 'Zu viele Anfragen - bitte warte kurz.' },
});
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 120,
  message: { error: 'Zu viele Anfragen - bitte warte kurz.' },
});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clean(v, max) {
  if (v == null) return null;
  const s = String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
  return s ? s.slice(0, max) : null;
}

// Öffentliche Lesezugriffe dürfen von überall kommen (keine Cookies, keine Zugangsdaten)
function publicCors(req, res, next) {
  res.set('Access-Control-Allow-Origin', '*');
  res.removeHeader('Access-Control-Allow-Credentials');
  next();
}

let heicConvert = null;
async function toJpegInput(buffer) {
  // sharp kann HEIC (iPhone) in der Standardausführung nicht dekodieren
  const brand = buffer.length > 12 ? buffer.toString('latin1', 4, 12) : '';
  if (!/^ftyp(heic|heix|hevc|hevx|mif1|msf1)/.test(brand)) return buffer;
  if (!heicConvert) heicConvert = require('heic-convert');
  return Buffer.from(await heicConvert({ buffer, format: 'JPEG', quality: 0.92 }));
}

// Aufnahmezeit aus EXIF (DateTimeOriginal), als { date: 'YYYY-MM-DD', time: 'HH:MM' } in Ortszeit der Kamera
function exifTaken(exifBuf) {
  if (!exifBuf) return null;
  const m = exifBuf.toString('latin1').match(/(20\d{2}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):\d{2}/);
  return m ? { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}` } : null;
}

async function processImage(original) {
  const meta = await sharp(original, { failOn: 'none' }).metadata().catch(() => ({}));
  const taken = exifTaken(meta.exif);
  const input = await toJpegInput(original);
  // rotate() richtet nach EXIF aus; Metadaten (auch GPS) werden nicht übernommen
  const base = sharp(input, { failOn: 'none' }).rotate();
  const { data: image, info } = await base.clone()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80, progressive: true, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  const thumb = await base.clone()
    .resize({ width: THUMB_EDGE, height: THUMB_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 72, progressive: true, mozjpeg: true })
    .toBuffer();
  return { image, thumb, width: info.width, height: info.height, taken };
}

async function insertPhoto({ original, name, date, time, location, note, userId, preferExif }) {
  const p = await processImage(original);
  // preferExif: Aufnahmezeit aus dem Foto geht vor, die Formularwerte gelten nur als Ersatz
  const fromExif = preferExif && p.taken;
  const takenOn = fromExif ? p.taken.date : (date || (p.taken && p.taken.date));
  if (!takenOn || !DATE_RE.test(takenOn)) {
    const e = new Error('Aufnahmedatum fehlt.'); e.status = 400; throw e;
  }
  const takenTime = fromExif ? p.taken.time : (time || (p.taken && p.taken.date === takenOn ? p.taken.time : null));
  const sha = crypto.createHash('sha256').update(original).digest('hex');
  const { rows } = await pool.query(
    `INSERT INTO monitoring_photos
       (taken_on, taken_time, location, note, image, thumb, width, height, bytes,
        original_name, original_bytes, original_sha256, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (original_sha256) DO NOTHING
     RETURNING id`,
    [takenOn, takenTime, location, note, p.image, p.thumb, p.width, p.height, p.image.length,
      clean(name, 255), original.length, sha, userId || null],
  );
  return rows[0] ? rows[0].id : null; // null = Foto ist bereits vorhanden
}

const LIST_COLS = `id, to_char(taken_on, 'YYYY-MM-DD') AS date, to_char(taken_time, 'HH24:MI') AS time,
  location, note, width, height, bytes, original_sha256 AS sha256, created_at`;

function present(r) {
  return {
    id: r.id, date: r.date, time: r.time, location: r.location, note: r.note,
    width: r.width, height: r.height, bytes: r.bytes, sha256: r.sha256, createdAt: r.created_at,
    image: `/api/monitoring-photos/${r.id}/image`,
    thumb: `/api/monitoring-photos/${r.id}/thumb`,
  };
}

// ── Öffentlich ──────────────────────────────────────────

router.get('/', readLimiter, publicCors, async (req, res, next) => {
  try {
    const where = [], args = [];
    if (DATE_RE.test(req.query.from || '')) { args.push(req.query.from); where.push(`taken_on >= $${args.length}`); }
    if (DATE_RE.test(req.query.to || '')) { args.push(req.query.to); where.push(`taken_on <= $${args.length}`); }
    const { rows } = await pool.query(
      `SELECT ${LIST_COLS} FROM monitoring_photos ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY taken_on DESC, taken_time DESC NULLS LAST, created_at DESC LIMIT 2000`, args);
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ photos: rows.map(present) });
  } catch (err) { next(err); }
});

function sendBinary(col) {
  return async (req, res, next) => {
    try {
      if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'Foto nicht gefunden.' });
      const { rows } = await pool.query(`SELECT ${col} AS data FROM monitoring_photos WHERE id = $1`, [req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: 'Foto nicht gefunden.' });
      res.set({
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      });
      res.send(rows[0].data);
    } catch (err) { next(err); }
  };
}
router.get('/:id/image', readLimiter, publicCors, sendBinary('image'));
router.get('/:id/thumb', readLimiter, publicCors, sendBinary('thumb'));

// ── Admin ───────────────────────────────────────────────

router.post('/', writeLimiter, auth, requireRole('admin'), (req, res, next) => {
  upload.array('photos', MAX_FILES)(req, res, (err) => {
    if (!err) return next();
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Ein Foto ist größer als 25 MB.'
      : err.code === 'LIMIT_FILE_COUNT' ? `Höchstens ${MAX_FILES} Fotos pro Upload.` : 'Upload fehlgeschlagen.';
    res.status(400).json({ error: msg });
  });
}, async (req, res, next) => {
  try {
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: 'Kein Foto ausgewählt.' });
    const date = req.body.date || null, time = req.body.time || null;
    if (date && !DATE_RE.test(date)) return res.status(400).json({ error: 'Ungültiges Datum.' });
    if (time && !TIME_RE.test(time)) return res.status(400).json({ error: 'Ungültige Uhrzeit.' });
    const preferExif = req.body.preferExif === '1' || req.body.preferExif === 'true';
    const location = clean(req.body.location, 160), note = clean(req.body.note, 1000);

    const saved = [], skipped = [], failed = [];
    for (const f of files) {
      try {
        const id = await insertPhoto({ original: f.buffer, name: f.originalname, date, time, location, note, userId: req.user.id, preferExif });
        (id ? saved : skipped).push(id || f.originalname);
      } catch (e) {
        failed.push({ name: f.originalname, error: e.status === 400 ? e.message : 'Datei konnte nicht als Bild gelesen werden.' });
      }
    }
    res.status(saved.length ? 201 : failed.length ? 400 : 200).json({
      saved: saved.length, skipped: skipped.length, failed,
      error: !saved.length && failed.length ? failed[0].error : undefined,
    });
  } catch (err) { next(err); }
});

router.put('/:id', writeLimiter, auth, requireRole('admin'), async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'Foto nicht gefunden.' });
    const { date, time } = req.body || {};
    if (!DATE_RE.test(date || '')) return res.status(400).json({ error: 'Ungültiges Datum.' });
    if (time && !TIME_RE.test(time)) return res.status(400).json({ error: 'Ungültige Uhrzeit.' });
    const { rows } = await pool.query(
      `UPDATE monitoring_photos SET taken_on = $1, taken_time = $2, location = $3, note = $4 WHERE id = $5 RETURNING ${LIST_COLS}`,
      [date, time || null, clean(req.body.location, 160), clean(req.body.note, 1000), req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Foto nicht gefunden.' });
    res.json({ photo: present(rows[0]) });
  } catch (err) { next(err); }
});

router.delete('/:id', writeLimiter, auth, requireRole('admin'), async (req, res, next) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'Foto nicht gefunden.' });
    const { rowCount } = await pool.query('DELETE FROM monitoring_photos WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Foto nicht gefunden.' });
    res.json({ deleted: true });
  } catch (err) { next(err); }
});

// ── Tabelle + mitgelieferte Fotos ───────────────────────

async function migrate() {
  await pool.query(`CREATE TABLE IF NOT EXISTS monitoring_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    taken_on DATE NOT NULL,
    taken_time TIME,
    location VARCHAR(160),
    note TEXT,
    image BYTEA NOT NULL,
    thumb BYTEA NOT NULL,
    width INTEGER, height INTEGER, bytes INTEGER,
    original_name VARCHAR(255), original_bytes INTEGER,
    original_sha256 CHAR(64) NOT NULL UNIQUE,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE INDEX IF NOT EXISTS idx_monitoring_photos_day ON monitoring_photos(taken_on DESC, taken_time DESC);
    CREATE TABLE IF NOT EXISTS monitoring_photo_seeds (file VARCHAR(255) PRIMARY KEY, seeded_at TIMESTAMPTZ DEFAULT NOW());`);
}

// Fotos aus server/seed/monitoring-photos genau einmal einspielen (gelöschte kommen nicht wieder)
async function seed() {
  const manifest = path.join(SEED_DIR, 'manifest.json');
  if (!fs.existsSync(manifest)) return;
  const items = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  for (const it of items) {
    const file = path.basename(String(it.file));
    const done = await pool.query('SELECT 1 FROM monitoring_photo_seeds WHERE file = $1', [file]);
    if (done.rowCount) continue;
    await insertPhoto({
      original: fs.readFileSync(path.join(SEED_DIR, file)), name: it.originalName || file,
      date: it.date, time: it.time || null, location: clean(it.location, 160), note: clean(it.note, 1000),
    });
    await pool.query('INSERT INTO monitoring_photo_seeds (file) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
  }
}

module.exports = router;
module.exports.migrate = migrate;
module.exports.seed = seed;
module.exports._processImage = processImage;
