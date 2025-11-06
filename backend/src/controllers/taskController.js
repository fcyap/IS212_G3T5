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

    const userDepartment = user?.department;
    const tasks = taskService.listWithAssignees
      ? await taskService.listWithAssignees({
          archived,
          parentId,
          userId,
          userRole: user?.role,
          userHierarchy: user?.hierarchy,
          userDivision: user?.division,
          userDepartment,
        })
      : await taskService.getAllTasks({
          archived,
          parentId,
          userId,
          userRole: user?.role,
          userHierarchy: user?.hierarchy,
          userDivision: user?.division,
          userDepartment,
        });

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
    
    // Determine deadline type for notifications
    if (task.deadline) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const deadlineDate = new Date(task.deadline);
      deadlineDate.setHours(0, 0, 0, 0);
      
      const isToday = deadlineDate.getTime() === today.getTime();
      const isTomorrow = deadlineDate.getTime() === tomorrow.getTime();
      
      // Only check for today and tomorrow since past deadlines are now blocked
      const deadlineType = isToday ? 'today' : isTomorrow ? 'tomorrow' : null;
      
      if (deadlineType) {
        await projectTasksService.sendDeadlineNotifications(task, deadlineType);
      }
    }

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
    const task = await taskService.updateTask(id, req.body, req.user?.id ?? null);
    res.json(task);
  } catch (e) {
    console.error("[PUT /tasks/:id]", e);
    const status = e.status || e.httpCode || 500;
    if (status === 400 || status === 403) {
      res.status(status).json({ message: e.message });
    } else {
      res.status(status).json({ error: e.message || "Server error" });
    }
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
      filters.userDepartment = user.department;
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

    // Validate and normalize priority (supports both legacy string values and numeric 1-10)
    const PRIORITY_MIN = 1;
    const PRIORITY_MAX = 10;
    const DEFAULT_PRIORITY = 5;
    const LEGACY_PRIORITY_MAP = { low: 1, medium: 5, high: 10 };

    let normalizedPriority = DEFAULT_PRIORITY;
    if (priority !== undefined && priority !== null && priority !== '') {
      const value = typeof priority === 'string' ? priority.trim().toLowerCase() : priority;

      if (typeof value === 'string') {
        if (LEGACY_PRIORITY_MAP[value] !== undefined) {
          normalizedPriority = LEGACY_PRIORITY_MAP[value];
        } else {
          const parsed = Number(value);
          if (!Number.isFinite(parsed)) {
            return res.status(400).json({
              success: false,
              message: `Priority must be an integer between ${PRIORITY_MIN} and ${PRIORITY_MAX}`
            });
          }
          normalizedPriority = Math.trunc(parsed);
        }
      } else {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) {
          return res.status(400).json({
            success: false,
            message: `Priority must be an integer between ${PRIORITY_MIN} and ${PRIORITY_MAX}`
          });
        }
        normalizedPriority = Math.trunc(numeric);
      }

      if (normalizedPriority < PRIORITY_MIN || normalizedPriority > PRIORITY_MAX) {
        return res.status(400).json({
          success: false,
          message: `Priority must be an integer between ${PRIORITY_MIN} and ${PRIORITY_MAX}`
        });
      }
    }

    const taskData = {
      title: title.trim(),
      description: description?.trim() || '',
      project_id: project_id ? parseInt(project_id) : undefined,
      assigned_to: assigned_to || [],
      status: status || 'pending',
      priority: normalizedPriority,
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
      // Validate and normalize priority (supports both legacy string values and numeric 1-10)
      const PRIORITY_MIN = 1;
      const PRIORITY_MAX = 10;
      const LEGACY_PRIORITY_MAP = { low: 1, medium: 5, high: 10 };

      let normalizedPriority;
      if (priority === null || priority === '') {
        normalizedPriority = null;
      } else {
        const value = typeof priority === 'string' ? priority.trim().toLowerCase() : priority;

        if (typeof value === 'string') {
          if (LEGACY_PRIORITY_MAP[value] !== undefined) {
            normalizedPriority = LEGACY_PRIORITY_MAP[value];
          } else {
            const parsed = Number(value);
            if (!Number.isFinite(parsed)) {
              return res.status(400).json({
                success: false,
                message: `Priority must be an integer between ${PRIORITY_MIN} and ${PRIORITY_MAX}`
              });
            }
            normalizedPriority = Math.trunc(parsed);
          }
        } else {
          const numeric = Number(value);
          if (!Number.isFinite(numeric)) {
            return res.status(400).json({
              success: false,
              message: `Priority must be an integer between ${PRIORITY_MIN} and ${PRIORITY_MAX}`
            });
          }
          normalizedPriority = Math.trunc(numeric);
        }

        if (normalizedPriority < PRIORITY_MIN || normalizedPriority > PRIORITY_MAX) {
          return res.status(400).json({
            success: false,
            message: `Priority must be an integer between ${PRIORITY_MIN} and ${PRIORITY_MAX}`
          });
        }
      }

      updates.priority = normalizedPriority;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'At least one field to update is required' });
    }

    const updatedTask = await taskService.updateTask(parseInt(taskId), updates, requestingUserId);
    res.json(updatedTask);
    console.log("[taskcontroller]:", res.json(updatedTask));
  } catch (err) {
    console.error('Error in updateTask:', err);
    const statusCode = err.status
      || (err.message && err.message.includes('permission') ? 403 : 500);
    res.status(statusCode).json({ success: false, message: err.message });
  }
};

const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    const requestingUserId = req.user?.id || 1;

    if (!id || isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Valid task ID is required' });
    }

    await taskService.deleteTask(parseInt(id), requestingUserId);
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

const getSubtasks = async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!taskId || isNaN(taskId)) {
      return res.status(400).json({ success: false, message: 'Valid task ID is required' });
    }

    const subtasks = await taskService.getSubtasks(parseInt(taskId));

    res.json({
      success: true,
      subtasks
    });
  } catch (err) {
    console.error('Error in getSubtasks:', err);
    res.status(500).json({ success: false, message: err.message });
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
  getProjectTaskStats,
  getSubtasks
};
