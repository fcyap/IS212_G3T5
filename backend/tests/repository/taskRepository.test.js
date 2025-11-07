const taskRepository = require('../../src/repository/taskRepository');
const supabase = require('../../src/utils/supabase');

jest.mock('../../src/utils/supabase');

describe('TaskRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('list', () => {
    test('should list non-archived tasks', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null })
      };

      supabase.from.mockReturnValue(mockQuery);

      await taskRepository.list({ archived: false });

      expect(supabase.from).toHaveBeenCalledWith('tasks');
      expect(mockQuery.eq).toHaveBeenCalledWith('archived', false);
    });

    test('should list root tasks only when parentId is null', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null })
      };

      supabase.from.mockReturnValue(mockQuery);

      await taskRepository.list({ archived: false, parentId: null });

      expect(mockQuery.is).toHaveBeenCalledWith('parent_id', null);
    });

    test('should list subtasks when parentId is provided', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null })
      };

      supabase.from.mockReturnValue(mockQuery);

      await taskRepository.list({ archived: false, parentId: 5 });

      expect(mockQuery.eq).toHaveBeenCalledWith('parent_id', 5);
    });
  });

  describe('insert', () => {
    test('should insert task and hydrate assignees', async () => {
      const taskData = {
        title: 'New Task',
        assigned_to: [1, 2]
      };

      const mockTask = { id: 1, ...taskData };
      const mockUsers = [
        { id: 1, name: 'User 1', email: 'user1@test.com' },
        { id: 2, name: 'User 2', email: 'user2@test.com' }
      ];

      supabase.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockTask, error: null })
      }).mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: mockUsers, error: null })
      });

      const result = await taskRepository.insert(taskData);

      expect(result.id).toBe(1);
      expect(result.assignees).toHaveLength(2);
      expect(result.assignees[0].name).toBe('User 1');
    });

    test('should throw error on insert failure', async () => {
      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Insert failed' }
        })
      });

      await expect(taskRepository.insert({})).rejects.toThrow('Insert failed');
    });
  });

  describe('updateById', () => {
    test('should update task and hydrate assignees', async () => {
      const updates = { title: 'Updated', assigned_to: [1] };
      const mockTask = { id: 1, ...updates };
      const mockUsers = [{ id: 1, name: 'User 1' }];

      supabase.from.mockReturnValueOnce({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockTask, error: null })
      }).mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: mockUsers, error: null })
      });

      const result = await taskRepository.updateById(1, updates);

      expect(result.title).toBe('Updated');
      expect(result.assignees).toHaveLength(1);
    });

    test('should handle task with no assignees', async () => {
      const updates = { title: 'Updated', assigned_to: [] };
      const mockTask = { id: 1, ...updates };

      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockTask, error: null })
      });

      const result = await taskRepository.updateById(1, updates);

      expect(result.assignees).toEqual([]);
    });

    test('should throw error on update failure', async () => {
      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Update failed' }
        })
      });

      await expect(taskRepository.updateById(1, {})).rejects.toThrow('Update failed');
    });

    test('should throw error when hydrating assignees fails', async () => {
      const updates = { assigned_to: [1] };
      const mockTask = { id: 1, ...updates };

      supabase.from.mockReturnValueOnce({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockTask, error: null })
      }).mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'User fetch failed' }
        })
      });

      await expect(taskRepository.updateById(1, updates)).rejects.toThrow('User fetch failed');
    });
  });

  describe('getUsersByIds', () => {
    test('should get users by ids', async () => {
      const mockUsers = [
        { id: 1, name: 'User 1' },
        { id: 2, name: 'User 2' }
      ];

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: mockUsers, error: null })
      });

      const result = await taskRepository.getUsersByIds([1, 2]);

      expect(result.data).toEqual(mockUsers);
    });

    test('should return empty array for empty ids', async () => {
      const result = await taskRepository.getUsersByIds([]);

      expect(result.data).toEqual([]);
    });

    test('should return empty array for null ids', async () => {
      const result = await taskRepository.getUsersByIds(null);

      expect(result.data).toEqual([]);
    });
  });

  describe('getAllTasks', () => {
    test('should get all tasks', async () => {
      const mockTasks = [
        { id: 1, title: 'Task 1' },
        { id: 2, title: 'Task 2' }
      ];

      supabase.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: mockTasks, error: null })
      });

      const result = await taskRepository.getAllTasks();

      expect(result).toEqual(mockTasks);
    });

    test('should throw error on failure', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Fetch failed' }
        })
      });

      await expect(taskRepository.getAllTasks()).rejects.toThrow('Fetch failed');
    });

    test('should return empty array when data is null', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      const result = await taskRepository.getAllTasks();

      expect(result).toEqual([]);
    });
  });

  describe('getTasksByProjectId', () => {
    test('should get tasks by project id', async () => {
      const mockTasks = [
        { id: 1, title: 'Task 1', project_id: 5 },
        { id: 2, title: 'Task 2', project_id: 5 }
      ];

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: mockTasks, error: null })
      });

      const result = await taskRepository.getTasksByProjectId(5);

      expect(result).toEqual(mockTasks);
    });

    test('should throw error on failure', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Fetch failed' }
        })
      });

      await expect(taskRepository.getTasksByProjectId(5)).rejects.toThrow('Fetch failed');
    });

    test('should return empty array when data is null', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      const result = await taskRepository.getTasksByProjectId(5);

      expect(result).toEqual([]);
    });
  });

  describe('getTaskById', () => {
    test('should get task by id', async () => {
      const mockTask = { id: 1, title: 'Task 1' };

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockTask, error: null })
      });

      const result = await taskRepository.getTaskById(1);

      expect(result).toEqual(mockTask);
    });

    test('should throw error when task not found', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Task not found' }
        })
      });

      await expect(taskRepository.getTaskById(999)).rejects.toThrow('Task not found');
    });
  });

  describe('createTask', () => {
    test('should create task successfully', async () => {
      const taskData = { title: 'New Task', status: 'pending' };
      const mockTask = { id: 1, ...taskData };

      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: [mockTask], error: null })
      });

      const result = await taskRepository.createTask(taskData);

      expect(result).toEqual(mockTask);
    });

    test('should throw error on creation failure', async () => {
      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Creation failed' }
        })
      });

      await expect(taskRepository.createTask({})).rejects.toThrow('Creation failed');
    });
  });

  describe('_hydrateAssigneesRow', () => {
    test('should hydrate task with assignees', async () => {
      const task = { id: 1, title: 'Task', assigned_to: [1, 2] };
      const mockUsers = [
        { id: 1, name: 'User 1', email: 'user1@test.com' },
        { id: 2, name: 'User 2', email: 'user2@test.com' }
      ];

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: mockUsers, error: null })
      });

      const result = await taskRepository._hydrateAssigneesRow(task);

      expect(result.assignees).toHaveLength(2);
      expect(result.assignees[0].name).toBe('User 1');
    });

    test('should return empty assignees for task with no assigned_to', async () => {
      const task = { id: 1, title: 'Task', assigned_to: [] };

      const result = await taskRepository._hydrateAssigneesRow(task);

      expect(result.assignees).toEqual([]);
    });

    test('should handle non-array assigned_to', async () => {
      const task = { id: 1, title: 'Task', assigned_to: null };

      const result = await taskRepository._hydrateAssigneesRow(task);

      expect(result.assignees).toEqual([]);
    });

    test('should filter out invalid assignee ids', async () => {
      const task = { id: 1, title: 'Task', assigned_to: [1, null, 2, undefined] };
      const mockUsers = [
        { id: 1, name: 'User 1', email: 'user1@test.com' },
        { id: 2, name: 'User 2', email: 'user2@test.com' }
      ];

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: mockUsers, error: null })
      });

      const result = await taskRepository._hydrateAssigneesRow(task);

      expect(result.assignees).toHaveLength(2);
    });

    test('should throw error when user fetch fails', async () => {
      const task = { id: 1, title: 'Task', assigned_to: [1] };

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'User fetch failed' }
        })
      });

      await expect(taskRepository._hydrateAssigneesRow(task)).rejects.toThrow('User fetch failed');
    });

    test('should use custom fields when provided', async () => {
      const task = { id: 1, title: 'Task', assigned_to: [1] };
      const mockUsers = [{ id: 1, name: 'User 1', role: 'admin' }];
      const selectSpy = jest.fn().mockReturnThis();

      supabase.from.mockReturnValue({
        select: selectSpy,
        in: jest.fn().mockResolvedValue({ data: mockUsers, error: null })
      });

      await taskRepository._hydrateAssigneesRow(task, 'id, name, role');

      expect(selectSpy).toHaveBeenCalledWith('id, name, role');
    });
  });

  describe('deleteTask', () => {
    test('should delete task successfully', async () => {
      supabase.from.mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null })
      });

      const result = await taskRepository.deleteTask(1);

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

      await expect(taskRepository.deleteTask(1)).rejects.toThrow('Deletion failed');
    });
  });

  describe('getTasksWithFilters', () => {
    test('should get tasks with no filters', async () => {
      const mockTasks = [{ id: 1, title: 'Task' }];

      const mockQueryPromise = Promise.resolve({ data: mockTasks, error: null });
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnValue(mockQueryPromise),
        then: mockQueryPromise.then.bind(mockQueryPromise),
        catch: mockQueryPromise.catch.bind(mockQueryPromise)
      };

      supabase.from.mockReturnValue(mockQuery);

      const result = await taskRepository.getTasksWithFilters({});

      expect(result).toEqual(mockTasks);
    });

    test('should filter by projectId', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: [], error: null })
      };

      supabase.from.mockReturnValue(mockQuery);

      await taskRepository.getTasksWithFilters({ projectId: 5 });

      expect(mockQuery.eq).toHaveBeenCalledWith('project_id', 5);
      expect(mockQuery.eq).toHaveBeenCalledWith('archived', false);
    });

    test('should filter by status', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: [], error: null })
      };

      supabase.from.mockReturnValue(mockQuery);

      await taskRepository.getTasksWithFilters({ status: 'completed' });

      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'completed');
    });

    test('should filter by assignedTo', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        contains: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: [], error: null })
      };

      supabase.from.mockReturnValue(mockQuery);

      await taskRepository.getTasksWithFilters({ assignedTo: 3 });

      expect(mockQuery.contains).toHaveBeenCalledWith('assigned_to', [3]);
    });

    test('should filter by priority', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: [], error: null })
      };

      supabase.from.mockReturnValue(mockQuery);

      await taskRepository.getTasksWithFilters({ priority: 'high' });

      expect(mockQuery.eq).toHaveBeenCalledWith('priority', 'high');
    });

    test('should filter by archived', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: [], error: null })
      };

      supabase.from.mockReturnValue(mockQuery);

      await taskRepository.getTasksWithFilters({ archived: true });

      expect(mockQuery.eq).toHaveBeenCalledWith('archived', true);
    });

    test('should apply sorting', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: [], error: null })
      };

      supabase.from.mockReturnValue(mockQuery);

      await taskRepository.getTasksWithFilters({ sortBy: 'title', sortOrder: 'asc' });

      expect(mockQuery.order).toHaveBeenCalledWith('title', { ascending: true });
    });

    test('should apply pagination', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: [], error: null })
      };

      supabase.from.mockReturnValue(mockQuery);

      await taskRepository.getTasksWithFilters({ offset: 10, limit: 5 });

      expect(mockQuery.range).toHaveBeenCalledWith(10, 14);
    });

    test('should return empty array when data is null', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      const result = await taskRepository.getTasksWithFilters({});

      expect(result).toEqual([]);
    });

    test('should throw error on database error', async () => {
      const mockQueryPromise = Promise.resolve({
        data: null,
        error: { message: 'Database error' }
      });
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnValue(mockQueryPromise),
        then: mockQueryPromise.then.bind(mockQueryPromise),
        catch: mockQueryPromise.catch.bind(mockQueryPromise)
      };

      supabase.from.mockReturnValue(mockQuery);

      await expect(taskRepository.getTasksWithFilters({})).rejects.toThrow('Database error');
    });
  });

  describe('getTaskCount', () => {
    test('should get count with no filters', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ count: 42, error: null })
      });

      const result = await taskRepository.getTaskCount({});

      expect(result).toBe(42);
    });

    test('should filter by projectId', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis()
      };
      // Last call to eq returns the count
      mockQuery.eq.mockReturnValueOnce(mockQuery).mockResolvedValueOnce({ count: 10, error: null });

      supabase.from.mockReturnValue(mockQuery);

      await taskRepository.getTaskCount({ projectId: 5 });

      expect(mockQuery.eq).toHaveBeenCalledWith('project_id', 5);
    });

    test('should filter by status', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis()
      };
      mockQuery.eq.mockReturnValueOnce(mockQuery).mockResolvedValueOnce({ count: 5, error: null });

      supabase.from.mockReturnValue(mockQuery);

      await taskRepository.getTaskCount({ status: 'completed' });

      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'completed');
    });

    test('should filter by assignedTo', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        contains: jest.fn().mockReturnThis()
      };
      mockQuery.eq.mockResolvedValueOnce({ count: 3, error: null });

      supabase.from.mockReturnValue(mockQuery);

      await taskRepository.getTaskCount({ assignedTo: 3 });

      expect(mockQuery.contains).toHaveBeenCalledWith('assigned_to', [3]);
    });

    test('should filter by priority', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis()
      };
      mockQuery.eq.mockReturnValueOnce(mockQuery).mockResolvedValueOnce({ count: 7, error: null });

      supabase.from.mockReturnValue(mockQuery);

      await taskRepository.getTaskCount({ priority: 'high' });

      expect(mockQuery.eq).toHaveBeenCalledWith('priority', 'high');
    });

    test('should filter by archived', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis()
      };
      // archived is the only filter, so just one eq call
      mockQuery.eq.mockResolvedValueOnce({ count: 2, error: null });

      supabase.from.mockReturnValue(mockQuery);

      await taskRepository.getTaskCount({ archived: true });

      expect(mockQuery.eq).toHaveBeenCalledWith('archived', true);
    });

    test('should return 0 when count is null', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ count: null, error: null })
      });

      const result = await taskRepository.getTaskCount({});

      expect(result).toBe(0);
    });

    test('should throw error on database error', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          count: null,
          error: { message: 'Database error' }
        })
      });

      await expect(taskRepository.getTaskCount({})).rejects.toThrow('Database error');
    });
  });

  describe('getSubtasks', () => {
    test('should get subtasks for a parent task', async () => {
      const mockSubtasks = [
        { id: 2, parent_id: 1, title: 'Subtask 1' },
        { id: 3, parent_id: 1, title: 'Subtask 2' }
      ];

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockSubtasks, error: null })
      });

      const result = await taskRepository.getSubtasks(1);

      expect(result).toEqual(mockSubtasks);
    });

    test('should filter out archived subtasks', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null })
      };

      supabase.from.mockReturnValue(mockQuery);

      await taskRepository.getSubtasks(1);

      expect(mockQuery.eq).toHaveBeenCalledWith('parent_id', 1);
      expect(mockQuery.eq).toHaveBeenCalledWith('archived', false);
    });

    test('should order by created_at ascending', async () => {
      const orderSpy = jest.fn().mockResolvedValue({ data: [], error: null });

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: orderSpy
      });

      await taskRepository.getSubtasks(1);

      expect(orderSpy).toHaveBeenCalledWith('created_at', { ascending: true });
    });

    test('should return empty array when data is null', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      const result = await taskRepository.getSubtasks(1);

      expect(result).toEqual([]);
    });

    test('should throw error on database error', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' }
        })
      });

      await expect(taskRepository.getSubtasks(1)).rejects.toThrow('Database error');
    });
  });

  describe('insertMany', () => {
    test('should insert multiple tasks', async () => {
      const mockPayloads = [
        { title: 'Task 1', status: 'pending' },
        { title: 'Task 2', status: 'in_progress' }
      ];

      const mockInserted = [
        { id: 1, title: 'Task 1', status: 'pending' },
        { id: 2, title: 'Task 2', status: 'in_progress' }
      ];

      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: mockInserted, error: null })
      });

      const result = await taskRepository.insertMany(mockPayloads);

      expect(result).toEqual(mockInserted);
    });

    test('should return empty array for empty input', async () => {
      const result = await taskRepository.insertMany([]);

      expect(result).toEqual([]);
    });

    test('should return empty array for null input', async () => {
      const result = await taskRepository.insertMany(null);

      expect(result).toEqual([]);
    });

    test('should return empty array for non-array input', async () => {
      const result = await taskRepository.insertMany('not an array');

      expect(result).toEqual([]);
    });

    test('should throw error on insertion failure', async () => {
      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Insertion failed' }
        })
      });

      await expect(taskRepository.insertMany([{ title: 'Task' }]))
        .rejects.toThrow('Insertion failed');
    });
  });
});
