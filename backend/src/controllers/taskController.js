const { createLoggerMiddleware } = require('../middleware/logger');
const taskService = require('../services/taskService');

/**
 * Task Controller - Handles HTTP requests and responses for tasks
 * This layer only deals with request validation and response formatting
 *
 */

const list = async (req, res) => {
  try {
    const archived = String(req.query.archived ?? 'false').toLowerCase() === 'true';
    let parentId;
    if ('parent_id' in req.query) {
      if (req.query.parent_id === 'null') parentId = null;
      else parentId = Number(req.query.parent_id);
    }

    // Get current user for RBAC filtering
    const user = res.locals.session || req.user;
    const userId = user ? (user.user_id || user.id) : null;

    const tasks = taskService.listWithAssignees
      ? await taskService.listWithAssignees({ archived, parentId, userId, userRole: user?.role, userHierarchy: user?.hierarchy, userDivision: user?.division })
      : await taskService.getAllTasks({ archived, parentId, userId, userRole: user?.role, userHierarchy: user?.hierarchy, userDivision: user?.division });

    res.json(tasks);
  } catch (e) {
    console.error('[GET /tasks]', e);
    res.status(e.status || 500).json({ error: e.message || 'Server error' });
  }
};


const create = async (req, res) => {
  try {
    const creatorId = req.user?.id ?? req.body?.creator_id ?? req.body?.creatorId ?? null;

    // Always use the old taskService for creation
    const task = await taskService.createTask({ ...req.body }, creatorId ?? null);

    // Send deadline notifications regardless of project association
    const projectTasksService = require('../services/projectTasksService');
    await projectTasksService.sendDeadlineNotifications(task);

    res.status(201).json(task);
  } catch (e) {
    console.error("[POST /tasks]", e);
    res.status(e.status || 500).json({ error: e.message || "Server error" });
  }
};

const update = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    console.log("req.body:", req.body);
    const task = await taskService.updateTask(id, req.body, req.user?.id ?? null);
    res.json(task);
  } catch (e) {
    console.error("[PUT /tasks/:id]", e);
    res.status(e.status || 500).json({ error: e.message || "Server error" });
  }
};

// Original detailed methods with comprehensive validation
const getAllTasks = async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      assignedTo: req.query.assignedTo ? parseInt(req.query.assignedTo) : undefined,
      priority: req.query.priority,
      sortBy: req.query.sortBy || 'created_at',
      sortOrder: req.query.sortOrder || 'desc',
      page: req.query.page ? parseInt(req.query.page) : 1,
      limit: req.query.limit ? parseInt(req.query.limit) : 20
    };

    if (filters.page < 1) {
      return res.status(400).json({ success: false, message: 'Page must be a positive integer' });
    }

    if (filters.limit < 1 || filters.limit > 100) {
      return res.status(400).json({ success: false, message: 'Limit must be between 1 and 100' });
    }

    // Get current user for RBAC filtering
    const user = res.locals.session || req.user;
    if (user) {
      filters.userId = user.user_id || user.id;
      filters.userRole = user.role;
      filters.userHierarchy = user.hierarchy;
      filters.userDivision = user.division;
    }

    filters.offset = (filters.page - 1) * filters.limit;
    const result = await taskService.getAllTasks(filters);

    res.json({
      success: true,
      tasks: result.tasks,
      totalTasks: result.totalCount,
      pagination: result.pagination,
      filters: {
        status: filters.status || null,
        assignedTo: filters.assignedTo || null,
        priority: filters.priority || null,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder
      }
    });
  } catch (err) {
    console.error('Error in getAllTasks:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const getTasksByProject = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!projectId || isNaN(projectId)) {
      return res.status(400).json({ success: false, message: 'Valid project ID is required' });
    }

    const filters = {
      status: req.query.status,
      assignedTo: req.query.assignedTo ? parseInt(req.query.assignedTo) : undefined,
      priority: req.query.priority,
      sortBy: req.query.sortBy || 'created_at',
      sortOrder: req.query.sortOrder || 'desc',
      page: req.query.page ? parseInt(req.query.page) : 1,
      limit: req.query.limit ? parseInt(req.query.limit) : 20
    };

    if (filters.page < 1) {
      return res.status(400).json({ success: false, message: 'Page must be a positive integer' });
    }

    if (filters.limit < 1 || filters.limit > 100) {
      return res.status(400).json({ success: false, message: 'Limit must be between 1 and 100' });
    }

    filters.offset = (filters.page - 1) * filters.limit;
    const result = await taskService.getTasksByProject(parseInt(projectId), filters);

    res.json({
      success: true,
      projectId: parseInt(projectId),
      tasks: result.tasks,
      totalTasks: result.totalCount,
      pagination: result.pagination,
      filters: {
        status: filters.status || null,
        assignedTo: filters.assignedTo || null,
        priority: filters.priority || null,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder
      }
    });
  } catch (err) {
    console.error('Error in getTasksByProject:', err);
    const statusCode = err.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({ success: false, message: err.message });
  }
};

