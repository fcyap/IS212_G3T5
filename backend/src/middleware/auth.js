// src/middleware/auth.js
const { getSession, touchSession, deleteSession } = require('../auth/sessions');

const cookieName = process.env.SESSION_COOKIE_NAME || 'spm_session';

const buildUserFromSession = (session) => ({
  id: session.user_id,
  email: session.email,
  role: session.role,
  hierarchy: session.hierarchy,
  division: session.division,
  department: session.department,
});

const authMiddleware = () => async (req, res, next) => {
  const token = req.cookies?.[cookieName];
  if (!token) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }

  const session = await getSession(null, token);
  if (!session) {
    await deleteSession(null, token).catch(() => {});
    return res.status(401).json({ error: 'Invalid session' });
  }

  if (new Date(session.expires_at).getTime() < Date.now()) {
    await deleteSession(null, token).catch(() => {});
    return res.status(401).json({ error: 'Session expired' });
  }

  const newExpiry = await touchSession(null, token);
  res.locals.sessionToken = token;
  res.locals.session = session;
  res.locals.newExpiry = newExpiry;
  req.user = buildUserFromSession(session);
  next();
};

const optionalAuthMiddleware = () => async (req, res, next) => {
  const token = req.cookies?.[cookieName];
  if (!token) return next();
  try {
    const session = await getSession(null, token);
    if (!session) return next();
    if (new Date(session.expires_at).getTime() < Date.now()) return next();
    res.locals.sessionToken = token;
    res.locals.session = session;
    res.locals.newExpiry = await touchSession(null, token);
    req.user = buildUserFromSession(session);
  } catch (err) {
    console.error('[optionalAuthMiddleware] error', err);
  }
  next();
};

module.exports = { authMiddleware, optionalAuthMiddleware, cookieName };
