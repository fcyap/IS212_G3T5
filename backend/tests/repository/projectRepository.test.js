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

// Expose mock methods for easier testing
let mockSelect, mockInsert, mockUpdate, mockDelete, mockEq, mockNeq, mockIn, mockNot, mockOrder, mockSingle, mockLimit, mockOffset;

describe('ProjectRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();

    // Create a mock chain that returns itself for all methods
    const mockChain = {
      from: jest.fn(),
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
      offset: jest.fn(),
      lt: jest.fn(),
      gt: jest.fn(),
      gte: jest.fn(),
      lte: jest.fn()
    };

    // Make all methods return the mockChain for chaining
    Object.keys(mockChain).forEach(key => {
      if (key !== 'from') {  // Don't chain 'from' to itself
        mockChain[key].mockReturnValue(mockChain);
      }
    });

    // Make 'from' return the mockChain
    mockChain.from.mockReturnValue(mockChain);

    // Assign mockChain methods to supabase object
    Object.assign(supabase, mockChain);

    // Assign mock methods to variables for easier access in tests
    mockSelect = supabase.select;
    mockInsert = supabase.insert;
    mockUpdate = supabase.update;
    mockDelete = supabase.delete;
    mockEq = supabase.eq;
    mockNeq = supabase.neq;
    mockIn = supabase.in;
    mockNot = supabase.not;
    mockOrder = supabase.order;
    mockSingle = supabase.single;
    mockLimit = supabase.limit;
    mockOffset = supabase.offset;
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

  describe('getActiveProjects', () => {
    test('should return only active projects ordered by name', async () => {
      const mockProjects = [
        { id: 1, name: 'Alpha', status: 'active' },
        { id: 2, name: 'Beta', status: 'active' }
      ];

      mockOrder.mockResolvedValue({
        data: mockProjects,
        error: null
      });

      const result = await projectRepository.getActiveProjects();

      expect(supabase.from).toHaveBeenCalledWith('projects');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockEq).toHaveBeenCalledWith('status', 'active');
      expect(mockOrder).toHaveBeenCalledWith('name', { ascending: true });
      expect(result).toEqual(mockProjects);
    });

    test('should return empty array when no active projects found', async () => {
      mockOrder.mockResolvedValue({
        data: null,
        error: null
      });

      const result = await projectRepository.getActiveProjects();

      expect(result).toEqual([]);
    });

    test('should throw when database returns an error', async () => {
      mockOrder.mockResolvedValue({
        data: null,
        error: { message: 'DB error' }
      });

      await expect(projectRepository.getActiveProjects()).rejects.toThrow('DB error');
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

    test('should return empty array when data is null', async () => {
      mockEq.mockResolvedValue({
        data: null,
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
      const mockProjectData = {
        id: 1,
        name: 'Test Project',
        description: 'Test Description',
        status: 'active',
        project_members: [
          { user_id: 1, member_role: 'creator' },
          { user_id: 2, member_role: 'collaborator' }
        ]
      };

      mockSingle.mockResolvedValue({
        data: mockProjectData,
        error: null
      });

      const result = await projectRepository.getProjectById(1);

      expect(supabase.from).toHaveBeenCalledWith('projects');
      expect(mockEq).toHaveBeenCalledWith('id', 1);
      expect(mockSingle).toHaveBeenCalled();
      expect(result).toEqual({
        ...mockProjectData,
        user_ids: [1, 2]
      });
    });

    test('should handle project not found', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' }
      });

      await expect(projectRepository.getProjectById(999)).rejects.toThrow('No rows found');
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
    test('should get project data successfully', async () => {
      const mockProjectData = {
        id: 1,
        created_at: '2024-01-01T00:00:00Z'
      };

      mockSingle.mockResolvedValue({
        data: mockProjectData,
        error: null
      });

      const result = await projectRepository.getProjectMembers(1);

      expect(supabase.from).toHaveBeenCalledWith('projects');
      expect(mockSelect).toHaveBeenCalledWith('id, created_at');
      expect(mockEq).toHaveBeenCalledWith('id', 1);
      expect(mockNeq).toHaveBeenCalledWith('status', 'completed');
      expect(mockSingle).toHaveBeenCalled();
      expect(result).toEqual(mockProjectData);
    });

    test('should handle project not found', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Project not found' }
      });

      await expect(projectRepository.getProjectMembers(1)).rejects.toThrow('Project not found');
    });

    test('should handle database error', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      await expect(projectRepository.getProjectMembers(1)).rejects.toThrow('Database error');
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
      expect(mockInsert).toHaveBeenCalledWith([projectData]);
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

      mockSelect.mockResolvedValue({
        data: [mockUpdatedProject],
        error: null
      });

      const result = await projectRepository.updateProject(1, updateData);

      expect(supabase.from).toHaveBeenCalledWith('projects');
      expect(mockUpdate).toHaveBeenCalledWith(updateData);
      expect(mockEq).toHaveBeenCalledWith('id', 1);
      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual(mockUpdatedProject);
    });

    test('should handle database error during update', async () => {
      mockSelect.mockResolvedValue({
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
      const mockMemberData = {
        project_id: 1,
        user_id: 2,
        member_role: 'collaborator',
        added_at: expect.any(Date)
      };

      mockSelect.mockResolvedValue({
        data: [mockMemberData],
        error: null
      });

      const result = await projectRepository.addUserToProject(1, 2, 'collaborator');

      expect(supabase.from).toHaveBeenCalledWith('project_members');
      expect(mockInsert).toHaveBeenCalledWith([{
        project_id: 1,
        user_id: 2,
        member_role: 'collaborator',
        added_at: expect.any(Date)
      }]);
      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual(mockMemberData);
    });

    test('should handle database error when adding user', async () => {
      mockSelect.mockResolvedValue({
        data: null,
        error: { message: 'Duplicate membership' }
      });

      await expect(
        projectRepository.addUserToProject(1, 2, 'collaborator')
      ).rejects.toThrow('Duplicate membership');
    });
  });

  describe('addUsersToProject', () => {
    test('should add multiple users to project successfully', async () => {
      const mockMembersData = [
        { project_id: 1, user_id: 2, member_role: 'collaborator' },
        { project_id: 1, user_id: 3, member_role: 'collaborator' }
      ];

      // Mock canUserManageMembers to return true
      jest.spyOn(projectRepository, 'canUserManageMembers').mockResolvedValue(true);

      // Mock user validation - first .in() call
      const inMock = jest.fn().mockResolvedValueOnce({
        data: [{ id: 2 }, { id: 3 }],
        error: null
      });

      // Setup select to return an object with .in() method
      mockSelect.mockReturnValueOnce({
        in: inMock
      });

      // Mock existing members check - .select().eq().in() chain
      const inMock2 = jest.fn().mockResolvedValueOnce({
        data: [],
        error: null
      });

      const eqMock = jest.fn().mockReturnValue({
        in: inMock2
      });

      // Setup the chain for existing members check
      mockSelect.mockReturnValueOnce({
        eq: eqMock
      });

      // Mock member insertion with select
      mockSelect.mockResolvedValueOnce({
        data: mockMembersData,
        error: null
      });

      const result = await projectRepository.addUsersToProject(1, [2, 3], 1, 'collaborator');

      expect(result).toEqual({ success: true, data: mockMembersData });
      expect(projectRepository.canUserManageMembers).toHaveBeenCalledWith(1, 1);
    });

    test('should handle permission denied', async () => {
      // Mock canUserManageMembers to return false
      jest.spyOn(projectRepository, 'canUserManageMembers').mockResolvedValue(false);

      await expect(
        projectRepository.addUsersToProject(1, [2, 3], 2, 'collaborator')
      ).rejects.toThrow('Permission denied');
    });

    test('should handle invalid users', async () => {
      // Mock canUserManageMembers to return true
      jest.spyOn(projectRepository, 'canUserManageMembers').mockResolvedValue(true);

      // Mock user validation - only user 2 exists
      mockIn.mockResolvedValueOnce({
        data: [{ id: 2 }],
        error: null
      });

      await expect(
        projectRepository.addUsersToProject(1, [2, 999], 1, 'collaborator')
      ).rejects.toThrow('Invalid users');
    });

    test('should handle users already in project', async () => {
      // Mock canUserManageMembers to return true
      jest.spyOn(projectRepository, 'canUserManageMembers').mockResolvedValue(true);

      // Mock user validation
      mockIn.mockResolvedValueOnce({
        data: [{ id: 2 }, { id: 3 }],
        error: null
      });

      // Mock existing members check - user 2 already exists
      mockIn.mockResolvedValueOnce({
        data: [{ user_id: 2 }],
        error: null
      });

      await expect(
        projectRepository.addUsersToProject(1, [2, 3], 1, 'collaborator')
      ).rejects.toThrow('Users already in project');
    });

    test('should handle user validation error', async () => {
      jest.spyOn(projectRepository, 'canUserManageMembers').mockResolvedValue(true);

      // Mock user validation - error
      const inMock = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'User validation error' }
      });

      mockSelect.mockReturnValue({
        in: inMock
      });

      await expect(
        projectRepository.addUsersToProject(1, [2, 3], 1, 'collaborator')
      ).rejects.toThrow('Invalid users');
    });

    test('should handle insert error', async () => {
      jest.clearAllMocks();
      jest.spyOn(projectRepository, 'canUserManageMembers').mockResolvedValue(true);

      // Mock user validation - first .from().select().in() chain
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({
            data: [{ id: 2 }, { id: 3 }],
            error: null
          })
        })
      });

      // Mock existing members check - second .from().select().eq().in() chain
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        })
      });

      // Mock insert - fails - third .from().insert().select() chain
      supabase.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Insert failed' }
          })
        })
      });

      await expect(
        projectRepository.addUsersToProject(1, [2, 3], 1, 'collaborator')
      ).rejects.toThrow('Insert failed');
    });
  });

  describe('removeUserFromProject', () => {
    test('should remove user from project successfully', async () => {
      const mockProject = {
        id: 1,
        name: 'Test Project',
        status: 'active'
      };

      // Mock canUserManageMembers to return true
      jest.spyOn(projectRepository, 'canUserManageMembers').mockResolvedValue(true);

      // Mock getProjectById
      jest.spyOn(projectRepository, 'getProjectById').mockResolvedValueOnce(mockProject);

      // Mock check user to remove role - need to handle .eq().eq().single() chain
      const eqMock2 = jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { member_role: 'collaborator' },
          error: null
        })
      });

      const eqMock1 = jest.fn().mockReturnValue({
        eq: eqMock2
      });

      mockSelect.mockReturnValueOnce({
        eq: eqMock1
      });

      // Mock deletion - need to handle .delete().eq().eq() chain
      const deleteEqMock2 = jest.fn().mockResolvedValue({
        error: null
      });

      const deleteEqMock1 = jest.fn().mockReturnValue({
        eq: deleteEqMock2
      });

      mockDelete.mockReturnValueOnce({
        eq: deleteEqMock1
      });

      const result = await projectRepository.removeUserFromProject(1, 2, 1);

      expect(result).toEqual(mockProject);
    });

    test('should handle permission denied', async () => {
      // Mock canUserManageMembers to return false
      jest.spyOn(projectRepository, 'canUserManageMembers').mockResolvedValue(false);

      await expect(
        projectRepository.removeUserFromProject(1, 2, 3)
      ).rejects.toThrow('Only managers and creators can remove members from the project');
    });

    test('should prevent removing creator', async () => {
      const mockProject = {
        id: 1,
        name: 'Test Project'
      };

      // Mock canUserManageMembers to return true
      jest.spyOn(projectRepository, 'canUserManageMembers').mockResolvedValue(true);

      // Mock getProjectById
      jest.spyOn(projectRepository, 'getProjectById').mockResolvedValueOnce(mockProject);

      // Mock check user to remove - is creator
      mockSingle.mockResolvedValueOnce({
        data: { member_role: 'creator' },
        error: null
      });

      await expect(
        projectRepository.removeUserFromProject(1, 1, 1)
      ).rejects.toThrow('Cannot remove the project creator');
    });

    test('should handle user not member error', async () => {
      const mockProject = {
        id: 1,
        name: 'Test Project'
      };

      jest.spyOn(projectRepository, 'canUserManageMembers').mockResolvedValue(true);
      jest.spyOn(projectRepository, 'getProjectById').mockResolvedValueOnce(mockProject);

      // Mock user not found in project
      const singleMock = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' }
      });

      const eqMock2 = jest.fn().mockReturnValue({
        single: singleMock
      });

      const eqMock1 = jest.fn().mockReturnValue({
        eq: eqMock2
      });

      mockSelect.mockReturnValue({
        eq: eqMock1
      });

      await expect(
        projectRepository.removeUserFromProject(1, 999, 1)
      ).rejects.toThrow('User is not a member of this project');
    });

    test('should prevent non-manager from removing themselves', async () => {
      const mockProject = {
        id: 1,
        name: 'Test Project'
      };

      jest.spyOn(projectRepository, 'canUserManageMembers').mockResolvedValue(true);
      jest.spyOn(projectRepository, 'getProjectById').mockResolvedValueOnce(mockProject);

      // Mock user is a collaborator trying to remove themselves
      const singleMock = jest.fn().mockResolvedValue({
        data: { member_role: 'collaborator' },
        error: null
      });

      const eqMock2 = jest.fn().mockReturnValue({
        single: singleMock
      });

      const eqMock1 = jest.fn().mockReturnValue({
        eq: eqMock2
      });

      mockSelect.mockReturnValue({
        eq: eqMock1
      });

      await expect(
        projectRepository.removeUserFromProject(1, 2, 2)
      ).rejects.toThrow('You cannot remove yourself from the project');
    });

    test('should handle deletion error', async () => {
      const mockProject = {
        id: 1,
        name: 'Test Project'
      };

      jest.spyOn(projectRepository, 'canUserManageMembers').mockResolvedValue(true);
      jest.spyOn(projectRepository, 'getProjectById').mockResolvedValueOnce(mockProject);

      // Mock user check - is collaborator
      const singleMock = jest.fn().mockResolvedValue({
        data: { member_role: 'collaborator' },
        error: null
      });

      const eqMock2 = jest.fn().mockReturnValue({
        single: singleMock
      });

      const eqMock1 = jest.fn().mockReturnValue({
        eq: eqMock2
      });

      mockSelect.mockReturnValue({
        eq: eqMock1
      });

      // Mock deletion error
      const deleteEqMock2 = jest.fn().mockResolvedValue({
        error: { message: 'Delete failed' }
      });

      const deleteEqMock1 = jest.fn().mockReturnValue({
        eq: deleteEqMock2
      });

      mockDelete.mockReturnValue({
        eq: deleteEqMock1
      });

      await expect(
        projectRepository.removeUserFromProject(1, 2, 1)
      ).rejects.toThrow('Delete failed');
    });
  });

  describe('canUserManageMembers', () => {
    test('should return true for creator', async () => {
      // Mock project data - user IS the creator
      mockSingle
        .mockResolvedValueOnce({
          data: { id: 1, creator_id: 1 },
          error: null
        });

      const result = await projectRepository.canUserManageMembers(1, 1);

      expect(result).toBe(true);
    });

    test('should return true for manager', async () => {
      // Mock project data - user is NOT the creator
      mockSingle
        .mockResolvedValueOnce({
          data: { id: 1, creator_id: 2 },
          error: null
        })
        // Mock user data - user is a system manager
        .mockResolvedValueOnce({
          data: { role: 'manager', hierarchy: 2, division: 'Engineering' },
          error: null
        })
        // Mock project creator data
        .mockResolvedValueOnce({
          data: { role: 'staff', hierarchy: 1, division: 'Engineering' },
          error: null
        });

      const result = await projectRepository.canUserManageMembers(1, 1);

      expect(result).toBe(true);
    });

    test('should return false for collaborator', async () => {
      // Reset all mocks to ensure clean state
      jest.clearAllMocks();
      mockSingle.mockReset();
      mockSelect.mockReset();

      // Mock project data - user 2 is NOT the creator (creator is user 3)
      const projectEqMock = jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { id: 1, creator_id: 3 },
          error: null
        })
      });

      // Mock user data - user 2 is NOT a system manager (is staff)
      const userEqMock = jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { role: 'staff', hierarchy: 1, division: 'Engineering' },
          error: null
        })
      });

      // Mock member data - user 2 is a collaborator
      // This needs to handle .eq().eq().single() chain
      const memberEqMock2 = jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { member_role: 'collaborator' },
          error: null
        })
      });

      const memberEqMock1 = jest.fn().mockReturnValue({
        eq: memberEqMock2
      });

      // Setup the mock chain to return the appropriate eq mock for each call
      let callCount = 0;
      mockSelect.mockImplementation(() => {
        callCount++;
        if (callCount === 1) { // First call: project data - .eq().single()
          return { eq: projectEqMock };
        } else if (callCount === 2) { // Second call: user data - .eq().single()
          return { eq: userEqMock };
        } else { // Third call: member data - .eq().eq().single()
          return { eq: memberEqMock1 };
        }
      });

      const result = await projectRepository.canUserManageMembers(1, 2);

      expect(result).toBe(false);
    });

    test('should return false when user not in project', async () => {
      // Reset all mocks to ensure clean state
      jest.clearAllMocks();
      mockSingle.mockReset();
      mockSelect.mockReset();

      // Mock project data - user 999 is NOT the creator
      const projectEqMock = jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { id: 1, creator_id: 1 },
          error: null
        })
      });

      // Mock user data - user 999 is NOT a manager (is staff)
      const userEqMock = jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: { role: 'staff', hierarchy: 1, division: 'Engineering' },
          error: null
        })
      });

      // Mock member data - user NOT found
      // This needs to handle .eq().eq().single() chain
      const memberEqMock2 = jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }
        })
      });

      const memberEqMock1 = jest.fn().mockReturnValue({
        eq: memberEqMock2
      });

      // Setup the mock chain to return the appropriate eq mock for each call
      let callCount = 0;
      mockSelect.mockImplementation(() => {
        callCount++;
        if (callCount === 1) { // First call: project data - .eq().single()
          return { eq: projectEqMock };
        } else if (callCount === 2) { // Second call: user data - .eq().single()
          return { eq: userEqMock };
        } else { // Third call: member data - .eq().eq().single()
          return { eq: memberEqMock1 };
        }
      });

      const result = await projectRepository.canUserManageMembers(1, 999);

      expect(result).toBe(false);
    });

    test('should return false when project not found', async () => {
      jest.clearAllMocks();
      mockSingle.mockReset();
      mockSelect.mockReset();

      // Mock project data - project not found
      const projectEqMock = jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Project not found' }
        })
      });

      mockSelect.mockReturnValue({
        eq: projectEqMock
      });

      const result = await projectRepository.canUserManageMembers(999, 1);

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

      // Create separate mock chain for this test
      const firstEqMock = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: [mockArchivedProject],
          error: null
        })
      });

      const secondEqMock = jest.fn().mockResolvedValue({
        error: null
      });

      // Setup mock update to return different eq chains
      mockUpdate
        .mockReturnValueOnce({ eq: firstEqMock })  // First call: update().eq().select()
        .mockReturnValueOnce({ eq: secondEqMock }); // Second call: update().eq()

      const result = await projectRepository.archiveProject(1);

      expect(result).toEqual(mockArchivedProject);
    });

    test('should handle error during project archiving', async () => {
      // Mock failed project archiving
      mockSelect.mockResolvedValue({
        data: null,
        error: { message: 'Failed to archive project' }
      });

      await expect(projectRepository.archiveProject(1)).rejects.toThrow('Failed to archive project');
    });

    test('should handle error during task archiving', async () => {
      // First call succeeds: project update -> update().eq().select()
      const firstEqMock = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: [{ id: 1, status: 'archived' }],
          error: null
        })
      });

      // Second call fails: task archiving -> update().eq()
      const secondEqMock = jest.fn().mockResolvedValue({
        error: { message: 'Failed to archive tasks' }
      });

      mockUpdate
        .mockReturnValueOnce({ eq: firstEqMock })
        .mockReturnValueOnce({ eq: secondEqMock });

      await expect(projectRepository.archiveProject(1)).rejects.toThrow('Failed to archive tasks');
    });
  });

  describe('delete', () => {
    test('should delete project successfully', async () => {
      // Mock member deletion
      mockEq.mockResolvedValueOnce({
        error: null
      });

      // Mock project deletion
      mockEq.mockResolvedValueOnce({
        error: null
      });

      const result = await projectRepository.delete(1);

      expect(result).toBe(true);
    });

    test('should handle error during member deletion', async () => {
      mockEq.mockResolvedValue({
        error: { message: 'Failed to delete members' }
      });

      await expect(projectRepository.delete(1)).rejects.toThrow('Failed to delete project members: Failed to delete members');
    });

    test('should handle error during project deletion', async () => {
      // Mock successful member deletion
      mockEq.mockResolvedValueOnce({
        error: null
      });

      // Mock failed project deletion
      mockEq.mockResolvedValueOnce({
        error: { message: 'Failed to delete project' }
      });

      await expect(projectRepository.delete(1)).rejects.toThrow('Failed to delete project: Failed to delete project');
    });
  });

  // Test missing methods for better coverage
  describe('getProjectIdsForUser', () => {
    test('should return project IDs for user', async () => {
      const mockData = [
        { project_id: 1 },
        { project_id: 2 },
        { project_id: 3 }
      ];

      mockEq.mockResolvedValue({
        data: mockData,
        error: null
      });

      const result = await projectRepository.getProjectIdsForUser(1);

      expect(supabase.from).toHaveBeenCalledWith('project_members');
      expect(mockSelect).toHaveBeenCalledWith('project_id');
      expect(mockEq).toHaveBeenCalledWith('user_id', 1);
      expect(result).toEqual([1, 2, 3]);
    });

    test('should return empty array when no projects found', async () => {
      mockEq.mockResolvedValue({
        data: null,
        error: null
      });

      const result = await projectRepository.getProjectIdsForUser(1);

      expect(result).toEqual([]);
    });

    test('should handle database error', async () => {
      mockEq.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      await expect(projectRepository.getProjectIdsForUser(1)).rejects.toThrow('Database error');
    });
  });

  describe('getProjectIdsByCreator', () => {
    test('should return project IDs created by user', async () => {
      const mockData = [
        { project_id: 1 },
        { project_id: 2 }
      ];

      // Mock the chain: .select().eq().eq()
      const eqMock2 = jest.fn().mockResolvedValue({
        data: mockData,
        error: null
      });

      const eqMock1 = jest.fn().mockReturnValue({
        eq: eqMock2
      });

      mockSelect.mockReturnValue({
        eq: eqMock1
      });

      const result = await projectRepository.getProjectIdsByCreator(1);

      expect(supabase.from).toHaveBeenCalledWith('project_members');
      expect(result).toEqual([1, 2]);
    });

    test('should return empty array when user has no creator projects', async () => {
      const eqMock2 = jest.fn().mockResolvedValue({
        data: [],
        error: null
      });

      const eqMock1 = jest.fn().mockReturnValue({
        eq: eqMock2
      });

      mockSelect.mockReturnValue({
        eq: eqMock1
      });

      const result = await projectRepository.getProjectIdsByCreator(1);

      expect(result).toEqual([]);
    });

    test('should handle database error', async () => {
      const eqMock2 = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      const eqMock1 = jest.fn().mockReturnValue({
        eq: eqMock2
      });

      mockSelect.mockReturnValue({
        eq: eqMock1
      });

      await expect(projectRepository.getProjectIdsByCreator(1)).rejects.toThrow('Database error');
    });
  });

  describe('getProjectsByIds', () => {
    test('should return projects by IDs', async () => {
      const mockProjects = [
        { id: 1, name: 'Project 1' },
        { id: 2, name: 'Project 2' }
      ];

      mockIn.mockResolvedValue({
        data: mockProjects,
        error: null
      });

      const result = await projectRepository.getProjectsByIds([1, 2]);

      expect(supabase.from).toHaveBeenCalledWith('projects');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockIn).toHaveBeenCalledWith('id', [1, 2]);
      expect(result).toEqual(mockProjects);
    });

    test('should return empty array when no IDs provided', async () => {
      const result = await projectRepository.getProjectsByIds([]);

      expect(result).toEqual([]);
    });

    test('should return empty array when IDs is null', async () => {
      const result = await projectRepository.getProjectsByIds(null);

      expect(result).toEqual([]);
    });

    test('should handle database error', async () => {
      mockIn.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      await expect(projectRepository.getProjectsByIds([1, 2])).rejects.toThrow('Database error');
    });

    test('should return empty array when no projects found', async () => {
      mockIn.mockResolvedValue({
        data: null,
        error: null
      });

      const result = await projectRepository.getProjectsByIds([999, 998]);

      expect(result).toEqual([]);
    });
  });

  describe('getUsersByIds', () => {
    test('should return users by IDs', async () => {
      const mockUsers = [
        { id: 1, email: 'user1@test.com', name: 'User 1', role: 'staff' },
        { id: 2, email: 'user2@test.com', name: 'User 2', role: 'manager' }
      ];

      mockIn.mockResolvedValue({
        data: mockUsers,
        error: null
      });

      const result = await projectRepository.getUsersByIds([1, 2]);

      expect(supabase.from).toHaveBeenCalledWith('users');
      expect(mockSelect).toHaveBeenCalledWith('id, email, name, role');
      expect(mockIn).toHaveBeenCalledWith('id', [1, 2]);
      expect(result).toEqual(mockUsers);
    });

    test('should return empty array when no IDs provided', async () => {
      const result = await projectRepository.getUsersByIds([]);

      expect(result).toEqual([]);
    });

    test('should return empty array when IDs is null', async () => {
      const result = await projectRepository.getUsersByIds(null);

      expect(result).toEqual([]);
    });

    test('should handle database error', async () => {
      mockIn.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      await expect(projectRepository.getUsersByIds([1, 2])).rejects.toThrow('Database error');
    });

    test('should return empty array when no users found', async () => {
      mockIn.mockResolvedValue({
        data: null,
        error: null
      });

      const result = await projectRepository.getUsersByIds([999, 998]);

      expect(result).toEqual([]);
    });
  });

  describe('getTaskCountByProject', () => {
    test('should return task count for project', async () => {
      // Mock the count query response structure
      mockEq.mockResolvedValue({
        count: 5,
        error: null
      });

      const result = await projectRepository.getTaskCountByProject(1);

      expect(supabase.from).toHaveBeenCalledWith('tasks');
      expect(mockSelect).toHaveBeenCalledWith('id', { count: 'exact', head: true });
      expect(mockEq).toHaveBeenCalledWith('project_id', 1);
      expect(result).toBe(5);
    });

    test('should return 0 when no tasks found', async () => {
      mockEq.mockResolvedValue({
        count: null,
        error: null
      });

      const result = await projectRepository.getTaskCountByProject(1);

      expect(result).toBe(0);
    });

    test('should return 0 on database error', async () => {
      mockEq.mockResolvedValue({
        count: null,
        error: { message: 'Database error' }
      });

      const result = await projectRepository.getTaskCountByProject(1);

      expect(result).toBe(0);
    });
  });

  describe('getProjectMembersWithDetails', () => {
    test('should return project members with user details', async () => {
      const mockData = [
        {
          user_id: 1,
          member_role: 'creator',
          added_at: '2024-01-01',
          users: { id: 1, email: 'user1@test.com', name: 'User 1' }
        },
        {
          user_id: 2,
          member_role: 'collaborator',
          added_at: '2024-01-02',
          users: { id: 2, email: 'user2@test.com', name: 'User 2' }
        }
      ];

      mockNot.mockResolvedValue({
        data: mockData,
        error: null
      });

      const result = await projectRepository.getProjectMembersWithDetails(1);

      expect(supabase.from).toHaveBeenCalledWith('project_members');
      expect(mockEq).toHaveBeenCalledWith('project_id', 1);
      expect(mockNot).toHaveBeenCalledWith('users', 'is', null);
      expect(result).toEqual(mockData);
    });

    test('should filter out members with null users', async () => {
      const mockData = [
        {
          user_id: 1,
          member_role: 'creator',
          added_at: '2024-01-01',
          users: { id: 1, email: 'user1@test.com', name: 'User 1' }
        },
        {
          user_id: 2,
          member_role: 'collaborator',
          added_at: '2024-01-02',
          users: null
        },
        {
          user_id: 3,
          member_role: 'collaborator',
          added_at: '2024-01-03',
          users: { id: null }
        }
      ];

      mockNot.mockResolvedValue({
        data: mockData,
        error: null
      });

      const result = await projectRepository.getProjectMembersWithDetails(1);

      // Should filter out records where users is null or users.id is null
      expect(result).toHaveLength(1);
      expect(result[0].user_id).toBe(1);
    });

    test('should handle database error', async () => {
      mockNot.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      await expect(projectRepository.getProjectMembersWithDetails(1)).rejects.toThrow('Database error');
    });

    test('should return empty array when no members found', async () => {
      mockNot.mockResolvedValue({
        data: null,
        error: null
      });

      const result = await projectRepository.getProjectMembersWithDetails(1);

      expect(result).toEqual([]);
    });
  });

  describe('cleanupOrphanedMembers', () => {
    test('should cleanup orphaned member records', async () => {
      jest.clearAllMocks();

      // Mock the first Supabase call to get project members
      const membersData = [{ user_id: 1 }, { user_id: 2 }, { user_id: 999 }];

      // Create a properly chained mock for the first query
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: membersData,
            error: null
          })
        })
      });

      // Mock the second Supabase call to get valid users
      const validUsers = [{ id: 1 }, { id: 2 }];

      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue({
          data: validUsers,
          error: null
        })
      });

      // Mock the delete call
      supabase.from.mockReturnValueOnce({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({
              error: null
            })
          })
        })
      });

      const result = await projectRepository.cleanupOrphanedMembers(1);

      expect(result).toBe(1); // One orphaned member (user_id: 999)
    });

    test('should return 0 when no orphaned members', async () => {
      jest.clearAllMocks();

      // Mock getting all members
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [{ user_id: 1 }, { user_id: 2 }],
            error: null
          })
        })
      });

      // Mock getting valid users - all members are valid
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue({
          data: [{ id: 1 }, { id: 2 }],
          error: null
        })
      });

      const result = await projectRepository.cleanupOrphanedMembers(1);

      expect(result).toBe(0);
    });

    test('should handle error fetching members', async () => {
      jest.clearAllMocks();

      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' }
          })
        })
      });

      await expect(projectRepository.cleanupOrphanedMembers(1)).rejects.toThrow('Database error');
    });

    test('should handle error fetching users', async () => {
      jest.clearAllMocks();

      // Mock getting members - succeeds
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [{ user_id: 1 }],
            error: null
          })
        })
      });

      // Mock getting users - fails
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'User fetch error' }
        })
      });

      await expect(projectRepository.cleanupOrphanedMembers(1)).rejects.toThrow('User fetch error');
    });

    test('should handle error during deletion', async () => {
      jest.clearAllMocks();

      // Mock getting members
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [{ user_id: 1 }, { user_id: 999 }],
            error: null
          })
        })
      });

      // Mock getting users
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue({
          data: [{ id: 1 }],
          error: null
        })
      });

      // Mock delete - fails
      supabase.from.mockReturnValueOnce({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({
              error: { message: 'Delete error' }
            })
          })
        })
      });

      await expect(projectRepository.cleanupOrphanedMembers(1)).rejects.toThrow('Delete error');
    });
  });

  describe('exists', () => {
    test('should return true when project exists', async () => {
      jest.spyOn(projectRepository, 'getProjectById').mockResolvedValue({
        id: 1,
        name: 'Test Project'
      });

      const result = await projectRepository.exists(1);

      expect(result).toBe(true);
    });

    test('should return false when project not found', async () => {
      jest.spyOn(projectRepository, 'getProjectById').mockRejectedValue(
        new Error('Project not found')
      );

      const result = await projectRepository.exists(999);

      expect(result).toBe(false);
    });

    test('should throw error for other errors', async () => {
      jest.spyOn(projectRepository, 'getProjectById').mockRejectedValue(
        new Error('Database connection error')
      );

      await expect(projectRepository.exists(1)).rejects.toThrow('Database connection error');
    });
  });

  describe('getProjectsByDivisionAndHierarchy', () => {
    test('should return projects by division and hierarchy', async () => {
      const mockUsers = [{ id: 2 }, { id: 3 }];
      const mockProjects = [
        { id: 1, name: 'Project 1', creator_id: 2 },
        { id: 2, name: 'Project 2', creator_id: 3 }
      ];

      // Mock getting users - .select().eq().lt()
      const ltMock = jest.fn().mockResolvedValue({
        data: mockUsers,
        error: null
      });

      const eqMock = jest.fn().mockReturnValue({
        lt: ltMock
      });

      // Mock getting projects - .select().in().order()
      const orderMock = jest.fn().mockResolvedValue({
        data: mockProjects,
        error: null
      });

      const inMock = jest.fn().mockReturnValue({
        order: orderMock
      });

      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // First call: get users
          return { eq: eqMock };
        } else {
          // Second call: get projects
          return { in: inMock };
        }
      });

      const result = await projectRepository.getProjectsByDivisionAndHierarchy('Engineering', 3);

      expect(result).toEqual(mockProjects);
    });

    test('should return empty array when no subordinate users found', async () => {
      const ltMock = jest.fn().mockResolvedValue({
        data: null,
        error: null
      });

      const eqMock = jest.fn().mockReturnValue({
        lt: ltMock
      });

      mockSelect.mockReturnValue({
        eq: eqMock
      });

      const result = await projectRepository.getProjectsByDivisionAndHierarchy('Engineering', 1);

      expect(result).toEqual([]);
    });

    test('should return empty array when users array is empty', async () => {
      const ltMock = jest.fn().mockResolvedValue({
        data: [],
        error: null
      });

      const eqMock = jest.fn().mockReturnValue({
        lt: ltMock
      });

      mockSelect.mockReturnValue({
        eq: eqMock
      });

      const result = await projectRepository.getProjectsByDivisionAndHierarchy('Engineering', 1);

      expect(result).toEqual([]);
    });

    test('should handle error fetching users', async () => {
      const ltMock = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'User fetch error' }
      });

      const eqMock = jest.fn().mockReturnValue({
        lt: ltMock
      });

      mockSelect.mockReturnValue({
        eq: eqMock
      });

      await expect(
        projectRepository.getProjectsByDivisionAndHierarchy('Engineering', 3)
      ).rejects.toThrow('User fetch error');
    });

    test('should handle error fetching projects', async () => {
      const mockUsers = [{ id: 2 }, { id: 3 }];

      const ltMock = jest.fn().mockResolvedValue({
        data: mockUsers,
        error: null
      });

      const eqMock = jest.fn().mockReturnValue({
        lt: ltMock
      });

      const orderMock = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Project fetch error' }
      });

      const inMock = jest.fn().mockReturnValue({
        order: orderMock
      });

      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return { eq: eqMock };
        } else {
          return { in: inMock };
        }
      });

      await expect(
        projectRepository.getProjectsByDivisionAndHierarchy('Engineering', 3)
      ).rejects.toThrow('Project fetch error');
    });

    test('should return empty array when no projects found', async () => {
      const mockUsers = [{ id: 2 }, { id: 3 }];

      const ltMock = jest.fn().mockResolvedValue({
        data: mockUsers,
        error: null
      });

      const eqMock = jest.fn().mockReturnValue({
        lt: ltMock
      });

      const orderMock = jest.fn().mockResolvedValue({
        data: null,
        error: null
      });

      const inMock = jest.fn().mockReturnValue({
        order: orderMock
      });

      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return { eq: eqMock };
        } else {
          return { in: inMock };
        }
      });

      const result = await projectRepository.getProjectsByDivisionAndHierarchy('Engineering', 3);

      expect(result).toEqual([]);
    });
  });

  describe('getAllProjectsEnhanced', () => {
    test('should return all projects with creator details', async () => {
      const mockProjects = [
        { id: 1, name: 'Project 1', creator_id: 1 },
        { id: 2, name: 'Project 2', creator_id: 2 }
      ];

      const mockCreators = [
        { id: 1, name: 'User 1', email: 'user1@test.com', role: 'manager', hierarchy: 2, division: 'Engineering' },
        { id: 2, name: 'User 2', email: 'user2@test.com', role: 'staff', hierarchy: 1, division: 'Marketing' }
      ];

      // Mock getting projects - .select().order()
      const orderMock = jest.fn().mockResolvedValue({
        data: mockProjects,
        error: null
      });

      // Mock getting creators - .select().in()
      const inMock = jest.fn().mockResolvedValue({
        data: mockCreators,
        error: null
      });

      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // First call: get projects
          return { order: orderMock };
        } else {
          // Second call: get creators
          return { in: inMock };
        }
      });

      const result = await projectRepository.getAllProjectsEnhanced();

      expect(result).toHaveLength(2);
      expect(result[0].users).toEqual(mockCreators[0]);
      expect(result[1].users).toEqual(mockCreators[1]);
    });

    test('should handle null creator data', async () => {
      const mockProjects = [
        { id: 1, name: 'Project 1', creator_id: 999 }
      ];

      const orderMock = jest.fn().mockResolvedValue({
        data: mockProjects,
        error: null
      });

      const inMock = jest.fn().mockResolvedValue({
        data: [],
        error: null
      });

      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return { order: orderMock };
        } else {
          return { in: inMock };
        }
      });

      const result = await projectRepository.getAllProjectsEnhanced();

      expect(result[0].users).toBeNull();
    });

    test('should return empty array when no projects found', async () => {
      const orderMock = jest.fn().mockResolvedValue({
        data: null,
        error: null
      });

      mockSelect.mockReturnValue({
        order: orderMock
      });

      const result = await projectRepository.getAllProjectsEnhanced();

      expect(result).toEqual([]);
    });

    test('should handle database error', async () => {
      const orderMock = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      mockSelect.mockReturnValue({
        order: orderMock
      });

      await expect(projectRepository.getAllProjectsEnhanced()).rejects.toThrow('Database error');
    });

    test('should handle empty projects array', async () => {
      const orderMock = jest.fn().mockResolvedValue({
        data: [],
        error: null
      });

      mockSelect.mockReturnValue({
        order: orderMock
      });

      const result = await projectRepository.getAllProjectsEnhanced();

      expect(result).toEqual([]);
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
        const spy = jest.spyOn(projectRepository, 'getProjectById').mockResolvedValue(mockProject);

        const result = await projectRepository.findById(1);

        expect(projectRepository.getProjectById).toHaveBeenCalledWith(1);
        expect(result).toEqual(mockProject);

        spy.mockRestore();
      });

      test('should handle project not found', async () => {
        const spy = jest.spyOn(projectRepository, 'getProjectById').mockRejectedValue(new Error('Project not found'));

        const result = await projectRepository.findById(999);

        expect(result).toBeNull();

        spy.mockRestore();
      });

      test('should throw error for other types of errors', async () => {
        const spy = jest.spyOn(projectRepository, 'getProjectById').mockRejectedValue(
          new Error('Database connection error')
        );

        await expect(projectRepository.findById(1)).rejects.toThrow('Database connection error');

        spy.mockRestore();
      });
    });

    describe('update', () => {
      test('should update project and return updated data', async () => {
        const mockUpdatedProject = {
          id: 1,
          name: 'Updated Project',
          project_members: [{ user_id: 1, member_role: 'creator' }],
          user_ids: [1]
        };

        mockSingle.mockResolvedValue({
          data: mockUpdatedProject,
          error: null
        });

        const result = await projectRepository.update(1, { name: 'Updated Project' });

        expect(supabase.from).toHaveBeenCalledWith('projects');
        expect(mockUpdate).toHaveBeenCalledWith({
          name: 'Updated Project',
          updated_at: expect.any(String)
        });
        expect(result).toEqual(mockUpdatedProject);
      });

      test('should handle error during update', async () => {
        mockSingle.mockResolvedValue({
          data: null,
          error: { message: 'Project not found' }
        });

        await expect(projectRepository.update(999, { name: 'Updated' })).rejects.toThrow('Project not found');
      });
    });
  });
});
