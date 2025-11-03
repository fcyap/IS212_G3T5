jest.mock('../../src/services/taskAssigneeHoursService', () => ({
  recordHours: jest.fn(),
  getTaskHoursSummary: jest.fn(),
  normalizeHours: jest.fn()
}));

const projectTasksService = require('../../src/services/projectTasksService');
const projectTasksRepository = require('../../src/repository/projectTasksRepository');
const projectRepository = require('../../src/repository/projectRepository');
const taskAssigneeHoursService = require('../../src/services/taskAssigneeHoursService');

jest.mock('../../src/repository/projectTasksRepository');
jest.mock('../../src/repository/projectRepository');

describe('ProjectTasksService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    taskAssigneeHoursService.recordHours.mockReset();
    taskAssigneeHoursService.getTaskHoursSummary.mockReset();
    taskAssigneeHoursService.normalizeHours.mockReset();
    taskAssigneeHoursService.getTaskHoursSummary.mockResolvedValue({
      total_hours: 0,
      per_assignee: []
    });
    taskAssigneeHoursService.normalizeHours.mockImplementation((value) => Number(value));
    projectRepository.exists.mockResolvedValue(true);
    projectRepository.getProjectById.mockResolvedValue({ id: 1, status: 'active' });
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
      expect(result.priority).toBe(10); // 'high' is normalized to 10
    });

    test('should throw error for invalid priority', () => {
      const filters = { priority: 'urgent' };
      expect(() => {
        projectTasksService.validateFilters(filters);
      }).toThrow('Priority must be an integer between 1 and 10');
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
      projectRepository.getProjectById.mockResolvedValue({ id: projectId, status: 'active' });
      projectTasksRepository.create.mockResolvedValue(mockCreatedTask);

      const result = await projectTasksService.createTask(projectId, taskData);

      expect(projectRepository.exists).toHaveBeenCalledWith(1);
      expect(projectRepository.getProjectById).toHaveBeenCalledWith(1);
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
      projectRepository.getProjectById.mockResolvedValue({ id: projectId, status: 'active' });
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
      projectRepository.getProjectById.mockResolvedValue(null);

      const result = await projectTasksService.createTask(projectId, taskData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Project not found');
    });

    test('should reject creation when more than 5 assignees provided', async () => {
      const projectId = 3;
      const taskData = {
        title: 'Overloaded',
        assigned_to: [1, 2, 3, 4, 5, 6]
      };

      projectRepository.exists.mockResolvedValue(true);
      projectRepository.getProjectById.mockResolvedValue({ id: projectId, status: 'active' });

      const result = await projectTasksService.createTask(projectId, taskData);

      expect(projectTasksRepository.create).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toBe('A task can have at most 5 assignees.');
    });

    test('should prevent creation when project is archived', async () => {
      const projectId = 4;
      const taskData = { title: 'Archived task attempt' };

      projectRepository.exists.mockResolvedValue(true);
      projectRepository.getProjectById.mockResolvedValue({ id: projectId, status: 'archived' });
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await projectTasksService.createTask(projectId, taskData);

      expect(projectTasksRepository.create).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot create tasks for archived projects');
      expect(warnSpy).toHaveBeenCalledWith(
        '[ProjectTasksService] Attempted task creation on archived project',
        expect.objectContaining({
          projectId,
          payload: expect.objectContaining({ title: 'Archived task attempt' }),
        })
      );
      warnSpy.mockRestore();
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

      const summary = { total_hours: 0, per_assignee: [] };

      projectTasksRepository.update.mockResolvedValue(mockUpdatedTask);
      taskAssigneeHoursService.getTaskHoursSummary.mockResolvedValue(summary);

      const result = await projectTasksService.updateTask(taskId, updateData);

      expect(projectTasksRepository.update).toHaveBeenCalledWith(taskId, updateData);
      expect(result.success).toBe(true);
      expect(taskAssigneeHoursService.getTaskHoursSummary).toHaveBeenCalledWith(taskId, []);
      expect(result.task).toEqual({ ...mockUpdatedTask, time_tracking: summary });
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

      const existingTask = {
        id: taskId,
        assigned_to: [requestingUserId, 6]
      };
      const summary = { total_hours: 0, per_assignee: [] };

      projectTasksRepository.findById.mockResolvedValue(existingTask);
      projectTasksRepository.update.mockResolvedValue(mockUpdatedTask);
      taskAssigneeHoursService.getTaskHoursSummary.mockResolvedValue(summary);

      const result = await projectTasksService.updateTask(taskId, updateData, requestingUserId);

      expect(projectTasksRepository.findById).toHaveBeenCalledWith(taskId);
      expect(projectTasksRepository.update).toHaveBeenCalledWith(taskId, updateData);
      expect(result.success).toBe(true);
      expect(taskAssigneeHoursService.getTaskHoursSummary).toHaveBeenCalledWith(taskId, [requestingUserId, 6]);
      expect(result.task).toEqual({ ...mockUpdatedTask, time_tracking: summary });
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

    test('should reject updates that exceed the assignee limit', async () => {
      const taskId = 21;
      const updateData = {
        assigned_to: [1, 2, 3, 4, 5, 6]
      };

      const result = await projectTasksService.updateTask(taskId, updateData);

      expect(projectTasksRepository.update).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toBe('A task can have at most 5 assignees.');
    });

    test('should record hours for assigned user and include summary', async () => {
      const taskId = 31;
      const requesterId = 99;
      const updateData = { hours: 3.25 };
      const existingTask = {
        id: taskId,
        assigned_to: [requesterId],
        status: 'in_progress'
      };
      const updatedTask = {
        ...existingTask,
        updated_at: new Date().toISOString()
      };
      const summary = {
        total_hours: 3.25,
        per_assignee: [{ user_id: requesterId, hours: 3.25 }]
      };

      projectTasksRepository.findById.mockResolvedValue(existingTask);
      projectTasksRepository.update.mockResolvedValue(updatedTask);
      taskAssigneeHoursService.normalizeHours.mockReturnValue(3.25);
      taskAssigneeHoursService.getTaskHoursSummary.mockResolvedValue(summary);

      const result = await projectTasksService.updateTask(taskId, updateData, requesterId);

      expect(projectTasksRepository.update).toHaveBeenCalledWith(taskId, {});
      expect(taskAssigneeHoursService.normalizeHours).toHaveBeenCalledWith(3.25);
      expect(taskAssigneeHoursService.recordHours).toHaveBeenCalledWith({
        taskId,
        userId: requesterId,
        hours: 3.25
      });
      expect(result.success).toBe(true);
      expect(result.task.time_tracking).toEqual(summary);
    });

    test('should reject negative hours input', async () => {
      const taskId = 41;
      const requesterId = 17;
      const existingTask = {
        id: taskId,
        assigned_to: [requesterId],
        status: 'pending'
      };

      projectTasksRepository.findById.mockResolvedValue(existingTask);
      taskAssigneeHoursService.normalizeHours.mockImplementation(() => {
        throw new Error('Hours spent must be a non-negative number');
      });

      const result = await projectTasksService.updateTask(taskId, { hours: -1 }, requesterId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Hours spent must be a non-negative number');
      expect(taskAssigneeHoursService.recordHours).not.toHaveBeenCalled();
      expect(taskAssigneeHoursService.getTaskHoursSummary).not.toHaveBeenCalled();
      expect(projectTasksRepository.update).not.toHaveBeenCalled();
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
      const summary = { total_hours: 5, per_assignee: [{ user_id: 2, hours: 5 }] };

      projectTasksRepository.findByIdAndProjectId.mockResolvedValue(mockTask);
      taskAssigneeHoursService.getTaskHoursSummary.mockResolvedValue(summary);

      const result = await projectTasksService.getTaskById(projectId, taskId);

      expect(projectTasksRepository.findByIdAndProjectId).toHaveBeenCalledWith(taskId, projectId);
      expect(result.success).toBe(true);
      expect(taskAssigneeHoursService.getTaskHoursSummary).toHaveBeenCalledWith(taskId, []);
      expect(result.task).toEqual({ ...mockTask, time_tracking: summary });
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
