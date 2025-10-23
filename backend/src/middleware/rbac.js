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
      const session = res.locals.session || req.user;
      const projectId = req.params.projectId || req.params.id;
      
      if (!session || !projectId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      // Get full user data from database using session user_id
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, role, hierarchy, division, department')
        .eq('id', session.user_id)
        .limit(1);
      
      if (userError) {
        console.error('Database query error (user):', userError);
        return res.status(500).json({ error: 'Database query failed' });
      }
      
      const user = users?.[0];
      if (!user) {
        console.log('User not found in database:', session.user_id);
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Get project info
      const { data: projects, error } = await supabase
        .from('projects')
        .select('id, creator_id')
        .eq('id', projectId)
        .limit(1);
      
      if (error) {
        console.error('Database query error (project):', error);
        return res.status(500).json({ error: 'Database query failed' });
      }
      
      if (!projects?.length) {
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

/**
 * Middleware to check if user can create tasks in a project
 * Users must be project members or have higher access via RBAC
 */
const requireTaskCreation = () => {
  return async (req, res, next) => {
    console.log('🔐 requireTaskCreation middleware HIT!', req.params, req.originalUrl);
    try {
      const user = res.locals.session || req.user;
      const rawProjectId = req.params.projectId ?? req.body.project_id;
      const projectId =
        rawProjectId === null || rawProjectId === undefined || rawProjectId === ''
          ? null
          : Number.isFinite(Number(rawProjectId))
            ? Number(rawProjectId)
            : rawProjectId;

      if (!user) {
        console.log('❌ No user - returning 401');
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
        console.warn('[requireTaskCreation] Project not found for id', projectId);
        return res.status(404).json({ error: 'Project not found' });
      }

      const project = projects[0];

      if (project.status && String(project.status).toLowerCase() !== 'active') {
        console.warn('[requireTaskCreation] Project is not active', {
          projectId,
          status: project.status
        });
        return res.status(404).json({ error: 'Project not found' });
      }

      const { data: projectMembers, error: membersError } = await supabase
        .from('project_members')
        .select('user_id')
        .eq('project_id', projectId);

      if (membersError) {
        console.error('[requireTaskCreation] Supabase error fetching project members', {
          projectId,
          error: membersError
        });
        return res.status(500).json({ error: 'Failed to verify project access' });
      }

      const memberIds = Array.isArray(projectMembers)
        ? projectMembers.map((row) => Number(row.user_id)).filter(Number.isFinite)
        : [];

      let projectCreator = { role: null, hierarchy: null, division: null };
      if (project.creator_id != null) {
        const { data: creatorRows, error: creatorError } = await supabase
          .from('users')
          .select('id, role, hierarchy, division')
          .eq('id', project.creator_id)
          .limit(1);
        if (creatorError) {
          console.error('[requireTaskCreation] Supabase error fetching project creator', {
            projectId,
            error: creatorError
          });
        } else if (creatorRows && creatorRows.length) {
          projectCreator = creatorRows[0];
        }
      }
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
                               projectCreator &&
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
      const numericTaskId = Number(taskId);
      const queryId = Number.isFinite(numericTaskId) ? numericTaskId : taskId;

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
      const normalizedAssigned =
        Array.isArray(task.assigned_to)
          ? task.assigned_to
              .map((value) => {
                const num = Number(value);
                return Number.isFinite(num) ? num : null;
              })
              .filter((value) => value !== null)
          : [];

      let memberIds = [];
      let projectCreator = { id: null, role: null, hierarchy: null, division: null };

      if (task.project_id != null) {
        const { data: projects, error: projectError } = await supabase
          .from('projects')
          .select('id, creator_id, status')
          .eq('id', task.project_id)
          .limit(1);

        if (projectError) {
          console.error('[requireTaskModification] Supabase error fetching project', {
            taskId,
            projectId: task.project_id,
            error: projectError
          });
          return res.status(500).json({ error: 'Internal server error' });
        }

        if (!projects || !projects.length) {
          return res.status(404).json({ error: 'Task not found' });
        }

        const project = projects[0];
        if (project.status && String(project.status).toLowerCase() !== 'active') {
          return res.status(404).json({ error: 'Task not found' });
        }

        const { data: projectMembers, error: membersError } = await supabase
          .from('project_members')
          .select('user_id')
          .eq('project_id', task.project_id);

        if (membersError) {
          console.error('[requireTaskModification] Supabase error fetching project members', {
            taskId,
            projectId: task.project_id,
            error: membersError
          });
          return res.status(500).json({ error: 'Internal server error' });
        }

        memberIds = Array.isArray(projectMembers)
          ? projectMembers.map((row) => Number(row.user_id)).filter(Number.isFinite)
          : [];

        if (project.creator_id != null) {
          const { data: creatorRows, error: creatorError } = await supabase
            .from('users')
            .select('id, role, hierarchy, division')
            .eq('id', project.creator_id)
            .limit(1);
          if (creatorError) {
            console.error('[requireTaskModification] Supabase error fetching project creator', {
              taskId,
              projectId: task.project_id,
              error: creatorError
            });
          } else if (creatorRows && creatorRows.length) {
            projectCreator = creatorRows[0];
          }
        }
      }
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

module.exports = {
  requireProjectCreation,
  requireProjectEdit,
  requireAddProjectMembers,
  filterVisibleProjects,
  requireTaskCreation,
  requireTaskModification
};
