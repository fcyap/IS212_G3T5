const projectService = require('../../src/services/projectService');
const projectRepository = require('../../src/repository/projectRepository');

jest.mock('../../src/repository/projectRepository');

describe('ProjectService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createProject', () => {
    test('should create project successfully with valid data', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'Test Description',
        user_ids: [1, 2]
      };

      const mockProject = {
        id: 1,
        name: 'Test Project',
        description: 'Test Description',
        user_ids: [1, 2],
        created_at: expect.any(String)
      };

      projectRepository.create.mockResolvedValue(mockProject);

      const result = await projectService.createProject(projectData);

      expect(projectRepository.create).toHaveBeenCalledWith({
        name: 'Test Project',
        description: 'Test Description',
        user_ids: [1, 2],
        created_at: expect.any(String)
      });
      expect(result).toEqual({
        success: true,
        project: mockProject,
        message: 'Project created successfully'
      });
    });

    test('should handle missing required fields', async () => {
      const projectData = { name: 'Test Project' };

      const result = await projectService.createProject(projectData);

      expect(projectRepository.create).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: false,
        error: 'Missing required fields: name and description are required',
        message: 'Failed to create project'
      });
    });

    test('should handle invalid user_ids type', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'Test Description',
        user_ids: 'invalid'
      };

      const result = await projectService.createProject(projectData);

      expect(projectRepository.create).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: false,
        error: 'user_ids must be an array',
        message: 'Failed to create project'
      });
    });

    test('should handle repository error', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'Test Description'
      };

      projectRepository.create.mockRejectedValue(new Error('Database error'));

      const result = await projectService.createProject(projectData);

      expect(result).toEqual({
        success: false,
        error: 'Database error',
        message: 'Failed to create project'
      });
    });

    test('should trim whitespace from name and description', async () => {
      const projectData = {
        name: '  Test Project  ',
        description: '  Test Description  '
      };

      const mockProject = {
        id: 1,
        name: 'Test Project',
        description: 'Test Description',
        user_ids: [],
        created_at: expect.any(String)
      };

      projectRepository.create.mockResolvedValue(mockProject);

      const result = await projectService.createProject(projectData);

      expect(projectRepository.create).toHaveBeenCalledWith({
        name: 'Test Project',
        description: 'Test Description',
        user_ids: [],
        created_at: expect.any(String)
      });
      expect(result.success).toBe(true);
    });
  });

  describe('getAllProjects', () => {
    test('should get all projects successfully', async () => {
      const mockProjects = [
        { id: 1, name: 'Project 1' },
        { id: 2, name: 'Project 2' }
      ];

      projectRepository.findAll.mockResolvedValue(mockProjects);

      const result = await projectService.getAllProjects();

      expect(projectRepository.findAll).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        projects: mockProjects,
        count: 2,
        message: 'Projects retrieved successfully'
      });
    });

    test('should handle repository error', async () => {
      projectRepository.findAll.mockRejectedValue(new Error('Database error'));

      const result = await projectService.getAllProjects();

      expect(result).toEqual({
        success: false,
        error: 'Database error',
        message: 'Failed to retrieve projects'
      });
    });

    test('should handle empty projects array', async () => {
      projectRepository.findAll.mockResolvedValue([]);

      const result = await projectService.getAllProjects();

      expect(result).toEqual({
        success: true,
        projects: [],
        count: 0,
        message: 'Projects retrieved successfully'
      });
    });
  });

  describe('getProjectById', () => {
    test('should get project by id successfully', async () => {
      const mockProject = { id: 1, name: 'Test Project' };
      projectRepository.findById.mockResolvedValue(mockProject);

      const result = await projectService.getProjectById(1);

      expect(projectRepository.findById).toHaveBeenCalledWith(1);
      expect(result).toEqual({
        success: true,
        project: mockProject,
        message: 'Project retrieved successfully'
      });
    });

    test('should handle missing project id', async () => {
      const result = await projectService.getProjectById();

      expect(projectRepository.findById).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: false,
        error: 'Project ID is required',
        message: 'Failed to retrieve project'
      });
    });

    test('should handle project not found', async () => {
      projectRepository.findById.mockResolvedValue(null);

      const result = await projectService.getProjectById(999);

      expect(result).toEqual({
        success: false,
        error: 'Project not found',
        message: 'Failed to retrieve project'
      });
    });

    test('should handle repository error', async () => {
      projectRepository.findById.mockRejectedValue(new Error('Database error'));

      const result = await projectService.getProjectById(1);

      expect(result).toEqual({
        success: false,
        error: 'Database error',
        message: 'Failed to retrieve project'
      });
    });
  });

  describe('updateProject', () => {
    test('should update project successfully', async () => {
      const updateData = { name: 'Updated Project' };
      const mockProject = { id: 1, name: 'Updated Project' };

      projectRepository.update.mockResolvedValue(mockProject);

      const result = await projectService.updateProject(1, updateData);

      expect(projectRepository.update).toHaveBeenCalledWith(1, updateData);
      expect(result).toEqual({
        success: true,
        project: mockProject,
        message: 'Project updated successfully'
      });
    });

    test('should handle missing project id', async () => {
      const result = await projectService.updateProject();

      expect(projectRepository.update).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: false,
        error: 'Project ID is required',
        message: 'Failed to update project'
      });
    });

    test('should filter out undefined values', async () => {
      const updateData = {
        name: 'Updated Project',
        description: undefined,
        user_ids: [1, 2]
      };
      const filteredData = {
        name: 'Updated Project',
        user_ids: [1, 2]
      };
      const mockProject = { id: 1, name: 'Updated Project' };

      projectRepository.update.mockResolvedValue(mockProject);

      const result = await projectService.updateProject(1, updateData);

      expect(projectRepository.update).toHaveBeenCalledWith(1, filteredData);
      expect(result.success).toBe(true);
    });

    test('should validate user_ids array format', async () => {
      const updateData = { user_ids: 'invalid' };

      const result = await projectService.updateProject(1, updateData);

      expect(projectRepository.update).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: false,
        error: 'user_ids must be an array',
        message: 'Failed to update project'
      });
    });

    test('should handle project not found', async () => {
      const updateData = { name: 'Updated Project' };
      projectRepository.update.mockResolvedValue(null);

      const result = await projectService.updateProject(999, updateData);

      expect(result).toEqual({
        success: false,
        error: 'Project not found',
        message: 'Failed to update project'
      });
    });

    test('should handle repository error', async () => {
      const updateData = { name: 'Updated Project' };
      projectRepository.update.mockRejectedValue(new Error('Database error'));

      const result = await projectService.updateProject(1, updateData);

      expect(result).toEqual({
        success: false,
        error: 'Database error',
        message: 'Failed to update project'
      });
    });
  });

  describe('deleteProject', () => {
    test('should delete project successfully', async () => {
      projectRepository.delete.mockResolvedValue(true);

      const result = await projectService.deleteProject(1);

      expect(projectRepository.delete).toHaveBeenCalledWith(1);
      expect(result).toEqual({
        success: true,
        message: 'Project deleted successfully'
      });
    });

    test('should handle missing project id', async () => {
      const result = await projectService.deleteProject();

      expect(projectRepository.delete).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: false,
        error: 'Project ID is required',
        message: 'Failed to delete project'
      });
    });

    test('should handle repository error', async () => {
      projectRepository.delete.mockRejectedValue(new Error('Database error'));

      const result = await projectService.deleteProject(1);

      expect(result).toEqual({
        success: false,
        error: 'Database error',
        message: 'Failed to delete project'
      });
    });
  });

  describe('addUserToProject', () => {
    test('should add user to project successfully', async () => {
      const mockProject = { id: 1, user_ids: [1] };
      const updatedProject = { id: 1, user_ids: [1, 2] };

      // Mock getProjectById to return existing project
      jest.spyOn(projectService, 'getProjectById').mockResolvedValueOnce({
        success: true,
        project: mockProject
      });

      // Mock updateProject to return updated project
      jest.spyOn(projectService, 'updateProject').mockResolvedValueOnce({
        success: true,
        project: updatedProject,
        message: 'Project updated successfully'
      });

      const result = await projectService.addUserToProject(1, 2);

      expect(projectService.getProjectById).toHaveBeenCalledWith(1);
      expect(projectService.updateProject).toHaveBeenCalledWith(1, { user_ids: [1, 2] });
      expect(result).toEqual({
        success: true,
        project: updatedProject,
        message: 'Project updated successfully'
      });
    });

    test('should handle missing project id or user id', async () => {
      const result = await projectService.addUserToProject();

      expect(result).toEqual({
        success: false,
        error: 'Project ID and User ID are required',
        message: 'Failed to add user to project'
      });
    });

    test('should handle project not found', async () => {
      jest.spyOn(projectService, 'getProjectById').mockResolvedValueOnce({
        success: false,
        error: 'Project not found'
      });

      const result = await projectService.addUserToProject(999, 2);

      expect(result).toEqual({
        success: false,
        error: 'Project not found'
      });
    });

    test('should handle user already in project', async () => {
      const mockProject = { id: 1, user_ids: [1, 2] };

      jest.spyOn(projectService, 'getProjectById').mockResolvedValueOnce({
        success: true,
        project: mockProject
      });

      const result = await projectService.addUserToProject(1, 2);

      expect(result).toEqual({
        success: false,
        error: 'User is already in the project',
        message: 'User already exists in project'
      });
    });

    test('should handle project with no existing users', async () => {
      const mockProject = { id: 1, user_ids: null };
      const updatedProject = { id: 1, user_ids: [2] };

      jest.spyOn(projectService, 'getProjectById').mockResolvedValueOnce({
        success: true,
        project: mockProject
      });

      jest.spyOn(projectService, 'updateProject').mockResolvedValueOnce({
        success: true,
        project: updatedProject,
        message: 'Project updated successfully'
      });

      const result = await projectService.addUserToProject(1, 2);

      expect(projectService.updateProject).toHaveBeenCalledWith(1, { user_ids: [2] });
      expect(result.success).toBe(true);
    });

    test('should handle unexpected error', async () => {
      jest.spyOn(projectService, 'getProjectById').mockRejectedValueOnce(new Error('Unexpected error'));

      const result = await projectService.addUserToProject(1, 2);

      expect(result).toEqual({
        success: false,
        error: 'Unexpected error',
        message: 'Failed to add user to project'
      });
    });
  });

  describe('removeUserFromProject', () => {
    test('should remove user from project successfully', async () => {
      const mockProject = { id: 1, user_ids: [1, 2, 3] };
      const updatedProject = { id: 1, user_ids: [1, 3] };

      jest.spyOn(projectService, 'getProjectById').mockResolvedValueOnce({
        success: true,
        project: mockProject
      });

      jest.spyOn(projectService, 'updateProject').mockResolvedValueOnce({
        success: true,
        project: updatedProject,
        message: 'Project updated successfully'
      });

      const result = await projectService.removeUserFromProject(1, 2);

      expect(projectService.getProjectById).toHaveBeenCalledWith(1);
      expect(projectService.updateProject).toHaveBeenCalledWith(1, { user_ids: [1, 3] });
      expect(result).toEqual({
        success: true,
        project: updatedProject,
        message: 'Project updated successfully'
      });
    });

    test('should handle missing project id or user id', async () => {
      const result = await projectService.removeUserFromProject();

      expect(result).toEqual({
        success: false,
        error: 'Project ID and User ID are required',
        message: 'Failed to remove user from project'
      });
    });

    test('should handle project not found', async () => {
      jest.spyOn(projectService, 'getProjectById').mockResolvedValueOnce({
        success: false,
        error: 'Project not found'
      });

      const result = await projectService.removeUserFromProject(999, 2);

      expect(result).toEqual({
        success: false,
        error: 'Project not found'
      });
    });

    test('should handle user not in project', async () => {
      const mockProject = { id: 1, user_ids: [1, 3] };

      jest.spyOn(projectService, 'getProjectById').mockResolvedValueOnce({
        success: true,
        project: mockProject
      });

      const result = await projectService.removeUserFromProject(1, 2);

      expect(result).toEqual({
        success: false,
        error: 'User is not in the project',
        message: 'User not found in project'
      });
    });

    test('should handle project with no existing users', async () => {
      const mockProject = { id: 1, user_ids: null };

      jest.spyOn(projectService, 'getProjectById').mockResolvedValueOnce({
        success: true,
        project: mockProject
      });

      const result = await projectService.removeUserFromProject(1, 2);

      expect(result).toEqual({
        success: false,
        error: 'User is not in the project',
        message: 'User not found in project'
      });
    });

    test('should handle unexpected error', async () => {
      jest.spyOn(projectService, 'getProjectById').mockRejectedValueOnce(new Error('Unexpected error'));

      const result = await projectService.removeUserFromProject(1, 2);

      expect(result).toEqual({
        success: false,
        error: 'Unexpected error',
        message: 'Failed to remove user from project'
      });
    });
  });
});