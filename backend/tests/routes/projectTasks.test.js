const request = require('supertest');
const express = require('express');
const projectTasksRoutes = require('../../src/routes/projectTasks');

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({
            data: { id: 1 },
            error: null
          })
        }))
      }))
    }))
  }))
}));

describe('ProjectTasks Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/projects', projectTasksRoutes);

    // Set environment variables for testing
    process.env.SUPABASE_URL_LT = 'http://localhost:54321';
    process.env.SUPABASE_SECRET_KEY_LT = 'test-key';
  });

  describe('GET /projects/:projectId/tasks', () => {
    test('should get tasks for valid project with default parameters', async () => {
      const response = await request(app)
        .get('/projects/1/tasks')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.projectId).toBe(1);
      expect(response.body).toHaveProperty('tasks');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body).toHaveProperty('filters');
    });

    test('should handle invalid project ID', async () => {
      const response = await request(app)
        .get('/projects/invalid/tasks')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('projectId must be a positive integer');
    });

    test('should handle negative project ID', async () => {
      const response = await request(app)
        .get('/projects/-1/tasks')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('projectId must be a positive integer');
    });

    test('should apply status filter', async () => {
      const response = await request(app)
        .get('/projects/1/tasks?status=pending')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.filters.status).toBe('pending');
    });

    test('should reject invalid status filter', async () => {
      const response = await request(app)
        .get('/projects/1/tasks?status=invalid_status')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid status');
    });

    test('should apply priority filter', async () => {
      const response = await request(app)
        .get('/projects/1/tasks?priority=high')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.filters.priority).toBe('high');
    });

    test('should reject invalid priority filter', async () => {
      const response = await request(app)
        .get('/projects/1/tasks?priority=urgent')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid priority');
    });

    test('should apply assignedTo filter', async () => {
      const response = await request(app)
        .get('/projects/1/tasks?assignedTo=123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.filters.assignedTo).toBe('123');
    });

    test('should reject invalid assignedTo filter', async () => {
      const response = await request(app)
        .get('/projects/1/tasks?assignedTo=invalid')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should apply pagination parameters', async () => {
      const response = await request(app)
        .get('/projects/1/tasks?page=2&limit=5')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.pagination.page).toBe(2);
      expect(response.body.pagination.limit).toBe(5);
    });

    test('should apply sorting parameters', async () => {
      const response = await request(app)
        .get('/projects/1/tasks?sortBy=title&sortOrder=asc')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.filters.sortBy).toBe('title');
      expect(response.body.filters.sortOrder).toBe('asc');
    });

    test('should reject invalid sort field', async () => {
      const response = await request(app)
        .get('/projects/1/tasks?sortBy=invalid_field')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should reject invalid sort order', async () => {
      const response = await request(app)
        .get('/projects/1/tasks?sortOrder=invalid_order')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should limit page size to maximum', async () => {
      const response = await request(app)
        .get('/projects/1/tasks?limit=500')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.pagination.limit).toBe(100); // Should be capped at MAX_PAGE_SIZE
    });
  });

  describe('GET /projects/:projectId/tasks/stats', () => {
    test('should get task statistics for valid project', async () => {
      const response = await request(app)
        .get('/projects/1/tasks/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.projectId).toBe(1);
      expect(response.body).toHaveProperty('stats');
      expect(response.body.stats).toHaveProperty('total');
      expect(response.body.stats).toHaveProperty('byStatus');
      expect(response.body.stats).toHaveProperty('byPriority');
      expect(response.body.stats).toHaveProperty('completionRate');
    });

    test('should handle invalid project ID for stats', async () => {
      const response = await request(app)
        .get('/projects/invalid/tasks/stats')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('projectId must be a positive integer');
    });
  });

  describe('GET /projects/:projectId/tasks/:taskId', () => {
    test('should get specific task successfully', async () => {
      const response = await request(app)
        .get('/projects/1/tasks/1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('task');
    });

    test('should handle invalid project ID for task retrieval', async () => {
      const response = await request(app)
        .get('/projects/invalid/tasks/1')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('projectId must be a positive integer');
    });

    test('should handle invalid task ID', async () => {
      const response = await request(app)
        .get('/projects/1/tasks/invalid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('taskId must be a positive integer');
    });
  });

  describe('GET /tasks', () => {
    test('should get all tasks with default parameters', async () => {
      const response = await request(app)
        .get('/tasks')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('tasks');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body).toHaveProperty('filters');
    });

    test('should apply filters for all tasks', async () => {
      const response = await request(app)
        .get('/tasks?status=completed&priority=high&project_id=1&assigned_to=123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.filters.status).toBe('completed');
      expect(response.body.filters.priority).toBe('high');
      expect(response.body.filters.project_id).toBe('1');
      expect(response.body.filters.assigned_to).toBe('123');
    });

    test('should reject invalid status for all tasks', async () => {
      const response = await request(app)
        .get('/tasks?status=invalid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid status');
    });

    test('should reject invalid priority for all tasks', async () => {
      const response = await request(app)
        .get('/tasks?priority=invalid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid priority');
    });
  });

  describe('GET /projects', () => {
    test('should get all projects with default parameters', async () => {
      const response = await request(app)
        .get('/projects')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('projects');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body).toHaveProperty('filters');
    });

    test('should apply status filter for projects', async () => {
      const response = await request(app)
        .get('/projects?status=active')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.filters.status).toBe('active');
    });

    test('should apply sorting for projects', async () => {
      const response = await request(app)
        .get('/projects?sortBy=name&sortOrder=asc')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.filters.sortBy).toBe('name');
      expect(response.body.filters.sortOrder).toBe('asc');
    });
  });

  describe('PATCH /projects/:projectId/archive', () => {
    test('should archive project successfully', async () => {
      const response = await request(app)
        .patch('/projects/1/archive')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('archived successfully');
    });

    test('should handle invalid project ID for archiving', async () => {
      const response = await request(app)
        .patch('/projects/invalid/archive')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('projectId must be a positive integer');
    });
  });

  describe('Validation helpers', () => {
    test('should validate positive integers correctly', async () => {
      // Test various invalid inputs that should trigger validation errors
      const invalidInputs = ['0', '-1', 'abc', '1.5', ''];

      for (const input of invalidInputs) {
        const response = await request(app)
          .get(`/projects/${input}/tasks`)
          .expect(400);

        expect(response.body.success).toBe(false);
      }
    });

    test('should handle pagination validation', async () => {
      // Test invalid page numbers
      const response1 = await request(app)
        .get('/projects/1/tasks?page=0')
        .expect(400);

      expect(response1.body.success).toBe(false);

      // Test invalid limit
      const response2 = await request(app)
        .get('/projects/1/tasks?limit=0')
        .expect(400);

      expect(response2.body.success).toBe(false);
    });
  });

  describe('Mock data fallback', () => {
    beforeEach(() => {
      // Clear environment variables to test mock data path
      delete process.env.SUPABASE_URL_LT;
      delete process.env.SUPABASE_SECRET_KEY_LT;
    });

    test('should use mock data when Supabase not configured', async () => {
      const response = await request(app)
        .get('/projects/1/tasks')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.dataSource).toBe('mock');
    });

    test('should return mock projects', async () => {
      const response = await request(app)
        .get('/projects')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.dataSource).toBe('mock');
      expect(response.body.projects).toHaveLength(2); // Based on getMockProjects()
    });
  });
});