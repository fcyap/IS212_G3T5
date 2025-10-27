// src/services/tasks/taskCommentService.js (CommonJS)
const { taskCommentRepository } = require('../../repository/tasks/taskCommentRepository');
const notificationService = require('../notificationService');

// tiny helper to attach HTTP status codes to plain Errors
const httpError = (code, message) => Object.assign(new Error(message), { httpCode: code });

class TaskCommentService {
  constructor(repo = new taskCommentRepository()) {
    this.repo = repo;
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
      
      console.log(`Comment notification triggered for task ${taskId}, comment ${created.id}`);
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

    const role = String(requester?.role || requester?.roleName || requester?.role_label || '').toLowerCase();
    const department = String(requester?.department || '').trim().toLowerCase();
    if (role !== 'admin' && department !== 'hr team') {
      throw httpError(403, 'Only admins can delete comments');
    }

    const result = await this.repo.deleteCascade(numericId);
    return { success: true, ...result };
  }
}

module.exports = {
  taskCommentService: new TaskCommentService(),
  TaskCommentService,
};
