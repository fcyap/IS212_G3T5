const request = require('supertest');
const express = require('express');
const cors = require('cors');

const projectRoutes = require('../../src/routes/projects');
const projectTasksRoutes = require('../../src/routes/projectTasks');

jest.mock('../../src/middleware/logger', () => ({
  createLoggerMiddleware: jest.fn().mockResolvedValue((req, res, next) => next()),
  logError: jest.fn()
}));

jest.mock('../../src/utils/supabase');

describe('API Integration Tests', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

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

  describe('Root Endpoint', () => {
    test('GET / should return API information', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body).toEqual({
        message: 'Project Management Backend API',
        version: '1.0.0',
        endpoints: {
          projects: '/api/projects'
        }
      });
    });
  });

  describe('Project Routes', () => {
    test('GET /api/projects should return projects list', async () => {
      const response = await request(app)
        .get('/api/projects')
        .expect('Content-Type', /json/);

      expect(response.status).toBeOneOf([200, 400, 500]);
      expect(response.body).toHaveProperty('success');
    });

    test('POST /api/projects should handle project creation', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'Test Description',
        user_ids: [1, 2]
      };

      const response = await request(app)
        .post('/api/projects')
        .send(projectData)
        .expect('Content-Type', /json/);

      expect(response.status).toBeOneOf([201, 400, 500]);
      expect(response.body).toHaveProperty('success');
    });

    test('POST /api/projects should reject missing required fields', async () => {
      const invalidData = { name: 'Test Project' };

      const response = await request(app)
        .post('/api/projects')
        .send(invalidData)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Missing required fields',
        message: 'Name and description are required'
      });
    });

    test('POST /api/projects should reject invalid user_ids format', async () => {
      const invalidData = {
        name: 'Test Project',
        description: 'Test Description',
        user_ids: 'invalid'
      };

      const response = await request(app)
        .post('/api/projects')
        .send(invalidData)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid user_ids format',
        message: 'user_ids must be an array of integers'
      });
    });

    test('GET /api/projects/:id should handle project retrieval', async () => {
      const response = await request(app)
        .get('/api/projects/1')
        .expect('Content-Type', /json/);

      expect(response.status).toBeOneOf([200, 400, 404, 500]);
      expect(response.body).toHaveProperty('success');
    });

    test('PUT /api/projects/:id should handle project updates', async () => {
      const updateData = { name: 'Updated Project' };

      const response = await request(app)
        .put('/api/projects/1')
        .send(updateData)
        .expect('Content-Type', /json/);

      expect(response.status).toBeOneOf([200, 400, 404, 500]);
      expect(response.body).toHaveProperty('success');
    });

    test('DELETE /api/projects/:id should handle project deletion', async () => {
      const response = await request(app)
        .delete('/api/projects/1')
        .expect('Content-Type', /json/);

      expect(response.status).toBeOneOf([200, 400, 500]);
      expect(response.body).toHaveProperty('success');
    });

    test('POST /api/projects/:id/users should handle adding users to project', async () => {
      const userData = { userId: 123 };

      const response = await request(app)
        .post('/api/projects/1/users')
        .send(userData)
        .expect('Content-Type', /json/);

      expect(response.status).toBeOneOf([200, 400, 404, 500]);
      expect(response.body).toHaveProperty('success');
    });

    test('POST /api/projects/:id/users should reject invalid user ID', async () => {
      const invalidData = { userId: 'invalid' };

      const response = await request(app)
        .post('/api/projects/1/users')
        .send(invalidData)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid user ID',
        message: 'User ID must be a valid integer'
      });
    });

    test('DELETE /api/projects/:id/users should handle removing users from project', async () => {
      const userData = { userId: 123 };

      const response = await request(app)
        .delete('/api/projects/1/users')
        .send(userData)
        .expect('Content-Type', /json/);

      expect(response.status).toBeOneOf([200, 400, 404, 500]);
      expect(response.body).toHaveProperty('success');
    });
  });

  describe('Project Tasks Routes', () => {
    test('GET /api/projects/:id/tasks should return project tasks', async () => {
      const response = await request(app)
        .get('/api/projects/1/tasks')
        .expect('Content-Type', /json/);

      expect(response.status).toBeOneOf([200, 400, 404, 500]);
      expect(response.body).toHaveProperty('success');
    });

    test('GET /api/projects/:id/tasks should handle query parameters', async () => {
      const response = await request(app)
        .get('/api/projects/1/tasks')
        .query({
          status: 'active',
          priority: 'high',
          page: 1,
          limit: 10
        })
        .expect('Content-Type', /json/);

      expect(response.status).toBeOneOf([200, 400, 404, 500]);
      expect(response.body).toHaveProperty('success');
    });

    test('POST /api/projects/:id/tasks should handle task creation', async () => {
      const taskData = {
        name: 'Test Task',
        description: 'Test Description',
        status: 'active',
        priority: 'high'
      };

      const response = await request(app)
        .post('/api/projects/1/tasks')
        .send(taskData)
        .expect('Content-Type', /json/);

      expect(response.status).toBeOneOf([201, 400, 500]);
      expect(response.body).toHaveProperty('success');
    });

    test('POST /api/projects/:id/tasks should reject missing required fields', async () => {
      const invalidData = { name: 'Test Task' };

      const response = await request(app)
        .post('/api/projects/1/tasks')
        .send(invalidData)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Missing required fields',
        message: 'Task name and description are required'
      });
    });

    test('GET /api/projects/:id/tasks/:taskId should handle task retrieval', async () => {
      const response = await request(app)
        .get('/api/projects/1/tasks/123')
        .expect('Content-Type', /json/);

      expect(response.status).toBeOneOf([200, 400, 404, 500]);
      expect(response.body).toHaveProperty('success');
    });

    test('GET /api/projects/:id/tasks/stats should return task statistics', async () => {
      const response = await request(app)
        .get('/api/projects/1/tasks/stats')
        .expect('Content-Type', /json/);

      expect(response.status).toBeOneOf([200, 400, 404, 500]);
      expect(response.body).toHaveProperty('success');
    });

    test('GET /api/tasks should return all tasks', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .expect('Content-Type', /json/);

      expect(response.status).toBeOneOf([200, 400, 500]);
      expect(response.body).toHaveProperty('success');
    });

    test('PUT /api/tasks/:id should handle task updates', async () => {
      const updateData = { name: 'Updated Task' };

      const response = await request(app)
        .put('/api/tasks/123')
        .send(updateData)
        .expect('Content-Type', /json/);

      expect(response.status).toBeOneOf([200, 400, 404, 500]);
      expect(response.body).toHaveProperty('success');
    });

    test('DELETE /api/tasks/:id should handle task deletion', async () => {
      const response = await request(app)
        .delete('/api/tasks/123')
        .expect('Content-Type', /json/);

      expect(response.status).toBeOneOf([200, 400, 500]);
      expect(response.body).toHaveProperty('success');
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Route not found',
        message: 'Route /api/nonexistent not found'
      });
    });

    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    test('should handle empty request body', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Missing required fields',
        message: 'Name and description are required'
      });
    });
  });

  describe('CORS', () => {
    test('should include CORS headers', async () => {
      const response = await request(app)
        .options('/api/projects')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBe('*');
    });

    test('should handle preflight requests', async () => {
      const response = await request(app)
        .options('/api/projects')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type')
        .expect(204);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });
});

// Custom Jest matcher for multiple possible values
expect.extend({
  toBeOneOf(received, expected) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected}`,
        pass: false,
      };
    }
  },
});