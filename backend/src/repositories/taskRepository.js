const supabase = require('../utils/supabase');

/**
 * Task Repository - Handles all database operations for tasks
 * This layer only deals with CRUD operations and database queries
 *
 * Supports both comprehensive project management and simple kanban board operations
 */
class TaskRepository {

  async list({ archived = false } = {}) {
    return supabase
      .from("tasks")
      .select("*")
      .eq("archived", archived)
      .order("created_at", { ascending: true });
  }

  async insert(payload) {
    return supabase.from("tasks").insert(payload).select().single();
  }

  async updateById(id, patch) {
    if (patch.assigned_to !== undefined) {
      console.log(`[TaskRepository] (updateById) Updating assignees for task_id=${id}:`, patch.assigned_to);
      console.log('[TaskRepository] assigned_to type:', typeof patch.assigned_to, Array.isArray(patch.assigned_to) ? 'array' : 'not array');
    }
    const { data, error } = await supabase
      .from('tasks')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    // hydrate
    const ids = Array.isArray(data.assigned_to) ? data.assigned_to.filter(Boolean) : [];
    let assignees = [];
    if (ids.length) {
      const { data: users, error: uerr } = await supabase
        .from('users')
        .select('id, name')
        .in('id', ids);
      if (uerr) throw new Error(uerr.message);
      const map = new Map(users.map(u => [u.id, u]));
      assignees = ids.map(id => map.get(id)).filter(Boolean);
    }
    return { ...data, assignees }; // return the task object (hydrated)
  }

  async getUsersByIds(ids) {
    if (!ids?.length) return { data: [], error: null };
    return supabase.from("users").select("id, name").in("id", ids);
  }

  /**
   * Get all tasks
   */
  async getAllTasks() {
    const { data, error } = await supabase
      .from('tasks')
      .select('*');

    if (error) {
      throw new Error(error.message);
    }

    return data || [];
  }

  /**
   * Get tasks by project ID
   */
  async getTasksByProjectId(projectId) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', projectId);

    if (error) {
      throw new Error(error.message);
    }

    return data || [];
  }

  /**
   * Get task by ID
   */
  async getTaskById(taskId) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Create a new task
   */
  async createTask(taskData) {
    const { data, error } = await supabase
      .from('tasks')
      .insert([taskData])
      .select();

    if (error) {
      throw new Error(error.message);
    }

    return data[0];
  }

  /**
   * Update task
   */
  async updateTask(taskId, updates) {
    if (updates.assigned_to !== undefined) {
      console.log(`[TaskRepository] Updating assignees for task_id=${taskId}:`, updates.assigned_to);
    }
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    // hydrate
    const ids = Array.isArray(data.assigned_to) ? data.assigned_to.filter(Boolean) : [];
    let assignees = [];
    if (ids.length) {
      const { data: users, error: uerr } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', ids);
      if (uerr) throw new Error(uerr.message);
      const map = new Map(users.map(u => [u.id, u]));
      assignees = ids.map(id => map.get(id)).filter(Boolean);
    }
    return { ...data, assignees }; // return the task object (hydrated)
  }

  /**
   * Delete task
   */
  async deleteTask(taskId) {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) {
      throw new Error(error.message);
    }

    return true;
  }

  /**
   * Get tasks with filters and pagination
   */
  async getTasksWithFilters(filters = {}) {
    let query = supabase.from('tasks').select('*');

    // Apply filters
    if (filters.projectId) {
      query = query.eq('project_id', filters.projectId);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.assignedTo) {
      query = query.contains('assigned_to', [filters.assignedTo]);
    }

    if (filters.priority) {
      query = query.eq('priority', filters.priority);
    }

    if (filters.archived !== undefined) {
      query = query.eq('archived', filters.archived);
    }

    // Apply sorting
    if (filters.sortBy && filters.sortOrder) {
      query = query.order(filters.sortBy, { ascending: filters.sortOrder === 'asc' });
    }

    // Apply pagination
    if (filters.offset !== undefined && filters.limit) {
      query = query.range(filters.offset, filters.offset +  filters.limit - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return data || [];
  }

  /**
   * Get task count with filters
   */
  async getTaskCount(filters = {}) {
    let query = supabase.from('tasks').select('*', { count: 'exact', head: true });

    if (filters.projectId) {
      query = query.eq('project_id', filters.projectId);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.assignedTo) {
      query = query.contains('assigned_to', [filters.assignedTo]);
    }

    if (filters.priority) {
      query = query.eq('priority', filters.priority);
    }

    if (filters.archived !== undefined) {
      query = query.eq('archived', filters.archived);
    }

    const { count, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return count || 0;
  }
}

module.exports = new TaskRepository();
