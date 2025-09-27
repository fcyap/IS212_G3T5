// db.js
require('dotenv').config();
const postgres = require('postgres');

if (!process.env.DATABASE_URL) {
  throw new Error('Missing DATABASE_URL in .env');
}

const sql = postgres(process.env.DATABASE_URL, {
  ssl: 'require',
  max: 10,
  hostname: 'db.skitbnwrifrpzlgjmqml.supabase.co',
  // Add this line:
  fetch_types: false, // optional optimization
  host: 'db.skitbnwrifrpzlgjmqml.supabase.co',
  // Force Node DNS to prefer IPv4
  connection: { family: 4 }
});

module.exports = { sql };
