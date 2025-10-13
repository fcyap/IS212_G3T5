/*path: backend/src/auth.roles*/
const { supabase } = require('../supabase-client');

const getEffectiveRole = async (userId) => {
  try {
    // Get user role from the users table directly
    const { data: users, error } = await supabase
      .from('users')
      .select('role, hierarchy, division, department')
      .eq('id', userId)
      .limit(1);
    
    if (error) {
      console.error('Database query error:', error);
      return { label: 'Staff', level: 1, hierarchy: 1, division: null, department: null };
    }
    
    const user = users?.[0];
    if (!user) {
      return { label: 'Staff', level: 1, hierarchy: 1, division: null, department: null };
    }

    const role = user.role || 'staff';
    
    // Map database roles to display roles
    switch (role.toLowerCase()) {
      case 'admin':
        return { 
          label: 'Admin', 
          level: 3, 
          hierarchy: user.hierarchy || 3,
          division: user.division,
          department: user.department
        };
      case 'manager':
        return { 
          label: 'Manager', 
          level: 2, 
          hierarchy: user.hierarchy || 2,
          division: user.division,
          department: user.department
        };
      case 'staff':
      default:
        return { 
          label: 'Staff', 
          level: 1, 
          hierarchy: user.hierarchy || 1,
          division: user.division,
          department: user.department
        };
    }
  } catch (error) {
    console.error('Error getting user role:', error);
    // Fallback to staff role if there's an error
    return { label: 'Staff', level: 1, hierarchy: 1, division: null, department: null };
  }
};

/**
 * Check if user can view projects/tasks of another user
 * Managers can view projects/tasks of staff in same division with lower hierarchy
 */
const canViewUserData = (managerUser, targetUser) => {
  // Admin can view everything
  if (managerUser.role === 'admin') {
    return true;
  }
  
  // Managers can view their own data
  if (managerUser.id === targetUser.id) {
    return true;
  }
  
  // Only managers can view other users' data
  if (managerUser.role !== 'manager') {
    return false;
  }
  
  // Must be in same division
  if (managerUser.division !== targetUser.division) {
    return false;
  }
  
  // Manager must have higher hierarchy (greater number) than target user
  return (managerUser.hierarchy || 0) > (targetUser.hierarchy || 0);
};

/**
 * Check if user can create projects
 * Only managers and admins can create projects
 */
const canCreateProject = (user) => {
  return user.role === 'manager' || user.role === 'admin';
};

/**
 * Check if user can edit/delete projects
 * Project creators and managers in same division with higher hierarchy can edit
 */
const canEditProject = (user, project, projectCreator) => {
  // Admin can edit anything
  if (user.role === 'admin') {
    return true;
  }
  
  // Project creator can edit their own project
  if (user.id === project.creator_id) {
    return true;
  }
  
  // Managers can edit projects in their division if they have higher hierarchy than creator
  if (user.role === 'manager' && projectCreator) {
    return user.division === projectCreator.division && 
           (user.hierarchy || 0) > (projectCreator.hierarchy || 0);
  }
  
  return false;
};

/**
 * Check if user can add members to projects
 * Only managers and project creators can add members
 */
const canAddProjectMembers = (user, project) => {
  return user.role === 'admin' || 
         user.role === 'manager' || 
         user.id === project.creator_id;
};

/**
 * Get users that a manager can see based on hierarchy and division
 */
const getVisibleUsers = async (sql, managerUser) => {
  try {
    // Admin can see all users
    if (managerUser.role === 'admin') {
      const users = await sql/*sql*/`
        select id, name, email, role, hierarchy, division, department
        from public.users
        order by hierarchy desc, name
      `;
      return users;
    }
    
    // Managers can see users in their division with lower hierarchy
    if (managerUser.role === 'manager') {
      const users = await sql/*sql*/`
        select id, name, email, role, hierarchy, division, department
        from public.users
        where division = ${managerUser.division}
        and hierarchy < ${managerUser.hierarchy || 0}
        order by hierarchy desc, name
      `;
      return users;
    }
    
    // Staff can only see themselves
    const users = await sql/*sql*/`
      select id, name, email, role, hierarchy, division, department
      from public.users
      where id = ${managerUser.id}
    `;
    return users;
  } catch (error) {
    console.error('Error getting visible users:', error);
    return [];
  }
};

module.exports = { 
  getEffectiveRole, 
  canViewUserData, 
  canCreateProject, 
  canEditProject, 
  canAddProjectMembers,
  getVisibleUsers 
};