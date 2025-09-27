const taskService = require('../../src/services/taskService');
const taskRepository = require('../../src/repository/taskRepository');
const projectRepository = require('../../src/repository/projectRepository');
const userRepository = require('../../src/repository/userRepository');

jest.mock('../../src/repository/taskRepository');
jest.mock('../../src/repository/projectRepository');
jest.mock('../../src/repository/userRepository');

describe('TaskService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listWithAssignees', () => {
    test('should list tasks with assignees successfully', async () => {
      const mockTasks = [
        { id: 1, title: 'Task 1', assigned_to: [1, 2] },
        { id: 2, title: 'Task 2', assigned_to: [1] },
        { id: 3, title: 'Task 3', assigned_to: null }
      ];

      const mockUsers = [
        { id: 1, name: 'User One' },
        { id: 2, name: 'User Two' }
      ];

      taskRepository.list.mockResolvedValue({ data: mockTasks, error: null });
      taskRepository.getUsersByIds.mockResolvedValue({ data: mockUsers, error: null });

      const result = await taskService.listWithAssignees();

      expect(taskRepository.list).toHaveBeenCalledWith({ archived: false });
      expect(taskRepository.getUsersByIds).toHaveBeenCalledWith([1, 2]);
      expect(result).toHaveLength(3);
      expect(result[0].assignees).toEqual([
        { id: 1, name: 'User One' },
        { id: 2, name: 'User Two' }
      ]);
      expect(result[1].assignees).toEqual([
        { id: 1, name: 'User One' }
      ]);
      expect(result[2].assignees).toEqual([]);
    });

    test('should handle archived parameter', async () => {
      const mockTasks = [];
      taskRepository.list.mockResolvedValue({ data: mockTasks, error: null });

      await taskService.listWithAssignees({ archived: true });

      expect(taskRepository.list).toHaveBeenCalledWith({ archived: true });
    });

    test('should handle single assigned_to value', async () => {
      const mockTasks = [
        { id: 1, title: 'Task 1', assigned_to: 1 }
      ];

      const mockUsers = [
        { id: 1, name: 'User One' }
      ];

      taskRepository.list.mockResolvedValue({ data: mockTasks, error: null });
      taskRepository.getUsersByIds.mockResolvedValue({ data: mockUsers, error: null });

      const result = await taskService.listWithAssignees();

      expect(result[0].assignees).toEqual([
        { id: 1, name: 'User One' }
      ]);
    });

    test('should handle empty assigned_to list', async () => {
      const mockTasks = [
        { id: 1, title: 'Task 1', assigned_to: [] }
      ];

      taskRepository.list.mockResolvedValue({ data: mockTasks, error: null });

      const result = await taskService.listWithAssignees();

      expect(taskRepository.getUsersByIds).not.toHaveBeenCalled();
      expect(result[0].assignees).toEqual([]);
    });

    test('should handle task repository error by falling back to getAllTasks', async () => {
      const mockTasks = [
        { id: 1, title: 'Task 1', status: 'pending' }
      ];

      taskRepository.list.mockResolvedValue({ data: null, error: new Error('Database error') });
      taskService.getAllTasks = jest.fn().mockResolvedValue(mockTasks);

      const result = await taskService.listWithAssignees();

      expect(taskService.getAllTasks).toHaveBeenCalledWith({ archived: false });
      expect(result).toEqual(mockTasks);
    });

    test('should handle user repository error by falling back to getAllTasks', async () => {
      const mockTasks = [
        { id: 1, title: 'Task 1', assigned_to: [1] }
      ];

      taskRepository.list.mockResolvedValue({ data: mockTasks, error: null });
      taskRepository.getUsersByIds.mockResolvedValue({ data: null, error: new Error('User fetch error') });
      taskService.getAllTasks = jest.fn().mockResolvedValue(mockTasks);

      const result = await taskService.listWithAssignees();

      expect(taskService.getAllTasks).toHaveBeenCalledWith({ archived: false });
      expect(result).toEqual(mockTasks);
    });

    test('should filter out invalid user IDs', async () => {
      const mockTasks = [
        { id: 1, title: 'Task 1', assigned_to: [1, 'invalid', null, 2] }
      ];

      const mockUsers = [
        { id: 1, name: 'User One' },
        { id: 2, name: 'User Two' }
      ];

      taskRepository.list.mockResolvedValue({ data: mockTasks, error: null });
      taskRepository.getUsersByIds.mockResolvedValue({ data: mockUsers, error: null });

      const result = await taskService.listWithAssignees();

      expect(taskRepository.getUsersByIds).toHaveBeenCalledWith([1, 2]);
      expect(result[0].assignees).toEqual([
        { id: 1, name: 'User One' },
        { id: 2, name: 'User Two' }
      ]);
    });
  });

  describe('getAllTasks', () => {
    test('should get all tasks with filters successfully', async () => {
      const filters = {
        archived: false,
        status: 'pending',
        project_id: 1
      };

      const mockTasks = [
        { id: 1, title: 'Task 1', status: 'pending', project_id: 1 },
        { id: 2, title: 'Task 2', status: 'pending', project_id: 1 }
      ];

      taskRepository.getAllTasks.mockResolvedValue(mockTasks);

      const result = await taskService.getAllTasks(filters);

      expect(taskRepository.getAllTasks).toHaveBeenCalledWith(filters);
      expect(result).toEqual(mockTasks);
    });

    test('should handle repository error', async () => {
      const filters = {};
      taskRepository.getAllTasks.mockRejectedValue(new Error('Database error'));

      await expect(taskService.getAllTasks(filters))
        .rejects.toThrow('Database error');
    });
  });

  describe('createTask', () => {
    test('should create task successfully', async () => {
      const taskData = {
        title: 'New Task',
        description: 'Task description',
        status: 'pending',
        project_id: 1,
        assigned_to: [1, 2]
      };

      const mockCreatedTask = {
        id: 1,
        ...taskData,
        created_at: new Date().toISOString()
      };

      taskRepository.createTask.mockResolvedValue(mockCreatedTask);

      const result = await taskService.createTask(taskData);

      expect(taskRepository.createTask).toHaveBeenCalledWith(taskData);
      expect(result).toEqual(mockCreatedTask);
    });

    test('should handle creation error', async () => {
      const taskData = {
        title: 'New Task',
        description: 'Task description'
      };

      taskRepository.createTask.mockRejectedValue(new Error('Validation failed'));

      await expect(taskService.createTask(taskData))
        .rejects.toThrow('Validation failed');
    });

    test('should handle missing required fields', async () => {
      const taskData = {
        description: 'Task without title'
      };

      taskRepository.createTask.mockRejectedValue(new Error('Title is required'));

      await expect(taskService.createTask(taskData))
        .rejects.toThrow('Title is required');
    });
  });

  describe('updateTask', () => {
    test('should update task successfully', async () => {
      const taskId = 1;
      const updateData = {
        title: 'Updated Task',
        status: 'completed'
      };

      const mockUpdatedTask = {
        id: taskId,
        ...updateData,
        updated_at: new Date().toISOString()
      };

      taskRepository.updateTask.mockResolvedValue(mockUpdatedTask);

      const result = await taskService.updateTask(taskId, updateData);

      expect(taskRepository.updateTask).toHaveBeenCalledWith(taskId, updateData);
      expect(result).toEqual(mockUpdatedTask);
    });

    test('should handle task not found', async () => {
      const taskId = 999;
      const updateData = { title: 'Updated Task' };

      taskRepository.updateTask.mockRejectedValue(new Error('Task not found'));

      await expect(taskService.updateTask(taskId, updateData))
        .rejects.toThrow('Task not found');
    });

    test('should handle validation error', async () => {
      const taskId = 1;
      const updateData = { status: 'invalid_status' };

      taskRepository.updateTask.mockRejectedValue(new Error('Invalid status'));

      await expect(taskService.updateTask(taskId, updateData))
        .rejects.toThrow('Invalid status');
    });
  });

  describe('deleteTask', () => {
    test('should delete task successfully', async () => {
      const taskId = 1;

      const mockResult = {
        success: true,
        message: 'Task deleted successfully'
      };

      taskRepository.deleteTask.mockResolvedValue(mockResult);

      const result = await taskService.deleteTask(taskId);

      expect(taskRepository.deleteTask).toHaveBeenCalledWith(taskId);
      expect(result).toEqual(mockResult);
    });

    test('should handle task not found during deletion', async () => {
      const taskId = 999;

      taskRepository.deleteTask.mockRejectedValue(new Error('Task not found'));

      await expect(taskService.deleteTask(taskId))
        .rejects.toThrow('Task not found');
    });
  });

  describe('getTaskById', () => {
    test('should get task by id successfully', async () => {
      const taskId = 1;
      const mockTask = {
        id: taskId,
        title: 'Test Task',
        status: 'pending',
        project_id: 1
      };

      taskRepository.getTaskById.mockResolvedValue(mockTask);

      const result = await taskService.getTaskById(taskId);

      expect(taskRepository.getTaskById).toHaveBeenCalledWith(taskId);
      expect(result).toEqual(mockTask);
    });

    test('should handle task not found', async () => {
      const taskId = 999;

      taskRepository.getTaskById.mockRejectedValue(new Error('Task not found'));

      await expect(taskService.getTaskById(taskId))
        .rejects.toThrow('Task not found');
    });
  });

  describe('getTasksByProject', () => {
    test('should get tasks by project successfully', async () => {
      const projectId = 1;
      const filters = { status: 'pending' };

      const mockTasks = [
        { id: 1, title: 'Task 1', status: 'pending', project_id: 1 },
        { id: 2, title: 'Task 2', status: 'pending', project_id: 1 }
      ];

      taskRepository.getTasksByProject.mockResolvedValue(mockTasks);

      const result = await taskService.getTasksByProject(projectId, filters);

      expect(taskRepository.getTasksByProject).toHaveBeenCalledWith(projectId, filters);
      expect(result).toEqual(mockTasks);
    });

    test('should handle project not found', async () => {
      const projectId = 999;
      const filters = {};

      taskRepository.getTasksByProject.mockRejectedValue(new Error('Project not found'));

      await expect(taskService.getTasksByProject(projectId, filters))
        .rejects.toThrow('Project not found');
    });
  });

  describe('getTasksByUser', () => {
    test('should get tasks by user successfully', async () => {
      const userId = 1;
      const filters = { status: 'pending' };

      const mockTasks = [
        { id: 1, title: 'Task 1', status: 'pending', assigned_to: [1] },
        { id: 2, title: 'Task 2', status: 'pending', assigned_to: [1] }
      ];

      taskRepository.getTasksByUser.mockResolvedValue(mockTasks);

      const result = await taskService.getTasksByUser(userId, filters);

      expect(taskRepository.getTasksByUser).toHaveBeenCalledWith(userId, filters);
      expect(result).toEqual(mockTasks);
    });

    test('should handle user not found', async () => {
      const userId = 999;
      const filters = {};

      taskRepository.getTasksByUser.mockRejectedValue(new Error('User not found'));

      await expect(taskService.getTasksByUser(userId, filters))
        .rejects.toThrow('User not found');
    });
  });

  describe('archiveTask', () => {
    test('should archive task successfully', async () => {
      const taskId = 1;

      const mockArchivedTask = {
        id: taskId,
        title: 'Test Task',
        status: 'completed',
        archived: true
      };

      taskRepository.archiveTask.mockResolvedValue(mockArchivedTask);

      const result = await taskService.archiveTask(taskId);

      expect(taskRepository.archiveTask).toHaveBeenCalledWith(taskId);
      expect(result).toEqual(mockArchivedTask);
    });

    test('should handle task not found during archiving', async () => {
      const taskId = 999;

      taskRepository.archiveTask.mockRejectedValue(new Error('Task not found'));

      await expect(taskService.archiveTask(taskId))
        .rejects.toThrow('Task not found');
    });
  });

  describe('unarchiveTask', () => {
    test('should unarchive task successfully', async () => {
      const taskId = 1;

      const mockUnarchivedTask = {
        id: taskId,
        title: 'Test Task',
        status: 'completed',
        archived: false
      };

      taskRepository.unarchiveTask.mockResolvedValue(mockUnarchivedTask);

      const result = await taskService.unarchiveTask(taskId);

      expect(taskRepository.unarchiveTask).toHaveBeenCalledWith(taskId);
      expect(result).toEqual(mockUnarchivedTask);
    });

    test('should handle task not found during unarchiving', async () => {
      const taskId = 999;

      taskRepository.unarchiveTask.mockRejectedValue(new Error('Task not found'));

      await expect(taskService.unarchiveTask(taskId))
        .rejects.toThrow('Task not found');
    });
  });

  describe('assignTask', () => {
    test('should assign task to users successfully', async () => {
      const taskId = 1;
      const userIds = [1, 2];

      const mockAssignedTask = {
        id: taskId,
        title: 'Test Task',
        assigned_to: [1, 2]
      };

      taskRepository.assignTask.mockResolvedValue(mockAssignedTask);

      const result = await taskService.assignTask(taskId, userIds);

      expect(taskRepository.assignTask).toHaveBeenCalledWith(taskId, userIds);
      expect(result).toEqual(mockAssignedTask);
    });

    test('should handle task not found during assignment', async () => {
      const taskId = 999;
      const userIds = [1, 2];

      taskRepository.assignTask.mockRejectedValue(new Error('Task not found'));

      await expect(taskService.assignTask(taskId, userIds))
        .rejects.toThrow('Task not found');
    });

    test('should handle invalid user IDs', async () => {
      const taskId = 1;
      const userIds = [999, 998];

      taskRepository.assignTask.mockRejectedValue(new Error('Invalid user IDs'));

      await expect(taskService.assignTask(taskId, userIds))
        .rejects.toThrow('Invalid user IDs');
    });
  });
});