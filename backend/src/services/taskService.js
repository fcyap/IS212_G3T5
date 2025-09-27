const taskRepository = require('../repository/taskRepository');
const projectRepository = require('../repository/projectRepository');
const userRepository = require('../repository/userRepository');

/**
 * Task Service - Contains business logic for task operations
 * This layer orchestrates data from repositories and applies business rules
 *
 * Supports both comprehensive project management and simple kanban board operations
 */
class TaskService {

  async listWithAssignees({ archived = false } = {}) {
    try {
      const { data: tasks, error } = await taskRepository.list({ archived });
      if (error) throw error;

      const idSet = new Set();
      for (const t of tasks) {
        const ids = Array.isArray(t.assigned_to)
          ? t.assigned_to
          : t.assigned_to != null ? [t.assigned_to] : [];
        ids.map(Number).filter(Number.isFinite).forEach(n => idSet.add(n));
      }

      let usersById = {};
      if (idSet.size) {
        const { data: users, error: uerr } =
          await taskRepository.getUsersByIds(Array.from(idSet));
        if (uerr) throw uerr;
        usersById = Object.fromEntries(users.map(u => [u.id, u]));
      }

      return tasks.map(t => {
        const raw = Array.isArray(t.assigned_to)
          ? t.assigned_to
          : t.assigned_to != null ? [t.assigned_to] : [];
        const assignees = raw
          .map(Number)
          .filter((n) => usersById[n])
          .map((id) => ({ id, name: usersById[id].name }));
        return { ...t, assignees };
      });
    } catch (error) {
      return await this.getAllTasks({ archived });
    }
  }

  /**
   * Get all tasks with filters and pagination
   */
  async getAllTasks(filters = {}) {
    const tasks = await taskRepository.getTasksWithFilters(filters);
    const totalCount = await taskRepository.getTaskCount(filters);

    return {
      tasks,
      totalCount,
      pagination: this._calculatePagination(filters, totalCount)
    };
  }

  /**
   * Get tasks for a specific project
   */
  async getTasksByProject(projectId, filters = {}) {
    // Validate project exists if we have the repository method
    if (projectRepository.getProjectById) {
      await projectRepository.getProjectById(projectId);
    }

    const projectFilters = { ...filters, projectId };
    const tasks = await taskRepository.getTasksWithFilters(projectFilters);
    const totalCount = await taskRepository.getTaskCount(projectFilters);

    return {
      tasks,
      totalCount,
      pagination: this._calculatePagination(filters, totalCount)
    };
  }

  /**
   * Get task by ID
   */
  async getTaskById(taskId) {
    return await taskRepository.getTaskById(taskId);
  }

  /**
   * Create a new task - supports both comprehensive and simple approaches
   */
  async createTask(taskData, creatorId) {
    const {
      title,
      description = null,
      priority,
      status,
      deadline = null,
      team_id = null,
      project_id,
      assigned_to,
      tags
    } = taskData;

    if (!title || title.trim() === '') {
      const err = new Error("title is required");
      err.status = 400;
      throw err;
    }

    // Validate users exist if we have comprehensive validation
    if (creatorId && userRepository.getUserById) {
      await userRepository.getUserById(creatorId);
    }

    if (project_id && projectRepository.getProjectById) {
      await projectRepository.getProjectById(project_id);
    }

    if (assigned_to && assigned_to.length > 0 && userRepository.getUsersByIds) {
      await userRepository.getUsersByIds(assigned_to);
    }

    // Normalize priority and status
    const normPriority = String(priority || "medium").toLowerCase();
    const allowedStatuses = new Set(["pending", "in_progress", "completed", "blocked", "cancelled"]);
    const requested = String(status || "pending").toLowerCase();
    const normStatus = allowedStatuses.has(requested) ? requested : "pending";
    const assignees = Array.isArray(assigned_to) ? assigned_to : [];

    // Handle tags
    const tagsArr = Array.isArray(tags)
      ? tags
      : typeof tags === "string"
        ? tags.split(",")
        : [];
    const normTags = Array.from(
      new Set(
        tagsArr
          .map((t) => String(t).trim())
          .filter(Boolean)
      )
    );

    const newTaskData = {
      title: title.trim(),
      description: description?.trim() || null,
      priority: normPriority,
      status: normStatus,
      deadline: deadline || null,
      team_id: team_id || null,
      project_id: project_id || null,
      assigned_to: assignees,
      tags: normTags,
      created_at: new Date(),
      updated_at: new Date()
    };

    if (taskRepository.insert) {
      const { data, error } = await taskRepository.insert(newTaskData);
      if (error) throw error;
      return data;
    } else {
      return await taskRepository.createTask(newTaskData);
    }
  }

