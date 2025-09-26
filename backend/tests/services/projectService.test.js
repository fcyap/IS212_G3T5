const projectService = require('../../src/services/projectService');
const projectRepository = require('../../src/repository/projectRepository');
const userRepository = require('../../src/repository/userRepository');
const supabase = require('../../src/utils/supabase');

jest.mock('../../src/repository/projectRepository');
jest.mock('../../src/repository/userRepository');
jest.mock('../../src/utils/supabase');

describe('ProjectService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createProject', () => {
    test('should create project successfully with valid data', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'Test Description',
        user_ids: [1, 2],
        creator_id: 1
      };

      const mockProject = {
        id: 1,
        name: 'Test Project',
        description: 'Test Description',
        creator_id: 1,
        status: 'active',
        updated_at: expect.any(String)
      };

      projectRepository.create.mockResolvedValue(mockProject);
      projectRepository.addUserToProject.mockResolvedValue(true);

      const result = await projectService.createProject(projectData);

      expect(projectRepository.create).toHaveBeenCalledWith({
        name: 'Test Project',
        description: 'Test Description',
        creator_id: 1,
        status: 'active',
        updated_at: expect.any(String)
      });

      expect(projectRepository.addUserToProject).toHaveBeenCalledTimes(2);
      expect(projectRepository.addUserToProject).toHaveBeenCalledWith(1, 1, 'creator');
      expect(projectRepository.addUserToProject).toHaveBeenCalledWith(1, 2, 'collaborator');

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

    test('should handle missing creator_id', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'Test Description'
      };

      const result = await projectService.createProject(projectData);

      expect(result).toEqual({
        success: false,
        error: 'creator_id is required',
        message: 'Failed to create project'
      });
    });

    test('should handle invalid user_ids type', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'Test Description',
        user_ids: 'invalid',
        creator_id: 1
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
        description: 'Test Description',
        creator_id: 1
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
        description: '  Test Description  ',
        creator_id: 1
      };

      const mockProject = { id: 1, name: 'Test Project', description: 'Test Description' };
      projectRepository.create.mockResolvedValue(mockProject);
      projectRepository.addUserToProject.mockResolvedValue(true);

      await projectService.createProject(projectData);

      expect(projectRepository.create).toHaveBeenCalledWith({
        name: 'Test Project',
        description: 'Test Description',
        creator_id: 1,
        status: 'active',
        updated_at: expect.any(String)
      });
    });

    test('should handle empty user_ids array', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'Test Description',
        creator_id: 1,
        user_ids: []
      };

      const mockProject = { id: 1, name: 'Test Project', description: 'Test Description' };
      projectRepository.create.mockResolvedValue(mockProject);
      projectRepository.addUserToProject.mockResolvedValue(true);

      const result = await projectService.createProject(projectData);

      expect(projectRepository.addUserToProject).toHaveBeenCalledTimes(1); // Only creator
      expect(result.success).toBe(true);
    });
  });

  describe('getAllProjectsForUser', () => {
    test('should get all projects for user successfully', async () => {
      const mockProjects = [
        { id: 1, name: 'Project 1', role: 'creator' },
        { id: 2, name: 'Project 2', role: 'collaborator' }
      ];

      projectRepository.getProjectsForUser.mockResolvedValue(mockProjects);

      const result = await projectService.getAllProjectsForUser(1);

      expect(projectRepository.getProjectsForUser).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockProjects);
    });

    test('should handle repository error', async () => {
      projectRepository.getProjectsForUser.mockRejectedValue(new Error('Database error'));

      await expect(projectService.getAllProjectsForUser(1)).rejects.toThrow('Database error');
    });

    test('should return empty array for user with no projects', async () => {
      projectRepository.getProjectsForUser.mockResolvedValue([]);

      const result = await projectService.getAllProjectsForUser(1);

      expect(result).toEqual([]);
    });
  });

  describe('getProjectById', () => {
    test('should get project by id successfully', async () => {
      const mockProject = { id: 1, name: 'Test Project' };
      projectRepository.getProjectById.mockResolvedValue(mockProject);

      const result = await projectService.getProjectById(1);

      expect(projectRepository.getProjectById).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockProject);
    });

    test('should handle project not found', async () => {
      projectRepository.getProjectById.mockRejectedValue(new Error('Project not found'));

      await expect(projectService.getProjectById(999)).rejects.toThrow('Project not found');
    });

    test('should handle repository error', async () => {
      projectRepository.getProjectById.mockRejectedValue(new Error('Database error'));

      await expect(projectService.getProjectById(1)).rejects.toThrow('Database error');
    });
  });

  describe('getProjectMembers', () => {
    test('should get project members successfully', async () => {
      const mockMembers = [
        { user_id: 1, name: 'User 1', role: 'creator' },
        { user_id: 2, name: 'User 2', role: 'collaborator' }
      ];
      projectRepository.getProjectMembers.mockResolvedValue(mockMembers);

      const result = await projectService.getProjectMembers(1);

      expect(projectRepository.getProjectMembers).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockMembers);
    });

    test('should handle project not found', async () => {
      projectRepository.getProjectMembers.mockRejectedValue(new Error('Project not found'));

      await expect(projectService.getProjectMembers(999)).rejects.toThrow('Project not found');
    });
  });

  describe('updateProject', () => {
    test('should update project successfully', async () => {
      const updateData = { name: 'Updated Project', description: 'Updated Description' };
      const mockProject = { id: 1, ...updateData };

      projectRepository.updateProject.mockResolvedValue({
        success: true,
        project: mockProject,
        message: 'Project updated successfully'
      });

      const result = await projectService.updateProject(1, updateData);

      expect(projectRepository.updateProject).toHaveBeenCalledWith(1, updateData);
      expect(result).toEqual({
        success: true,
        project: mockProject,
        message: 'Project updated successfully'
      });
    });

    test('should handle repository error', async () => {
      const updateData = { name: 'Updated Project' };
      projectRepository.updateProject.mockRejectedValue(new Error('Database error'));

      await expect(projectService.updateProject(1, updateData)).rejects.toThrow('Database error');
    });

    test('should handle project not found', async () => {
      const updateData = { name: 'Updated Project' };
      projectRepository.updateProject.mockRejectedValue(new Error('Project not found'));

      await expect(projectService.updateProject(999, updateData)).rejects.toThrow('Project not found');
    });
  });

  describe('deleteProject', () => {
    test('should delete project successfully', async () => {
      projectRepository.delete.mockResolvedValue({
        success: true,
        message: 'Project deleted successfully'
      });

      const result = await projectService.deleteProject(1);

      expect(projectRepository.delete).toHaveBeenCalledWith(1);
      expect(result).toEqual({
        success: true,
        message: 'Project deleted successfully'
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

    test('should handle project not found', async () => {
      projectRepository.delete.mockRejectedValue(new Error('Project not found'));

      const result = await projectService.deleteProject(999);

      expect(result).toEqual({
        success: false,
        error: 'Project not found',
        message: 'Failed to delete project'
      });
    });
  });

  describe('addUserToProject', () => {
    test('should add user to project successfully', async () => {
      const mockProject = { id: 1, name: 'Test Project' };

      // Mock Supabase to return no existing member
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' } // No rows found
              })
            })
          })
        })
      });

      projectRepository.addUserToProject.mockResolvedValue(true);
      jest.spyOn(projectService, 'getProjectById').mockResolvedValue(mockProject);

      const result = await projectService.addUserToProject(1, 2);

      expect(projectRepository.addUserToProject).toHaveBeenCalledWith(1, 2);
      expect(result).toEqual(mockProject);
    });

    test('should handle missing project id or user id', async () => {
      const result = await projectService.addUserToProject();

      expect(result).toEqual({
        success: false,
        error: 'Project ID and User ID are required',
        message: 'Failed to add user to project'
      });
    });

    test('should handle user already in project', async () => {
      // Mock Supabase to return existing member
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { user_id: 2 },
                error: null
              })
            })
          })
        })
      });

      const result = await projectService.addUserToProject(1, 2);

      expect(result).toEqual({
        success: false,
        error: 'User is already in the project',
        message: 'User already exists in project'
      });
    });

    test('should handle database error', async () => {
      // Mock Supabase to return database error
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'OTHER_ERROR', message: 'Database connection failed' }
              })
            })
          })
        })
      });

      const result = await projectService.addUserToProject(1, 2);

      expect(result).toEqual({
        success: false,
        error: 'Database error: Database connection failed',
        message: 'Failed to add user to project'
      });
    });
  });

  describe('removeUserFromProject', () => {
    test('should remove user from project successfully', async () => {
      const mockProject = { id: 1, name: 'Test Project' };

      projectRepository.removeUserFromProject.mockResolvedValue(true);
      jest.spyOn(projectService, 'getProjectById').mockResolvedValue(mockProject);

      const result = await projectService.removeUserFromProject(1, 2, 1);

      expect(projectRepository.removeUserFromProject).toHaveBeenCalledWith(1, 2, 1);
      expect(result).toEqual(mockProject);
    });

    test('should handle missing parameters', async () => {
      const result = await projectService.removeUserFromProject();

      expect(result).toEqual({
        success: false,
        error: 'Project ID, User ID, and Requesting User ID are required',
        message: 'Failed to remove user from project'
      });
    });

    test('should handle repository error', async () => {
      projectRepository.removeUserFromProject.mockRejectedValue(new Error('Database error'));

      const result = await projectService.removeUserFromProject(1, 2, 1);

      expect(result).toEqual({
        success: false,
        error: 'Database error',
        message: 'Failed to remove user from project'
      });
    });

    test('should handle permission error', async () => {
      projectRepository.removeUserFromProject.mockRejectedValue(new Error('Only managers can remove members'));

      const result = await projectService.removeUserFromProject(1, 2, 3);

      expect(result).toEqual({
        success: false,
        error: 'Only managers can remove members',
        message: 'Failed to remove user from project'
      });
    });
  });

  describe('addUsersToProject', () => {
    test('should add multiple users to project successfully', async () => {
      const mockProject = { id: 1, name: 'Test Project' };

      projectRepository.addUsersToProject.mockResolvedValue(mockProject);

      const result = await projectService.addUsersToProject(1, [2, 3], 1, 'Welcome!', 'collaborator');

      expect(projectRepository.addUsersToProject).toHaveBeenCalledWith(
        1,
        [2, 3],
        1,
        'Welcome!',
        'collaborator'
      );
      expect(result).toEqual(mockProject);
    });

    test('should handle repository error', async () => {
      projectRepository.addUsersToProject.mockRejectedValue(new Error('Permission denied'));

      await expect(
        projectService.addUsersToProject(1, [2, 3], 1, 'Welcome!', 'collaborator')
      ).rejects.toThrow('Permission denied');
    });
  });

  describe('archiveProject', () => {
    test('should archive project successfully', async () => {
      const mockArchivedProject = { id: 1, name: 'Test Project', status: 'archived' };

      projectRepository.canUserManageMembers.mockResolvedValue(true);
      projectRepository.getProjectById.mockResolvedValue({ id: 1, name: 'Test Project' });
      projectRepository.archiveProject.mockResolvedValue(mockArchivedProject);

      const result = await projectService.archiveProject(1, 1);

      expect(projectRepository.canUserManageMembers).toHaveBeenCalledWith(1, 1);
      expect(projectRepository.getProjectById).toHaveBeenCalledWith(1);
      expect(projectRepository.archiveProject).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockArchivedProject);
    });

    test('should handle permission denied', async () => {
      projectRepository.canUserManageMembers.mockResolvedValue(false);

      await expect(projectService.archiveProject(1, 2)).rejects.toThrow(
        'Only managers and creators can archive the project'
      );
    });

    test('should handle project not found', async () => {
      projectRepository.canUserManageMembers.mockResolvedValue(true);
      projectRepository.getProjectById.mockRejectedValue(new Error('Project not found'));

      await expect(projectService.archiveProject(999, 1)).rejects.toThrow('Project not found');
    });

    test('should handle repository error during archive', async () => {
      projectRepository.canUserManageMembers.mockResolvedValue(true);
      projectRepository.getProjectById.mockResolvedValue({ id: 1, name: 'Test Project' });
      projectRepository.archiveProject.mockRejectedValue(new Error('Archive failed'));

      await expect(projectService.archiveProject(1, 1)).rejects.toThrow('Archive failed');
    });
  });
});