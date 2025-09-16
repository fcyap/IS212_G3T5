const express = require('express');
require("dotenv").config();
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware initializations
const { createLoggerMiddleware, logError } = require('./middleware/logger');

// Route initializations
const projectTasksRoutes = require('./routes/projectTasks');

// Initialize logger middleware asynchronously
async function initializeApp() {
  const loggerMiddleware = await createLoggerMiddleware();
  app.use(loggerMiddleware);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  //app.use(express.static('public'));

  app.get('/', (req, res) => {
    res.send('Backend is running!');
  });

  // Use api / project tasks routes
  app.use('/api/projects', projectTasksRoutes);

  // Error handling middleware
  app.use(async (err, req, res, next) => {
    await logError(err, req);
    res.status(500).json({ error: 'Something went wrong!' });
  });

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

initializeApp().catch(console.error);
