const projectTasksController = require('../../src/controllers/projectTasksController');
const projectTasksService = require('../../src/services/projectTasksService');

jest.mock('../../src/services/projectTasksService');

describe('ProjectTasksController', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();
  });

  describe('getProjectTasks', () => {
    test('should get project tasks successfully', async () => {
      req.params.projectId = '1';
      req.query = {
        status: 'active',
        assignedTo: '123',
        priority: 'high',
        page: '1',
        limit: '10',
        sortBy: 'created_at',
        sortOrder: 'desc'
      };

      const mockResult = {
        success: true,
        tasks: [{ id: 1, name: 'Task 1' }],
        message: 'Tasks retrieved successfully'
      };
      projectTasksService.getProjectTasks.mockResolvedValue(mockResult);

      await projectTasksController.getProjectTasks(req, res);

      expect(projectTasksService.getProjectTasks).toHaveBeenCalledWith('1', {
        filters: {
          status: 'active',
          assigned_to: '123',
          priority: 'high'
        },
        pagination: {
          page: '1',
          limit: '10'
        },
        sorting: {
          sortBy: 'created_at',
          sortOrder: 'desc'
        }
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    test('should handle missing project id', async () => {
      req.params = {};

      await projectTasksController.getProjectTasks(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing project ID',
        message: 'Project ID is required'
      });
    });

    test('should handle project not found', async () => {
      req.params.projectId = '999';
      const mockResult = {
        success: false,
        error: 'Project not found',
        message: 'Failed to retrieve tasks'
      };
      projectTasksService.getProjectTasks.mockResolvedValue(mockResult);

      await projectTasksController.getProjectTasks(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    test('should handle service error', async () => {
      req.params.projectId = '1';
      const mockResult = {
        success: false,
        error: 'Database error',
        message: 'Failed to retrieve tasks'
      };
      projectTasksService.getProjectTasks.mockResolvedValue(mockResult);

      await projectTasksController.getProjectTasks(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    test('should handle unexpected error', async () => {
      req.params.projectId = '1';
      projectTasksService.getProjectTasks.mockRejectedValue(new Error('Unexpected error'));

      await projectTasksController.getProjectTasks(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    });
  });

  describe('createTask', () => {
    test('should create project task successfully', async () => {
      req.params.projectId = '1';
      req.body = {
        name: 'New Task',
        description: 'Task description',
        status: 'active',
        priority: 'high',
        assigned_to: 123,
        due_date: '2023-12-31'
      };

      const mockResult = {
        success: true,
        task: { id: 1, ...req.body },
        message: 'Task created successfully'
      };
      projectTasksService.createTask.mockResolvedValue(mockResult);

      await projectTasksController.createTask(req, res);

      expect(projectTasksService.createTask).toHaveBeenCalledWith('1', req.body, null);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    test('should include creator id from request user when creating', async () => {
      req.params.projectId = '2';
      req.user = { id: 77 };
      req.body = { name: 'Task', assigned_to: [] };

      const mockResult = { success: true, task: { id: 9, name: 'Task' } };
      projectTasksService.createTask.mockResolvedValue(mockResult);

      await projectTasksController.createTask(req, res);

      expect(projectTasksService.createTask).toHaveBeenCalledWith('2', expect.objectContaining({ name: 'Task', assigned_to: [] }), 77);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    test('should handle missing project id', async () => {
      req.params = {};
      req.body = { name: 'New Task' };

      await projectTasksController.createTask(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing project ID',
        message: 'Project ID is required'
      });
    });

    test('should handle project not found', async () => {
      req.params.projectId = '999';
      req.body = {
        name: 'New Task',
        description: 'Task description'
      };

      const mockResult = {
        success: false,
        error: 'Project not found',
        message: 'Failed to create task'
      };
      projectTasksService.createTask.mockResolvedValue(mockResult);

      await projectTasksController.createTask(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    test('should handle service error', async () => {
      req.params.projectId = '1';
      req.body = {
        name: 'New Task',
        description: 'Task description'
      };

      const mockResult = {
        success: false,
        error: 'Database error',
        message: 'Failed to create task'
      };
      projectTasksService.createTask.mockResolvedValue(mockResult);

      await projectTasksController.createTask(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    test('should handle unexpected error', async () => {
      req.params.projectId = '1';
      req.body = {
        name: 'New Task',
        description: 'Task description'
      };

      projectTasksService.createTask.mockRejectedValue(new Error('Unexpected error'));

      await projectTasksController.createTask(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    });
  });

  describe('getTaskById', () => {
    test('should get task by id successfully', async () => {
      req.params = { projectId: '1', taskId: '123' };
      const mockResult = {
        success: true,
        task: { id: 123, name: 'Task 1' },
        message: 'Task retrieved successfully'
      };
      projectTasksService.getTaskById.mockResolvedValue(mockResult);

      await projectTasksController.getTaskById(req, res);

      expect(projectTasksService.getTaskById).toHaveBeenCalledWith('1', '123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    test('should handle missing project id', async () => {
      req.params = { taskId: '123' };

      await projectTasksController.getTaskById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing required parameters',
        message: 'Project ID and Task ID are required'
      });
    });

    test('should handle missing task id', async () => {
      req.params = { projectId: '1' };

      await projectTasksController.getTaskById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing required parameters',
        message: 'Project ID and Task ID are required'
      });
    });

    test('should handle task not found', async () => {
      req.params = { projectId: '1', taskId: '999' };
      const mockResult = {
        success: false,
        error: 'Task not found',
        message: 'Failed to retrieve task'
      };
      projectTasksService.getTaskById.mockResolvedValue(mockResult);

      await projectTasksController.getTaskById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    test('should handle unexpected error', async () => {
      req.params = { projectId: '1', taskId: '123' };
      projectTasksService.getTaskById.mockRejectedValue(new Error('Unexpected error'));

      await projectTasksController.getTaskById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    });
  });

  describe('updateTask', () => {
    test('should update task successfully', async () => {
      req.params.taskId = '123';
      req.body = { name: 'Updated Task' };
      const mockResult = {
        success: true,
        task: { id: 123, name: 'Updated Task' },
        message: 'Task updated successfully'
      };
      projectTasksService.updateTask.mockResolvedValue(mockResult);

      await projectTasksController.updateTask(req, res);

      expect(projectTasksService.updateTask).toHaveBeenCalledWith('123', req.body, null);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    test('should handle missing task id', async () => {
      req.params = {};
      req.body = { name: 'Updated Task' };

      await projectTasksController.updateTask(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing task ID',
        message: 'Task ID is required'
      });
    });

    test('should handle task not found', async () => {
      req.params.taskId = '999';
      req.body = { name: 'Updated Task' };
      const mockResult = {
        success: false,
        error: 'Task not found',
        message: 'Failed to update task'
      };
      projectTasksService.updateTask.mockResolvedValue(mockResult);

      await projectTasksController.updateTask(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    test('should handle unexpected error', async () => {
      req.params.taskId = '123';
      req.body = { name: 'Updated Task' };
      projectTasksService.updateTask.mockRejectedValue(new Error('Unexpected error'));

      await projectTasksController.updateTask(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    });
  });

  describe('deleteTask', () => {
    test('should delete task successfully', async () => {
      req.params.taskId = '123';
      const mockResult = {
        success: true,
        message: 'Task deleted successfully'
      };
      projectTasksService.deleteTask.mockResolvedValue(mockResult);

      await projectTasksController.deleteTask(req, res);

      expect(projectTasksService.deleteTask).toHaveBeenCalledWith('123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    test('should handle missing task id', async () => {
      req.params = {};

      await projectTasksController.deleteTask(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing task ID',
        message: 'Task ID is required'
      });
    });

    test('should handle service error', async () => {
      req.params.taskId = '123';
      const mockResult = {
        success: false,
        error: 'Database error',
        message: 'Failed to delete task'
      };
      projectTasksService.deleteTask.mockResolvedValue(mockResult);

      await projectTasksController.deleteTask(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    test('should handle unexpected error', async () => {
      req.params.taskId = '123';
      projectTasksService.deleteTask.mockRejectedValue(new Error('Unexpected error'));

      await projectTasksController.deleteTask(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    });
  });

  describe('getTaskStats', () => {
    test('should get task statistics successfully', async () => {
      req.params.projectId = '1';
      const mockResult = {
        success: true,
        stats: {
          total: 10,
          active: 5,
          completed: 3,
          pending: 2
        },
        message: 'Task statistics retrieved successfully'
      };
      projectTasksService.getTaskStats.mockResolvedValue(mockResult);

      await projectTasksController.getTaskStats(req, res);

      expect(projectTasksService.getTaskStats).toHaveBeenCalledWith('1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    test('should handle missing project id', async () => {
      req.params = {};

      await projectTasksController.getTaskStats(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing project ID',
        message: 'Project ID is required'
      });
    });

    test('should handle project not found', async () => {
      req.params.projectId = '999';
      const mockResult = {
        success: false,
        error: 'Project not found',
        message: 'Failed to retrieve task statistics'
      };
      projectTasksService.getTaskStats.mockResolvedValue(mockResult);

      await projectTasksController.getTaskStats(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    test('should handle unexpected error', async () => {
      req.params.projectId = '1';
      projectTasksService.getTaskStats.mockRejectedValue(new Error('Unexpected error'));

      await projectTasksController.getTaskStats(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    });
  });

  describe('getAllTasks', () => {
    test('should get all tasks successfully', async () => {
      req.query = {
        page: '1',
        limit: '10',
        sortBy: 'created_at',
        sortOrder: 'desc'
      };

      const mockResult = {
        success: true,
        tasks: [{ id: 1, name: 'Task 1' }],
        message: 'Tasks retrieved successfully'
      };
      projectTasksService.getAllTasks.mockResolvedValue(mockResult);

      await projectTasksController.getAllTasks(req, res);

      expect(projectTasksService.getAllTasks).toHaveBeenCalledWith({
        filters: {
          status: undefined,
          project_id: undefined,
          assigned_to: undefined,
          priority: undefined
        },
        pagination: {
          page: '1',
          limit: '10'
        },
        sorting: {
          sortBy: 'created_at',
          sortOrder: 'desc'
        }
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    test('should handle service error', async () => {
      const mockResult = {
        success: false,
        error: 'Database error',
        message: 'Failed to retrieve tasks'
      };
      projectTasksService.getAllTasks.mockResolvedValue(mockResult);

      await projectTasksController.getAllTasks(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    test('should handle unexpected error', async () => {
      projectTasksService.getAllTasks.mockRejectedValue(new Error('Unexpected error'));

      await projectTasksController.getAllTasks(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    });
  });
});
