// db.js
require('dotenv').config();
const postgres = require('postgres');

if (!process.env.DATABASE_URL) {
  throw new Error('Missing DATABASE_URL in .env');
}

const sql = postgres(process.env.DATABASE_URL, {
  ssl: 'require',
  max: 10,
  fetch_types: false,
  connect_timeout: 30, // 30 seconds timeout
  idle_timeout: 0,
  connection: {
    application_name: 'spm_backend'
  },
  // Add options parameter for Supabase pooler compatibility
  prepare: false, // Disable prepared statements for pooler
  transform: {
    undefined: null
  }
});

module.exports = { sql };
