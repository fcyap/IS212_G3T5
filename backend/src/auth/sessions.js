// src/auth/sessions.js
const crypto = require('crypto');
const { supabase } = require('../supabase-client');

const minutes = Number(process.env.SESSION_IDLE_MINUTES || 15);

const makeExpiry = () => new Date(Date.now() + minutes * 60 * 1000);

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = makeExpiry();
  
  const { error } = await supabase
    .from('sessions')
    .insert([
      {
        token: token,
        user_id: userId,
        expires_at: expiresAt.toISOString()
      }
    ]);
    
  if (error) {
    throw new Error(`Failed to create session: ${error.message}`);
  }
  
  return { token, expiresAt };
}

async function getSession(token) {
  const { data: rows, error } = await supabase
    .from('sessions')
    .select(`
      *,
      users!inner(email)
    `)
    .eq('token', token)
    .limit(1);
    
  if (error) {
    console.error('Error fetching session:', error);
    return null;
  }
  
  return rows?.[0] || null;
}

async function touchSession(token) {
  const expiresAt = makeExpiry();
  
  const { error } = await supabase
    .from('sessions')
    .update({
      last_seen_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString()
    })
    .eq('token', token);
    
  if (error) {
    console.error('Error touching session:', error);
    throw new Error(`Failed to update session: ${error.message}`);
  }
  
  return expiresAt;
}

async function deleteSession(token) {
  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('token', token);
    
  if (error) {
    console.error('Error deleting session:', error);
    throw new Error(`Failed to delete session: ${error.message}`);
  }
}

module.exports = { createSession, getSession, touchSession, deleteSession };
