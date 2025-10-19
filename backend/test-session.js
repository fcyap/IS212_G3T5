const { supabase } = require('./src/supabase-client');
const { createSession, getSession } = require('./src/auth/sessions.js');

async function testSession() {
  try {
    console.log('Testing session creation...');
    
    // First check if user 10 exists
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, name, role, hierarchy')
      .eq('id', 10)
      .limit(1);
    
    console.log('User 10 found:', users?.[0]);
    
    if (users?.[0]) {
      // Create a session for user 10
      const sessionData = await createSession(null, 10);
      console.log('Session created:', sessionData);
      
      // Try to retrieve it
      const retrieved = await getSession(null, sessionData.token);
      console.log('Session retrieved:', retrieved);
    }
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

testSession();