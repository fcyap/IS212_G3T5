require('dotenv').config();
const express = require('express');
const cors = require('cors');
const projectRoutes = require('./routes/projects');
const userRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/projects', projectRoutes);
app.use('/api/users', userRoutes);

app.get('/', (req, res) => {
  res.json({
    message: 'Project Management Backend API',
    version: '1.0.0',
    endpoints: {
      projects: '/api/projects',
      users: '/api/users'
    }
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: 'An unexpected error occurred'
  });
});

// Handle 404 routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `Route ${req.originalUrl} not found`
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('- GET  /api/projects       - Get all projects');
  console.log('- POST /api/projects       - Create new project');
  console.log('- GET  /api/projects/:id   - Get project by ID');
  console.log('- PUT  /api/projects/:id   - Update project');
  console.log('- DELETE /api/projects/:id - Delete project');
  console.log('- POST /api/projects/:id/users   - Add user to project');
  console.log('- DELETE /api/projects/:id/users - Remove user from project');
});
