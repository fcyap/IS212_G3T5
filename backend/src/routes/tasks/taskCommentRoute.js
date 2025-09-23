// src/routes/tasks/taskCommentRoute.js
const express = require('express');
const router = express.Router();

const {
  listForTask,
  createForTask,
  updateComment,
} = require('../../controllers/tasks/taskCommentController');

// inline validator middleware
const validate = (keys = []) => (req, res, next) => {
  const missing = keys.filter(k => {
    const v = req.body?.[k];
    return v == null || (typeof v === 'string' && !v.trim());
  });
  return missing.length
    ? res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` })
    : next();
};

// GET /api/tasks/:taskId/comments
router.get('/:taskId/comments', async (req, res) => {
  try {
    const data = await listForTask(req.params.taskId);
    res.json(data);
  } catch (e) {
    res.status(e.httpCode || 400).json({ error: e.message || 'Bad request' });
  }
});

// POST /api/tasks/:taskId/comments
router.post(
  '/:taskId/comments',
  validate(['content', 'userId']),
  async (req, res) => {
    try {
      const created = await createForTask(req.params.taskId, req.body);
      res.status(201).json(created);
    } catch (e) {
      const code = /required|must be|Invalid JSON/i.test(e.message) ? 400 : (e.httpCode || 500);
      res.status(code).json({ error: e.message || 'Server error' });
    }
  }
);

// PATCH /api/comments/:commentId
router.patch(
  '/comments/:commentId',
  validate(['content', 'userId']),
  async (req, res) => {
    try {
      const updated = await updateComment(req.params.commentId, req.body);
      res.json(updated);
    } catch (e) {
      const msg = e.message || 'Server error';
      const code =
        msg.includes('Only the original author') ? 403 :
        msg.includes('not found') ? 404 :
        (e.httpCode || 400);
      res.status(code).json({ error: msg });
    }
  }
);

module.exports = router;
