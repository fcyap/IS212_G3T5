const taskRepository = require('../repository/taskRepository');
const projectRepository = require('../repository/projectRepository');
const userRepository = require('../repository/userRepository');
const notificationService = require('./notificationService');

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
      project_id,
      assigned_to,
      tags,
    } = taskData;

    if (!title || title.trim() === '') {
      const err = new Error("title is required");
      err.status = 400;
      throw err;
    }

    // Validate users exist if we have comprehensive validation
    const normalizedCreator = creatorId != null ? Number(creatorId) : null;
    const validCreatorId = Number.isFinite(normalizedCreator) ? Math.trunc(normalizedCreator) : null;

    if (validCreatorId != null && userRepository.getUserById) {
      await userRepository.getUserById(validCreatorId);
    }

    if (project_id && projectRepository.getProjectById) {
      await projectRepository.getProjectById(project_id);
    }

    // Normalize priority and status
    const normPriority = String(priority || "medium").toLowerCase();
    const allowedStatuses = new Set(["pending", "in_progress", "completed", "blocked", "cancelled"]);
    const requested = String(status || "pending").toLowerCase();
    const normStatus = allowedStatuses.has(requested) ? requested : "pending";
    const normalizedAssignees = Array.isArray(assigned_to) ? assigned_to : [];
    const assignees = normalizedAssignees
      .map((value) => (typeof value === 'string' ? value.trim() : value))
      .filter((value) => value !== '' && value !== null && value !== undefined)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value))
      .map((value) => Math.trunc(value));

    if (validCreatorId != null && !assignees.includes(validCreatorId)) {
      assignees.push(validCreatorId);
    }

    if (assignees.length > 0 && userRepository.getUsersByIds) {
      await userRepository.getUsersByIds(assignees);
    }

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

    const uniqueAssignees = Array.from(new Set(assignees));

    const newTaskData = {
      title: title.trim(),
      description: description?.trim() || null,
      priority: normPriority,
      status: normStatus,
      deadline: deadline || null,
      project_id: project_id || null,
      assigned_to: uniqueAssignees,
      tags: normTags,
      created_at: new Date(),
      updated_at: new Date()
    };

    if (taskRepository.insert) {
      const created = await taskRepository.insert(newTaskData); // returns hydrated task object
      const notifyAssignees = uniqueAssignees.filter((id) => id !== validCreatorId);
      if (notifyAssignees.length) {
        notificationService
          .createTaskAssignmentNotifications({
            task: created,
            assigneeIds: notifyAssignees,
            assignedById: validCreatorId,
            previousAssigneeIds: [],
            currentAssigneeIds: uniqueAssignees,
            notificationType: 'task_assignment'
          })
          .catch((err) => console.error('Failed to send task assignment notifications:', err));
      }
      return created;
    }
    const createdTask = await taskRepository.createTask(newTaskData);
    const notifyAssignees = uniqueAssignees.filter((id) => id !== validCreatorId);
    if (notifyAssignees.length) {
      notificationService
        .createTaskAssignmentNotifications({
          task: createdTask,
          assigneeIds: notifyAssignees,
          assignedById: validCreatorId,
          previousAssigneeIds: [],
          currentAssigneeIds: uniqueAssignees,
          notificationType: 'task_assignment'
        })
        .catch((err) => console.error('Failed to send task assignment notifications:', err));
    }
    return createdTask;
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

      let previousAssigneeIds = null;
      if (input.assigned_to !== undefined) {
        // Accept number[], string[] of numbers, or null/empty
        const arr = Array.isArray(input.assigned_to) ? input.assigned_to : [];
        const normalized = arr
          .map(v => (typeof v === 'string' ? v.trim() : v))
          .filter(v => v !== '' && v !== null && v !== undefined)
          .map(Number)
          .filter(Number.isFinite) // keep only valid numbers
          .map(n => Math.trunc(n)); // ensure integers
        previousAssigneeIds = await this._getTaskAssigneeIds(taskId);
        patch.assigned_to = Array.from(new Set(normalized)); // <-- Supabase column of type int4[]
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
        if (patch.assigned_to !== undefined) {
          const updatedAssignees = this._normalizeAssigneeIds(updated.assigned_to);
          const previous = this._normalizeAssigneeIds(previousAssigneeIds);
          const newlyAssigned = updatedAssignees.filter(id => !previous.includes(id));
          const removedAssignees = previous.filter(id => !updatedAssignees.includes(id));
          if (newlyAssigned.length) {
            notificationService
              .createTaskAssignmentNotifications({
                task: updated,
                assigneeIds: newlyAssigned,
                assignedById: requestingUserId ?? null,
                previousAssigneeIds: previous,
                currentAssigneeIds: updatedAssignees,
                notificationType: 'reassignment'
              })
              .catch((err) =>
                console.error('Failed to send task assignment notifications:', err)
              );
          }
          if (removedAssignees.length) {
            notificationService
              .createTaskRemovalNotifications({
                task: updated,
                assigneeIds: removedAssignees,
                assignedById: requestingUserId ?? null,
                previousAssigneeIds: previous,
                currentAssigneeIds: updatedAssignees
              })
              .catch((err) =>
                console.error('Failed to send task removal notifications:', err)
              );
          }
        }
        return updated;
      } else {
        const updated = await taskRepository.updateTask(id, patch); // hydrated task
        if (patch.assigned_to !== undefined) {
          const updatedAssignees = this._normalizeAssigneeIds(updated.assigned_to);
          const previous = this._normalizeAssigneeIds(previousAssigneeIds);
          const newlyAssigned = updatedAssignees.filter(id => !previous.includes(id));
          const removedAssignees = previous.filter(id => !updatedAssignees.includes(id));
          if (newlyAssigned.length) {
            notificationService
              .createTaskAssignmentNotifications({
                task: updated,
                assigneeIds: newlyAssigned,
                assignedById: requestingUserId ?? null,
                previousAssigneeIds: previous,
                currentAssigneeIds: updatedAssignees,
                notificationType: 'reassignment'
              })
              .catch((err) =>
                console.error('Failed to send task assignment notifications:', err)
              );
          }
          if (removedAssignees.length) {
            notificationService
              .createTaskRemovalNotifications({
                task: updated,
                assigneeIds: removedAssignees,
                assignedById: requestingUserId ?? null,
                previousAssigneeIds: previous,
                currentAssigneeIds: updatedAssignees
              })
              .catch((err) =>
                console.error('Failed to send task removal notifications:', err)
              );
          }
        }
        return updated;
      }
    }

    // Comprehensive approach with permissions
    const currentTask = await taskRepository.getTaskById(taskId);
    const previousAssignees = this._normalizeAssigneeIds(currentTask?.assigned_to);

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

    const updatedTask = await taskRepository.updateTask(taskId, updateData);
    if (updates.assigned_to !== undefined) {
      const updatedIds = this._normalizeAssigneeIds(updatedTask.assigned_to);
      const newlyAssigned = updatedIds.filter((id) => !previousAssignees.includes(id));
      const removedAssignees = previousAssignees.filter((id) => !updatedIds.includes(id));
      if (newlyAssigned.length) {
        notificationService
          .createTaskAssignmentNotifications({
            task: updatedTask,
            assigneeIds: newlyAssigned,
            assignedById: requestingUserId ?? null,
            previousAssigneeIds: previousAssignees,
            currentAssigneeIds: updatedIds,
            notificationType: 'reassignment'
          })
          .catch((err) =>
            console.error('Failed to send task assignment notifications:', err)
          );
      }
      if (removedAssignees.length) {
        notificationService
          .createTaskRemovalNotifications({
            task: updatedTask,
            assigneeIds: removedAssignees,
            assignedById: requestingUserId ?? null,
            previousAssigneeIds: previousAssignees,
            currentAssigneeIds: updatedIds
          })
          .catch((err) =>
            console.error('Failed to send task removal notifications:', err)
          );
      }
    }
    return updatedTask;
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

  _normalizeAssigneeIds(raw) {
    const arr = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
    return Array.from(
      new Set(
        arr
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value))
          .map((value) => Math.trunc(value))
      )
    );
  }

  async _getTaskAssigneeIds(taskId) {
    try {
      const existing = await taskRepository.getTaskById(taskId);
      return this._normalizeAssigneeIds(existing?.assigned_to);
    } catch (err) {
      console.error(`Failed to fetch current assignees for task ${taskId}:`, err);
      return [];
    }
  }
}

module.exports = new TaskService();
