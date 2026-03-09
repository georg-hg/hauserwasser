const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const AdmZip = require('adm-zip');

const router = express.Router();

// Multer für CSV/Excel/TXT/ZIP-Upload
const upload = multer({
  dest: path.join(__dirname, '../../uploads/monitoring'),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB (für ZIP mit mehreren Dateien)
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.csv', '.xlsx', '.xls', '.txt', '.zip'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Nur CSV/Excel/TXT/ZIP-Dateien erlaubt.'));
    }
  },
});

// ── GET /api/monitoring/data ──────────────────────────────────
// Messdaten abrufen (alle Benutzer)
router.get('/data', auth, async (req, res) => {
  try {
    const { probe, from, to, limit } = req.query;
    const probeName = probe || 'Ende';
    const resultLimit = Math.min(parseInt(limit) || 500, 5000);

    let query = `
      SELECT id, probe_name, measured_at, ch1_ntu, ch2_mg_l, ch32_voltage, created_at
      FROM monitoring_data
      WHERE probe_name = $1
    `;
    const params = [probeName];
    let paramIdx = 2;

    if (from) {
      query += ` AND measured_at >= $${paramIdx}`;
      params.push(from);
      paramIdx++;
    }
    if (to) {
      query += ` AND measured_at <= $${paramIdx}`;
      params.push(to);
      paramIdx++;
    }

    query += ` ORDER BY measured_at DESC LIMIT $${paramIdx}`;
    params.push(resultLimit);

    const { rows } = await pool.query(query, params);

    res.json({
      probe: probeName,
      count: rows.length,
      data: rows.map(r => ({
        id: r.id,
        measuredAt: r.measured_at,
        ch1Ntu: r.ch1_ntu ? parseFloat(r.ch1_ntu) : null,
        ch2MgL: r.ch2_mg_l ? parseFloat(r.ch2_mg_l) : null,
        ch32Voltage: r.ch32_voltage ? parseFloat(r.ch32_voltage) : null,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    console.error('Monitoring data error:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Messdaten.' });
  }
});

// ── GET /api/monitoring/latest ────────────────────────────────
// Letzte Messwerte (für Dashboard-Anzeige)
router.get('/latest', auth, async (req, res) => {
  try {
    const probeName = req.query.probe || 'Ende';

    const { rows } = await pool.query(`
      SELECT id, probe_name, measured_at, ch1_ntu, ch2_mg_l, ch32_voltage, created_at
      FROM monitoring_data
      WHERE probe_name = $1
      ORDER BY measured_at DESC
      LIMIT 1
    `, [probeName]);

    if (rows.length === 0) {
      return res.json({ probe: probeName, latest: null });
    }

    const r = rows[0];
    res.json({
      probe: probeName,
      latest: {
        id: r.id,
        measuredAt: r.measured_at,
        ch1Ntu: r.ch1_ntu ? parseFloat(r.ch1_ntu) : null,
        ch2MgL: r.ch2_mg_l ? parseFloat(r.ch2_mg_l) : null,
        ch32Voltage: r.ch32_voltage ? parseFloat(r.ch32_voltage) : null,
        createdAt: r.created_at,
      },
    });
  } catch (err) {
    console.error('Monitoring latest error:', err);
    res.status(500).json({ error: 'Fehler beim Laden der letzten Messdaten.' });
  }
});

// ── GET /api/monitoring/stats ─────────────────────────────────
// Statistik/Zusammenfassung (Grenzwertüberschreitungen etc.)
router.get('/stats', auth, async (req, res) => {
  try {
    const probeName = req.query.probe || 'Ende';
    const days = parseInt(req.query.days) || 30;

    const { rows } = await pool.query(`
      SELECT
        COUNT(*) AS total_measurements,
        MIN(measured_at) AS first_measurement,
        MAX(measured_at) AS last_measurement,
        AVG(ch1_ntu) AS avg_ntu,
        MAX(ch1_ntu) AS max_ntu,
        AVG(ch2_mg_l) AS avg_mg_l,
        MAX(ch2_mg_l) AS max_mg_l,
        COUNT(CASE WHEN ch2_mg_l > 5000 THEN 1 END) AS threshold_exceeded_5g,
        COUNT(CASE WHEN ch2_mg_l > 10000 THEN 1 END) AS threshold_exceeded_10g
      FROM monitoring_data
      WHERE probe_name = $1
        AND measured_at >= NOW() - INTERVAL '1 day' * $2
    `, [probeName, days]);

    const r = rows[0];
    res.json({
      probe: probeName,
      period: `${days} Tage`,
      totalMeasurements: parseInt(r.total_measurements),
      firstMeasurement: r.first_measurement,
      lastMeasurement: r.last_measurement,
      ch1: {
        avgNtu: r.avg_ntu ? parseFloat(parseFloat(r.avg_ntu).toFixed(2)) : null,
        maxNtu: r.max_ntu ? parseFloat(r.max_ntu) : null,
      },
      ch2: {
        avgMgL: r.avg_mg_l ? parseFloat(parseFloat(r.avg_mg_l).toFixed(2)) : null,
        maxMgL: r.max_mg_l ? parseFloat(r.max_mg_l) : null,
        thresholdExceeded5g: parseInt(r.threshold_exceeded_5g),
        thresholdExceeded10g: parseInt(r.threshold_exceeded_10g),
      },
    });
  } catch (err) {
    console.error('Monitoring stats error:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Statistik.' });
  }
});

// ── GET /api/monitoring/imports ────────────────────────────────
// Liste aller importierten Dateien (absteigend nach Datum)
router.get('/imports', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT i.*, u.first_name, u.last_name
      FROM monitoring_imports i
      LEFT JOIN users u ON u.id = i.uploaded_by
      ORDER BY i.uploaded_at DESC
      LIMIT 100
    `);

    res.json(rows.map(r => ({
      id: r.id,
      filename: r.filename,
      probeName: r.probe_name,
      recordsTotal: r.records_total,
      recordsImported: r.records_imported,
      dataFrom: r.data_from,
      dataTo: r.data_to,
      uploadedAt: r.uploaded_at,
      uploadedBy: r.first_name ? `${r.first_name} ${r.last_name}` : null,
    })));
  } catch (err) {
    console.error('Imports list error:', err);
    res.status(500).json({ error: 'Fehler beim Laden der Importe.' });
  }
});

// ── GET /api/monitoring/nas-info ──────────────────────────────
// NAS-Datenserver Info
router.get('/nas-info', auth, async (req, res) => {
  res.json({
    url: 'https://tbzauner.com:5001/sharing/rHzpr3WXH',
    name: 'Datenserver TB Zauner',
    folder: 'KremsKematen',
    description: 'Messdaten der Sonden für die Renaturierung Krems',
  });
});

// ── POST /api/monitoring/upload ───────────────────────────────
// CSV/Excel-Upload für Messdaten (nur Admin)
router.post('/upload', auth, requireRole('admin'), upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Keine Datei hochgeladen.' });
  }

  try {
    const ext = path.extname(req.file.originalname).toLowerCase();

    // ZIP-Datei: entpacken und alle .txt/.csv Dateien verarbeiten
    if (ext === '.zip') {
      const result = await processZipFile(req.file.path, req.file.originalname, req.user.id);
      fs.unlink(req.file.path, () => {});
      return res.json(result);
    }

    // Einzelne Datei verarbeiten
    const result = await processSingleFile(req.file.path, req.file.originalname, ext, req.user.id);
    fs.unlink(req.file.path, () => {});
    res.json(result);
  } catch (err) {
    console.error('Upload error:', err);
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: err.message || 'Fehler beim Importieren der Daten.' });
  }
});

// ── Einzelne Datei verarbeiten ────────────────────────────────
async function processSingleFile(filePath, filename, ext, userId) {
  let rows = [];

  if (ext === '.csv' || ext === '.txt') {
    rows = await parseTextFile(filePath);
  } else if (ext === '.xlsx' || ext === '.xls') {
    rows = await parseExcel(filePath);
  } else {
    throw new Error(`Nicht unterstütztes Format: ${ext}`);
  }

  if (rows.length === 0) {
    throw new Error(`Keine Daten in ${filename} gefunden.`);
  }

  const timestamps = rows.map(r => new Date(r.measuredAt).getTime()).filter(t => !isNaN(t));
  const dataFrom = timestamps.length ? new Date(Math.min(...timestamps)) : null;
  const dataTo = timestamps.length ? new Date(Math.max(...timestamps)) : null;

  let inserted = 0;
  for (const row of rows) {
    try {
      await pool.query(`
        INSERT INTO monitoring_data (probe_name, measured_at, ch1_ntu, ch2_mg_l, ch32_voltage)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (probe_name, measured_at) DO UPDATE
        SET ch1_ntu = EXCLUDED.ch1_ntu, ch2_mg_l = EXCLUDED.ch2_mg_l, ch32_voltage = EXCLUDED.ch32_voltage
      `, [row.probe || 'Ende', row.measuredAt, row.ch1, row.ch2, row.ch32]);
      inserted++;
    } catch (rowErr) {
      console.error('Row insert error:', rowErr.message, row);
    }
  }

  const probeName = rows[0]?.probe || 'Ende';
  await pool.query(`
    INSERT INTO monitoring_imports (filename, probe_name, records_total, records_imported, data_from, data_to, uploaded_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [filename, probeName, rows.length, inserted, dataFrom, dataTo, userId]).catch(err => {
    console.error('Import tracking error:', err.message);
  });

  return { message: `${inserted} von ${rows.length} Messwerten importiert.`, inserted, total: rows.length, filename, dataFrom, dataTo };
}

// ── ZIP-Datei verarbeiten ─────────────────────────────────────
async function processZipFile(zipPath, zipFilename, userId) {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  // Nur .txt und .csv Dateien aus dem ZIP
  const validEntries = entries.filter(e => {
    if (e.isDirectory) return false;
    const entryExt = path.extname(e.entryName).toLowerCase();
    return ['.txt', '.csv'].includes(entryExt);
  });

  if (validEntries.length === 0) {
    throw new Error('Keine .txt oder .csv Dateien im ZIP gefunden.');
  }

  let totalInserted = 0;
  let totalRows = 0;
  let filesProcessed = 0;
  const fileResults = [];

  for (const entry of validEntries) {
    const entryExt = path.extname(entry.entryName).toLowerCase();
    const entryFilename = path.basename(entry.entryName);

    // Temporäre Datei schreiben
    const tmpPath = path.join(path.dirname(zipPath), `zip_${Date.now()}_${entryFilename}`);
    try {
      fs.writeFileSync(tmpPath, entry.getData());
      const result = await processSingleFile(tmpPath, entryFilename, entryExt, userId);
      totalInserted += result.inserted;
      totalRows += result.total;
      filesProcessed++;
      fileResults.push({ file: entryFilename, inserted: result.inserted, total: result.total });
    } catch (fileErr) {
      fileResults.push({ file: entryFilename, error: fileErr.message });
    } finally {
      fs.unlink(tmpPath, () => {});
    }
  }

  return {
    message: `ZIP: ${filesProcessed} Dateien verarbeitet, ${totalInserted} von ${totalRows} Messwerten importiert.`,
    inserted: totalInserted,
    total: totalRows,
    filename: zipFilename,
    filesProcessed,
    fileResults,
  };
}

// ── Text/CSV-Parser ────────────────────────────────────────────
// Unterstützt zwei Formate:
// 1) Sonden-Format: T001:DD.MM.YYYY,HH:MM,Probe,CH01=xxx,CH02=yyy,CH32=zzz;
// 2) CSV mit Header: Datum;CH1;CH2;CH32
async function parseTextFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter(l => l.trim());

  if (lines.length === 0) return [];

  // Format erkennen: Sonden-Format beginnt mit "T" + Ziffern + ":"
  const firstLine = lines[0].trim();
  if (/^T\d+:/.test(firstLine)) {
    return parseProbeFormat(lines);
  }

  // Fallback: CSV mit Header
  return parseCSV(lines);
}

// ── Sonden-Format Parser ───────────────────────────────────────
// T001:08.03.2026,09:00,Ende,CH01=339.10,CH02=1.36;
// T001:08.03.2026,11:00,Ende,CH01=306.86,CH02=1.23,CH32=8.29;
function parseProbeFormat(lines) {
  const rows = [];

  for (const line of lines) {
    const trimmed = line.trim().replace(/;$/, ''); // Semikolon am Ende entfernen
    if (!trimmed) continue;

    // Prefix entfernen (T001:)
    const withoutPrefix = trimmed.replace(/^T\d+:/, '');

    // Komma-getrennt aufteilen: Datum, Uhrzeit, Probe, dann CH-Werte
    const parts = withoutPrefix.split(',').map(p => p.trim());
    if (parts.length < 3) continue;

    const dateStr = parts[0]; // DD.MM.YYYY
    const timeStr = parts[1]; // HH:MM
    const probeName = parts[2]; // Ende

    // Datum + Zeit parsen
    const measuredAt = parseDate(`${dateStr} ${timeStr}`);
    if (!measuredAt) continue;

    // Kanal-Werte extrahieren (CH01=339.10, CH02=1.36, CH32=8.29)
    let ch1 = null, ch2 = null, ch32 = null;

    for (let i = 3; i < parts.length; i++) {
      const kvMatch = parts[i].match(/^(CH\d+)\s*=\s*([\d.,-]+)$/i);
      if (!kvMatch) continue;

      const channel = kvMatch[1].toUpperCase();
      const value = parseNum(kvMatch[2]);

      if (channel === 'CH01' || channel === 'CH1') ch1 = value;
      else if (channel === 'CH02' || channel === 'CH2') ch2 = value;
      else if (channel === 'CH32') ch32 = value;
    }

    rows.push({
      probe: probeName || 'Ende',
      measuredAt,
      ch1,
      ch2,
      ch32,
    });
  }

  return rows;
}

// ── CSV mit Header Parser ──────────────────────────────────────
function parseCSV(lines) {
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase();
  const separator = header.includes(';') ? ';' : ',';
  const headers = lines[0].split(separator).map(h => h.trim().toLowerCase());

  const dateIdx = headers.findIndex(h => h.includes('datum') || h.includes('date') || h.includes('zeit') || h.includes('time') || h.includes('timestamp'));
  const ch1Idx = headers.findIndex(h => h.includes('ch1') || h.includes('ntu') || h.includes('trübe') || h.includes('truebe'));
  const ch2Idx = headers.findIndex(h => h.includes('ch2') || h.includes('schweb') || h.includes('mg/l') || h.includes('mg_l'));
  const ch32Idx = headers.findIndex(h => h.includes('ch32') || h.includes('batt') || h.includes('volt'));
  const probeIdx = headers.findIndex(h => h.includes('probe') || h.includes('sonde') || h.includes('station'));

  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(separator).map(c => c.trim());
    if (cols.length < 2) continue;

    let measuredAt = null;
    if (dateIdx >= 0 && cols[dateIdx]) {
      measuredAt = parseDate(cols[dateIdx]);
    }
    if (!measuredAt) continue;

    rows.push({
      probe: probeIdx >= 0 ? (cols[probeIdx] || 'Ende') : 'Ende',
      measuredAt,
      ch1: ch1Idx >= 0 ? parseNum(cols[ch1Idx]) : null,
      ch2: ch2Idx >= 0 ? parseNum(cols[ch2Idx]) : null,
      ch32: ch32Idx >= 0 ? parseNum(cols[ch32Idx]) : null,
    });
  }

  return rows;
}

// ── Excel-Parser ───────────────────────────────────────────────
async function parseExcel(filePath) {
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const ws = wb.worksheets[0];
  if (!ws || ws.rowCount < 2) return [];

  // Header lesen
  const headerRow = ws.getRow(1);
  const headers = [];
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber] = (cell.value || '').toString().toLowerCase().trim();
  });

  const dateIdx = headers.findIndex(h => h && (h.includes('datum') || h.includes('date') || h.includes('zeit') || h.includes('time') || h.includes('timestamp')));
  const ch1Idx = headers.findIndex(h => h && (h.includes('ch1') || h.includes('ntu') || h.includes('trübe')));
  const ch2Idx = headers.findIndex(h => h && (h.includes('ch2') || h.includes('schweb') || h.includes('mg/l')));
  const ch32Idx = headers.findIndex(h => h && (h.includes('ch32') || h.includes('batt') || h.includes('volt')));
  const probeIdx = headers.findIndex(h => h && (h.includes('probe') || h.includes('sonde')));

  const rows = [];

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const getVal = (idx) => idx >= 0 ? (row.getCell(idx)?.value ?? null) : null;

    let measuredAt = null;
    const dateVal = getVal(dateIdx);
    if (dateVal instanceof Date) {
      measuredAt = dateVal.toISOString();
    } else if (typeof dateVal === 'string') {
      measuredAt = parseDate(dateVal);
    }
    if (!measuredAt) return;

    rows.push({
      probe: getVal(probeIdx) || 'Ende',
      measuredAt,
      ch1: parseNum(getVal(ch1Idx)),
      ch2: parseNum(getVal(ch2Idx)),
      ch32: parseNum(getVal(ch32Idx)),
    });
  });

  return rows;
}

// ── Hilfs-Funktionen ───────────────────────────────────────────
function parseDate(str) {
  if (!str) return null;
  // Versuche verschiedene Formate
  // DD.MM.YYYY HH:mm
  const deMatch = str.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})\s*(\d{1,2})?:?(\d{2})?:?(\d{2})?/);
  if (deMatch) {
    const [, d, m, y, h, min, s] = deMatch;
    return new Date(y, m - 1, d, h || 0, min || 0, s || 0).toISOString();
  }
  // ISO Format
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString();
  return null;
}

function parseNum(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return val;
  // Komma zu Punkt
  const cleaned = val.toString().replace(',', '.').replace(/[^\d.\-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

module.exports = router;
