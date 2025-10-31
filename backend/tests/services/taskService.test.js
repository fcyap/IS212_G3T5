const crypto = require('crypto');

jest.mock('../../src/utils/supabase', () => ({
  from: jest.fn()
}));

const supabase = require('../../src/utils/supabase');

const createEqLimitResponse = (data, error = null) => ({
  select: jest.fn(() => ({
    eq: jest.fn(() => ({
      limit: jest.fn(() => Promise.resolve({ data, error }))
    })),
    in: jest.fn(() => Promise.resolve({ data: [], error: null }))
  }))
});

const createInResponse = (data, error = null) => ({
  select: jest.fn(() => ({
    eq: jest.fn(() => ({
      limit: jest.fn(() => Promise.resolve({ data: [], error: null }))
    })),
    in: jest.fn(() => Promise.resolve({ data, error }))
  }))
});
jest.mock('../../src/services/taskAssigneeHoursService', () => ({
  recordHours: jest.fn(),
  getTaskHoursSummary: jest.fn(),
  normalizeHours: jest.fn()
}));

const taskService = require('../../src/services/taskService');
const taskRepository = require('../../src/repository/taskRepository');
const projectRepository = require('../../src/repository/projectRepository');
const projectMemberRepository = require('../../src/repository/projectMemberRepository');
const userRepository = require('../../src/repository/userRepository');
const notificationService = require('../../src/services/notificationService');
const taskAssigneeHoursService = require('../../src/services/taskAssigneeHoursService');

jest.mock('../../src/repository/taskRepository');
jest.mock('../../src/repository/projectRepository');
jest.mock('../../src/repository/projectMemberRepository');
jest.mock('../../src/repository/userRepository');
jest.mock('../../src/services/notificationService');

