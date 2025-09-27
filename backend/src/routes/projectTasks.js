const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

// Constants for validation
const VALID_SORT_FIELDS = {
  tasks: ['id', 'title', 'status', 'priority', 'created_at', 'updated_at', 'deadline'],
  projects: ['id', 'name', 'status', 'created_at', 'updated_at', 'deadline']
};

const VALID_SORT_ORDERS = ['asc', 'desc'];
const VALID_TASK_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'];
const VALID_TASK_PRIORITIES = ['low', 'medium', 'high'];
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

const VALID_PROJECT_STATUSES = ['active', 'hold', 'completed', 'archived'];

// Input validation helpers
const validatePositiveInteger = (value, fieldName) => {
  const num = parseInt(value);
  if (isNaN(num) || num <= 0) {
    const error = new Error(`${fieldName} must be a positive integer`);
    error.statusCode = 400;
    throw error;
  }
  return num;
};

const validateSortField = (field, validFields, defaultField) => {
  if (!field) return defaultField;
  if (!validFields.includes(field)) {
    const error = new Error(`Invalid sort field. Must be one of: ${validFields.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }
  return field;
};

const validateSortOrder = (order, defaultOrder = 'desc') => {
  if (!order) return defaultOrder;
  if (!VALID_SORT_ORDERS.includes(order)) {
    const error = new Error(`Invalid sort order. Must be: ${VALID_SORT_ORDERS.join(' or ')}`);
    error.statusCode = 400;
    throw error;
  }
  return order;
};

const validatePagination = (page, limit) => {
  const validatedPage = page ? validatePositiveInteger(page, 'page') : 1;
  const validatedLimit = limit ? Math.min(validatePositiveInteger(limit, 'limit'), MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
  return { page: validatedPage, limit: validatedLimit, offset: (validatedPage - 1) * validatedLimit };
};

// Reusable project validation helper
const validateProjectExists = async (projectId) => {
  // Validate projectId format
  const validatedProjectId = validatePositiveInteger(projectId, 'projectId');

  if (supabase) {
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', validatedProjectId)
      .single();

    if (projectError) {
      if (projectError.code === 'PGRST116') {
        const error = new Error('Project not found');
        error.statusCode = 404;
        throw error;
      }
      throw projectError;
    }
    return validatedProjectId;
  } else {
    // Check if project exists in mock data
    const mockProjects = getMockProjects();
    const projectExists = mockProjects.some(p => p.id == validatedProjectId);

    if (!projectExists) {
      const error = new Error('Project not found');
      error.statusCode = 404;
      throw error;
    }
    return validatedProjectId;
  }
};

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL_LT;
const supabaseKey = process.env.SUPABASE_SECRET_KEY_LT;

let supabase = null;
if (supabaseUrl && supabaseKey && supabaseUrl !== 'your_supabase_url_here' && supabaseKey !== 'your_supabase_secret_key_here') {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.warn('Supabase credentials not configured. Using mock data.');
}

// Mock data for when Supabase is not configured
const getMockProjects = () => [
  {
    id: 1,
    name: "Project Alpha",
    description: "First project for team collaboration",
    user_ids: [1, 2],
    created_at: "2025-09-16T11:49:09.914069",
    deadline: null,
    status: "active"
  },
  {
    id: 2,
    name: "Project Beta",
    description: "Second project with tasks",
    user_ids: [2, 3, 4],
    created_at: "2025-09-16T11:49:09.914069",
    deadline: null,
    status: "active"
  }
];

const getMockTasks = (projectId = null) => [
  {
    id: 1,
    title: "Design UI",
    description: "Create wireframes for the app",
    status: "in_progress",
    project_id: 1,
    assigned_to: [1],
    created_at: "2025-09-16T11:49:09.914069",
    deadline: null,
    priority: "medium",
    updated_at: "2025-09-16T13:12:57.416204"
  },
  {
    id: 2,
    title: "Write API",
    description: "Develop backend endpoints",
    status: "pending",
    project_id: 1,
    assigned_to: [1, 2],
    created_at: "2025-09-16T11:49:09.914069",
    deadline: null,
    priority: "medium",
    updated_at: "2025-09-16T13:12:57.416204"
  }
].filter(task => projectId ? task.project_id == projectId : true);

// GET /projects/:projectId/tasks - Get all tasks for a specific project
router.get('/:projectId/tasks', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { status, assignedTo, priority, page, limit } = req.query;
    let { sortBy = 'created_at', sortOrder = 'desc' } = req.query;

    // Validate inputs
    const validatedProjectId = await validateProjectExists(projectId);
    sortBy = validateSortField(sortBy, VALID_SORT_FIELDS.tasks, 'created_at');
    sortOrder = validateSortOrder(sortOrder);
    const { page: validatedPage, limit: validatedLimit, offset } = validatePagination(page, limit);

    // Validate filters
    if (status && !VALID_TASK_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${VALID_TASK_STATUSES.join(', ')}`
      });
    }

    if (priority && !VALID_TASK_PRIORITIES.includes(priority)) {
      return res.status(400).json({
        success: false,
        error: `Invalid priority. Must be one of: ${VALID_TASK_PRIORITIES.join(', ')}`
      });
    }

    if (assignedTo) {
      validatePositiveInteger(assignedTo, 'assignedTo');
    }

    let tasks, totalCount;

    if (supabase) {
      // Build query for tasks with filtering
      let query = supabase
        .from('tasks')
        .select('*', { count: 'exact' })
        .eq('project_id', validatedProjectId);

      // Apply filters
      if (status) {
        query = query.eq('status', status);
      }

      if (assignedTo) {
        query = query.contains('assigned_to', [parseInt(assignedTo)]);
      }

      if (priority) {
        query = query.eq('priority', priority);
      }

      // Apply sorting and pagination
      query = query
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + validatedLimit - 1);

      const { data: tasksData, error, count } = await query;

      if (error) {
        throw error;
      }

      tasks = tasksData || [];
      totalCount = count || 0;
    } else {
      // Use mock data
      let allTasks = getMockTasks(validatedProjectId);

      // Apply filters
      if (status) {
        allTasks = allTasks.filter(task => task.status === status);
      }

      if (assignedTo) {
        allTasks = allTasks.filter(task => task.assigned_to && task.assigned_to.includes(parseInt(assignedTo)));
      }

      if (priority) {
        allTasks = allTasks.filter(task => task.priority === priority);
      }

      // Apply sorting
      allTasks.sort((a, b) => {
        const valueA = a[sortBy];
        const valueB = b[sortBy];

        if (sortOrder === 'asc') {
          return valueA > valueB ? 1 : -1;
        } else {
          return valueA < valueB ? 1 : -1;
        }
      });

      totalCount = allTasks.length;
      // Apply pagination
      tasks = allTasks.slice(offset, offset + validatedLimit);
    }

    res.json({
      success: true,
      projectId: validatedProjectId,
      tasks: tasks,
      totalTasks: totalCount,
      pagination: {
        page: validatedPage,
        limit: validatedLimit,
        totalPages: Math.ceil(totalCount / validatedLimit),
        hasNext: validatedPage * validatedLimit < totalCount,
        hasPrev: validatedPage > 1
      },
      filters: {
        status: status || null,
        assignedTo: assignedTo || null,
        priority: priority || null,
        sortBy,
        sortOrder
      },
      dataSource: supabase ? 'supabase' : 'mock'
    });

  } catch (error) {
    console.error('Error fetching project tasks:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: (statusCode === 404 || statusCode === 400) ? error.message : 'Failed to retrieve project tasks',
      ...(statusCode === 400 && { message: error.message })
    });
  }
});

