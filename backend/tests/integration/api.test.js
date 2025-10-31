const request = require('supertest');
const express = require('express');
const cors = require('cors');

const supabaseMock = {
  from: jest.fn(),
  storage: {
    from: jest.fn()
  }
};

const createQueryMock = (rows = []) => {
  const resultPromise = Promise.resolve({ data: rows, error: null });
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    in: jest.fn(() => resultPromise),
    limit: jest.fn(() => resultPromise),
    single: jest.fn(() =>
      Promise.resolve({
        data: rows[0] ?? null,
        error: rows.length ? null : { code: 'PGRST116' }
      })
    )
  };
  return query;
};

jest.mock('../../src/middleware/logger', () => ({
  createLoggerMiddleware: jest.fn().mockResolvedValue((req, res, next) => next()),
  logError: jest.fn()
}));

jest.mock('../../src/utils/supabase', () => supabaseMock);
jest.mock('../../src/supabase-client', () => ({ supabase: supabaseMock }));
jest.mock('../../src/middleware/rbac', () => ({
  requireProjectCreation: () => (req, _res, next) => next(),
  requireProjectEdit: () => (req, _res, next) => next(),
  requireAddProjectMembers: () => (req, _res, next) => next(),
  filterVisibleProjects: () => {
    return (req, _res, next) => {
      req.visibilityFilter = {};
      next();
    };
  },
  requireTaskCreation: () => (_req, _res, next) => next(),
  requireTaskModification: () => (_req, _res, next) => next()
}));

jest.mock('../../src/services/projectService');

const projectRoutes = require('../../src/routes/projects');
const projectTasksRoutes = require('../../src/routes/projectTasks');
const projectService = require('../../src/services/projectService');

