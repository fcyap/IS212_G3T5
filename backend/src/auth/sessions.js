// src/auth/sessions.js
const crypto = require('crypto');

const minutes = Number(process.env.SESSION_IDLE_MINUTES || 15);

const makeExpiry = () => new Date(Date.now() + minutes * 60 * 1000);

async function createSession(sql, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = makeExpiry();
  await sql/*sql*/`
    insert into sessions (token, user_id, expires_at)
    values (${token}, ${userId}, ${expiresAt})
  `;
  return { token, expiresAt };
}

async function getSession(sql, token) {
  const rows = await sql/*sql*/`
    select s.*, u.email
    from sessions s
    join users u on u.id = s.user_id
    where s.token = ${token}
  `;
  return rows[0] || null;
}

async function touchSession(sql, token) {
  const expiresAt = makeExpiry();
  await sql/*sql*/`
    update sessions
    set last_seen_at = now(), expires_at = ${expiresAt}
    where token = ${token}
  `;
  return expiresAt;
}

async function deleteSession(sql, token) {
  await sql/*sql*/`delete from sessions where token = ${token}`;
}

module.exports = { createSession, getSession, touchSession, deleteSession };
