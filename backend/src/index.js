require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware initializations
const { createLoggerMiddleware, logError } = require('./middleware/logger');

// Route initializations
const projectRoutes = require('./routes/projects');
const projectTasksRoutes = require('./routes/projectTasks');

// Initialize logger middleware asynchronously
async function initializeApp() {
  const loggerMiddleware = await createLoggerMiddleware();
  app.use(loggerMiddleware);
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/', (req, res) => {
    res.json({
      message: 'Project Management Backend API',
      version: '1.0.0',
      endpoints: {
        projects: '/api/projects'
      }
    });
  });

  // Routes
  app.use('/api/projects', projectRoutes);
  app.use('/api/projects', projectTasksRoutes);

  // Handle 404 routes
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'Route not found',
      message: `Route ${req.originalUrl} not found`
    });
  });

  // Global error handler
  app.use(async (err, req, res, next) => {
    console.error('Unhandled error:', err);
    await logError(err, req);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'An unexpected error occurred'
    });
  });

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Available endpoints:');
    console.log('- GET  /api/projects                    - Get all projects');
    console.log('- POST /api/projects                    - Create new project');
    console.log('- GET  /api/projects/:id                - Get project by ID');
    console.log('- PUT  /api/projects/:id                - Update project');
    console.log('- DELETE /api/projects/:id              - Delete project');
    console.log('- POST /api/projects/:id/users          - Add user to project');
    console.log('- DELETE /api/projects/:id/users        - Remove user from project');
    console.log('- GET  /api/projects/:id/tasks          - Get all tasks for a project');
    console.log('- POST /api/projects/:id/tasks          - Create new task for a project');
    console.log('- GET  /api/projects/:id/tasks/:taskId  - Get specific task');
    console.log('- GET  /api/projects/:id/tasks/stats    - Get task statistics for a project');
    console.log('- GET  /api/tasks                       - Get all tasks');
    console.log('- PUT  /api/tasks/:id                   - Update task');
    console.log('- DELETE /api/tasks/:id                 - Delete task');
  });
}

initializeApp().catch(console.error);
