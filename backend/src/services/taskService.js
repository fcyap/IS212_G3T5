<<<<<<< HEAD
﻿const taskRepository = require('../repositories/taskRepository');
const projectRepository = require('../repositories/projectRepository');
const userRepository = require('../repositories/userRepository');

/**
 * Task Service - Contains business logic for task operations
 * This layer orchestrates data from repositories and applies business rules
 */
class TaskService {
  
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
    // Validate project exists
    await projectRepository.getProjectById(projectId);
    
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
   * Create a new task
   */
  async createTask(taskData, creatorId) {
    // Validate creator exists
    await userRepository.getUserById(creatorId);
    
    // Validate project exists
    await projectRepository.getProjectById(taskData.project_id);

    // Validate assigned users exist (if any)
    if (taskData.assigned_to && taskData.assigned_to.length > 0) {
      await userRepository.getUsersByIds(taskData.assigned_to);
    }

    // Prepare task data
    const newTaskData = {
      ...taskData,
      status: taskData.status || 'pending',
      priority: taskData.priority || 'medium',
      created_at: new Date(),
      updated_at: new Date()
    };

    return await taskRepository.createTask(newTaskData);
  }

  /**
   * Update task
   */
  async updateTask(taskId, updates, requestingUserId) {
    // Get current task
    const currentTask = await taskRepository.getTaskById(taskId);
    
    // Check if user can update the task (project member or manager)
    const canUpdate = await this._canUserUpdateTask(currentTask.project_id, requestingUserId);
    if (!canUpdate) {
      throw new Error('You do not have permission to update this task');
    }

    // Validate assigned users exist (if updating assignments)
    if (updates.assigned_to && updates.assigned_to.length > 0) {
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
    const canDelete = await this._canUserUpdateTask(currentTask.project_id, requestingUserId);
    if (!canDelete) {
      throw new Error('You do not have permission to delete this task');
    }

    return await taskRepository.deleteTask(taskId);
  }

  /**
   * Get task statistics for a project
   */
  async getProjectTaskStats(projectId) {
    // Validate project exists
    await projectRepository.getProjectById(projectId);
    
    const tasks = await taskRepository.getTasksByProjectId(projectId);
    
    if (tasks.length === 0) {
      return {
        totalTasks: 0,
        pendingTasks: 0,
        inProgressTasks: 0,
        completedTasks: 0,
        cancelledTasks: 0,
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
      return await projectRepository.canUserManageMembers(projectId, userId);
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
=======
const taskRepository = require("../repositories/taskRepository.js");

class TaskService {
   async listWithAssignees({ archived = false } = {}) {
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
  }

  async createTask(input) {
    const {
      title,
      description = null,
      priority,
      status,
      deadline = null,
      team_id = null,
      assigned_to,
      tags, // <— NEW
    } = input;

    if (!title) {
      const err = new Error("title is required");
      err.status = 400;
      throw err;
    }

    const normPriority = String(priority || "low").toLowerCase();
    const allowed = new Set(["pending", "in_progress", "completed", "blocked"]);
    const requested = String(status || "pending").toLowerCase();
    const normStatus = allowed.has(requested) ? requested : "pending";
    const assignees = Array.isArray(assigned_to) ? assigned_to : [];

    // NEW: normalize tags to a text[]
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

    const payload = {
      title,
      description,
      priority: normPriority,
      status: normStatus,
      deadline,
      team_id,
      assigned_to: assignees,
      tags: normTags, // <— NEW
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await taskRepository.insert(payload);
    if (error) throw error;
    return data;
  }

  async updateTask(id, input) {
    const patch = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.priority !== undefined)
      patch.priority = String(input.priority).toLowerCase();
    if (input.status !== undefined) patch.status = input.status;
    if (input.deadline !== undefined) patch.deadline = input.deadline || null;
    if (input.archived !== undefined) patch.archived = !!input.archived;

    // OPTIONAL: allow editing tags later
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

    const { data, error } = await taskRepository.updateById(id, patch);
    if (error) throw error;
    return data;
>>>>>>> origin/michelle
  }
}

module.exports = new TaskService();
