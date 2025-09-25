const projectController = require('../../src/controllers/projectController');
const projectService = require('../../src/services/projectService');

jest.mock('../../src/services/projectService');

describe('ProjectController', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      params: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();
  });

  describe('createProject', () => {
    test('should create project successfully with valid data', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'Test Description',
        user_ids: [1, 2]
      };
      req.body = projectData;

      const mockResult = {
        success: true,
        project: { id: 1, ...projectData },
        message: 'Project created successfully'
      };
      projectService.createProject.mockResolvedValue(mockResult);

      await projectController.createProject(req, res);

      expect(projectService.createProject).toHaveBeenCalledWith({
        name: 'Test Project',
        description: 'Test Description',
        user_ids: [1, 2]
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    test('should handle missing required fields', async () => {
      req.body = { name: 'Test Project' };

      await projectController.createProject(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing required fields',
        message: 'Name and description are required'
      });
    });

    test('should handle invalid user_ids format', async () => {
      req.body = {
        name: 'Test Project',
        description: 'Test Description',
        user_ids: 'invalid'
      };

      await projectController.createProject(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid user_ids format',
        message: 'user_ids must be an array of integers'
      });
    });

    test('should handle service error', async () => {
      req.body = {
        name: 'Test Project',
        description: 'Test Description'
      };

      const mockResult = {
        success: false,
        error: 'Database error',
        message: 'Failed to create project'
      };
      projectService.createProject.mockResolvedValue(mockResult);

      await projectController.createProject(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    test('should handle unexpected error', async () => {
      req.body = {
        name: 'Test Project',
        description: 'Test Description'
      };

      projectService.createProject.mockRejectedValue(new Error('Unexpected error'));

      await projectController.createProject(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    });
  });

  describe('getAllProjects', () => {
    test('should get all projects successfully', async () => {
      const mockResult = {
        success: true,
        projects: [{ id: 1, name: 'Project 1' }],
        count: 1,
        message: 'Projects retrieved successfully'
      };
      projectService.getAllProjects.mockResolvedValue(mockResult);

      await projectController.getAllProjects(req, res);

      expect(projectService.getAllProjects).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    test('should handle service error', async () => {
      const mockResult = {
        success: false,
        error: 'Database error',
        message: 'Failed to retrieve projects'
      };
      projectService.getAllProjects.mockResolvedValue(mockResult);

      await projectController.getAllProjects(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    test('should handle unexpected error', async () => {
      projectService.getAllProjects.mockRejectedValue(new Error('Unexpected error'));

      await projectController.getAllProjects(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    });
  });

  describe('getProjectById', () => {
    test('should get project by id successfully', async () => {
      req.params.id = '1';
      const mockResult = {
        success: true,
        project: { id: 1, name: 'Project 1' },
        message: 'Project retrieved successfully'
      };
      projectService.getProjectById.mockResolvedValue(mockResult);

      await projectController.getProjectById(req, res);

      expect(projectService.getProjectById).toHaveBeenCalledWith('1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    test('should handle missing project id', async () => {
      req.params = {};

      await projectController.getProjectById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing project ID',
        message: 'Project ID is required'
      });
    });

    test('should handle project not found', async () => {
      req.params.id = '999';
      const mockResult = {
        success: false,
        error: 'Project not found',
        message: 'Failed to retrieve project'
      };
      projectService.getProjectById.mockResolvedValue(mockResult);

      await projectController.getProjectById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    test('should handle unexpected error', async () => {
      req.params.id = '1';
      projectService.getProjectById.mockRejectedValue(new Error('Unexpected error'));

      await projectController.getProjectById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    });
  });

  describe('updateProject', () => {
    test('should update project successfully', async () => {
      req.params.id = '1';
      req.body = { name: 'Updated Project' };
      const mockResult = {
        success: true,
        project: { id: 1, name: 'Updated Project' },
        message: 'Project updated successfully'
      };
      projectService.updateProject.mockResolvedValue(mockResult);

      await projectController.updateProject(req, res);

      expect(projectService.updateProject).toHaveBeenCalledWith('1', { name: 'Updated Project' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    test('should handle missing project id', async () => {
      req.params = {};
      req.body = { name: 'Updated Project' };

      await projectController.updateProject(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing project ID',
        message: 'Project ID is required'
      });
    });

    test('should handle project not found', async () => {
      req.params.id = '999';
      req.body = { name: 'Updated Project' };
      const mockResult = {
        success: false,
        error: 'Project not found',
        message: 'Failed to update project'
      };
      projectService.updateProject.mockResolvedValue(mockResult);

      await projectController.updateProject(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    test('should handle unexpected error', async () => {
      req.params.id = '1';
      req.body = { name: 'Updated Project' };
      projectService.updateProject.mockRejectedValue(new Error('Unexpected error'));

      await projectController.updateProject(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    });
  });

  describe('deleteProject', () => {
    test('should delete project successfully', async () => {
      req.params.id = '1';
      const mockResult = {
        success: true,
        message: 'Project deleted successfully'
      };
      projectService.deleteProject.mockResolvedValue(mockResult);

      await projectController.deleteProject(req, res);

      expect(projectService.deleteProject).toHaveBeenCalledWith('1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    test('should handle missing project id', async () => {
      req.params = {};

      await projectController.deleteProject(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing project ID',
        message: 'Project ID is required'
      });
    });

    test('should handle service error', async () => {
      req.params.id = '1';
      const mockResult = {
        success: false,
        error: 'Database error',
        message: 'Failed to delete project'
      };
      projectService.deleteProject.mockResolvedValue(mockResult);

      await projectController.deleteProject(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    test('should handle unexpected error', async () => {
      req.params.id = '1';
      projectService.deleteProject.mockRejectedValue(new Error('Unexpected error'));

      await projectController.deleteProject(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    });
  });

  describe('addUserToProject', () => {
    test('should add user to project successfully', async () => {
      req.params.id = '1';
      req.body = { userId: 123 };
      const mockResult = {
        success: true,
        project: { id: 1, user_ids: [123] },
        message: 'Project updated successfully'
      };
      projectService.addUserToProject.mockResolvedValue(mockResult);

      await projectController.addUserToProject(req, res);

      expect(projectService.addUserToProject).toHaveBeenCalledWith('1', 123);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    test('should handle missing project id', async () => {
      req.params = {};
      req.body = { userId: 123 };

      await projectController.addUserToProject(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing required fields',
        message: 'Project ID and user ID are required'
      });
    });

    test('should handle missing user id', async () => {
      req.params.id = '1';
      req.body = {};

      await projectController.addUserToProject(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing required fields',
        message: 'Project ID and user ID are required'
      });
    });

    test('should handle invalid user id', async () => {
      req.params.id = '1';
      req.body = { userId: 'invalid' };

      await projectController.addUserToProject(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid user ID',
        message: 'User ID must be a valid integer'
      });
    });

    test('should handle project not found', async () => {
      req.params.id = '999';
      req.body = { userId: 123 };
      const mockResult = {
        success: false,
        error: 'Project not found',
        message: 'Failed to add user to project'
      };
      projectService.addUserToProject.mockResolvedValue(mockResult);

      await projectController.addUserToProject(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    test('should handle unexpected error', async () => {
      req.params.id = '1';
      req.body = { userId: 123 };
      projectService.addUserToProject.mockRejectedValue(new Error('Unexpected error'));

      await projectController.addUserToProject(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    });
  });

  describe('removeUserFromProject', () => {
    test('should remove user from project successfully', async () => {
      req.params.id = '1';
      req.body = { userId: 123 };
      const mockResult = {
        success: true,
        project: { id: 1, user_ids: [] },
        message: 'Project updated successfully'
      };
      projectService.removeUserFromProject.mockResolvedValue(mockResult);

      await projectController.removeUserFromProject(req, res);

      expect(projectService.removeUserFromProject).toHaveBeenCalledWith('1', 123);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    test('should handle missing project id', async () => {
      req.params = {};
      req.body = { userId: 123 };

      await projectController.removeUserFromProject(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing required fields',
        message: 'Project ID and user ID are required'
      });
    });

    test('should handle missing user id', async () => {
      req.params.id = '1';
      req.body = {};

      await projectController.removeUserFromProject(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing required fields',
        message: 'Project ID and user ID are required'
      });
    });

    test('should handle invalid user id', async () => {
      req.params.id = '1';
      req.body = { userId: 'invalid' };

      await projectController.removeUserFromProject(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid user ID',
        message: 'User ID must be a valid integer'
      });
    });

    test('should handle project not found', async () => {
      req.params.id = '999';
      req.body = { userId: 123 };
      const mockResult = {
        success: false,
        error: 'Project not found',
        message: 'Failed to remove user from project'
      };
      projectService.removeUserFromProject.mockResolvedValue(mockResult);

      await projectController.removeUserFromProject(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    test('should handle unexpected error', async () => {
      req.params.id = '1';
      req.body = { userId: 123 };
      projectService.removeUserFromProject.mockRejectedValue(new Error('Unexpected error'));

      await projectController.removeUserFromProject(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    });
  });
});