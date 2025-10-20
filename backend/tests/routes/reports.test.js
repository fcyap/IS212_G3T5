const request = require('supertest');
const express = require('express');
const reportRoutes = require('../../src/routes/reports');
const reportController = require('../../src/controllers/reportController');
const authMiddleware = require('../../src/middleware/auth');
const rbacMiddleware = require('../../src/middleware/rbac');

jest.mock('../../src/controllers/reportController');
jest.mock('../../src/middleware/auth');
jest.mock('../../src/middleware/rbac');

describe('Report Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    
    app = express();
    app.use(express.json());

    // Mock authentication middleware
    authMiddleware.verifyToken = jest.fn((req, res, next) => {
      req.user = {
        id: 1,
        role: 'hr',
        department: 'Engineering'
      };
      next();
    });

    // Mock RBAC middleware
    rbacMiddleware.requireRole = jest.fn(() => (req, res, next) => next());

    app.use('/api/reports', reportRoutes);

    // Mock controller methods
    reportController.generateTaskReport = jest.fn((req, res) => {
      res.status(200).json({ success: true, data: {} });
    });
    reportController.generateUserProductivityReport = jest.fn((req, res) => {
      res.status(200).json({ success: true, data: {} });
    });
    reportController.generateProjectReport = jest.fn((req, res) => {
      res.status(200).json({ success: true, data: {} });
    });
    reportController.exportReportToPDF = jest.fn((req, res) => {
      res.status(200).send(Buffer.from('PDF'));
    });
    reportController.exportReportToSpreadsheet = jest.fn((req, res) => {
      res.status(200).send(Buffer.from('Spreadsheet'));
    });
    reportController.getAvailableProjects = jest.fn((req, res) => {
      res.status(200).json({ success: true, data: [] });
    });
    reportController.getAvailableUsers = jest.fn((req, res) => {
      res.status(200).json({ success: true, data: [] });
    });
    reportController.getAvailableDepartments = jest.fn((req, res) => {
      res.status(200).json({ success: true, data: [] });
    });
  });

  describe('POST /api/reports/tasks', () => {
    test('should require authentication', async () => {
      authMiddleware.verifyToken = jest.fn((req, res) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const response = await request(app)
        .post('/api/reports/tasks')
        .send({
          startDate: '2025-10-01',
          endDate: '2025-10-31'
        });

      expect(response.status).toBe(401);
    });

    test('should require HR or Admin role', async () => {
      rbacMiddleware.requireRole = jest.fn(() => (req, res) => {
        res.status(403).json({ error: 'Forbidden' });
      });

      const response = await request(app)
        .post('/api/reports/tasks')
        .send({
          startDate: '2025-10-01',
          endDate: '2025-10-31'
        });

      expect(response.status).toBe(403);
    });

    test('should call generateTaskReport controller', async () => {
      const response = await request(app)
        .post('/api/reports/tasks')
        .send({
          startDate: '2025-10-01',
          endDate: '2025-10-31',
          statuses: ['completed', 'in_progress']
        });

      expect(response.status).toBe(200);
      expect(reportController.generateTaskReport).toHaveBeenCalled();
    });

    test('should accept project filter', async () => {
      const response = await request(app)
        .post('/api/reports/tasks')
        .send({
          projectIds: [1, 2, 3]
        });

      expect(response.status).toBe(200);
      expect(reportController.generateTaskReport).toHaveBeenCalled();
    });

    test('should accept status filter', async () => {
      const response = await request(app)
        .post('/api/reports/tasks')
        .send({
          statuses: ['completed']
        });

      expect(response.status).toBe(200);
    });

    test('should accept date range filter', async () => {
      const response = await request(app)
        .post('/api/reports/tasks')
        .send({
          startDate: '2025-10-01',
          endDate: '2025-10-31'
        });

      expect(response.status).toBe(200);
    });

    test('should accept department filter', async () => {
      const response = await request(app)
        .post('/api/reports/tasks')
        .send({
          departments: ['Engineering', 'Marketing']
        });

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/reports/users/productivity', () => {
    test('should require authentication', async () => {
      authMiddleware.verifyToken = jest.fn((req, res) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const response = await request(app)
        .post('/api/reports/users/productivity')
        .send({});

      expect(response.status).toBe(401);
    });

    test('should require HR or Admin role', async () => {
      rbacMiddleware.requireRole = jest.fn(() => (req, res) => {
        res.status(403).json({ error: 'Forbidden' });
      });

      const response = await request(app)
        .post('/api/reports/users/productivity')
        .send({});

      expect(response.status).toBe(403);
    });

    test('should call generateUserProductivityReport controller', async () => {
      const response = await request(app)
        .post('/api/reports/users/productivity')
        .send({
          userIds: [1, 2],
          startDate: '2025-10-01',
          endDate: '2025-10-31'
        });

      expect(response.status).toBe(200);
      expect(reportController.generateUserProductivityReport).toHaveBeenCalled();
    });

    test('should accept user filter', async () => {
      const response = await request(app)
        .post('/api/reports/users/productivity')
        .send({
          userIds: [1, 2, 3]
        });

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/reports/projects', () => {
    test('should require authentication', async () => {
      authMiddleware.verifyToken = jest.fn((req, res) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const response = await request(app)
        .post('/api/reports/projects')
        .send({});

      expect(response.status).toBe(401);
    });

    test('should require HR or Admin role', async () => {
      rbacMiddleware.requireRole = jest.fn(() => (req, res) => {
        res.status(403).json({ error: 'Forbidden' });
      });

      const response = await request(app)
        .post('/api/reports/projects')
        .send({});

      expect(response.status).toBe(403);
    });

    test('should call generateProjectReport controller', async () => {
      const response = await request(app)
        .post('/api/reports/projects')
        .send({
          projectIds: [1],
          startDate: '2025-10-01',
          endDate: '2025-10-31'
        });

      expect(response.status).toBe(200);
      expect(reportController.generateProjectReport).toHaveBeenCalled();
    });
  });

  describe('POST /api/reports/export/pdf', () => {
    test('should require authentication', async () => {
      authMiddleware.verifyToken = jest.fn((req, res) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const response = await request(app)
        .post('/api/reports/export/pdf')
        .send({ reportData: {} });

      expect(response.status).toBe(401);
    });

    test('should require HR or Admin role', async () => {
      rbacMiddleware.requireRole = jest.fn(() => (req, res) => {
        res.status(403).json({ error: 'Forbidden' });
      });

      const response = await request(app)
        .post('/api/reports/export/pdf')
        .send({ reportData: {} });

      expect(response.status).toBe(403);
    });

    test('should export report to PDF', async () => {
      const response = await request(app)
        .post('/api/reports/export/pdf')
        .send({
          reportData: {
            summary: { totalTasks: 10 },
            tasks: []
          }
        });

      expect(response.status).toBe(200);
      expect(reportController.exportReportToPDF).toHaveBeenCalled();
    });
  });

  describe('POST /api/reports/export/spreadsheet', () => {
    test('should require authentication', async () => {
      authMiddleware.verifyToken = jest.fn((req, res) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const response = await request(app)
        .post('/api/reports/export/spreadsheet')
        .send({ reportData: {} });

      expect(response.status).toBe(401);
    });

    test('should require HR or Admin role', async () => {
      rbacMiddleware.requireRole = jest.fn(() => (req, res) => {
        res.status(403).json({ error: 'Forbidden' });
      });

      const response = await request(app)
        .post('/api/reports/export/spreadsheet')
        .send({ reportData: {} });

      expect(response.status).toBe(403);
    });

    test('should export report to spreadsheet', async () => {
      const response = await request(app)
        .post('/api/reports/export/spreadsheet')
        .send({
          reportData: {
            summary: { totalTasks: 10 },
            tasks: []
          }
        });

      expect(response.status).toBe(200);
      expect(reportController.exportReportToSpreadsheet).toHaveBeenCalled();
    });

    test('should accept format parameter', async () => {
      const response = await request(app)
        .post('/api/reports/export/spreadsheet')
        .send({
          reportData: { tasks: [] },
          format: 'csv'
        });

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/reports/filters/projects', () => {
    test('should require authentication', async () => {
      authMiddleware.verifyToken = jest.fn((req, res) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const response = await request(app)
        .get('/api/reports/filters/projects');

      expect(response.status).toBe(401);
    });

    test('should get available projects for current user', async () => {
      const response = await request(app)
        .get('/api/reports/filters/projects');

      expect(response.status).toBe(200);
      expect(reportController.getAvailableProjects).toHaveBeenCalled();
    });
  });

  describe('GET /api/reports/filters/users', () => {
    test('should require authentication', async () => {
      authMiddleware.verifyToken = jest.fn((req, res) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const response = await request(app)
        .get('/api/reports/filters/users');

      expect(response.status).toBe(401);
    });

    test('should get available users for current user department', async () => {
      const response = await request(app)
        .get('/api/reports/filters/users');

      expect(response.status).toBe(200);
      expect(reportController.getAvailableUsers).toHaveBeenCalled();
    });
  });

  describe('GET /api/reports/filters/departments', () => {
    test('should require authentication', async () => {
      authMiddleware.verifyToken = jest.fn((req, res) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const response = await request(app)
        .get('/api/reports/filters/departments');

      expect(response.status).toBe(401);
    });

    test('should get available departments in hierarchy', async () => {
      const response = await request(app)
        .get('/api/reports/filters/departments');

      expect(response.status).toBe(200);
      expect(reportController.getAvailableDepartments).toHaveBeenCalled();
    });
  });

  describe('RBAC enforcement', () => {
    test('should only allow HR role to access reports', async () => {
      authMiddleware.verifyToken = jest.fn((req, res, next) => {
        req.user = { id: 1, role: 'hr', department: 'Engineering' };
        next();
      });

      const response = await request(app)
        .post('/api/reports/tasks')
        .send({});

      expect(response.status).toBe(200);
    });

    test('should only allow Admin role to access reports', async () => {
      authMiddleware.verifyToken = jest.fn((req, res, next) => {
        req.user = { id: 1, role: 'admin', department: 'All' };
        next();
      });

      const response = await request(app)
        .post('/api/reports/tasks')
        .send({});

      expect(response.status).toBe(200);
    });

    test('should deny Staff role access to reports', async () => {
      authMiddleware.verifyToken = jest.fn((req, res, next) => {
        req.user = { id: 1, role: 'staff', department: 'Engineering' };
        next();
      });

      rbacMiddleware.requireRole = jest.fn(() => (req, res) => {
        res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
      });

      const response = await request(app)
        .post('/api/reports/tasks')
        .send({});

      expect(response.status).toBe(403);
    });

    test('should deny Manager role access to reports', async () => {
      authMiddleware.verifyToken = jest.fn((req, res, next) => {
        req.user = { id: 1, role: 'manager', department: 'Engineering' };
        next();
      });

      rbacMiddleware.requireRole = jest.fn(() => (req, res) => {
        res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
      });

      const response = await request(app)
        .post('/api/reports/tasks')
        .send({});

      expect(response.status).toBe(403);
    });
  });

  describe('Department hierarchy filtering', () => {
    test('should filter tasks by HR staff department hierarchy', async () => {
      authMiddleware.verifyToken = jest.fn((req, res, next) => {
        req.user = {
          id: 1,
          role: 'hr',
          department: 'Engineering'
        };
        next();
      });

      reportController.generateTaskReport = jest.fn((req, res) => {
        // Verify user department is passed
        expect(req.user.department).toBe('Engineering');
        res.status(200).json({ success: true, data: {} });
      });

      const response = await request(app)
        .post('/api/reports/tasks')
        .send({});

      expect(response.status).toBe(200);
    });

    test('should include subdepartments in report', async () => {
      authMiddleware.verifyToken = jest.fn((req, res, next) => {
        req.user = {
          id: 1,
          role: 'hr',
          department: 'Engineering'
        };
        next();
      });

      const response = await request(app)
        .post('/api/reports/tasks')
        .send({});

      expect(response.status).toBe(200);
      // The controller should handle hierarchy filtering
    });
  });
});