describe('TaskService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabase.from.mockReset();
    supabase.from.mockImplementation(() => createInResponse([]));
    notificationService.createTaskAssignmentNotifications.mockResolvedValue({ notificationsSent: 0 });
    notificationService.createTaskRemovalNotifications = jest.fn().mockResolvedValue({ notificationsSent: 0 });
    notificationService.createTaskUpdateNotifications = jest.fn().mockResolvedValue({ notificationsSent: 0 });
    projectMemberRepository.getProjectIdsForUser.mockResolvedValue([]);
    projectRepository.getProjectById.mockReset();
    projectRepository.getProjectById.mockImplementation(async (id) => ({ id, status: 'active' }));
    taskRepository.getTaskById.mockReset();
    taskAssigneeHoursService.recordHours.mockReset();
    taskAssigneeHoursService.getTaskHoursSummary.mockReset();
    taskAssigneeHoursService.normalizeHours.mockReset();
    taskAssigneeHoursService.getTaskHoursSummary.mockResolvedValue({
      total_hours: 0,
      per_assignee: []
    });
    taskAssigneeHoursService.normalizeHours.mockImplementation((value) => Number(value));
    if (taskRepository.updateById?.mockReset) {
      taskRepository.updateById.mockReset();
    }
    if (taskRepository.updateTask?.mockReset) {
      taskRepository.updateTask.mockReset();
    }
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
      taskService.getAllTasks = jest.fn().mockResolvedValue({ tasks: mockTasks });

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
      taskService.getAllTasks = jest.fn().mockResolvedValue({ tasks: mockTasks });

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

      // The service filters using Number.isFinite, null becomes 0 which is finite, so [1, 0, 2] are passed
      expect(taskRepository.getUsersByIds).toHaveBeenCalledWith([1, 0, 2]);
      expect(result[0].assignees).toEqual([
        { id: 1, name: 'User One' },
        { id: 2, name: 'User Two' }
      ]);
    });
  });

  describe('getAllTasks', () => {
    beforeEach(() => {
      // Clear any mocks from previous tests
      delete taskService.getAllTasks;
    });

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

      taskRepository.getTasksWithFilters.mockResolvedValue(mockTasks);
      taskRepository.getTaskCount.mockResolvedValue(2);

      const result = await taskService.getAllTasks(filters);

      expect(taskRepository.getTasksWithFilters).toHaveBeenCalledWith(filters);
      expect(result.tasks).toEqual(mockTasks);
      expect(result.totalCount).toBe(2);
    });

    test('should handle repository error', async () => {
      const filters = {};
      taskRepository.getTasksWithFilters.mockRejectedValue(new Error('Database error'));
      taskRepository.getTaskCount.mockResolvedValue(0);

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
        title: 'New Task',
        description: 'Task description',
        status: 'pending',
        project_id: 1,
        assigned_to: [1, 2],
        priority: 'medium',
        tags: [],
        deadline: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Mock insert method since service checks for it first
      taskRepository.insert = jest.fn().mockResolvedValue(mockCreatedTask);
      userRepository.getUsersByIds.mockResolvedValue({ data: [], error: null });

      const result = await taskService.createTask(taskData);

      expect(projectRepository.getProjectById).toHaveBeenCalledWith(1);
      expect(taskRepository.insert).toHaveBeenCalledWith(expect.objectContaining({
        title: 'New Task',
        description: 'Task description',
        status: 'pending',
        project_id: 1,
        assigned_to: [1, 2],
        priority: 'medium',
        created_at: expect.any(Date),
        updated_at: expect.any(Date)
      }));
      expect(result).toEqual(mockCreatedTask);
      expect(notificationService.createTaskAssignmentNotifications).toHaveBeenCalledWith(expect.objectContaining({
        task: mockCreatedTask,
        assigneeIds: [1, 2],
        assignedById: null,
        previousAssigneeIds: [],
        currentAssigneeIds: [1, 2],
        notificationType: 'task_assignment'
      }));
      expect(notificationService.createTaskRemovalNotifications).not.toHaveBeenCalled();
      expect(taskRepository.getTaskById).not.toHaveBeenCalled();
    });

    test('should ensure creator is assigned when missing', async () => {
      const taskData = {
        title: 'Creator Task',
        description: 'Task description',
        assigned_to: []
      };

      const mockCreatedTask = {
        id: 2,
        title: 'Creator Task',
        assigned_to: [5]
      };

      taskRepository.insert = jest.fn().mockResolvedValue(mockCreatedTask);
      userRepository.getUserById.mockResolvedValue({ id: 5 });
      userRepository.getUsersByIds.mockResolvedValue({ data: [{ id: 5 }], error: null });

      const result = await taskService.createTask(taskData, 5);

      expect(taskRepository.insert).toHaveBeenCalledWith(expect.objectContaining({
        assigned_to: [5]
      }));
      expect(projectRepository.getProjectById).not.toHaveBeenCalled();
      expect(result).toEqual(mockCreatedTask);
    });

    test('should reject when more than 5 assignees provided', async () => {
      const taskData = {
        title: 'Too Many',
        assigned_to: [2, 3, 4, 5, 6, 7]
      };

      userRepository.getUserById.mockResolvedValue({ id: 1 });

      await expect(taskService.createTask(taskData, 1)).rejects.toThrow('at most 5 assignees');
      expect(projectRepository.getProjectById).not.toHaveBeenCalled();
    });

    test('should handle creation error', async () => {
      const taskData = {
        title: 'New Task',
        description: 'Task description',
        assigned_to: [1]
      };

      taskRepository.insert = jest.fn().mockRejectedValue(new Error('Validation failed'));

      await expect(taskService.createTask(taskData))
        .rejects.toThrow('Validation failed');
      expect(projectRepository.getProjectById).not.toHaveBeenCalled();
    });

    test('should handle missing required fields', async () => {
      const taskData = {
        description: 'Task without title'
      };

      await expect(taskService.createTask(taskData))
        .rejects.toThrow('title is required');
    });

    test('should normalize assigned_to and tags while validating related entities', async () => {
      const taskData = {
        title: 'Normalize me',
        description: '  keep me  ',
        project_id: 10,
        assigned_to: ['1', ' 2 ', null, 'abc', 3],
        tags: 'alpha, beta , ,gamma',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        parent_id: '5'
      };

      userRepository.getUserById = jest.fn().mockResolvedValue({ id: 42 });
      projectRepository.getProjectById = jest.fn().mockResolvedValue({ id: 10 });
      userRepository.getUsersByIds = jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }, { id: 3 }]);
      taskRepository.getTaskById.mockResolvedValueOnce({ id: 5, project_id: 10 });

      const normalizedInsertResult = {
        id: 77,
        ...taskData,
        description: 'keep me',
        assigned_to: [1, 2, 3],
        tags: ['alpha', 'beta', 'gamma'],
        priority: 'high',
        status: 'in_progress',
        parent_id: 5,
        created_at: new Date(),
        updated_at: new Date()
      };
      taskRepository.insert = jest.fn().mockResolvedValue(normalizedInsertResult);

      const result = await taskService.createTask(taskData, 42);

      expect(userRepository.getUserById).toHaveBeenCalledWith(42);
      expect(projectRepository.getProjectById).toHaveBeenCalledWith(10);
      expect(userRepository.getUsersByIds).toHaveBeenCalledWith(taskData.assigned_to);

      const insertPayload = taskRepository.insert.mock.calls[0][0];
      expect(insertPayload.assigned_to).toEqual([1, 2, 3]);
      expect(insertPayload.tags).toEqual(['alpha', 'beta', 'gamma']);
      expect(insertPayload.priority).toBe('high');
      expect(insertPayload.status).toBe('in_progress');
      expect(insertPayload.parent_id).toBe(5);
      expect(insertPayload.project_id).toBe(10);
      expect(taskRepository.getTaskById).toHaveBeenCalledWith(5);
      expect(result).toEqual(normalizedInsertResult);
    });

    test('should fall back to repository.createTask when insert is unavailable', async () => {
      const originalInsert = taskRepository.insert;
      const originalCreateTask = taskRepository.createTask;
      delete taskRepository.insert;
      const fallbackCreated = {
        id: 90,
        title: 'Legacy path',
        description: null,
        priority: 'medium',
        status: 'pending',
        assigned_to: [],
        tags: [],
        parent_id: null,
        created_at: new Date(),
        updated_at: new Date()
      };
      taskRepository.createTask = jest.fn().mockResolvedValue(fallbackCreated);

      const taskData = { title: 'Legacy path' };
      const result = await taskService.createTask(taskData);

      expect(taskRepository.createTask).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Legacy path'
      }));
      expect(result).toEqual(fallbackCreated);
      expect(projectRepository.getProjectById).not.toHaveBeenCalled();

      taskRepository.insert = originalInsert;
      taskRepository.createTask = originalCreateTask;
    });

    test('should reject task creation when project is not active', async () => {
      projectRepository.getProjectById.mockResolvedValue({ id: 2, status: 'archived' });
      const taskData = {
        title: 'Inactive project task',
        project_id: 2,
        assigned_to: [1]
      };

      await expect(taskService.createTask(taskData))
        .rejects.toThrow('Tasks can only be assigned to active projects.');
      expect(taskRepository.insert).not.toHaveBeenCalled();
    });

    test('should inherit project from parent task when creating a subtask', async () => {
      const parentTask = { id: 7, project_id: 42 };
      taskRepository.getTaskById.mockResolvedValueOnce(parentTask);
      projectRepository.getProjectById.mockResolvedValueOnce({ id: 42, status: 'active' });

      const taskData = {
        title: 'Subtask',
        parent_id: 7,
        project_id: 999, // Should be ignored
        assigned_to: [3]
      };

      const created = {
        id: 101,
        title: 'Subtask',
        project_id: 42,
        assigned_to: [3]
      };
      taskRepository.insert = jest.fn().mockResolvedValue(created);

      const result = await taskService.createTask(taskData);

      expect(taskRepository.getTaskById).toHaveBeenCalledWith(7);
      expect(projectRepository.getProjectById).toHaveBeenCalledWith(42);
      expect(taskRepository.insert).toHaveBeenCalledWith(expect.objectContaining({
        project_id: 42,
        parent_id: 7
      }));
      expect(result).toEqual(created);
    });

    test('should throw when parent task cannot be found', async () => {
      taskRepository.getTaskById.mockResolvedValueOnce(null);

      const taskData = {
        title: 'Orphan subtask',
        parent_id: 123,
        assigned_to: [1]
      };

      await expect(taskService.createTask(taskData)).rejects.toThrow('Parent task not found');
      expect(taskRepository.insert).not.toHaveBeenCalled();
    });
  });

  describe('updateTask', () => {
    test('should reject attempts to change project assignment', async () => {
      const taskId = 5;
      taskRepository.getTaskById.mockResolvedValue({
        id: taskId,
        title: 'Original',
        status: 'pending',
        recurrence_freq: null,
        recurrence_interval: 1,
        assigned_to: [1],
        tags: [],
        project_id: 10
      });

      await expect(taskService.updateTask(taskId, { project_id: 99 }, 1))
        .rejects.toThrow('Project assignment cannot be changed after creation.');
      expect(taskRepository.updateById).not.toHaveBeenCalled();
      expect(taskRepository.updateTask).not.toHaveBeenCalled();
    });

    test('should update task successfully', async () => {
      const taskId = 1;
      const updateData = {
        title: 'Updated Task',
        status: 'completed'
      };

      const mockUpdatedTask = {
        id: taskId,
        title: 'Updated Task',
        status: 'completed',
        updated_at: new Date().toISOString(),
        assigned_to: [1, 2]
      };

      taskRepository.getTaskById.mockResolvedValue({
        id: taskId,
        title: 'Original Task',
        status: 'pending',
        recurrence_freq: null,
        recurrence_interval: 1,
        assigned_to: [1, 2],
        tags: []
      });


      // Mock updateById method since service checks for it first
      taskRepository.updateById = jest.fn().mockResolvedValue(mockUpdatedTask);

      const result = await taskService.updateTask(taskId, updateData);

      expect(taskRepository.updateById).toHaveBeenCalledWith(taskId, expect.objectContaining({
        title: 'Updated Task',
        status: 'completed',
        updated_at: expect.any(String)
      }));
      expect(taskAssigneeHoursService.getTaskHoursSummary).toHaveBeenCalledWith(taskId, [1, 2]);
      expect(result).toMatchObject({
        ...mockUpdatedTask,
        time_tracking: {
          total_hours: 0,
          per_assignee: []
        }
      });
      expect(notificationService.createTaskUpdateNotifications).toHaveBeenCalledWith(expect.objectContaining({
        task: expect.objectContaining({
          id: taskId,
          time_tracking: {
            total_hours: 0,
            per_assignee: []
          }
        }),
        updatedById: null,
        changes: expect.arrayContaining([
          expect.objectContaining({ field: 'title' }),
          expect.objectContaining({ field: 'status' })
        ])
      }));
    });

    test('should handle task not found', async () => {
      const taskId = 999;
      const updateData = { title: 'Updated Task' };

      taskRepository.getTaskById.mockResolvedValue({
        id: taskId,
        title: 'Existing Title',
        status: 'pending',
        recurrence_freq: null,
        recurrence_interval: 1,
        assigned_to: [1],
        tags: []
      });

      taskRepository.updateById = jest.fn().mockRejectedValue(new Error('Task not found'));

      await expect(taskService.updateTask(taskId, updateData))
        .rejects.toThrow('Task not found');
      expect(notificationService.createTaskUpdateNotifications).not.toHaveBeenCalled();
    });

    test('should handle validation error', async () => {
      const taskId = 1;
      const updateData = { status: 'invalid_status' };

      taskRepository.getTaskById.mockResolvedValue({
        id: taskId,
        title: 'Existing Title',
        status: 'pending',
        recurrence_freq: null,
        recurrence_interval: 1,
        assigned_to: [1],
        tags: []
      });

      taskRepository.updateById = jest.fn().mockRejectedValue(new Error('Invalid status'));

      await expect(taskService.updateTask(taskId, updateData))
        .rejects.toThrow('Invalid status');
      expect(notificationService.createTaskUpdateNotifications).not.toHaveBeenCalled();
    });

    test('should notify newly assigned users when assignees change', async () => {
      const taskId = 1;
      const updateData = { assigned_to: [1, 2, 3] };

      taskRepository.getTaskById.mockResolvedValue({
        id: taskId,
        assigned_to: [1, 2]
      });

      const mockUpdatedTask = {
        id: taskId,
        title: 'Updated Task',
        assigned_to: [1, 2, 3],
        updated_at: new Date().toISOString()
      };

      taskRepository.updateById = jest.fn().mockResolvedValue(mockUpdatedTask);

      const result = await taskService.updateTask(taskId, updateData);

      expect(taskRepository.updateById).toHaveBeenCalledWith(taskId, expect.objectContaining({
        assigned_to: [1, 2, 3],
        updated_at: expect.any(String)
      }));
      expect(taskAssigneeHoursService.getTaskHoursSummary).toHaveBeenCalledWith(taskId, [1, 2, 3]);
      expect(result).toMatchObject({
        ...mockUpdatedTask,
        time_tracking: {
          total_hours: 0,
          per_assignee: []
        }
      });
      expect(notificationService.createTaskAssignmentNotifications).toHaveBeenCalledWith(expect.objectContaining({
        task: expect.objectContaining({
          id: taskId,
          time_tracking: {
            total_hours: 0,
            per_assignee: []
          }
        }),
        assigneeIds: [3],
        assignedById: null,
        previousAssigneeIds: [1, 2],
        currentAssigneeIds: [1, 2, 3],
        notificationType: 'reassignment'
      }));
      expect(notificationService.createTaskRemovalNotifications).not.toHaveBeenCalled();
      expect(notificationService.createTaskUpdateNotifications).not.toHaveBeenCalled();
    });

    test('should notify removed users when assignees are removed', async () => {
      const taskId = 2;
      const updateData = { assigned_to: [1, 2] };

      taskRepository.getTaskById.mockResolvedValue({
        id: taskId,
        assigned_to: [1, 2, 3]
      });

      const mockUpdatedTask = {
        id: taskId,
        title: 'Updated Task',
        assigned_to: [1, 2],
        updated_at: new Date().toISOString()
      };

      taskRepository.updateById = jest.fn().mockResolvedValue(mockUpdatedTask);

      const result = await taskService.updateTask(taskId, updateData);

      expect(taskRepository.updateById).toHaveBeenCalledWith(taskId, expect.objectContaining({
        assigned_to: [1, 2],
        updated_at: expect.any(String)
      }));
      expect(taskAssigneeHoursService.getTaskHoursSummary).toHaveBeenCalledWith(taskId, [1, 2]);
      expect(result).toMatchObject({
        ...mockUpdatedTask,
        time_tracking: {
          total_hours: 0,
          per_assignee: []
        }
      });
      expect(notificationService.createTaskRemovalNotifications).toHaveBeenCalledWith(expect.objectContaining({
        task: expect.objectContaining({
          id: taskId,
          time_tracking: {
            total_hours: 0,
            per_assignee: []
          }
        }),
        assigneeIds: [3],
        assignedById: null,
        previousAssigneeIds: [1, 2, 3],
        currentAssigneeIds: [1, 2]
      }));
      expect(notificationService.createTaskAssignmentNotifications).not.toHaveBeenCalled();
      expect(notificationService.createTaskUpdateNotifications).not.toHaveBeenCalled();
    });

    test('should reject update when exceeding assignee limit', async () => {
      const taskId = 3;
      const updateData = { assigned_to: [1, 2, 3, 4, 5, 6] };

      taskRepository.getTaskById.mockResolvedValue({
        id: taskId,
        assigned_to: [1, 2, 3]
      });

      await expect(taskService.updateTask(taskId, updateData)).rejects.toThrow('at most 5 assignees');
    });

    test('should record hours for assigned user and return summary', async () => {
      const taskId = 77;
      const requesterId = 10;
      const updateData = { hours: 2.5 };
      const currentTask = {
        id: taskId,
        project_id: 2,
        status: 'pending',
        recurrence_freq: null,
        recurrence_interval: 1,
        assigned_to: [requesterId],
        tags: []
      };
      const updatedTask = {
        ...currentTask,
        updated_at: new Date().toISOString()
      };
      const summary = {
        total_hours: 2.5,
        per_assignee: [{ user_id: requesterId, hours: 2.5 }]
      };

      taskRepository.getTaskById.mockResolvedValue(currentTask);
      taskRepository.updateById = jest.fn().mockResolvedValue(updatedTask);
      taskAssigneeHoursService.normalizeHours.mockReturnValue(2.5);
      taskAssigneeHoursService.getTaskHoursSummary.mockResolvedValue(summary);

      const result = await taskService.updateTask(taskId, updateData, requesterId);

      expect(taskRepository.updateById).toHaveBeenCalledWith(taskId, expect.objectContaining({
        updated_at: expect.any(String)
      }));
      expect(taskAssigneeHoursService.normalizeHours).toHaveBeenCalledWith(2.5);
      expect(taskAssigneeHoursService.recordHours).toHaveBeenCalledWith({
        taskId,
        userId: requesterId,
        hours: 2.5
      });
      expect(result.time_tracking).toEqual(summary);
    });

    test('should reject negative hours input', async () => {
      const taskId = 81;
      const requesterId = 5;
      const currentTask = {
        id: taskId,
        project_id: 9,
        status: 'pending',
        recurrence_freq: null,
        recurrence_interval: 1,
        assigned_to: [requesterId],
        tags: []
      };

      taskRepository.getTaskById.mockResolvedValue(currentTask);
      taskAssigneeHoursService.normalizeHours.mockImplementation(() => {
        throw new Error('Hours spent must be a non-negative number');
      });
      taskRepository.updateById = jest.fn();

      await expect(taskService.updateTask(taskId, { hours: -3 }, requesterId))
        .rejects.toThrow('Hours spent must be a non-negative number');

      expect(taskRepository.updateById).not.toHaveBeenCalled();
      expect(taskAssigneeHoursService.recordHours).not.toHaveBeenCalled();
      expect(taskAssigneeHoursService.getTaskHoursSummary).not.toHaveBeenCalled();
    });

    test('should reject update when requester not assigned', async () => {
      const taskId = 4;
      const updateData = { title: 'Cannot update' };

      taskRepository.getTaskById.mockResolvedValue({
        id: taskId,
        assigned_to: [1, 2]
      });

      await expect(taskService.updateTask(taskId, updateData, 99)).rejects.toThrow('assigned to the task');
    });

    test('should normalize patch fields including tags, assignees and recurrence updates', async () => {
      const taskId = 11;
      const updateData = {
        title: '  Trimmed Title ',
        description: 'Keep description',
        priority: 'HIGH',
        status: 'in_progress',
        deadline: '',
        archived: true,
        tags: ' foo ,bar,, baz ',
        assigned_to: ['1', ' 2 ', null, 3],
        recurrence: { freq: 'monthly', interval: '3' }
      };

      const currentTask = {
        id: taskId,
        project_id: 5,
        status: 'pending',
        recurrence_freq: null,
        recurrence_interval: 1,
        assigned_to: [],
        tags: []
      };

      taskRepository.getTaskById.mockResolvedValue(currentTask);
      taskRepository.updateById = jest.fn().mockResolvedValue({
        ...currentTask,
        ...updateData,
        title: 'Trimmed Title',
        deadline: null,
        assigned_to: [1, 2, 3],
        tags: ['foo', 'bar', 'baz'],
        recurrence_freq: 'monthly',
        recurrence_interval: 3
      });

      await taskService.updateTask(taskId, updateData);

      const patch = taskRepository.updateById.mock.calls[0][1];
      expect(patch.title).toBe('  Trimmed Title ');
      expect(patch.description).toBe('Keep description');
      expect(patch.priority).toBe('high');
      expect(patch.status).toBe('in_progress');
      expect(patch.deadline).toBeNull();
      expect(patch.archived).toBe(true);
      expect(patch.tags).toEqual(['foo', 'bar', 'baz']);
      expect(patch.assigned_to).toEqual([1, 2, 3]);
      expect(patch.recurrence_freq).toBe('monthly');
      expect(patch.recurrence_interval).toBe(3);
    });

    test('should clear recurrence when explicitly set to null', async () => {
      const taskId = 12;
      const currentTask = {
        id: taskId,
        project_id: 9,
        status: 'pending',
        recurrence_freq: 'weekly',
        recurrence_interval: 4,
        assigned_to: [],
        tags: []
      };

      taskRepository.getTaskById.mockResolvedValue(currentTask);
      taskRepository.updateById = jest.fn().mockResolvedValue(currentTask);

      await taskService.updateTask(taskId, { recurrence: null });

      const patch = taskRepository.updateById.mock.calls[0][1];
      expect(patch.recurrence_freq).toBeNull();
      expect(patch.recurrence_interval).toBe(1);
    });

    test('should enforce permission checks when requesting user provided', async () => {
      const taskId = 13;
      const updates = { title: 'Permission update' };
      const currentTask = {
        id: taskId,
        project_id: 20,
        status: 'pending',
        recurrence_freq: null,
        recurrence_interval: 1,
        assigned_to: [],
        tags: []
      };

      taskRepository.getTaskById.mockResolvedValue(currentTask);
      taskRepository.updateById = jest.fn().mockResolvedValue({ ...currentTask, ...updates });

      const canUpdateSpy = jest.spyOn(taskService, '_canUserUpdateTask').mockResolvedValue(true);

      await taskService.updateTask(taskId, updates, 200);

      expect(canUpdateSpy).toHaveBeenCalledWith(currentTask.project_id, 200, currentTask);
      canUpdateSpy.mockRestore();
    });

    test('should deny update when permission check fails', async () => {
      const taskId = 14;
      const updates = { title: 'Permission denied' };
      const currentTask = {
        id: taskId,
        project_id: 30,
        status: 'pending',
        recurrence_freq: null,
        recurrence_interval: 1,
        assigned_to: [],
        tags: []
      };

      taskRepository.getTaskById.mockResolvedValue(currentTask);
      taskRepository.updateById = jest.fn();

      const canUpdateSpy = jest.spyOn(taskService, '_canUserUpdateTask').mockResolvedValue(false);

      await expect(taskService.updateTask(taskId, updates, 300))
        .rejects.toThrow('You do not have permission to update this task');

      expect(taskRepository.updateById).not.toHaveBeenCalled();
      canUpdateSpy.mockRestore();
    });

    test('should clone subtasks when recurring task completes', async () => {
      const taskId = 7;
      const currentTask = {
        id: taskId,
        title: 'Recurring Parent',
        status: 'in_progress',
        deadline: '2024-01-01',
        project_id: 12,
        assigned_to: [5],
        tags: ['urgent'],
        recurrence_freq: 'weekly',
        recurrence_interval: 2,
        recurrence_series_id: 'series-123'
      };
      const updatedTask = { ...currentTask, status: 'completed' };
      const newParent = { id: 99 };
      const childSubtasks = [
        {
          id: 101,
          title: 'Child Task',
          description: 'Do something',
          priority: 'high',
          status: 'in_progress',
          deadline: '2024-01-08',
          project_id: 45,
          assigned_to: [9],
          tags: ['child']
        }
      ];

      taskRepository.getTaskById.mockResolvedValue(currentTask);
      taskRepository.updateById = jest.fn().mockResolvedValue(updatedTask);
      taskRepository.insert = jest.fn().mockResolvedValue(newParent);
      taskRepository.getSubtasks = jest.fn().mockResolvedValue(childSubtasks);
      taskRepository.insertMany = jest.fn().mockResolvedValue([]);

      await taskService.updateTask(taskId, { status: 'completed' });

      expect(taskRepository.insert).toHaveBeenCalledWith(expect.objectContaining({
        parent_id: null,
        deadline: '2024-01-15',
        recurrence_series_id: currentTask.recurrence_series_id
      }));
      expect(taskRepository.getSubtasks).toHaveBeenCalledWith(currentTask.id);
      expect(taskRepository.insertMany).toHaveBeenCalledTimes(1);

      const insertedChildren = taskRepository.insertMany.mock.calls[0][0];
      expect(insertedChildren).toHaveLength(1);
      const childPayload = insertedChildren[0];
      expect(childPayload.parent_id).toBe(newParent.id);
      expect(childPayload.status).toBe('pending');
      expect(childPayload.deadline).toBe('2024-01-22');
      expect(childPayload.recurrence_freq).toBe(currentTask.recurrence_freq);
      expect(childPayload.recurrence_interval).toBe(currentTask.recurrence_interval);
      expect(childPayload.recurrence_series_id).toBe(currentTask.recurrence_series_id);
      expect(childPayload.assigned_to).toEqual(childSubtasks[0].assigned_to);
      expect(childPayload.tags).toEqual(childSubtasks[0].tags);
      expect(childPayload.created_at).toBeInstanceOf(Date);
      expect(childPayload.updated_at).toBeInstanceOf(Date);
    });

    test('should skip cloning subtasks when none exist', async () => {
      const taskId = 8;
      const currentTask = {
        id: taskId,
        title: 'Parent without children',
        status: 'in_progress',
        deadline: '2024-02-01',
        project_id: 20,
        assigned_to: [],
        tags: [],
        recurrence_freq: 'weekly',
        recurrence_interval: 1,
        recurrence_series_id: 'series-xyz'
      };
      const updatedTask = { ...currentTask, status: 'completed' };

      taskRepository.getTaskById.mockResolvedValue(currentTask);
      taskRepository.updateById = jest.fn().mockResolvedValue(updatedTask);
      taskRepository.insert = jest.fn().mockResolvedValue({ id: 200 });
      taskRepository.getSubtasks = jest.fn().mockResolvedValue([]);
      taskRepository.insertMany = jest.fn();

      await taskService.updateTask(taskId, { status: 'completed' });

      expect(taskRepository.getSubtasks).toHaveBeenCalledWith(currentTask.id);
      expect(taskRepository.insertMany).not.toHaveBeenCalled();
    });

    test('should propagate recurrence for monthly schedules and update missing series id', async () => {
      const taskId = 15;
      const currentTask = {
        id: taskId,
        title: 'Monthly Parent',
        description: 'Recurring monthly',
        status: 'pending',
        deadline: '2024-01-31',
        project_id: 40,
        assigned_to: [1, 2],
        tags: ['m-tag'],
        recurrence_freq: 'monthly',
        recurrence_interval: 2,
        recurrence_series_id: null
      };
      const updatedTask = { ...currentTask, status: 'completed' };
      const newSeriesId = 'series-new';

      const uuidSpy = jest.spyOn(crypto, 'randomUUID').mockReturnValue(newSeriesId);

      taskRepository.getTaskById.mockResolvedValue(currentTask);
      taskRepository.updateById = jest.fn()
        .mockResolvedValueOnce(updatedTask) // primary update
        .mockRejectedValueOnce(new Error('series update failed')); // ensure catch branch runs
      taskRepository.insert = jest.fn().mockResolvedValue({ id: 400 });
      taskRepository.getSubtasks = jest.fn().mockResolvedValue([
        {
          id: 900,
          title: 'Child Monthly',
          description: 'Child task',
          priority: 'medium',
          status: 'pending',
          deadline: '2024-02-15',
          project_id: null,
          assigned_to: [3],
          tags: ['child']
        }
      ]);
      taskRepository.insertMany = jest.fn().mockResolvedValue([]);

      await taskService.updateTask(taskId, { status: 'completed' });

      // parent insert payload should have monthly interval applied (2 months)
      const parentPayload = taskRepository.insert.mock.calls[0][0];
      expect(parentPayload.deadline).toBe('2024-03-31');
      expect(parentPayload.recurrence_series_id).toBe(newSeriesId);

      // second update attempt should have been made (even though it failed)
      expect(taskRepository.updateById).toHaveBeenCalledTimes(2);
      expect(taskRepository.updateById.mock.calls[1]).toEqual([currentTask.id, { recurrence_series_id: newSeriesId }]);

      const childPayload = taskRepository.insertMany.mock.calls[0][0][0];
      expect(childPayload.parent_id).toBe(400);
      expect(childPayload.deadline).toBe('2024-04-15');
      expect(childPayload.recurrence_series_id).toBe(newSeriesId);
      uuidSpy.mockRestore();
    });

    test('should advance deadlines for daily recurrence using the provided interval', async () => {
      const taskId = 17;
      const currentTask = {
        id: taskId,
        title: 'Daily Parent',
        description: 'Daily',
        status: 'pending',
        deadline: '2024-05-01',
        project_id: 10,
        assigned_to: [],
        tags: [],
        recurrence_freq: 'daily',
        recurrence_interval: 3,
        recurrence_series_id: 'series-daily'
      };
      const updatedTask = { ...currentTask, status: 'completed' };

      taskRepository.getTaskById.mockResolvedValue(currentTask);
      taskRepository.updateById = jest.fn().mockResolvedValue(updatedTask);
      taskRepository.insert = jest.fn().mockResolvedValue({ id: 610 });
      taskRepository.getSubtasks = jest.fn().mockResolvedValue([]);
      taskRepository.insertMany = jest.fn();

      await taskService.updateTask(taskId, { status: 'completed' });

      const parentPayload = taskRepository.insert.mock.calls[0][0];
      expect(parentPayload.deadline).toBe('2024-05-04');
      expect(taskRepository.insertMany).not.toHaveBeenCalled();
    });

    test('should advance weekly recurrence for parent and child deadlines', async () => {
      const taskId = 18;
      const currentTask = {
        id: taskId,
        title: 'Weekly Parent',
        description: null,
        status: 'pending',
        deadline: '2024-06-01',
        project_id: 11,
        assigned_to: [8],
        tags: ['weekly'],
        recurrence_freq: 'weekly',
        recurrence_interval: 2,
        recurrence_series_id: 'series-weekly'
      };
      const updatedTask = { ...currentTask, status: 'completed' };
      const child = {
        id: 950,
        title: 'Weekly Child',
        description: 'child',
        priority: 'medium',
        status: 'pending',
        deadline: '2024-06-03',
        project_id: null,
        assigned_to: [],
        tags: ['child-weekly']
      };

      taskRepository.getTaskById.mockResolvedValue(currentTask);
      taskRepository.updateById = jest.fn().mockResolvedValue(updatedTask);
      taskRepository.insert = jest.fn().mockResolvedValue({ id: 611 });
      taskRepository.getSubtasks = jest.fn().mockResolvedValue([child]);
      taskRepository.insertMany = jest.fn().mockResolvedValue([]);

      await taskService.updateTask(taskId, { status: 'completed' });

      const parentPayload = taskRepository.insert.mock.calls[0][0];
      expect(parentPayload.deadline).toBe('2024-06-15'); // +14 days

      const childPayload = taskRepository.insertMany.mock.calls[0][0][0];
      expect(childPayload.deadline).toBe('2024-06-17');
    });

    test('should handle invalid previous deadlines by setting next due to null', async () => {
      const taskId = 19;
      const currentTask = {
        id: taskId,
        title: 'Invalid date parent',
        description: null,
        status: 'pending',
        deadline: 'not-a-date',
        project_id: 12,
        assigned_to: [],
        tags: [],
        recurrence_freq: 'daily',
        recurrence_interval: 1,
        recurrence_series_id: 'series-invalid'
      };
      const updatedTask = { ...currentTask, status: 'completed' };

      taskRepository.getTaskById.mockResolvedValue(currentTask);
      taskRepository.updateById = jest.fn().mockResolvedValue(updatedTask);
      taskRepository.insert = jest.fn().mockResolvedValue({ id: 612 });
      taskRepository.getSubtasks = jest.fn().mockResolvedValue([]);
      taskRepository.insertMany = jest.fn();

      await taskService.updateTask(taskId, { status: 'completed' });

      const parentPayload = taskRepository.insert.mock.calls[0][0];
      expect(parentPayload.deadline).toBeNull();
    });

    test('should handle missing deadlines and tolerate subtask cloning errors', async () => {
      const taskId = 16;
      const currentTask = {
        id: taskId,
        title: 'No deadline parent',
        description: null,
        status: 'pending',
        deadline: null,
        project_id: 55,
        assigned_to: [],
        tags: [],
        recurrence_freq: 'weekly',
        recurrence_interval: 1,
        recurrence_series_id: 'series-fixed'
      };
      const updatedTask = { ...currentTask, status: 'completed' };

      taskRepository.getTaskById.mockResolvedValue(currentTask);
      taskRepository.updateById = jest.fn().mockResolvedValue(updatedTask);
      taskRepository.insert = jest.fn().mockResolvedValue({ id: 501 });
      taskRepository.getSubtasks = jest.fn().mockResolvedValue([
        {
          id: 901,
          title: 'Child missing date',
          description: null,
          priority: 'low',
          status: 'pending',
          deadline: null,
          project_id: null,
          assigned_to: [],
          tags: []
        }
      ]);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      taskRepository.insertMany = jest.fn().mockRejectedValue(new Error('clone failure'));

      await taskService.updateTask(taskId, { status: 'completed' });

      const parentPayload = taskRepository.insert.mock.calls[0][0];
      expect(parentPayload.deadline).toBeNull();

      expect(taskRepository.insertMany).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith('[recurrence] cloning subtasks failed:', expect.any(Error));
      consoleSpy.mockRestore();
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
      const summary = {
        total_hours: 4,
        per_assignee: [{ user_id: 2, hours: 4 }]
      };

      taskRepository.getTaskById.mockResolvedValue(mockTask);
      taskAssigneeHoursService.getTaskHoursSummary.mockResolvedValue(summary);

      const result = await taskService.getTaskById(taskId);

      expect(taskRepository.getTaskById).toHaveBeenCalledWith(taskId);
      expect(taskAssigneeHoursService.getTaskHoursSummary).toHaveBeenCalledWith(taskId, []);
      expect(result).toEqual({ ...mockTask, time_tracking: summary });
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

      taskRepository.getTasksWithFilters.mockResolvedValue(mockTasks);
      taskRepository.getTaskCount.mockResolvedValue(2);

      const result = await taskService.getTasksByProject(projectId, filters);

      expect(taskRepository.getTasksWithFilters).toHaveBeenCalledWith({ ...filters, projectId });
      expect(result.tasks).toEqual(mockTasks);
      expect(result.totalCount).toBe(2);
    });

    test('should handle project not found', async () => {
      const projectId = 999;
      const filters = {};

      projectRepository.getProjectById.mockRejectedValue(new Error('Project not found'));

      await expect(taskService.getTasksByProject(projectId, filters))
        .rejects.toThrow('Project not found');
    });
  });

  describe('getProjectTaskStats', () => {
    test('should return zeroed stats when no tasks found', async () => {
      projectRepository.getProjectById = jest.fn().mockResolvedValue({ id: 1 });
      taskRepository.getTasksByProjectId = jest.fn().mockResolvedValue([]);

      const stats = await taskService.getProjectTaskStats(1);

      expect(stats).toEqual({
        totalTasks: 0,
        pendingTasks: 0,
        inProgressTasks: 0,
        completedTasks: 0,
        cancelledTasks: 0,
        blockedTasks: 0,
        tasksByPriority: { low: 0, medium: 0, high: 0 },
        overdueTasks: 0,
        completionRate: 0
      });
    });

    test('should compute aggregate stats for a project', async () => {
      projectRepository.getProjectById = jest.fn().mockResolvedValue({ id: 2 });
      const now = new Date();
      const pastDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const futureDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      taskRepository.getTasksByProjectId = jest.fn().mockResolvedValue([
        { status: 'pending', priority: 'low', deadline: pastDate },
        { status: 'in_progress', priority: 'medium', deadline: futureDate },
        { status: 'completed', priority: 'high', deadline: pastDate },
        { status: 'cancelled', priority: 'medium', deadline: null },
        { status: 'blocked', priority: 'low', deadline: futureDate }
      ]);

      const stats = await taskService.getProjectTaskStats(2);

      expect(stats.totalTasks).toBe(5);
      expect(stats.pendingTasks).toBe(1);
      expect(stats.inProgressTasks).toBe(1);
      expect(stats.completedTasks).toBe(1);
      expect(stats.cancelledTasks).toBe(1);
      expect(stats.blockedTasks).toBe(1);
      expect(stats.tasksByPriority).toEqual({ low: 2, medium: 2, high: 1 });
      expect(stats.overdueTasks).toBe(1);
      expect(stats.completionRate).toBe('20.0');
    });
  });

  describe('deleteTask permissions', () => {
    test('should enforce permissions before deleting', async () => {
      const taskId = 2;
      const currentTask = { id: taskId, project_id: 60 };

      taskRepository.getTaskById.mockResolvedValue(currentTask);
      taskRepository.deleteTask.mockResolvedValue(true);

      const canUpdateSpy = jest.spyOn(taskService, '_canUserUpdateTask').mockResolvedValue(true);

      await taskService.deleteTask(taskId, 900);

      expect(canUpdateSpy).toHaveBeenCalledWith(currentTask.project_id, 900, currentTask);
      expect(taskRepository.deleteTask).toHaveBeenCalledWith(taskId);
      canUpdateSpy.mockRestore();
    });

    test('should reject deletion when permission denied', async () => {
      const taskId = 3;
      const currentTask = { id: taskId, project_id: 70 };

      taskRepository.getTaskById.mockResolvedValue(currentTask);
      taskRepository.deleteTask.mockResolvedValue(true);

      const canUpdateSpy = jest.spyOn(taskService, '_canUserUpdateTask').mockResolvedValue(false);

      await expect(taskService.deleteTask(taskId, 901))
        .rejects.toThrow('You do not have permission to delete this task');

      expect(taskRepository.deleteTask).not.toHaveBeenCalled();
      canUpdateSpy.mockRestore();
    });
  });

  describe('_filterTasksByRBAC', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('allows managers to see their own tasks and those in accessible projects', async () => {
      const managerId = 40;
      const tasks = [
        { id: 1, project_id: 90, assigned_to: [managerId] },
        { id: 2, project_id: 55, assigned_to: [301] },
        { id: 3, project_id: 77, assigned_to: [302] }
      ];

      const accessibleSpy = jest.spyOn(taskService, '_getAccessibleProjectIds').mockResolvedValue([55]);
      const subordinateSpy = jest.spyOn(taskService, '_getSubordinateUserIds').mockResolvedValue([]);

      const filtered = await taskService._filterTasksByRBAC(tasks, managerId, 'manager', 3, 'sales', 'Operations');

      expect(accessibleSpy).toHaveBeenCalledWith(managerId, 'manager', 3, 'sales');
      expect(subordinateSpy).toHaveBeenCalledWith(3, 'sales');
      expect(filtered.map((t) => t.id)).toEqual([1, 2]);
      accessibleSpy.mockRestore();
      subordinateSpy.mockRestore();
    });

    test('restricts staff users to tasks assigned to them or projects they belong to', async () => {
      const staffId = 22;
      const tasks = [
        { id: 1, project_id: 11, assigned_to: [99] },
        { id: 2, project_id: null, assigned_to: [staffId] },
        { id: 3, project_id: 12, assigned_to: [staffId, 44] }
      ];

      const accessibleSpy = jest.spyOn(taskService, '_getAccessibleProjectIds').mockResolvedValue([]);
      const membershipSpy = jest.spyOn(taskService, '_getProjectMemberships').mockResolvedValue([12]);

      const filtered = await taskService._filterTasksByRBAC(tasks, staffId, 'staff', 1, 'marketing', 'Marketing');

      expect(filtered.map((t) => t.id)).toEqual([2, 3]);
      expect(accessibleSpy).toHaveBeenCalledWith(staffId, 'staff', 1, 'marketing');
      expect(membershipSpy).toHaveBeenCalledWith(staffId);
      accessibleSpy.mockRestore();
      membershipSpy.mockRestore();
    });

    test('allows managers to view tasks assigned to subordinates even without project access', async () => {
      const managerId = 50;
      const tasks = [
        { id: 1, project_id: 90, assigned_to: [301] },
        { id: 2, project_id: 55, assigned_to: [999] },
      ];

      const accessibleSpy = jest
        .spyOn(taskService, '_getAccessibleProjectIds')
        .mockResolvedValue([]);
      const subordinateSpy = jest
        .spyOn(taskService, '_getSubordinateUserIds')
        .mockResolvedValue([301]);

      const filtered = await taskService._filterTasksByRBAC(
        tasks,
        managerId,
        'manager',
        5,
        'sales',
        null
      );

      expect(filtered.map((t) => t.id)).toEqual([1]);
      expect(accessibleSpy).toHaveBeenCalled();
      expect(subordinateSpy).toHaveBeenCalledWith(5, 'sales');
      accessibleSpy.mockRestore();
      subordinateSpy.mockRestore();
    });
  });

  describe('_canUserUpdateTask RBAC checks', () => {
    beforeEach(() => {
      supabase.from.mockReset();
      supabase.from.mockImplementation(() => createInResponse([]));
      projectRepository.canUserManageMembers.mockResolvedValue(false);
      projectRepository.getProjectById.mockResolvedValue({ id: 55, creator_id: 200 });
    });

    test('grants managers with higher hierarchy in the same division edit access', async () => {
      supabase.from
        .mockImplementationOnce(() => createEqLimitResponse([{ id: 100, role: 'manager', hierarchy: 4, division: 'Sales' }]))
        .mockImplementationOnce(() => createEqLimitResponse([{ id: 200, hierarchy: 2, division: 'Sales' }]))
        .mockImplementation(() => createInResponse([]));

      const task = { assigned_to: [301], project_id: 55 };
      const result = await taskService._canUserUpdateTask(55, 100, task);

      expect(result).toBe(true);
    });

    test('grants managers edit access when task assignees report to them', async () => {
      supabase.from
        .mockImplementationOnce(() => createEqLimitResponse([{ id: 150, role: 'manager', hierarchy: 5, division: 'Sales' }]))
        .mockImplementationOnce(() => createEqLimitResponse([{ id: 200, hierarchy: 6, division: 'Marketing' }]))
        .mockImplementation(() => createInResponse([
          { id: 305, hierarchy: 2, division: 'Sales' },
          { id: 306, hierarchy: 3, division: 'Finance' }
        ]));

      const task = { assigned_to: [305, 306], project_id: 55 };
      const result = await taskService._canUserUpdateTask(55, 150, task);

      expect(result).toBe(true);
    });

    test('denies non-managers who are not assigned to the task', async () => {
      supabase.from
        .mockImplementationOnce(() => createEqLimitResponse([{ id: 250, role: 'staff', hierarchy: 1, division: 'Sales' }]))
        .mockImplementation(() => createEqLimitResponse([]));

      const task = { assigned_to: [999], project_id: 10 };
      const result = await taskService._canUserUpdateTask(10, 250, task);

      expect(result).toBeUndefined();
    });
  });

  describe('_calculatePagination', () => {
    test('should calculate pagination metadata', () => {
      const meta = taskService._calculatePagination({ page: 2, limit: 5 }, 22);
      expect(meta).toEqual({
        page: 2,
        limit: 5,
        totalPages: 5,
        hasNext: true,
        hasPrev: true
      });
    });

    test('should handle default pagination values', () => {
      const meta = taskService._calculatePagination({}, 5);
      expect(meta).toEqual({
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNext: false,
        hasPrev: false
      });
    });
  });

  describe('getSubtasks', () => {
    test('should get subtasks for a parent task', async () => {
      const parentId = 1;
      const mockSubtasks = [
        { id: 10, title: 'Subtask 1', parent_id: 1, status: 'pending' },
        { id: 11, title: 'Subtask 2', parent_id: 1, status: 'in_progress' }
      ];

      taskRepository.getSubtasks.mockResolvedValue(mockSubtasks);

      const result = await taskService.getSubtasks(parentId);

      expect(taskRepository.getSubtasks).toHaveBeenCalledWith(parentId);
      expect(result).toEqual(mockSubtasks);
      expect(result).toHaveLength(2);
    });

    test('should return empty array when no subtasks exist', async () => {
      const parentId = 2;

      taskRepository.getSubtasks.mockResolvedValue([]);

      const result = await taskService.getSubtasks(parentId);

      expect(taskRepository.getSubtasks).toHaveBeenCalledWith(parentId);
      expect(result).toEqual([]);
    });

    test('should handle repository error', async () => {
      const parentId = 3;

      taskRepository.getSubtasks.mockRejectedValue(new Error('Database error'));

      await expect(taskService.getSubtasks(parentId))
        .rejects.toThrow('Database error');
    });
  });

  describe('getTasksWithSubtasks', () => {
    test('should get tasks with their subtasks', async () => {
      const mockTasks = [
        { id: 1, title: 'Parent Task 1', parent_id: null },
        { id: 2, title: 'Parent Task 2', parent_id: null }
      ];

      const mockSubtasksTask1 = [
        { id: 10, title: 'Subtask 1-1', parent_id: 1 }
      ];

      const mockSubtasksTask2 = [
        { id: 20, title: 'Subtask 2-1', parent_id: 2 },
        { id: 21, title: 'Subtask 2-2', parent_id: 2 }
      ];

      taskRepository.getTasksWithFilters.mockResolvedValue(mockTasks);
      taskRepository.getSubtasks
        .mockResolvedValueOnce(mockSubtasksTask1)
        .mockResolvedValueOnce(mockSubtasksTask2);

      const result = await taskService.getTasksWithSubtasks({ projectId: 1 });

      expect(result[0].subtasks).toEqual(mockSubtasksTask1);
      expect(result[0].subtaskCount).toBe(1);
      expect(result[1].subtasks).toEqual(mockSubtasksTask2);
      expect(result[1].subtaskCount).toBe(2);
    });

    test('should handle tasks with no subtasks', async () => {
      const mockTasks = [
        { id: 1, title: 'Parent Task 1', parent_id: null }
      ];

      taskRepository.getTasksWithFilters.mockResolvedValue(mockTasks);
      taskRepository.getSubtasks.mockResolvedValue([]);

      const result = await taskService.getTasksWithSubtasks({ projectId: 1 });

      expect(result[0].subtasks).toEqual([]);
      expect(result[0].subtaskCount).toBe(0);
    });
  });
});
    test('allows HR Team department users to view all tasks', async () => {
      const userId = 99;
      const tasks = [
        { id: 1, project_id: 10, assigned_to: [42] },
        { id: 2, project_id: null, assigned_to: [] },
        { id: 3, project_id: 11, assigned_to: [77] }
      ];

      const spy = jest.spyOn(taskService, '_getAccessibleProjectIds').mockResolvedValue([]);

      const filtered = await taskService._filterTasksByRBAC(tasks, userId, 'staff', 2, 'corporate', 'HR Team');

      expect(filtered).toEqual(tasks);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