// GET /projects/:projectId/tasks/stats - Get project task statistics
router.get('/:projectId/tasks/stats', async (req, res) => {
  try {
    const { projectId } = req.params;

    // Validate project exists
    const validatedProjectId = await validateProjectExists(projectId);

    let tasks;

    if (supabase) {
      const { data: tasksData, error } = await supabase
        .from('tasks')
        .select('status, priority, deadline, created_at')
        .eq('project_id', validatedProjectId);

      if (error) {
        throw error;
      }

      tasks = tasksData || [];
    } else {
      // Use mock data
      tasks = getMockTasks(validatedProjectId);
    }

    // Calculate comprehensive statistics
    const now = new Date();
    const overdueTasks = tasks.filter(task =>
      task.deadline && new Date(task.deadline) < now &&
      !['completed', 'cancelled'].includes(task.status)
    );

    const stats = {
      total: tasks.length,
      byStatus: {
        pending: tasks.filter(t => t.status === 'pending').length,
        inProgress: tasks.filter(t => t.status === 'in_progress').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        cancelled: tasks.filter(t => t.status === 'cancelled').length
      },
      byPriority: {
        high: tasks.filter(t => t.priority === 'high').length,
        medium: tasks.filter(t => t.priority === 'medium').length,
        low: tasks.filter(t => t.priority === 'low').length
      },
      overdue: overdueTasks.length,
      completionRate: tasks.length > 0 ?
        (tasks.filter(t => t.status === 'completed').length / tasks.length * 100).toFixed(1) : 0
    };

    res.json({
      success: true,
      projectId: validatedProjectId,
      stats: stats,
      dataSource: supabase ? 'supabase' : 'mock'
    });

  } catch (error) {
    console.error('Error fetching task statistics:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: (statusCode === 404 || statusCode === 400) ? error.message : 'Failed to retrieve task statistics',
      ...(statusCode === 400 && { message: error.message })
    });
  }
});

