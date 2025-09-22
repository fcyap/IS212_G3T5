// src/index.js
require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { sql } = require('./db');
const { authRoutes } = require('./routes/auth');
const { authMiddleware } = require('./middleware/auth');

const app = express();

app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));

app.get('/', (_, res) => res.send('Backend is running!')); // keep your healthcheck

// Auth endpoints
app.use('/auth', authRoutes(sql));

// Example of a protected route:
app.get('/protected/ping', authMiddleware(sql), (req, res) => {
  res.json({ ok: true, at: new Date().toISOString() });
});

// Start server
const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

