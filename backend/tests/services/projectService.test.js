const projectService = require('../../src/services/projectService');
const projectRepository = require('../../src/repository/projectRepository');
const userRepository = require('../../src/repository/userRepository');
const supabase = require('../../src/utils/supabase');
const notificationService = require('../../src/services/notificationService');

jest.mock('../../src/repository/projectRepository');
jest.mock('../../src/repository/userRepository');
jest.mock('../../src/utils/supabase');
jest.mock('../../src/services/notificationService');

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

      // Mock supabase for project_members insertion
      supabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null })
      });

      const result = await projectService.createProject(projectData);

      expect(projectRepository.create).toHaveBeenCalledWith({
        name: 'Test Project',
        description: 'Test Description',
        creator_id: 1,
        status: 'active',
        updated_at: expect.any(String)
      });

      expect(supabase.from).toHaveBeenCalledWith('project_members');

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

      const result = await projectService.createProject(projectData);

      // With empty user_ids, addProjectMembers should not be called
      expect(result.success).toBe(true);
      expect(result.project).toEqual(mockProject);
    });
  });

  describe('getAllProjectsForUser', () => {
    test('should get all projects for user successfully', async () => {
      const mockUser = { id: 1, name: 'Test User' };
      const mockMemberProjectIds = [1];
      const mockCreatorProjectIds = [2];
      const mockProjects = [
        { id: 1, name: 'Project 1' },
        { id: 2, name: 'Project 2' }
      ];
      const mockMembers = [
        { users: { name: 'Test User' } }
      ];

      userRepository.getUserById.mockResolvedValue(mockUser);
      projectRepository.getProjectIdsForUser.mockResolvedValue(mockMemberProjectIds);
      projectRepository.getProjectIdsByCreator.mockResolvedValue(mockCreatorProjectIds);
      projectRepository.getProjectsByIds.mockResolvedValue(mockProjects);
      projectRepository.getTaskCountByProject.mockResolvedValue(5);
      projectRepository.getProjectMembersWithDetails.mockResolvedValue(mockMembers);

      const result = await projectService.getAllProjectsForUser(1);

      expect(userRepository.getUserById).toHaveBeenCalledWith(1);
      expect(projectRepository.getProjectIdsForUser).toHaveBeenCalledWith(1);
      expect(projectRepository.getProjectIdsByCreator).toHaveBeenCalledWith(1);
      expect(projectRepository.getProjectsByIds).toHaveBeenCalledWith([1, 2]);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('task_count', 5);
      expect(result[0]).toHaveProperty('collaborators', 'Test User');
    });

    test('should handle repository error', async () => {
      userRepository.getUserById.mockRejectedValue(new Error('Database error'));

      await expect(projectService.getAllProjectsForUser(1)).rejects.toThrow('Database error');
    });

    test('should return empty array for user with no projects', async () => {
      const mockUser = { id: 1, name: 'Test User' };
      userRepository.getUserById.mockResolvedValue(mockUser);
      projectRepository.getProjectIdsForUser.mockResolvedValue([]);
      projectRepository.getProjectIdsByCreator.mockResolvedValue([]);

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
        { user_id: 1, users: { email: 'user1@test.com', name: 'User 1' }, member_role: 'creator', added_at: '2023-01-01' },
        { user_id: 2, users: { email: 'user2@test.com', name: 'User 2' }, member_role: 'collaborator', added_at: '2023-01-02' }
      ];

      projectRepository.cleanupOrphanedMembers.mockResolvedValue();
      projectRepository.getProjectMembersWithDetails.mockResolvedValue(mockMembers);

      const result = await projectService.getProjectMembers(1);

      expect(projectRepository.cleanupOrphanedMembers).toHaveBeenCalledWith(1);
      expect(projectRepository.getProjectMembersWithDetails).toHaveBeenCalledWith(1);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        user_id: 1,
        email: 'user1@test.com',
        name: 'User 1',
        role: 'creator',
        joined_at: '2023-01-01'
      });
    });

    test('should handle project not found', async () => {
      projectRepository.cleanupOrphanedMembers.mockResolvedValue();
      projectRepository.getProjectMembersWithDetails.mockRejectedValue(new Error('Project not found'));

      await expect(projectService.getProjectMembers(999)).rejects.toThrow('Project not found');
    });
  });

  describe('updateProject', () => {
    test('should update project successfully', async () => {
      const updateData = { name: 'Updated Project', description: 'Updated Description' };
      const mockProject = { id: 1, ...updateData };

      projectRepository.update.mockResolvedValue(mockProject);

      const result = await projectService.updateProject(1, updateData);

      expect(projectRepository.update).toHaveBeenCalledWith(1, updateData);
      expect(result).toEqual({
        success: true,
        project: mockProject,
        message: 'Project updated successfully'
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

      projectRepository.removeUserFromProject.mockResolvedValue(mockProject);

      const result = await projectService.removeUserFromProject(1, 2, 1);

      expect(projectRepository.removeUserFromProject).toHaveBeenCalledWith(1, 2, 1);
      expect(result).toEqual(mockProject);
    });

    test('should handle repository error', async () => {
      projectRepository.removeUserFromProject.mockRejectedValue(new Error('Database error'));

      await expect(projectService.removeUserFromProject(1, 2, 1)).rejects.toThrow('Database error');
    });

    test('should handle permission error', async () => {
      projectRepository.removeUserFromProject.mockRejectedValue(new Error('Only managers can remove members'));

      await expect(projectService.removeUserFromProject(1, 2, 3)).rejects.toThrow('Only managers can remove members');
    });
  });

  describe('addUsersToProject', () => {
    test('should add multiple users to project successfully', async () => {
      const mockProject = { id: 1, name: 'Test Project' };
      const mockMembers = [];

      projectRepository.canUserManageMembers.mockResolvedValue(true);
      projectRepository.getProjectMembersWithDetails.mockResolvedValue(mockMembers);
      projectRepository.addUserToProject.mockResolvedValue(true);
      projectRepository.getProjectById.mockResolvedValue(mockProject);

      const result = await projectService.addUsersToProject(1, [2, 3], 1, 'Welcome!', 'collaborator');

      expect(projectRepository.canUserManageMembers).toHaveBeenCalledWith(1, 1);
      expect(projectRepository.addUserToProject).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockProject);
    });

    test('should handle permission denied', async () => {
      projectRepository.canUserManageMembers.mockResolvedValue(false);

      await expect(
        projectService.addUsersToProject(1, [2, 3], 2, 'Welcome!', 'collaborator')
      ).rejects.toThrow('Only managers and creators can add members to the project');
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

  describe('addProjectMembers', () => {
    test('should add project members successfully', async () => {
      supabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null })
      });

      await projectService.addProjectMembers(1, [2, 3], 1);

      expect(supabase.from).toHaveBeenCalledWith('project_members');
    });

    test('should ensure creator is in member list with creator role', async () => {
      const insertMock = jest.fn().mockResolvedValue({ error: null });
      supabase.from.mockReturnValue({
        insert: insertMock
      });

      await projectService.addProjectMembers(1, [2, 3], 1);

      expect(insertMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ user_id: 1, member_role: 'creator' })
        ])
      );
    });

    test('should deduplicate user IDs', async () => {
      const insertMock = jest.fn().mockResolvedValue({ error: null });
      supabase.from.mockReturnValue({
        insert: insertMock
      });

      await projectService.addProjectMembers(1, [2, 2, 3], 1);

      const callArgs = insertMock.mock.calls[0][0];
      expect(callArgs).toHaveLength(3); // Only unique IDs plus creator
    });

    test('should handle database error', async () => {
      supabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: { message: 'Database error' } })
      });

      await expect(projectService.addProjectMembers(1, [2, 3], 1)).rejects.toThrow(
        'Failed to add project members: Database error'
      );
    });

    test('should assign collaborator role to non-creator members', async () => {
      const insertMock = jest.fn().mockResolvedValue({ error: null });
      supabase.from.mockReturnValue({
        insert: insertMock
      });

      await projectService.addProjectMembers(1, [2, 3], 1);

      expect(insertMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ user_id: 2, member_role: 'collaborator' }),
          expect.objectContaining({ user_id: 3, member_role: 'collaborator' })
        ])
      );
    });
  });

  describe('updateProject - additional cases', () => {
    test('should handle missing project ID', async () => {
      const result = await projectService.updateProject(null, { name: 'Test' });

      expect(result).toEqual({
        success: false,
        error: 'Project ID is required',
        message: 'Failed to update project'
      });
    });

    test('should validate status values', async () => {
      const result = await projectService.updateProject(1, { status: 'invalid' });

      expect(result).toEqual({
        success: false,
        error: 'Invalid status. Must be one of: active, hold, completed, archived',
        message: 'Failed to update project'
      });
    });

    test('should accept valid status values', async () => {
      projectRepository.update.mockResolvedValue({ id: 1, status: 'completed' });

      const result = await projectService.updateProject(1, { status: 'completed' });

      expect(result.success).toBe(true);
    });

    test('should filter out undefined values', async () => {
      const updateData = { name: 'Test', description: undefined, status: 'active' };
      projectRepository.update.mockResolvedValue({ id: 1 });

      await projectService.updateProject(1, updateData);

      expect(projectRepository.update).toHaveBeenCalledWith(1,
        expect.not.objectContaining({ description: undefined })
      );
    });

    test('should update project members when user_ids provided', async () => {
      const mockProject = { id: 1, name: 'Test Project' };
      projectRepository.update.mockResolvedValue(mockProject);
      projectRepository.findById.mockResolvedValue(mockProject);

      const deleteMock = jest.fn().mockResolvedValue({ error: null });
      const insertMock = jest.fn().mockResolvedValue({ error: null });

      supabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        }),
        insert: insertMock
      });

      const result = await projectService.updateProject(1, { name: 'Test', user_ids: [2, 3] });

      expect(supabase.from).toHaveBeenCalledWith('project_members');
      expect(result.success).toBe(true);
    });

    test('should handle empty user_ids array', async () => {
      projectRepository.update.mockResolvedValue({ id: 1 });
      projectRepository.findById.mockResolvedValue({ id: 1 });

      supabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      });

      const result = await projectService.updateProject(1, { user_ids: [] });

      expect(result.success).toBe(true);
    });

    test('should handle user_ids update failure', async () => {
      projectRepository.update.mockResolvedValue({ id: 1 });

      supabase.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        }),
        insert: jest.fn().mockResolvedValue({ error: { message: 'Insert failed' } })
      });

      const result = await projectService.updateProject(1, { user_ids: [2, 3] });

      expect(result).toEqual({
        success: false,
        error: 'Failed to update project members: Insert failed',
        message: 'Failed to update project'
      });
    });
  });

  describe('deleteProject - additional cases', () => {
    test('should handle missing project ID', async () => {
      const result = await projectService.deleteProject(null);

      expect(result).toEqual({
        success: false,
        error: 'Project ID is required',
        message: 'Failed to delete project'
      });
    });
  });

  describe('removeUserFromProjectLegacy', () => {
    test('should remove user successfully', async () => {
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

      projectRepository.removeUserFromProject.mockResolvedValue(true);
      const mockProject = { id: 1, name: 'Test Project' };
      jest.spyOn(projectService, 'getProjectById').mockResolvedValue(mockProject);

      const result = await projectService.removeUserFromProjectLegacy(1, 2);

      expect(result).toEqual(mockProject);
    });

    test('should handle missing project ID or user ID', async () => {
      const result = await projectService.removeUserFromProjectLegacy();

      expect(result).toEqual({
        success: false,
        error: 'Project ID and User ID are required',
        message: 'Failed to remove user from project'
      });
    });

    test('should handle user not in project', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' }
              })
            })
          })
        })
      });

      const result = await projectService.removeUserFromProjectLegacy(1, 2);

      expect(result).toEqual({
        success: false,
        error: 'User is not in the project',
        message: 'User not found in project'
      });
    });

    test('should handle database error', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'OTHER_ERROR', message: 'Database error' }
              })
            })
          })
        })
      });

      const result = await projectService.removeUserFromProjectLegacy(1, 2);

      expect(result).toEqual({
        success: false,
        error: 'Database error: Database error',
        message: 'Failed to remove user from project'
      });
    });

    test('should handle removal error', async () => {
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

      projectRepository.removeUserFromProject.mockRejectedValue(new Error('Removal failed'));

      const result = await projectService.removeUserFromProjectLegacy(1, 2);

      expect(result).toEqual({
        success: false,
        error: 'Removal failed',
        message: 'Failed to remove user from project'
      });
    });
  });

  describe('getProjectsWithRBAC', () => {
    test('should return all projects for admin user', async () => {
      const admin = { id: 1, role: 'admin' };
      const mockProjects = [{ id: 1 }, { id: 2 }];
      projectRepository.getAllProjects.mockResolvedValue(mockProjects);

      const result = await projectService.getProjectsWithRBAC(admin);

      expect(projectRepository.getAllProjects).toHaveBeenCalled();
      expect(result).toEqual(mockProjects);
    });

    test('should return filtered projects for manager', async () => {
      const manager = { id: 1, role: 'manager', division: 'eng', hierarchy: 3 };
      const ownProjects = [{ id: 1 }];
      const subordinateProjects = [{ id: 2 }];
      const allProjects = [{ id: 1 }, { id: 2 }];

      jest.spyOn(projectService, 'getAllProjectsForUser').mockResolvedValue(ownProjects);
      projectRepository.getProjectsByDivisionAndHierarchy.mockResolvedValue(subordinateProjects);
      projectRepository.getProjectsByIds.mockResolvedValue(allProjects);

      const result = await projectService.getProjectsWithRBAC(manager);

      expect(projectRepository.getProjectsByDivisionAndHierarchy).toHaveBeenCalledWith('eng', 3);
      expect(result).toEqual(allProjects);
    });

    test('should return empty array for manager with no projects', async () => {
      const manager = { id: 1, role: 'manager', division: 'eng', hierarchy: 3 };

      jest.spyOn(projectService, 'getAllProjectsForUser').mockResolvedValue([]);
      projectRepository.getProjectsByDivisionAndHierarchy.mockResolvedValue([]);

      const result = await projectService.getProjectsWithRBAC(manager);

      expect(result).toEqual([]);
    });

    test('should return own projects for staff user', async () => {
      const staff = { id: 1, role: 'staff' };
      const ownProjects = [{ id: 1 }];

      jest.spyOn(projectService, 'getAllProjectsForUser').mockResolvedValue(ownProjects);

      const result = await projectService.getProjectsWithRBAC(staff);

      expect(result).toEqual(ownProjects);
    });

    test('should handle errors in RBAC filtering', async () => {
      const user = { id: 1, role: 'staff' };

      jest.spyOn(projectService, 'getAllProjectsForUser').mockRejectedValue(new Error('Database error'));

      await expect(projectService.getProjectsWithRBAC(user)).rejects.toThrow('Database error');
    });
  });

  describe('addUsersToProject - edge cases', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should skip users already in project', async () => {
      const mockProject = { id: 1, name: 'Test Project' };
      const existingMembers = [{ user_id: 2 }];

      projectRepository.canUserManageMembers.mockResolvedValue(true);
      projectRepository.getProjectMembersWithDetails.mockResolvedValue(existingMembers);
      projectRepository.addUserToProject.mockResolvedValue(true);
      projectRepository.getProjectById.mockResolvedValue(mockProject);

      const result = await projectService.addUsersToProject(1, [2, 3], 1, 'Welcome!');

      // Should only add user 3, not user 2
      expect(projectRepository.addUserToProject).toHaveBeenCalledTimes(1);
      expect(projectRepository.addUserToProject).toHaveBeenCalledWith(1, 3, 'collaborator');
    });


    test('should propagate user addition error', async () => {
      projectRepository.canUserManageMembers.mockResolvedValue(true);
      projectRepository.getProjectMembersWithDetails.mockResolvedValue([]);
      projectRepository.addUserToProject.mockRejectedValue(new Error('Add user failed'));

      await expect(
        projectService.addUsersToProject(1, [2], 1, 'Welcome!')
      ).rejects.toThrow('Add user failed');
    });
  });
});