const projectRepository = require('../../src/repository/projectRepository');
const supabase = require('../../src/utils/supabase');

// Create a comprehensive Supabase mock
const createSupabaseMock = () => {
  const chainMethods = {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    eq: jest.fn(),
    neq: jest.fn(),
    in: jest.fn(),
    not: jest.fn(),
    order: jest.fn(),
    single: jest.fn(),
    limit: jest.fn(),
    offset: jest.fn()
  };

  // Make each method return an object with all other methods
  Object.keys(chainMethods).forEach(methodName => {
    chainMethods[methodName].mockReturnValue(chainMethods);
  });

  return {
    from: jest.fn().mockReturnValue(chainMethods),
    ...chainMethods
  };
};

jest.mock('../../src/utils/supabase', () => createSupabaseMock());

describe('ProjectRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset all mocks to return themselves for chaining
    Object.keys(supabase).forEach(key => {
      if (typeof supabase[key] === 'function' && key !== 'from') {
        supabase[key].mockReturnValue(supabase);
      }
    });
    supabase.from.mockReturnValue(supabase);
  });

  describe('getAllProjects', () => {
    test('should get all projects successfully', async () => {
      const mockProjects = [
        { id: 1, name: 'Project 1', description: 'Description 1' },
        { id: 2, name: 'Project 2', description: 'Description 2' }
      ];

      mockSelect.mockResolvedValue({
        data: mockProjects,
        error: null
      });

      const result = await projectRepository.getAllProjects();

      expect(supabase.from).toHaveBeenCalledWith('projects');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(result).toEqual(mockProjects);
    });

    test('should handle database error', async () => {
      mockSelect.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' }
      });

      await expect(projectRepository.getAllProjects()).rejects.toThrow('Database connection failed');
    });

    test('should return empty array when no projects found', async () => {
      mockSelect.mockResolvedValue({
        data: null,
        error: null
      });

      const result = await projectRepository.getAllProjects();

      expect(result).toEqual([]);
    });
  });

  describe('getAllProjectsWithMembers', () => {
    test('should get all projects with members successfully', async () => {
      const mockData = [
        {
          id: 1,
          name: 'Project 1',
          description: 'Description 1',
          project_members: [
            { user_id: 1, member_role: 'creator' },
            { user_id: 2, member_role: 'collaborator' }
          ]
        },
        {
          id: 2,
          name: 'Project 2',
          description: 'Description 2',
          project_members: [
            { user_id: 3, member_role: 'creator' }
          ]
        }
      ];

      mockOrder.mockResolvedValue({
        data: mockData,
        error: null
      });

      const result = await projectRepository.getAllProjectsWithMembers();

      expect(supabase.from).toHaveBeenCalledWith('projects');
      expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining('project_members'));
      expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });

      expect(result).toEqual([
        {
          id: 1,
          name: 'Project 1',
          description: 'Description 1',
          project_members: [
            { user_id: 1, member_role: 'creator' },
            { user_id: 2, member_role: 'collaborator' }
          ],
          user_ids: [1, 2]
        },
        {
          id: 2,
          name: 'Project 2',
          description: 'Description 2',
          project_members: [
            { user_id: 3, member_role: 'creator' }
          ],
          user_ids: [3]
        }
      ]);
    });

    test('should handle projects without members', async () => {
      const mockData = [
        {
          id: 1,
          name: 'Project 1',
          description: 'Description 1',
          project_members: null
        }
      ];

      mockOrder.mockResolvedValue({
        data: mockData,
        error: null
      });

      const result = await projectRepository.getAllProjectsWithMembers();

      expect(result[0].user_ids).toEqual([]);
    });

    test('should handle database error', async () => {
      mockOrder.mockResolvedValue({
        data: null,
        error: { message: 'Query failed' }
      });

      await expect(projectRepository.getAllProjectsWithMembers()).rejects.toThrow('Query failed');
    });
  });

  describe('getProjectsForUser', () => {
    test('should get projects for user successfully', async () => {
      const mockData = [
        {
          project_id: 1,
          member_role: 'creator',
          projects: {
            id: 1,
            name: 'Project 1',
            description: 'Description 1',
            status: 'active'
          }
        },
        {
          project_id: 2,
          member_role: 'collaborator',
          projects: {
            id: 2,
            name: 'Project 2',
            description: 'Description 2',
            status: 'active'
          }
        }
      ];

      mockEq.mockResolvedValue({
        data: mockData,
        error: null
      });

      const result = await projectRepository.getProjectsForUser(1);

      expect(supabase.from).toHaveBeenCalledWith('project_members');
      expect(mockEq).toHaveBeenCalledWith('user_id', 1);

      const expectedResult = [
        {
          id: 1,
          name: 'Project 1',
          description: 'Description 1',
          status: 'active',
          role: 'creator'
        },
        {
          id: 2,
          name: 'Project 2',
          description: 'Description 2',
          status: 'active',
          role: 'collaborator'
        }
      ];

      expect(result).toEqual(expectedResult);
    });

    test('should return empty array when user has no projects', async () => {
      mockEq.mockResolvedValue({
        data: [],
        error: null
      });

      const result = await projectRepository.getProjectsForUser(1);

      expect(result).toEqual([]);
    });

    test('should handle database error', async () => {
      mockEq.mockResolvedValue({
        data: null,
        error: { message: 'User not found' }
      });

      await expect(projectRepository.getProjectsForUser(1)).rejects.toThrow('User not found');
    });
  });

  describe('getProjectById', () => {
    test('should get project by id successfully', async () => {
      const mockProject = {
        id: 1,
        name: 'Test Project',
        description: 'Test Description',
        status: 'active'
      };

      mockSingle.mockResolvedValue({
        data: mockProject,
        error: null
      });

      const result = await projectRepository.getProjectById(1);

      expect(supabase.from).toHaveBeenCalledWith('projects');
      expect(mockEq).toHaveBeenCalledWith('id', 1);
      expect(mockSingle).toHaveBeenCalled();
      expect(result).toEqual(mockProject);
    });

    test('should handle project not found', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' }
      });

      await expect(projectRepository.getProjectById(999)).rejects.toThrow('Project not found');
    });

    test('should handle database error', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      await expect(projectRepository.getProjectById(1)).rejects.toThrow('Database error');
    });
  });

  describe('getProjectMembers', () => {
    test('should get project members successfully', async () => {
      const mockData = [
        {
          user_id: 1,
          member_role: 'creator',
          users: {
            id: 1,
            name: 'User 1',
            email: 'user1@example.com'
          }
        },
        {
          user_id: 2,
          member_role: 'collaborator',
          users: {
            id: 2,
            name: 'User 2',
            email: 'user2@example.com'
          }
        }
      ];

      mockEq.mockResolvedValue({
        data: mockData,
        error: null
      });

      const result = await projectRepository.getProjectMembers(1);

      expect(supabase.from).toHaveBeenCalledWith('project_members');
      expect(mockEq).toHaveBeenCalledWith('project_id', 1);

      const expectedResult = [
        {
          user_id: 1,
          name: 'User 1',
          email: 'user1@example.com',
          role: 'creator'
        },
        {
          user_id: 2,
          name: 'User 2',
          email: 'user2@example.com',
          role: 'collaborator'
        }
      ];

      expect(result).toEqual(expectedResult);
    });

    test('should return empty array when project has no members', async () => {
      mockEq.mockResolvedValue({
        data: [],
        error: null
      });

      const result = await projectRepository.getProjectMembers(1);

      expect(result).toEqual([]);
    });

    test('should handle database error', async () => {
      mockEq.mockResolvedValue({
        data: null,
        error: { message: 'Project not found' }
      });

      await expect(projectRepository.getProjectMembers(1)).rejects.toThrow('Project not found');
    });
  });

  describe('create', () => {
    test('should create project successfully', async () => {
      const projectData = {
        name: 'New Project',
        description: 'New Description',
        creator_id: 1,
        status: 'active'
      };

      const mockCreatedProject = { id: 1, ...projectData };

      mockSingle.mockResolvedValue({
        data: mockCreatedProject,
        error: null
      });

      const result = await projectRepository.create(projectData);

      expect(supabase.from).toHaveBeenCalledWith('projects');
      expect(mockInsert).toHaveBeenCalledWith(projectData);
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockSingle).toHaveBeenCalled();
      expect(result).toEqual(mockCreatedProject);
    });

    test('should handle database error during creation', async () => {
      const projectData = {
        name: 'New Project',
        description: 'New Description',
        creator_id: 1
      };

      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Duplicate key violation' }
      });

      await expect(projectRepository.create(projectData)).rejects.toThrow('Duplicate key violation');
    });
  });

  describe('updateProject', () => {
    test('should update project successfully', async () => {
      const updateData = {
        name: 'Updated Project',
        description: 'Updated Description'
      };

      const mockUpdatedProject = {
        id: 1,
        name: 'Updated Project',
        description: 'Updated Description',
        status: 'active'
      };

      mockSingle.mockResolvedValue({
        data: mockUpdatedProject,
        error: null
      });

      const result = await projectRepository.updateProject(1, updateData);

      expect(supabase.from).toHaveBeenCalledWith('projects');
      expect(mockUpdate).toHaveBeenCalledWith({
        ...updateData,
        updated_at: expect.any(String)
      });
      expect(mockEq).toHaveBeenCalledWith('id', 1);
      expect(result).toEqual({
        success: true,
        project: mockUpdatedProject,
        message: 'Project updated successfully'
      });
    });

    test('should handle project not found during update', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }
      });

      await expect(
        projectRepository.updateProject(999, { name: 'Updated' })
      ).rejects.toThrow('Project not found');
    });

    test('should handle database error during update', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Update constraint violation' }
      });

      await expect(
        projectRepository.updateProject(1, { name: 'Updated' })
      ).rejects.toThrow('Update constraint violation');
    });
  });

  describe('addUserToProject', () => {
    test('should add user to project successfully', async () => {
      mockInsert.mockResolvedValue({
        error: null
      });

      const result = await projectRepository.addUserToProject(1, 2, 'collaborator');

      expect(supabase.from).toHaveBeenCalledWith('project_members');
      expect(mockInsert).toHaveBeenCalledWith({
        project_id: 1,
        user_id: 2,
        member_role: 'collaborator'
      });
      expect(result).toBe(true);
    });

    test('should handle database error when adding user', async () => {
      mockInsert.mockResolvedValue({
        error: { message: 'Duplicate membership' }
      });

      await expect(
        projectRepository.addUserToProject(1, 2, 'collaborator')
      ).rejects.toThrow('Failed to add user to project: Duplicate membership');
    });
  });

  describe('addUsersToProject', () => {
    test('should add multiple users to project successfully', async () => {
      const mockProject = {
        id: 1,
        name: 'Test Project',
        members: [{ user_id: 1 }, { user_id: 2 }, { user_id: 3 }]
      };

      // Mock permission check
      mockSingle.mockResolvedValueOnce({
        data: { member_role: 'creator' },
        error: null
      });

      // Mock user validation
      mockEq.mockResolvedValueOnce({
        data: [{ id: 2 }, { id: 3 }],
        error: null
      });

      // Mock existing members check
      mockEq.mockResolvedValueOnce({
        data: [],
        error: null
      });

      // Mock member insertion
      mockInsert.mockResolvedValueOnce({
        error: null
      });

      // Mock get project by id
      jest.spyOn(projectRepository, 'getProjectById').mockResolvedValue(mockProject);

      const result = await projectRepository.addUsersToProject(1, [2, 3], 1, 'Welcome!', 'collaborator');

      expect(result).toEqual(mockProject);
    });

    test('should handle permission denied', async () => {
      mockSingle.mockResolvedValue({
        data: { member_role: 'collaborator' },
        error: null
      });

      await expect(
        projectRepository.addUsersToProject(1, [2, 3], 2, 'Welcome!', 'collaborator')
      ).rejects.toThrow('Only managers and creators can add members to this project');
    });

    test('should handle invalid users', async () => {
      // Mock permission check
      mockSingle.mockResolvedValueOnce({
        data: { member_role: 'creator' },
        error: null
      });

      // Mock user validation - only user 2 exists
      mockEq.mockResolvedValueOnce({
        data: [{ id: 2 }],
        error: null
      });

      await expect(
        projectRepository.addUsersToProject(1, [2, 999], 1, 'Welcome!', 'collaborator')
      ).rejects.toThrow('Invalid user IDs: 999');
    });

    test('should handle users already in project', async () => {
      // Mock permission check
      mockSingle.mockResolvedValueOnce({
        data: { member_role: 'creator' },
        error: null
      });

      // Mock user validation
      mockEq.mockResolvedValueOnce({
        data: [{ id: 2 }, { id: 3 }],
        error: null
      });

      // Mock existing members check - user 2 already exists
      mockEq.mockResolvedValueOnce({
        data: [{ user_id: 2 }],
        error: null
      });

      await expect(
        projectRepository.addUsersToProject(1, [2, 3], 1, 'Welcome!', 'collaborator')
      ).rejects.toThrow('Users already in project: 2');
    });
  });

  describe('removeUserFromProject', () => {
    test('should remove user from project successfully', async () => {
      // Mock permission check
      mockSingle.mockResolvedValueOnce({
        data: { member_role: 'creator' },
        error: null
      });

      // Mock deletion
      mockDelete.mockResolvedValue({
        error: null
      });

      const result = await projectRepository.removeUserFromProject(1, 2, 1);

      expect(result).toBe(true);
    });

    test('should handle permission denied', async () => {
      mockSingle.mockResolvedValue({
        data: { member_role: 'collaborator' },
        error: null
      });

      await expect(
        projectRepository.removeUserFromProject(1, 2, 3)
      ).rejects.toThrow('Only managers and creators can remove members');
    });

    test('should handle user not found in project', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { member_role: 'creator' },
        error: null
      });

      mockDelete.mockResolvedValue({
        error: { code: 'PGRST116' }
      });

      await expect(
        projectRepository.removeUserFromProject(1, 999, 1)
      ).rejects.toThrow('User not found in project');
    });
  });

  describe('canUserManageMembers', () => {
    test('should return true for creator', async () => {
      mockSingle.mockResolvedValue({
        data: { member_role: 'creator' },
        error: null
      });

      const result = await projectRepository.canUserManageMembers(1, 1);

      expect(supabase.from).toHaveBeenCalledWith('project_members');
      expect(mockEq).toHaveBeenCalledWith('project_id', 1);
      expect(mockEq).toHaveBeenCalledWith('user_id', 1);
      expect(result).toBe(true);
    });

    test('should return true for manager', async () => {
      mockSingle.mockResolvedValue({
        data: { member_role: 'manager' },
        error: null
      });

      const result = await projectRepository.canUserManageMembers(1, 1);

      expect(result).toBe(true);
    });

    test('should return false for collaborator', async () => {
      mockSingle.mockResolvedValue({
        data: { member_role: 'collaborator' },
        error: null
      });

      const result = await projectRepository.canUserManageMembers(1, 2);

      expect(result).toBe(false);
    });

    test('should return false when user not in project', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }
      });

      const result = await projectRepository.canUserManageMembers(1, 999);

      expect(result).toBe(false);
    });
  });

  describe('archiveProject', () => {
    test('should archive project successfully', async () => {
      const mockArchivedProject = {
        id: 1,
        name: 'Test Project',
        status: 'archived'
      };

      // Mock task archiving
      mockUpdate.mockResolvedValueOnce({
        error: null
      });

      // Mock project archiving
      mockSingle.mockResolvedValue({
        data: mockArchivedProject,
        error: null
      });

      const result = await projectRepository.archiveProject(1);

      expect(result).toEqual(mockArchivedProject);
    });

    test('should handle error during task archiving', async () => {
      mockUpdate.mockResolvedValue({
        error: { message: 'Failed to archive tasks' }
      });

      await expect(projectRepository.archiveProject(1)).rejects.toThrow('Failed to archive tasks');
    });

    test('should handle error during project archiving', async () => {
      // Mock successful task archiving
      mockUpdate.mockResolvedValueOnce({
        error: null
      });

      // Mock failed project archiving
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Failed to archive project' }
      });

      await expect(projectRepository.archiveProject(1)).rejects.toThrow('Failed to archive project');
    });
  });

  describe('delete', () => {
    test('should delete project successfully', async () => {
      // Mock member deletion
      mockDelete.mockResolvedValueOnce({
        error: null
      });

      // Mock project deletion
      mockDelete.mockResolvedValueOnce({
        error: null
      });

      const result = await projectRepository.delete(1);

      expect(result).toEqual({
        success: true,
        message: 'Project deleted successfully'
      });
    });

    test('should handle error during member deletion', async () => {
      mockDelete.mockResolvedValue({
        error: { message: 'Failed to delete members' }
      });

      const result = await projectRepository.delete(1);

      expect(result).toEqual({
        success: false,
        error: 'Failed to delete members',
        message: 'Failed to delete project'
      });
    });

    test('should handle error during project deletion', async () => {
      // Mock successful member deletion
      mockDelete.mockResolvedValueOnce({
        error: null
      });

      // Mock failed project deletion
      mockDelete.mockResolvedValueOnce({
        error: { message: 'Failed to delete project' }
      });

      const result = await projectRepository.delete(1);

      expect(result).toEqual({
        success: false,
        error: 'Failed to delete project',
        message: 'Failed to delete project'
      });
    });
  });

  // Legacy method tests for backward compatibility
  describe('Legacy Methods', () => {
    describe('findAll', () => {
      test('should call getAllProjects', async () => {
        const mockProjects = [{ id: 1, name: 'Project 1' }];
        jest.spyOn(projectRepository, 'getAllProjects').mockResolvedValue(mockProjects);

        const result = await projectRepository.findAll();

        expect(projectRepository.getAllProjects).toHaveBeenCalled();
        expect(result).toEqual(mockProjects);
      });
    });

    describe('findById', () => {
      test('should call getProjectById', async () => {
        const mockProject = { id: 1, name: 'Project 1' };
        jest.spyOn(projectRepository, 'getProjectById').mockResolvedValue(mockProject);

        const result = await projectRepository.findById(1);

        expect(projectRepository.getProjectById).toHaveBeenCalledWith(1);
        expect(result).toEqual(mockProject);
      });

      test('should handle project not found', async () => {
        jest.spyOn(projectRepository, 'getProjectById').mockRejectedValue(new Error('Project not found'));

        const result = await projectRepository.findById(999);

        expect(result).toBeNull();
      });
    });

    describe('update', () => {
      test('should call updateProject and return project only', async () => {
        const mockResult = {
          success: true,
          project: { id: 1, name: 'Updated Project' },
          message: 'Project updated successfully'
        };
        jest.spyOn(projectRepository, 'updateProject').mockResolvedValue(mockResult);

        const result = await projectRepository.update(1, { name: 'Updated Project' });

        expect(projectRepository.updateProject).toHaveBeenCalledWith(1, { name: 'Updated Project' });
        expect(result).toEqual(mockResult.project);
      });

      test('should return null when project not found', async () => {
        jest.spyOn(projectRepository, 'updateProject').mockRejectedValue(new Error('Project not found'));

        const result = await projectRepository.update(999, { name: 'Updated' });

        expect(result).toBeNull();
      });
    });
  });
});