  /**
   * Update task - supports both approaches
   */
  async updateTask(taskId, updates, requestingUserId) {
    if (arguments.length === 2) {
      const id = taskId;
      const input = updates;

      const patch = {};
      if (input.title !== undefined) patch.title = input.title;
      if (input.description !== undefined) patch.description = input.description;
      if (input.priority !== undefined) patch.priority = String(input.priority).toLowerCase();
      if (input.status !== undefined) patch.status = input.status;
      if (input.deadline !== undefined) patch.deadline = input.deadline || null;
      if (input.archived !== undefined) patch.archived = !!input.archived;

      if (input.assigned_to !== undefined) {
        // Accept number[], string[] of numbers, or null/empty
        const arr = Array.isArray(input.assigned_to) ? input.assigned_to : [];
        const normalized = arr
          .map(v => (typeof v === 'string' ? v.trim() : v))
          .filter(v => v !== '' && v !== null && v !== undefined)
          .map(Number)
          .filter(Number.isFinite) // keep only valid numbers
          .map(n => Math.trunc(n)); // ensure integers

        patch.assigned_to = normalized; // <-- Supabase column of type int4[]
      }

      // Handle tags
      if (input.tags !== undefined) {
        const tagsArr = Array.isArray(input.tags)
          ? input.tags
          : typeof input.tags === "string"
            ? input.tags.split(",")
            : [];
        patch.tags = Array.from(
          new Set(
            tagsArr
              .map((t) => String(t).trim())
              .filter(Boolean)
          )
        );
      }

      patch.updated_at = new Date().toISOString();

      if (taskRepository.updateById) {
        const updated = await taskRepository.updateById(id, patch); 
        console.log(updated)// hydrated task
        return updated;
      } else {
        const updated = await taskRepository.updateTask(id, patch); // hydrated task
        return updated;
      }
    }

    // Comprehensive approach with permissions
    const currentTask = await taskRepository.getTaskById(taskId);

    // Check permissions if we have the method
    if (requestingUserId && this._canUserUpdateTask) {
      const canUpdate = await this._canUserUpdateTask(currentTask.project_id, requestingUserId);
      if (!canUpdate) {
        throw new Error('You do not have permission to update this task');
      }
    }

    // Validate assigned users exist (if updating assignments)
    if (updates.assigned_to && updates.assigned_to.length > 0 && userRepository.getUsersByIds) {
      await userRepository.getUsersByIds(updates.assigned_to);
    }

    const updateData = {
      ...updates,
      updated_at: new Date()
    };

    return await taskRepository.updateTask(taskId, updateData);
  }

  /**
   * Delete task
   */
  async deleteTask(taskId, requestingUserId) {
    // Get current task
    const currentTask = await taskRepository.getTaskById(taskId);

    // Check if user can delete the task (project member or manager)
    if (requestingUserId && this._canUserUpdateTask) {
      const canDelete = await this._canUserUpdateTask(currentTask.project_id, requestingUserId);
      if (!canDelete) {
        throw new Error('You do not have permission to delete this task');
      }
    }

    return await taskRepository.deleteTask(taskId);
  }

  /**
   * Get task statistics for a project
   */
  async getProjectTaskStats(projectId) {
    // Validate project exists
    if (projectRepository.getProjectById) {
      await projectRepository.getProjectById(projectId);
    }

    const tasks = await taskRepository.getTasksByProjectId(projectId);

    if (tasks.length === 0) {
      return {
        totalTasks: 0,
        pendingTasks: 0,
        inProgressTasks: 0,
        completedTasks: 0,
        cancelledTasks: 0,
        blockedTasks: 0,
        tasksByPriority: { low: 0, medium: 0, high: 0 },
        overdueTasks: 0,
        completionRate: 0
      };
    }

    const now = new Date();
    const stats = {
      totalTasks: tasks.length,
      pendingTasks: tasks.filter(t => t.status === 'pending').length,
      inProgressTasks: tasks.filter(t => t.status === 'in_progress').length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      cancelledTasks: tasks.filter(t => t.status === 'cancelled').length,
      blockedTasks: tasks.filter(t => t.status === 'blocked').length,
      tasksByPriority: {
        low: tasks.filter(t => t.priority === 'low').length,
        medium: tasks.filter(t => t.priority === 'medium').length,
        high: tasks.filter(t => t.priority === 'high').length
      },
      overdueTasks: tasks.filter(t =>
        t.deadline &&
        new Date(t.deadline) < now &&
        t.status !== 'completed'
      ).length,
      completionRate: tasks.length > 0
        ? (tasks.filter(t => t.status === 'completed').length / tasks.length * 100).toFixed(1)
        : 0
    };

    return stats;
  }

  /**
   * Private method to check if user can update task
   */
  async _canUserUpdateTask(projectId, userId) {
    try {
      if (projectRepository.canUserManageMembers) {
        return await projectRepository.canUserManageMembers(projectId, userId);
      }
      return true; // Allow by default if no permission system
    } catch (error) {
      return false;
    }
  }

  /**
   * Private method to calculate pagination
   */
  _calculatePagination(filters, totalCount) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;

    return {
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      hasNext: page * limit < totalCount,
      hasPrev: page > 1
    };
  }
}

module.exports = new TaskService();
