// src/controllers/tasks/taskCommentController.js (CommonJS)

// Lazily obtain the service whether it's CommonJS or ESM
let _servicePromise;
async function getService() {
  if (_servicePromise) return _servicePromise;

  try {
    // Try CommonJS first
    const svc = require('../../services/tasks/taskCommentService');
    const instance = svc.taskCommentService || new svc.TaskCommentService();
    _servicePromise = Promise.resolve(instance);
  } catch (err) {
    if (err.code !== 'ERR_REQUIRE_ESM') throw err;
    // Fallback: ESM import
    _servicePromise = import('../../services/tasks/taskCommentService.js')
      .then(mod => mod.taskCommentService || new mod.TaskCommentService());
  }

  return _servicePromise;
}

async function listForTask(taskId) {
  const service = await getService();
  return service.listThread(taskId);
}

async function createForTask(taskId, body) {
  const service = await getService();
  const { content, userId, parentId = null } = body;
  return service.addComment({ taskId, content, userId, parentId });
}

async function updateComment(commentId, body) {
  const service = await getService();
  const { content, userId } = body;
  return service.editComment({ id: commentId, content, userId });
}

module.exports = { listForTask, createForTask, updateComment };
