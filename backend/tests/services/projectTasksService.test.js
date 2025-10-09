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
      }).toThrow('assignedTo must be a positive integer');
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
      projectTasksRepository.findByProjectId.mockResolvedValue({
        data: mockTasks,
        count: 2
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
      projectTasksRepository.create.mockResolvedValue(mockCreatedTask);

      const result = await projectTasksService.createTask(projectId, taskData);

      expect(projectRepository.exists).toHaveBeenCalledWith(1);
      expect(projectTasksRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        assigned_to: []
      }));
      expect(result.success).toBe(true);
      expect(result.task).toEqual(mockCreatedTask);
    });

    test('should include creator in assignees when provided', async () => {
      const projectId = 2;
      const taskData = {
        title: 'Creator Task',
        assigned_to: []
      };

      const mockCreatedTask = {
        id: 10,
        ...taskData,
        assigned_to: [7],
        project_id: projectId
      };

      projectRepository.exists.mockResolvedValue(true);
      projectTasksRepository.create.mockResolvedValue(mockCreatedTask);

      const result = await projectTasksService.createTask(projectId, taskData, 7);

      expect(projectTasksRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        assigned_to: [7]
      }));
      expect(result.success).toBe(true);
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

      projectTasksRepository.update.mockResolvedValue(mockUpdatedTask);

      const result = await projectTasksService.updateTask(taskId, updateData);

      expect(projectTasksRepository.update).toHaveBeenCalledWith(taskId, updateData);
      expect(result.success).toBe(true);
      expect(result.task).toEqual(mockUpdatedTask);
    });

    test('should handle task not found during update', async () => {
      const taskId = 999;
      const updateData = { title: 'Updated Task' };

      projectTasksRepository.update.mockRejectedValue(new Error('Task not found'));

      const result = await projectTasksService.updateTask(taskId, updateData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Task not found');
    });

    test('should prevent updates from users who are not assigned to the task', async () => {
      const taskId = 42;
      const updateData = { title: 'Unauthorized Update' };
      const requestingUserId = 5;

      projectTasksRepository.findById.mockResolvedValue({
        id: taskId,
        assigned_to: [7, 8]
      });

      const result = await projectTasksService.updateTask(taskId, updateData, requestingUserId);

      expect(projectTasksRepository.findById).toHaveBeenCalledWith(taskId);
      expect(projectTasksRepository.update).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(403);
      expect(result.error).toBe('You must be assigned to the task to update it.');
    });

    test('should allow assigned users to update the task', async () => {
      const taskId = 7;
      const requestingUserId = 3;
      const updateData = { status: 'completed' };
      const mockUpdatedTask = { id: taskId, ...updateData };

      projectTasksRepository.findById.mockResolvedValue({
        id: taskId,
        assigned_to: [requestingUserId, 6]
      });
      projectTasksRepository.update.mockResolvedValue(mockUpdatedTask);

      const result = await projectTasksService.updateTask(taskId, updateData, requestingUserId);

      expect(projectTasksRepository.findById).toHaveBeenCalledWith(taskId);
      expect(projectTasksRepository.update).toHaveBeenCalledWith(taskId, updateData);
      expect(result.success).toBe(true);
      expect(result.task).toEqual(mockUpdatedTask);
    });

    test('should return not found when validating a missing task before update', async () => {
      const taskId = 11;
      const requestingUserId = 9;
      const updateData = { title: 'Any' };

      projectTasksRepository.findById.mockResolvedValue(null);

      const result = await projectTasksService.updateTask(taskId, updateData, requestingUserId);

      expect(projectTasksRepository.findById).toHaveBeenCalledWith(taskId);
      expect(projectTasksRepository.update).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(404);
      expect(result.error).toBe('Task not found');
    });
  });

  describe('deleteTask', () => {
    test('should delete task successfully', async () => {
      const taskId = 1;

      projectTasksRepository.exists.mockResolvedValue(true);
      projectTasksRepository.delete.mockResolvedValue(true);

      const result = await projectTasksService.deleteTask(taskId);

      expect(projectTasksRepository.exists).toHaveBeenCalledWith(taskId);
      expect(projectTasksRepository.delete).toHaveBeenCalledWith(taskId);
      expect(result.success).toBe(true);
    });

    test('should handle task not found during deletion', async () => {
      const taskId = 999;

      projectTasksRepository.exists.mockResolvedValue(false);

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

      projectTasksRepository.findByIdAndProjectId.mockResolvedValue(mockTask);

      const result = await projectTasksService.getTaskById(projectId, taskId);

      expect(projectTasksRepository.findByIdAndProjectId).toHaveBeenCalledWith(taskId, projectId);
      expect(result.success).toBe(true);
      expect(result.task).toEqual(mockTask);
    });

    test('should handle task not found', async () => {
      const projectId = 1;
      const taskId = 999;

      projectTasksRepository.findByIdAndProjectId.mockResolvedValue(null);

      const result = await projectTasksService.getTaskById(projectId, taskId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Task not found');
    });
  });

  describe('getTaskStats', () => {
    test('should get task statistics successfully', async () => {
      const projectId = 1;

      const mockTasks = [
        { id: 1, status: 'pending', priority: 'high' },
        { id: 2, status: 'pending', priority: 'medium' },
        { id: 3, status: 'in_progress', priority: 'low' },
        { id: 4, status: 'completed', priority: 'high' }
      ];

      projectRepository.exists.mockResolvedValue(true);
      projectTasksRepository.getTaskStats.mockResolvedValue(mockTasks);

      const result = await projectTasksService.getTaskStats(projectId);

      expect(projectRepository.exists).toHaveBeenCalledWith(1);
      expect(projectTasksRepository.getTaskStats).toHaveBeenCalledWith(projectId);
      expect(result.success).toBe(true);
      expect(result.stats.total).toBe(4);
      expect(result.stats.byStatus.pending).toBe(2);
      expect(result.stats.byStatus.inProgress).toBe(1);
      expect(result.stats.byStatus.completed).toBe(1);
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

      projectTasksRepository.findAll.mockResolvedValue({
        data: mockTasks,
        count: 2
      });

      const result = await projectTasksService.getAllTasks(options);

      expect(result.success).toBe(true);
      expect(result.tasks).toEqual(mockTasks);
    });

    test('should handle repository error', async () => {
      const options = {};

      projectTasksRepository.findAll.mockRejectedValue(new Error('Database error'));

      const result = await projectTasksService.getAllTasks(options);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });
});
