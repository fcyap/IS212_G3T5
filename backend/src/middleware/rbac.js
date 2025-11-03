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

      // Sanitize user-controlled values to prevent log injection
      const sanitize = (str) => String(str || '').replace(/[\n\r]/g, '');

      console.log('[requireProjectEdit] User:', user?.id, 'ProjectId:', sanitize(projectId), 'Params:', req.params);

      if (!user || !projectId) {
        console.log('[requireProjectEdit] Missing user or projectId, returning 401');
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Get project and creator info using Supabase - simplified query without foreign key
      console.log('[requireProjectEdit] Querying project with ID:', sanitize(projectId));
      const { data: projects, error: projectError } = await supabase
        .from('projects')
        .select('id, creator_id, name, status')
        .eq('id', projectId)
        .limit(1);

      console.log('[requireProjectEdit] Query result - projects:', projects?.length, 'error:', projectError);

      if (!projects || !projects.length) {
        console.log('[requireProjectEdit] Project not found, returning 404');
        return res.status(404).json({ error: 'Project not found' });
      }

      const project = projects[0];

      // Get creator info separately
      const { data: creator, error: creatorError } = await supabase
        .from('users')
        .select('id, role, hierarchy, division')
        .eq('id', project.creator_id)
        .single();

      const userData = {
        id: user.id,
        role: user.role || 'staff',
        hierarchy: user.hierarchy || 1,
        division: user.division
      };

      const projectCreator = creator || {
        role: null,
        hierarchy: null,
        division: null
      };

      console.log('[requireProjectEdit] Checking canEditProject...');
      if (!canEditProject(userData, project, projectCreator)) {
        console.log('[requireProjectEdit] Access denied');
        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have permission to edit this project'
        });
      }

      console.log('[requireProjectEdit] Access granted, calling next()');
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
const requireTaskCreation = () => {
  return async (req, res, next) => {
    try {
      const user = res.locals.session || req.user;
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
        .select('id, creator_id')
        .eq('id', projectId)
        .limit(1);

      if (projectError) {
        console.error('Database query error:', projectError);
        return res.status(500).json({ error: 'Database query failed' });
      }

      if (!projects || !projects.length) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const project = projects[0];
      const userData = {
        id: user.user_id || user.id,
        role: user.role || 'staff',
        hierarchy: user.hierarchy || 1,
        division: user.division
      };

      // Admin can create tasks anywhere
      if (userData.role === 'admin') {
        return next();
      }

      // Check if user is project creator
      const isCreator = userData.id === project.creator_id;

      // Check if user is project member - need to query project_members table
      const { data: memberData } = await supabase
        .from('project_members')
        .select('user_id')
        .eq('project_id', projectId)
        .eq('user_id', userData.id)
        .limit(1);

      const isProjectMember = memberData && memberData.length > 0;

      // Managers can create tasks in projects from their division with lower hierarchy
      // Get project creator's data separately
      const { data: creatorData } = await supabase
        .from('users')
        .select('role, hierarchy, division')
        .eq('id', project.creator_id)
        .single();

      const projectCreator = creatorData || {
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
const requireTaskModification = () => {
  return async (req, res, next) => {
    try {
      const user = res.locals.session || req.user;
      const taskId = req.params.id || req.params.taskId;

      if (!user || !taskId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Get task and associated project using Supabase
      const { data: tasks, error: taskError } = await supabase
        .from('tasks')
        .select('id, project_id, assigned_to')
        .eq('id', taskId)
        .limit(1);

      if (taskError) {
        console.error('Database query error:', taskError);
        return res.status(500).json({ error: 'Database query failed' });
      }

      if (!tasks || !tasks.length) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const task = tasks[0];
      const userData = {
        id: user.user_id || user.id,
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

      // Get project data if this is a project task
      let isProjectCreator = false;
      let isProjectMember = false;
      let hasManagerAccess = false;

      if (task.project_id) {
        // Get project data
        const { data: projectData } = await supabase
          .from('projects')
          .select('creator_id')
          .eq('id', task.project_id)
          .single();

        if (projectData) {
          // Check if user is project creator
          isProjectCreator = userData.id === projectData.creator_id;

          // Check if user is project member
          const { data: memberData } = await supabase
            .from('project_members')
            .select('user_id')
            .eq('project_id', task.project_id)
            .eq('user_id', userData.id)
            .limit(1);

          isProjectMember = memberData && memberData.length > 0;

          // Check manager access
          if (userData.role === 'manager') {
            const { data: creatorData } = await supabase
              .from('users')
              .select('role, hierarchy, division')
              .eq('id', projectData.creator_id)
              .single();

            if (creatorData) {
              hasManagerAccess = userData.division === creatorData.division &&
                (userData.hierarchy || 0) > (creatorData.hierarchy || 0);
            }
          }
        }
      }

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
 * Middleware to check if user has one of the required roles
 * @param {string[]} requiredRoles - Array of roles that are allowed (e.g., ['hr', 'admin'])
 */
const requireRole = (requiredRoles) => {
  return (req, res, next) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    if (!user.role || !requiredRoles.includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    next();
  };
};

/**
 * Middleware to check if user has access to requested departments
 */
const checkDepartmentAccess = () => {
  return (req, res, next) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    // Admin has access to all departments
    if (user.role === 'admin') {
      return next();
    }

    // HR can access their own department and subdepartments
    if (user.role === 'hr') {
      const requestedDepts = req.body?.departments || [];
      
      // Check if all requested departments are accessible to this HR
      const hasAccess = requestedDepts.every(dept => {
        // Can access own department or subdepartments
        return dept === user.department || dept.startsWith(user.department + '.');
      });

      if (!hasAccess) {
        return res.status(403).json({
          error: 'Forbidden: Cannot access data from other departments'
        });
      }

      return next();
    }

    // Other roles don't have department access for reports
    return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
  };
};

/**
 * Filter departments by hierarchy - returns the parent department and all subdepartments
 * @param {string} parentDept - Parent department name
 * @param {Array<string>} departments - Array of all department names
 * @returns {Array<string>} Filtered array of matching departments
 */
function filterByDepartmentHierarchy(parentDept, departments) {
  return departments.filter(dept => {
    // Exact match
    if (dept === parentDept) return true;
    // Subdepartment match (starts with parent + ".")
    if (dept.startsWith(parentDept + '.')) return true;
    return false;
  });
}

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