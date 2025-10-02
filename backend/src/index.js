require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

// Import UAA modules
const { sql } = require('./db');
const { authRoutes } = require('./routes/auth');
const { authMiddleware, cookieName } = require('./middleware/auth');
const { createSession, deleteSession } = require('./auth/sessions');

// Import existing routes and middleware
const apiRoutes = require('./routes');
const tasksRouter = require('./routes/tasks');
const projectTasksRoutes = require('./routes/projectTasks');
const taskCommentRoutes = require('./routes/tasks/taskCommentRoute');
const projectRoutes = require('./routes/projects');
const userRoutes = require('./routes/users');
const { createLoggerMiddleware, logError } = require('./middleware/logger');

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
  app.use(
    cors({
      origin: process.env.FRONTEND_ORIGIN || true, // Allow all origins in development
      credentials: true,
    })
  );

  const authMw = authMiddleware(sql);

  // UAA Auth endpoints (unprotected)
  app.use('/auth', authRoutes(sql));

  // -------------------- Dev session routes --------------------
  app.post('/dev/session/start', async (req, res) => {
    const { userId, email } = req.body || {};
    if (!userId && !email) return res.status(400).json({ error: 'userId or email required' });

    let targetId = userId;
    try {
      if (!targetId && email) {
        const rows = await sql`select id from users where lower(email) = lower(${email}) limit 1`;
        if (!rows.length) return res.status(404).json({ error: 'User not found' });
        targetId = rows[0].id;
      }

      const { token, expiresAt } = await createSession(sql, targetId);
      res.cookie(cookieName, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: (Number(process.env.SESSION_IDLE_MINUTES || 15)) * 60 * 1000,
        path: '/',
      });
      res.status(200).json({ ok: true, expiresAt });
    } catch (err) {
      console.error('/dev/session/start error', err);
      res.status(500).json({ error: 'Failed to create session' });
    }
  });

  app.post('/session/end', async (req, res) => {
    const token = req.cookies?.[cookieName];
    if (token) await deleteSession(sql, token).catch(() => {});
    res.clearCookie(cookieName, { path: '/' });
    res.status(200).json({ ok: true });
  });

  app.get('/me', authMw, (req, res) => {
    res.json({
      user: req.user,
      expiresAt: res.locals.newExpiry,
    });
  });
  // ------------------------------------------------------------

  // Routes that require an authenticated session
  app.use('/api', authMw, apiRoutes);
  app.use('/users', authMw, userRoutes);

  // Data APIs using the bypass wrapper during dev
  app.use('/api/tasks', authMw, taskCommentRoutes);
  app.use('/api/projects', authMw, projectTasksRoutes);
  app.use('/api/projects', authMw, projectRoutes);
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
