// src/middleware/rbac.js
const { canCreateProject, canEditProject, canAddProjectMembers, canViewUserData } = require('../auth/roles');
const { supabase } = require('../supabase-client');

/**
 * Middleware to check if user can create projects
 */
const requireProjectCreation = async (req, res, next) => {
  const session = res.locals.session || req.user;
  
  console.log('requireProjectCreation middleware - session:', session);
  
  if (!session) {
    console.log('No session found');
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    // Get full user data from database using session user_id
    const { data: users, error } = await supabase
      .from('users')
      .select('id, role, hierarchy, division, department')
      .eq('id', session.user_id)
      .limit(1);
    
    if (error) {
      console.error('Database query error:', error);
      return res.status(500).json({ error: 'Database query failed' });
    }
    
    const user = users?.[0];
    if (!user) {
      console.log('User not found in database:', session.user_id);
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log('requireProjectCreation - user from database:', user);
    
    // Build user data for RBAC check
    const userData = {
      id: user.id,
      role: user.role || 'staff',
      hierarchy: user.hierarchy || 1,
      division: user.division
    };
    
    console.log('requireProjectCreation - userData for RBAC:', userData);
    
    if (!canCreateProject(userData)) {
      console.log('canCreateProject returned false for user:', userData);
      return res.status(403).json({ 
        error: 'Access denied', 
        message: 'Only managers can create projects' 
      });
    }
    
    console.log('canCreateProject passed, proceeding to next()');
    next();
  } catch (error) {
    console.error('Error in requireProjectCreation:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Middleware to check if user can edit projects
 */
const requireProjectEdit = () => {
  return async (req, res, next) => {
    try {
      const user = res.locals.session || req.user;
      const projectId = req.params.projectId || req.params.id;
      
      if (!user || !projectId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      // Get project and creator info
      const { data: projects, error } = await supabase
        .from('projects')
        .select(`
          id, 
          creator_id,
          users!inner (role, hierarchy, division)
        `)
        .eq('id', projectId)
        .limit(1);
      
      if (error) {
        console.error('Database query error:', error);
        return res.status(500).json({ error: 'Database query failed' });
      }
      
      if (!projects?.length) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const project = projects[0];
      const userData = {
        id: user.user_id || user.id,
        role: user.role || 'staff',
        hierarchy: user.hierarchy || 1,
        division: user.division
      };
      
      const projectCreator = {
        role: project.users.role,
        hierarchy: project.users.hierarchy,
        division: project.users.division
      };
      
      if (!canEditProject(userData, project, projectCreator)) {
        return res.status(403).json({ 
          error: 'Access denied', 
          message: 'You do not have permission to edit this project' 
        });
      }
      
      next();
    } catch (error) {
      console.error('Error in requireProjectEdit middleware:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
};

/**
 * Middleware to check if user can add members to projects
 */
const requireAddProjectMembers = () => {
  return async (req, res, next) => {
    try {
      const user = res.locals.session || req.user;
      const projectId = req.params.projectId || req.params.id;
      
      if (!user || !projectId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      // Get project info
      const { data: projects, error } = await supabase
        .from('projects')
        .select('id, creator_id')
        .eq('id', projectId)
        .limit(1);
      
      if (error) {
        console.error('Database query error:', error);
        return res.status(500).json({ error: 'Database query failed' });
      }
      
      if (!projects?.length) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const project = projects[0];
      const userData = {
        id: user.user_id || user.id,
        role: user.role || 'staff',
        hierarchy: user.hierarchy || 1,
        division: user.division
      };
      
      if (!canAddProjectMembers(userData, project)) {
        return res.status(403).json({ 
          error: 'Access denied', 
          message: 'You do not have permission to add members to this project' 
        });
      }
      
      next();
    } catch (error) {
      console.error('Error in requireAddProjectMembers middleware:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
};

/**
 * Middleware to filter projects based on user hierarchy and division
 */
const filterVisibleProjects = () => {
  return async (req, res, next) => {
    try {
      const user = res.locals.session || req.user;
      
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      // Get current user's complete info
      const { data: users, error } = await supabase
        .from('users')
        .select('id, role, hierarchy, division, department')
        .eq('id', user.user_id || user.id)
        .limit(1);
      
      if (error) {
        console.error('Database query error:', error);
        return res.status(500).json({ error: 'Database query failed' });
      }
      
      if (!users?.length) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const currentUser = users[0];
      
      // Admin can see all projects
      if (currentUser.role === 'admin') {
        req.visibilityFilter = {}; // No filter
        return next();
      }
      
      // Managers can see projects from users in their division with lower hierarchy
      if (currentUser.role === 'manager') {
        req.visibilityFilter = {
          currentUser,
          canViewAll: false
        };
        return next();
      }
      
      // Staff can only see their own projects and projects they're members of
      req.visibilityFilter = {
        currentUser,
        canViewAll: false,
        onlyOwnProjects: true
      };
      
      next();
    } catch (error) {
      console.error('Error in filterVisibleProjects middleware:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
};

module.exports = {
  requireProjectCreation,
  requireProjectEdit,
  requireAddProjectMembers,
  filterVisibleProjects
};