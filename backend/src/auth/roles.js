/*path: backend/src/auth.roles*/
const { supabase } = require('../supabase-client');

const getEffectiveRole = async (sql, userId) => {
  try {
    // Use Supabase instead of direct SQL connection
    const { data: user, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();
    
    if (error || !user) {
      console.error('Error getting user role from Supabase:', error);
      return { label: 'staff', level: 1 };
    }

    const role = user.role || 'staff';
    
    // Map database roles to display roles
    switch (role.toLowerCase()) {
      case 'admin':
        return { label: 'admin', level: 3 };
      case 'manager':
        return { label: 'manager', level: 2 };
      case 'staff':
      default:
        return { label: 'staff', level: 1 };
    }
  } catch (error) {
    console.error('Error getting user role:', error);
    // Fallback to staff role if there's an error
    return { label: 'staff', level: 1 };
  }
};

module.exports = { getEffectiveRole };