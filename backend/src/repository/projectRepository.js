const supabase = require('../utils/supabase');

class ProjectRepository {
  /**
   * Create a new project in the database
   * @param {Object} projectData - The project data to insert
   * @returns {Object} Database result
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
   * Get all projects from the database with their members
   * @returns {Array} Array of projects with user_ids populated from project_members
   */
  async findAll() {
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
      throw new Error(`Database error: ${error.message}`);
    }

    // Transform the data to include user_ids array for backward compatibility
    const transformedData = data.map(project => ({
      ...project,
      user_ids: project.project_members ? project.project_members.map(member => member.user_id) : []
    }));

    return transformedData;
  }

  /**
   * Find a project by ID with its members
   * @param {number} projectId - The project ID
   * @returns {Object|null} Project data with user_ids or null if not found
   */
  async findById(projectId) {
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
      if (error.code === 'PGRST116') {
        return null; // Project not found
      }
      throw new Error(`Database error: ${error.message}`);
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
      if (error.code === 'PGRST116') {
        return null; // Project not found
      }
      throw new Error(`Database error: ${error.message}`);
    }

    // Transform the data to include user_ids array for backward compatibility
    const transformedData = {
      ...data,
      user_ids: data.project_members ? data.project_members.map(member => member.user_id) : []
    };

    return transformedData;
  }

  /**
   * Delete a project by ID
   * @param {number} projectId - The project ID
   * @returns {boolean} True if deleted, false if not found
   */
  async delete(projectId) {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return true;
  }

  /**
   * Find projects by user ID (projects where user is a member)
   * @param {number} userId - The user ID
   * @returns {Array} Array of projects
   */
  async findByUserId(userId) {
    const { data, error } = await supabase
      .from('project_members')
      .select(`
        projects (
          *,
          project_members (
            user_id,
            member_role
          )
        )
      `)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    // Transform the data to include user_ids array for backward compatibility
    const transformedData = data.map(item => ({
      ...item.projects,
      user_ids: item.projects.project_members ? item.projects.project_members.map(member => member.user_id) : []
    }));

    return transformedData;
  }

  /**
   * Check if a project exists by ID
   * @param {number} projectId - The project ID
   * @returns {boolean} True if exists, false otherwise
   */
  async exists(projectId) {
    const { data, error } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return false;
      }
      throw new Error(`Database error: ${error.message}`);
    }

    return !!data;
  }

  /**
   * Add a user to a project
   * @param {number} projectId - The project ID
   * @param {number} userId - The user ID to add
   * @returns {Object} The created project member
   */
  async addUserToProject(projectId, userId) {
    const { data, error } = await supabase
      .from('project_members')
      .insert([{
        project_id: projectId,
        user_id: userId,
        member_role: 'collaborator'
      }])
      .select('*')
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return data;
  }

  /**
   * Remove a user from a project
   * @param {number} projectId - The project ID
   * @param {number} userId - The user ID to remove
   * @returns {boolean} True if removed successfully
   */
  async removeUserFromProject(projectId, userId) {
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return true;
  }
}

module.exports = new ProjectRepository();
