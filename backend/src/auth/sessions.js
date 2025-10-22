// src/auth/sessions.js
const crypto = require('crypto');
const { supabase } = require('../supabase-client');

const minutes = Number(process.env.SESSION_IDLE_MINUTES || 15);

const makeExpiry = () => new Date(Date.now() + minutes * 60 * 1000);

async function createSession(_sql, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = makeExpiry();

  const { error } = await supabase
    .from('sessions')
    .insert({
      token,
      user_id: userId,
      expires_at: expiresAt.toISOString(),
    });

  if (error) throw error;
  return { token, expiresAt };
}

async function getSession(_sql, token) {
  const { data: session, error } = await supabase
    .from('sessions')
    .select('token, user_id, expires_at, last_seen_at')
    .eq('token', token)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('email')
    .eq('id', session.user_id)
    .single();

  if (userError && userError.code !== 'PGRST116') {
    throw userError;
  }

  return {
    ...session,
    email: user?.email ?? null,
  };
}

async function touchSession(_sql, token) {
  const expiresAt = makeExpiry();
  const { error } = await supabase
    .from('sessions')
    .update({
      last_seen_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
    })
    .eq('token', token);

  if (error) throw error;
  return expiresAt;
}

async function deleteSession(_sql, token) {
  await supabase.from('sessions').delete().eq('token', token);
}

module.exports = { createSession, getSession, touchSession, deleteSession };