// GET /projects/:projectId/tasks/:taskId - Get a specific task
router.get('/:projectId/tasks/:taskId', async (req, res) => {
  try {
    const { projectId, taskId } = req.params;

    // Validate inputs
    const validatedProjectId = validatePositiveInteger(projectId, 'projectId');
    const validatedTaskId = validatePositiveInteger(taskId, 'taskId');

    let task;

    if (supabase) {
      const { data: taskData, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', validatedTaskId)
        .eq('project_id', validatedProjectId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({
            success: false,
            error: 'Task not found'
          });
        }
        throw error;
      }

      task = taskData;
    } else {
      // Use mock data
      const mockTasks = getMockTasks(validatedProjectId);
      task = mockTasks.find(t => t.id == validatedTaskId);

      if (!task) {
        return res.status(404).json({
          success: false,
          error: 'Task not found'
        });
      }

      // Add mock subtasks and comments
      task.subtasks = [];
      task.comments = [
        {
          commentId: "comment-1",
          content: "This is a sample comment for demonstration purposes.",
          createdAt: "2024-11-10T09:00:00Z",
          updatedAt: "2024-11-10T09:00:00Z",
          isEdited: false,
          user: {
            userId: "550e8400-e29b-41d4-a716-446655440010",
            firstName: "John",
            lastName: "Doe"
          }
        }
      ];
    }

    res.json({
      success: true,
      task: task,
      dataSource: supabase ? 'supabase' : 'mock'
    });

  } catch (error) {
    console.error('Error fetching task:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: (statusCode === 404 || statusCode === 400) ? error.message : 'Failed to retrieve task',
      ...(statusCode === 400 && { message: error.message })
    });
  }
});

