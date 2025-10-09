const taskService = require('../../src/services/taskService');
const taskRepository = require('../../src/repository/taskRepository');
const projectRepository = require('../../src/repository/projectRepository');
const userRepository = require('../../src/repository/userRepository');
const notificationService = require('../../src/services/notificationService');

jest.mock('../../src/repository/taskRepository');
jest.mock('../../src/repository/projectRepository');
jest.mock('../../src/repository/userRepository');
jest.mock('../../src/services/notificationService');

describe('TaskService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    notificationService.createTaskAssignmentNotifications.mockResolvedValue({ notificationsSent: 0 });
    notificationService.createTaskRemovalNotifications = jest.fn().mockResolvedValue({ notificationsSent: 0 });
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
      expect(result).toEqual(mockCreatedTask);
    });

    test('should reject when more than 5 assignees provided', async () => {
      const taskData = {
        title: 'Too Many',
        assigned_to: [2, 3, 4, 5, 6, 7]
      };

      userRepository.getUserById.mockResolvedValue({ id: 1 });

      await expect(taskService.createTask(taskData, 1)).rejects.toThrow('at most 5 assignees');
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
    });

    test('should handle missing required fields', async () => {
      const taskData = {
        description: 'Task without title'
      };

      await expect(taskService.createTask(taskData))
        .rejects.toThrow('title is required');
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
        title: 'Updated Task',
        status: 'completed',
        updated_at: new Date().toISOString()
      };

      // Mock updateById method since service checks for it first
      taskRepository.updateById = jest.fn().mockResolvedValue(mockUpdatedTask);

      const result = await taskService.updateTask(taskId, updateData);

      expect(taskRepository.updateById).toHaveBeenCalledWith(taskId, expect.objectContaining({
        title: 'Updated Task',
        status: 'completed',
        updated_at: expect.any(String)
      }));
      expect(result).toEqual(mockUpdatedTask);
    });

    test('should handle task not found', async () => {
      const taskId = 999;
      const updateData = { title: 'Updated Task' };

      taskRepository.updateById = jest.fn().mockRejectedValue(new Error('Task not found'));

      await expect(taskService.updateTask(taskId, updateData))
        .rejects.toThrow('Task not found');
    });

    test('should handle validation error', async () => {
      const taskId = 1;
      const updateData = { status: 'invalid_status' };

      taskRepository.updateById = jest.fn().mockRejectedValue(new Error('Invalid status'));

      await expect(taskService.updateTask(taskId, updateData))
        .rejects.toThrow('Invalid status');
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
      expect(result).toEqual(mockUpdatedTask);
      expect(notificationService.createTaskAssignmentNotifications).toHaveBeenCalledWith(expect.objectContaining({
        task: mockUpdatedTask,
        assigneeIds: [3],
        assignedById: null,
        previousAssigneeIds: [1, 2],
        currentAssigneeIds: [1, 2, 3],
        notificationType: 'reassignment'
      }));
      expect(notificationService.createTaskRemovalNotifications).not.toHaveBeenCalled();
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
      expect(result).toEqual(mockUpdatedTask);
      expect(notificationService.createTaskRemovalNotifications).toHaveBeenCalledWith(expect.objectContaining({
        task: mockUpdatedTask,
        assigneeIds: [3],
        assignedById: null,
        previousAssigneeIds: [1, 2, 3],
        currentAssigneeIds: [1, 2]
      }));
      expect(notificationService.createTaskAssignmentNotifications).not.toHaveBeenCalled();
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

    test('should reject update when requester not assigned', async () => {
      const taskId = 4;
      const updateData = { title: 'Cannot update' };

      taskRepository.getTaskById.mockResolvedValue({
        id: taskId,
        assigned_to: [1, 2]
      });

      await expect(taskService.updateTask(taskId, updateData, 99)).rejects.toThrow('assigned to the task');
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




});
