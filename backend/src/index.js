require('dotenv').config();
const express = require('express');
const session = require('express-session')
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const { csrf } = require('lusca');
// Import UAA modules
const { sql } = require('./db');
const { authRoutes } = require('./routes/auth');
const { authMiddleware } = require('./middleware/auth');

// Import existing routes and middleware
const apiRoutes = require('./routes');
const tasksRouter = require('./routes/tasks.js');
const projectTasksRoutes = require('./routes/projectTasks');
const taskCommentRoutes = require('./routes/tasks/taskCommentRoute');
const teamMembersRoutes = require('./routes/users');
const projectRoutes = require('./routes/projects');
const userRoutes = require('./routes/users');
const { createLoggerMiddleware, logError } = require('./middleware/logger');

// -------------------- Session helpers (backend-only) --------------------
const COOKIE = 'sid';
const ACCESS_TTL = 15 * 60; // 15min autologout

function signAccess(payload, { maxAge = ACCESS_TTL } = {}) {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { iat: now, nbf: now, exp: now + maxAge, ...payload },
    process.env.JWT_SECRET || 'dev_only_change_me',
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
    secure: false,      // set true behind HTTPS
    sameSite: 'Lax',
    maxAge: maxAge * 1000,
    path: '/',
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

function extractToken(req) {
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
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_only_change_me', {
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

// Soft attach – if token exists attach req.user, else continue
function attachSessionIfAny(req, res, next) {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_only_change_me', {
      issuer: process.env.JWT_ISSUER || 'kanban',
      audience: process.env.JWT_AUDIENCE || 'kanban-web',
      algorithms: ['HS256'],
    });
    req.user = { id: payload.sub, role: payload.role, email: payload.email };
  } catch {}
  next();
}
// -----------------------------------------------------------------------

const devBypass = require('./middleware/devAuthBypass'); // your bypass helper
const app = express();
const PORT = process.env.PORT || 3001;

async function initializeApp() {
  const loggerMiddleware = await createLoggerMiddleware();
  app.use(loggerMiddleware);

  // Core middleware
  app.use(morgan("dev"));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser()); // Add cookie parser for UAA
    // Validate SESSION_SECRET presence and strength
    const sessionSecret = process.env.SESSION_SECRET;
    const isProduction = process.env.NODE_ENV === 'production';

    function isStrongSecret(secret) {
        // Example: at least 32 chars, not a default value
        return (
            typeof secret === 'string' &&
            secret.length >= 32 &&
            !['changeme', 'default', 'secret', 'password'].includes(secret.toLowerCase())
        );
    }

    if (!sessionSecret) {
        throw new Error('SESSION_SECRET environment variable is not set.');
    }
    if (isProduction && !isStrongSecret(sessionSecret)) {
        throw new Error('SESSION_SECRET is too weak for production. Please use a strong, random value of at least 32 characters.');
    }
    if (!isProduction && !isStrongSecret(sessionSecret)) {
        console.warn('Warning: SESSION_SECRET is weak. Use a strong, random value in production.');
    }

    app.use(session({
        secret: sessionSecret,
        resave: false,
        saveUninitialized: true
    }));
  //app.use(csrf()); // CSRF protection for all state-changing requests
    app.use(csrf({
        csrf: true,              // Enable CSRF protection
        csp: { policy: { "default-src": "'self'" } },
        xframe: "SAMEORIGIN",
        xssProtection: true
    }));
  app.use(
    cors({
      origin: process.env.FRONTEND_ORIGIN || true, // Allow all origins in development
      credentials: true,
    })
  );

  // Build a single auth middleware that either enforces session
  // or (when AUTH_BYPASS=true) fakes req.user if no session.
  const authMw = devBypass(requireSession);

  // UAA Auth endpoints (unprotected)
  app.use('/auth', authRoutes(sql));

  // -------------------- Dev session routes --------------------
  app.post('/dev/session/start', (req, res) => {
    const { userId, email, role = 'dev' } = req.body || {};
    if (!userId && !email) return res.status(400).json({ error: 'userId or email required' });
    const token = signAccess({ sub: userId || email, email, role });
    setSessionCookie(res, token);
    res.status(200).json({ ok: true, token });
  });

  app.post('/session/end', (req, res) => {
    clearSessionCookie(res);
    res.status(200).json({ ok: true });
  });

  app.get('/me', requireSession, (req, res) => {
    res.json({ user: req.user });
  });
  // ------------------------------------------------------------

  // Routes (flip attachSessionIfAny -> requireSession later if you want)
  app.use('/api', attachSessionIfAny, apiRoutes);
  app.use('/users', attachSessionIfAny, teamMembersRoutes);

  // Data APIs using the bypass wrapper during dev
  app.use('/api/tasks', authMw, taskCommentRoutes);
  app.use('/api/projects', authMw, projectTasksRoutes);
  app.use('/api/projects', authMw, projectRoutes);
  app.use('/api/users', authMw, userRoutes);
  app.use('/tasks', authMw, tasksRouter);

  // UAA Protected route example
  app.get('/protected/ping', authMiddleware(sql), (req, res) => {
    res.json({ ok: true, at: new Date().toISOString(), user: res.locals.session });
  });

  app.get('/', (req, res) => {
    res.json({
      message: 'Project Management Backend API - G3T5',
      version: '1.0.0',
      endpoints: {
        auth: '/auth',
        projects: '/api/projects',
        users: '/api/users',
        tasks: '/api/tasks',
      },
    });
  });

  // Global error handler
  app.use(async (err, req, res, next) => {
    console.error('Unhandled error:', err);
    await logError(err, req);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error:
        process.env.NODE_ENV === 'development'
          ? err.message
          : 'Something went wrong',
    });
  });

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

initializeApp().catch(console.error);
