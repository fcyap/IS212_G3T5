const projectRepository = require('../repositories/projectRepository');
const userRepository = require('../repositories/userRepository');

/**
 * Project Service - Contains business logic for project operations
 * This layer orchestrates data from repositories and applies business rules
 */
class ProjectService {

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
}

module.exports = new ProjectService();
