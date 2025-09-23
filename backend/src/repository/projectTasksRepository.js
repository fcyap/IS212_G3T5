const supabase = require('../utils/supabase');

class ProjectTasksRepository {
  /**
   * Create a new task in the database
   * @param {Object} taskData - The task data to insert
   * @returns {Object} Database result
   */
  async create(taskData) {
    const { data, error } = await supabase
      .from('tasks')
      .insert([taskData])
      .select('*')
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return data;
  }

  /**
   * Get all tasks from the database with optional filters
   * @param {Object} filters - Filter options
   * @param {Object} pagination - Pagination options
   * @param {Object} sorting - Sorting options
   * @returns {Object} Tasks data with count
   */
  async findAll(filters = {}, pagination = {}, sorting = {}) {
    let query = supabase
      .from('tasks')
      .select('*', { count: 'exact' });

    // Apply filters
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.project_id) {
      query = query.eq('project_id', filters.project_id);
    }
    if (filters.assigned_to) {
      query = query.contains('assigned_to', [parseInt(filters.assigned_to)]);
    }
    if (filters.priority) {
      query = query.eq('priority', filters.priority);
    }

    // Apply sorting
    const { sortBy = 'created_at', sortOrder = 'desc' } = sorting;
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    if (pagination.offset !== undefined && pagination.limit) {
      query = query.range(pagination.offset, pagination.offset + pagination.limit - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return { data: data || [], count: count || 0 };
  }

  /**
   * Find tasks by project ID
   * @param {number} projectId - The project ID
   * @param {Object} filters - Filter options
   * @param {Object} pagination - Pagination options
   * @param {Object} sorting - Sorting options
   * @returns {Object} Tasks data with count
   */
  async findByProjectId(projectId, filters = {}, pagination = {}, sorting = {}) {
    return await this.findAll({ ...filters, project_id: projectId }, pagination, sorting);
  }

  /**
   * Find a task by ID and project ID
   * @param {number} taskId - The task ID
   * @param {number} projectId - The project ID
   * @returns {Object|null} Task data or null if not found
   */
  async findByIdAndProjectId(taskId, projectId) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .eq('project_id', projectId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Task not found
      }
      throw new Error(`Database error: ${error.message}`);
    }

    return data;
  }

  /**
   * Find a task by ID
   * @param {number} taskId - The task ID
   * @returns {Object|null} Task data or null if not found
   */
  async findById(taskId) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Task not found
      }
      throw new Error(`Database error: ${error.message}`);
    }

    return data;
  }

  /**
   * Update a task by ID
   * @param {number} taskId - The task ID
   * @param {Object} updateData - The data to update
   * @returns {Object|null} Updated task data or null if not found
   */
  async update(taskId, updateData) {
    const { data, error } = await supabase
      .from('tasks')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', taskId)
      .select('*')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Task not found
      }
      throw new Error(`Database error: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete a task by ID
   * @param {number} taskId - The task ID
   * @returns {boolean} True if deleted
   */
  async delete(taskId) {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return true;
  }

  /**
   * Get task statistics for a project
   * @param {number} projectId - The project ID
   * @returns {Array} Array of tasks for statistics
   */
  async getTaskStats(projectId) {
    const { data, error } = await supabase
      .from('tasks')
      .select('status, priority, deadline, created_at')
      .eq('project_id', projectId);

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Archive all tasks for a project
   * @param {number} projectId - The project ID
   * @returns {boolean} True if archived
   */
  async archiveTasksByProjectId(projectId) {
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('project_id', projectId)
      .neq('status', 'completed');

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return true;
  }

  /**
   * Check if a task exists by ID
   * @param {number} taskId - The task ID
   * @returns {boolean} True if exists, false otherwise
   */
  async exists(taskId) {
    const { data, error } = await supabase
      .from('tasks')
      .select('id')
      .eq('id', taskId)
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

module.exports = new ProjectTasksRepository();