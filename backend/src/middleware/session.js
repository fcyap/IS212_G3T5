// backend/middleware/session.js
const jwt = require('jsonwebtoken');

const COOKIE = 'sid';
const ACCESS_TTL = 60 * 60; // 1h

function signAccess(payload, { maxAge = ACCESS_TTL } = {}) {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { iat: now, nbf: now, exp: now + maxAge, ...payload },
    process.env.JWT_SECRET,
    {
      issuer: process.env.JWT_ISSUER || 'kanban',
      audience: process.env.JWT_AUDIENCE || 'kanban-web',
      algorithm: 'HS256',
    }
  );
}

function setSessionCookie(res, token, { maxAge = ACCESS_TTL } = {}) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: false,       // true if HTTPS
    sameSite: 'Lax',
    maxAge: maxAge * 1000,
    path: '/',
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

function extractToken(req) {
  // 1) Cookie (preferred), 2) Authorization: Bearer <token> (for Postman/curl)
  const c = req.cookies?.[COOKIE];
  if (c) return c;
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function requireSession(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Unauthenticated' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: process.env.JWT_ISSUER || 'kanban',
      audience: process.env.JWT_AUDIENCE || 'kanban-web',
      algorithms: ['HS256'],
    });
    req.user = { id: payload.sub, role: payload.role, email: payload.email };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid/expired session' });
  }
}

module.exports = {
  signAccess,
  setSessionCookie,
  clearSessionCookie,
  requireSession,
  extractToken,
};
