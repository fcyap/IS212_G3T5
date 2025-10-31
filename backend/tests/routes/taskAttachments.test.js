const express = require('express');
const request = require('supertest');

// Mock multer before requiring the router
jest.mock('multer', () => {
  const multerMock = jest.fn(() => ({
    array: jest.fn((fieldName, maxCount) => (req, res, next) => next()),
    single: jest.fn((fieldName) => (req, res, next) => next())
  }));
  multerMock.memoryStorage = jest.fn(() => ({}));
  return multerMock;
});

// Mock auth middleware before requiring the router
jest.mock('../../src/middleware/auth', () => ({
  authMiddleware: jest.fn(() => (req, res, next) => next())
}));

const taskAttachmentsRouter = require('../../src/routes/taskAttachments');
const taskAttachmentController = require('../../src/controllers/taskAttachmentController');

jest.mock('../../src/controllers/taskAttachmentController');

describe('Task Attachments Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    
    // Mock authentication middleware
    app.use((req, res, next) => {
      req.user = { id: 1, role: 'staff' };
      res.locals.session = { user_id: 1, role: 'staff' };
      next();
    });
    
    app.use('/api/tasks/:taskId/attachments', taskAttachmentsRouter);
  });

  describe('POST /api/tasks/:taskId/attachments', () => {
    test('should call uploadAttachments controller', async () => {
      taskAttachmentController.uploadAttachments = jest.fn((req, res) => {
        res.status(201).json({
          attachments: [],
          totalSize: 0
        });
      });

      const response = await request(app)
        .post('/api/tasks/123/attachments')
        .attach('files', Buffer.from('test'), 'test.pdf');

      expect(response.status).toBe(201);
      expect(taskAttachmentController.uploadAttachments).toHaveBeenCalled();
    });

    test('should require authentication', async () => {
      const appWithoutAuth = express();
      appWithoutAuth.use(express.json());
      appWithoutAuth.use('/api/tasks/:taskId/attachments', taskAttachmentsRouter);

      const response = await request(appWithoutAuth)
        .post('/api/tasks/123/attachments')
        .attach('files', Buffer.from('test'), 'test.pdf');

      // Without auth middleware, request should be rejected
      expect(response.status).toBeGreaterThanOrEqual(401);
    });
  });

  describe('GET /api/tasks/:taskId/attachments', () => {
    test('should call getAttachments controller', async () => {
      taskAttachmentController.getAttachments = jest.fn((req, res) => {
        res.json({
          attachments: [
            {
              id: 1,
              task_id: 123,
              file_name: 'document.pdf',
              file_type: 'application/pdf',
              file_size: 5242880,
              file_url: 'https://storage.example.com/attachments/123/document.pdf',
              uploaded_by: 1,
              uploaded_at: '2025-10-20T10:00:00Z'
            }
          ],
          totalSize: 5242880
        });
      });

      const response = await request(app)
        .get('/api/tasks/123/attachments');

      expect(response.status).toBe(200);
      expect(taskAttachmentController.getAttachments).toHaveBeenCalled();
      expect(response.body.attachments).toHaveLength(1);
    });

    test('should handle invalid task ID', async () => {
      taskAttachmentController.getAttachments = jest.fn((req, res) => {
        res.status(400).json({ error: 'Invalid task ID' });
      });

      const response = await request(app)
        .get('/api/tasks/invalid/attachments');

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/tasks/:taskId/attachments/:attachmentId', () => {
    test('should call deleteAttachment controller', async () => {
      taskAttachmentController.deleteAttachment = jest.fn((req, res) => {
        res.json({ message: 'Attachment deleted successfully' });
      });

      const response = await request(app)
        .delete('/api/tasks/123/attachments/1');

      expect(response.status).toBe(200);
      expect(taskAttachmentController.deleteAttachment).toHaveBeenCalled();
    });

    test('should handle unauthorized deletion attempt', async () => {
      taskAttachmentController.deleteAttachment = jest.fn((req, res) => {
        res.status(403).json({ error: 'Unauthorized to delete this attachment' });
      });

      const response = await request(app)
        .delete('/api/tasks/123/attachments/1');

      expect(response.status).toBe(403);
    });

    test('should handle attachment not found', async () => {
      taskAttachmentController.deleteAttachment = jest.fn((req, res) => {
        res.status(404).json({ error: 'Attachment not found' });
      });

      const response = await request(app)
        .delete('/api/tasks/123/attachments/999');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/tasks/:taskId/attachments/:attachmentId/download', () => {
    test('should call downloadAttachment controller', async () => {
      taskAttachmentController.downloadAttachment = jest.fn((req, res) => {
        res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="document.pdf"'
        });
        res.send(Buffer.from('mock file content'));
      });

      const response = await request(app)
        .get('/api/tasks/123/attachments/1/download');

      expect(response.status).toBe(200);
      expect(taskAttachmentController.downloadAttachment).toHaveBeenCalled();
      expect(response.headers['content-type']).toContain('application/pdf');
    });

    test('should handle file not found in storage', async () => {
      taskAttachmentController.downloadAttachment = jest.fn((req, res) => {
        res.status(404).json({ error: 'File not found in storage' });
      });

      const response = await request(app)
        .get('/api/tasks/123/attachments/1/download');

      expect(response.status).toBe(404);
    });
  });

  describe('Route parameter validation', () => {
    test('should accept numeric task IDs', async () => {
      taskAttachmentController.getAttachments = jest.fn((req, res) => {
        res.json({ attachments: [], totalSize: 0 });
      });

      const response = await request(app)
        .get('/api/tasks/12345/attachments');

      expect(response.status).toBe(200);
      expect(taskAttachmentController.getAttachments).toHaveBeenCalled();
    });

    test('should accept numeric attachment IDs', async () => {
      taskAttachmentController.deleteAttachment = jest.fn((req, res) => {
        res.json({ message: 'Deleted' });
      });

      const response = await request(app)
        .delete('/api/tasks/123/attachments/456');

      expect(response.status).toBe(200);
      expect(taskAttachmentController.deleteAttachment).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    test('should handle controller errors gracefully', async () => {
      taskAttachmentController.uploadAttachments = jest.fn((req, res) => {
        res.status(500).json({ error: 'Internal server error' });
      });

      const response = await request(app)
        .post('/api/tasks/123/attachments')
        .attach('files', Buffer.from('test'), 'test.pdf');

      expect(response.status).toBe(500);
    });

    test('should handle missing required parameters', async () => {
      taskAttachmentController.uploadAttachments = jest.fn((req, res) => {
        res.status(400).json({ error: 'No files provided' });
      });

      const response = await request(app)
        .post('/api/tasks/123/attachments');

      expect(response.status).toBe(400);
    });
  });

  describe('Middleware integration', () => {
    test('should pass user context to controller', async () => {
      let capturedReq;
      taskAttachmentController.uploadAttachments = jest.fn((req, res) => {
        capturedReq = req;
        res.status(201).json({ attachments: [], totalSize: 0 });
      });

      await request(app)
        .post('/api/tasks/123/attachments')
        .attach('files', Buffer.from('test'), 'test.pdf');

      expect(capturedReq.user).toBeDefined();
      expect(capturedReq.user.id).toBe(1);
    });

    test('should pass task ID from route params', async () => {
      let capturedReq;
      taskAttachmentController.getAttachments = jest.fn((req, res) => {
        capturedReq = req;
        res.json({ attachments: [], totalSize: 0 });
      });

      await request(app)
        .get('/api/tasks/123/attachments');

      expect(capturedReq.params.taskId).toBe('123');
    });
  });
});
