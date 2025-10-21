// src/middleware/rbac.js
const { canCreateProject, canEditProject, canAddProjectMembers, canViewUserData } = require('../auth/roles');
const supabase = require('../utils/supabase');

/**
 * Middleware to check if user can create projects
 */
const requireProjectCreation = (req, res, next) => {
  const user = req.user; // Use req.user which has full user data from DB
  
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Get user data from database to ensure we have latest role/hierarchy info
  const userData = {
    id: user.id,
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
const requireProjectEdit = (sql) => {
  return async (req, res, next) => {
    try {
      const user = req.user; // Use req.user which has full user data from DB
      const projectId = req.params.projectId || req.params.id;

      if (!user || !projectId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Get project and creator info using Supabase
      const { data: projects, error: projectError } = await supabase
        .from('projects')
        .select(`
          id,
          creator_id,
          users!projects_creator_id_fkey(role, hierarchy, division)
        `)
        .eq('id', projectId)
        .limit(1);

      if (!projects || !projects.length) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const project = projects[0];
      const userData = {
        id: user.id,
        role: user.role || 'staff',
        hierarchy: user.hierarchy || 1,
        division: user.division
      };

      const projectCreator = project.users || {
        role: null,
        hierarchy: null,
        division: null
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
const requireAddProjectMembers = (sql) => {
  return async (req, res, next) => {
    try {
      const user = req.user; // Use req.user which has full user data from DB
      const projectId = req.params.projectId || req.params.id;

      if (!user || !projectId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Get project info using Supabase
      const { data: projects, error: projectError } = await supabase
        .from('projects')
        .select('id, creator_id')
        .eq('id', projectId)
        .limit(1);

      if (!projects || !projects.length) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const project = projects[0];
      const userData = {
        id: user.id,
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
const filterVisibleProjects = (sql) => {
  return async (req, res, next) => {
    try {
      const user = req.user; // Use req.user which has full user data from DB

      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Get current user's complete info using Supabase
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, role, hierarchy, division, department')
        .eq('id', user.id)
        .limit(1);

      if (!users || !users.length) {
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

/**
 * Middleware to check if user can create tasks in a project
 * Users must be project members or have higher access via RBAC
 */
const requireTaskCreation = (sql) => {
  return async (req, res, next) => {
    try {
      const user = req.user; // Use req.user which has full user data from DB
      const projectId = req.params.projectId || req.body.project_id;

      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // If no project specified, allow (for personal tasks)
      if (!projectId) {
        return next();
      }

      // Get project and check access using Supabase
      const { data: projects, error: projectError } = await supabase
        .from('projects')
        .select(`
          id,
          creator_id,
          user_ids,
          users!projects_creator_id_fkey(role, hierarchy, division)
        `)
        .eq('id', projectId)
        .limit(1);

      if (!projects || !projects.length) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const project = projects[0];
      const userData = {
        id: user.id,
        role: user.role || 'staff',
        hierarchy: user.hierarchy || 1,
        division: user.division
      };

      // Admin can create tasks anywhere
      if (userData.role === 'admin') {
        return next();
      }

      // Check if user is project member
      const isProjectMember = project.user_ids && project.user_ids.includes(userData.id);

      // Check if user is project creator
      const isCreator = userData.id === project.creator_id;

      // Managers can create tasks in projects from their division with lower hierarchy
      const projectCreator = project.users || {
        role: null,
        hierarchy: null,
        division: null
      };

      const hasManagerAccess = userData.role === 'manager' &&
                               userData.division === projectCreator.division &&
                               (userData.hierarchy || 0) > (projectCreator.hierarchy || 0);

      if (isProjectMember || isCreator || hasManagerAccess) {
        return next();
      }

      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have permission to create tasks in this project'
      });
    } catch (error) {
      console.error('Error in requireTaskCreation middleware:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
};

/**
 * Middleware to check if user can modify/delete tasks
 * Task creators, project members with appropriate access, and managers can modify
 */
const requireTaskModification = (sql) => {
  return async (req, res, next) => {
    try {
      const user = req.user; // Use req.user which has full user data from DB
      const taskId = req.params.id || req.params.taskId;

      if (!user || !taskId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Get task and associated project using Supabase
      const { data: tasks, error: taskError } = await supabase
        .from('tasks')
        .select(`
          id,
          project_id,
          assigned_to,
          projects!tasks_project_id_fkey(
            creator_id,
            user_ids,
            users!projects_creator_id_fkey(role, hierarchy, division)
          )
        `)
        .eq('id', taskId)
        .limit(1);

      if (!tasks || !tasks.length) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const task = tasks[0];
      const userData = {
        id: user.id,
        role: user.role || 'staff',
        hierarchy: user.hierarchy || 1,
        division: user.division
      };

      // Admin can modify anything
      if (userData.role === 'admin') {
        return next();
      }

      // Check if user is assigned to the task
      const isAssigned = task.assigned_to && task.assigned_to.includes(userData.id);

      // Check if user is project member
      const isProjectMember = task.projects?.user_ids && task.projects.user_ids.includes(userData.id);

      // Check if user is project creator
      const isProjectCreator = userData.id === task.projects?.creator_id;

      // Managers can modify tasks in projects from their division
      const projectCreator = task.projects?.users || {
        role: null,
        hierarchy: null,
        division: null
      };

      const hasManagerAccess = userData.role === 'manager' &&
                               task.project_id && // Only for project tasks
                               userData.division === projectCreator.division &&
                               (userData.hierarchy || 0) > (projectCreator.hierarchy || 0);

      if (isAssigned || isProjectMember || isProjectCreator || hasManagerAccess) {
        return next();
      }

      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have permission to modify this task'
      });
    } catch (error) {
      console.error('Error in requireTaskModification middleware:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
};

/**
 * Middleware to require specific role(s)
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    const user = req.user; // Use req.user which has full user data from DB

    console.log('[requireRole] User object:', user);
    console.log('[requireRole] Allowed roles:', allowedRoles);

    if (!user) {
      console.log('[requireRole] No user found');
      return res.status(401).json({ 
        error: 'Unauthorized: Authentication required' 
      });
    }

    if (!user.role) {
      console.log('[requireRole] User has no role');
      return res.status(403).json({ 
        error: 'Forbidden: Insufficient permissions' 
      });
    }

    console.log('[requireRole] User role:', user.role);

    if (!allowedRoles.includes(user.role)) {
      console.log('[requireRole] Role not in allowed list');
      return res.status(403).json({ 
        error: 'Forbidden: Insufficient permissions' 
      });
    }

    console.log('[requireRole] Access granted');
    next();
  };
};

/**
 * Helper function to filter departments by hierarchy
 */
const filterByDepartmentHierarchy = (parentDepartment, departments) => {
  return departments.filter(dept => {
    return dept === parentDepartment || dept.startsWith(parentDepartment + '.');
  });
};

/**
 * Middleware to check department access
 */
const checkDepartmentAccess = () => {
  return (req, res, next) => {
    const user = req.user; // Use req.user which has full user data from DB

    if (!user) {
      return res.status(401).json({ 
        error: 'Unauthorized: Authentication required' 
      });
    }

    // Admin can access all departments
    if (user.role === 'admin') {
      return next();
    }

    const requestedDepartments = req.body.departments || [];
    
    if (requestedDepartments.length > 0) {
      // Check if all requested departments are within user's hierarchy
      const allowedDepartments = filterByDepartmentHierarchy(user.department, requestedDepartments);
      
      if (allowedDepartments.length !== requestedDepartments.length) {
        return res.status(403).json({ 
          error: 'Forbidden: Cannot access data from other departments' 
        });
      }
    }

    next();
  };
};

module.exports = {
  requireProjectCreation,
  requireProjectEdit,
  requireAddProjectMembers,
  filterVisibleProjects,
  requireTaskCreation,
  requireTaskModification,
  requireRole,
  checkDepartmentAccess,
  filterByDepartmentHierarchy
};