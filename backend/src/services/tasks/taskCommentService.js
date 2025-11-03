// src/services/tasks/taskCommentService.js (CommonJS)
const { taskCommentRepository } = require('../../repository/tasks/taskCommentRepository');
const notificationService = require('../notificationService');

// tiny helper to attach HTTP status codes to plain Errors
const httpError = (code, message) => Object.assign(new Error(message), { httpCode: code });

class TaskCommentService {
  constructor(repo = new taskCommentRepository()) {
    this.repo = repo;
  }

  async _getUserContext(userId) {
    if (!userId) return null;
    const { supabase } = require('../../supabase-client');
    const { data, error } = await supabase
      .from('users')
      .select('id, role, hierarchy, division, department')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[TaskCommentService] Failed to fetch user context:', error);
      return null;
    }

    return data;
  }

  async _getSubordinateUserIds(userHierarchy, userDivision) {
    try {
      if (!Number.isFinite(Number(userHierarchy)) || !userDivision) {
        return [];
      }

      const { supabase } = require('../../supabase-client');
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
            .map((row) => row?.id)
            .filter((value) => value != null)
            .map((value) => String(value).trim())
            .filter(Boolean)
        : [];
    } catch (error) {
      console.error('[TaskCommentService] Error fetching subordinate user ids:', error);
      return [];
    }
  }

  async _canUserCommentOnTask(taskId, requester) {
    if (!requester) return false;
    const { supabase } = require('../../supabase-client');

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('project_id, assigned_to')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      console.error('[TaskCommentService] Failed to fetch task for comment permissions:', taskError);
      return false;
    }

    const assignedIds = Array.isArray(task.assigned_to)
      ? task.assigned_to
          .map((value) => (value == null ? null : String(value).trim()))
          .filter(Boolean)
      : [];
    const requesterId = requester?.id == null ? null : String(requester.id).trim();
    const normalizedRole = String(
      requester.role ?? requester.roleName ?? requester.role_label ?? ''
    )
      .trim()
      .toLowerCase();

    if (normalizedRole === 'admin' || normalizedRole === 'hr') {
      return true;
    }

    if (requesterId && assignedIds.includes(requesterId)) {
      return true;
    }

    if (normalizedRole === 'manager') {
      const subordinateIds = await this._getSubordinateUserIds(
        requester.hierarchy,
        requester.division
      );
      if (
        subordinateIds.length > 0 &&
        assignedIds.some((assigneeId) => subordinateIds.includes(assigneeId))
      ) {
        return true;
      }
    }

    return false;
  }

  async canUserComment(taskId, requester) {
    if (!taskId) return false;
    let context = requester;
    if (!context || context.id == null) {
      return false;
    }

    if (
      context.role === undefined ||
      context.department === undefined ||
      context.hierarchy === undefined ||
      context.division === undefined
    ) {
      context = await this._getUserContext(context.id);
    }

    if (!context) return false;
    return this._canUserCommentOnTask(taskId, context);
  }

  buildTree(rows) {
    const map = new Map();
    rows.forEach(r => map.set(r.id, { ...this.rowToVM(r), replies: [] }));
    const roots = [];
    map.forEach(node => {
      if (node.parentId) {
        const parent = map.get(node.parentId);
        if (parent) parent.replies.push(node);
      } else {
        roots.push(node);
      }
    });
    roots.sort((a, b) => b.timestamp - a.timestamp);
    return roots;
  }

  rowToVM(row) {
    return {
      id: row.id,
      content: row.content,
      user: {
        id: row.user_id,
        name: row.users?.name,
        initials: this.initials(row.users?.name)
      },
      timestamp: new Date(row.created_at).getTime(),
      parentId: row.parent_id,
      taskId: row.task_id,
      edited: !!row.edited,
    };
  }

  initials(name) {
    return String(name).split(' ').filter(Boolean).map(p => p[0].toUpperCase()).join('').slice(0, 2);
  }

  async listThread(taskId) {
    if (!taskId) throw httpError(400, 'taskId is required');
    const flat = await this.repo.getByTask(taskId);
    return this.buildTree(flat);
  }

  async addComment({ taskId, content, userId, parentId = null }) {
    if (!taskId) throw httpError(400, 'taskId is required');
    if (!content?.trim()) throw httpError(400, 'content is required');
    if (!userId) throw httpError(400, 'userId is required');

    const requester = await this._getUserContext(userId);
    const access = await this._canUserCommentOnTask(taskId, requester);
    if (!access) {
      throw httpError(403, 'You do not have permission to comment on this task');
    }

    // Create comment in database
    const created = await this.repo.create({
      taskId,
      content: content.trim(),
      userId: userId,
      parentId,
    });

    // Trigger notification asynchronously (don't block comment creation)
    try {
      // Get commenter name from the created comment object
      const commenterName = created.users?.name || 'Unknown User';
      
      await notificationService.createCommentNotification({
        taskId,
        commentId: created.id,
        commentContent: content.trim(),
        commenterId: userId,
        commenterName: commenterName
      });
      
      // Sanitize user-controlled values to prevent log injection
      const sanitize = (str) => String(str || '').replace(/[\n\r]/g, '');
      const sanitizedTaskId = sanitize(taskId);
      console.log('Comment notification triggered for task', sanitizedTaskId, 'comment', created.id);
    } catch (notificationError) {
      // Log but don't fail the comment creation if notification fails
      console.error('Failed to send comment notification:', notificationError);
    }

    return this.rowToVM(created);
  }

  async editComment({ id, content, userId }) {
    if (!id) throw httpError(400, 'comment id is required');
    const existing = await this.repo.getById(id);
    if (!existing) throw httpError(404, 'Comment not found');

    if (existing.user_id !== userId) {
      throw httpError(403, 'Only the original author can edit this comment');
    }

    const updated = await this.repo.update({ id, content: content?.trim() || '' });
    return this.rowToVM(updated);
  }

  async deleteComment({ id, requester }) {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) throw httpError(400, 'comment id is required');
    const existing = await this.repo.getById(numericId);
    if (!existing) throw httpError(404, 'Comment not found');

    const role = String(requester?.role || requester?.roleName || requester?.role_label || '')
      .trim()
      .toLowerCase();
    if (role !== 'admin' && role !== 'hr') {
      throw httpError(403, 'Only admins or HR can delete comments');
    }

    const result = await this.repo.deleteCascade(numericId);
    return { success: true, ...result };
  }
}

module.exports = {
  taskCommentService: new TaskCommentService(),
  TaskCommentService,
};
