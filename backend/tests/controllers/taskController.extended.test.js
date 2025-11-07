const taskController = require('../../src/controllers/taskController');
const taskService = require('../../src/services/taskService');

jest.mock('../../src/services/taskService');
jest.mock('../../src/services/projectTasksService', () => ({
  sendDeadlineNotifications: jest.fn()
}));

describe('TaskController - Extended Coverage', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
      user: { id: 1, role: 'admin', hierarchy: 1, division: 'Engineering', department: 'Engineering' }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: {
        session: { user_id: 1, role: 'admin', hierarchy: 1, division: 'Engineering', department: 'Engineering' }
      }
    };
    jest.clearAllMocks();
  });

  describe('getAllTasks', () => {
    test('should get all tasks with default pagination', async () => {
      const mockResult = {
        tasks: [{ id: 1, title: 'Task 1' }],
        totalCount: 1,
        pagination: { page: 1, limit: 20 }
      };
      taskService.getAllTasks.mockResolvedValue(mockResult);

      await taskController.getAllTasks(req, res);

      expect(taskService.getAllTasks).toHaveBeenCalledWith(expect.objectContaining({
        page: 1,
        limit: 20,
        sortBy: 'created_at',
        sortOrder: 'desc'
      }));
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        tasks: mockResult.tasks,
        totalTasks: 1
      }));
    });

    test('should handle custom filters and pagination', async () => {
      req.query = {
        status: 'in_progress',
        priority: 'high',
        assignedTo: '5',
        page: '2',
        limit: '10',
        sortBy: 'deadline',
        sortOrder: 'asc'
      };

      const mockResult = {
        tasks: [{ id: 2, title: 'Task 2' }],
        totalCount: 15,
        pagination: { page: 2, limit: 10 }
      };
      taskService.getAllTasks.mockResolvedValue(mockResult);

      await taskController.getAllTasks(req, res);

      expect(taskService.getAllTasks).toHaveBeenCalledWith(expect.objectContaining({
        status: 'in_progress',
        priority: 'high',
        assignedTo: 5,
        page: 2,
        limit: 10,
        offset: 10,
        sortBy: 'deadline',
        sortOrder: 'asc'
      }));
    });

    test('should reject invalid page number', async () => {
      req.query.page = '0';

      await taskController.getAllTasks(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Page must be a positive integer' });
    });

    test('should reject limit below 1', async () => {
      req.query.limit = '0';

      await taskController.getAllTasks(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Limit must be between 1 and 100' });
    });

    test('should reject limit above 100', async () => {
      req.query.limit = '101';

      await taskController.getAllTasks(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Limit must be between 1 and 100' });
    });

    test('should handle service errors', async () => {
      const error = new Error('Database error');
      taskService.getAllTasks.mockRejectedValue(error);

      await taskController.getAllTasks(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Database error' });
    });
  });

  describe('getTasksByProject', () => {
    beforeEach(() => {
      req.params = { projectId: '1' };
    });

    test('should get tasks for a project', async () => {
      const mockResult = {
        tasks: [{ id: 1, title: 'Project Task' }],
        totalCount: 1,
        pagination: { page: 1, limit: 20 }
      };
      taskService.getTasksByProject.mockResolvedValue(mockResult);

      await taskController.getTasksByProject(req, res);

      expect(taskService.getTasksByProject).toHaveBeenCalledWith(1, expect.any(Object));
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        projectId: 1,
        tasks: mockResult.tasks
      }));
    });

    test('should reject invalid project id', async () => {
      req.params.projectId = 'invalid';

      await taskController.getTasksByProject(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Valid project ID is required' });
    });

    test('should reject missing project id', async () => {
      req.params.projectId = null;

      await taskController.getTasksByProject(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Valid project ID is required' });
    });

    test('should handle project not found', async () => {
      const error = new Error('Project not found');
      taskService.getTasksByProject.mockRejectedValue(error);

      await taskController.getTasksByProject(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Project not found' });
    });

    test('should handle pagination parameters', async () => {
      req.query = { page: '2', limit: '15' };
      const mockResult = {
        tasks: [],
        totalCount: 0,
        pagination: { page: 2, limit: 15 }
      };
      taskService.getTasksByProject.mockResolvedValue(mockResult);

      await taskController.getTasksByProject(req, res);

      expect(taskService.getTasksByProject).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ page: 2, limit: 15, offset: 15 })
      );
    });
  });

  describe('createTask', () => {
    test('should create task with valid data', async () => {
      req.body = {
        title: 'New Task',
        description: 'Description',
        status: 'pending',
        priority: 5
      };
      req.user = { id: 1 };

      const mockTask = { id: 1, ...req.body };
      taskService.createTask.mockResolvedValue(mockTask);

      await taskController.createTask(req, res);

      expect(taskService.createTask).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ success: true, task: mockTask });
    });

    test('should reject task without title', async () => {
      req.body = { description: 'No title' };

      await taskController.createTask(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Title is required' });
    });

    test('should reject task with empty title', async () => {
      req.body = { title: '   ' };

      await taskController.createTask(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Title is required' });
    });

    test('should reject invalid status', async () => {
      req.body = {
        title: 'Task',
        status: 'invalid_status'
      };

      await taskController.createTask(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: expect.stringContaining('Status must be one of')
      }));
    });

    test('should accept legacy priority low', async () => {
      req.body = {
        title: 'Task',
        priority: 'low'
      };
      req.user = { id: 1 };

      const mockTask = { id: 1, title: 'Task', priority: 1 };
      taskService.createTask.mockResolvedValue(mockTask);

      await taskController.createTask(req, res);

      expect(taskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({ priority: 1 }),
        1
      );
    });

    test('should accept legacy priority medium', async () => {
      req.body = {
        title: 'Task',
        priority: 'medium'
      };
      req.user = { id: 1 };

      const mockTask = { id: 1, title: 'Task', priority: 5 };
      taskService.createTask.mockResolvedValue(mockTask);

      await taskController.createTask(req, res);

      expect(taskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({ priority: 5 }),
        1
      );
    });

    test('should accept legacy priority high', async () => {
      req.body = {
        title: 'Task',
        priority: 'high'
      };
      req.user = { id: 1 };

      const mockTask = { id: 1, title: 'Task', priority: 10 };
      taskService.createTask.mockResolvedValue(mockTask);

      await taskController.createTask(req, res);

      expect(taskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({ priority: 10 }),
        1
      );
    });

    test('should reject priority out of range - too high', async () => {
      req.body = {
        title: 'Task',
        priority: 15
      };

      await taskController.createTask(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: expect.stringContaining('between 1 and 10')
      }));
    });

    test('should reject priority out of range - too low', async () => {
      req.body = {
        title: 'Task',
        priority: 0
      };

      await taskController.createTask(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        message: expect.stringContaining('between 1 and 10')
      }));
    });

    test('should reject invalid priority string', async () => {
      req.body = {
        title: 'Task',
        priority: 'invalid'
      };

      await taskController.createTask(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('should handle priority as numeric string', async () => {
      req.body = {
        title: 'Task',
        priority: '7'
      };
      req.user = { id: 1 };

      const mockTask = { id: 1, title: 'Task', priority: 7 };
      taskService.createTask.mockResolvedValue(mockTask);

      await taskController.createTask(req, res);

      expect(taskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({ priority: 7 }),
        1
      );
    });

    test('should use default priority 5 when not provided', async () => {
      req.body = {
        title: 'Task'
      };
      req.user = { id: 1 };

      const mockTask = { id: 1, title: 'Task', priority: 5 };
      taskService.createTask.mockResolvedValue(mockTask);

      await taskController.createTask(req, res);

      expect(taskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({ priority: 5 }),
        1
      );
    });
  });

  describe('updateTask', () => {
    beforeEach(() => {
      req.params = { taskId: '1' };
      req.user = { id: 1 };
    });

    test('should update task successfully', async () => {
      req.body = {
        title: 'Updated Title',
        status: 'completed'
      };

      const mockTask = { id: 1, ...req.body };
      taskService.updateTask.mockResolvedValue(mockTask);

      await taskController.updateTask(req, res);

      expect(taskService.updateTask).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ title: 'Updated Title', status: 'completed' }),
        1
      );
      expect(res.json).toHaveBeenCalledWith(mockTask);
    });

    test('should reject invalid task id', async () => {
      req.params.taskId = 'invalid';
      req.body = { title: 'Updated' };

      await taskController.updateTask(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Valid task ID is required' });
    });

    test('should reject update with no fields', async () => {
      req.body = {};

      await taskController.updateTask(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'At least one field to update is required' });
    });

    test('should handle permission errors', async () => {
      req.body = { title: 'Updated' };
      const error = new Error('No permission');
      taskService.updateTask.mockRejectedValue(error);

      await taskController.updateTask(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'No permission' });
    });

    test('should reject invalid status', async () => {
      req.body = { status: 'invalid' };

      await taskController.updateTask(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('Status must be one of')
      }));
    });

    test('should accept null priority', async () => {
      req.body = { priority: null };

      const mockTask = { id: 1, priority: null };
      taskService.updateTask.mockResolvedValue(mockTask);

      await taskController.updateTask(req, res);

      expect(taskService.updateTask).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ priority: null }),
        1
      );
    });

    test('should accept empty string priority as null', async () => {
      req.body = { priority: '' };

      const mockTask = { id: 1, priority: null };
      taskService.updateTask.mockResolvedValue(mockTask);

      await taskController.updateTask(req, res);

      expect(taskService.updateTask).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ priority: null }),
        1
      );
    });
  });

  describe('deleteTask', () => {
    beforeEach(() => {
      req.params = { id: '1' };
      req.user = { id: 1 };
    });

    test('should delete task successfully', async () => {
      taskService.deleteTask.mockResolvedValue(undefined);

      await taskController.deleteTask(req, res);

      expect(taskService.deleteTask).toHaveBeenCalledWith(1, 1);
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Task deleted successfully' });
    });

    test('should reject invalid task id', async () => {
      req.params.id = 'invalid';

      await taskController.deleteTask(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Valid task ID is required' });
    });

    test('should reject missing task id', async () => {
      req.params.id = null;

      await taskController.deleteTask(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('should handle permission errors', async () => {
      const error = new Error('No permission to delete');
      taskService.deleteTask.mockRejectedValue(error);

      await taskController.deleteTask(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'No permission to delete' });
    });

    test('should handle general errors', async () => {
      const error = new Error('Database error');
      taskService.deleteTask.mockRejectedValue(error);

      await taskController.deleteTask(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Database error' });
    });
  });

  describe('getProjectTaskStats', () => {
    beforeEach(() => {
      req.params = { projectId: '1' };
    });

    test('should get project task stats', async () => {
      const mockStats = {
        total: 10,
        pending: 3,
        in_progress: 4,
        completed: 3
      };
      taskService.getProjectTaskStats.mockResolvedValue(mockStats);

      await taskController.getProjectTaskStats(req, res);

      expect(taskService.getProjectTaskStats).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        projectId: 1,
        stats: mockStats
      });
    });

    test('should reject invalid project id', async () => {
      req.params.projectId = 'invalid';

      await taskController.getProjectTaskStats(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Valid project ID is required' });
    });

    test('should handle project not found', async () => {
      const error = new Error('Project not found');
      taskService.getProjectTaskStats.mockRejectedValue(error);

      await taskController.getProjectTaskStats(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('should handle general errors', async () => {
      const error = new Error('Database error');
      taskService.getProjectTaskStats.mockRejectedValue(error);

      await taskController.getProjectTaskStats(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getSubtasks', () => {
    beforeEach(() => {
      req.params = { taskId: '1' };
    });

    test('should get subtasks', async () => {
      const mockSubtasks = [
        { id: 2, title: 'Subtask 1', parent_id: 1 },
        { id: 3, title: 'Subtask 2', parent_id: 1 }
      ];
      taskService.getSubtasks.mockResolvedValue(mockSubtasks);

      await taskController.getSubtasks(req, res);

      expect(taskService.getSubtasks).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        subtasks: mockSubtasks
      });
    });

    test('should reject invalid task id', async () => {
      req.params.taskId = 'invalid';

      await taskController.getSubtasks(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Valid task ID is required' });
    });

    test('should reject missing task id', async () => {
      req.params.taskId = null;

      await taskController.getSubtasks(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('should handle service errors', async () => {
      const error = new Error('Database error');
      taskService.getSubtasks.mockRejectedValue(error);

      await taskController.getSubtasks(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('list with parent_id', () => {
    test('should handle parent_id query parameter', async () => {
      req.query.parent_id = '5';
      const mockTasks = [{ id: 1, parent_id: 5 }];
      taskService.listWithAssignees = jest.fn().mockResolvedValue(mockTasks);

      await taskController.list(req, res);

      expect(taskService.listWithAssignees).toHaveBeenCalledWith(
        expect.objectContaining({ parentId: 5 })
      );
    });

    test('should handle parent_id=null', async () => {
      req.query.parent_id = 'null';
      const mockTasks = [{ id: 1, parent_id: null }];
      taskService.listWithAssignees = jest.fn().mockResolvedValue(mockTasks);

      await taskController.list(req, res);

      expect(taskService.listWithAssignees).toHaveBeenCalledWith(
        expect.objectContaining({ parentId: null })
      );
    });
  });

  describe('update with httpCode', () => {
    test('should handle error with httpCode property', async () => {
      req.params.id = '1';
      req.body = { title: 'Updated' };

      const error = new Error('Permission denied');
      error.httpCode = 403;
      taskService.updateTask.mockRejectedValue(error);

      await taskController.update(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Permission denied' });
    });

    test('should handle error with status 400', async () => {
      req.params.id = '1';
      req.body = { title: 'Updated' };

      const error = new Error('Invalid input');
      error.status = 400;
      taskService.updateTask.mockRejectedValue(error);

      await taskController.update(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid input' });
    });
  });

  describe('getTasksByProject - Additional Coverage', () => {
    test('should return 400 for invalid page (less than 1)', async () => {
      req.params.projectId = '1';
      req.query = { page: '0' };

      await taskController.getTasksByProject(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Page must be a positive integer'
      });
    });

    test('should return 400 for invalid limit (less than 1)', async () => {
      req.params.projectId = '1';
      req.query = { limit: '0' };

      await taskController.getTasksByProject(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Limit must be between 1 and 100'
      });
    });

    test('should return 400 for invalid limit (greater than 100)', async () => {
      req.params.projectId = '1';
      req.query = { limit: '101' };

      await taskController.getTasksByProject(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Limit must be between 1 and 100'
      });
    });
  });

  describe('create - Deadline Notifications', () => {
    test('should send notification for task with today deadline', async () => {
      const projectTasksService = require('../../src/services/projectTasksService');

      req.body = {
        title: 'Test Task',
        deadline: '2025-10-15', // Fixed date for testing
        project_id: 1
      };

      const mockTask = {
        id: 1,
        title: 'Test Task',
        deadline: '2025-10-15',
        project_id: 1
      };

      taskService.createTask.mockResolvedValue(mockTask);

      // Mock Date to make 2025-10-15 be "today"
      const RealDate = Date;
      global.Date = class extends RealDate {
        constructor(...args) {
          if (args.length === 0) {
            super('2025-10-15T12:00:00Z');
          } else {
            super(...args);
          }
        }
        static now() {
          return new RealDate('2025-10-15T12:00:00Z').getTime();
        }
      };

      await taskController.create(req, res);

      expect(projectTasksService.sendDeadlineNotifications).toHaveBeenCalledWith(mockTask, 'today');
      expect(res.status).toHaveBeenCalledWith(201);

      global.Date = RealDate; // Restore
    });

    test('should send notification for task with tomorrow deadline', async () => {
      const projectTasksService = require('../../src/services/projectTasksService');

      req.body = {
        title: 'Test Task',
        deadline: '2025-10-16', // Tomorrow relative to mocked today
        project_id: 1
      };

      const mockTask = {
        id: 1,
        title: 'Test Task',
        deadline: '2025-10-16',
        project_id: 1
      };

      taskService.createTask.mockResolvedValue(mockTask);

      // Mock Date to make 2025-10-15 be "today" (so 2025-10-16 is tomorrow)
      const RealDate = Date;
      global.Date = class extends RealDate {
        constructor(...args) {
          if (args.length === 0) {
            super('2025-10-15T12:00:00Z');
          } else {
            super(...args);
          }
        }
        static now() {
          return new RealDate('2025-10-15T12:00:00Z').getTime();
        }
      };

      await taskController.create(req, res);

      expect(projectTasksService.sendDeadlineNotifications).toHaveBeenCalledWith(mockTask, 'tomorrow');
      expect(res.status).toHaveBeenCalledWith(201);

      global.Date = RealDate; // Restore
    });

    test('should not send notification for task with future deadline', async () => {
      const projectTasksService = require('../../src/services/projectTasksService');

      req.body = {
        title: 'Test Task',
        deadline: '2025-10-20', // 5 days in future
        project_id: 1
      };

      const mockTask = {
        id: 1,
        title: 'Test Task',
        deadline: '2025-10-20',
        project_id: 1
      };

      taskService.createTask.mockResolvedValue(mockTask);

      // Mock Date to make 2025-10-15 be "today"
      const RealDate = Date;
      global.Date = class extends RealDate {
        constructor(...args) {
          if (args.length === 0) {
            super('2025-10-15T12:00:00Z');
          } else {
            super(...args);
          }
        }
        static now() {
          return new RealDate('2025-10-15T12:00:00Z').getTime();
        }
      };

      await taskController.create(req, res);

      expect(projectTasksService.sendDeadlineNotifications).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);

      global.Date = RealDate; // Restore
    });
  });
});
