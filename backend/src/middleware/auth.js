// src/middleware/auth.js
const { getSession, touchSession, deleteSession } = require('../auth/sessions');
const supabase = require('../utils/supabase');

const cookieName = process.env.SESSION_COOKIE_NAME || 'spm_session';

const buildUserFromSession = async (session) => {
  // Fetch full user data from database to include role and other fields
  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, name, role, hierarchy, division, department')
    .eq('id', session.user_id)
    .single();

  if (error || !user) {
    return {
      id: session.user_id,
      email: session.email,
    };
  }

  return user;
};

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
  req.user = await buildUserFromSession(session);
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
    req.user = await buildUserFromSession(session);
  } catch (err) {
    console.error('[optionalAuthMiddleware] error', err);
  }
  next();
};

module.exports = { authMiddleware, optionalAuthMiddleware, cookieName };
