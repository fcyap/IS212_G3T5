const projectTasksService = require('../services/projectTasksService');

class ProjectTasksController {
  /**
   * Get all tasks for a specific project
   */
  async getProjectTasks(req, res) {
    try {
      const { projectId } = req.params;
      const { status, assignedTo, priority, page, limit, sortBy, sortOrder } = req.query;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Missing project ID',
          message: 'Project ID is required'
        });
      }

      const options = {
        filters: {
          status,
          assigned_to: assignedTo,
          priority
        },
        pagination: {
          page,
          limit
        },
        sorting: {
          sortBy,
          sortOrder
        }
      };

      const result = await projectTasksService.getProjectTasks(projectId, options);

      if (result.success) {
        return res.status(200).json(result);
      } else {
        const statusCode = result.error === 'Project not found' ? 404 : 400;
        return res.status(statusCode).json(result);
      }

    } catch (error) {
      console.error('Error in getProjectTasks controller:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    }
  }

  /**
   * Get all tasks with optional filters
   */
  async getAllTasks(req, res) {
    try {
      const { status, project_id, assigned_to, priority, page, limit, sortBy, sortOrder } = req.query;

      const options = {
        filters: {
          status,
          project_id,
          assigned_to,
          priority
        },
        pagination: {
          page,
          limit
        },
        sorting: {
          sortBy,
          sortOrder
        }
      };

      const result = await projectTasksService.getAllTasks(options);

      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }

    } catch (error) {
      console.error('Error in getAllTasks controller:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    }
  }

  /**
   * Get a specific task by ID and project ID
   */
  async getTaskById(req, res) {
    try {
      const { projectId, taskId } = req.params;

      if (!projectId || !taskId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters',
          message: 'Project ID and Task ID are required'
        });
      }

      const result = await projectTasksService.getTaskById(projectId, taskId);

      if (result.success) {
        return res.status(200).json(result);
      } else {
        const statusCode = result.error === 'Task not found' || result.error === 'Project not found' ? 404 : 400;
        return res.status(statusCode).json(result);
      }

    } catch (error) {
      console.error('Error in getTaskById controller:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    }
  }

  /**
   * Create a new task for a project
   */
  async createTask(req, res) {
    try {
      const { projectId } = req.params;
      const taskData = req.body;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Missing project ID',
          message: 'Project ID is required'
        });
      }

      const result = await projectTasksService.createTask(projectId, taskData);

      if (result.success) {
        return res.status(201).json(result);
      } else {
        const statusCode = result.error === 'Project not found' ? 404 : 400;
        return res.status(statusCode).json(result);
      }

    } catch (error) {
      console.error('Error in createTask controller:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    }
  }

  /**
   * Update a task
   */
  async updateTask(req, res) {
    try {
      const { taskId } = req.params;
      const updateData = req.body;

      if (!taskId) {
        return res.status(400).json({
          success: false,
          error: 'Missing task ID',
          message: 'Task ID is required'
        });
      }

      const result = await projectTasksService.updateTask(taskId, updateData);

      if (result.success) {
        return res.status(200).json(result);
      } else {
        const statusCode = result.error === 'Task not found' ? 404 : 400;
        return res.status(statusCode).json(result);
      }

    } catch (error) {
      console.error('Error in updateTask controller:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    }
  }

  /**
   * Delete a task
   */
  async deleteTask(req, res) {
    try {
      const { taskId } = req.params;

      if (!taskId) {
        return res.status(400).json({
          success: false,
          error: 'Missing task ID',
          message: 'Task ID is required'
        });
      }

      const result = await projectTasksService.deleteTask(taskId);

      if (result.success) {
        return res.status(200).json(result);
      } else {
        const statusCode = result.error === 'Task not found' ? 404 : 400;
        return res.status(statusCode).json(result);
      }

    } catch (error) {
      console.error('Error in deleteTask controller:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    }
  }

  /**
   * Get task statistics for a project
   */
  async getTaskStats(req, res) {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Missing project ID',
          message: 'Project ID is required'
        });
      }

      const result = await projectTasksService.getTaskStats(projectId);

      if (result.success) {
        return res.status(200).json(result);
      } else {
        const statusCode = result.error === 'Project not found' ? 404 : 400;
        return res.status(statusCode).json(result);
      }

    } catch (error) {
      console.error('Error in getTaskStats controller:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    }
  }
}

module.exports = new ProjectTasksController();