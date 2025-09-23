<<<<<<< HEAD
const taskService = require('../services/taskService');

/**
 * Task Controller - Handles HTTP requests and responses for tasks
 * This layer only deals with request validation and response formatting
 */

const getAllTasks = async (req, res) => {
  try {
    // Input validation and query parameter parsing
    const filters = {
      status: req.query.status,
      assignedTo: req.query.assignedTo ? parseInt(req.query.assignedTo) : undefined,
      priority: req.query.priority,
      sortBy: req.query.sortBy || 'created_at',
      sortOrder: req.query.sortOrder || 'desc',
      page: req.query.page ? parseInt(req.query.page) : 1,
      limit: req.query.limit ? parseInt(req.query.limit) : 20
    };

    // Validate page and limit
    if (filters.page < 1) {
      return res.status(400).json({ success: false, message: 'Page must be a positive integer' });
    }
    
    if (filters.limit < 1 || filters.limit > 100) {
      return res.status(400).json({ success: false, message: 'Limit must be between 1 and 100' });
    }

    // Calculate offset for pagination
    filters.offset = (filters.page - 1) * filters.limit;

    // Call service layer
    const result = await taskService.getAllTasks(filters);
    
    // Format response
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
    // Input validation
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

    // Validate page and limit
    if (filters.page < 1) {
      return res.status(400).json({ success: false, message: 'Page must be a positive integer' });
    }
    
    if (filters.limit < 1 || filters.limit > 100) {
      return res.status(400).json({ success: false, message: 'Limit must be between 1 and 100' });
    }

    // Calculate offset for pagination
    filters.offset = (filters.page - 1) * filters.limit;

    // Call service layer
    const result = await taskService.getTasksByProject(parseInt(projectId), filters);
    
    // Format response
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
    // Input validation
    const { taskId } = req.params;
    
    if (!taskId || isNaN(taskId)) {
      return res.status(400).json({ success: false, message: 'Valid task ID is required' });
    }

    // Call service layer
    const task = await taskService.getTaskById(parseInt(taskId));
    
    // Format response
    res.json({ success: true, task });
  } catch (err) {
    console.error('Error in getTaskById:', err);
    const statusCode = err.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({ success: false, message: err.message });
  }
};

const createTask = async (req, res) => {
  try {
    // Input validation
    const { title, description, project_id, assigned_to, status, priority, deadline } = req.body;
    const creatorId = req.user?.id || 1;

    if (!title || title.trim() === '') {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }

    if (!project_id || isNaN(project_id)) {
      return res.status(400).json({ success: false, message: 'Valid project ID is required' });
    }

    if (!creatorId) {
      return res.status(400).json({ success: false, message: 'Creator ID is required' });
    }

    // Validate assigned_to array if provided
    let validAssignedTo = [];
    if (assigned_to && Array.isArray(assigned_to)) {
      validAssignedTo = assigned_to.map(id => {
        const numId = parseInt(id);
        if (isNaN(numId)) {
          throw new Error('All assigned user IDs must be valid numbers');
        }
        return numId;
      });
    }

    // Validate status if provided
    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Status must be one of: ${validStatuses.join(', ')}` 
      });
    }

    // Validate priority if provided
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
      project_id: parseInt(project_id),
      assigned_to: validAssignedTo,
      status: status || 'pending',
      priority: priority || 'medium',
      deadline: deadline || null
    };

    // Call service layer
    const task = await taskService.createTask(taskData, creatorId);
    
    // Format response
    res.status(201).json({ success: true, task });
  } catch (err) {
    console.error('Error in createTask:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateTask = async (req, res) => {
  try {
    // Input validation
    const { taskId } = req.params;
    const { title, description, assigned_to, status, priority, deadline } = req.body;
    const requestingUserId = req.user?.id || 1;

    if (!taskId || isNaN(taskId)) {
      return res.status(400).json({ success: false, message: 'Valid task ID is required' });
    }

    if (!requestingUserId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    const updates = {};
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description.trim();
    if (deadline !== undefined) updates.deadline = deadline;

    // Validate assigned_to array if provided
    if (assigned_to !== undefined) {
      if (Array.isArray(assigned_to)) {
        updates.assigned_to = assigned_to.map(id => {
          const numId = parseInt(id);
          if (isNaN(numId)) {
            throw new Error('All assigned user IDs must be valid numbers');
          }
          return numId;
        });
      } else {
        return res.status(400).json({ success: false, message: 'assigned_to must be an array' });
      }
    }

    // Validate status if provided
    if (status !== undefined) {
      const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ 
          success: false, 
          message: `Status must be one of: ${validStatuses.join(', ')}` 
        });
      }
      updates.status = status;
    }

    // Validate priority if provided
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

    // Call service layer
    const updatedTask = await taskService.updateTask(parseInt(taskId), updates, requestingUserId);
    
    // Format response
    res.json({ success: true, task: updatedTask });
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
    // Input validation
    const { taskId } = req.params;
    const requestingUserId = req.user?.id || 1;

    if (!taskId || isNaN(taskId)) {
      return res.status(400).json({ success: false, message: 'Valid task ID is required' });
    }

    if (!requestingUserId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    // Call service layer
    await taskService.deleteTask(parseInt(taskId), requestingUserId);
    
    // Format response
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
    // Input validation
    const { projectId } = req.params;
    
    if (!projectId || isNaN(projectId)) {
      return res.status(400).json({ success: false, message: 'Valid project ID is required' });
    }

    // Call service layer
    const stats = await taskService.getProjectTaskStats(parseInt(projectId));
    
    // Format response
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
  getAllTasks,
  getTasksByProject,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  getProjectTaskStats
};
=======
const taskServiceModule = require("../services/taskService");
const taskService = taskServiceModule.default || taskServiceModule; 

class TaskController {
  // GET /tasks
  async list(req, res) {
    try {
      const archived =
        String(req.query.archived ?? "false").toLowerCase() === "true";
      const tasks = await taskService.listWithAssignees({ archived });
      res.json(tasks);
    } catch (e) {
      console.error("[GET /tasks]", e);
      res.status(e.status || 500).json({ error: e.message || "Server error" });
    }
  }


  // POST /tasks
  async create(req, res) {
    try {
      const task = await taskService.createTask(req.body);
      res.status(201).json(task);
    } catch (e) {
      console.error("[POST /tasks]", e);
      res.status(e.status || 500).json({ error: e.message || "Server error" });
    }
  }

  // PUT /tasks/:id
  async update(req, res) {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ error: "Invalid id" });
      }
      const task = await taskService.updateTask(id, req.body);
      res.json(task);
    } catch (e) {
      console.error("[PUT /tasks/:id]", e);
      res.status(e.status || 500).json({ error: e.message || "Server error" });
    }
  }
}

module.exports = new TaskController();
// module.exports.TaskController = TaskController;
>>>>>>> origin/michelle
