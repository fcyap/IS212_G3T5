require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const devBypass = require('./middleware/devAuthBypass');
const authMw = devBypass(requireSession);
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

// Import routes and middleware
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

// Initialize logger middleware asynchronously
async function initializeApp() {
  const loggerMiddleware = await createLoggerMiddleware();
  app.use(loggerMiddleware);

  // Core middleware
  app.use(
    cors({
      origin: true,      // echoes request Origin; OK for dev
      credentials: true, // allow cookies/credentials
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());    // <-- needed for HttpOnly cookie sessions
  app.use(morgan("dev"));

  // Routes
  app.use('/api', apiRoutes);
  app.use('/users', teamMembersRoutes);
  app.use('/api/tasks', taskCommentRoutes);
  app.use('/api/projects', projectTasksRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/users', userRoutes);
  app.use('/tasks', tasksRouter);

  app.get('/', (req, res) => {
    res.json({
      message: 'Project Management Backend API - G3T5',
      version: '1.0.0',
      endpoints: {
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
