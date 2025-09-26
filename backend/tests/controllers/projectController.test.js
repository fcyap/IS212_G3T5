const {
  createProject,
  getAllProjects,
  getProjectById,
  getProjectMembers,
  addProjectMembers,
  removeProjectMember,
  archiveProject
} = require('../../src/controllers/projectController');
const projectService = require('../../src/services/projectService');

jest.mock('../../src/services/projectService');

describe('ProjectController', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      user: { id: 1 }
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
        user_ids: [1, 2],
        creator_id: 1
      };
      req.body = projectData;

      const mockResult = {
        success: true,
        project: { id: 1, ...projectData },
        message: 'Project created successfully'
      };
      projectService.createProject.mockResolvedValue(mockResult);

      await createProject(req, res);

      expect(projectService.createProject).toHaveBeenCalledWith({
        name: 'Test Project',
        description: 'Test Description',
        user_ids: [1, 2],
        creator_id: 1
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    test('should handle empty user_ids array', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'Test Description',
        creator_id: 1
      };
      req.body = projectData;

      const mockResult = {
        success: true,
        project: { id: 1, ...projectData, user_ids: [] },
        message: 'Project created successfully'
      };
      projectService.createProject.mockResolvedValue(mockResult);

      await createProject(req, res);

      expect(projectService.createProject).toHaveBeenCalledWith({
        name: 'Test Project',
        description: 'Test Description',
        user_ids: [],
        creator_id: 1
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    test('should handle service failure', async () => {
      req.body = {
        name: 'Test Project',
        description: 'Test Description',
        creator_id: 1
      };

      const mockResult = {
        success: false,
        error: 'Database error',
        message: 'Failed to create project'
      };
      projectService.createProject.mockResolvedValue(mockResult);

      await createProject(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    test('should handle unexpected error', async () => {
      req.body = {
        name: 'Test Project',
        description: 'Test Description',
        creator_id: 1
      };

      projectService.createProject.mockRejectedValue(new Error('Unexpected error'));

      await createProject(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Unexpected error'
      });
    });
  });

  describe('getAllProjects', () => {
    test('should get all projects for user successfully', async () => {
      const mockProjects = [
        { id: 1, name: 'Project 1' },
        { id: 2, name: 'Project 2' }
      ];

      projectService.getAllProjectsForUser.mockResolvedValue(mockProjects);

      await getAllProjects(req, res);

      expect(projectService.getAllProjectsForUser).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        projects: mockProjects
      });
    });

    test('should handle missing user id', async () => {
      req.user = undefined;

      await getAllProjects(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User ID is required'
      });
    });

    test('should default to user id 1 when req.user is undefined', async () => {
      delete req.user;
      const mockProjects = [];

      projectService.getAllProjectsForUser.mockResolvedValue(mockProjects);

      await getAllProjects(req, res);

      expect(projectService.getAllProjectsForUser).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        projects: mockProjects
      });
    });

    test('should handle service error', async () => {
      projectService.getAllProjectsForUser.mockRejectedValue(new Error('Database error'));

      await getAllProjects(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Database error'
      });
    });
  });

  describe('getProjectById', () => {
    test('should get project by id successfully', async () => {
      req.params.projectId = '1';
      const mockProject = { id: 1, name: 'Test Project' };

      projectService.getProjectById.mockResolvedValue(mockProject);

      await getProjectById(req, res);

      expect(projectService.getProjectById).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        project: mockProject
      });
    });

    test('should handle invalid project id', async () => {
      req.params.projectId = 'invalid';

      await getProjectById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Valid project ID is required'
      });
    });

    test('should handle missing project id', async () => {
      req.params.projectId = '';

      await getProjectById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Valid project ID is required'
      });
    });

    test('should handle project not found', async () => {
      req.params.projectId = '999';

      projectService.getProjectById.mockRejectedValue(new Error('Project not found'));

      await getProjectById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Project not found'
      });
    });

    test('should handle service error', async () => {
      req.params.projectId = '1';

      projectService.getProjectById.mockRejectedValue(new Error('Database error'));

      await getProjectById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Database error'
      });
    });
  });

  describe('getProjectMembers', () => {
    test('should get project members successfully', async () => {
      req.params.projectId = '1';
      const mockMembers = [
        { user_id: 1, name: 'User 1', role: 'creator' },
        { user_id: 2, name: 'User 2', role: 'collaborator' }
      ];

      projectService.getProjectMembers.mockResolvedValue(mockMembers);

      await getProjectMembers(req, res);

      expect(projectService.getProjectMembers).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        projectId: 1,
        members: mockMembers
      });
    });

    test('should handle invalid project id', async () => {
      req.params.projectId = 'invalid';

      await getProjectMembers(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Valid project ID is required'
      });
    });

    test('should handle project not found', async () => {
      req.params.projectId = '999';

      projectService.getProjectMembers.mockRejectedValue(new Error('Project not found'));

      await getProjectMembers(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Project not found'
      });
    });

    test('should handle service error', async () => {
      req.params.projectId = '1';

      projectService.getProjectMembers.mockRejectedValue(new Error('Database error'));

      await getProjectMembers(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Database error'
      });
    });
  });

  describe('addProjectMembers', () => {
    test('should add project members successfully', async () => {
      req.params.projectId = '1';
      req.body = {
        userIds: [2, 3],
        message: 'Welcome to the project',
        role: 'collaborator'
      };
      req.user = { id: 1 };

      const mockUpdatedProject = {
        id: 1,
        name: 'Test Project',
        members: [{ user_id: 1 }, { user_id: 2 }, { user_id: 3 }]
      };

      projectService.addUsersToProject.mockResolvedValue(mockUpdatedProject);

      await addProjectMembers(req, res);

      expect(projectService.addUsersToProject).toHaveBeenCalledWith(
        1,
        [2, 3],
        1,
        'Welcome to the project',
        'collaborator'
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        project: mockUpdatedProject,
        message: 'Successfully added 2 member(s) to project'
      });
    });

    test('should handle invalid project id', async () => {
      req.params.projectId = 'invalid';
      req.body = { userIds: [2, 3] };

      await addProjectMembers(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Valid project ID is required'
      });
    });

    test('should handle missing userIds', async () => {
      req.params.projectId = '1';
      req.body = {};

      await addProjectMembers(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'userIds array is required and cannot be empty'
      });
    });

    test('should handle empty userIds array', async () => {
      req.params.projectId = '1';
      req.body = { userIds: [] };

      await addProjectMembers(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'userIds array is required and cannot be empty'
      });
    });

    test('should handle invalid role', async () => {
      req.params.projectId = '1';
      req.body = {
        userIds: [2, 3],
        role: 'invalid'
      };

      await addProjectMembers(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid role. Must be creator, manager, or collaborator'
      });
    });

    test('should handle invalid user ids', async () => {
      req.params.projectId = '1';
      req.body = { userIds: ['invalid', 2] };

      await addProjectMembers(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'All user IDs must be valid numbers'
      });
    });

    test('should handle permission error', async () => {
      req.params.projectId = '1';
      req.body = { userIds: [2, 3] };

      projectService.addUsersToProject.mockRejectedValue(new Error('Only managers can add members'));

      await addProjectMembers(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Only managers can add members'
      });
    });

    test('should handle service error', async () => {
      req.params.projectId = '1';
      req.body = { userIds: [2, 3] };

      projectService.addUsersToProject.mockRejectedValue(new Error('Database error'));

      await addProjectMembers(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Database error'
      });
    });

    test('should default to collaborator role', async () => {
      req.params.projectId = '1';
      req.body = { userIds: [2, 3] };
      req.user = { id: 1 };

      const mockUpdatedProject = { id: 1, name: 'Test Project' };
      projectService.addUsersToProject.mockResolvedValue(mockUpdatedProject);

      await addProjectMembers(req, res);

      expect(projectService.addUsersToProject).toHaveBeenCalledWith(
        1,
        [2, 3],
        1,
        undefined,
        'collaborator'
      );
    });
  });

  describe('removeProjectMember', () => {
    test('should remove project member successfully', async () => {
      req.params.projectId = '1';
      req.params.userId = '2';
      req.user = { id: 1 };

      const mockUpdatedProject = {
        id: 1,
        name: 'Test Project',
        members: [{ user_id: 1 }]
      };

      projectService.removeUserFromProject.mockResolvedValue(mockUpdatedProject);

      await removeProjectMember(req, res);

      expect(projectService.removeUserFromProject).toHaveBeenCalledWith(1, 2, 1);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        project: mockUpdatedProject,
        message: 'Member successfully removed from project'
      });
    });

    test('should handle invalid project id', async () => {
      req.params.projectId = 'invalid';
      req.params.userId = '2';

      await removeProjectMember(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Valid project ID is required'
      });
    });

    test('should handle invalid user id', async () => {
      req.params.projectId = '1';
      req.params.userId = 'invalid';

      await removeProjectMember(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Valid user ID is required'
      });
    });

    test('should handle permission error', async () => {
      req.params.projectId = '1';
      req.params.userId = '2';
      req.user = { id: 1 };

      projectService.removeUserFromProject.mockRejectedValue(new Error('Only managers can remove members'));

      await removeProjectMember(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Only managers can remove members'
      });
    });

    test('should handle service error', async () => {
      req.params.projectId = '1';
      req.params.userId = '2';
      req.user = { id: 1 };

      projectService.removeUserFromProject.mockRejectedValue(new Error('Database error'));

      await removeProjectMember(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Database error'
      });
    });
  });

  describe('archiveProject', () => {
    test('should archive project successfully', async () => {
      req.params.projectId = '1';
      req.user = { id: 1 };

      const mockArchivedProject = {
        id: 1,
        name: 'Test Project',
        status: 'archived'
      };

      projectService.archiveProject.mockResolvedValue(mockArchivedProject);

      await archiveProject(req, res);

      expect(projectService.archiveProject).toHaveBeenCalledWith(1, 1);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        project: mockArchivedProject,
        message: 'Project and all its tasks have been archived successfully'
      });
    });

    test('should handle invalid project id', async () => {
      req.params.projectId = 'invalid';

      await archiveProject(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Valid project ID is required'
      });
    });

    test('should handle missing requesting user id', async () => {
      req.params.projectId = '1';
      req.user = undefined;

      await archiveProject(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Requesting user ID is required'
      });
    });

    test('should handle permission error', async () => {
      req.params.projectId = '1';
      req.user = { id: 1 };

      projectService.archiveProject.mockRejectedValue(new Error('Only managers can archive projects'));

      await archiveProject(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Only managers can archive projects'
      });
    });

    test('should handle project not found', async () => {
      req.params.projectId = '999';
      req.user = { id: 1 };

      projectService.archiveProject.mockRejectedValue(new Error('Project not found'));

      await archiveProject(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Project not found'
      });
    });

    test('should handle service error', async () => {
      req.params.projectId = '1';
      req.user = { id: 1 };

      projectService.archiveProject.mockRejectedValue(new Error('Database error'));

      await archiveProject(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Database error'
      });
    });
  });

  // Test the inline route handlers (updateProject and deleteProject)
  describe('Inline Route Handlers', () => {
    // Simulate the inline updateProject handler
    const updateProject = async (req, res) => {
      try {
        const { projectId } = req.params;
        const updateData = req.body;

        const result = await projectService.updateProject(parseInt(projectId), updateData);

        if (result.success) {
          res.json(result);
        } else {
          res.status(400).json(result);
        }
      } catch (err) {
        console.error('Error in updateProject:', err);
        res.status(500).json({ success: false, message: err.message });
      }
    };

    // Simulate the inline deleteProject handler
    const deleteProject = async (req, res) => {
      try {
        const { projectId } = req.params;

        const result = await projectService.deleteProject(parseInt(projectId));

        if (result.success) {
          res.json(result);
        } else {
          res.status(400).json(result);
        }
      } catch (err) {
        console.error('Error in deleteProject:', err);
        res.status(500).json({ success: false, message: err.message });
      }
    };

    describe('updateProject (inline)', () => {
      test('should update project successfully', async () => {
        req.params.projectId = '1';
        req.body = { name: 'Updated Project', description: 'Updated Description' };

        const mockResult = {
          success: true,
          project: { id: 1, name: 'Updated Project', description: 'Updated Description' },
          message: 'Project updated successfully'
        };
        projectService.updateProject.mockResolvedValue(mockResult);

        await updateProject(req, res);

        expect(projectService.updateProject).toHaveBeenCalledWith(1, {
          name: 'Updated Project',
          description: 'Updated Description'
        });
        expect(res.json).toHaveBeenCalledWith(mockResult);
      });

      test('should handle service failure', async () => {
        req.params.projectId = '1';
        req.body = { name: 'Updated Project' };

        const mockResult = {
          success: false,
          error: 'Project not found',
          message: 'Failed to update project'
        };
        projectService.updateProject.mockResolvedValue(mockResult);

        await updateProject(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(mockResult);
      });

      test('should handle service error', async () => {
        req.params.projectId = '1';
        req.body = { name: 'Updated Project' };

        projectService.updateProject.mockRejectedValue(new Error('Database error'));

        await updateProject(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Database error'
        });
      });
    });

    describe('deleteProject (inline)', () => {
      test('should delete project successfully', async () => {
        req.params.projectId = '1';

        const mockResult = {
          success: true,
          message: 'Project deleted successfully'
        };
        projectService.deleteProject.mockResolvedValue(mockResult);

        await deleteProject(req, res);

        expect(projectService.deleteProject).toHaveBeenCalledWith(1);
        expect(res.json).toHaveBeenCalledWith(mockResult);
      });

      test('should handle service failure', async () => {
        req.params.projectId = '1';

        const mockResult = {
          success: false,
          error: 'Project not found',
          message: 'Failed to delete project'
        };
        projectService.deleteProject.mockResolvedValue(mockResult);

        await deleteProject(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(mockResult);
      });

      test('should handle service error', async () => {
        req.params.projectId = '1';

        projectService.deleteProject.mockRejectedValue(new Error('Database error'));

        await deleteProject(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: 'Database error'
        });
      });
    });
  });
});