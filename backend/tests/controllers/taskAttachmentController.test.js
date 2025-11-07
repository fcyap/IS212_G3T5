const taskAttachmentController = require('../../src/controllers/taskAttachmentController');
const taskAttachmentService = require('../../src/services/taskAttachmentService');

jest.mock('../../src/services/taskAttachmentService');

describe('TaskAttachmentController', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      files: [],
      user: { id: 1, role: 'staff', hierarchy: 1, division: 'Engineering' }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: {
        session: { user_id: 1, role: 'staff', hierarchy: 1, division: 'Engineering' }
      }
    };
    jest.clearAllMocks();
  });

  describe('uploadAttachments', () => {
    test('should successfully upload valid files within size limit', async () => {
      req.params.taskId = '123';
      req.files = [
        {
          originalname: 'document.pdf',
          mimetype: 'application/pdf',
          size: 1024 * 1024 * 5, // 5MB
          buffer: Buffer.from('mock pdf content')
        },
        {
          originalname: 'image.png',
          mimetype: 'image/png',
          size: 1024 * 1024 * 2, // 2MB
          buffer: Buffer.from('mock image content')
        }
      ];

      const mockAttachments = [
        {
          id: 1,
          task_id: 123,
          file_name: 'document.pdf',
          file_type: 'application/pdf',
          file_size: 5242880,
          file_url: 'https://storage.example.com/attachments/123/document.pdf',
          uploaded_by: 1,
          uploaded_at: '2025-10-20T10:00:00Z'
        },
        {
          id: 2,
          task_id: 123,
          file_name: 'image.png',
          file_type: 'image/png',
          file_size: 2097152,
          file_url: 'https://storage.example.com/attachments/123/image.png',
          uploaded_by: 1,
          uploaded_at: '2025-10-20T10:00:01Z'
        }
      ];

      taskAttachmentService.uploadAttachments.mockResolvedValue({
        attachments: mockAttachments,
        totalSize: 7340032
      });

      await taskAttachmentController.uploadAttachments(req, res);

      expect(taskAttachmentService.uploadAttachments).toHaveBeenCalledWith(
        123,
        req.files,
        1
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        attachments: mockAttachments,
        totalSize: 7340032
      });
    });

    test('should reject upload when total size exceeds 50MB', async () => {
      req.params.taskId = '123';
      req.files = [
        {
          originalname: 'large_file.pdf',
          mimetype: 'application/pdf',
          size: 1024 * 1024 * 51, // 51MB
          buffer: Buffer.from('mock large content')
        }
      ];

      const error = new Error('Total file size cannot exceed 50MB');
      error.status = 413;
      taskAttachmentService.uploadAttachments.mockRejectedValue(error);

      await taskAttachmentController.uploadAttachments(req, res);

      expect(res.status).toHaveBeenCalledWith(413);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Total file size cannot exceed 50MB'
      });
    });

    test('should reject upload with invalid file format', async () => {
      req.params.taskId = '123';
      req.files = [
        {
          originalname: 'script.exe',
          mimetype: 'application/x-msdownload',
          size: 1024 * 1024, // 1MB
          buffer: Buffer.from('mock exe content')
        }
      ];

      const error = new Error('Invalid file format. Allowed formats: PDF, DOCX, XLSX, PNG, JPG');
      error.status = 400;
      taskAttachmentService.uploadAttachments.mockRejectedValue(error);

      await taskAttachmentController.uploadAttachments(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid file format. Allowed formats: PDF, DOCX, XLSX, PNG, JPG'
      });
    });

    test('should reject when existing attachments + new files exceed 50MB', async () => {
      req.params.taskId = '123';
      req.files = [
        {
          originalname: 'document.pdf',
          mimetype: 'application/pdf',
          size: 1024 * 1024 * 20, // 20MB
          buffer: Buffer.from('mock content')
        }
      ];

      const error = new Error('Total file size cannot exceed 50MB');
      error.status = 413;
      error.currentSize = 31457280; // 30MB
      error.attemptedSize = 52428800; // 50MB + 20MB
      taskAttachmentService.uploadAttachments.mockRejectedValue(error);

      await taskAttachmentController.uploadAttachments(req, res);

      expect(res.status).toHaveBeenCalledWith(413);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Total file size cannot exceed 50MB'
      });
    });

    test('should handle missing taskId parameter', async () => {
      req.params.taskId = undefined;
      req.files = [
        {
          originalname: 'document.pdf',
          mimetype: 'application/pdf',
          size: 1024 * 1024,
          buffer: Buffer.from('mock content')
        }
      ];

      await taskAttachmentController.uploadAttachments(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Task ID is required'
      });
    });

    test('should handle no files uploaded', async () => {
      req.params.taskId = '123';
      req.files = [];

      await taskAttachmentController.uploadAttachments(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'No files provided'
      });
    });

    test('should handle service errors gracefully', async () => {
      req.params.taskId = '123';
      req.files = [
        {
          originalname: 'document.pdf',
          mimetype: 'application/pdf',
          size: 1024 * 1024,
          buffer: Buffer.from('mock content')
        }
      ];

      const error = new Error('Database connection failed');
      taskAttachmentService.uploadAttachments.mockRejectedValue(error);

      await taskAttachmentController.uploadAttachments(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Database connection failed'
      });
    });
  });

  describe('getAttachments', () => {
    test('should get all attachments for a task', async () => {
      req.params.taskId = '123';

      const mockAttachments = [
        {
          id: 1,
          task_id: 123,
          file_name: 'document.pdf',
          file_type: 'application/pdf',
          file_size: 5242880,
          file_url: 'https://storage.example.com/attachments/123/document.pdf',
          uploaded_by: 1,
          uploaded_at: '2025-10-20T10:00:00Z'
        },
        {
          id: 2,
          task_id: 123,
          file_name: 'image.png',
          file_type: 'image/png',
          file_size: 2097152,
          file_url: 'https://storage.example.com/attachments/123/image.png',
          uploaded_by: 1,
          uploaded_at: '2025-10-20T10:00:01Z'
        }
      ];

      taskAttachmentService.getAttachments.mockResolvedValue({
        attachments: mockAttachments,
        totalSize: 7340032
      });

      await taskAttachmentController.getAttachments(req, res);

      expect(taskAttachmentService.getAttachments).toHaveBeenCalledWith(123);
      expect(res.json).toHaveBeenCalledWith({
        attachments: mockAttachments,
        totalSize: 7340032
      });
    });

    test('should return empty array when task has no attachments', async () => {
      req.params.taskId = '123';

      taskAttachmentService.getAttachments.mockResolvedValue({
        attachments: [],
        totalSize: 0
      });

      await taskAttachmentController.getAttachments(req, res);

      expect(res.json).toHaveBeenCalledWith({
        attachments: [],
        totalSize: 0
      });
    });

    test('should handle invalid taskId', async () => {
      req.params.taskId = 'invalid';

      const error = new Error('Invalid task ID');
      error.status = 400;
      taskAttachmentService.getAttachments.mockRejectedValue(error);

      await taskAttachmentController.getAttachments(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid task ID'
      });
    });
  });

  describe('deleteAttachment', () => {
    test('should successfully delete an attachment', async () => {
      req.params.taskId = '123';
      req.params.attachmentId = '1';

      taskAttachmentService.deleteAttachment.mockResolvedValue({
        message: 'Attachment deleted successfully'
      });

      await taskAttachmentController.deleteAttachment(req, res);

      expect(taskAttachmentService.deleteAttachment).toHaveBeenCalledWith(123, 1, 1);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Attachment deleted successfully'
      });
    });

    test('should reject deletion when user is not authorized', async () => {
      req.params.taskId = '123';
      req.params.attachmentId = '1';

      const error = new Error('Unauthorized to delete this attachment');
      error.status = 403;
      taskAttachmentService.deleteAttachment.mockRejectedValue(error);

      await taskAttachmentController.deleteAttachment(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized to delete this attachment'
      });
    });

    test('should handle attachment not found', async () => {
      req.params.taskId = '123';
      req.params.attachmentId = '999';

      const error = new Error('Attachment not found');
      error.status = 404;
      taskAttachmentService.deleteAttachment.mockRejectedValue(error);

      await taskAttachmentController.deleteAttachment(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Attachment not found'
      });
    });
  });

  describe('downloadAttachment', () => {
    test('should successfully download an attachment', async () => {
      req.params.taskId = '123';
      req.params.attachmentId = '1';

      const mockFile = {
        buffer: Buffer.from('mock file content'),
        fileName: 'document.pdf',
        mimeType: 'application/pdf'
      };

      res.set = jest.fn();
      res.send = jest.fn();

      taskAttachmentService.downloadAttachment.mockResolvedValue(mockFile);

      await taskAttachmentController.downloadAttachment(req, res);

      expect(taskAttachmentService.downloadAttachment).toHaveBeenCalledWith(123, 1);
      expect(res.set).toHaveBeenCalledWith({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="document.pdf"'
      });
      expect(res.send).toHaveBeenCalledWith(mockFile.buffer);
    });

    test('should handle file not found in storage', async () => {
      req.params.taskId = '123';
      req.params.attachmentId = '1';

      const error = new Error('File not found in storage');
      error.status = 404;
      taskAttachmentService.downloadAttachment.mockRejectedValue(error);

      await taskAttachmentController.downloadAttachment(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'File not found in storage'
      });
    });

    test('should return 400 for invalid task ID', async () => {
      req.params.taskId = 'invalid';
      req.params.attachmentId = '1';

      await taskAttachmentController.downloadAttachment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid task ID'
      });
      expect(taskAttachmentService.downloadAttachment).not.toHaveBeenCalled();
    });

    test('should return 400 for invalid attachment ID', async () => {
      req.params.taskId = '123';
      req.params.attachmentId = 'invalid';

      await taskAttachmentController.downloadAttachment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid attachment ID'
      });
      expect(taskAttachmentService.downloadAttachment).not.toHaveBeenCalled();
    });
  });

  describe('uploadAttachments - Additional Coverage', () => {
    test('should return 401 when user is not authenticated', async () => {
      req.params.taskId = '123';
      req.files = [{ originalname: 'doc.pdf', buffer: Buffer.from('test') }];
      req.user = null;
      res.locals.session = null;

      await taskAttachmentController.uploadAttachments(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'User authentication required'
      });
      expect(taskAttachmentService.uploadAttachments).not.toHaveBeenCalled();
    });
  });

  describe('getAttachments - Additional Coverage', () => {
    test('should handle service errors', async () => {
      req.params.taskId = '123';

      const error = new Error('Database error');
      error.status = 500;
      taskAttachmentService.getAttachments.mockRejectedValue(error);

      await taskAttachmentController.getAttachments(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Database error'
      });
    });
  });

  describe('deleteAttachment - Additional Coverage', () => {
    test('should return 400 for invalid task ID', async () => {
      req.params.taskId = 'invalid';
      req.params.attachmentId = '1';

      await taskAttachmentController.deleteAttachment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid task ID'
      });
      expect(taskAttachmentService.deleteAttachment).not.toHaveBeenCalled();
    });

    test('should return 400 for invalid attachment ID', async () => {
      req.params.taskId = '123';
      req.params.attachmentId = 'invalid';

      await taskAttachmentController.deleteAttachment(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid attachment ID'
      });
      expect(taskAttachmentService.deleteAttachment).not.toHaveBeenCalled();
    });

    test('should return 401 when user is not authenticated', async () => {
      req.params.taskId = '123';
      req.params.attachmentId = '1';
      req.user = null;
      res.locals.session = null;

      await taskAttachmentController.deleteAttachment(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'User authentication required'
      });
      expect(taskAttachmentService.deleteAttachment).not.toHaveBeenCalled();
    });
  });
});
