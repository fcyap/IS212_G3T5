// src/middleware/auth.js
const { getSession, touchSession } = require('../auth/sessions');

const cookieName = process.env.SESSION_COOKIE_NAME || 'spm_session';

const authMiddleware = () => async (req, res, next) => {
  const token = req.cookies?.[cookieName];
  console.log('authMiddleware - cookieName:', cookieName);
  console.log('authMiddleware - cookies:', req.cookies);
  console.log('authMiddleware - token:', token);
  
  if (!token) return res.status(401).json({ error: 'Unauthenticated' });

  const session = await getSession(token);
  console.log('authMiddleware - session:', session);
  
  if (!session) return res.status(401).json({ error: 'Invalid session' });

  if (new Date(session.expires_at).getTime() < Date.now()) {
    return res.status(401).json({ error: 'Session expired' });
  }

  // Rolling idle timeout: extend on each request
  const newExpiry = await touchSession(token);
  res.locals.sessionToken = token;
  res.locals.session = session;
  res.locals.newExpiry = newExpiry;
  console.log('authMiddleware - session set in res.locals:', res.locals.session);
  next();
};

module.exports = { authMiddleware, cookieName };
