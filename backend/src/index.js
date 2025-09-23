require("dotenv").config();

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

// Routers
const tasksRouter = require("./routes/tasks.js"); 

const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3001;
const { createLoggerMiddleware, logError } = require('./middleware/logger');
// Middleware
app.use(
  cors({
    origin: true, // Allow all origins in development
    credentials: true,
  })
);
// Middleware
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:3000" }));
app.use(express.json());
app.use(morgan("dev"));

// Routes
app.use("/tasks", tasksRouter);
app.use(express.urlencoded({ extended: true }));
// Route initializations
const projectTasksRoutes = require('./routes/projectTasks');
const taskCommentRoutes = require('./routes/tasks/taskCommentRoute');

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

  // Use /api/ routes
  app.use('/api/projects', projectTasksRoutes);
  app.use('/api/tasks', taskCommentRoutes);

  // Error handling middleware
  app.use(async (err, req, res, next) => {
    await logError(err, req);
    res.status(500).json({ error: 'Something went wrong!' });
  });
app.get("/", (_req, res) => {
  res.send("Backend is running!");
});

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

initializeApp().catch(console.error);