describe('API Integration Tests', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Mock user middleware for testing - includes RBAC fields
    app.use((req, res, next) => {
      req.user = {
        id: 1,
        user_id: 1,
        role: 'admin',
        hierarchy: 10,
        division: 'Engineering'
      };
      res.locals.session = {
        user_id: 1,
        role: 'admin',
        hierarchy: 10,
        division: 'Engineering'
      };
      next();
    });

    app.get('/', (req, res) => {
      res.json({
        message: 'Project Management Backend API',
        version: '1.0.0',
        endpoints: {
          projects: '/api/projects'
        }
      });
    });

    app.use('/api/projects', projectRoutes);
    app.use('/api/projects', projectTasksRoutes);

    app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: 'Route not found',
        message: `Route ${req.originalUrl} not found`
      });
    });

    app.use((err, req, res, next) => {
      console.error('Unhandled error:', err);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();

    supabaseMock.from.mockImplementation((table) => {
      if (table === 'users') {
        return createQueryMock([{
          id: 1,
          name: 'Test User',
          email: 'test@example.com',
          role: 'admin',
          hierarchy: 10,
          division: 'Engineering',
          department: 'Backend'
        }]);
      }

      if (table === 'projects') {
        return {
          ...createQueryMock([{
            id: 1,
            creator_id: 1,
            users: {
              role: 'admin',
              hierarchy: 10,
              division: 'Engineering'
            }
          }]]),
          update: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ data: [{ id: 1 }], error: null }))
          }))
        };
      }

      if (table === 'project_members') {
        return createQueryMock([{ project_id: 1, user_id: 1 }]);
      }

      if (table === 'tasks') {
        return createQueryMock([{
          id: 1,
          project_id: 1,
          assigned_to: [1],
          project_creator_id: 1,
          project_members: [1]
        }]);
      }

      return createQueryMock([]);
    });
  });

  describe('GET /', () => {
    test('should return API information', async () => {
      const response = await request(app).get('/');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Project Management Backend API',
        version: '1.0.0',
        endpoints: {
          projects: '/api/projects'
        }
      });
    });
  });

  describe('Projects API', () => {
    describe('POST /api/projects', () => {
      test('should create a new project', async () => {
        const projectData = {
          name: 'Test Project',
          description: 'Test Description',
          creator_id: 1
        };

        const mockResult = {
          success: true,
          project: { id: 1, ...projectData },
          message: 'Project created successfully'
        };

        projectService.createProject.mockResolvedValue(mockResult);

        const response = await request(app)
          .post('/api/projects')
          .send(projectData);

        expect(response.status).toBe(201);
        expect(response.body).toEqual(mockResult);
        expect(projectService.createProject).toHaveBeenCalledWith({
          name: 'Test Project',
          description: 'Test Description',
          user_ids: [],
          creator_id: 1
        });
      });

      test('should handle project creation failure', async () => {
        const projectData = {
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

        const response = await request(app)
          .post('/api/projects')
          .send(projectData);

        expect(response.status).toBe(400);
        expect(response.body).toEqual(mockResult);
      });

      test('should handle service error during project creation', async () => {
        const projectData = {
          name: 'Test Project',
          description: 'Test Description',
          creator_id: 1
        };

        projectService.createProject.mockRejectedValue(new Error('Service error'));

        const response = await request(app)
          .post('/api/projects')
          .send(projectData);

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          success: false,
          message: 'Service error'
        });
      });
    });

    describe('GET /api/projects', () => {
      test('should get all projects for user', async () => {
        const mockProjects = [
          { id: 1, name: 'Project 1', role: 'creator' },
          { id: 2, name: 'Project 2', role: 'collaborator' }
        ];

        projectService.getProjectsWithRBAC.mockResolvedValue(mockProjects);

        const response = await request(app).get('/api/projects');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          projects: mockProjects,
          userRole: 'admin'
        });
        expect(projectService.getProjectsWithRBAC).toHaveBeenCalledWith({
          id: 1,
          name: 'Test User',
          email: 'test@example.com',
          role: 'admin',
          hierarchy: 10,
          division: 'Engineering',
          department: 'Backend'
        });
      });

      test('should handle service error when getting projects', async () => {
        projectService.getProjectsWithRBAC.mockRejectedValue(new Error('Database error'));

        const response = await request(app).get('/api/projects');

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          success: false,
          message: 'Database error'
        });
      });
    });

    describe('GET /api/projects/:projectId', () => {
      test('should get project by id', async () => {
        const mockProject = { id: 1, name: 'Test Project' };

        projectService.getProjectById.mockResolvedValue(mockProject);

        const response = await request(app).get('/api/projects/1');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          project: mockProject
        });
        expect(projectService.getProjectById).toHaveBeenCalledWith(1);
      });

      test('should handle invalid project id', async () => {
        const response = await request(app).get('/api/projects/invalid');

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          success: false,
          message: 'Valid project ID is required'
        });
      });

      test('should handle project not found', async () => {
        projectService.getProjectById.mockRejectedValue(new Error('Project not found'));

        const response = await request(app).get('/api/projects/999');

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
          success: false,
          message: 'Project not found'
        });
      });
    });

    describe('PUT /api/projects/:projectId', () => {
      test('should update project', async () => {
        const updateData = { name: 'Updated Project', description: 'Updated Description' };
        const mockResult = {
          success: true,
          project: { id: 1, ...updateData },
          message: 'Project updated successfully'
        };

        projectService.updateProject.mockResolvedValue(mockResult);

        const response = await request(app)
          .put('/api/projects/1')
          .send(updateData);

        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockResult);
        expect(projectService.updateProject).toHaveBeenCalledWith(1, updateData);
      });

      test('should handle update failure', async () => {
        const updateData = { name: 'Updated Project' };
        const mockResult = {
          success: false,
          error: 'Project not found',
          message: 'Failed to update project'
        };

        projectService.updateProject.mockResolvedValue(mockResult);

        const response = await request(app)
          .put('/api/projects/999')
          .send(updateData);

        expect(response.status).toBe(400);
        expect(response.body).toEqual(mockResult);
      });

      test('should handle service error during update', async () => {
        const updateData = { name: 'Updated Project' };

        projectService.updateProject.mockRejectedValue(new Error('Service error'));

        const response = await request(app)
          .put('/api/projects/1')
          .send(updateData);

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          success: false,
          message: 'Service error'
        });
      });
    });

    describe('DELETE /api/projects/:projectId', () => {
      test('should delete project', async () => {
        const mockResult = {
          success: true,
          message: 'Project deleted successfully'
        };

        projectService.deleteProject.mockResolvedValue(mockResult);

        const response = await request(app).delete('/api/projects/1');

        expect(response.status).toBe(200);
        expect(response.body).toEqual(mockResult);
        expect(projectService.deleteProject).toHaveBeenCalledWith(1);
      });

      test('should handle delete failure', async () => {
        const mockResult = {
          success: false,
          error: 'Project not found',
          message: 'Failed to delete project'
        };

        projectService.deleteProject.mockResolvedValue(mockResult);

        const response = await request(app).delete('/api/projects/999');

        expect(response.status).toBe(400);
        expect(response.body).toEqual(mockResult);
      });

      test('should handle service error during deletion', async () => {
        projectService.deleteProject.mockRejectedValue(new Error('Service error'));

        const response = await request(app).delete('/api/projects/1');

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
          success: false,
          message: 'Service error'
        });
      });
    });

    describe('GET /api/projects/:projectId/members', () => {
      test('should get project members', async () => {
        const mockMembers = [
          { user_id: 1, name: 'User 1', role: 'creator' },
          { user_id: 2, name: 'User 2', role: 'collaborator' }
        ];

        projectService.getProjectMembers.mockResolvedValue(mockMembers);

        const response = await request(app).get('/api/projects/1/members');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          projectId: 1,
          members: mockMembers
        });
        expect(projectService.getProjectMembers).toHaveBeenCalledWith(1);
      });

      test('should handle invalid project id', async () => {
        const response = await request(app).get('/api/projects/invalid/members');

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          success: false,
          message: 'Valid project ID is required'
        });
      });

      test('should handle project not found', async () => {
        projectService.getProjectMembers.mockRejectedValue(new Error('Project not found'));

        const response = await request(app).get('/api/projects/999/members');

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
          success: false,
          message: 'Project not found'
        });
      });
    });

    describe('POST /api/projects/:projectId/members', () => {
      test('should add members to project', async () => {
        const memberData = {
          userIds: [2, 3],
          message: 'Welcome to the project',
          role: 'collaborator'
        };

        const mockResult = {
          id: 1,
          name: 'Test Project',
          members: [{ user_id: 1 }, { user_id: 2 }, { user_id: 3 }]
        };

        projectService.addUsersToProject.mockResolvedValue(mockResult);

        const response = await request(app)
          .post('/api/projects/1/members')
          .send(memberData);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          project: mockResult,
          message: 'Successfully added 2 member(s) to project'
        });
        expect(projectService.addUsersToProject).toHaveBeenCalledWith(
          1,
          [2, 3],
          1,
          'Welcome to the project',
          'collaborator'
        );
      });

      test('should handle missing userIds', async () => {
        const response = await request(app)
          .post('/api/projects/1/members')
          .send({ role: 'collaborator' });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          success: false,
          message: 'userIds array is required and cannot be empty'
        });
      });

      test('should handle invalid role', async () => {
        const memberData = {
          userIds: [2, 3],
          role: 'invalid'
        };

        const response = await request(app)
          .post('/api/projects/1/members')
          .send(memberData);

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          success: false,
          message: 'Invalid role. Must be creator, manager, or collaborator'
        });
      });

      test('should handle permission error', async () => {
        const memberData = {
          userIds: [2, 3],
          role: 'collaborator'
        };

        projectService.addUsersToProject.mockRejectedValue(new Error('Only managers can add members'));

        const response = await request(app)
          .post('/api/projects/1/members')
          .send(memberData);

        expect(response.status).toBe(403);
        expect(response.body).toEqual({
          success: false,
          message: 'Only managers can add members'
        });
      });
    });

    describe('DELETE /api/projects/:projectId/members/:userId', () => {
      test('should remove member from project', async () => {
        const mockResult = {
          id: 1,
          name: 'Test Project',
          members: [{ user_id: 1 }]
        };

        projectService.removeUserFromProject.mockResolvedValue(mockResult);

        const response = await request(app).delete('/api/projects/1/members/2');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          project: mockResult,
          message: 'Member successfully removed from project'
        });
        expect(projectService.removeUserFromProject).toHaveBeenCalledWith(1, 2, 1);
      });

      test('should handle invalid project id', async () => {
        const response = await request(app).delete('/api/projects/invalid/members/2');

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          success: false,
          message: 'Valid project ID is required'
        });
      });

      test('should handle invalid user id', async () => {
        const response = await request(app).delete('/api/projects/1/members/invalid');

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          success: false,
          message: 'Valid user ID is required'
        });
      });

      test('should handle permission error', async () => {
        projectService.removeUserFromProject.mockRejectedValue(new Error('Only managers can remove members'));

        const response = await request(app).delete('/api/projects/1/members/2');

        expect(response.status).toBe(403);
        expect(response.body).toEqual({
          success: false,
          message: 'Only managers can remove members'
        });
      });
    });

    describe('PATCH /api/projects/:projectId/archive', () => {
      test('should archive project', async () => {
        const mockResult = {
          id: 1,
          name: 'Test Project',
          status: 'archived'
        };

        projectService.archiveProject.mockResolvedValue(mockResult);

        const response = await request(app).patch('/api/projects/1/archive');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          project: mockResult,
          message: 'Project and all its tasks have been archived successfully'
        });
        expect(projectService.archiveProject).toHaveBeenCalledWith(1, 1);
      });

      test('should handle invalid project id', async () => {
        const response = await request(app).patch('/api/projects/invalid/archive');

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          success: false,
          message: 'Valid project ID is required'
        });
      });

      test('should handle permission error', async () => {
        projectService.archiveProject.mockRejectedValue(new Error('Only managers can archive projects'));

        const response = await request(app).patch('/api/projects/1/archive');

        expect(response.status).toBe(403);
        expect(response.body).toEqual({
          success: false,
          message: 'Only managers can archive projects'
        });
      });

      test('should handle project not found', async () => {
        projectService.archiveProject.mockRejectedValue(new Error('Project not found'));

        const response = await request(app).patch('/api/projects/999/archive');

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
          success: false,
          message: 'Project not found'
        });
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle 404 for unknown routes', async () => {
      const response = await request(app).get('/api/unknown');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: 'Route not found',
        message: 'Route /api/unknown not found'
      });
    });

    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred'
      });
    });

    test('should handle empty request body for POST requests', async () => {
      // Mock the service to reject with validation error
      projectService.createProject.mockRejectedValue(
        new Error('Missing required fields: name and description are required')
      );

      const response = await request(app)
        .post('/api/projects')
        .send({});

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        message: 'Missing required fields: name and description are required'
      });
    });
  });

  describe('CORS', () => {
    test('should handle OPTIONS requests', async () => {
      const response = await request(app).options('/api/projects');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe('*');
    });
  });
});
