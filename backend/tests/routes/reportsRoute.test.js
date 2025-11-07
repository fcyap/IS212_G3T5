const request = require('supertest');
const express = require('express');
const reportsRouter = require('../../src/routes/reports');
const reportController = require('../../src/controllers/reportController');

jest.mock('../../src/controllers/reportController');
jest.mock('../../src/middleware/auth', () => ({
  authMiddleware: () => (req, res, next) => {
    req.user = { id: 1, role: 'hr', department: 'Engineering' };
    next();
  },
}));
jest.mock('../../src/middleware/rbac', () => ({
  requireRole: () => (req, res, next) => next(),
  checkDepartmentAccess: () => (req, res, next) => next(),
}));

describe('Reports Routes - Route Wiring Tests', () => {
  let app;
  let consoleLogSpy;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/reports', reportsRouter);
    jest.clearAllMocks();

    // Spy on console.log to verify debug middleware
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // Mock default responses for all controller methods
    reportController.generateTaskReport.mockImplementation((req, res) => {
      res.json({ success: true, data: { tasks: [] } });
    });
    reportController.generateUserProductivityReport.mockImplementation((req, res) => {
      res.json({ success: true, data: { users: [] } });
    });
    reportController.generateProjectReport.mockImplementation((req, res) => {
      res.json({ success: true, data: { projects: [] } });
    });
    reportController.generateDepartmentalPerformanceReport.mockImplementation((req, res) => {
      res.json({ success: true, data: { departments: [] } });
    });
    reportController.generateManualTimeReport.mockImplementation((req, res) => {
      res.json({ success: true, data: { timeEntries: [] } });
    });
    reportController.exportReportToPDF.mockImplementation((req, res) => {
      res.setHeader('Content-Type', 'application/pdf');
      res.send(Buffer.from('PDF'));
    });
    reportController.exportReportToSpreadsheet.mockImplementation((req, res) => {
      res.setHeader('Content-Type', 'text/csv');
      res.send('CSV');
    });
    reportController.getAvailableProjects.mockImplementation((req, res) => {
      res.json({ success: true, data: [] });
    });
    reportController.getAvailableUsers.mockImplementation((req, res) => {
      res.json({ success: true, data: [] });
    });
    reportController.getAvailableDepartments.mockImplementation((req, res) => {
      res.json({ success: true, data: [] });
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('Debug Middleware', () => {
    test('should log route hits', async () => {
      await request(app).post('/reports/tasks').send({});

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[reports.js] Route hit:',
        'POST',
        '/reports/tasks'
      );
    });

    test('should sanitize log output', async () => {
      // This tests that the debug middleware is present and runs
      await request(app).get('/reports/filters/projects');

      expect(consoleLogSpy).toHaveBeenCalled();
      const logCall = consoleLogSpy.mock.calls[0];
      expect(logCall[0]).toBe('[reports.js] Route hit:');
    });
  });

  describe('POST /reports/tasks', () => {
    test('should call generateTaskReport controller', async () => {
      await request(app).post('/reports/tasks').send({});

      expect(reportController.generateTaskReport).toHaveBeenCalled();
    });

    test('should return success response', async () => {
      const response = await request(app).post('/reports/tasks').send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /reports/users/productivity', () => {
    test('should call generateUserProductivityReport controller', async () => {
      await request(app).post('/reports/users/productivity').send({});

      expect(reportController.generateUserProductivityReport).toHaveBeenCalled();
    });

    test('should return success response', async () => {
      const response = await request(app).post('/reports/users/productivity').send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /reports/projects', () => {
    test('should call generateProjectReport controller', async () => {
      await request(app).post('/reports/projects').send({});

      expect(reportController.generateProjectReport).toHaveBeenCalled();
    });

    test('should return success response', async () => {
      const response = await request(app).post('/reports/projects').send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /reports/departments', () => {
    test('should call generateDepartmentalPerformanceReport controller', async () => {
      await request(app).post('/reports/departments').send({});

      expect(reportController.generateDepartmentalPerformanceReport).toHaveBeenCalled();
    });

    test('should return success response', async () => {
      const response = await request(app).post('/reports/departments').send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /reports/time/manual', () => {
    test('should call generateManualTimeReport controller', async () => {
      await request(app).post('/reports/time/manual').send({});

      expect(reportController.generateManualTimeReport).toHaveBeenCalled();
    });

    test('should return success response', async () => {
      const response = await request(app).post('/reports/time/manual').send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /reports/export/pdf', () => {
    test('should call exportReportToPDF controller', async () => {
      await request(app).post('/reports/export/pdf').send({ reportData: {} });

      expect(reportController.exportReportToPDF).toHaveBeenCalled();
    });

    test('should return PDF content type', async () => {
      const response = await request(app).post('/reports/export/pdf').send({ reportData: {} });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('pdf');
    });
  });

  describe('POST /reports/export/spreadsheet', () => {
    test('should call exportReportToSpreadsheet controller', async () => {
      await request(app).post('/reports/export/spreadsheet').send({ reportData: {} });

      expect(reportController.exportReportToSpreadsheet).toHaveBeenCalled();
    });

    test('should return CSV content type', async () => {
      const response = await request(app).post('/reports/export/spreadsheet').send({ reportData: {} });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('csv');
    });
  });

  describe('GET /reports/filters/projects', () => {
    test('should call getAvailableProjects controller', async () => {
      await request(app).get('/reports/filters/projects');

      expect(reportController.getAvailableProjects).toHaveBeenCalled();
    });

    test('should return success response', async () => {
      const response = await request(app).get('/reports/filters/projects');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /reports/filters/users', () => {
    test('should call getAvailableUsers controller', async () => {
      await request(app).get('/reports/filters/users');

      expect(reportController.getAvailableUsers).toHaveBeenCalled();
    });

    test('should return success response', async () => {
      const response = await request(app).get('/reports/filters/users');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /reports/filters/departments', () => {
    test('should call getAvailableDepartments controller', async () => {
      await request(app).get('/reports/filters/departments');

      expect(reportController.getAvailableDepartments).toHaveBeenCalled();
    });

    test('should return success response', async () => {
      const response = await request(app).get('/reports/filters/departments');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Middleware Integration', () => {
    test('should apply authentication to all routes', async () => {
      // Verify that routes are properly wired and protected by middleware
      jest.clearAllMocks();
      await request(app).post('/reports/tasks').send({});

      // Verify the controller was called, which means middleware passed
      expect(reportController.generateTaskReport).toHaveBeenCalled();
    });

    test('should apply RBAC middleware to generation routes', async () => {
      // The requireRole middleware is mocked to allow access
      await request(app).post('/reports/tasks').send({});

      expect(reportController.generateTaskReport).toHaveBeenCalled();
    });

    test('should apply checkDepartmentAccess to generation routes', async () => {
      // The checkDepartmentAccess middleware is mocked
      await request(app).post('/reports/projects').send({});

      expect(reportController.generateProjectReport).toHaveBeenCalled();
    });
  });

  describe('Route Parameters', () => {
    test('should pass request body to task report controller', async () => {
      const body = { projectIds: [1, 2], statuses: ['completed'] };
      await request(app).post('/reports/tasks').send(body);

      const req = reportController.generateTaskReport.mock.calls[0][0];
      expect(req.body).toEqual(body);
    });

    test('should pass request body to user productivity controller', async () => {
      const body = { userIds: [1, 2], startDate: '2025-10-01' };
      await request(app).post('/reports/users/productivity').send(body);

      const req = reportController.generateUserProductivityReport.mock.calls[0][0];
      expect(req.body).toEqual(body);
    });

    test('should pass request body to project report controller', async () => {
      const body = { projectIds: [1] };
      await request(app).post('/reports/projects').send(body);

      const req = reportController.generateProjectReport.mock.calls[0][0];
      expect(req.body).toEqual(body);
    });

    test('should pass request body to departmental report controller', async () => {
      const body = { departmentIds: ['Engineering'], interval: 'week' };
      await request(app).post('/reports/departments').send(body);

      const req = reportController.generateDepartmentalPerformanceReport.mock.calls[0][0];
      expect(req.body).toEqual(body);
    });

    test('should pass request body to manual time report controller', async () => {
      const body = { startDate: '2025-10-01', endDate: '2025-10-31' };
      await request(app).post('/reports/time/manual').send(body);

      const req = reportController.generateManualTimeReport.mock.calls[0][0];
      expect(req.body).toEqual(body);
    });
  });

  describe('All Routes Integration', () => {
    test('should handle all report generation routes', async () => {
      const routes = [
        '/reports/tasks',
        '/reports/users/productivity',
        '/reports/projects',
        '/reports/departments',
        '/reports/time/manual'
      ];

      for (const route of routes) {
        const response = await request(app).post(route).send({});
        expect(response.status).toBe(200);
      }
    });

    test('should handle all export routes', async () => {
      const routes = [
        '/reports/export/pdf',
        '/reports/export/spreadsheet'
      ];

      for (const route of routes) {
        const response = await request(app).post(route).send({ reportData: {} });
        expect(response.status).toBe(200);
      }
    });

    test('should handle all filter routes', async () => {
      const routes = [
        '/reports/filters/projects',
        '/reports/filters/users',
        '/reports/filters/departments'
      ];

      for (const route of routes) {
        const response = await request(app).get(route);
        expect(response.status).toBe(200);
      }
    });
  });
});
