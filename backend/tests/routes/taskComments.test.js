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
  canUserComment: jest.fn(),
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
      req.user = { id: 1, role: 'hr', department: 'HR Team' };
      next();
    });
    app.use('/api/tasks', taskCommentRoutes);
  });

  test('DELETE /api/tasks/comments/:commentId allows HR role user', async () => {
    mockCommentService.deleteComment.mockResolvedValue({ success: true, deletedReplies: true });

    const res = await request(app)
      .delete('/api/tasks/comments/10')
      .expect(200);

    expect(mockCommentService.deleteComment).toHaveBeenCalledWith({
      id: '10',
      requester: { id: 1, role: 'hr', department: 'HR Team' },
    });
    expect(res.body.success).toBe(true);
    expect(res.body.deletedReplies).toBe(true);
  });

  test('DELETE /api/tasks/comments/:commentId rejects non-privileged role', async () => {
    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = { id: 2, role: 'staff', department: 'Engineering' };
      next();
    });
    app.use('/api/tasks', taskCommentRoutes);

    mockCommentService.deleteComment.mockRejectedValue({ message: 'Only admins or HR can delete comments', httpCode: 403 });

    const res = await request(app)
      .delete('/api/tasks/comments/11')
      .expect(403);

    expect(mockCommentService.deleteComment).toHaveBeenCalledWith({
      id: '11',
      requester: { id: 2, role: 'staff', department: 'Engineering' },
    });
    expect(res.body.error).toBe('Only admins or HR can delete comments');
  });

  test('DELETE /api/tasks/comments/:commentId surfaces service errors', async () => {
    mockCommentService.deleteComment.mockRejectedValue({ message: 'Comment not found', httpCode: 404 });

    const res = await request(app)
      .delete('/api/tasks/comments/999')
      .expect(404);

    expect(res.body.error).toBe('Comment not found');
  });

  test('GET /api/tasks/:taskId/comments returns thread and ability flag', async () => {
    mockCommentService.listThread.mockResolvedValue([{ id: 1 }]);
    mockCommentService.canUserComment.mockResolvedValue(true);

    const res = await request(app)
      .get('/api/tasks/5/comments')
      .expect(200);

    expect(mockCommentService.listThread).toHaveBeenCalledWith('5');
    expect(mockCommentService.canUserComment).toHaveBeenCalledWith('5', { id: 1, role: 'hr', department: 'HR Team' });
    expect(res.body).toEqual({ comments: [{ id: 1 }], canComment: true });
  });

  test('GET /api/tasks/:taskId/comments sets canComment false when service denies', async () => {
    mockCommentService.listThread.mockResolvedValue([]);
    mockCommentService.canUserComment.mockResolvedValue(false);

    const res = await request(app)
      .get('/api/tasks/7/comments')
      .expect(200);

    expect(res.body.canComment).toBe(false);
  });

  test('POST /api/tasks/:taskId/comments succeeds when service creates comment', async () => {
    mockCommentService.addComment.mockResolvedValue({ id: 55, content: 'hello' });

    const res = await request(app)
      .post('/api/tasks/9/comments')
      .send({ content: 'hello', userId: 1 })
      .expect(201);

    expect(mockCommentService.addComment).toHaveBeenCalledWith({
      taskId: '9',
      content: 'hello',
      userId: 1,
      parentId: null,
    });
    expect(res.body).toMatchObject({ id: 55, content: 'hello' });
  });

  test('POST /api/tasks/:taskId/comments returns 403 when service rejects', async () => {
    mockCommentService.addComment.mockRejectedValue({ httpCode: 403, message: 'You do not have permission to comment on this task' });

    const res = await request(app)
      .post('/api/tasks/10/comments')
      .send({ content: 'nope', userId: 1 })
      .expect(403);

    expect(mockCommentService.addComment).toHaveBeenCalledWith({
      taskId: '10',
      content: 'nope',
      userId: 1,
      parentId: null,
    });
    expect(res.body.error).toBe('You do not have permission to comment on this task');
  });

  test('POST /api/tasks/:taskId/comments returns 400 for missing required fields', async () => {
    const res = await request(app)
      .post('/api/tasks/11/comments')
      .send({})
      .expect(400);

    expect(res.body.error).toMatch('Missing required fields');
    expect(mockCommentService.addComment).not.toHaveBeenCalled();
  });
});
