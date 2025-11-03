const taskRepository = require('../repository/taskRepository');
const projectRepository = require('../repository/projectRepository');
const projectMemberRepository = require('../repository/projectMemberRepository');
const userRepository = require('../repository/userRepository');
const crypto = require('crypto');
const notificationService = require('./notificationService');
const taskAttachmentService = require('./taskAttachmentService');
const taskFilesService = require('./taskFilesService');
const taskAssigneeHoursService = require('./taskAssigneeHoursService');
const supabase = require('../utils/supabase');

/**
 * Task Service - Contains business logic for task operations
 * This layer orchestrates data from repositories and applies business rules
 *
 * Supports both comprehensive project management and simple kanban board operations
 */
  function normalizeAssignedTo(val) {
  if (!Array.isArray(val)) return [];
  return val
    .map(v => (typeof v === 'string' ? v.trim() : v))
    .filter(v => v !== '' && v !== null && v !== undefined)
    .map(Number)
    .filter(Number.isFinite)
    .map(n => Math.trunc(n)); // int4[]
}

function addIntervalFromBase(baseDate, freq, interval = 1) {
  if (!baseDate) return null;
  const d = new Date(baseDate);
  if (isNaN(d)) return null;

  if (freq === 'daily') d.setDate(d.getDate() + interval);
  else if (freq === 'weekly') d.setDate(d.getDate() + 7 * interval);
  else if (freq === 'monthly') {
    const day = d.getDate();
    d.setMonth(d.getMonth() + interval);
  }

  // return YYYY-MM-DD (same format you use for `deadline`)
  return d.toISOString().slice(0, 10);
}

function isCompleted(status) {
  return String(status || '').toLowerCase() === 'completed';
}

class TaskService {

