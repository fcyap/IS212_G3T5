require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

// Routers
const tasksRouter = require("./routes/tasks.js"); 

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:3000" }));
app.use(express.json());
app.use(morgan("dev"));

// Routes
app.use("/tasks", tasksRouter);

app.get("/", (_req, res) => {
  res.send("Backend is running!");
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
