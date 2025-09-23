require('dotenv').config();
const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes');
const { createLoggerMiddleware, logError } = require('./middleware/logger');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize logger middleware asynchronously
async function initializeApp() {
  const loggerMiddleware = await createLoggerMiddleware();
  app.use(loggerMiddleware);

  // Middleware
  app.use(
    cors({
      origin: true, // Allow all origins in development
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Routes
  app.use('/api', apiRoutes);

  app.get('/', (req, res) => {
    res.json({
      success: true,
      message: 'Task Management Backend API',
      version: '1.0.0',
      endpoints: {
        health: '/api/health',
        users: '/api/users',
        projects: '/api/projects',
        tasks: '/api/tasks',
      },
    });
  });

  // Handle 404 routes
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: 'Route not found',
      path: req.originalUrl,
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
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 API available at http://localhost:${PORT}/api`);
    console.log(`🏥 Health check at http://localhost:${PORT}/api/health`);
  });
}

initializeApp().catch(console.error);
