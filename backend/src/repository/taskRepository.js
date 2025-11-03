const supabase = require('../utils/supabase');

/**
 * Task Repository - Handles all database operations for tasks
 * This layer only deals with CRUD operations and database queries
 *
 * Supports both comprehensive project management and simple kanban board operations
 */
class TaskRepository {

  async list({ archived = false, parentId } = {}) {
    let q = supabase
      .from('tasks')
      .select('*')
      .eq('archived', archived);

    if (parentId === null) {
      q = q.is('parent_id', null);          // root tasks only
    } else if (parentId !== undefined) {
      q = q.eq('parent_id', parentId);      // subtasks of a given parent
    }

    return q.order('created_at', { ascending: true });
  }

  async insert(payload) {
    const { data, error } = await supabase
      .from("tasks")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    // Return hydrated task (with assignees objects)
    return await this._hydrateAssigneesRow(data, 'id, name, email');
  }

  // Hydrate a task row with full assignee objects
  async _hydrateAssigneesRow(row, fields = 'id, name, email') {
    const ids = Array.isArray(row.assigned_to) ? row.assigned_to.filter(Boolean) : [];
    if (!ids.length) return { ...row, assignees: [] };

    const { data: users, error: uerr } = await supabase
      .from('users')
      .select(fields)
      .in('id', ids);
    if (uerr) throw new Error(uerr.message);

    const map = new Map(users.map(u => [u.id, u]));
    const assignees = ids.map(id => map.get(id)).filter(Boolean);
    return { ...row, assignees };
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

    // Default to excluding archived tasks unless explicitly requested
    const archivedFilter = filters.archived !== undefined ? filters.archived : false;
    query = query.eq('archived', archivedFilter);

    // Apply sorting
    if (filters.sortBy && filters.sortOrder) {
      query = query.order(filters.sortBy, { ascending: filters.sortOrder === 'asc' });
    }

    // Apply pagination
    if (filters.offset !== undefined && filters.limit) {
      query = query.range(filters.offset, filters.offset + filters.limit - 1);
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

    // Default to excluding archived tasks unless explicitly requested
    const archivedFilter = filters.archived !== undefined ? filters.archived : false;
    query = query.eq('archived', archivedFilter);

    const { count, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return count || 0;
  }
    // Get all direct subtasks for a task
  async getSubtasks(parentId) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('parent_id', parentId)
      .eq('archived', false)
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  }

  // Insert many (returns inserted rows)
  async insertMany(payloads) {
    if (!Array.isArray(payloads) || payloads.length === 0) return [];
    const { data, error } = await supabase
      .from('tasks')
      .insert(payloads)
      .select();
    if (error) throw new Error(error.message);
    return data;
  }

}

module.exports = new TaskRepository();
