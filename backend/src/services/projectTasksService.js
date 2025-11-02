const projectTasksRepository = require('../repository/projectTasksRepository');
const projectRepository = require('../repository/projectRepository');
const notificationService = require('./notificationService');
const taskAssigneeHoursService = require('./taskAssigneeHoursService');

const MAX_ASSIGNEES = 5;

class ProjectTasksService {
  /**
   * Validation constants
   */
  static VALID_TASK_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'];
  static PRIORITY_MIN = 1;
  static PRIORITY_MAX = 10;
  static DEFAULT_PRIORITY = 5;
  static LEGACY_PRIORITY_MAP = { low: 1, medium: 5, high: 10 };
  static VALID_SORT_FIELDS = ['id', 'title', 'status', 'priority', 'created_at', 'updated_at', 'deadline'];
  static VALID_SORT_ORDERS = ['asc', 'desc'];

  static get PRIORITY_ERROR_MESSAGE() {
    return `Priority must be an integer between ${ProjectTasksService.PRIORITY_MIN} and ${ProjectTasksService.PRIORITY_MAX}`;
  }

  static normalizePriority(priority) {
    if (priority === undefined || priority === null || priority === '') {
      return null;
    }

    const toProcess = typeof priority === 'string' ? priority.trim().toLowerCase() : priority;

    if (typeof toProcess === 'string') {
      if (toProcess in ProjectTasksService.LEGACY_PRIORITY_MAP) {
        return ProjectTasksService.LEGACY_PRIORITY_MAP[toProcess];
      }
      if (toProcess === '') {
        return null;
      }
      const parsed = Number(toProcess);
      if (!Number.isFinite(parsed)) {
        throw new Error(ProjectTasksService.PRIORITY_ERROR_MESSAGE);
      }
      return ProjectTasksService.normalizePriority(parsed);
    }

    const numericPriority = Number(toProcess);
    if (!Number.isFinite(numericPriority)) {
      throw new Error(ProjectTasksService.PRIORITY_ERROR_MESSAGE);
    }

    const intPriority = Math.trunc(numericPriority);
    if (
      intPriority < ProjectTasksService.PRIORITY_MIN ||
      intPriority > ProjectTasksService.PRIORITY_MAX
    ) {
      throw new Error(ProjectTasksService.PRIORITY_ERROR_MESSAGE);
    }

    return intPriority;
  }

  /**
   * Validate project exists
   * @param {number} projectId - The project ID
   * @returns {boolean} True if project exists
   */
  async validateProjectExists(projectId) {
    console.log('Validating project exists:', projectId);
    const projectExists = await projectRepository.exists(projectId);
    console.log('Project exists result:', projectExists);
    if (!projectExists) {
      throw new Error('Project not found');
    }
    return true;
  }

  async _fetchProjectDetails(projectId) {
    if (typeof projectRepository.getProjectById !== 'function') {
      return null;
    }
    try {
      return await projectRepository.getProjectById(projectId);
    } catch (error) {
      console.error('[ProjectTasksService] Failed to fetch project details:', error);
      return null;
    }
  }

  /**
   * Validate positive integer
   * @param {any} value - Value to validate
   * @param {string} fieldName - Field name for error message
   * @returns {number} Validated integer
   */
  validatePositiveInteger(value, fieldName) {
    const num = parseInt(value);
    if (isNaN(num) || num <= 0) {
      throw new Error(`${fieldName} must be a positive integer`);
    }
    return num;
  }

  /**
   * Normalize Supabase assigned_to payloads into an array of integers
   * @param {Array<any>} assigned - Raw assigned_to values
   * @returns {number[]} Normalized integer user IDs
   */
  _normalizeAssigneeIds(assigned) {
    if (!Array.isArray(assigned)) {
      return [];
    }

    return assigned
      .map((value) => {
        if (value === null || value === undefined) {
          return null;
        }
        const raw = typeof value === 'string' ? value.trim() : value;
        if (raw === '') {
          return null;
        }
        const num = Number(raw);
        return Number.isFinite(num) ? Math.trunc(num) : null;
      })
      .filter((value) => value !== null);
  }