const getTaskById = async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!taskId || isNaN(taskId)) {
      return res.status(400).json({ success: false, message: 'Valid task ID is required' });
    }

    const task = await taskService.getTaskById(parseInt(taskId));
    res.json({ success: true, task });
  } catch (err) {
    console.error('Error in getTaskById:', err);
    const statusCode = err.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({ success: false, message: err.message });
  }
};

const createTask = async (req, res) => {
  try {
    const { title, description, project_id, assigned_to, status, priority, deadline, parent_id, recurrence   } = req.body;
    const creatorId = req.user?.id || 1;

    if (!title || title.trim() === '') {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled', 'blocked'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${validStatuses.join(', ')}`
      });
    }

    const validPriorities = ['low', 'medium', 'high'];
    if (priority && !validPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: `Priority must be one of: ${validPriorities.join(', ')}`
      });
    }

    const taskData = {
      title: title.trim(),
      description: description?.trim() || '',
      project_id: project_id ? parseInt(project_id) : undefined,
      assigned_to: assigned_to || [],
      status: status || 'pending',
      priority: priority || 'medium',
      deadline: deadline || null,
      parent_id: (parent_id === null || parent_id === undefined) ? null : parseInt(parent_id),
    };

    const task = await taskService.createTask(taskData, creatorId);
    res.status(201).json({ success: true, task });
  } catch (err) {
    console.error('Error in createTask:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateTask = async (req, res) => {
  try {
    // Log the full request body for debugging
    console.log('[TaskController] Full req.body:', req.body);
    const { taskId } = req.params;
    const { title, description, assigned_to, status, priority, deadline, tags, recurrence } = req.body;
    const requestingUserId = req.user?.id || 1;

    if (!taskId || isNaN(taskId)) {
      return res.status(400).json({ success: false, message: 'Valid task ID is required' });
    }


    const updates = {};
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description.trim();
    if (deadline !== undefined) updates.deadline = deadline;
    if (assigned_to !== undefined) {
      updates.assigned_to = assigned_to;
      console.log(`[TaskController] Received update for task_id=${taskId}, assigned_to:`, assigned_to);
    }
    if (recurrence !== undefined) updates.recurrence = recurrence; // {freq, interval} or null

    if (status !== undefined) {
      const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled', 'blocked'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Status must be one of: ${validStatuses.join(', ')}`
        });
      }
      updates.status = status;
    }

    if (priority !== undefined) {
      const validPriorities = ['low', 'medium', 'high'];
      if (!validPriorities.includes(priority)) {
        return res.status(400).json({
          success: false,
          message: `Priority must be one of: ${validPriorities.join(', ')}`
        });
      }
      updates.priority = priority;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'At least one field to update is required' });
    }

    const updatedTask = await taskService.updateTask(parseInt(taskId), updates, requestingUserId);
    res.json(updatedTask);
    console.log("[taskcontroller]:", res.json(updatedTask));
  } catch (err) {
    console.error('Error in updateTask:', err);
    if (err.message.includes('permission')) {
      res.status(403).json({ success: false, message: err.message });
    } else {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

const deleteTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const requestingUserId = req.user?.id || 1;

    if (!taskId || isNaN(taskId)) {
      return res.status(400).json({ success: false, message: 'Valid task ID is required' });
    }

    await taskService.deleteTask(parseInt(taskId), requestingUserId);
    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (err) {
    console.error('Error in deleteTask:', err);
    if (err.message.includes('permission')) {
      res.status(403).json({ success: false, message: err.message });
    } else {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

const getProjectTaskStats = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!projectId || isNaN(projectId)) {
      return res.status(400).json({ success: false, message: 'Valid project ID is required' });
    }

    const stats = await taskService.getProjectTaskStats(parseInt(projectId));

    res.json({
      success: true,
      projectId: parseInt(projectId),
      stats
    });
  } catch (err) {
    console.error('Error in getProjectTaskStats:', err);
    const statusCode = err.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({ success: false, message: err.message });
  }
};

module.exports = {
  list,
  create,
  update,

  // Original comprehensive interface
  getAllTasks,
  getTasksByProject,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  getProjectTaskStats
};
