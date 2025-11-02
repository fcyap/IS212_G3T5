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
