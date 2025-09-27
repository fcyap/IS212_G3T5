const projectTasksService = require('../../src/services/projectTasksService');
const projectTasksRepository = require('../../src/repository/projectTasksRepository');
const projectRepository = require('../../src/repository/projectRepository');

jest.mock('../../src/repository/projectTasksRepository');
jest.mock('../../src/repository/projectRepository');

describe('ProjectTasksService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateProjectExists', () => {
    test('should return true when project exists', async () => {
      projectRepository.exists.mockResolvedValue(true);

      const result = await projectTasksService.validateProjectExists(1);

      expect(projectRepository.exists).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });

    test('should throw error when project does not exist', async () => {
      projectRepository.exists.mockResolvedValue(false);

      await expect(projectTasksService.validateProjectExists(999))
        .rejects.toThrow('Project not found');
    });
  });

  describe('validatePositiveInteger', () => {
    test('should return valid positive integer', () => {
      const result = projectTasksService.validatePositiveInteger('5', 'testField');
      expect(result).toBe(5);
    });

    test('should throw error for negative number', () => {
      expect(() => {
        projectTasksService.validatePositiveInteger('-1', 'testField');
      }).toThrow('testField must be a positive integer');
    });

    test('should throw error for zero', () => {
      expect(() => {
        projectTasksService.validatePositiveInteger('0', 'testField');
      }).toThrow('testField must be a positive integer');
    });

    test('should throw error for non-numeric string', () => {
      expect(() => {
        projectTasksService.validatePositiveInteger('abc', 'testField');
      }).toThrow('testField must be a positive integer');
    });
  });

  describe('validateFilters', () => {
    test('should validate valid status filter', () => {
      const filters = { status: 'pending' };
      const result = projectTasksService.validateFilters(filters);
      expect(result.status).toBe('pending');
    });

    test('should throw error for invalid status', () => {
      const filters = { status: 'invalid_status' };
      expect(() => {
        projectTasksService.validateFilters(filters);
      }).toThrow('Invalid status. Must be one of: pending, in_progress, completed, cancelled');
    });

    test('should validate valid priority filter', () => {
      const filters = { priority: 'high' };
      const result = projectTasksService.validateFilters(filters);
      expect(result.priority).toBe('high');
    });

    test('should throw error for invalid priority', () => {
      const filters = { priority: 'urgent' };
      expect(() => {
        projectTasksService.validateFilters(filters);
      }).toThrow('Invalid priority. Must be one of: low, medium, high');
    });

    test('should validate assigned_to as positive integer', () => {
      const filters = { assigned_to: '5' };
      const result = projectTasksService.validateFilters(filters);
      expect(result.assigned_to).toBe(5);
    });

    test('should throw error for invalid assigned_to', () => {
      const filters = { assigned_to: 'invalid' };
      expect(() => {
        projectTasksService.validateFilters(filters);
      }).toThrow('assigned_to must be a positive integer');
    });
  });

  describe('getProjectTasks', () => {
    test('should get project tasks successfully', async () => {
      const projectId = 1;
      const options = {
        filters: { status: 'pending' },
        pagination: { page: 1, limit: 10 },
        sorting: { sortBy: 'created_at', sortOrder: 'desc' }
      };

      const mockTasks = [
        { id: 1, title: 'Task 1', status: 'pending' },
        { id: 2, title: 'Task 2', status: 'pending' }
      ];

      projectRepository.exists.mockResolvedValue(true);
      projectTasksRepository.getTasksByProject.mockResolvedValue({
        success: true,
        tasks: mockTasks,
        message: 'Tasks retrieved successfully'
      });

      const result = await projectTasksService.getProjectTasks(projectId, options);

      expect(projectRepository.exists).toHaveBeenCalledWith(1);
      expect(result.success).toBe(true);
      expect(result.tasks).toEqual(mockTasks);
    });

    test('should handle project not found', async () => {
      const projectId = 999;
      const options = {};

      projectRepository.exists.mockResolvedValue(false);

      const result = await projectTasksService.getProjectTasks(projectId, options);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Project not found');
    });
  });

  describe('createTask', () => {
    test('should create task successfully', async () => {
      const projectId = 1;
      const taskData = {
        title: 'New Task',
        description: 'Task description',
        status: 'pending',
        priority: 'medium'
      };

      const mockCreatedTask = {
        id: 1,
        ...taskData,
        project_id: projectId
      };

      projectRepository.exists.mockResolvedValue(true);
      projectTasksRepository.create.mockResolvedValue({
        success: true,
        task: mockCreatedTask,
        message: 'Task created successfully'
      });

      const result = await projectTasksService.createTask(projectId, taskData);

      expect(projectRepository.exists).toHaveBeenCalledWith(1);
      expect(projectTasksRepository.create).toHaveBeenCalledWith(projectId, taskData);
      expect(result.success).toBe(true);
      expect(result.task).toEqual(mockCreatedTask);
    });

    test('should handle project not found during task creation', async () => {
      const projectId = 999;
      const taskData = { title: 'New Task' };

      projectRepository.exists.mockResolvedValue(false);

      const result = await projectTasksService.createTask(projectId, taskData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Project not found');
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
        ...updateData
      };

      projectTasksRepository.update.mockResolvedValue({
        success: true,
        task: mockUpdatedTask,
        message: 'Task updated successfully'
      });

      const result = await projectTasksService.updateTask(taskId, updateData);

      expect(projectTasksRepository.update).toHaveBeenCalledWith(taskId, updateData);
      expect(result.success).toBe(true);
      expect(result.task).toEqual(mockUpdatedTask);
    });

    test('should handle task not found during update', async () => {
      const taskId = 999;
      const updateData = { title: 'Updated Task' };

      projectTasksRepository.update.mockResolvedValue({
        success: false,
        error: 'Task not found',
        message: 'Failed to update task'
      });

      const result = await projectTasksService.updateTask(taskId, updateData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Task not found');
    });
  });

  describe('deleteTask', () => {
    test('should delete task successfully', async () => {
      const taskId = 1;

      projectTasksRepository.delete.mockResolvedValue({
        success: true,
        message: 'Task deleted successfully'
      });

      const result = await projectTasksService.deleteTask(taskId);

      expect(projectTasksRepository.delete).toHaveBeenCalledWith(taskId);
      expect(result.success).toBe(true);
    });

    test('should handle task not found during deletion', async () => {
      const taskId = 999;

      projectTasksRepository.delete.mockResolvedValue({
        success: false,
        error: 'Task not found',
        message: 'Failed to delete task'
      });

      const result = await projectTasksService.deleteTask(taskId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Task not found');
    });
  });

  describe('getTaskById', () => {
    test('should get task by id successfully', async () => {
      const projectId = 1;
      const taskId = 1;

      const mockTask = {
        id: taskId,
        title: 'Test Task',
        project_id: projectId
      };

      projectRepository.exists.mockResolvedValue(true);
      projectTasksRepository.getById.mockResolvedValue({
        success: true,
        task: mockTask,
        message: 'Task retrieved successfully'
      });

      const result = await projectTasksService.getTaskById(projectId, taskId);

      expect(projectRepository.exists).toHaveBeenCalledWith(1);
      expect(projectTasksRepository.getById).toHaveBeenCalledWith(projectId, taskId);
      expect(result.success).toBe(true);
      expect(result.task).toEqual(mockTask);
    });

    test('should handle project not found', async () => {
      const projectId = 999;
      const taskId = 1;

      projectRepository.exists.mockResolvedValue(false);

      const result = await projectTasksService.getTaskById(projectId, taskId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Project not found');
    });
  });

  describe('getTaskStats', () => {
    test('should get task statistics successfully', async () => {
      const projectId = 1;

      const mockStats = {
        total: 10,
        pending: 3,
        in_progress: 2,
        completed: 4,
        cancelled: 1
      };

      projectRepository.exists.mockResolvedValue(true);
      projectTasksRepository.getStats.mockResolvedValue({
        success: true,
        stats: mockStats,
        message: 'Task statistics retrieved successfully'
      });

      const result = await projectTasksService.getTaskStats(projectId);

      expect(projectRepository.exists).toHaveBeenCalledWith(1);
      expect(projectTasksRepository.getStats).toHaveBeenCalledWith(projectId);
      expect(result.success).toBe(true);
      expect(result.stats).toEqual(mockStats);
    });

    test('should handle project not found', async () => {
      const projectId = 999;

      projectRepository.exists.mockResolvedValue(false);

      const result = await projectTasksService.getTaskStats(projectId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Project not found');
    });
  });

  describe('getAllTasks', () => {
    test('should get all tasks successfully', async () => {
      const options = {
        filters: { status: 'pending' },
        pagination: { page: 1, limit: 10 },
        sorting: { sortBy: 'created_at', sortOrder: 'desc' }
      };

      const mockTasks = [
        { id: 1, title: 'Task 1', status: 'pending' },
        { id: 2, title: 'Task 2', status: 'pending' }
      ];

      projectTasksRepository.getAll.mockResolvedValue({
        success: true,
        tasks: mockTasks,
        message: 'Tasks retrieved successfully'
      });

      const result = await projectTasksService.getAllTasks(options);

      expect(projectTasksRepository.getAll).toHaveBeenCalledWith(options);
      expect(result.success).toBe(true);
      expect(result.tasks).toEqual(mockTasks);
    });

    test('should handle repository error', async () => {
      const options = {};

      projectTasksRepository.getAll.mockResolvedValue({
        success: false,
        error: 'Database error',
        message: 'Failed to retrieve tasks'
      });

      const result = await projectTasksService.getAllTasks(options);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });
});