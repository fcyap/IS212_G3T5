const request = require('supertest');
const express = require('express');

jest.mock('../../src/middleware/auth', () => ({
  authMiddleware: () => (req, _res, next) => {
    req.user = req.user || null;
    next();
  },
}));

const mockCommentService = {
  listThread: jest.fn(),
  addComment: jest.fn(),
  editComment: jest.fn(),
  deleteComment: jest.fn(),
};

jest.mock('../../src/services/tasks/taskCommentService', () => ({
  taskCommentService: mockCommentService,
  TaskCommentService: function () {
    return mockCommentService;
  },
}));

const taskCommentRoutes = require('../../src/routes/tasks/taskCommentRoute');

describe('Task comment routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = { id: 1, department: 'HR Team' };
      next();
    });
    app.use('/api/tasks', taskCommentRoutes);
  });

  test('DELETE /api/tasks/comments/:commentId allows HR Team user', async () => {
    mockCommentService.deleteComment.mockResolvedValue({ success: true, deletedReplies: true });

    const res = await request(app)
      .delete('/api/tasks/comments/10')
      .expect(200);

    expect(mockCommentService.deleteComment).toHaveBeenCalledWith({
      id: '10',
      requester: { id: 1, department: 'HR Team' },
    });
    expect(res.body.success).toBe(true);
    expect(res.body.deletedReplies).toBe(true);
  });

  test('DELETE /api/tasks/comments/:commentId rejects non-admin department', async () => {
    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = { id: 2, department: 'Engineering' };
      next();
    });
    app.use('/api/tasks', taskCommentRoutes);

    mockCommentService.deleteComment.mockRejectedValue({ message: 'Only admins can delete comments', httpCode: 403 });

    const res = await request(app)
      .delete('/api/tasks/comments/11')
      .expect(403);

    expect(mockCommentService.deleteComment).toHaveBeenCalledWith({
      id: '11',
      requester: { id: 2, department: 'Engineering' },
    });
    expect(res.body.error).toBe('Only admins can delete comments');
  });

  test('DELETE /api/tasks/comments/:commentId surfaces service errors', async () => {
    mockCommentService.deleteComment.mockRejectedValue({ message: 'Comment not found', httpCode: 404 });

    const res = await request(app)
      .delete('/api/tasks/comments/999')
      .expect(404);

    expect(res.body.error).toBe('Comment not found');
  });
});
