/*path: backend/src/auth.roles*/
const { supabase } = require('../supabase-client');

const getEffectiveRole = async (sql, userId) => {
  try {
    console.log('[getEffectiveRole] Called with userId:', userId, 'type:', typeof userId);

    // Validate userId
    if (!userId || userId === 'null' || userId === 'undefined' || userId === null || userId === undefined) {
      console.error('[getEffectiveRole] Invalid userId:', userId, 'type:', typeof userId);
      return { label: 'staff', level: 1, hierarchy: 1, division: null, department: null };
    }

    console.log('[getEffectiveRole] Querying Supabase for userId:', userId);
    // Use Supabase instead of direct SQL connection
    const { data: user, error } = await supabase
      .from('users')
      .select('role, hierarchy, division, department')
      .eq('id', userId)
      .single();

    console.log('[getEffectiveRole] Query result - user:', user, 'error:', error);

    if (error || !user) {
      console.error('Error getting user role from Supabase:', error);
      return { label: 'staff', level: 1, hierarchy: 1, division: null, department: null };
    }

    const role = user.role || 'staff';

    // Map database roles to display roles
    switch (role.toLowerCase()) {
      case 'admin':
        return {
          label: 'admin',
          level: 3,
          hierarchy: user.hierarchy || 3,
          division: user.division,
          department: user.department
        };
      case 'manager':
        return {
          label: 'manager',
          level: 2,
          hierarchy: user.hierarchy || 2,
          division: user.division,
          department: user.department
        };
      case 'staff':
      default:
        return {
          label: 'staff',
          level: 1,
          hierarchy: user.hierarchy || 1,
          division: user.division,
          department: user.department
        };
    }
  } catch (error) {
    console.error('Error getting user role:', error);
    // Fallback to staff role if there's an error
    return { label: 'staff', level: 1, hierarchy: 1, division: null, department: null };
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
 * Uses Supabase for data access
 */
const getVisibleUsers = async (managerUser) => {
  try {
    // Admin can see all users
    if (managerUser.role === 'admin') {
      const { data: users, error } = await supabase
        .from('users')
        .select('id, name, email, role, hierarchy, division, department')
        .order('hierarchy', { ascending: false })
        .order('name');

      if (error) throw error;
      return users || [];
    }

    // Managers can see users in their division with lower hierarchy
    if (managerUser.role === 'manager') {
      const { data: users, error } = await supabase
        .from('users')
        .select('id, name, email, role, hierarchy, division, department')
        .eq('division', managerUser.division)
        .lt('hierarchy', managerUser.hierarchy || 0)
        .order('hierarchy', { ascending: false })
        .order('name');

      if (error) throw error;
      return users || [];
    }

    // Staff can only see themselves
    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, email, role, hierarchy, division, department')
      .eq('id', managerUser.id);

    if (error) throw error;
    return users || [];
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
