const taskController = require('../../src/controllers/taskController');
const taskService = require('../../src/services/taskService');

jest.mock('../../src/services/taskService');

describe('TaskController', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
      user: { id: 1, role: 'admin', hierarchy: 1, division: 'Engineering' }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: {
        session: { user_id: 1, role: 'admin', hierarchy: 1, division: 'Engineering' }
      }
    };
    jest.clearAllMocks();
  });

  describe('list', () => {
    test('should get all tasks successfully', async () => {
      const mockTasks = [
        { id: 1, title: 'Task 1', status: 'pending' },
        { id: 2, title: 'Task 2', status: 'completed' }
      ];

      taskService.listWithAssignees = jest.fn().mockResolvedValue(mockTasks);

      await taskController.list(req, res);

      expect(taskService.listWithAssignees).toHaveBeenCalledWith({
        archived: false,
        parentId: undefined,
        userId: 1,
        userRole: 'admin',
        userHierarchy: 1,
        userDivision: 'Engineering'
      });
      expect(res.json).toHaveBeenCalledWith(mockTasks);
    });

    test('should handle archived parameter', async () => {
      req.query.archived = 'true';
      const mockTasks = [
        { id: 1, title: 'Archived Task', status: 'completed', archived: true }
      ];

      taskService.listWithAssignees = jest.fn().mockResolvedValue(mockTasks);

      await taskController.list(req, res);

      expect(taskService.listWithAssignees).toHaveBeenCalledWith({
        archived: true,
        parentId: undefined,
        userId: 1,
        userRole: 'admin',
        userHierarchy: 1,
        userDivision: 'Engineering'
      });
      expect(res.json).toHaveBeenCalledWith(mockTasks);
    });

    test('should fallback to getAllTasks if listWithAssignees not available', async () => {
      const mockTasks = [
        { id: 1, title: 'Task 1', status: 'pending' }
      ];

      taskService.listWithAssignees = undefined;
      taskService.getAllTasks = jest.fn().mockResolvedValue(mockTasks);

      await taskController.list(req, res);

      expect(taskService.getAllTasks).toHaveBeenCalledWith({
        archived: false,
        parentId: undefined,
        userId: 1,
        userRole: 'admin',
        userHierarchy: 1,
        userDivision: 'Engineering'
      });
      expect(res.json).toHaveBeenCalledWith(mockTasks);
    });

    test('should handle service error', async () => {
      const error = new Error('Database error');
      error.status = 500;
      taskService.listWithAssignees = jest.fn().mockRejectedValue(error);

      await taskController.list(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Database error'
      });
    });

    test('should handle service error without status', async () => {
      const error = new Error('Unknown error');
      taskService.listWithAssignees = jest.fn().mockRejectedValue(error);

      await taskController.list(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unknown error'
      });
    });
  });

  describe('create', () => {
    test('should create task successfully', async () => {
      req.body = {
        title: 'New Task',
        description: 'Task description',
        status: 'pending'
      };

      const mockCreatedTask = {
        id: 1,
        title: 'New Task',
        description: 'Task description',
        status: 'pending'
      };

      taskService.createTask.mockResolvedValue(mockCreatedTask);

      await taskController.create(req, res);

      expect(taskService.createTask).toHaveBeenCalledWith(expect.objectContaining(req.body), 1);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockCreatedTask);
    });

    test('should attach creator from request user', async () => {
      req.user = { id: 42 };
      req.body = { title: 'Creator Task' };

      const mockCreatedTask = { id: 1, title: 'Creator Task' };
      taskService.createTask.mockResolvedValue(mockCreatedTask);

      await taskController.create(req, res);

      expect(taskService.createTask).toHaveBeenCalledWith(expect.objectContaining({ title: 'Creator Task' }), 42);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockCreatedTask);
    });

    test('should handle service error', async () => {
      req.body = {
        title: 'New Task',
        description: 'Task description'
      };

      const error = new Error('Validation failed');
      error.status = 400;
      taskService.createTask.mockRejectedValue(error);

      await taskController.create(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Validation failed'
      });
    });

    test('should handle service error without status', async () => {
      req.body = {
        title: 'New Task'
      };

      const error = new Error('Unknown error');
      taskService.createTask.mockRejectedValue(error);

      await taskController.create(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unknown error'
      });
    });
  });

  describe('update', () => {
    test('should update task successfully', async () => {
      req.params.id = '1';
      req.body = {
        title: 'Updated Task',
        status: 'completed'
      };

      const mockUpdatedTask = {
        id: 1,
        title: 'Updated Task',
        status: 'completed'
      };

      taskService.updateTask.mockResolvedValue(mockUpdatedTask);

      await taskController.update(req, res);

      expect(taskService.updateTask).toHaveBeenCalledWith(1, req.body, 1);
      expect(res.json).toHaveBeenCalledWith(mockUpdatedTask);
    });

    test('should handle invalid task id', async () => {
      req.params.id = 'invalid';
      req.body = { title: 'Updated Task' };

      await taskController.update(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid id'
      });
    });

    test('should handle non-numeric task id', async () => {
      req.params.id = 'abc';
      req.body = { title: 'Updated Task' };

      await taskController.update(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid id'
      });
    });

    test('should handle service error', async () => {
      req.params.id = '1';
      req.body = { title: 'Updated Task' };

      const error = new Error('Task not found');
      error.status = 404;
      taskService.updateTask.mockRejectedValue(error);

      await taskController.update(req, res);

      expect(taskService.updateTask).toHaveBeenCalledWith(1, req.body, 1);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Task not found'
      });
    });

    test('should handle service error without status', async () => {
      req.params.id = '1';
      req.body = { title: 'Updated Task' };

      const error = new Error('Database error');
      taskService.updateTask.mockRejectedValue(error);

      await taskController.update(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Database error'
      });
    });
  });
});
