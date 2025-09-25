const projectRepository = require('../repository/projectRepository');
const supabase = require('../utils/supabase');
const userRepository = require('../repository/userRepository');

/**
 * Project Service - Contains business logic for project operations
 * This layer orchestrates data from repositories and applies business rules
 */
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
      const { name, description, user_ids = [], creator_id } = projectData;

      // Validate required fields
      if (!name || !description) {
        throw new Error('Missing required fields: name and description are required');
      }

      // Validate user_ids is an array
      if (!Array.isArray(user_ids)) {
        throw new Error('user_ids must be an array');
      }

      // Validate creator_id
      if (!creator_id) {
        throw new Error('creator_id is required');
      }

      // Create project object with proper timestamp formatting
      const project = {
        name: name.trim(),
        description: description.trim(),
        creator_id: creator_id,
        status: 'active',
        updated_at: new Date().toISOString()
      };

      // Use repository to create project
      const data = await projectRepository.create(project);

      // Add project members to project_members table
      if (user_ids.length > 0) {
        await this.addProjectMembers(data.id, user_ids, creator_id);
      }

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
   * Add project members to project_members table
   * @param {number} projectId - The project ID
   * @param {Array} userIds - Array of user IDs to add
   * @param {number} creatorId - The creator ID (gets 'creator' role)
   */
  async addProjectMembers(projectId, userIds, creatorId) {
    try {
      // Ensure creator is included in the member list with creator role
      const uniqueUserIds = [...new Set(userIds)];
      if (!uniqueUserIds.includes(creatorId)) {
        uniqueUserIds.push(creatorId);
      }

      const membersToAdd = uniqueUserIds.map(userId => ({
        project_id: projectId,
        user_id: userId,
        member_role: userId === creatorId ? 'creator' : 'collaborator'
      }));

      const { error } = await supabase
        .from('project_members')
        .insert(membersToAdd);

      if (error) {
        throw new Error(`Failed to add project members: ${error.message}`);
      }
    } catch (error) {
      console.error('Error adding project members:', error);
      throw error;
    }
  }

  /**
   * Get all projects for a user (creator or member)
   */
  async getAllProjectsForUser(userId) {
    // Get user to validate they exist
    const user = await userRepository.getUserById(userId);

    // Get project IDs where user is a member
    const memberProjectIds = await projectRepository.getProjectIdsForUser(userId);

    // Get project IDs where user is creator
    const creatorProjectIds = await projectRepository.getProjectIdsByCreator(userId);

    // Combine and deduplicate project IDs
    const allProjectIds = [...new Set([...memberProjectIds, ...creatorProjectIds])];

    // Get project details for these IDs
    const userProjects = await projectRepository.getProjectsByIds(allProjectIds);

    // Enhance projects with additional data
    const enhancedProjects = await Promise.all(userProjects.map(async (project) => {
      try {
        // Get task count
        const taskCount = await projectRepository.getTaskCountByProject(project.id);

        // Get collaborator details including creator
        const members = await projectRepository.getProjectMembersWithDetails(project.id);
        const collaborators = members.map(member => member.users.name).join(', ');

        return {
          ...project,
          task_count: taskCount,
          collaborators: collaborators || ''
        };
      } catch (error) {
        console.error(`Error enhancing project ${project.id}:`, error);
        return {
          ...project,
          task_count: 0,
          collaborators: ''
        };
      }
    }));

    return enhancedProjects;
  }

  /**
   * Get project by ID
   */
  async getProjectById(projectId) {
    return await projectRepository.getProjectById(projectId);
  }

  /**
   * Update a project by ID
   * @param {number} projectId - The project ID
   * @param {Object} updateData - The data to update
   * @returns {Object} Updated project data or error
   */
  async updateProject(projectId, updateData) {
    try {
      if (!projectId) {
        throw new Error('Project ID is required');
      }

      // Extract user_ids from updateData as it needs special handling
      const { user_ids, ...projectUpdateData } = updateData;

      // Filter out undefined values from project data
      const filteredUpdateData = Object.fromEntries(
        Object.entries(projectUpdateData).filter(([_, value]) => value !== undefined)
      );

      // Update project basic info
      const data = await projectRepository.update(projectId, filteredUpdateData);

      if (!data) {
        throw new Error('Project not found');
      }

      // Handle user_ids update if provided (update project_members table)
      if (user_ids !== undefined && Array.isArray(user_ids)) {
        // Remove all current members
        await supabase
          .from('project_members')
          .delete()
          .eq('project_id', projectId);

        // Add new members
        if (user_ids.length > 0) {
          const membersToAdd = user_ids.map(userId => ({
            project_id: projectId,
            user_id: userId,
            member_role: 'collaborator' // Default role for updated members
          }));

          const { error } = await supabase
            .from('project_members')
            .insert(membersToAdd);

          if (error) {
            throw new Error(`Failed to update project members: ${error.message}`);
          }
        }

        // Fetch updated project with new members
        const updatedData = await projectRepository.findById(projectId);
        return {
          success: true,
          project: updatedData,
          message: 'Project updated successfully'
        };
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

      // Check if user is already in the project
      const { data: existingMember, error: checkError } = await supabase
        .from('project_members')
        .select('user_id')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw new Error(`Database error: ${checkError.message}`);
      }

      if (existingMember) {
        return {
          success: false,
          error: 'User is already in the project',
          message: 'User already exists in project'
        };
      }

      // Add user to project_members table
      await projectRepository.addUserToProject(projectId, userId);

      // Return updated project data
      return await this.getProjectById(projectId);

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
   * Get project members with roles
   */
  async getProjectMembers(projectId) {
    // Clean up any orphaned member records first
    await projectRepository.cleanupOrphanedMembers(projectId);

    const members = await projectRepository.getProjectMembersWithDetails(projectId);

    // Format the response
    return members.map(member => ({
      user_id: member.user_id,
      email: member.users?.email || '',
      name: member.users?.name || 'Unknown User',
      role: member.member_role,
      joined_at: member.added_at
    }));
  }

  /**
   * Add users to project
   */
  async addUsersToProject(projectId, newUserIds, requestingUserId, message, role = 'collaborator') {
    // Check permissions
    const hasPermission = await projectRepository.canUserManageMembers(projectId, requestingUserId);
    if (!hasPermission) {
      throw new Error('Only managers and creators can add members to the project');
    }

    // Add each user with specified role
    const addedMembers = [];
    for (const userId of newUserIds) {
      try {
        // Check if user is already a member
        const existingMembers = await projectRepository.getProjectMembersWithDetails(projectId);
        const isAlreadyMember = existingMembers.some(member => member.user_id === userId);

        if (isAlreadyMember) {
          console.log(`User ${userId} is already a member of project ${projectId}`);
          continue;
        }

        const addedMember = await projectRepository.addUserToProject(projectId, userId, role);
        addedMembers.push(addedMember);
      } catch (error) {
        console.error(`Error adding user ${userId} to project ${projectId}:`, error);
        throw error;
      }
    }

    // Return updated project
    return await projectRepository.getProjectById(projectId);
  }

  /**
   * Remove user from project
   */
  async removeUserFromProject(projectId, userIdToRemove, requestingUserId) {
    return await projectRepository.removeUserFromProject(projectId, userIdToRemove, requestingUserId);
  }

  /**
   * Remove user from project
   * @param {number} projectId - The project ID
   * @param {number} userId - The user ID to remove
   * @returns {Object} Updated project data or error
   */
  async removeUserFromProjectLegacy(projectId, userId) {
    try {
      if (!projectId || !userId) {
        throw new Error('Project ID and User ID are required');
      }

      // Check if user is in the project
      const { data: existingMember, error: checkError } = await supabase
        .from('project_members')
        .select('user_id')
        .eq('project_id', projectId)
        .eq('user_id', userId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw new Error(`Database error: ${checkError.message}`);
      }

      if (!existingMember) {
        return {
          success: false,
          error: 'User is not in the project',
          message: 'User not found in project'
        };
      }

      // Remove user from project_members table
      await projectRepository.removeUserFromProject(projectId, userId);

      // Return updated project data
      return await this.getProjectById(projectId);

    } catch (error) {
      console.error('Error removing user from project:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to remove user from project'
      };
    }
  }

  /**
   * Archive project and all its tasks
   */
  async archiveProject(projectId, requestingUserId) {
    // Check permissions - only managers and creators can archive projects
    const hasPermission = await projectRepository.canUserManageMembers(projectId, requestingUserId);
    if (!hasPermission) {
      throw new Error('Only managers and creators can archive the project');
    }

    // Ensure project exists
    await projectRepository.getProjectById(projectId);

    // Archive the project and its tasks
    return await projectRepository.archiveProject(projectId);
  }
}

module.exports = new ProjectService();