  /**
   * Validate and clean filters
   * @param {Object} filters - Raw filters
   * @returns {Object} Cleaned filters
   */
  validateFilters(filters) {
    const cleanFilters = {};

    if (filters.status) {
      if (!ProjectTasksService.VALID_TASK_STATUSES.includes(filters.status)) {
        throw new Error(`Invalid status. Must be one of: ${ProjectTasksService.VALID_TASK_STATUSES.join(', ')}`);
      }
      cleanFilters.status = filters.status;
    }

    if (filters.priority !== undefined && filters.priority !== null && filters.priority !== '') {
      if (filters.priority === 'all') {
        // No-op for legacy UI filters
      } else {
        cleanFilters.priority = ProjectTasksService.normalizePriority(filters.priority);
      }
    }

    if (filters.assigned_to) {
      cleanFilters.assigned_to = this.validatePositiveInteger(filters.assigned_to, 'assignedTo');
    }

    if (filters.project_id) {
      cleanFilters.project_id = this.validatePositiveInteger(filters.project_id, 'project_id');
    }

    return cleanFilters;
  }

  /**
   * Validate and clean sorting options
   * @param {Object} sorting - Raw sorting options
   * @returns {Object} Cleaned sorting options
   */
  validateSorting(sorting) {
    const { sortBy = 'created_at', sortOrder = 'desc' } = sorting;

    if (!ProjectTasksService.VALID_SORT_FIELDS.includes(sortBy)) {
      throw new Error(`Invalid sort field. Must be one of: ${ProjectTasksService.VALID_SORT_FIELDS.join(', ')}`);
    }

    if (!ProjectTasksService.VALID_SORT_ORDERS.includes(sortOrder)) {
      throw new Error(`Invalid sort order. Must be: ${ProjectTasksService.VALID_SORT_ORDERS.join(' or ')}`);
    }

    return { sortBy, sortOrder };
  }

  /**
   * Validate and clean pagination options
   * @param {Object} pagination - Raw pagination options
   * @returns {Object} Cleaned pagination options
   */
  validatePagination(pagination) {
    const { page = 1, limit = 20 } = pagination;
    const maxPageSize = 100;

    const validatedPage = this.validatePositiveInteger(page, 'page');
    const validatedLimit = Math.min(this.validatePositiveInteger(limit, 'limit'), maxPageSize);
    const offset = (validatedPage - 1) * validatedLimit;

    return { page: validatedPage, limit: validatedLimit, offset };
  }