// GET /tasks - Get all tasks
router.get('/tasks', async (req, res) => {
  try {
    const { status, project_id, assigned_to, priority, page, limit } = req.query;
    let { sortBy = 'created_at', sortOrder = 'desc' } = req.query;

    // Validate inputs
    sortBy = validateSortField(sortBy, VALID_SORT_FIELDS.tasks, 'created_at');
    sortOrder = validateSortOrder(sortOrder);
    const { page: validatedPage, limit: validatedLimit, offset } = validatePagination(page, limit);

    // Validate filters
    if (status && !VALID_TASK_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${VALID_TASK_STATUSES.join(', ')}`
      });
    }

    if (priority && !VALID_TASK_PRIORITIES.includes(priority)) {
      return res.status(400).json({
        success: false,
        error: `Invalid priority. Must be one of: ${VALID_TASK_PRIORITIES.join(', ')}`
      });
    }

    if (project_id) {
      validatePositiveInteger(project_id, 'project_id');
    }

    if (assigned_to) {
      validatePositiveInteger(assigned_to, 'assigned_to');
    }

    let tasks, totalCount;

    if (supabase) {
      // Use Supabase
      let query = supabase
        .from('tasks')
        .select('*', { count: 'exact' });

      // Apply filters
      if (status) {
        query = query.eq('status', status);
      }

      if (project_id) {
        query = query.eq('project_id', parseInt(project_id));
      }

      if (assigned_to) {
        query = query.contains('assigned_to', [parseInt(assigned_to)]);
      }

      if (priority) {
        query = query.eq('priority', priority);
      }

      // Apply sorting and pagination
      query = query
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + validatedLimit - 1);

      const { data: tasksData, error, count } = await query;

      if (error) {
        throw error;
      }

      tasks = tasksData || [];
      totalCount = count || 0;
    } else {
      // Use mock data
      let allTasks = getMockTasks();

      // Apply filters
      if (status) {
        allTasks = allTasks.filter(task => task.status === status);
      }

      if (project_id) {
        allTasks = allTasks.filter(task => task.project_id == project_id);
      }

      if (assigned_to) {
        allTasks = allTasks.filter(task => task.assigned_to && task.assigned_to.includes(parseInt(assigned_to)));
      }

      if (priority) {
        allTasks = allTasks.filter(task => task.priority === priority);
      }

      // Apply sorting
      allTasks.sort((a, b) => {
        const valueA = a[sortBy];
        const valueB = b[sortBy];

        if (sortOrder === 'asc') {
          return valueA > valueB ? 1 : -1;
        } else {
          return valueA < valueB ? 1 : -1;
        }
      });

      totalCount = allTasks.length;
      // Apply pagination
      tasks = allTasks.slice(offset, offset + validatedLimit);
    }

    res.json({
      success: true,
      tasks: tasks,
      totalTasks: totalCount,
      pagination: {
        page: validatedPage,
        limit: validatedLimit,
        totalPages: Math.ceil(totalCount / validatedLimit),
        hasNext: validatedPage * validatedLimit < totalCount,
        hasPrev: validatedPage > 1
      },
      filters: {
        status: status || null,
        project_id: project_id || null,
        assigned_to: assigned_to || null,
        priority: priority || null,
        sortBy,
        sortOrder
      },
      dataSource: supabase ? 'supabase' : 'mock'
    });

  } catch (error) {
    console.error('Error fetching tasks:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: (statusCode === 404 || statusCode === 400) ? error.message : 'Failed to retrieve tasks',
      ...(statusCode === 400 && { message: error.message })
    });
  }
});

// GET /projects - Get all projects
router.get('/projects', async (req, res) => {
  try {
    const { status, page, limit } = req.query;
    let { sortBy = 'created_at', sortOrder = 'desc' } = req.query;

    // Validate inputs
    sortBy = validateSortField(sortBy, VALID_SORT_FIELDS.projects, 'created_at');
    sortOrder = validateSortOrder(sortOrder);
    const { page: validatedPage, limit: validatedLimit, offset } = validatePagination(page, limit);

    let projects, totalCount;

    if (supabase) {
      // Use Supabase
      let query = supabase
        .from('projects')
        .select('*', { count: 'exact' });

      // Apply filters
      if (status) {
        query = query.eq('status', status);
      }

      // Apply sorting and pagination
      query = query
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + validatedLimit - 1);

      const { data: projectsData, error, count } = await query;

      if (error) {
        throw error;
      }

      projects = projectsData || [];
      totalCount = count || 0;
    } else {
      // Use mock data
      let allProjects = getMockProjects();

      // Apply filters
      if (status) {
        allProjects = allProjects.filter(project => project.status === status);
      }

      // Apply sorting
      allProjects.sort((a, b) => {
        const valueA = a[sortBy];
        const valueB = b[sortBy];

        if (sortOrder === 'asc') {
          return valueA > valueB ? 1 : -1;
        } else {
          return valueA < valueB ? 1 : -1;
        }
      });

      totalCount = allProjects.length;
      // Apply pagination
      projects = allProjects.slice(offset, offset + validatedLimit);
    }

    res.json({
      success: true,
      projects: projects,
      totalProjects: totalCount,
      pagination: {
        page: validatedPage,
        limit: validatedLimit,
        totalPages: Math.ceil(totalCount / validatedLimit),
        hasNext: validatedPage * validatedLimit < totalCount,
        hasPrev: validatedPage > 1
      },
      filters: {
        status: status || null,
        sortBy,
        sortOrder
      },
      dataSource: supabase ? 'supabase' : 'mock'
    });

  } catch (error) {
    console.error('Error fetching projects:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: (statusCode === 404 || statusCode === 400) ? error.message : 'Failed to retrieve projects',
      ...(statusCode === 400 && { message: error.message })
    });
  }
});

// PATCH /projects/:projectId/archive - Archive a project
router.patch('/projects/:projectId/archive', async (req, res) => {
  try {
    const { projectId } = req.params;

    // Validate project exists
    const validatedProjectId = await validateProjectExists(projectId);

    if (supabase) {
      const { data, error } = await supabase
        .from('projects')
        .update({ status: 'archived' })
        .eq('id', validatedProjectId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      res.json({
        success: true,
        message: 'Project archived successfully',
        project: data,
        dataSource: 'supabase'
      });
    } else {
      // Mock response for when Supabase is not configured
      const mockProjects = getMockProjects();
      const project = mockProjects.find(p => p.id == validatedProjectId);

      // Simulate archiving
      project.status = 'archived';

      res.json({
        success: true,
        message: 'Project archived successfully',
        project: project,
        dataSource: 'mock'
      });
    }

  } catch (error) {
    console.error('Error archiving project:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      error: (statusCode === 404 || statusCode === 400) ? error.message : 'Failed to archive project',
      ...(statusCode === 400 && { message: error.message })
    });
  }
});

module.exports = router;