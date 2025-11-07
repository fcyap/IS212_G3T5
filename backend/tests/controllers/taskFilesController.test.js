const taskFilesController = require('../../src/controllers/taskFilesController');
const taskFilesService = require('../../src/services/taskFilesService');

jest.mock('../../src/services/taskFilesService');

describe('TaskFilesController', () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: {},
      user: { id: 1 },
      files: []
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    jest.clearAllMocks();
  });

  describe('uploadFiles', () => {
    beforeEach(() => {
      req.params = { taskId: '5' };
      req.files = [
        {
          originalname: 'test.pdf',
          buffer: Buffer.from('test'),
          size: 1000,
          mimetype: 'application/pdf'
        }
      ];
    });

    test('should upload files successfully', async () => {
      const mockResult = {
        uploaded: [
          {
            id: 1,
            filename: 'test.pdf',
            url: 'https://example.com/test.pdf',
            size: 1000,
            mimeType: 'application/pdf'
          }
        ]
      };

      taskFilesService.uploadFiles.mockResolvedValue(mockResult);

      await taskFilesController.uploadFiles(req, res);

      expect(taskFilesService.uploadFiles).toHaveBeenCalledWith(5, 1, req.files);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Files uploaded successfully',
        data: mockResult
      });
    });

    test('should return 401 when user not authenticated', async () => {
      req.user = null;

      await taskFilesController.uploadFiles(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'User not authenticated'
      });
    });

    test('should return 400 when no files uploaded', async () => {
      req.files = [];

      await taskFilesController.uploadFiles(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'No files uploaded'
      });
    });

    test('should return 400 when files is null', async () => {
      req.files = null;

      await taskFilesController.uploadFiles(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'No files uploaded'
      });
    });

    test('should handle service errors', async () => {
      taskFilesService.uploadFiles.mockRejectedValue(new Error('Upload failed'));

      await taskFilesController.uploadFiles(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Upload failed'
      });
    });

    test('should handle errors without message', async () => {
      taskFilesService.uploadFiles.mockRejectedValue({});

      await taskFilesController.uploadFiles(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to upload files'
      });
    });

    test('should sanitize error message', async () => {
      const errorWithNewlines = new Error('Error\nwith\rnewlines');
      taskFilesService.uploadFiles.mockRejectedValue(errorWithNewlines);

      await taskFilesController.uploadFiles(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Error\nwith\rnewlines' // json response keeps original error
      });
    });
  });

  describe('getTaskFiles', () => {
    beforeEach(() => {
      req.params = { taskId: '5' };
    });

    test('should get task files successfully', async () => {
      const mockFiles = [
        {
          id: 1,
          taskId: 5,
          userId: 1,
          url: 'https://example.com/test.pdf',
          filename: 'test.pdf',
          createdAt: '2025-01-01'
        }
      ];

      taskFilesService.getTaskFiles.mockResolvedValue(mockFiles);

      await taskFilesController.getTaskFiles(req, res);

      expect(taskFilesService.getTaskFiles).toHaveBeenCalledWith(5);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockFiles
      });
    });

    test('should return empty array when no files', async () => {
      taskFilesService.getTaskFiles.mockResolvedValue([]);

      await taskFilesController.getTaskFiles(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: []
      });
    });

    test('should handle service errors', async () => {
      taskFilesService.getTaskFiles.mockRejectedValue(new Error('Fetch failed'));

      await taskFilesController.getTaskFiles(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Fetch failed'
      });
    });

    test('should handle errors without message', async () => {
      taskFilesService.getTaskFiles.mockRejectedValue({});

      await taskFilesController.getTaskFiles(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to fetch task files'
      });
    });

    test('should parse taskId as integer', async () => {
      req.params.taskId = '42';
      taskFilesService.getTaskFiles.mockResolvedValue([]);

      await taskFilesController.getTaskFiles(req, res);

      expect(taskFilesService.getTaskFiles).toHaveBeenCalledWith(42);
    });
  });

  describe('deleteFile', () => {
    beforeEach(() => {
      req.params = { fileId: '1' };
    });

    test('should delete file successfully', async () => {
      taskFilesService.deleteFile.mockResolvedValue(true);

      await taskFilesController.deleteFile(req, res);

      expect(taskFilesService.deleteFile).toHaveBeenCalledWith(1, 1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'File deleted successfully'
      });
    });

    test('should return 401 when user not authenticated', async () => {
      req.user = null;

      await taskFilesController.deleteFile(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'User not authenticated'
      });
    });

    test('should return 401 when user id is undefined', async () => {
      req.user = {};

      await taskFilesController.deleteFile(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'User not authenticated'
      });
    });

    test('should return 403 for permission denied errors', async () => {
      taskFilesService.deleteFile.mockRejectedValue(
        new Error('Permission denied: You can only delete your own files')
      );

      await taskFilesController.deleteFile(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Permission denied: You can only delete your own files'
      });
    });

    test('should return 404 for not found errors', async () => {
      taskFilesService.deleteFile.mockRejectedValue(new Error('File not found'));

      await taskFilesController.deleteFile(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'File not found'
      });
    });

    test('should return 500 for other errors', async () => {
      taskFilesService.deleteFile.mockRejectedValue(new Error('Database error'));

      await taskFilesController.deleteFile(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Database error'
      });
    });

    test('should handle errors with empty message', async () => {
      taskFilesService.deleteFile.mockRejectedValue(new Error(''));

      await taskFilesController.deleteFile(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to delete file'
      });
    });

    test('should parse fileId as integer', async () => {
      req.params.fileId = '42';
      taskFilesService.deleteFile.mockResolvedValue(true);

      await taskFilesController.deleteFile(req, res);

      expect(taskFilesService.deleteFile).toHaveBeenCalledWith(42, 1);
    });
  });
});