  /**
   * Get all tasks for a specific project
   * @param {number} projectId - The project ID
   * @param {Object} options - Query options (filters, pagination, sorting)
   * @returns {Object} Tasks data with pagination info
   */
  async getProjectTasks(projectId, options = {}) {
    try {
      // Validate project exists
      const validatedProjectId = this.validatePositiveInteger(projectId, 'projectId');
      await this.validateProjectExists(validatedProjectId);

      // Validate and clean options
      const filters = this.validateFilters(options.filters || {});
      const sorting = this.validateSorting(options.sorting || {});
      const pagination = this.validatePagination(options.pagination || {});

      // Get tasks from repository
      const { data: tasks, count: totalCount } = await projectTasksRepository.findByProjectId(
        validatedProjectId,
        filters,
        pagination,
        sorting
      );

      return {
        success: true,
        projectId: validatedProjectId,
        tasks,
        totalTasks: totalCount,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          totalPages: Math.ceil(totalCount / pagination.limit),
          hasNext: pagination.page * pagination.limit < totalCount,
          hasPrev: pagination.page > 1
        },
        filters: {
          status: filters.status || null,
          assignedTo: filters.assigned_to || null,
          priority: filters.priority || null,
          sortBy: sorting.sortBy,
          sortOrder: sorting.sortOrder
        },
        message: 'Tasks retrieved successfully'
      };

    } catch (error) {
      console.error('Error getting project tasks:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to retrieve project tasks'
      };
    }
  }

  /**
   * Get all tasks with optional filters
   * @param {Object} options - Query options (filters, pagination, sorting)
   * @returns {Object} Tasks data with pagination info
   */
  async getAllTasks(options = {}) {
    try {
      // Validate and clean options
      const filters = this.validateFilters(options.filters || {});
      const sorting = this.validateSorting(options.sorting || {});
      const pagination = this.validatePagination(options.pagination || {});

      // Get tasks from repository
      const { data: tasks, count: totalCount } = await projectTasksRepository.findAll(
        filters,
        pagination,
        sorting
      );

      return {
        success: true,
        tasks: tasks,
        totalTasks: totalCount,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          totalPages: Math.ceil(totalCount / pagination.limit),
          hasNext: pagination.page * pagination.limit < totalCount,
          hasPrev: pagination.page > 1
        },
        filters: {
          status: filters.status || null,
          project_id: filters.project_id || null,
          assigned_to: filters.assigned_to || null,
          priority: filters.priority || null,
          sortBy: sorting.sortBy,
          sortOrder: sorting.sortOrder
        },
        message: 'Tasks retrieved successfully'
      };

    } catch (error) {
      console.error('Error getting all tasks:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to retrieve tasks'
      };
    }
  }

  /**
   * Get a specific task by ID and project ID
   * @param {number} projectId - The project ID
   * @param {number} taskId - The task ID
   * @returns {Object} Task data or error
   */
  async getTaskById(projectId, taskId) {
    try {
      const validatedProjectId = this.validatePositiveInteger(projectId, 'projectId');
      const validatedTaskId = this.validatePositiveInteger(taskId, 'taskId');

      const task = await projectTasksRepository.findByIdAndProjectId(validatedTaskId, validatedProjectId);

      if (!task) {
        throw new Error('Task not found');
      }

      const summary = await taskAssigneeHoursService.getTaskHoursSummary(
        validatedTaskId,
        this._normalizeAssigneeIds(task.assigned_to)
      );

      return {
        success: true,
        task: { ...task, time_tracking: summary },
        message: 'Task retrieved successfully'
      };

    } catch (error) {
      console.error('Error getting task:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to retrieve task'
      };
    }
  }

  /**
   * Create a new task for a project
   * @param {number} projectId - The project ID
   * @param {Object} taskData - The task data
   * @returns {Object} Created task data or error
   */
  async createTask(projectId, taskData, creatorId = null) {
    try {
      // Validate project exists
      const validatedProjectId = this.validatePositiveInteger(projectId, 'projectId');
      await this.validateProjectExists(validatedProjectId);
      const projectDetails = await this._fetchProjectDetails(validatedProjectId);
      const projectStatus = String(projectDetails?.status || '').toLowerCase();
      if (projectStatus === 'archived') {
        console.warn('[ProjectTasksService] Attempted task creation on archived project', {
          projectId: validatedProjectId,
          requestedBy: creatorId,
          payload: {
            title: taskData?.title,
            status: taskData?.status,
            priority: taskData?.priority,
          },
        });
        throw new Error('Cannot create tasks for archived projects');
      }

      // Validate required fields
      const {
        title,
        description,
        assigned_to,
        priority = ProjectTasksService.DEFAULT_PRIORITY,
        deadline,
        status = 'pending'
      } = taskData;

      if (!title || title.trim() === '') {
        throw new Error('Title is required');
      }

      // Validate optional fields
      if (status && !ProjectTasksService.VALID_TASK_STATUSES.includes(status)) {
        throw new Error(`Invalid status. Must be one of: ${ProjectTasksService.VALID_TASK_STATUSES.join(', ')}`);
      }

      const normalizedPriority = ProjectTasksService.normalizePriority(priority ?? ProjectTasksService.DEFAULT_PRIORITY)
        ?? ProjectTasksService.DEFAULT_PRIORITY;

      // Validate assigned_to array if provided
      if (assigned_to && (!Array.isArray(assigned_to) || assigned_to.some(id => isNaN(parseInt(id)) || parseInt(id) <= 0))) {
        throw new Error('assigned_to must be an array of positive integers');
      }

      const normalizedAssignees = Array.isArray(assigned_to) ? assigned_to : [];
      const assignees = normalizedAssignees
        .map((value) => (typeof value === 'string' ? value.trim() : value))
        .filter((value) => value !== '' && value !== null && value !== undefined)
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
        .map((value) => Math.trunc(value));

      const creatorNumeric = creatorId != null ? Number(creatorId) : null;
      const validCreatorId = Number.isFinite(creatorNumeric) ? Math.trunc(creatorNumeric) : null;

      if (validCreatorId != null && !assignees.includes(validCreatorId)) {
        assignees.push(validCreatorId);
      }

      const uniqueAssignees = Array.from(new Set(assignees));
      if (uniqueAssignees.length > MAX_ASSIGNEES) {
        throw new Error(`A task can have at most ${MAX_ASSIGNEES} assignees.`);
      }

      // Validate deadline format if provided
      if (deadline && isNaN(Date.parse(deadline))) {
        throw new Error('Invalid deadline format. Use ISO 8601 format');
      }

      // Disallow deadlines that are before today (past dates)
      if (deadline) {
        const parsedDeadline = new Date(deadline);
        if (isNaN(parsedDeadline.getTime())) {
          throw new Error('Invalid deadline format. Use ISO 8601 format');
        }
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const deadlineDate = new Date(parsedDeadline.getFullYear(), parsedDeadline.getMonth(), parsedDeadline.getDate());
        if (deadlineDate.getTime() < today.getTime()) {
          const err = new Error('Deadline cannot be in the past');
          err.statusCode = 400;
          throw err;
        }
      }

      const cleanTaskData = {
        title: title.trim(),
        description: description?.trim() || '',
        status,
        priority: normalizedPriority,
        project_id: validatedProjectId,
        assigned_to: uniqueAssignees,
        deadline: deadline || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const newTask = await projectTasksRepository.create(cleanTaskData);

      console.log(`Task created: ${JSON.stringify(newTask)}`);

      // Send immediate deadline notifications if task has deadline today/tomorrow
      if (newTask.deadline) {
        console.log(`DEBUG: Task has deadline: "${newTask.deadline}" (type: ${typeof newTask.deadline})`);
        try {
          console.log(`Task "${newTask.title}" has deadline: ${newTask.deadline}`);
          const deadline = new Date(newTask.deadline);
          console.log(`Parsed deadline: ${deadline}, isValid: ${!isNaN(deadline.getTime())}`);
          
          // Get current date in local timezone
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);

          // Normalize deadline to start of day in local timezone
          const deadlineDate = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());

          console.log(`Today: ${today.toISOString().split('T')[0]}, Tomorrow: ${tomorrow.toISOString().split('T')[0]}, Task deadline: ${deadlineDate.toISOString().split('T')[0]}`);
          console.log(`Today time: ${today.getTime()}, Tomorrow time: ${tomorrow.getTime()}, Deadline time: ${deadlineDate.getTime()}`);

          // Check if deadline is today, tomorrow, or overdue
          const isToday = deadlineDate.getTime() === today.getTime();
          const isTomorrow = deadlineDate.getTime() === tomorrow.getTime();
          const isOverdue = deadlineDate.getTime() < today.getTime();
          
          console.log(`Is today: ${isToday}, Is tomorrow: ${isTomorrow}, Is overdue: ${isOverdue}`);
          
          if (isToday || isTomorrow || isOverdue) {
            const deadlineType = isOverdue ? 'overdue' : isToday ? 'today' : 'tomorrow';
            console.log(`Task "${newTask.title}" has ${deadlineType} deadline ${deadlineDate.toDateString()}, sending immediate notifications`);

            // Hydrate task with assignee information
            const hydratedTask = { ...newTask };
            if (newTask.assigned_to && newTask.assigned_to.length > 0) {
              try {
                const userRepository = require('../repository/userRepository');
                const assignees = [];
                for (const userId of newTask.assigned_to) {
                  const user = await userRepository.getUserById(userId);
                  if (user) {
                    assignees.push(user);
                  }
                }
                hydratedTask.assignees = assignees;
              } catch (error) {
                console.error('Error hydrating assignees:', error);
                hydratedTask.assignees = [];
              }
            } else {
              hydratedTask.assignees = [];
            }

            // Send deadline notifications using the unified method
            await this.sendDeadlineNotifications(hydratedTask, deadlineType);
          }
        } catch (notificationError) {
          console.error('Error sending immediate deadline notification:', notificationError);
          // Don't fail task creation if notification fails
        }
      }

      return {
        success: true,
        task: newTask,
        message: 'Task created successfully'
      };

    } catch (error) {
      console.error('Error creating task:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to create task'
      };
    }
  }

  /**
   * Update a task
   * @param {number} taskId - The task ID
   * @param {Object} updateData - The data to update
   * @returns {Object} Updated task data or error
   */
  async updateTask(taskId, updateData, requestingUserId = null) {
    try {
      const validatedTaskId = this.validatePositiveInteger(taskId, 'taskId');
      const normalizedRequesterId = requestingUserId !== null && requestingUserId !== undefined
        ? this.validatePositiveInteger(requestingUserId, 'requestingUserId')
        : null;
      let existingTask = null;

      if (normalizedRequesterId !== null) {
        existingTask = await projectTasksRepository.findById(validatedTaskId);
        if (!existingTask) {
          const notFoundError = new Error('Task not found');
          notFoundError.statusCode = 404;
          throw notFoundError;
        }

        const assigneeIds = this._normalizeAssigneeIds(existingTask.assigned_to);
        if (!assigneeIds.includes(normalizedRequesterId)) {
          const permissionError = new Error('You must be assigned to the task to update it.');
          permissionError.statusCode = 403;
          throw permissionError;
        }
      }

      // Filter out undefined values
      const filteredUpdateData = Object.fromEntries(
        Object.entries(updateData).filter(([_, value]) => value !== undefined)
      );

      const rawHoursInput = filteredUpdateData.hours ?? filteredUpdateData.time_spent_hours;
      const hasHoursUpdate = rawHoursInput !== undefined;
      let normalizedHoursInput;
      if (hasHoursUpdate) {
        if (normalizedRequesterId === null) {
          const hoursError = new Error('Hours spent can only be recorded by an assigned user.');
          hoursError.statusCode = 403;
          throw hoursError;
        }
        normalizedHoursInput = taskAssigneeHoursService.normalizeHours(rawHoursInput);
      }
      delete filteredUpdateData.hours;
      delete filteredUpdateData.time_spent_hours;

      // Validate fields if they're being updated
      if (filteredUpdateData.status && !ProjectTasksService.VALID_TASK_STATUSES.includes(filteredUpdateData.status)) {
        throw new Error(`Invalid status. Must be one of: ${ProjectTasksService.VALID_TASK_STATUSES.join(', ')}`);
      }

      if (Object.prototype.hasOwnProperty.call(filteredUpdateData, 'priority')) {
        const normalizedPriorityUpdate = ProjectTasksService.normalizePriority(filteredUpdateData.priority);
        if (normalizedPriorityUpdate === null) {
          throw new Error(ProjectTasksService.PRIORITY_ERROR_MESSAGE);
        }
        filteredUpdateData.priority = normalizedPriorityUpdate;
      }

      if (filteredUpdateData.assigned_to && (!Array.isArray(filteredUpdateData.assigned_to) ||
          filteredUpdateData.assigned_to.some(id => isNaN(parseInt(id)) || parseInt(id) <= 0))) {
        throw new Error('assigned_to must be an array of positive integers');
      }

      if (Array.isArray(filteredUpdateData.assigned_to)) {
        const normalizedAssignees = filteredUpdateData.assigned_to
          .map((value) => (typeof value === 'string' ? value.trim() : value))
          .filter((value) => value !== '' && value !== null && value !== undefined)
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value))
          .map((value) => Math.trunc(value));
        const uniqueAssignees = Array.from(new Set(normalizedAssignees));
        if (uniqueAssignees.length > MAX_ASSIGNEES) {
          throw new Error(`A task can have at most ${MAX_ASSIGNEES} assignees.`);
        }
        filteredUpdateData.assigned_to = uniqueAssignees;
      }

      if (filteredUpdateData.deadline && isNaN(Date.parse(filteredUpdateData.deadline))) {
        throw new Error('Invalid deadline format. Use ISO 8601 format');
      }

      // When updating, disallow changing the deadline to a past date
      if (filteredUpdateData.deadline) {
        const parsedNewDeadline = new Date(filteredUpdateData.deadline);
        if (isNaN(parsedNewDeadline.getTime())) {
          throw new Error('Invalid deadline format. Use ISO 8601 format');
        }
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const newDeadlineDate = new Date(parsedNewDeadline.getFullYear(), parsedNewDeadline.getMonth(), parsedNewDeadline.getDate());
        if (newDeadlineDate.getTime() < today.getTime()) {
          const err = new Error('Deadline cannot be in the past');
          err.statusCode = 400;
          throw err;
        }
      }

      const updatedTask = await projectTasksRepository.update(validatedTaskId, filteredUpdateData);

      if (!updatedTask) {
        const notFoundError = new Error('Task not found');
        notFoundError.statusCode = 404;
        throw notFoundError;
      }

      if (hasHoursUpdate) {
        await taskAssigneeHoursService.recordHours({
          taskId: validatedTaskId,
          userId: normalizedRequesterId,
          hours: normalizedHoursInput
        });
      }

      updatedTask.time_tracking = await taskAssigneeHoursService.getTaskHoursSummary(
        validatedTaskId,
        updatedTask.assigned_to || existingTask?.assigned_to || []
      );

      // Send immediate deadline notifications if task deadline was updated to today/tomorrow
      if (filteredUpdateData.deadline && updatedTask.deadline) {
        try {
          const deadline = new Date(updatedTask.deadline);
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);

          const deadlineDate = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());

          // Check if deadline is today or tomorrow
          if (deadlineDate.getTime() === today.getTime() || deadlineDate.getTime() === tomorrow.getTime()) {
            console.log(`Task "${updatedTask.title}" deadline updated to ${deadlineDate.toDateString()}, sending immediate notifications`);

            // Hydrate task with assignee information
            const hydratedTask = { ...updatedTask };
            if (updatedTask.assigned_to && updatedTask.assigned_to.length > 0) {
              try {
                const userRepository = require('../repository/userRepository');
                const assignees = [];
                for (const userId of updatedTask.assigned_to) {
                  const user = await userRepository.getUserById(userId);
                  if (user) {
                    assignees.push(user);
                  }
                }
                hydratedTask.assignees = assignees;
              } catch (error) {
                console.error('Error hydrating assignees:', error);
                hydratedTask.assignees = [];
              }
            } else {
              hydratedTask.assignees = [];
            }

            // Send deadline notifications using the unified method
            await this.sendDeadlineNotifications(hydratedTask);
          }
        } catch (notificationError) {
          console.error('Error sending immediate deadline notification on update:', notificationError);
          // Don't fail task update if notification fails
        }
      }

      return {
        success: true,
        task: updatedTask,
        message: 'Task updated successfully'
      };

    } catch (error) {
      console.error('Error updating task:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to update task',
        statusCode: error.statusCode || error.status
      };
    }
  }

  /**
   * Delete a task
   * @param {number} taskId - The task ID
   * @returns {Object} Success message or error
   */
  async deleteTask(taskId) {
    try {
      const validatedTaskId = this.validatePositiveInteger(taskId, 'taskId');

      // Check if task exists first
      const exists = await projectTasksRepository.exists(validatedTaskId);
      if (!exists) {
        throw new Error('Task not found');
      }

      await projectTasksRepository.delete(validatedTaskId);

      return {
        success: true,
        message: 'Task deleted successfully'
      };

    } catch (error) {
      console.error('Error deleting task:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to delete task'
      };
    }
  }

  /**
   * Get task statistics for a project
   * @param {number} projectId - The project ID
   * @returns {Object} Task statistics or error
   */
  async getTaskStats(projectId) {
    try {
      // Validate project exists
      const validatedProjectId = this.validatePositiveInteger(projectId, 'projectId');
      await this.validateProjectExists(validatedProjectId);

      const tasks = await projectTasksRepository.getTaskStats(validatedProjectId);

      // Calculate comprehensive statistics
      const now = new Date();
      const overdueTasks = tasks.filter(task =>
        task.deadline && new Date(task.deadline) < now &&
        !['completed', 'cancelled'].includes(task.status)
      );

      const stats = {
        total: tasks.length,
        byStatus: {
          pending: tasks.filter(t => t.status === 'pending').length,
          inProgress: tasks.filter(t => t.status === 'in_progress').length,
          completed: tasks.filter(t => t.status === 'completed').length,
          cancelled: tasks.filter(t => t.status === 'cancelled').length
        },
        byPriority: {
          high: tasks.filter(t => Number(t.priority) >= 7 && Number(t.priority) <= 10).length,
          medium: tasks.filter(t => Number(t.priority) >= 4 && Number(t.priority) <= 6).length,
          low: tasks.filter(t => Number(t.priority) >= 1 && Number(t.priority) <= 3).length
        },
        overdue: overdueTasks.length,
        completionRate: tasks.length > 0 ?
          (tasks.filter(t => t.status === 'completed').length / tasks.length * 100).toFixed(1) : 0
      };

      return {
        success: true,
        projectId: validatedProjectId,
        stats,
        message: 'Task statistics retrieved successfully'
      };

    } catch (error) {
      console.error('Error getting task statistics:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to retrieve task statistics'
      };
    }
  }

  /**
   * Send deadline notifications for any task (with or without project)
   * @param {Object} task - The task object
   * @param {string} deadlineType - 'today' or 'tomorrow'
   */
  async sendDeadlineNotifications(task, deadlineType = 'today') {
    try {
      if (!task.deadline) return;

      // Check deadline status
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const deadlineDate = new Date(task.deadline);
      deadlineDate.setHours(0, 0, 0, 0);

      const isToday = deadlineDate.getTime() === today.getTime();
      const isTomorrow = deadlineDate.getTime() === tomorrow.getTime();
      const isOverdue = deadlineDate.getTime() < today.getTime();

      // For impending deadlines, only send if today or tomorrow
      // For overdue, always send (since we're calling this explicitly for overdue tasks)
      if (deadlineType !== 'overdue' && !isToday && !isTomorrow) return;

      console.log('Sending deadline notifications for task:', {
        taskId: task.id,
        title: task.title,
        deadline: task.deadline,
        deadlineType: deadlineType,
        hasProject: !!task.project_id
      });

      const recipients = [];

      // Get project managers if task has a project
      if (task.project_id) {
        try {
          const managers = await notificationService.getProjectManagers(task.project_id);
          recipients.push(...managers);
        } catch (error) {
          console.warn('Could not fetch project managers for notifications:', error.message);
        }
      }

      // Get task assignees
      if (task.assigned_to && Array.isArray(task.assigned_to)) {
        try {
          const userRepository = require('../repository/userRepository');
          for (const userId of task.assigned_to) {
            const user = await userRepository.getUserById(userId);
            if (user) {
              recipients.push(user);
            }
          }
        } catch (error) {
          console.error('Error fetching assignees for notifications:', error);
        }
      }

      // Remove duplicates
      const uniqueRecipients = recipients.filter((user, index, self) =>
        index === self.findIndex(u => u.id === user.id)
      );

      console.log(`Sending ${deadlineType} deadline notifications to ${uniqueRecipients.length} recipients:`, uniqueRecipients.map(u => u.id));

      // Send notifications based on type
      if (deadlineType === 'overdue') {
        // For overdue notifications, create once for all recipients
        await notificationService.createOverdueNotifications(task);
        
        // Then send individual emails
        for (const recipient of uniqueRecipients) {
          try {
            await notificationService.sendOverdueEmailNotification(task, recipient);
          } catch (error) {
            console.error(`Failed to send ${deadlineType} email notification to user ${recipient.id}:`, error);
          }
        }
      } else {
        // For impending deadline notifications, create and send for each recipient
        for (const recipient of uniqueRecipients) {
          try {
            await notificationService.createDeadlineNotification(task, recipient);
            await notificationService.sendDeadlineEmailNotification(task, recipient);
          } catch (error) {
            console.error(`Failed to send ${deadlineType} notification to user ${recipient.id}:`, error);
          }
        }
      }

    } catch (error) {
      console.error('Error in sendDeadlineNotifications:', error);
    }
  }
}

module.exports = new ProjectTasksService();
