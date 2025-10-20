const taskAttachmentService = require('../../src/services/taskAttachmentService');
const taskAttachmentRepository = require('../../src/repository/taskAttachmentRepository');
const taskRepository = require('../../src/repository/taskRepository');
const supabase = require('../../src/utils/supabase');

jest.mock('../../src/repository/taskAttachmentRepository');
jest.mock('../../src/repository/taskRepository');
jest.mock('../../src/utils/supabase');

describe('TaskAttachmentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadAttachments', () => {
    const mockFiles = [
      {
        originalname: 'document.pdf',
        mimetype: 'application/pdf',
        size: 1024 * 1024 * 5, // 5MB
        buffer: Buffer.from('mock pdf content')
      },
      {
        originalname: 'spreadsheet.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: 1024 * 1024 * 3, // 3MB
        buffer: Buffer.from('mock xlsx content')
      }
    ];

    test('should successfully upload valid files within size limit', async () => {
      const taskId = 123;
      const userId = 1;

      taskAttachmentRepository.getTotalSize.mockResolvedValue(0);
      taskRepository.getById.mockResolvedValue({
        id: taskId,
        title: 'Test Task'
      });

      const mockUploadedAttachments = [
        {
          id: 1,
          task_id: taskId,
          file_name: 'document.pdf',
          file_type: 'application/pdf',
          file_size: 5242880,
          file_url: 'https://storage.example.com/attachments/123/document.pdf',
          uploaded_by: userId,
          uploaded_at: '2025-10-20T10:00:00Z'
        },
        {
          id: 2,
          task_id: taskId,
          file_name: 'spreadsheet.xlsx',
          file_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          file_size: 3145728,
          file_url: 'https://storage.example.com/attachments/123/spreadsheet.xlsx',
          uploaded_by: userId,
          uploaded_at: '2025-10-20T10:00:01Z'
        }
      ];

      supabase.storage = {
        from: jest.fn().mockReturnValue({
          upload: jest.fn().mockResolvedValue({
            data: { path: 'attachments/123/document.pdf' },
            error: null
          }),
          getPublicUrl: jest.fn().mockReturnValue({
            data: { publicUrl: 'https://storage.example.com/attachments/123/document.pdf' }
          })
        })
      };

      taskAttachmentRepository.create.mockResolvedValueOnce(mockUploadedAttachments[0]);
      taskAttachmentRepository.create.mockResolvedValueOnce(mockUploadedAttachments[1]);

      const result = await taskAttachmentService.uploadAttachments(taskId, mockFiles, userId);

      expect(taskRepository.getById).toHaveBeenCalledWith(taskId);
      expect(taskAttachmentRepository.getTotalSize).toHaveBeenCalledWith(taskId);
      expect(result.attachments).toHaveLength(2);
      expect(result.totalSize).toBe(8388608); // 5MB + 3MB
    });

    test('should reject files that exceed 50MB total limit', async () => {
      const taskId = 123;
      const userId = 1;
      const largeFiles = [
        {
          originalname: 'huge_file.pdf',
          mimetype: 'application/pdf',
          size: 1024 * 1024 * 51, // 51MB
          buffer: Buffer.from('mock content')
        }
      ];

      taskAttachmentRepository.getTotalSize.mockResolvedValue(0);
      taskRepository.getById.mockResolvedValue({
        id: taskId,
        title: 'Test Task'
      });

      await expect(
        taskAttachmentService.uploadAttachments(taskId, largeFiles, userId)
      ).rejects.toThrow('Total file size cannot exceed 50MB');
    });

    test('should reject when existing + new files exceed 50MB', async () => {
      const taskId = 123;
      const userId = 1;
      const existingSize = 1024 * 1024 * 40; // 40MB existing
      const newFiles = [
        {
          originalname: 'document.pdf',
          mimetype: 'application/pdf',
          size: 1024 * 1024 * 15, // 15MB new (total would be 55MB)
          buffer: Buffer.from('mock content')
        }
      ];

      taskAttachmentRepository.getTotalSize.mockResolvedValue(existingSize);
      taskRepository.getById.mockResolvedValue({
        id: taskId,
        title: 'Test Task'
      });

      await expect(
        taskAttachmentService.uploadAttachments(taskId, newFiles, userId)
      ).rejects.toThrow('Total file size cannot exceed 50MB');
    });

    test('should accept files that keep total under 50MB', async () => {
      const taskId = 123;
      const userId = 1;
      const existingSize = 1024 * 1024 * 40; // 40MB existing
      const newFiles = [
        {
          originalname: 'document.pdf',
          mimetype: 'application/pdf',
          size: 1024 * 1024 * 9, // 9MB new (total = 49MB, under limit)
          buffer: Buffer.from('mock content')
        }
      ];

      taskAttachmentRepository.getTotalSize.mockResolvedValue(existingSize);
      taskRepository.getById.mockResolvedValue({
        id: taskId,
        title: 'Test Task'
      });

      supabase.storage = {
        from: jest.fn().mockReturnValue({
          upload: jest.fn().mockResolvedValue({
            data: { path: 'attachments/123/document.pdf' },
            error: null
          }),
          getPublicUrl: jest.fn().mockReturnValue({
            data: { publicUrl: 'https://storage.example.com/attachments/123/document.pdf' }
          })
        })
      };

      taskAttachmentRepository.create.mockResolvedValue({
        id: 1,
        task_id: taskId,
        file_name: 'document.pdf',
        file_type: 'application/pdf',
        file_size: 9437184,
        file_url: 'https://storage.example.com/attachments/123/document.pdf',
        uploaded_by: userId
      });

      const result = await taskAttachmentService.uploadAttachments(taskId, newFiles, userId);

      expect(result.attachments).toHaveLength(1);
      expect(result.totalSize).toBe(1024 * 1024 * 9);
    });

    test('should reject invalid file formats', async () => {
      const taskId = 123;
      const userId = 1;
      const invalidFiles = [
        {
          originalname: 'script.exe',
          mimetype: 'application/x-msdownload',
          size: 1024 * 1024,
          buffer: Buffer.from('mock content')
        }
      ];

      taskRepository.getById.mockResolvedValue({
        id: taskId,
        title: 'Test Task'
      });

      await expect(
        taskAttachmentService.uploadAttachments(taskId, invalidFiles, userId)
      ).rejects.toThrow('Invalid file format');
    });

    test('should accept PDF files', async () => {
      const taskId = 123;
      const userId = 1;
      const pdfFile = [
        {
          originalname: 'document.pdf',
          mimetype: 'application/pdf',
          size: 1024 * 1024,
          buffer: Buffer.from('mock content')
        }
      ];

      taskAttachmentRepository.getTotalSize.mockResolvedValue(0);
      taskRepository.getById.mockResolvedValue({
        id: taskId,
        title: 'Test Task'
      });

      supabase.storage = {
        from: jest.fn().mockReturnValue({
          upload: jest.fn().mockResolvedValue({
            data: { path: 'attachments/123/document.pdf' },
            error: null
          }),
          getPublicUrl: jest.fn().mockReturnValue({
            data: { publicUrl: 'https://storage.example.com/attachments/123/document.pdf' }
          })
        })
      };

      taskAttachmentRepository.create.mockResolvedValue({
        id: 1,
        task_id: taskId,
        file_name: 'document.pdf',
        file_type: 'application/pdf',
        file_size: 1048576,
        file_url: 'https://storage.example.com/attachments/123/document.pdf',
        uploaded_by: userId
      });

      await expect(
        taskAttachmentService.uploadAttachments(taskId, pdfFile, userId)
      ).resolves.toBeDefined();
    });

    test('should accept DOCX files', async () => {
      const taskId = 123;
      const userId = 1;
      const docxFile = [
        {
          originalname: 'document.docx',
          mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          size: 1024 * 1024,
          buffer: Buffer.from('mock content')
        }
      ];

      taskAttachmentRepository.getTotalSize.mockResolvedValue(0);
      taskRepository.getById.mockResolvedValue({
        id: taskId,
        title: 'Test Task'
      });

      supabase.storage = {
        from: jest.fn().mockReturnValue({
          upload: jest.fn().mockResolvedValue({
            data: { path: 'attachments/123/document.docx' },
            error: null
          }),
          getPublicUrl: jest.fn().mockReturnValue({
            data: { publicUrl: 'https://storage.example.com/attachments/123/document.docx' }
          })
        })
      };

      taskAttachmentRepository.create.mockResolvedValue({
        id: 1,
        task_id: taskId,
        file_name: 'document.docx',
        file_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        file_size: 1048576,
        file_url: 'https://storage.example.com/attachments/123/document.docx',
        uploaded_by: userId
      });

      await expect(
        taskAttachmentService.uploadAttachments(taskId, docxFile, userId)
      ).resolves.toBeDefined();
    });

    test('should accept XLSX files', async () => {
      const taskId = 123;
      const userId = 1;
      const xlsxFile = [
        {
          originalname: 'spreadsheet.xlsx',
          mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size: 1024 * 1024,
          buffer: Buffer.from('mock content')
        }
      ];

      taskAttachmentRepository.getTotalSize.mockResolvedValue(0);
      taskRepository.getById.mockResolvedValue({
        id: taskId,
        title: 'Test Task'
      });

      supabase.storage = {
        from: jest.fn().mockReturnValue({
          upload: jest.fn().mockResolvedValue({
            data: { path: 'attachments/123/spreadsheet.xlsx' },
            error: null
          }),
          getPublicUrl: jest.fn().mockReturnValue({
            data: { publicUrl: 'https://storage.example.com/attachments/123/spreadsheet.xlsx' }
          })
        })
      };

      taskAttachmentRepository.create.mockResolvedValue({
        id: 1,
        task_id: taskId,
        file_name: 'spreadsheet.xlsx',
        file_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        file_size: 1048576,
        file_url: 'https://storage.example.com/attachments/123/spreadsheet.xlsx',
        uploaded_by: userId
      });

      await expect(
        taskAttachmentService.uploadAttachments(taskId, xlsxFile, userId)
      ).resolves.toBeDefined();
    });

    test('should accept PNG image files', async () => {
      const taskId = 123;
      const userId = 1;
      const pngFile = [
        {
          originalname: 'image.png',
          mimetype: 'image/png',
          size: 1024 * 1024,
          buffer: Buffer.from('mock content')
        }
      ];

      taskAttachmentRepository.getTotalSize.mockResolvedValue(0);
      taskRepository.getById.mockResolvedValue({
        id: taskId,
        title: 'Test Task'
      });

      supabase.storage = {
        from: jest.fn().mockReturnValue({
          upload: jest.fn().mockResolvedValue({
            data: { path: 'attachments/123/image.png' },
            error: null
          }),
          getPublicUrl: jest.fn().mockReturnValue({
            data: { publicUrl: 'https://storage.example.com/attachments/123/image.png' }
          })
        })
      };

      taskAttachmentRepository.create.mockResolvedValue({
        id: 1,
        task_id: taskId,
        file_name: 'image.png',
        file_type: 'image/png',
        file_size: 1048576,
        file_url: 'https://storage.example.com/attachments/123/image.png',
        uploaded_by: userId
      });

      await expect(
        taskAttachmentService.uploadAttachments(taskId, pngFile, userId)
      ).resolves.toBeDefined();
    });

    test('should accept JPG image files', async () => {
      const taskId = 123;
      const userId = 1;
      const jpgFile = [
        {
          originalname: 'photo.jpg',
          mimetype: 'image/jpeg',
          size: 1024 * 1024,
          buffer: Buffer.from('mock content')
        }
      ];

      taskAttachmentRepository.getTotalSize.mockResolvedValue(0);
      taskRepository.getById.mockResolvedValue({
        id: taskId,
        title: 'Test Task'
      });

      supabase.storage = {
        from: jest.fn().mockReturnValue({
          upload: jest.fn().mockResolvedValue({
            data: { path: 'attachments/123/photo.jpg' },
            error: null
          }),
          getPublicUrl: jest.fn().mockReturnValue({
            data: { publicUrl: 'https://storage.example.com/attachments/123/photo.jpg' }
          })
        })
      };

      taskAttachmentRepository.create.mockResolvedValue({
        id: 1,
        task_id: taskId,
        file_name: 'photo.jpg',
        file_type: 'image/jpeg',
        file_size: 1048576,
        file_url: 'https://storage.example.com/attachments/123/photo.jpg',
        uploaded_by: userId
      });

      await expect(
        taskAttachmentService.uploadAttachments(taskId, jpgFile, userId)
      ).resolves.toBeDefined();
    });

    test('should handle task not found', async () => {
      const taskId = 999;
      const userId = 1;

      taskRepository.getById.mockResolvedValue(null);

      await expect(
        taskAttachmentService.uploadAttachments(taskId, mockFiles, userId)
      ).rejects.toThrow('Task not found');
    });

    test('should handle storage upload failure', async () => {
      const taskId = 123;
      const userId = 1;

      taskAttachmentRepository.getTotalSize.mockResolvedValue(0);
      taskRepository.getById.mockResolvedValue({
        id: taskId,
        title: 'Test Task'
      });

      supabase.storage = {
        from: jest.fn().mockReturnValue({
          upload: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Storage upload failed' }
          })
        })
      };

      await expect(
        taskAttachmentService.uploadAttachments(taskId, mockFiles, userId)
      ).rejects.toThrow('Storage upload failed');
    });
  });

  describe('getAttachments', () => {
    test('should retrieve all attachments for a task', async () => {
      const taskId = 123;
      const mockAttachments = [
        {
          id: 1,
          task_id: taskId,
          file_name: 'document.pdf',
          file_type: 'application/pdf',
          file_size: 5242880,
          file_url: 'https://storage.example.com/attachments/123/document.pdf',
          uploaded_by: 1,
          uploaded_at: '2025-10-20T10:00:00Z'
        },
        {
          id: 2,
          task_id: taskId,
          file_name: 'image.png',
          file_type: 'image/png',
          file_size: 2097152,
          file_url: 'https://storage.example.com/attachments/123/image.png',
          uploaded_by: 1,
          uploaded_at: '2025-10-20T10:00:01Z'
        }
      ];

      taskAttachmentRepository.getByTaskId.mockResolvedValue(mockAttachments);

      const result = await taskAttachmentService.getAttachments(taskId);

      expect(taskAttachmentRepository.getByTaskId).toHaveBeenCalledWith(taskId);
      expect(result.attachments).toEqual(mockAttachments);
      expect(result.totalSize).toBe(7340032); // 5MB + 2MB
    });

    test('should return empty array when no attachments exist', async () => {
      const taskId = 123;

      taskAttachmentRepository.getByTaskId.mockResolvedValue([]);

      const result = await taskAttachmentService.getAttachments(taskId);

      expect(result.attachments).toEqual([]);
      expect(result.totalSize).toBe(0);
    });
  });

  describe('deleteAttachment', () => {
    test('should successfully delete attachment when user is uploader', async () => {
      const taskId = 123;
      const attachmentId = 1;
      const userId = 1;

      const mockAttachment = {
        id: attachmentId,
        task_id: taskId,
        file_name: 'document.pdf',
        file_url: 'https://storage.example.com/attachments/123/document.pdf',
        uploaded_by: userId
      };

      taskAttachmentRepository.getById.mockResolvedValue(mockAttachment);

      supabase.storage = {
        from: jest.fn().mockReturnValue({
          remove: jest.fn().mockResolvedValue({
            data: {},
            error: null
          })
        })
      };

      taskAttachmentRepository.deleteById.mockResolvedValue(true);

      const result = await taskAttachmentService.deleteAttachment(taskId, attachmentId, userId);

      expect(taskAttachmentRepository.getById).toHaveBeenCalledWith(attachmentId);
      expect(taskAttachmentRepository.deleteById).toHaveBeenCalledWith(attachmentId);
      expect(result.message).toBe('Attachment deleted successfully');
    });

    test('should reject deletion when user is not the uploader', async () => {
      const taskId = 123;
      const attachmentId = 1;
      const userId = 2; // Different user

      const mockAttachment = {
        id: attachmentId,
        task_id: taskId,
        file_name: 'document.pdf',
        uploaded_by: 1 // Original uploader
      };

      taskAttachmentRepository.getById.mockResolvedValue(mockAttachment);

      await expect(
        taskAttachmentService.deleteAttachment(taskId, attachmentId, userId)
      ).rejects.toThrow('Unauthorized to delete this attachment');
    });

    test('should handle attachment not found', async () => {
      const taskId = 123;
      const attachmentId = 999;
      const userId = 1;

      taskAttachmentRepository.getById.mockResolvedValue(null);

      await expect(
        taskAttachmentService.deleteAttachment(taskId, attachmentId, userId)
      ).rejects.toThrow('Attachment not found');
    });

    test('should handle storage deletion failure', async () => {
      const taskId = 123;
      const attachmentId = 1;
      const userId = 1;

      const mockAttachment = {
        id: attachmentId,
        task_id: taskId,
        file_name: 'document.pdf',
        file_url: 'https://storage.example.com/attachments/123/document.pdf',
        uploaded_by: userId
      };

      taskAttachmentRepository.getById.mockResolvedValue(mockAttachment);

      supabase.storage = {
        from: jest.fn().mockReturnValue({
          remove: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Storage deletion failed' }
          })
        })
      };

      await expect(
        taskAttachmentService.deleteAttachment(taskId, attachmentId, userId)
      ).rejects.toThrow('Storage deletion failed');
    });
  });

  describe('copyAttachmentsToTask', () => {
    test('should copy attachments from source task to destination task', async () => {
      const sourceTaskId = 123;
      const destinationTaskId = 456;
      const userId = 1;

      const mockSourceAttachments = [
        {
          id: 1,
          task_id: sourceTaskId,
          file_name: 'document.pdf',
          file_type: 'application/pdf',
          file_size: 5242880,
          file_url: 'https://storage.example.com/attachments/123/document.pdf',
          uploaded_by: 1
        },
        {
          id: 2,
          task_id: sourceTaskId,
          file_name: 'image.png',
          file_type: 'image/png',
          file_size: 2097152,
          file_url: 'https://storage.example.com/attachments/123/image.png',
          uploaded_by: 1
        }
      ];

      taskAttachmentRepository.getByTaskId.mockResolvedValue(mockSourceAttachments);
      taskAttachmentRepository.getTotalSize.mockResolvedValue(0);

      supabase.storage = {
        from: jest.fn().mockReturnValue({
          copy: jest.fn().mockResolvedValue({
            data: { path: 'copied-path' },
            error: null
          }),
          getPublicUrl: jest.fn().mockReturnValue({
            data: { publicUrl: 'https://storage.example.com/attachments/456/document.pdf' }
          })
        })
      };

      taskAttachmentRepository.create.mockResolvedValueOnce({
        id: 3,
        task_id: destinationTaskId,
        file_name: 'document.pdf',
        file_type: 'application/pdf',
        file_size: 5242880,
        file_url: 'https://storage.example.com/attachments/456/document.pdf',
        uploaded_by: userId
      });

      taskAttachmentRepository.create.mockResolvedValueOnce({
        id: 4,
        task_id: destinationTaskId,
        file_name: 'image.png',
        file_type: 'image/png',
        file_size: 2097152,
        file_url: 'https://storage.example.com/attachments/456/image.png',
        uploaded_by: userId
      });

      const result = await taskAttachmentService.copyAttachmentsToTask(
        sourceTaskId,
        destinationTaskId,
        userId
      );

      expect(taskAttachmentRepository.getByTaskId).toHaveBeenCalledWith(sourceTaskId);
      expect(result.attachments).toHaveLength(2);
      expect(result.attachments[0].task_id).toBe(destinationTaskId);
      expect(result.attachments[1].task_id).toBe(destinationTaskId);
    });

    test('should return empty array when source task has no attachments', async () => {
      const sourceTaskId = 123;
      const destinationTaskId = 456;
      const userId = 1;

      taskAttachmentRepository.getByTaskId.mockResolvedValue([]);

      const result = await taskAttachmentService.copyAttachmentsToTask(
        sourceTaskId,
        destinationTaskId,
        userId
      );

      expect(result.attachments).toEqual([]);
      expect(result.totalSize).toBe(0);
    });

    test('should reject copy if destination would exceed 50MB limit', async () => {
      const sourceTaskId = 123;
      const destinationTaskId = 456;
      const userId = 1;

      const mockSourceAttachments = [
        {
          id: 1,
          task_id: sourceTaskId,
          file_name: 'document.pdf',
          file_type: 'application/pdf',
          file_size: 1024 * 1024 * 30, // 30MB
          file_url: 'https://storage.example.com/attachments/123/document.pdf',
          uploaded_by: 1
        }
      ];

      taskAttachmentRepository.getByTaskId.mockResolvedValue(mockSourceAttachments);
      taskAttachmentRepository.getTotalSize.mockResolvedValue(1024 * 1024 * 25); // 25MB existing

      await expect(
        taskAttachmentService.copyAttachmentsToTask(sourceTaskId, destinationTaskId, userId)
      ).rejects.toThrow('Total file size cannot exceed 50MB');
    });
  });

  describe('downloadAttachment', () => {
    test('should successfully download an attachment', async () => {
      const taskId = 123;
      const attachmentId = 1;

      const mockAttachment = {
        id: attachmentId,
        task_id: taskId,
        file_name: 'document.pdf',
        file_type: 'application/pdf',
        file_url: 'https://storage.example.com/attachments/123/document.pdf'
      };

      const mockFileBuffer = Buffer.from('mock file content');

      taskAttachmentRepository.getById.mockResolvedValue(mockAttachment);

      supabase.storage = {
        from: jest.fn().mockReturnValue({
          download: jest.fn().mockResolvedValue({
            data: mockFileBuffer,
            error: null
          })
        })
      };

      const result = await taskAttachmentService.downloadAttachment(taskId, attachmentId);

      expect(result.buffer).toEqual(mockFileBuffer);
      expect(result.fileName).toBe('document.pdf');
      expect(result.mimeType).toBe('application/pdf');
    });

    test('should handle attachment not found', async () => {
      const taskId = 123;
      const attachmentId = 999;

      taskAttachmentRepository.getById.mockResolvedValue(null);

      await expect(
        taskAttachmentService.downloadAttachment(taskId, attachmentId)
      ).rejects.toThrow('Attachment not found');
    });

    test('should handle storage download failure', async () => {
      const taskId = 123;
      const attachmentId = 1;

      const mockAttachment = {
        id: attachmentId,
        task_id: taskId,
        file_name: 'document.pdf',
        file_type: 'application/pdf',
        file_url: 'https://storage.example.com/attachments/123/document.pdf'
      };

      taskAttachmentRepository.getById.mockResolvedValue(mockAttachment);

      supabase.storage = {
        from: jest.fn().mockReturnValue({
          download: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'File not found in storage' }
          })
        })
      };

      await expect(
        taskAttachmentService.downloadAttachment(taskId, attachmentId)
      ).rejects.toThrow('File not found in storage');
    });
  });
});
