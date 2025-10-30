require('dotenv').config();
const postgres = require('postgres');

if (!process.env.DATABASE_URL) {
  throw new Error('Missing DATABASE_URL in .env');
}

const sql = postgres(process.env.DATABASE_URL, {
  ssl: 'require',
  max: 10,
});

module.exports = { sql };