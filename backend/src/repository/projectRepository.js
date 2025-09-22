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
   * Get all projects from the database
   * @returns {Array} Array of projects
   */
  async findAll() {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return data;
  }

  /**
   * Find a project by ID
   * @param {number} projectId - The project ID
   * @returns {Object|null} Project data or null if not found
   */
  async findById(projectId) {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Project not found
      }
      throw new Error(`Database error: ${error.message}`);
    }

    return data;
  }

  /**
   * Update a project by ID
   * @param {number} projectId - The project ID
   * @param {Object} updateData - The data to update
   * @returns {Object|null} Updated project data or null if not found
   */
  async update(projectId, updateData) {
    const { data, error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', projectId)
      .select('*')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Project not found
      }
      throw new Error(`Database error: ${error.message}`);
    }

    return data;
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
      .from('projects')
      .select('*')
      .contains('user_ids', [userId])
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return data;
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
}

module.exports = new ProjectRepository();
