const taskFilesService = require('../../src/services/taskFilesService');
const taskFilesRepository = require('../../src/repository/taskFilesRepository');
const supabase = require('../../src/utils/supabase');

jest.mock('../../src/utils/supabase');
jest.mock('../../src/repository/taskFilesRepository');

describe('TaskFilesService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadFiles', () => {
    const mockTaskId = 5;
    const mockUserId = 1;
    const mockFile = {
      originalname: 'test.pdf',
      buffer: Buffer.from('test content'),
      size: 1000,
      mimetype: 'application/pdf'
    };

    test('should upload files successfully', async () => {
      // Mock task exists
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockTaskId },
          error: null
        })
      });

      // Mock storage upload
      supabase.storage = {
        from: jest.fn().mockReturnValue({
          upload: jest.fn().mockResolvedValue({
            data: { path: 'tasks/5/test_123_abc.pdf' },
            error: null
          }),
          getPublicUrl: jest.fn().mockReturnValue({
            data: { publicUrl: 'https://example.com/test.pdf' }
          })
        })
      };

      taskFilesRepository.create.mockResolvedValue({
        id: 1,
        task_id: mockTaskId,
        user_id: mockUserId,
        file_path: 'tasks/5/test_123_abc.pdf',
        file_name: 'test.pdf',
        file_url: 'https://example.com/test.pdf',
        created_at: '2025-01-01'
      });

      const result = await taskFilesService.uploadFiles(mockTaskId, mockUserId, [mockFile]);

      expect(result.uploaded).toHaveLength(1);
      expect(result.uploaded[0].filename).toBe('test.pdf');
      expect(result.uploaded[0].url).toBe('https://example.com/test.pdf');
    });

    test('should throw error when no files provided', async () => {
      await expect(taskFilesService.uploadFiles(mockTaskId, mockUserId, []))
        .rejects.toThrow('No files provided');
    });

    test('should throw error when task not found', async () => {
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' }
        })
      });

      await expect(taskFilesService.uploadFiles(mockTaskId, mockUserId, [mockFile]))
        .rejects.toThrow('Task not found');
    });

    test('should handle file validation errors', async () => {
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockTaskId },
          error: null
        })
      });

      const invalidFile = {
        originalname: 'test.exe',
        buffer: Buffer.from('test'),
        size: 1000,
        mimetype: 'application/x-msdownload'
      };

      await expect(taskFilesService.uploadFiles(mockTaskId, mockUserId, [invalidFile]))
        .rejects.toThrow('Failed to upload files');
    });

    test('should handle upload errors gracefully', async () => {
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockTaskId },
          error: null
        })
      });

      supabase.storage = {
        from: jest.fn().mockReturnValue({
          upload: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Upload failed' }
          })
        })
      };

      await expect(taskFilesService.uploadFiles(mockTaskId, mockUserId, [mockFile]))
        .rejects.toThrow('Failed to upload files');
    });

    test('should handle missing public URL', async () => {
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockTaskId },
          error: null
        })
      });

      supabase.storage = {
        from: jest.fn().mockReturnValue({
          upload: jest.fn().mockResolvedValue({
            data: { path: 'tasks/5/test.pdf' },
            error: null
          }),
          getPublicUrl: jest.fn().mockReturnValue({
            data: null
          }),
          remove: jest.fn().mockResolvedValue({ error: null })
        })
      };

      await expect(taskFilesService.uploadFiles(mockTaskId, mockUserId, [mockFile]))
        .rejects.toThrow('Failed to upload files');
    });

    test('should return partial results with errors', async () => {
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: mockTaskId },
          error: null
        })
      });

      const validFile = mockFile;
      const invalidFile = {
        originalname: 'test.exe',
        buffer: Buffer.from('test'),
        size: 1000,
        mimetype: 'application/x-msdownload'
      };

      supabase.storage = {
        from: jest.fn().mockReturnValue({
          upload: jest.fn().mockResolvedValue({
            data: { path: 'tasks/5/test.pdf' },
            error: null
          }),
          getPublicUrl: jest.fn().mockReturnValue({
            data: { publicUrl: 'https://example.com/test.pdf' }
          })
        })
      };

      taskFilesRepository.create.mockResolvedValue({
        id: 1,
        task_id: mockTaskId,
        user_id: mockUserId,
        file_path: 'tasks/5/test.pdf',
        file_name: 'test.pdf',
        file_url: 'https://example.com/test.pdf',
        created_at: '2025-01-01'
      });

      const result = await taskFilesService.uploadFiles(mockTaskId, mockUserId, [validFile, invalidFile]);

      expect(result.uploaded).toHaveLength(1);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('getTaskFiles', () => {
    test('should get all files for a task', async () => {
      const mockFiles = [
        {
          id: 1,
          task_id: 5,
          user_id: 1,
          file_path: 'tasks/5/test.pdf',
          file_name: 'test.pdf',
          file_url: 'https://example.com/test.pdf',
          created_at: '2025-01-01'
        }
      ];

      taskFilesRepository.getByTaskId.mockResolvedValue(mockFiles);

      const result = await taskFilesService.getTaskFiles(5);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(result[0].filename).toBe('test.pdf');
      expect(result[0].url).toBe('https://example.com/test.pdf');
    });

    test('should return empty array when no files', async () => {
      taskFilesRepository.getByTaskId.mockResolvedValue([]);

      const result = await taskFilesService.getTaskFiles(5);

      expect(result).toEqual([]);
    });
  });

  describe('deleteFile', () => {
    const mockFileId = 1;
    const mockUserId = 1;
    const mockFile = {
      id: 1,
      task_id: 5,
      user_id: 1,
      file_path: 'tasks/5/test.pdf',
      file_name: 'test.pdf',
      file_url: 'https://example.com/test.pdf'
    };

    test('should delete file successfully as owner', async () => {
      taskFilesRepository.getById.mockResolvedValue(mockFile);

      supabase.storage = {
        from: jest.fn().mockReturnValue({
          remove: jest.fn().mockResolvedValue({ error: null })
        })
      };

      taskFilesRepository.deleteById.mockResolvedValue(true);

      const result = await taskFilesService.deleteFile(mockFileId, mockUserId);

      expect(result).toBe(true);
      expect(taskFilesRepository.deleteById).toHaveBeenCalledWith(mockFileId);
    });

    test('should throw error when file not found', async () => {
      taskFilesRepository.getById.mockResolvedValue(null);

      await expect(taskFilesService.deleteFile(999, mockUserId))
        .rejects.toThrow('File not found');
    });

    test('should allow assigned user to delete', async () => {
      const fileByOtherUser = { ...mockFile, user_id: 2 };
      taskFilesRepository.getById.mockResolvedValue(fileByOtherUser);

      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            assigned_to: [mockUserId],
            creator_id: 999
          },
          error: null
        })
      });

      supabase.storage = {
        from: jest.fn().mockReturnValue({
          remove: jest.fn().mockResolvedValue({ error: null })
        })
      };

      taskFilesRepository.deleteById.mockResolvedValue(true);

      const result = await taskFilesService.deleteFile(mockFileId, mockUserId);

      expect(result).toBe(true);
    });

    test('should allow creator to delete', async () => {
      const fileByOtherUser = { ...mockFile, user_id: 2 };
      taskFilesRepository.getById.mockResolvedValue(fileByOtherUser);

      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            assigned_to: [],
            creator_id: mockUserId
          },
          error: null
        })
      });

      supabase.storage = {
        from: jest.fn().mockReturnValue({
          remove: jest.fn().mockResolvedValue({ error: null })
        })
      };

      taskFilesRepository.deleteById.mockResolvedValue(true);

      const result = await taskFilesService.deleteFile(mockFileId, mockUserId);

      expect(result).toBe(true);
    });

    test('should throw permission error for unauthorized user', async () => {
      const fileByOtherUser = { ...mockFile, user_id: 2 };
      taskFilesRepository.getById.mockResolvedValue(fileByOtherUser);

      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            assigned_to: [3, 4],
            creator_id: 5
          },
          error: null
        })
      });

      await expect(taskFilesService.deleteFile(mockFileId, mockUserId))
        .rejects.toThrow('Permission denied');
    });

    test('should continue deletion even if storage deletion fails', async () => {
      taskFilesRepository.getById.mockResolvedValue(mockFile);

      supabase.storage = {
        from: jest.fn().mockReturnValue({
          remove: jest.fn().mockResolvedValue({
            error: { message: 'Storage error' }
          })
        })
      };

      taskFilesRepository.deleteById.mockResolvedValue(true);

      const result = await taskFilesService.deleteFile(mockFileId, mockUserId);

      expect(result).toBe(true);
      expect(taskFilesRepository.deleteById).toHaveBeenCalled();
    });

    test('should handle file without file_path', async () => {
      const fileWithoutPath = { ...mockFile, file_path: null };
      taskFilesRepository.getById.mockResolvedValue(fileWithoutPath);
      taskFilesRepository.deleteById.mockResolvedValue(true);

      const result = await taskFilesService.deleteFile(mockFileId, mockUserId);

      expect(result).toBe(true);
    });
  });

  describe('deleteTaskFiles', () => {
    test('should delete all files for a task', async () => {
      const mockFiles = [
        { id: 1, file_path: 'tasks/5/test1.pdf' },
        { id: 2, file_path: 'tasks/5/test2.pdf' }
      ];

      taskFilesRepository.getByTaskId.mockResolvedValue(mockFiles);

      supabase.storage = {
        from: jest.fn().mockReturnValue({
          remove: jest.fn().mockResolvedValue({ error: null })
        })
      };

      taskFilesRepository.deleteByTaskId.mockResolvedValue(2);

      const result = await taskFilesService.deleteTaskFiles(5);

      expect(result).toBe(2);
      expect(supabase.storage.from().remove).toHaveBeenCalledWith(['tasks/5/test1.pdf', 'tasks/5/test2.pdf']);
    });

    test('should handle tasks with no files', async () => {
      taskFilesRepository.getByTaskId.mockResolvedValue([]);
      taskFilesRepository.deleteByTaskId.mockResolvedValue(0);

      const result = await taskFilesService.deleteTaskFiles(5);

      expect(result).toBe(0);
    });

    test('should filter out null file paths', async () => {
      const mockFiles = [
        { id: 1, file_path: 'tasks/5/test1.pdf' },
        { id: 2, file_path: null }
      ];

      taskFilesRepository.getByTaskId.mockResolvedValue(mockFiles);

      supabase.storage = {
        from: jest.fn().mockReturnValue({
          remove: jest.fn().mockResolvedValue({ error: null })
        })
      };

      taskFilesRepository.deleteByTaskId.mockResolvedValue(2);

      await taskFilesService.deleteTaskFiles(5);

      expect(supabase.storage.from().remove).toHaveBeenCalledWith(['tasks/5/test1.pdf']);
    });

    test('should continue deletion even if storage fails', async () => {
      const mockFiles = [{ id: 1, file_path: 'tasks/5/test.pdf' }];

      taskFilesRepository.getByTaskId.mockResolvedValue(mockFiles);

      supabase.storage = {
        from: jest.fn().mockReturnValue({
          remove: jest.fn().mockResolvedValue({
            error: { message: 'Storage error' }
          })
        })
      };

      taskFilesRepository.deleteByTaskId.mockResolvedValue(1);

      const result = await taskFilesService.deleteTaskFiles(5);

      expect(result).toBe(1);
    });
  });

  describe('copyTaskFiles', () => {
    test('should copy files from source to target task', async () => {
      const mockFiles = [
        {
          id: 1,
          file_path: 'tasks/5/test.pdf',
          file_name: 'test.pdf'
        }
      ];

      taskFilesRepository.getByTaskId.mockResolvedValue(mockFiles);

      supabase.storage = {
        from: jest.fn().mockReturnValue({
          copy: jest.fn().mockResolvedValue({
            data: { path: 'tasks/10/test.pdf' },
            error: null
          }),
          getPublicUrl: jest.fn().mockReturnValue({
            data: { publicUrl: 'https://example.com/test.pdf' }
          })
        })
      };

      taskFilesRepository.create.mockResolvedValue({
        id: 2,
        task_id: 10,
        user_id: 1,
        file_path: 'tasks/10/test.pdf',
        file_name: 'test.pdf',
        file_url: 'https://example.com/test.pdf'
      });

      const result = await taskFilesService.copyTaskFiles(5, 10, 1);

      expect(result).toHaveLength(1);
      expect(result[0].task_id).toBe(10);
    });

    test('should return empty array when source has no files', async () => {
      taskFilesRepository.getByTaskId.mockResolvedValue([]);

      const result = await taskFilesService.copyTaskFiles(5, 10, 1);

      expect(result).toEqual([]);
    });

    test('should skip files without file_path', async () => {
      const mockFiles = [
        { id: 1, file_path: null, file_name: 'test.pdf' }
      ];

      taskFilesRepository.getByTaskId.mockResolvedValue(mockFiles);

      const result = await taskFilesService.copyTaskFiles(5, 10, 1);

      expect(result).toEqual([]);
    });

    test('should handle copy errors gracefully', async () => {
      const mockFiles = [
        { id: 1, file_path: 'tasks/5/test1.pdf', file_name: 'test1.pdf' },
        { id: 2, file_path: 'tasks/5/test2.pdf', file_name: 'test2.pdf' }
      ];

      taskFilesRepository.getByTaskId.mockResolvedValue(mockFiles);

      supabase.storage = {
        from: jest.fn().mockReturnValue({
          copy: jest.fn()
            .mockResolvedValueOnce({
              data: null,
              error: { message: 'Copy failed' }
            })
            .mockResolvedValueOnce({
              data: { path: 'tasks/10/test2.pdf' },
              error: null
            }),
          getPublicUrl: jest.fn().mockReturnValue({
            data: { publicUrl: 'https://example.com/test2.pdf' }
          })
        })
      };

      taskFilesRepository.create.mockResolvedValue({
        id: 3,
        task_id: 10,
        file_name: 'test2.pdf'
      });

      const result = await taskFilesService.copyTaskFiles(5, 10, 1);

      expect(result).toHaveLength(1);
      expect(result[0].file_name).toBe('test2.pdf');
    });

    test('should handle repository errors gracefully', async () => {
      const mockFiles = [
        { id: 1, file_path: 'tasks/5/test.pdf', file_name: 'test.pdf' }
      ];

      taskFilesRepository.getByTaskId.mockResolvedValue(mockFiles);

      supabase.storage = {
        from: jest.fn().mockReturnValue({
          copy: jest.fn().mockResolvedValue({
            data: { path: 'tasks/10/test.pdf' },
            error: null
          }),
          getPublicUrl: jest.fn().mockReturnValue({
            data: { publicUrl: 'https://example.com/test.pdf' }
          })
        })
      };

      taskFilesRepository.create.mockRejectedValue(new Error('DB error'));

      const result = await taskFilesService.copyTaskFiles(5, 10, 1);

      expect(result).toEqual([]);
    });
  });

  describe('_validateFile', () => {
    test('should throw error for null file', () => {
      expect(() => taskFilesService._validateFile(null))
        .toThrow('No file provided');
    });

    test('should throw error for file exceeding size limit', () => {
      const largeFile = {
        originalname: 'large.pdf',
        size: 60 * 1024 * 1024, // 60MB
        mimetype: 'application/pdf'
      };

      expect(() => taskFilesService._validateFile(largeFile))
        .toThrow('exceeds maximum size');
    });

    test('should throw error for invalid file type', () => {
      const invalidFile = {
        originalname: 'test.exe',
        size: 1000,
        mimetype: 'application/x-msdownload'
      };

      expect(() => taskFilesService._validateFile(invalidFile))
        .toThrow('has invalid type');
    });

    test('should accept valid PDF file', () => {
      const validFile = {
        originalname: 'test.pdf',
        size: 1000,
        mimetype: 'application/pdf'
      };

      expect(() => taskFilesService._validateFile(validFile)).not.toThrow();
    });

    test('should accept valid DOCX file', () => {
      const validFile = {
        originalname: 'test.docx',
        size: 1000,
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      };

      expect(() => taskFilesService._validateFile(validFile)).not.toThrow();
    });

    test('should accept valid XLSX file', () => {
      const validFile = {
        originalname: 'test.xlsx',
        size: 1000,
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      };

      expect(() => taskFilesService._validateFile(validFile)).not.toThrow();
    });

    test('should accept valid CSV file', () => {
      const validFile = {
        originalname: 'test.csv',
        size: 1000,
        mimetype: 'text/csv'
      };

      expect(() => taskFilesService._validateFile(validFile)).not.toThrow();
    });

    test('should accept valid PNG file', () => {
      const validFile = {
        originalname: 'test.png',
        size: 1000,
        mimetype: 'image/png'
      };

      expect(() => taskFilesService._validateFile(validFile)).not.toThrow();
    });

    test('should accept valid JPEG file', () => {
      const validFile = {
        originalname: 'test.jpg',
        size: 1000,
        mimetype: 'image/jpeg'
      };

      expect(() => taskFilesService._validateFile(validFile)).not.toThrow();
    });
  });

  describe('_generateUniqueFilename', () => {
    test('should generate unique filename with timestamp', () => {
      const result = taskFilesService._generateUniqueFilename('test.pdf');

      expect(result).toMatch(/^test_\d+_[a-f0-9]{16}\.pdf$/);
    });

    test('should sanitize special characters', () => {
      const result = taskFilesService._generateUniqueFilename('test@#$%.pdf');

      expect(result).toMatch(/^test_+\d+_[a-f0-9]{16}\.pdf$/);
    });

    test('should handle filenames without extension', () => {
      const result = taskFilesService._generateUniqueFilename('testfile');

      expect(result).toMatch(/^testfile_\d+_[a-f0-9]{16}$/);
    });
  });

  describe('_extractFilename', () => {
    test('should extract filename from URL', () => {
      const url = 'https://example.com/storage/test.pdf';
      const result = taskFilesService._extractFilename(url);

      expect(result).toBe('test.pdf');
    });

    test('should return unknown for invalid URL', () => {
      const result = taskFilesService._extractFilename('not a url');

      expect(result).toBe('unknown');
    });
  });

  describe('_extractStoragePath', () => {
    test('should extract storage path from public URL', () => {
      const url = 'https://project.supabase.co/storage/v1/object/public/task-files/tasks/5/test.pdf';
      const result = taskFilesService._extractStoragePath(url);

      expect(result).toBe('tasks/5/test.pdf');
    });

    test('should return null for invalid URL', () => {
      const result = taskFilesService._extractStoragePath('not a url');

      expect(result).toBeNull();
    });

    test('should return null for URL without bucket', () => {
      const url = 'https://example.com/some/path/test.pdf';
      const result = taskFilesService._extractStoragePath(url);

      expect(result).toBeNull();
    });
  });
});
