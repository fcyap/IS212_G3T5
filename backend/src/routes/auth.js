// src/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const { createSession, deleteSession } = require('../auth/sessions');
const { getEffectiveRole } = require('../auth/roles');
const { cookieName } = require('../middleware/auth');
const { authMiddleware } = require('../middleware/auth'); // <-- add this

function authRoutes(sql) {
  const router = express.Router();

  router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const users = await sql/*sql*/`
      select id, email, password_hash
      from public.users
      where lower(email) = lower(${email})
      limit 1
    `;
    const user = users[0];

    // Important guard: if no user OR no bcrypt hash, return 401 (not 500)
    if (!user || !user.password_hash || !user.password_hash.startsWith('$2')) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const { token, expiresAt } = await createSession(sql, user.id);
    res.cookie(cookieName, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: (Number(process.env.SESSION_IDLE_MINUTES || 15)) * 60 * 1000,
      path: '/',
    });

    const role = await getEffectiveRole(sql, user.id);
    return res.json({ user: { id: user.id, email: user.email }, role, expiresAt });
  } catch (e) {
    console.error('POST /auth/login error:', e);  // <-- log root cause
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

  router.post('/logout', async (req, res) => {
    const token = req.cookies?.[cookieName];
    if (token) await deleteSession(sql, token);
    res.clearCookie(cookieName, { path: '/' });
    return res.json({ ok: true });
  });

  // PROTECT THIS:
  router.get('/me', authMiddleware(sql), async (req, res) => {
    try {
      const { session } = res.locals;
      const role = await getEffectiveRole(sql, session.user_id);
      return res.json({
        user: { id: session.user_id, email: session.email },
        role,
        expiresAt: res.locals.newExpiry,
      });
    } catch (e) {
      console.error('GET /auth/me error:', e);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  return router;
}

module.exports = { authRoutes };
