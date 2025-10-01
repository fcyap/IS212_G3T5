// src/middleware/rbac.js
const { canCreateProject, canEditProject, canAddProjectMembers, canViewUserData } = require('../auth/roles');

/**
 * Middleware to check if user can create projects
 */
const requireProjectCreation = (req, res, next) => {
  const user = res.locals.session || req.user;
  
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Get user data from database to ensure we have latest role/hierarchy info
  const userData = {
    id: user.user_id || user.id,
    role: user.role || 'staff',
    hierarchy: user.hierarchy || 1,
    division: user.division
  };
  
  if (!canCreateProject(userData)) {
    return res.status(403).json({ 
      error: 'Access denied', 
      message: 'Only managers and admins can create projects' 
    });
  }
  
  next();
};

/**
 * Middleware to check if user can edit projects
 */
const requireProjectEdit = async (sql) => {
  return async (req, res, next) => {
    try {
      const user = res.locals.session || req.user;
      const projectId = req.params.projectId || req.params.id;
      
      if (!user || !projectId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      // Get project and creator info
      const projects = await sql/*sql*/`
        select p.id, p.creator_id, u.role, u.hierarchy, u.division
        from public.projects p
        left join public.users u on u.id = p.creator_id
        where p.id = ${projectId}
        limit 1
      `;
      
      if (!projects.length) {
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
        role: project.role,
        hierarchy: project.hierarchy,
        division: project.division
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
const requireAddProjectMembers = async (sql) => {
  return async (req, res, next) => {
    try {
      const user = res.locals.session || req.user;
      const projectId = req.params.projectId || req.params.id;
      
      if (!user || !projectId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      // Get project info
      const projects = await sql/*sql*/`
        select id, creator_id
        from public.projects
        where id = ${projectId}
        limit 1
      `;
      
      if (!projects.length) {
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
const filterVisibleProjects = async (sql) => {
  return async (req, res, next) => {
    try {
      const user = res.locals.session || req.user;
      
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      // Get current user's complete info
      const users = await sql/*sql*/`
        select id, role, hierarchy, division, department
        from public.users
        where id = ${user.user_id || user.id}
        limit 1
      `;
      
      if (!users.length) {
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