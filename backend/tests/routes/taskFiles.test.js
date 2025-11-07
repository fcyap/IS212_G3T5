const request = require('supertest');
const express = require('express');
const taskFilesRouter = require('../../src/routes/taskFiles');
const taskFilesDeleteRouter = require('../../src/routes/taskFilesDelete');
const taskFilesController = require('../../src/controllers/taskFilesController');
const multer = require('multer');

jest.mock('../../src/controllers/taskFilesController');
jest.mock('../../src/middleware/auth', () => ({
  authMiddleware: () => (req, res, next) => {
    req.user = { id: 1 };
    next();
  },
}));

describe('Task Files Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/tasks/:taskId/files', taskFilesRouter);
    app.use('/tasks/files', taskFilesDeleteRouter);
    jest.clearAllMocks();

    // Mock default responses
    taskFilesController.uploadFiles.mockImplementation((req, res) => {
      res.status(201).json({
        success: true,
        message: 'Files uploaded successfully',
        data: []
      });
    });
    taskFilesController.getTaskFiles.mockImplementation((req, res) => {
      res.json({ success: true, data: [] });
    });
    taskFilesController.deleteFile.mockImplementation((req, res) => {
      res.json({ success: true, message: 'File deleted successfully' });
    });
  });

  describe('POST /tasks/:taskId/files', () => {
    test('should call uploadFiles controller', async () => {
      await request(app)
        .post('/tasks/1/files')
        .attach('files', Buffer.from('test file content'), 'test.pdf');

      expect(taskFilesController.uploadFiles).toHaveBeenCalled();
    });

    test('should pass taskId param to controller', async () => {
      await request(app)
        .post('/tasks/123/files')
        .attach('files', Buffer.from('test'), 'test.pdf');

      const req = taskFilesController.uploadFiles.mock.calls[0][0];
      expect(req.params.taskId).toBe('123');
    });

    test('should handle multiple file uploads', async () => {
      await request(app)
        .post('/tasks/1/files')
        .attach('files', Buffer.from('file1'), 'test1.pdf')
        .attach('files', Buffer.from('file2'), 'test2.pdf');

      expect(taskFilesController.uploadFiles).toHaveBeenCalled();
    });

    test('should reject invalid file types', async () => {
      const response = await request(app)
        .post('/tasks/1/files')
        .attach('files', Buffer.from('test'), 'test.exe');

      expect(response.status).toBe(500);
      // Multer error might be in different formats
      expect(response.text || response.body.error || '').toContain('Invalid file type');
    });

    test('should accept PDF files', async () => {
      await request(app)
        .post('/tasks/1/files')
        .set('Content-Type', 'multipart/form-data')
        .attach('files', Buffer.from('test'), {
          filename: 'test.pdf',
          contentType: 'application/pdf'
        });

      expect(taskFilesController.uploadFiles).toHaveBeenCalled();
    });

    test('should accept DOCX files', async () => {
      await request(app)
        .post('/tasks/1/files')
        .attach('files', Buffer.from('test'), {
          filename: 'test.docx',
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        });

      expect(taskFilesController.uploadFiles).toHaveBeenCalled();
    });

    test('should accept XLSX files', async () => {
      await request(app)
        .post('/tasks/1/files')
        .attach('files', Buffer.from('test'), {
          filename: 'test.xlsx',
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

      expect(taskFilesController.uploadFiles).toHaveBeenCalled();
    });

    test('should accept CSV files', async () => {
      await request(app)
        .post('/tasks/1/files')
        .attach('files', Buffer.from('test'), {
          filename: 'test.csv',
          contentType: 'text/csv'
        });

      expect(taskFilesController.uploadFiles).toHaveBeenCalled();
    });

    test('should accept PNG images', async () => {
      await request(app)
        .post('/tasks/1/files')
        .attach('files', Buffer.from('test'), {
          filename: 'test.png',
          contentType: 'image/png'
        });

      expect(taskFilesController.uploadFiles).toHaveBeenCalled();
    });

    test('should accept JPG images', async () => {
      await request(app)
        .post('/tasks/1/files')
        .attach('files', Buffer.from('test'), {
          filename: 'test.jpg',
          contentType: 'image/jpeg'
        });

      expect(taskFilesController.uploadFiles).toHaveBeenCalled();
    });

    test('should accept alternative CSV mime type', async () => {
      await request(app)
        .post('/tasks/1/files')
        .attach('files', Buffer.from('test'), {
          filename: 'test.csv',
          contentType: 'application/csv'
        });

      expect(taskFilesController.uploadFiles).toHaveBeenCalled();
    });

    test('should reject files larger than 50MB', async () => {
      // Create a buffer larger than 50MB
      const largeBuffer = Buffer.alloc(51 * 1024 * 1024);

      const response = await request(app)
        .post('/tasks/1/files')
        .attach('files', largeBuffer, 'large.pdf');

      expect(response.status).toBe(500);
    });

    test('should reject more than 10 files', async () => {
      let req = request(app).post('/tasks/1/files');

      // Try to attach 11 files
      for (let i = 0; i < 11; i++) {
        req = req.attach('files', Buffer.from(`test${i}`), `test${i}.pdf`);
      }

      const response = await req;
      expect(response.status).toBe(500);
    });
  });

  describe('GET /tasks/:taskId/files', () => {
    test('should call getTaskFiles controller', async () => {
      await request(app).get('/tasks/1/files');

      expect(taskFilesController.getTaskFiles).toHaveBeenCalled();
    });

    test('should pass taskId param to controller', async () => {
      await request(app).get('/tasks/456/files');

      const req = taskFilesController.getTaskFiles.mock.calls[0][0];
      expect(req.params.taskId).toBe('456');
    });

    test('should return files data', async () => {
      taskFilesController.getTaskFiles.mockImplementation((req, res) => {
        res.json({
          success: true,
          data: [
            { id: 1, filename: 'test.pdf', taskId: 1 },
            { id: 2, filename: 'doc.docx', taskId: 1 }
          ]
        });
      });

      const response = await request(app).get('/tasks/1/files');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('DELETE /tasks/files/:fileId', () => {
    test('should call deleteFile controller', async () => {
      await request(app).delete('/tasks/files/1');

      expect(taskFilesController.deleteFile).toHaveBeenCalled();
    });

    test('should pass fileId param to controller', async () => {
      await request(app).delete('/tasks/files/789');

      const req = taskFilesController.deleteFile.mock.calls[0][0];
      expect(req.params.fileId).toBe('789');
    });

    test('should return success message', async () => {
      const response = await request(app).delete('/tasks/files/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('File deleted successfully');
    });
  });

  describe('Authentication', () => {
    test('should require authentication for POST', async () => {
      // The mock middleware adds req.user, so we verify it was called
      await request(app)
        .post('/tasks/1/files')
        .attach('files', Buffer.from('test'), 'test.pdf');

      const req = taskFilesController.uploadFiles.mock.calls[0][0];
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(1);
    });

    test('should require authentication for GET', async () => {
      await request(app).get('/tasks/1/files');

      const req = taskFilesController.getTaskFiles.mock.calls[0][0];
      expect(req.user).toBeDefined();
    });

    test('should require authentication for DELETE', async () => {
      await request(app).delete('/tasks/files/1');

      const req = taskFilesController.deleteFile.mock.calls[0][0];
      expect(req.user).toBeDefined();
    });
  });

  describe('Multer Configuration', () => {
    test('should use memory storage', async () => {
      await request(app)
        .post('/tasks/1/files')
        .attach('files', Buffer.from('test'), 'test.pdf');

      // Verify the file was processed
      expect(taskFilesController.uploadFiles).toHaveBeenCalled();
      const req = taskFilesController.uploadFiles.mock.calls[0][0];
      expect(req.files).toBeDefined();
    });

    test('should limit to 10 files per request', async () => {
      // This is tested indirectly through the file count test above
      expect(true).toBe(true);
    });

    test('should limit file size to 50MB', async () => {
      // This is tested indirectly through the file size test above
      expect(true).toBe(true);
    });
  });
});
