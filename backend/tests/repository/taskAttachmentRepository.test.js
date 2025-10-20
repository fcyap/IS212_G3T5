const taskAttachmentRepository = require('../../src/repository/taskAttachmentRepository');
const supabase = require('../../src/utils/supabase');

jest.mock('../../src/utils/supabase');

describe('TaskAttachmentRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    test('should create a new attachment record', async () => {
      const attachmentData = {
        task_id: 123,
        file_name: 'document.pdf',
        file_type: 'application/pdf',
        file_size: 5242880,
        file_url: 'https://storage.example.com/attachments/123/document.pdf',
        uploaded_by: 1
      };

      const mockResponse = {
        data: {
          id: 1,
          ...attachmentData,
          uploaded_at: '2025-10-20T10:00:00Z'
        },
        error: null
      };

      supabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue(mockResponse)
          })
        })
      });

      const result = await taskAttachmentRepository.create(attachmentData);

      expect(supabase.from).toHaveBeenCalledWith('task_attachments');
      expect(result.id).toBe(1);
      expect(result.task_id).toBe(123);
      expect(result.file_name).toBe('document.pdf');
    });

    test('should throw error when database insert fails', async () => {
      const attachmentData = {
        task_id: 123,
        file_name: 'document.pdf',
        file_type: 'application/pdf',
        file_size: 5242880,
        file_url: 'https://storage.example.com/attachments/123/document.pdf',
        uploaded_by: 1
      };

      const mockResponse = {
        data: null,
        error: { message: 'Database insert failed' }
      };

      supabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue(mockResponse)
          })
        })
      });

      await expect(
        taskAttachmentRepository.create(attachmentData)
      ).rejects.toThrow('Database insert failed');
    });
  });

  describe('getByTaskId', () => {
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

      const mockResponse = {
        data: mockAttachments,
        error: null
      };

      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue(mockResponse)
          })
        })
      });

      const result = await taskAttachmentRepository.getByTaskId(taskId);

      expect(supabase.from).toHaveBeenCalledWith('task_attachments');
      expect(result).toHaveLength(2);
      expect(result[0].file_name).toBe('document.pdf');
      expect(result[1].file_name).toBe('image.png');
    });

    test('should return empty array when task has no attachments', async () => {
      const taskId = 123;

      const mockResponse = {
        data: [],
        error: null
      };

      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue(mockResponse)
          })
        })
      });

      const result = await taskAttachmentRepository.getByTaskId(taskId);

      expect(result).toEqual([]);
    });

    test('should throw error when database query fails', async () => {
      const taskId = 123;

      const mockResponse = {
        data: null,
        error: { message: 'Database query failed' }
      };

      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue(mockResponse)
          })
        })
      });

      await expect(
        taskAttachmentRepository.getByTaskId(taskId)
      ).rejects.toThrow('Database query failed');
    });
  });

  describe('getById', () => {
    test('should retrieve a specific attachment by ID', async () => {
      const attachmentId = 1;
      const mockAttachment = {
        id: attachmentId,
        task_id: 123,
        file_name: 'document.pdf',
        file_type: 'application/pdf',
        file_size: 5242880,
        file_url: 'https://storage.example.com/attachments/123/document.pdf',
        uploaded_by: 1,
        uploaded_at: '2025-10-20T10:00:00Z'
      };

      const mockResponse = {
        data: mockAttachment,
        error: null
      };

      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue(mockResponse)
          })
        })
      });

      const result = await taskAttachmentRepository.getById(attachmentId);

      expect(supabase.from).toHaveBeenCalledWith('task_attachments');
      expect(result.id).toBe(attachmentId);
      expect(result.file_name).toBe('document.pdf');
    });

    test('should return null when attachment not found', async () => {
      const attachmentId = 999;

      const mockResponse = {
        data: null,
        error: { message: 'Not found', code: 'PGRST116' }
      };

      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue(mockResponse)
          })
        })
      });

      const result = await taskAttachmentRepository.getById(attachmentId);

      expect(result).toBeNull();
    });
  });

  describe('deleteById', () => {
    test('should successfully delete an attachment', async () => {
      const attachmentId = 1;

      const mockResponse = {
        data: { id: attachmentId },
        error: null
      };

      supabase.from = jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue(mockResponse)
        })
      });

      const result = await taskAttachmentRepository.deleteById(attachmentId);

      expect(supabase.from).toHaveBeenCalledWith('task_attachments');
      expect(result).toBe(true);
    });

    test('should throw error when deletion fails', async () => {
      const attachmentId = 1;

      const mockResponse = {
        data: null,
        error: { message: 'Deletion failed' }
      };

      supabase.from = jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue(mockResponse)
        })
      });

      await expect(
        taskAttachmentRepository.deleteById(attachmentId)
      ).rejects.toThrow('Deletion failed');
    });
  });

  describe('getTotalSize', () => {
    test('should calculate total size of all attachments for a task', async () => {
      const taskId = 123;

      const mockResponse = {
        data: [
          { file_size: 5242880 }, // 5MB
          { file_size: 2097152 }, // 2MB
          { file_size: 1048576 }  // 1MB
        ],
        error: null
      };

      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue(mockResponse)
        })
      });

      const result = await taskAttachmentRepository.getTotalSize(taskId);

      expect(supabase.from).toHaveBeenCalledWith('task_attachments');
      expect(result).toBe(8388608); // 8MB total
    });

    test('should return 0 when task has no attachments', async () => {
      const taskId = 123;

      const mockResponse = {
        data: [],
        error: null
      };

      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue(mockResponse)
        })
      });

      const result = await taskAttachmentRepository.getTotalSize(taskId);

      expect(result).toBe(0);
    });

    test('should throw error when query fails', async () => {
      const taskId = 123;

      const mockResponse = {
        data: null,
        error: { message: 'Query failed' }
      };

      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue(mockResponse)
        })
      });

      await expect(
        taskAttachmentRepository.getTotalSize(taskId)
      ).rejects.toThrow('Query failed');
    });
  });

  describe('deleteByTaskId', () => {
    test('should delete all attachments for a task', async () => {
      const taskId = 123;

      const mockResponse = {
        data: [{ id: 1 }, { id: 2 }],
        error: null
      };

      supabase.from = jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue(mockResponse)
        })
      });

      const result = await taskAttachmentRepository.deleteByTaskId(taskId);

      expect(supabase.from).toHaveBeenCalledWith('task_attachments');
      expect(result).toBe(true);
    });

    test('should throw error when deletion fails', async () => {
      const taskId = 123;

      const mockResponse = {
        data: null,
        error: { message: 'Bulk deletion failed' }
      };

      supabase.from = jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue(mockResponse)
        })
      });

      await expect(
        taskAttachmentRepository.deleteByTaskId(taskId)
      ).rejects.toThrow('Bulk deletion failed');
    });
  });

  describe('updateFileName', () => {
    test('should update attachment file name', async () => {
      const attachmentId = 1;
      const newFileName = 'renamed_document.pdf';

      const mockResponse = {
        data: {
          id: attachmentId,
          file_name: newFileName,
          file_type: 'application/pdf',
          file_size: 5242880
        },
        error: null
      };

      supabase.from = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue(mockResponse)
            })
          })
        })
      });

      const result = await taskAttachmentRepository.updateFileName(attachmentId, newFileName);

      expect(supabase.from).toHaveBeenCalledWith('task_attachments');
      expect(result.file_name).toBe(newFileName);
    });

    test('should throw error when update fails', async () => {
      const attachmentId = 1;
      const newFileName = 'renamed_document.pdf';

      const mockResponse = {
        data: null,
        error: { message: 'Update failed' }
      };

      supabase.from = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue(mockResponse)
            })
          })
        })
      });

      await expect(
        taskAttachmentRepository.updateFileName(attachmentId, newFileName)
      ).rejects.toThrow('Update failed');
    });
  });

  describe('countByTaskId', () => {
    test('should count attachments for a task', async () => {
      const taskId = 123;

      const mockResponse = {
        count: 3,
        error: null
      };

      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            count: jest.fn().mockResolvedValue(mockResponse)
          })
        })
      });

      const result = await taskAttachmentRepository.countByTaskId(taskId);

      expect(result).toBe(3);
    });

    test('should return 0 when task has no attachments', async () => {
      const taskId = 123;

      const mockResponse = {
        count: 0,
        error: null
      };

      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            count: jest.fn().mockResolvedValue(mockResponse)
          })
        })
      });

      const result = await taskAttachmentRepository.countByTaskId(taskId);

      expect(result).toBe(0);
    });
  });
});
