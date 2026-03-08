const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

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
