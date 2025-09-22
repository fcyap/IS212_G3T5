const projectService = require('../services/projectService');

class ProjectController {
  /**
   * Create a new project
   */
  async createProject(req, res) {
    try {
      const { name, description, user_ids } = req.body;

      // Validate request body
      if (!name || !description) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          message: 'Name and description are required'
        });
      }

      // Validate user_ids if provided
      if (user_ids && !Array.isArray(user_ids)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid user_ids format',
          message: 'user_ids must be an array of integers'
        });
      }

      const projectData = {
        name,
        description,
        user_ids: user_ids || []
      };

      const result = await projectService.createProject(projectData);

      if (result.success) {
        return res.status(201).json(result);
      } else {
        return res.status(400).json(result);
      }

    } catch (error) {
      console.error('Error in createProject controller:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    }
  }

  /**
   * Get all projects
   */
  async getAllProjects(req, res) {
    try {
      const result = await projectService.getAllProjects();

      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }

    } catch (error) {
      console.error('Error in getAllProjects controller:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    }
  }

  /**
   * Get a project by ID
   */
  async getProjectById(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Missing project ID',
          message: 'Project ID is required'
        });
      }

      const result = await projectService.getProjectById(id);

      if (result.success) {
        return res.status(200).json(result);
      } else {
        const statusCode = result.error === 'Project not found' ? 404 : 400;
        return res.status(statusCode).json(result);
      }

    } catch (error) {
      console.error('Error in getProjectById controller:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    }
  }

  /**
   * Update a project
   */
  async updateProject(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Missing project ID',
          message: 'Project ID is required'
        });
      }

      const result = await projectService.updateProject(id, updateData);

      if (result.success) {
        return res.status(200).json(result);
      } else {
        const statusCode = result.error === 'Project not found' ? 404 : 400;
        return res.status(statusCode).json(result);
      }

    } catch (error) {
      console.error('Error in updateProject controller:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    }
  }

  /**
   * Delete a project
   */
  async deleteProject(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Missing project ID',
          message: 'Project ID is required'
        });
      }

      const result = await projectService.deleteProject(id);

      if (result.success) {
        return res.status(200).json(result);
      } else {
        return res.status(400).json(result);
      }

    } catch (error) {
      console.error('Error in deleteProject controller:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    }
  }

  /**
   * Add user to project
   */
  async addUserToProject(req, res) {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      if (!id || !userId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          message: 'Project ID and user ID are required'
        });
      }

      // Validate userId is a number
      const userIdNum = parseInt(userId);
      if (isNaN(userIdNum)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid user ID',
          message: 'User ID must be a valid integer'
        });
      }

      const result = await projectService.addUserToProject(id, userIdNum);

      if (result.success) {
        return res.status(200).json(result);
      } else {
        const statusCode = result.error === 'Project not found' ? 404 : 400;
        return res.status(statusCode).json(result);
      }

    } catch (error) {
      console.error('Error in addUserToProject controller:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    }
  }

  /**
   * Remove user from project
   */
  async removeUserFromProject(req, res) {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      if (!id || !userId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          message: 'Project ID and user ID are required'
        });
      }

      // Validate userId is a number
      const userIdNum = parseInt(userId);
      if (isNaN(userIdNum)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid user ID',
          message: 'User ID must be a valid integer'
        });
      }

      const result = await projectService.removeUserFromProject(id, userIdNum);

      if (result.success) {
        return res.status(200).json(result);
      } else {
        const statusCode = result.error === 'Project not found' ? 404 : 400;
        return res.status(statusCode).json(result);
      }

    } catch (error) {
      console.error('Error in removeUserFromProject controller:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    }
  }
}

module.exports = new ProjectController();
