const projectRepository = require('../repository/projectRepository');

class ProjectService {
  /**
   * Create a new project
   * @param {Object} projectData - The project data
   * @param {string} projectData.name - Project name
   * @param {string} projectData.description - Project description
   * @param {Array} projectData.user_ids - Array of user IDs in the project
   * @returns {Object} Created project data or error
   */
  async createProject(projectData) {
    try {
      const { name, description, user_ids = [] } = projectData;

      // Validate required fields
      if (!name || !description) {
        throw new Error('Missing required fields: name and description are required');
      }

      // Validate user_ids is an array
      if (!Array.isArray(user_ids)) {
        throw new Error('user_ids must be an array');
      }

      // Create project object
      const project = {
        name: name.trim(),
        description: description.trim(),
        user_ids: user_ids,
        created_at: new Date().toISOString()
      };

      // Use repository to create project
      const data = await projectRepository.create(project);

      return {
        success: true,
        project: data,
        message: 'Project created successfully'
      };

    } catch (error) {
      console.error('Error creating project:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to create project'
      };
    }
  }

  /**
   * Get all projects
   * @returns {Object} Array of projects or error
   */
  async getAllProjects() {
    try {
      const data = await projectRepository.findAll();

      return {
        success: true,
        projects: data,
        count: data.length,
        message: 'Projects retrieved successfully'
      };

    } catch (error) {
      console.error('Error getting projects:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to retrieve projects'
      };
    }
  }

  /**
   * Get a project by ID
   * @param {number} projectId - The project ID
   * @returns {Object} Project data or error
   */
  async getProjectById(projectId) {
    try {
      if (!projectId) {
        throw new Error('Project ID is required');
      }

      const data = await projectRepository.findById(projectId);

      if (!data) {
        throw new Error('Project not found');
      }

      return {
        success: true,
        project: data,
        message: 'Project retrieved successfully'
      };

    } catch (error) {
      console.error('Error getting project:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to retrieve project'
      };
    }
  }

  /**
   * Update a project
   * @param {number} projectId - The project ID
   * @param {Object} updateData - The data to update
   * @returns {Object} Updated project data or error
   */
  async updateProject(projectId, updateData) {
    try {
      if (!projectId) {
        throw new Error('Project ID is required');
      }

      // Filter out undefined values
      const filteredUpdateData = Object.fromEntries(
        Object.entries(updateData).filter(([_, value]) => value !== undefined)
      );

      // Validate user_ids if provided
      if (filteredUpdateData.user_ids && !Array.isArray(filteredUpdateData.user_ids)) {
        throw new Error('user_ids must be an array');
      }

      const data = await projectRepository.update(projectId, filteredUpdateData);

      if (!data) {
        throw new Error('Project not found');
      }

      return {
        success: true,
        project: data,
        message: 'Project updated successfully'
      };

    } catch (error) {
      console.error('Error updating project:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to update project'
      };
    }
  }

  /**
   * Delete a project
   * @param {number} projectId - The project ID
   * @returns {Object} Success message or error
   */
  async deleteProject(projectId) {
    try {
      if (!projectId) {
        throw new Error('Project ID is required');
      }

      await projectRepository.delete(projectId);

      return {
        success: true,
        message: 'Project deleted successfully'
      };

    } catch (error) {
      console.error('Error deleting project:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to delete project'
      };
    }
  }

  /**
   * Add user to project
   * @param {number} projectId - The project ID
   * @param {number} userId - The user ID to add
   * @returns {Object} Updated project data or error
   */
  async addUserToProject(projectId, userId) {
    try {
      if (!projectId || !userId) {
        throw new Error('Project ID and User ID are required');
      }

      // First get the current project
      const currentProject = await this.getProjectById(projectId);
      if (!currentProject.success) {
        return currentProject;
      }

      const currentUserIds = currentProject.project.user_ids || [];

      // Check if user is already in the project
      if (currentUserIds.includes(userId)) {
        return {
          success: false,
          error: 'User is already in the project',
          message: 'User already exists in project'
        };
      }

      // Add user to the project
      const updatedUserIds = [...currentUserIds, userId];

      return await this.updateProject(projectId, { user_ids: updatedUserIds });

    } catch (error) {
      console.error('Error adding user to project:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to add user to project'
      };
    }
  }

  /**
   * Remove user from project
   * @param {number} projectId - The project ID
   * @param {number} userId - The user ID to remove
   * @returns {Object} Updated project data or error
   */
  async removeUserFromProject(projectId, userId) {
    try {
      if (!projectId || !userId) {
        throw new Error('Project ID and User ID are required');
      }

      // First get the current project
      const currentProject = await this.getProjectById(projectId);
      if (!currentProject.success) {
        return currentProject;
      }

      const currentUserIds = currentProject.project.user_ids || [];

      // Check if user is in the project
      if (!currentUserIds.includes(userId)) {
        return {
          success: false,
          error: 'User is not in the project',
          message: 'User not found in project'
        };
      }

      // Remove user from the project
      const updatedUserIds = currentUserIds.filter(id => id !== userId);

      return await this.updateProject(projectId, { user_ids: updatedUserIds });

    } catch (error) {
      console.error('Error removing user from project:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to remove user from project'
      };
    }
  }
}

module.exports = new ProjectService();
