const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

// Throttle: last_seen maximal alle 60 Sekunden pro User updaten
const lastSeenCache = new Map();
const LAST_SEEN_INTERVAL = 60 * 1000; // 60 Sekunden

function updateLastSeen(userId) {
  const now = Date.now();
  const last = lastSeenCache.get(userId) || 0;
  if (now - last > LAST_SEEN_INTERVAL) {
    lastSeenCache.set(userId, now);
    pool.query('UPDATE users SET last_seen = NOW() WHERE id = $1', [userId]).catch(() => {});
  }
}

/**
 * JWT-Auth Middleware
 * Erwartet: Authorization: Bearer <token>
 */
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Nicht angemeldet.' });
  }

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, email, role }
    // last_seen aktualisieren (throttled)
    updateLastSeen(decoded.id);
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Sitzung abgelaufen. Bitte neu anmelden.' });
    }
    return res.status(401).json({ error: 'Ungültiges Token.' });
  }
}

/**
 * Optional auth – setzt req.user wenn Token vorhanden, fährt sonst fort
 */
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.split(' ')[1], JWT_SECRET);
    } catch {
      // Token ungültig – weiter ohne User
    }
  }
  next();
}

/**
 * Admin/Warden-Check
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Keine Berechtigung.' });
    }
    next();
  };
}

module.exports = auth;
module.exports.optionalAuth = optionalAuth;
module.exports.requireRole = requireRole;
module.exports.JWT_SECRET = JWT_SECRET;
