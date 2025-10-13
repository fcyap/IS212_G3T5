// src/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { createSession, deleteSession } = require('../auth/sessions');
const { getEffectiveRole } = require('../auth/roles');
const { cookieName } = require('../middleware/auth');
const { authMiddleware } = require('../middleware/auth'); // <-- add this
const { supabase } = require('../supabase-client');

function authRoutes() {
  const router = express.Router();

  router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    console.log('Login attempt for:', email);
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    console.log('Querying database for user...');
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, password_hash, name, role, hierarchy, division, department')
      .ilike('email', email)
      .limit(1);
    
    if (error) {
      console.error('Database query error:', error);
      return res.status(500).json({ error: 'Database query failed' });
    }
    
    const user = users?.[0];
    console.log('User found:', user ? 'Yes' : 'No');

    // Important guard: if no user OR no bcrypt hash, return 401 (not 500)
    if (!user || !user.password_hash || !user.password_hash.startsWith('$2')) {
      console.log('Authentication failed: invalid user or password hash');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('Comparing passwords...');
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      console.log('Password comparison failed');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('Creating session...');
    const { token, expiresAt } = await createSession(user.id);
    res.cookie(cookieName, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: (Number(process.env.SESSION_IDLE_MINUTES || 15)) * 60 * 1000,
      path: '/',
    });

    console.log('Getting user role...');
    const role = await getEffectiveRole(sql, user.id);
    console.log('Login successful for user:', user.id);
    return res.json({ 
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name,
        role: user.role,
        hierarchy: user.hierarchy,
        division: user.division,
        department: user.department
      }, 
      role, 
      expiresAt 
    });
  } catch (e) {
    console.error('POST /auth/login error:', e);  // <-- log root cause
    console.error('Error stack:', e.stack);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

  // Debug login route for troubleshooting
  router.post('/debug-login', async (req, res) => {
    try {
      console.log('DEBUG: Login request received');
      console.log('DEBUG: Request body:', req.body);
      
      const { email, password } = req.body || {};
      
      if (!email || !password) {
        console.log('DEBUG: Missing email or password');
        return res.status(400).json({ error: 'Email and password required' });
      }
      
      console.log('DEBUG: Testing database connection...');
      
      // Test database connection first
      const { data: testQuery, error: testError } = await supabase
        .from('users')
        .select('id')
        .limit(1);
      console.log('DEBUG: Database connection OK:', testQuery);
      
      // Try to find user
      console.log('DEBUG: Looking for user with email:', email);
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, email, password_hash, role')
        .ilike('email', email)
        .limit(1);
      
      console.log('DEBUG: User query result:', users);
      
      if (!users || users.length === 0) {
        console.log('DEBUG: No user found');
        return res.status(401).json({ error: 'User not found' });
      }
      
      const user = users[0];
      console.log('DEBUG: User found:', { id: user.id, email: user.email, hasPassword: !!user.password_hash });
      
      if (!user.password_hash) {
        console.log('DEBUG: User has no password hash');
        return res.status(401).json({ error: 'No password set for user' });
      }
      
      // Test password comparison
      console.log('DEBUG: Testing password...');
      const passwordMatch = await bcrypt.compare(password, user.password_hash);
      console.log('DEBUG: Password match:', passwordMatch);
      
      if (!passwordMatch) {
        console.log('DEBUG: Password mismatch');
        return res.status(401).json({ error: 'Invalid password' });
      }
      
      // Return success without creating session for now
      console.log('DEBUG: Login would succeed for user:', user.id);
      return res.json({ 
        success: true, 
        user: { id: user.id, email: user.email },
        message: 'Login test successful'
      });
      
    } catch (error) {
      console.error('DEBUG: Login error:', error);
      console.error('DEBUG: Error stack:', error.stack);
      return res.status(500).json({ 
        error: 'Internal Server Error',
        details: error.message
      });
    }
  });

  router.post('/logout', async (req, res) => {
    const token = req.cookies?.[cookieName];
    if (token) await deleteSession(token);
    res.clearCookie(cookieName, { path: '/' });
    return res.json({ ok: true });
  });

  // Alternative login using Supabase REST API (fallback for DNS issues)
  router.post('/supabase-login', async (req, res) => {
    try {
      console.log('SUPABASE: Login request received');
      const { supabase } = require('../supabase-client');
      
      const { email, password } = req.body || {};
      
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
      }
      
      console.log('SUPABASE: Looking for user:', email);
      
      // Query user using Supabase client
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, email, password_hash, name, role, hierarchy, division, department')
        .eq('email', email.toLowerCase())
        .single();
      
      if (userError || !users) {
        console.log('SUPABASE: User not found or error:', userError);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      console.log('SUPABASE: User found:', { id: users.id, email: users.email });
      
      if (!users.password_hash || !users.password_hash.startsWith('$2')) {
        console.log('SUPABASE: Invalid password hash');
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Verify password
      const passwordMatch = await bcrypt.compare(password, users.password_hash);
      console.log('SUPABASE: Password match:', passwordMatch);
      
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Create session using Supabase
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      
      const { error: sessionError } = await supabase
        .from('sessions')
        .insert({
          token: sessionToken,
          user_id: users.id,
          expires_at: expiresAt.toISOString()
        });
      
      if (sessionError) {
        console.error('SUPABASE: Session creation error:', sessionError);
        return res.status(500).json({ error: 'Session creation failed' });
      }
      
      // Set cookie
      res.cookie(cookieName, sessionToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 15 * 60 * 1000,
        path: '/',
      });
      
      console.log('SUPABASE: Login successful for user:', users.id);
      return res.json({ 
        user: { 
          id: users.id, 
          email: users.email,
          name: users.name,
          role: users.role,
          hierarchy: users.hierarchy,
          division: users.division,
          department: users.department
        },
        role: { label: users.role || 'Staff', level: 1 },
        expiresAt 
      });
      
    } catch (error) {
      console.error('SUPABASE: Login error:', error);
      return res.status(500).json({ 
        error: 'Internal Server Error',
        details: error.message 
      });
    }
  });

  // PROTECT THIS:
  router.get('/me', authMiddleware(), async (req, res) => {
    try {
      const { session } = res.locals;
      
      // Get complete user information
      const { data: users, error } = await supabase
        .from('users')
        .select('id, email, name, role, hierarchy, division, department')
        .eq('id', session.user_id)
        .limit(1);
      
      if (error) {
        console.error('Database query error:', error);
        return res.status(500).json({ error: 'Database query failed' });
      }
      
      const user = users?.[0];
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const role = await getEffectiveRole(session.user_id);
      return res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          hierarchy: user.hierarchy,
          division: user.division,
          department: user.department
        },
        role,
        expiresAt: res.locals.newExpiry,
      });
    } catch (e) {
      console.error('GET /auth/me error:', e);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  return router;
}

module.exports = { authRoutes };
