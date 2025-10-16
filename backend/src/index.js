require('dotenv').config();
const express = require('express');
const session = require('express-session')
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const { csrf } = require('lusca');
// Import UAA modules
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
const notificationRoutes = require('./routes/notifications');
const { createLoggerMiddleware, logError } = require('./middleware/logger');
const cron = require('node-cron');
const notificationService = require('./services/notificationService');

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
    app.get("/csrf-token", (req, res) => {
        res.json({ csrfToken: req.csrfToken() });
    });
  const authMw = authMiddleware();

  // UAA Auth endpoints (unprotected)
  app.use('/auth', authRoutes());

  // -------------------- Dev session routes --------------------
  const supabase = require('./utils/supabase');

  app.post('/dev/session/start', async (req, res) => {
    const { userId, email } = req.body || {};
    if (!userId && !email) return res.status(400).json({ error: 'userId or email required' });

    let targetId = userId;
    try {
      if (!targetId && email) {
        const { data: users, error: userError } = await supabase
          .from('users')
          .select('id')
          .ilike('email', email)
          .limit(1);
        if (!users || !users.length) return res.status(404).json({ error: 'User not found' });
        targetId = users[0].id;
      }

      const { token, expiresAt } = await createSession(null, targetId);
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
    if (token) await deleteSession(null, token).catch(() => {});
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
  app.use('/api/notifications', authMw, notificationRoutes);

  // Data APIs using the bypass wrapper during dev
  app.use('/api/tasks', authMw, taskCommentRoutes);
  app.use('/api/projects', authMw, projectTasksRoutes);
  app.use('/api/projects', authMw, projectRoutes);
  app.use('/api/notifications', authMw, notificationRoutes);
  app.use('/tasks', authMw, tasksRouter);

  // UAA Protected route example
  app.get('/protected/ping', authMiddleware(), (req, res) => {
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

  // ... existing code ...

// Add this temporary test route (remove after testing)
app.get('/test-email', async (req, res) => {
  try {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const msg = {
      to: 'yapfengcheng.yfc@gmail.com', // Replace with your actual email
      from: process.env.FROM_EMAIL,
      subject: 'Test SendGrid Email',
      text: 'This is a test email from your app!',
      html: '<strong>This is a test email from your app!</strong>',
    };

    await sgMail.send(msg);
    res.send('Email sent successfully!');
  } catch (error) {
    console.error('SendGrid error:', error);
    res.status(500).send(`Failed to send email: ${error.message}`);
  }
});

// ... existing code (your other routes and app.listen) ...

  // Schedule deadline notification checks to run daily at 8am
  cron.schedule('0 8 * * *', async () => {
    console.log('Running scheduled deadline notification check at 8am...');
    try {
      const result = await notificationService.checkAndSendDeadlineNotifications();
      console.log(`Deadline notification check completed. Sent ${result.notificationsSent} notifications for ${result.tasksChecked} tasks.`);
    } catch (error) {
      console.error('Error during scheduled deadline notification check:', error);
    }
  });

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

initializeApp().catch(console.error);
