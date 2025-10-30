const supabase = require('./src/utils/supabase');
const bcrypt = require('bcrypt');

async function testLogin() {
  try {
    console.log('Testing database connection...');
    
    // Test if user exists
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email, password_hash, name, role, hierarchy, division, department')
      .eq('email', 'cheryl.tan@gmail.com')
      .single();
    
    if (userError || !users) {
      console.log('❌ User not found:', userError?.message || 'No user returned');
      
      // Check if any users exist
      const { data: allUsers, error: allError } = await supabase
        .from('users')
        .select('id, email, name, role')
        .limit(5);
        
      console.log('Available users:', allUsers?.map(u => u.email) || 'Error:', allError);
      return;
    }
    
    console.log('✅ User found:', {
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      hasPasswordHash: !!users.password_hash,
      passwordHashFormat: users.password_hash?.substring(0, 10) + '...'
    });
    
    // Test password
    if (users.password_hash) {
      const passwordMatch = await bcrypt.compare('password123', users.password_hash);
      console.log('✅ Password test:', passwordMatch ? 'MATCH' : 'NO MATCH');
    } else {
      console.log('❌ No password hash found');
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

testLogin();