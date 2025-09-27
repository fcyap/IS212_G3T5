require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

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

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize logger middleware asynchronously
async function initializeApp() {
  const loggerMiddleware = await createLoggerMiddleware();
  app.use(loggerMiddleware);

  // Middleware
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

  // UAA Auth endpoints (unprotected)
  app.use('/auth', authRoutes(sql));

  // Existing API routes (now can be protected with UAA)
  app.use('/api', apiRoutes);
  app.use('/users', teamMembersRoutes);
  app.use('/api/tasks', taskCommentRoutes);
  app.use('/api/projects', projectTasksRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/users', userRoutes);
  app.use('/tasks', tasksRouter);

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
        tasks: '/api/tasks'
      }
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
