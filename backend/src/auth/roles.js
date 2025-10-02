/*path: backend/src/auth.roles*/
const getEffectiveRole = async (sql, userId) => {
  try {
    // Get user role from the users table directly
    const users = await sql/*sql*/`
      select role from public.users
      where id = ${userId}
      limit 1
    `;
    
    const user = users[0];
    if (!user) {
      return { label: 'Staff' };
    }

    const role = user.role || 'staff';
    
    // Map database roles to display roles
    switch (role.toLowerCase()) {
      case 'admin':
        return { label: 'Admin' };
      case 'manager':
        return { label: 'Manager' };
      case 'staff':
      default:
        return { label: 'Staff' };
    }
  } catch (error) {
    console.error('Error getting user role:', error);
    // Fallback to staff role if there's an error
    return { label: 'Staff' };
  }
};

module.exports = { getEffectiveRole };