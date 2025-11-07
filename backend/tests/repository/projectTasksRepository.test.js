const projectTasksRepository = require('../../src/repository/projectTasksRepository');
const supabase = require('../../src/utils/supabase');

jest.mock('../../src/utils/supabase');

describe('ProjectTasksRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    test('should create task successfully', async () => {
      const taskData = { title: 'New Task', project_id: 1, status: 'pending' };
      const mockTask = { id: 1, ...taskData };

      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockTask, error: null })
      });

      const result = await projectTasksRepository.create(taskData);

      expect(result).toEqual(mockTask);
      expect(supabase.from).toHaveBeenCalledWith('tasks');
    });

    test('should throw error on creation failure', async () => {
      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Creation failed' }
        })
      });

      await expect(projectTasksRepository.create({})).rejects.toThrow('Database error: Creation failed');
    });
  });

  describe('findAll', () => {
    test('should find all tasks without filters', async () => {
      const mockTasks = [
        { id: 1, title: 'Task 1' },
        { id: 2, title: 'Task 2' }
      ];

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockTasks, error: null, count: 2 })
      });

      const result = await projectTasksRepository.findAll();

      expect(result.data).toEqual(mockTasks);
      expect(result.count).toBe(2);
    });

    test('should apply status filter', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null, count: 0 })
      };

      supabase.from.mockReturnValue(mockQuery);

      await projectTasksRepository.findAll({ status: 'completed' });

      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'completed');
    });

    test('should apply project_id filter', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null, count: 0 })
      };

      supabase.from.mockReturnValue(mockQuery);

      await projectTasksRepository.findAll({ project_id: 5 });

      expect(mockQuery.eq).toHaveBeenCalledWith('project_id', 5);
    });

    test('should apply assigned_to filter', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        contains: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null, count: 0 })
      };

      supabase.from.mockReturnValue(mockQuery);

      await projectTasksRepository.findAll({ assigned_to: '3' });

      expect(mockQuery.contains).toHaveBeenCalledWith('assigned_to', [3]);
    });

    test('should apply priority filter', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null, count: 0 })
      };

      supabase.from.mockReturnValue(mockQuery);

      await projectTasksRepository.findAll({ priority: 'high' });

      expect(mockQuery.eq).toHaveBeenCalledWith('priority', 'high');
    });

    test('should apply custom sorting', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null, count: 0 })
      };

      supabase.from.mockReturnValue(mockQuery);

      await projectTasksRepository.findAll({}, {}, { sortBy: 'title', sortOrder: 'asc' });

      expect(mockQuery.order).toHaveBeenCalledWith('title', { ascending: true });
    });

    test('should apply pagination', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: [], error: null, count: 0 })
      };

      supabase.from.mockReturnValue(mockQuery);

      await projectTasksRepository.findAll({}, { offset: 10, limit: 5 });

      expect(mockQuery.range).toHaveBeenCalledWith(10, 14);
    });

    test('should throw error on database error', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
          count: null
        })
      });

      await expect(projectTasksRepository.findAll()).rejects.toThrow('Database error: Database error');
    });

    test('should return empty array when data is null', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: null, count: null })
      });

      const result = await projectTasksRepository.findAll();

      expect(result.data).toEqual([]);
      expect(result.count).toBe(0);
    });
  });

  describe('findByProjectId', () => {
    test('should find tasks by project id', async () => {
      const mockTasks = [{ id: 1, title: 'Task 1', project_id: 5 }];

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockTasks, error: null, count: 1 })
      });

      const result = await projectTasksRepository.findByProjectId(5);

      expect(result.data).toEqual(mockTasks);
    });

    test('should pass filters to findAll', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null, count: 0 })
      });

      const filters = { status: 'completed' };
      await projectTasksRepository.findByProjectId(5, filters);

      // Should have eq called for both project_id and status
      const mockQuery = supabase.from();
      expect(mockQuery.eq).toHaveBeenCalledWith('project_id', 5);
      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'completed');
    });
  });

  describe('findByIdAndProjectId', () => {
    test('should find task by id and project id', async () => {
      const mockTask = { id: 1, title: 'Task 1', project_id: 5 };

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockTask, error: null })
      });

      const result = await projectTasksRepository.findByIdAndProjectId(1, 5);

      expect(result).toEqual(mockTask);
    });

    test('should return null when task not found', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'Not found' }
        })
      });

      const result = await projectTasksRepository.findByIdAndProjectId(999, 5);

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

      await expect(projectTasksRepository.findByIdAndProjectId(1, 5)).rejects.toThrow('Database error');
    });
  });

  describe('findById', () => {
    test('should find task by id', async () => {
      const mockTask = { id: 1, title: 'Task 1' };

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockTask, error: null })
      });

      const result = await projectTasksRepository.findById(1);

      expect(result).toEqual(mockTask);
    });

    test('should return null when task not found', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'Not found' }
        })
      });

      const result = await projectTasksRepository.findById(999);

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

      await expect(projectTasksRepository.findById(1)).rejects.toThrow('Database error');
    });
  });

  describe('update', () => {
    test('should update task successfully', async () => {
      const updates = { title: 'Updated Title', status: 'completed' };
      const mockTask = { id: 1, ...updates };

      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockTask, error: null })
      });

      const result = await projectTasksRepository.update(1, updates);

      expect(result).toEqual(mockTask);
    });

    test('should include updated_at timestamp', async () => {
      const updateSpy = jest.fn().mockReturnThis();
      const mockTask = { id: 1, title: 'Updated' };

      supabase.from.mockReturnValue({
        update: updateSpy,
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockTask, error: null })
      });

      await projectTasksRepository.update(1, { title: 'Updated' });

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Updated',
          updated_at: expect.any(String)
        })
      );
    });

    test('should return null when task not found', async () => {
      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'Not found' }
        })
      });

      const result = await projectTasksRepository.update(999, {});

      expect(result).toBeNull();
    });

    test('should throw error on database error', async () => {
      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Update failed' }
        })
      });

      await expect(projectTasksRepository.update(1, {})).rejects.toThrow('Database error: Update failed');
    });
  });

  describe('delete', () => {
    test('should delete task successfully', async () => {
      supabase.from.mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null })
      });

      const result = await projectTasksRepository.delete(1);

      expect(result).toBe(true);
      expect(supabase.from).toHaveBeenCalledWith('tasks');
    });

    test('should throw error on deletion failure', async () => {
      supabase.from.mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          error: { message: 'Deletion failed' }
        })
      });

      await expect(projectTasksRepository.delete(1)).rejects.toThrow('Database error: Deletion failed');
    });
  });

  describe('getTaskStats', () => {
    test('should get task stats for project', async () => {
      const mockStats = [
        { status: 'pending', priority: 'high', deadline: '2025-12-31' },
        { status: 'completed', priority: 'medium', deadline: '2025-11-30' }
      ];

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: mockStats, error: null })
      });

      const result = await projectTasksRepository.getTaskStats(1);

      expect(result).toEqual(mockStats);
    });

    test('should return empty array when data is null', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      const result = await projectTasksRepository.getTaskStats(1);

      expect(result).toEqual([]);
    });

    test('should throw error on database error', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Stats fetch failed' }
        })
      });

      await expect(projectTasksRepository.getTaskStats(1)).rejects.toThrow('Database error: Stats fetch failed');
    });
  });

  describe('archiveTasksByProjectId', () => {
    test('should archive non-completed tasks', async () => {
      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        neq: jest.fn().mockResolvedValue({ error: null })
      });

      const result = await projectTasksRepository.archiveTasksByProjectId(1);

      expect(result).toBe(true);
      const mockQuery = supabase.from();
      expect(mockQuery.neq).toHaveBeenCalledWith('status', 'completed');
    });

    test('should throw error on archive failure', async () => {
      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        neq: jest.fn().mockResolvedValue({
          error: { message: 'Archive failed' }
        })
      });

      await expect(projectTasksRepository.archiveTasksByProjectId(1)).rejects.toThrow('Database error: Archive failed');
    });
  });
});