  async listWithAssignees({ archived = false, parentId, userId, userRole, userHierarchy, userDivision, userDepartment } = {}) {
    try {
      const { data: tasks, error } = await taskRepository.list({ archived, parentId });
      if (error) throw error;

      // Apply RBAC filtering if user context provided
      let filteredTasks = tasks;
      if (userId && userRole) {
        filteredTasks = await this._filterTasksByRBAC(tasks, userId, userRole, userHierarchy, userDivision, userDepartment);
      }

      const idSet = new Set();
      for (const t of filteredTasks) {
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

      return filteredTasks.map(t => {
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
      const fallback = await this.getAllTasks({ archived, userId, userRole, userHierarchy, userDivision, userDepartment });
      if (Array.isArray(fallback)) {
        return fallback;
      }
      if (fallback && Array.isArray(fallback.tasks)) {
        return fallback.tasks;
      }
      return [];
    }
  }

  /**
   * Get all tasks with filters and pagination
   */
  async getAllTasks(filters = {}) {
    // Apply RBAC filtering if user context provided
    let rbacFilters = { ...filters };
    if (filters.userId && filters.userRole) {
      const accessibleProjectIds = await this._getAccessibleProjectIds(
        filters.userId,
        filters.userRole,
        filters.userHierarchy,
        filters.userDivision
      );

      // Store for use in filtering
      rbacFilters.accessibleProjectIds = accessibleProjectIds;
      rbacFilters.requestingUserId = filters.userId;
    }

    const tasks = await taskRepository.getTasksWithFilters(rbacFilters);

    const normalizedDept = String(filters.userDepartment || '').trim().toLowerCase();
    const normalizedRole = String(filters.userRole || '').trim().toLowerCase();
    if (normalizedRole === 'admin' || normalizedDept === 'hr team') {
      const totalCount = tasks.length;
      return {
        tasks,
        totalCount,
        pagination: this._calculatePagination(filters, totalCount)
      };
    }

    // Additional RBAC filtering for tasks - only show tasks from accessible projects or assigned to user
    let filteredTasks = tasks;
    if (rbacFilters.accessibleProjectIds !== undefined && rbacFilters.requestingUserId) {
      filteredTasks = tasks.filter(task => {
        // Show tasks from accessible projects
        if (task.project_id && rbacFilters.accessibleProjectIds.includes(task.project_id)) {
          return true;
        }
        // Show personal tasks (no project_id) assigned to user
        if (!task.project_id && task.assigned_to && Array.isArray(task.assigned_to) &&
            task.assigned_to.includes(rbacFilters.requestingUserId)) {
          return true;
        }
        // Show tasks assigned to user even if not in accessible project
        if (task.assigned_to && Array.isArray(task.assigned_to) &&
            task.assigned_to.includes(rbacFilters.requestingUserId)) {
          return true;
        }
        return false;
      });
    }

    const totalCount = filteredTasks.length; // Use filtered count

    return {
      tasks: filteredTasks,
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
    const task = await taskRepository.getTaskById(taskId);
    const summary = await taskAssigneeHoursService.getTaskHoursSummary(
      task.id,
      this._normalizeAssigneeIds(task.assigned_to)
    );
    return { ...task, time_tracking: summary };
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
      parent_id = null,
      recurrence
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

    const normalizedProjectId =
      project_id === null || project_id === undefined || project_id === ''
        ? null
        : Number(project_id);
    if (normalizedProjectId !== null && !Number.isFinite(normalizedProjectId)) {
      const err = new Error('Invalid project_id');
      err.status = 400;
      throw err;
    }

    const normalizedParentId =
      parent_id === null || parent_id === undefined || parent_id === ''
        ? null
        : Number(parent_id);
    if (normalizedParentId !== null && !Number.isFinite(normalizedParentId)) {
      const err = new Error('Invalid parent_id');
      err.status = 400;
      throw err;
    }

    let parentTask = null;
    if (normalizedParentId !== null) {
      parentTask = await taskRepository.getTaskById(normalizedParentId);
      if (!parentTask) {
        const err = new Error('Parent task not found');
        err.status = 404;
        throw err;
      }
    }

    // Determine final project assignment (subtasks inherit from parent)
    let effectiveProjectId = parentTask
      ? parentTask.project_id ?? null
      : normalizedProjectId;

    if (parentTask && normalizedProjectId !== null && parentTask.project_id !== normalizedProjectId) {
      console.warn(
        `[TaskService] Ignoring mismatched project_id (${normalizedProjectId}) for subtask; using parent project ${parentTask.project_id}`
      );
    }

    if (effectiveProjectId !== null && projectRepository.getProjectById) {
      const project = await projectRepository.getProjectById(effectiveProjectId);
      const statusValue = project?.status ? String(project.status).toLowerCase() : null;
      if (statusValue && statusValue !== 'active') {
        const err = new Error('Tasks can only be assigned to active projects.');
        err.status = 400;
        throw err;
      }
    }

    // Validate deadline is not in the past
    if (deadline) {
      const parsedDeadline = new Date(deadline);
      if (isNaN(parsedDeadline.getTime())) {
        const err = new Error('Invalid deadline format');
        err.status = 400;
        throw err;
      }
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const deadlineDate = new Date(parsedDeadline.getFullYear(), parsedDeadline.getMonth(), parsedDeadline.getDate());
      if (deadlineDate.getTime() < today.getTime()) {
        const err = new Error('Deadline cannot be in the past');
        err.status = 400;
        throw err;
      }
    }

    // Normalize priority (numeric 1-10) and status
    const normPriority = priority != null ? Number(priority) : 5; // Default to 5 (medium)
    const allowedStatuses = new Set(["pending", "in_progress", "completed", "blocked", "cancelled"]);
    const requested = String(status || "pending").toLowerCase();
    const normStatus = allowedStatuses.has(requested) ? requested : "pending";

    const rawAssignees = Array.isArray(assigned_to) ? assigned_to : [];
    const normalizedInputAssignees = rawAssignees
      .map((value) => (typeof value === 'string' ? value.trim() : value))
      .filter((value) => value !== '' && value !== null && value !== undefined)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value))
      .map((value) => Math.trunc(value));

    const assignees = [...normalizedInputAssignees];

    if (
      validCreatorId != null &&
      !assignees.includes(validCreatorId) &&
      normalizedInputAssignees.length === 0
    ) {
      assignees.push(validCreatorId);
    }

    const MAX_ASSIGNEES = TaskService.MAX_ASSIGNEES;
    const usingLegacyCreate =
      !taskRepository.insert && typeof taskRepository.createTask === 'function';

    if (assignees.length === 0 && !usingLegacyCreate) {
      const err = new Error('A task must have at least one assignee.');
      err.status = 400;
      throw err;
    }

    if (assignees.length > MAX_ASSIGNEES) {
      const err = new Error(`A task can have at most ${MAX_ASSIGNEES} assignees.`);
      err.status = 400;
      throw err;
    }

    if (rawAssignees.length > 0 && userRepository.getUsersByIds) {
      await userRepository.getUsersByIds(rawAssignees);
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
      project_id: effectiveProjectId,
      assigned_to: uniqueAssignees,
      tags: normTags,
      parent_id: normalizedParentId,
      created_at: new Date(),
      updated_at: new Date(),
      recurrence_freq: (recurrence && ['daily','weekly','monthly'].includes(recurrence.freq)) ? recurrence.freq : null,
   recurrence_interval: recurrence?.interval ? Math.max(1, Number(recurrence.interval)) : 1,
   recurrence_series_id: recurrence ? (crypto.randomUUID?.() || null) : null,
    };

    if (taskRepository.insert) {
      const created = await taskRepository.insert(newTaskData); // returns hydrated task object
      
      // Copy attachments if this is a recurring task with a parent
      if (parent_id && recurrence) {
        try {
          await taskAttachmentService.copyAttachmentsToTask(
            parent_id,
            created.id,
            validCreatorId || created.assigned_to[0]
          );
        } catch (attachmentError) {
          console.error('Failed to copy attachments for recurring task:', attachmentError);
          // Don't fail task creation if attachment copy fails
        }

        // Also copy files from Supabase Storage
        try {
          await taskFilesService.copyTaskFiles(
            parent_id,
            created.id,
            validCreatorId || created.assigned_to[0]
          );
        } catch (fileError) {
          console.error('Failed to copy files for recurring task:', fileError);
          // Don't fail task creation if file copy fails
        }
      }
      
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
    const createdTask = await taskRepository.createTask({
      ...newTaskData,
      assigned_to: usingLegacyCreate ? newTaskData.assigned_to : newTaskData.assigned_to
    });
    
    // Copy attachments if this is a recurring task with a parent
    if (parent_id && recurrence) {
      try {
        await taskAttachmentService.copyAttachmentsToTask(
          parent_id,
          createdTask.id,
          validCreatorId || createdTask.assigned_to[0]
        );
      } catch (attachmentError) {
        console.error('Failed to copy attachments for recurring task:', attachmentError);
        // Don't fail task creation if attachment copy fails
      }

      // Also copy files from Supabase Storage
      try {
        await taskFilesService.copyTaskFiles(
          parent_id,
          createdTask.id,
          validCreatorId || createdTask.assigned_to[0]
        );
      } catch (fileError) {
        console.error('Failed to copy files for recurring task:', fileError);
        // Don't fail task creation if file copy fails
      }
    }
    
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
    // ---- Always fetch current to detect the transition & read recurrence ----
    const hasRequestingUser = arguments.length >= 3 && requestingUserId != null;
    const normalizedRequesterId = hasRequestingUser ? Math.trunc(Number(requestingUserId)) : null;
    let existingTask = null;
    let existingAssignees = [];

    const currentTask = await taskRepository.getTaskById(
      typeof taskId === 'number' ? taskId : Number(taskId)
    );

    let requesterWasAssignee = false;
    if (normalizedRequesterId != null) {
      existingTask = currentTask;
      existingAssignees = this._normalizeAssigneeIds(existingTask?.assigned_to);
      requesterWasAssignee = existingAssignees.includes(normalizedRequesterId);
      existingTask.requesterWasAssignee = requesterWasAssignee;
    }

    const twoArgOverload = (arguments.length === 2);
    const input = updates;
    const rawHoursInput = input && (input.hours ?? input.time_spent_hours);
    const hasHoursUpdate = rawHoursInput !== undefined;
    let normalizedHoursInput;
    if (hasHoursUpdate) {
      if (normalizedRequesterId == null) {
        const err = new Error('Hours spent can only be recorded by an assigned user.');
        err.status = 403;
        throw err;
      }
      normalizedHoursInput = taskAssigneeHoursService.normalizeHours(rawHoursInput);
    }

    // Normalize patch (your existing logic, trimmed to keep the important bits)
    const patch = {};
    if (input.project_id !== undefined) {
      const err = new Error('Project assignment cannot be changed after creation.');
      err.status = 400;
      throw err;
    }

    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.priority !== undefined) {
      const priorityNum = Number(input.priority);
      patch.priority = (priorityNum >= 1 && priorityNum <= 10) ? priorityNum : 5;
    }
    if (input.status !== undefined) patch.status = input.status;
    if (input.deadline !== undefined) {
      // Validate deadline is not in the past
      if (input.deadline) {
        const parsedDeadline = new Date(input.deadline);
        if (isNaN(parsedDeadline.getTime())) {
          const err = new Error('Invalid deadline format');
          err.status = 400;
          throw err;
        }
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const deadlineDate = new Date(parsedDeadline.getFullYear(), parsedDeadline.getMonth(), parsedDeadline.getDate());
        if (deadlineDate.getTime() < today.getTime()) {
          const err = new Error('Deadline cannot be in the past');
          err.status = 400;
          throw err;
        }
      }
      patch.deadline = input.deadline || null;
    }
    if (input.archived !== undefined) patch.archived = !!input.archived;
    if (input.tags !== undefined) {
      const tagsArr = Array.isArray(input.tags)
        ? input.tags
        : typeof input.tags === "string" ? input.tags.split(",") : [];
      patch.tags = Array.from(new Set(tagsArr.map(t => String(t).trim()).filter(Boolean)));
    }

    let previousAssigneeIds = null;
    if (input.assigned_to !== undefined) {
      const arr = Array.isArray(input.assigned_to) ? input.assigned_to : [];
      const normalized = arr
        .map(v => (typeof v === 'string' ? v.trim() : v))
        .filter(v => v !== '' && v !== null && v !== undefined)
        .map(Number)
        .filter(Number.isFinite)
        .map(n => Math.trunc(n));
      previousAssigneeIds = await this._getTaskAssigneeIds(taskId);
      const uniqueAssignees = Array.from(new Set(normalized));
      if (uniqueAssignees.length === 0) {
        const err = new Error('A task must have at least one assignee.');
        err.status = 400;
        throw err;
      }

      if (uniqueAssignees.length > TaskService.MAX_ASSIGNEES) {
        const err = new Error(`A task can have at most ${TaskService.MAX_ASSIGNEES} assignees.`);
        err.status = 400;
        throw err;
      }
      patch.assigned_to = uniqueAssignees;
    }

    // Allow updating recurrence fields from the UI (optional)
    if (input.recurrence) {
      const { freq, interval } = input.recurrence || {};
      patch.recurrence_freq = (freq === 'daily' || freq === 'weekly' || freq === 'monthly') ? freq : null;
      patch.recurrence_interval = Math.max(1, Number(interval || 1));
    } else if (input.recurrence === null) {
      patch.recurrence_freq = null;
      patch.recurrence_interval = 1;
    }

    patch.updated_at = new Date().toISOString();

    // ---- Optional permission check (comprehensive path) ----
    let permissionGrantedByHook = false;
    if (!twoArgOverload && requestingUserId && this._canUserUpdateTask) {
      const canUpdate = await this._canUserUpdateTask(currentTask.project_id, requestingUserId, currentTask);
      if (canUpdate === false) {
        const err = new Error('You do not have permission to update this task');
        err.status = 403;
        throw err;
      }
      if (canUpdate === true) {
        permissionGrantedByHook = true;
      }
    }

    if (normalizedRequesterId != null && !requesterWasAssignee && !permissionGrantedByHook) {
      const err = new Error('You must be assigned to the task to update it.');
      err.status = 403;
      throw err;
    }

    // Store previous task for notifications
    const previousTask = { ...currentTask };

    // ---- Do the update ----
    const updated = taskRepository.updateById
      ? await taskRepository.updateById(Number(taskId), patch)
      : await taskRepository.updateTask(Number(taskId), patch);
    const numericTaskId = Number(taskId);

    if (hasHoursUpdate) {
      await taskAssigneeHoursService.recordHours({
        taskId: numericTaskId,
        userId: normalizedRequesterId,
        hours: normalizedHoursInput
      });
    }

    const summaryAssigneeIds = this._normalizeAssigneeIds(updated.assigned_to);
    updated.time_tracking = await taskAssigneeHoursService.getTaskHoursSummary(
      numericTaskId,
      summaryAssigneeIds
    );

    // ---- Send notifications for assignee changes ----
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
            assignedById: normalizedRequesterId ?? null,
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
            assignedById: normalizedRequesterId ?? null,
            previousAssigneeIds: previous,
            currentAssigneeIds: updatedAssignees
          })
          .catch((err) =>
            console.error('Failed to send task removal notifications:', err)
          );
      }
    }

    // ---- Send notifications for other field updates ----
    await this._sendTaskUpdateNotifications({
      previousTask,
      updatedTask: updated,
      updatedFields: Object.keys(patch),
      actorId: normalizedRequesterId ?? null
    });

    // ---- Send task deletion notification if task is being archived ----
    if (patch.archived === true && !previousTask.archived) {
      // Task is being archived (deleted), send notification to assignees
      try {
        // Get deleter information
        let deleterName = 'A team member';
        if (normalizedRequesterId) {
          try {
            const deleter = await userRepository.getUserById(normalizedRequesterId);
            if (deleter) {
              deleterName = deleter.name;
            }
          } catch (err) {
            console.error('Failed to fetch deleter info:', err);
          }
        }

        await notificationService.createTaskDeletedNotification({
          task: previousTask,
          deleterId: normalizedRequesterId,
          deleterName: deleterName
        });
        console.log(`Task deletion notifications sent for archived task ${taskId}`);
      } catch (notificationError) {
        console.error('Failed to send task deletion notifications:', notificationError);
        // Continue with task update even if notification fails
      }
    }

    // ---- Recurrence: spawn a next instance only on transition -> completed ----
    const beforeCompleted = isCompleted(currentTask.status);
    const afterCompleted  = isCompleted(updated.status);

    const hasRecurrence = !!currentTask.recurrence_freq;
    const shouldSpawn = !beforeCompleted && afterCompleted && hasRecurrence;

    if (!shouldSpawn) {
      return updated;
    }

    // Compute the next due date from the PREVIOUS due date (+ interval)
    const freq = currentTask.recurrence_freq;
    const interval = Math.max(1, Number(currentTask.recurrence_interval || 1));
    const baseDue = currentTask.deadline; // NOTE: "previous due date", not completion time.
    const nextDue = addIntervalFromBase(baseDue, freq, interval);

    // Create the new instance (reset status, keep assignments/tags/etc.)
    const seriesId = currentTask.recurrence_series_id || crypto.randomUUID?.() || null;

    const newTaskPayload = {
      title: currentTask.title,
      description: currentTask.description,
      priority: currentTask.priority,
      status: 'pending',
      deadline: nextDue,
      project_id: currentTask.project_id,
      assigned_to: Array.isArray(currentTask.assigned_to) ? currentTask.assigned_to : [],
      tags: Array.isArray(currentTask.tags) ? currentTask.tags : [],
      parent_id: null,
      archived: false,

      recurrence_freq: currentTask.recurrence_freq,
      recurrence_interval: interval,
      recurrence_series_id: seriesId,

      created_at: new Date(),
      updated_at: new Date()
    };

    const newParent = await taskRepository.insert(newTaskPayload);

    // Copy attachments and files from the completed task to the new recurring instance
    try {
      await taskFilesService.copyTaskFiles(
        currentTask.id,
        newParent.id,
        currentTask.assigned_to[0] || normalizedRequesterId
      );
    } catch (fileError) {
      console.error('[recurrence] Failed to copy files to new recurring task:', fileError);
      // Non-blocking - don't fail recurrence if file copy fails
    }

    // Ensure the whole chain shares a series id
    if (!currentTask.recurrence_series_id && seriesId) {
      try {
        await taskRepository.updateById(currentTask.id, { recurrence_series_id: seriesId });
      } catch {/* non-blocking */}
    }

    // ---- Clone subtasks when a parent recurs ----
    try {
      const children = await taskRepository.getSubtasks(currentTask.id);

      if (children.length) {
        const childPayloads = children.map(ch => {
          const base = ch.deadline || baseDue;
          const nextChildDue = addIntervalFromBase(base, freq, interval);

          return {
            title: ch.title,
            description: ch.description,
            priority: ch.priority,
            status: 'pending',
            deadline: nextChildDue,
            project_id: ch.project_id ?? currentTask.project_id,
            assigned_to: Array.isArray(ch.assigned_to) ? ch.assigned_to : [],
            tags: Array.isArray(ch.tags) ? ch.tags : [],
            parent_id: newParent.id,        // attach to the new parent
            archived: false,

            // inherit the parent's recurrence chain
            recurrence_freq: freq,
            recurrence_interval: interval,
            recurrence_series_id: seriesId,

            created_at: new Date(),
            updated_at: new Date()
          };
        });

        await taskRepository.insertMany(childPayloads);
      }
    } catch (e) {
      console.error('[recurrence] cloning subtasks failed:', e);
      // Non-blocking – parent already created
    }

    return updated;
  }


  /**
   * Delete task
   */
  async deleteTask(taskId, requestingUserId) {
    // Get current task before deletion
    const currentTask = await taskRepository.getTaskById(taskId);

    // Check if user can delete the task (project member or manager)
    if (requestingUserId && this._canUserUpdateTask) {
      const canDelete = await this._canUserUpdateTask(currentTask.project_id, requestingUserId, currentTask);
      if (!canDelete) {
        const err = new Error('You do not have permission to delete this task');
        err.status = 403;
        throw err;
      }
    }

    // Get deleter information for notification
    let deleterName = 'A team member';
    if (requestingUserId) {
      try {
        const deleter = await userRepository.getUserById(requestingUserId);
        if (deleter) {
          deleterName = deleter.name;
        }
      } catch (err) {
        console.error('Failed to fetch deleter info:', err);
      }
    }

    // Delete all attachments associated with the task
    try {
      await taskAttachmentService.deleteByTaskId(taskId);
    } catch (attachmentError) {
      console.error('Failed to delete task attachments:', attachmentError);
      // Continue with task deletion even if attachment deletion fails
    }

    // Delete all files from Supabase Storage
    try {
      await taskFilesService.deleteTaskFiles(taskId);
    } catch (fileError) {
      console.error('Failed to delete task files from Supabase:', fileError);
      // Continue with task deletion even if file deletion fails
    }

    // Send deletion notifications before deleting the task
    try {
      await notificationService.createTaskDeletedNotification({
        task: currentTask,
        deleterId: requestingUserId,
        deleterName: deleterName
      });
    } catch (notificationError) {
      console.error('Failed to send task deletion notifications:', notificationError);
      // Continue with task deletion even if notification fails
    }

    return await taskRepository.deleteTask(taskId);
  }

  /**
   * Get subtasks for a parent task
   */
  async getSubtasks(parentId) {
    return await taskRepository.getSubtasks(parentId);
  }

  /**
   * Get tasks with their subtasks
   */
  async getTasksWithSubtasks(filters = {}) {
    const tasks = await taskRepository.getTasksWithFilters(filters);

    // Fetch subtasks for each task
    const tasksWithSubtasks = await Promise.all(
      tasks.map(async (task) => {
        const subtasks = await taskRepository.getSubtasks(task.id);
        return {
          ...task,
          subtasks,
          subtaskCount: subtasks.length
        };
      })
    );

    return tasksWithSubtasks;
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
        tasksByPriority: {
          1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0
        },
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
        low: tasks.filter(t => Number(t.priority) >= 1 && Number(t.priority) <= 3).length,
        medium: tasks.filter(t => Number(t.priority) >= 4 && Number(t.priority) <= 6).length,
        high: tasks.filter(t => Number(t.priority) >= 7 && Number(t.priority) <= 10).length
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
  async _canUserUpdateTask(projectId, userId, task = null) {
    try {
      if (userId == null) {
        return undefined;
      }

      // Fetch user role/hierarchy to evaluate RBAC conditions
      const { data: userRows, error: userError } = await supabase
        .from('users')
        .select('id, role, hierarchy, division')
        .eq('id', userId)
        .limit(1);

      if (userError) {
        console.error('Failed to fetch user for task update permissions:', userError);
        return undefined;
      }

      const user = userRows?.[0];
      if (!user) {
        return undefined;
      }

      const normalizedRole = String(user.role || '').toLowerCase();
      const managerDivision = user.division ? String(user.division).toLowerCase() : null;
      const managerHierarchy = Number(user.hierarchy);

      if (normalizedRole === 'admin') {
        return true;
      }

      if (projectId == null) {
        return undefined;
      }

      // Grant if user already has project-level manager/creator role
      if (projectRepository.canUserManageMembers) {
        try {
          const canManage = await projectRepository.canUserManageMembers(projectId, userId);
          if (canManage) {
            return true;
          }
        } catch (err) {
          console.error('Error checking project membership for task permissions:', err);
        }
      }

      if (normalizedRole !== 'manager') {
        return undefined;
      }

      // Fetch project details to compare against project creator
      let project = null;
      try {
        project = await projectRepository.getProjectById(projectId);
      } catch (err) {
        console.error('Failed to fetch project for task update permissions:', err);
      }

      if (project) {
        if (project.creator_id === userId) {
          return true;
        }

        if (project.creator_id != null) {
          try {
            const { data: creatorRows, error: creatorError } = await supabase
              .from('users')
              .select('id, hierarchy, division')
              .eq('id', project.creator_id)
              .limit(1);
            if (creatorError) {
              console.error('Failed to fetch project creator for task permissions:', creatorError);
            } else {
              const creator = creatorRows?.[0];
              if (creator) {
                const creatorDivision = creator.division ? String(creator.division).toLowerCase() : null;
                const creatorHierarchy = Number(creator.hierarchy);
                const sameDivision =
                  managerDivision != null &&
                  creatorDivision != null &&
                  managerDivision === creatorDivision;
                const higherHierarchy =
                  Number.isFinite(managerHierarchy) &&
                  Number.isFinite(creatorHierarchy) &&
                  managerHierarchy > creatorHierarchy;

                if (sameDivision && higherHierarchy) {
                  return true;
                }
              }
            }
          } catch (err) {
            console.error('Error evaluating project creator permissions for task update:', err);
          }
        }
      }

      // As a fallback, check if any assignee is a subordinate (same division, lower hierarchy)
      if (task) {
        const assigneeIds = this._normalizeAssigneeIds(task.assigned_to);
        if (assigneeIds.length) {
          try {
            const { data: assigneeRows, error: assigneeError } = await supabase
              .from('users')
              .select('id, hierarchy, division')
              .in('id', assigneeIds);

            if (assigneeError) {
              console.error('Failed to fetch task assignees for permission check:', assigneeError);
            } else if (Array.isArray(assigneeRows)) {
              const canManageAssignee = assigneeRows.some((assignee) => {
                const assigneeDivision = assignee.division ? String(assignee.division).toLowerCase() : null;
                if (!managerDivision || !assigneeDivision || managerDivision !== assigneeDivision) {
                  return false;
                }
                const assigneeHierarchy = Number(assignee.hierarchy);
                return Number.isFinite(managerHierarchy) &&
                       Number.isFinite(assigneeHierarchy) &&
                       managerHierarchy > assigneeHierarchy;
              });

              if (canManageAssignee) {
                return true;
              }
            }
          } catch (err) {
            console.error('Error evaluating assignee hierarchy for task update:', err);
          }
        }
      }

      return undefined;
    } catch (error) {
      console.error('Error while checking task update permissions:', error);
      return undefined;
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

  async _sendTaskUpdateNotifications({ previousTask, updatedTask, updatedFields = [], actorId = null }) {
    if (!previousTask || !updatedTask) {
      return;
    }

    const changeDetails = this._calculateTaskUpdateChanges(previousTask, updatedTask, updatedFields);
    if (!Array.isArray(changeDetails) || changeDetails.length === 0) {
      return;
    }

    const assigneeIds = this._normalizeAssigneeIds(
      updatedTask.assigned_to != null ? updatedTask.assigned_to : previousTask.assigned_to
    );

    if (assigneeIds.length === 0) {
      return;
    }

    notificationService
      .createTaskUpdateNotifications({
        task: updatedTask,
        changes: changeDetails,
        updatedById: actorId,
        assigneeIds
      })
      .catch((err) => console.error('Failed to send task update notifications:', err));
  }

  _calculateTaskUpdateChanges(previousTask, updatedTask, updatedFields = []) {
    const trackedFields = TaskService.TRACKED_UPDATE_FIELDS;
    const fieldsToEvaluate = trackedFields.filter((field) =>
      updatedFields.length === 0 || updatedFields.includes(field)
    );

    const changes = [];
    for (const field of fieldsToEvaluate) {
      const before = this._normalizeFieldValue(field, previousTask?.[field]);
      const after = this._normalizeFieldValue(field, updatedTask?.[field]);

      if (this._areValuesEqual(before, after)) {
        continue;
      }

      changes.push({
        field,
        label: TaskService.FIELD_LABELS[field] || field,
        before: this._formatFieldValueForChange(field, previousTask?.[field]),
        after: this._formatFieldValueForChange(field, updatedTask?.[field])
      });
    }
    return changes;
  }

  _normalizeFieldValue(field, value) {
    if (value === undefined) {
      return undefined;
    }

    switch (field) {
      case 'title':
      case 'description':
        return value == null ? '' : String(value).trim();
      case 'priority':
      case 'status':
        return value == null ? null : String(value).toLowerCase();
      case 'deadline': {
        if (!value) return null;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
      }
      case 'project_id':
        return value == null ? null : Number(value);
      case 'archived':
        return Boolean(value);
      case 'tags': {
        const arr = Array.isArray(value)
          ? value
          : typeof value === 'string'
            ? value.split(',')
            : [];
        return arr
          .map((t) => String(t).trim())
          .filter(Boolean)
          .map((t) => t.toLowerCase())
          .sort()
          .join('|');
      }
      default:
        return value;
    }
  }

  _areValuesEqual(a, b) {
    return a === b;
  }

  _formatFieldValueForChange(field, value) {
    if (value === undefined || value === null) {
      return 'None';
    }

    switch (field) {
      case 'deadline': {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
      }
      case 'archived':
        return value ? 'Archived' : 'Active';
      case 'tags': {
        const arr = Array.isArray(value)
          ? value
          : typeof value === 'string'
            ? value.split(',')
            : [];
        const normalized = arr
          .map((t) => String(t).trim())
          .filter(Boolean);
        return normalized.length ? normalized.join(', ') : 'None';
      }
      case 'description': {
        const text = String(value).trim();
        if (!text) return 'None';
        return text.length > 120 ? `${text.slice(0, 117)}...` : text;
      }
      default:
        return String(value);
    }
  }

  /**
   * Get accessible project IDs based on user role and RBAC rules
   * @private
   */
  async _getAccessibleProjectIds(userId, userRole, userHierarchy, userDivision) {
    try {
      // Admin can access all projects
      if (userRole === 'admin') {
        const { data, error } = await supabase
          .from('projects')
          .select('id');

        if (error) throw error;
        return data ? data.map(p => p.id) : [];
      }

      // Get projects where user is a member
      const { data: memberData, error: memberError } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', userId);

      if (memberError) throw memberError;
      const memberProjectIds = memberData ? memberData.map(m => m.project_id) : [];

      // Get projects created by user
      const { data: creatorData, error: creatorError } = await supabase
        .from('projects')
        .select('id')
        .eq('creator_id', userId);

      if (creatorError) throw creatorError;
      const creatorProjectIds = creatorData ? creatorData.map(p => p.id) : [];

      // For managers, also get projects from subordinates in same division
      let subordinateProjectIds = [];
      if (userRole === 'manager' && userDivision) {
        const { data: projectsData, error: projectsError } = await supabase
          .from('projects')
          .select('id, creator_id, users!inner(role, hierarchy, division)')
          .eq('users.division', userDivision)
          .lt('users.hierarchy', userHierarchy);

        if (!projectsError && projectsData) {
          subordinateProjectIds = projectsData.map(p => p.id);
        }
      }

      // Combine and deduplicate all accessible project IDs
      const allProjectIds = [...new Set([
        ...memberProjectIds,
        ...creatorProjectIds,
        ...subordinateProjectIds
      ])];

      return allProjectIds;
    } catch (error) {
      console.error('Error getting accessible project IDs:', error);
      return [];
    }
  }

  /**
   * Filter tasks based on RBAC rules
   * @private
   */
  async _filterTasksByRBAC(tasks, userId, userRole, userHierarchy, userDivision, userDepartment) {
    const normalizedRole = String(userRole || '').toLowerCase();
    const normalizedDepartment = String(userDepartment || '').trim().toLowerCase();

    if (normalizedRole === 'admin' || normalizedDepartment === 'hr team') {
      return tasks;
    }

    let subordinateUserIds = [];
    if (
      normalizedRole === 'manager' &&
      Number.isFinite(Number(userHierarchy)) &&
      userDivision
    ) {
      subordinateUserIds = await this._getSubordinateUserIds(
        Number(userHierarchy),
        userDivision
      );
    }

    const accessibleProjectIdsRaw = await this._getAccessibleProjectIds(
      userId,
      userRole,
      userHierarchy,
      userDivision
    );
    const accessibleProjectIds = Array.isArray(accessibleProjectIdsRaw)
      ? accessibleProjectIdsRaw
          .map((value) => Number(value))
          .filter(Number.isFinite)
          .map((value) => Math.trunc(value))
      : [];

    let membershipProjectIds = [];
    if (normalizedRole === 'staff') {
      const membershipRaw = await this._getProjectMemberships(userId);
      membershipProjectIds = Array.isArray(membershipRaw)
        ? membershipRaw
            .map((value) => Number(value))
            .filter(Number.isFinite)
            .map((value) => Math.trunc(value))
        : [];
    }

    return tasks.filter(task => {
      const projectId = Number(task.project_id ?? task.projectId);
      const rawAssignees = Array.isArray(task.assigned_to)
        ? task.assigned_to
        : Array.isArray(task.assignees)
          ? task.assignees.map((assignee) => assignee?.id)
          : task.assigned_to != null
            ? [task.assigned_to]
            : [];
      const assigneeIds = this._normalizeAssigneeIds(rawAssignees);

      // Admin/manager accessible project checks (also covers staff membership if supabase provided)
      if (Number.isFinite(projectId) && accessibleProjectIds.includes(projectId)) {
        return true;
      }

      // Personal tasks (no project) assigned to user
      if (!Number.isFinite(projectId) && assigneeIds.includes(userId)) {
        return true;
      }

      // Tasks explicitly assigned to user
      if (assigneeIds.includes(userId)) {
        return true;
      }

      // Staff can view tasks within their project memberships
      if (normalizedRole === 'staff' &&
          Number.isFinite(projectId) &&
          membershipProjectIds.includes(projectId)) {
        return true;
      }

      if (
        normalizedRole === 'manager' &&
        subordinateUserIds.length &&
        assigneeIds.some((assigneeId) => subordinateUserIds.includes(assigneeId))
      ) {
        return true;
      }

      return false;
    });
  }

  async _getProjectMemberships(userId) {
    try {
      if (!Number.isFinite(Number(userId))) {
        return [];
      }
      return await projectMemberRepository.getProjectIdsForUser(Number(userId));
    } catch (error) {
      console.error('Error fetching project memberships:', error);
      return [];
    }
  }

  async _getSubordinateUserIds(userHierarchy, userDivision) {
    try {
      if (!Number.isFinite(Number(userHierarchy)) || !userDivision) {
        return [];
      }

      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('division', userDivision)
        .lt('hierarchy', Number(userHierarchy));

      if (error) {
        throw error;
      }

      return Array.isArray(data)
        ? data
            .map((row) => Number(row?.id))
            .filter(Number.isFinite)
            .map((value) => Math.trunc(value))
        : [];
    } catch (error) {
      console.error('Error fetching subordinate user ids:', error);
      return [];
    }
  }
}

TaskService.MAX_ASSIGNEES = 5;
TaskService.TRACKED_UPDATE_FIELDS = [
  'title',
  'description',
  'priority',
  'status',
  'deadline',
  'project_id',
  'archived',
  'tags'
];
TaskService.FIELD_LABELS = {
  title: 'Title',
  description: 'Description',
  priority: 'Priority',
  status: 'Status',
  deadline: 'Deadline',
  project_id: 'Project',
  archived: 'Archived',
  tags: 'Tags'
};

module.exports = new TaskService();
