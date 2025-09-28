// Debug login route - add this temporarily to your auth.js for testing
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
    const testQuery = await sql`SELECT 1 as test`;
    console.log('DEBUG: Database connection OK:', testQuery);
    
    // Try to find user
    console.log('DEBUG: Looking for user with email:', email);
    const users = await sql`
      SELECT id, email, password_hash, role
      FROM public.users
      WHERE lower(email) = lower(${email})
      LIMIT 1
    `;
    
    console.log('DEBUG: User query result:', users);
    
    if (users.length === 0) {
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
    const bcrypt = require('bcryptjs');
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