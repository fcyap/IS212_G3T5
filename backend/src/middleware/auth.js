// src/middleware/auth.js
const { getSession, touchSession } = require('../auth/sessions');

const cookieName = process.env.SESSION_COOKIE_NAME || 'spm_session';

const authMiddleware = (sql) => async (req, res, next) => {
  const token = req.cookies?.[cookieName];
  if (!token) return res.status(401).json({ error: 'Unauthenticated' });

  const session = await getSession(sql, token);
  if (!session) return res.status(401).json({ error: 'Invalid session' });

  if (new Date(session.expires_at).getTime() < Date.now()) {
    return res.status(401).json({ error: 'Session expired' });
  }

  // Rolling idle timeout: extend on each request
  const newExpiry = await touchSession(sql, token);
  res.locals.sessionToken = token;
  res.locals.session = session;
  res.locals.newExpiry = newExpiry;
  next();
};

module.exports = { authMiddleware, cookieName };
