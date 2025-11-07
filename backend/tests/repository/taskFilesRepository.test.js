const taskFilesRepository = require('../../src/repository/taskFilesRepository');
const supabase = require('../../src/utils/supabase');

jest.mock('../../src/utils/supabase');

describe('TaskFilesRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    test('should create task file record successfully', async () => {
      const mockFile = {
        id: 1,
        task_id: 5,
        user_id: 1,
        file_path: 'uploads/file.pdf',
        file_name: 'file.pdf',
        file_url: 'https://example.com/file.pdf'
      };

      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockFile, error: null })
      });

      const result = await taskFilesRepository.create(5, 1, 'uploads/file.pdf', 'file.pdf', 'https://example.com/file.pdf');

      expect(result).toEqual(mockFile);
      expect(supabase.from).toHaveBeenCalledWith('task_files');
    });

    test('should throw error on creation failure', async () => {
      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Insert failed' }
        })
      });

      await expect(taskFilesRepository.create(5, 1, 'path', 'name', 'url'))
        .rejects.toThrow('Failed to create task file record: Insert failed');
    });
  });

  describe('getByTaskId', () => {
    test('should get all files for a task', async () => {
      const mockFiles = [
        { id: 1, task_id: 5, file_name: 'file1.pdf' },
        { id: 2, task_id: 5, file_name: 'file2.pdf' }
      ];

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockFiles, error: null })
      });

      const result = await taskFilesRepository.getByTaskId(5);

      expect(result).toEqual(mockFiles);
    });

    test('should return empty array when data is null', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      const result = await taskFilesRepository.getByTaskId(5);

      expect(result).toEqual([]);
    });

    test('should throw error on fetch failure', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Fetch failed' }
        })
      });

      await expect(taskFilesRepository.getByTaskId(5))
        .rejects.toThrow('Failed to fetch task files: Fetch failed');
    });
  });

  describe('getById', () => {
    test('should get file by id', async () => {
      const mockFile = { id: 1, task_id: 5, file_name: 'file.pdf' };

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockFile, error: null })
      });

      const result = await taskFilesRepository.getById(1);

      expect(result).toEqual(mockFile);
    });

    test('should return null when file not found', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'Not found' }
        })
      });

      const result = await taskFilesRepository.getById(999);

      expect(result).toBeNull();
    });

    test('should throw error on database error', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' }
        })
      });

      await expect(taskFilesRepository.getById(1))
        .rejects.toThrow('Failed to fetch task file: Database error');
    });
  });

  describe('deleteById', () => {
    test('should delete file successfully', async () => {
      supabase.from.mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null })
      });

      const result = await taskFilesRepository.deleteById(1);

      expect(result).toBe(true);
    });

    test('should throw error on deletion failure', async () => {
      supabase.from.mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          error: { message: 'Deletion failed' }
        })
      });

      await expect(taskFilesRepository.deleteById(1))
        .rejects.toThrow('Failed to delete task file: Deletion failed');
    });
  });

  describe('deleteByTaskId', () => {
    test('should delete all files for a task and return count', async () => {
      const deletedFiles = [{ id: 1 }, { id: 2 }];

      supabase.from.mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: deletedFiles, error: null })
      });

      const result = await taskFilesRepository.deleteByTaskId(5);

      expect(result).toBe(2);
    });

    test('should return 0 when no files deleted', async () => {
      supabase.from.mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      const result = await taskFilesRepository.deleteByTaskId(5);

      expect(result).toBe(0);
    });

    test('should throw error on deletion failure', async () => {
      supabase.from.mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Batch deletion failed' }
        })
      });

      await expect(taskFilesRepository.deleteByTaskId(5))
        .rejects.toThrow('Failed to delete task files: Batch deletion failed');
    });
  });

  describe('getByUserId', () => {
    test('should get files by user id', async () => {
      const mockFiles = [
        { id: 1, user_id: 3, file_name: 'file1.pdf' },
        { id: 2, user_id: 3, file_name: 'file2.pdf' }
      ];

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockFiles, error: null })
      });

      const result = await taskFilesRepository.getByUserId(3);

      expect(result).toEqual(mockFiles);
    });

    test('should return empty array when data is null', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      const result = await taskFilesRepository.getByUserId(3);

      expect(result).toEqual([]);
    });

    test('should throw error on fetch failure', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Fetch failed' }
        })
      });

      await expect(taskFilesRepository.getByUserId(3))
        .rejects.toThrow('Failed to fetch user files: Fetch failed');
    });
  });

  describe('countByTaskId', () => {
    test('should count files for a task', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null, count: 5 })
      });

      const result = await taskFilesRepository.countByTaskId(5);

      expect(result).toBe(5);
    });

    test('should return 0 when count is null', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null, count: null })
      });

      const result = await taskFilesRepository.countByTaskId(5);

      expect(result).toBe(0);
    });

    test('should throw error on count failure', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Count failed' },
          count: null
        })
      });

      await expect(taskFilesRepository.countByTaskId(5))
        .rejects.toThrow('Failed to count task files: Count failed');
    });
  });
});
