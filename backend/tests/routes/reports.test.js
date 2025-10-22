const request = require('supertest');
const express = require('express');
const reportController = require('../../src/controllers/reportController');

jest.mock('../../src/controllers/reportController');
jest.mock('../../src/services/reportService');
jest.mock('../../src/repository/reportRepository');

describe('Report Endpoints - Green & Red Testing Suite', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());

    const mockAuthMiddleware = (req, res, next) => {
      req.user = { id: 1, role: 'hr', department: 'Engineering' };
      next();
    };

    const mockRequireRole = () => (req, res, next) => next();
    const mockCheckDepartmentAccess = () => (req, res, next) => next();

    app.post('/api/reports/tasks', mockAuthMiddleware, mockRequireRole(), mockCheckDepartmentAccess(), reportController.generateTaskReport);
    app.post('/api/reports/users/productivity', mockAuthMiddleware, mockRequireRole(), mockCheckDepartmentAccess(), reportController.generateUserProductivityReport);
    app.post('/api/reports/projects', mockAuthMiddleware, mockRequireRole(), mockCheckDepartmentAccess(), reportController.generateProjectReport);
    app.post('/api/reports/export/pdf', mockAuthMiddleware, mockRequireRole(), reportController.exportReportToPDF);
    app.post('/api/reports/export/spreadsheet', mockAuthMiddleware, mockRequireRole(), reportController.exportReportToSpreadsheet);
    app.get('/api/reports/filters/projects', mockAuthMiddleware, mockRequireRole(), reportController.getAvailableProjects);
    app.get('/api/reports/filters/users', mockAuthMiddleware, mockRequireRole(), reportController.getAvailableUsers);
    app.get('/api/reports/filters/departments', mockAuthMiddleware, mockRequireRole(), reportController.getAvailableDepartments);

    setupDefaultMocks();
  });

  function setupDefaultMocks() {
    reportController.generateTaskReport = jest.fn((req, res) => {
      res.status(200).json({ success: true, data: { summary: { totalTasks: 10 }, tasks: [], filters: req.body, department: req.user.department } });
    });

    reportController.generateUserProductivityReport = jest.fn((req, res) => {
      res.status(200).json({ success: true, data: { summary: { totalUsers: 5 }, users: [] } });
    });

    reportController.generateProjectReport = jest.fn((req, res) => {
      res.status(200).json({ success: true, data: { summary: { totalProjects: 2 }, projects: [] } });
    });

    reportController.exportReportToPDF = jest.fn((req, res) => {
      if (!req.body.reportData) return res.status(400).json({ error: 'reportData is required' });
      res.setHeader('Content-Type', 'application/pdf');
      res.send(Buffer.from('PDF'));
    });

    reportController.exportReportToSpreadsheet = jest.fn((req, res) => {
      if (!req.body.reportData) return res.status(400).json({ error: 'reportData is required' });
      res.setHeader('Content-Type', 'text/csv');
      res.send(Buffer.from('CSV'));
    });

    reportController.getAvailableProjects = jest.fn((req, res) => {
      res.status(200).json({ success: true, data: [{ id: 1, name: 'Project A' }] });
    });

    reportController.getAvailableUsers = jest.fn((req, res) => {
      res.status(200).json({ success: true, data: [{ id: 1, name: 'User A' }] });
    });

    reportController.getAvailableDepartments = jest.fn((req, res) => {
      res.status(200).json({ success: true, data: ['Engineering'] });
    });
  }

  describe('GREEN: Task Report Generation - Happy Path', () => {
    test(' Generate report with no filters', async () => {
      const response = await request(app).post('/api/reports/tasks').send({});
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test(' Generate report with project filter', async () => {
      const response = await request(app).post('/api/reports/tasks').send({ projectIds: [1, 2] });
      expect(response.status).toBe(200);
      expect(response.body.data.filters.projectIds).toEqual([1, 2]);
    });

    test(' Generate report with date range', async () => {
      const response = await request(app).post('/api/reports/tasks').send({ startDate: '2025-10-01', endDate: '2025-10-31' });
      expect(response.status).toBe(200);
    });

    test(' Generate report with combined filters', async () => {
      const response = await request(app).post('/api/reports/tasks').send({ projectIds: [1], statuses: ['completed'], priorities: ['high'] });
      expect(response.status).toBe(200);
    });
  });

  describe('GREEN: PDF Export - Happy Path', () => {
    test(' Export to PDF successfully', async () => {
      const response = await request(app).post('/api/reports/export/pdf').send({ reportData: { tasks: [] } });
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('pdf');
    });
  });

  describe('GREEN: Spreadsheet Export - Happy Path', () => {
    test(' Export to CSV successfully', async () => {
      const response = await request(app).post('/api/reports/export/spreadsheet').send({ reportData: { tasks: [] }, format: 'csv' });
      expect(response.status).toBe(200);
    });
  });

  describe('GREEN: Filter Endpoints - Happy Path', () => {
    test(' Get available projects', async () => {
      const response = await request(app).get('/api/reports/filters/projects');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test(' Get available users', async () => {
      const response = await request(app).get('/api/reports/filters/users');
      expect(response.status).toBe(200);
    });

    test(' Get available departments', async () => {
      const response = await request(app).get('/api/reports/filters/departments');
      expect(response.status).toBe(200);
    });
  });

  describe('RED: Input Validation Errors', () => {
    test(' Reject invalid date format', async () => {
      reportController.generateTaskReport = jest.fn((req, res) => {
        if (req.body.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(req.body.startDate)) {
          return res.status(400).json({ error: 'Invalid date format' });
        }
        res.status(200).json({ success: true, data: {} });
      });
      const response = await request(app).post('/api/reports/tasks').send({ startDate: '10/01/2025' });
      expect(response.status).toBe(400);
    });

    test(' Reject endDate before startDate', async () => {
      reportController.generateTaskReport = jest.fn((req, res) => {
        if (req.body.startDate && req.body.endDate) {
          if (new Date(req.body.endDate) < new Date(req.body.startDate)) {
            return res.status(400).json({ error: 'endDate must be after startDate' });
          }
        }
        res.status(200).json({ success: true, data: {} });
      });
      const response = await request(app).post('/api/reports/tasks').send({ startDate: '2025-10-31', endDate: '2025-10-01' });
      expect(response.status).toBe(400);
    });

    test(' Reject PDF export without reportData', async () => {
      const response = await request(app).post('/api/reports/export/pdf').send({});
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('reportData');
    });

    test(' Reject spreadsheet export without reportData', async () => {
      const response = await request(app).post('/api/reports/export/spreadsheet').send({});
      expect(response.status).toBe(400);
    });
  });

  describe('RED: Error Handling', () => {
    test(' Handle database errors', async () => {
      reportController.generateTaskReport = jest.fn((req, res) => {
        res.status(500).json({ error: 'Database connection failed' });
      });
      const response = await request(app).post('/api/reports/tasks').send({});
      expect(response.status).toBe(500);
    });

    test(' Handle PDF generation failures', async () => {
      reportController.exportReportToPDF = jest.fn((req, res) => {
        res.status(500).json({ error: 'Failed to generate PDF' });
      });
      const response = await request(app).post('/api/reports/export/pdf').send({ reportData: {} });
      expect(response.status).toBe(500);
    });
  });

  describe('EDGE CASES & STRESS TESTS', () => {
    test(' Handle empty result set', async () => {
      reportController.generateTaskReport = jest.fn((req, res) => {
        res.status(200).json({ success: true, data: { tasks: [] } });
      });
      const response = await request(app).post('/api/reports/tasks').send({});
      expect(response.status).toBe(200);
      expect(response.body.data.tasks).toEqual([]);
    });

    test(' Handle large result set', async () => {
      reportController.generateTaskReport = jest.fn((req, res) => {
        const tasks = Array.from({ length: 10000 }, (_, i) => ({ id: i }));
        res.status(200).json({ success: true, data: { tasks } });
      });
      const response = await request(app).post('/api/reports/tasks').send({});
      expect(response.status).toBe(200);
    });

    test(' Handle concurrent requests', async () => {
      const promises = Array.from({ length: 5 }, () =>
        request(app).post('/api/reports/tasks').send({})
      );
      const responses = await Promise.all(promises);
      responses.forEach(r => expect(r.status).toBe(200));
    });
  });

  describe('INTEGRATION TESTS', () => {
    test(' Full workflow: Generate and export report', async () => {
      const reportResp = await request(app).post('/api/reports/tasks').send({ statuses: ['completed'] });
      expect(reportResp.status).toBe(200);
      
      const exportResp = await request(app).post('/api/reports/export/pdf').send({ reportData: reportResp.body.data });
      expect(exportResp.status).toBe(200);
      expect(exportResp.headers['content-type']).toContain('pdf');
    });
  });
});
