const supabase = require('../utils/supabase');

/**
 * Project Repository - Handles all database operations for projects
 * This layer only deals with CRUD operations and database queries
 * NOTE: Only read operations and member management - no project creation/deletion
 */
class ProjectRepository {

  /**
   * Get all projects from database
   */
  async getAllProjects() {
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('*');

    if (projectsError) {
      throw new Error(projectsError.message);
    }

    return projects || [];
  }

  /**
   * Get all projects from the database with their members
   * @returns {Array} Array of projects with user_ids populated from project_members
   */
  async getAllProjectsWithMembers() {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        project_members (
          user_id,
          member_role
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    // Transform the data to include user_ids array for backward compatibility
    const transformedData = data.map(project => ({
      ...project,
      user_ids: project.project_members ? project.project_members.map(member => member.user_id) : []
    }));

    return transformedData;
  }

  /**
   * Get project IDs for a user (projects they are a member of)
   */
  async getProjectIdsForUser(userId) {
    const { data, error } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('user_id', userId);

    if (error) {
      throw new Error(error.message);
    }

    return data ? data.map(item => item.project_id) : [];
  }

  /**
   * Get project IDs where user is creator (has 'creator' role in project_members)
   */
  async getProjectIdsByCreator(userId) {
    const { data, error } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('user_id', userId)
      .eq('member_role', 'creator');

    if (error) {
      throw new Error(error.message);
    }

    return data ? data.map(item => item.project_id) : [];
  }

  /**
   * Get projects by IDs
   */
  async getProjectsByIds(projectIds) {
    if (!projectIds || projectIds.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .in('id', projectIds);

    if (error) {
      throw new Error(error.message);
    }

    return data || [];
  }

  /**
   * Get project by ID
   */
  async getProjectById(projectId) {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        project_members (
          user_id,
          member_role
        )
      `)
      .eq('id', projectId)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    // Transform the data to include user_ids array for backward compatibility
    const transformedData = {
      ...data,
      user_ids: data.project_members ? data.project_members.map(member => member.user_id) : []
    };

    return transformedData;
  }

  /**
   * Update a project by ID
   * @param {number} projectId - The project ID
   * @param {Object} updateData - The data to update
   * @returns {Object|null} Updated project data with members or null if not found
   */
  async update(projectId, updateData) {
    // Add updated_at timestamp
    const dataToUpdate = {
      ...updateData,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('projects')
      .update(dataToUpdate)
      .eq('id', projectId)
      .select(`
        *,
        project_members (
          user_id,
          member_role
        )
      `)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    // Transform the data to include user_ids array for backward compatibility
    const transformedData = {
      ...data,
      user_ids: data.project_members ? data.project_members.map(member => member.user_id) : []
    };

    return transformedData;
  }

  /**
   * Update project
   */
  async updateProject(projectId, updates) {
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId)
      .select();

    if (error) {
      throw new Error(error.message);
    }

    return data[0];
  }

  /**
   * Get project members data
   */
  async getProjectMembers(projectId) {
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('id, created_at')
      .eq('id', projectId)
      .neq('status', 'completed')
      .single();

    if (projectError) {
      throw new Error(projectError.message);
    }

    return projectData;
  }

  /**
   * Get multiple users by IDs
   */
  async getUsersByIds(userIds) {
    if (!userIds || userIds.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, role')
      .in('id', userIds);

    if (error) {
      throw new Error(error.message);
    }

    return data || [];
  }

  /**
   * Get task count for a project
   */
  async getTaskCountByProject(projectId) {
    const { count, error } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId);

    if (error) {
      console.error('Error fetching task count:', error);
      return 0;
    }

    return count || 0;
  }

  /**
   * Check if user can manage members (has 'creator' or 'manager' role in project)
   */
  async canUserManageMembers(projectId, userId) {
    // Check if user has 'creator' or 'manager' role in project_members
    const { data: memberData, error } = await supabase
      .from('project_members')
      .select('member_role')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single();

    if (error) {
      return false; // User is not a member or error occurred
    }

    return memberData.member_role === 'creator' || memberData.member_role === 'manager';
  }

  /**
   * Remove user from project
   */
  async removeUserFromProject(projectId, userIdToRemove, requestingUserId) {
    // Check permissions
    const hasPermission = await this.canUserManageMembers(projectId, requestingUserId);
    if (!hasPermission) {
      throw new Error('Only managers and creators can remove members from the project');
    }

    // Get current project
    const project = await this.getProjectById(projectId);

    // Check if user to remove has 'creator' role
    const { data: memberData, error: memberError } = await supabase
      .from('project_members')
      .select('member_role')
      .eq('project_id', projectId)
      .eq('user_id', userIdToRemove)
      .single();

    if (memberError || !memberData) {
      throw new Error('User is not a member of this project');
    }

    // Cannot remove creator
    if (memberData.member_role === 'creator') {
      throw new Error('Cannot remove the project creator');
    }

    // Cannot remove yourself if you're not a manager or creator
    if (requestingUserId === userIdToRemove && memberData.member_role !== 'creator' && memberData.member_role !== 'manager') {
      throw new Error('You cannot remove yourself from the project');
    }

    // Remove user from project_members table
    const { error: deleteError } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userIdToRemove);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    return project;
  }

  /**
   * Add user to project
   */
  async addUserToProject(projectId, userId, memberRole = 'collaborator') {
    const { data, error } = await supabase
      .from('project_members')
      .insert([{
        project_id: projectId,
        user_id: userId,
        member_role: memberRole,
        added_at: new Date()
      }])
      .select();

    if (error) {
      throw new Error(error.message);
    }

    return data[0];
  }

  /**
   * Get project members with details
   */
  async getProjectMembersWithDetails(projectId) {
    const { data, error } = await supabase
      .from('project_members')
      .select(`
        user_id,
        member_role,
        added_at,
        users!inner(id, email, name)
      `)
      .eq('project_id', projectId)
      .not('users', 'is', null); // Ensure user record exists

    if (error) {
      throw new Error(error.message);
    }

    // Filter out any records where users is null (additional safety)
    const validMembers = (data || []).filter(member => member.users && member.users.id);

    return validMembers;
  }

  /**
   * Clean up orphaned member records (members whose users no longer exist)
   */
  async cleanupOrphanedMembers(projectId) {
    // First get all member records for this project
    const { data: allMembers, error: membersError } = await supabase
      .from('project_members')
      .select('user_id')
      .eq('project_id', projectId);

    if (membersError) {
      throw new Error(membersError.message);
    }

    // Get all valid user IDs
    const { data: validUsers, error: usersError } = await supabase
      .from('users')
      .select('id');

    if (usersError) {
      throw new Error(usersError.message);
    }

    const validUserIds = validUsers.map(user => user.id);
    const orphanedUserIds = allMembers
      .map(member => member.user_id)
      .filter(userId => !validUserIds.includes(userId));

    // Remove orphaned records
    if (orphanedUserIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('project_members')
        .delete()
        .eq('project_id', projectId)
        .in('user_id', orphanedUserIds);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      console.log(`Cleaned up ${orphanedUserIds.length} orphaned member records for project ${projectId}`);
    }

    return orphanedUserIds.length;
  }

  /**
   * Archive project and all its tasks
   */
  async archiveProject(projectId) {
    // Update project status to archived
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .update({ status: 'archived' })
      .eq('id', projectId)
      .select();

    if (projectError) {
      throw new Error(projectError.message);
    }

    // Update all tasks in the project to archived = true
    const { error: tasksError } = await supabase
      .from('tasks')
      .update({ archived: true })
      .eq('project_id', projectId);

    if (tasksError) {
      throw new Error(tasksError.message);
    }

    return projectData[0];
  }

  /**
   * Create a new project
   * @param {Object} projectData - The project data to create
   * @returns {Object} The created project data
   */
  async create(projectData) {
    const { data, error } = await supabase
      .from('projects')
      .insert([projectData])
      .select('*')
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return data;
  }

  /**
   * Find a project by ID with members (alias for getProjectById)
   * @param {number} projectId - The project ID
   * @returns {Object|null} Project data with members or null if not found
   */
  async findById(projectId) {
    return await this.getProjectById(projectId);
  }

  /**
   * Delete a project and all its members
   * @param {number} projectId - The project ID
   * @returns {boolean} True if deleted successfully
   */
  async delete(projectId) {
    // First delete all project members
    const { error: membersError } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId);

    if (membersError) {
      throw new Error(`Failed to delete project members: ${membersError.message}`);
    }

    // Then delete the project
    const { error: projectError } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (projectError) {
      throw new Error(`Failed to delete project: ${projectError.message}`);
    }

    return true;
  }

}

module.exports = new ProjectRepository();
