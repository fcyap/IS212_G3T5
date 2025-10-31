const reportController = require('../../src/controllers/reportController');
const reportService = require('../../src/services/reportService');

jest.mock('../../src/services/reportService');

describe('ReportController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    
    req = {
      user: {
        id: 1,
        role: 'hr',
        department: 'Engineering'
      },
      query: {},
      body: {},
      params: {}
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis()
    };

    next = jest.fn();
  });

  describe('POST /api/reports/tasks', () => {
    test('should generate task report with filters', async () => {
      const mockReport = {
        summary: {
          totalTasks: 10,
          byStatus: {
            pending: 2,
            in_progress: 3,
            completed: 5,
            blocked: 0
          },
          byPriority: {
            low: 3,
            medium: 4,
            high: 3
          }
        },
        tasks: [
          {
            id: 1,
            title: 'Task 1',
            status: 'completed',
            priority: 'high',
            deadline: '2025-10-25'
          }
        ],
        filters: {
          startDate: '2025-10-01',
          endDate: '2025-10-31'
        },
        generatedAt: '2025-10-20T10:00:00Z',
        generatedBy: 1
      };

      reportService.generateTaskReport.mockResolvedValue(mockReport);

      req.body = {
        startDate: '2025-10-01',
        endDate: '2025-10-31'
      };

      await reportController.generateTaskReport(req, res, next);

      expect(reportService.generateTaskReport).toHaveBeenCalledWith(
        req.user,
        req.body
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockReport
      });
    });

    test('should filter by project IDs', async () => {
      const mockReport = {
        summary: { totalTasks: 5 },
        tasks: [],
        filters: { projectIds: [1, 2] }
      };

      reportService.generateTaskReport.mockResolvedValue(mockReport);

      req.body = {
        projectIds: [1, 2]
      };

      await reportController.generateTaskReport(req, res, next);

      expect(reportService.generateTaskReport).toHaveBeenCalledWith(
        req.user,
        { projectIds: [1, 2] }
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('should filter by status array', async () => {
      const mockReport = {
        summary: { totalTasks: 5 },
        tasks: [],
        filters: { statuses: ['completed', 'in_progress'] }
      };

      reportService.generateTaskReport.mockResolvedValue(mockReport);

      req.body = {
        statuses: ['completed', 'in_progress']
      };

      await reportController.generateTaskReport(req, res, next);

      expect(reportService.generateTaskReport).toHaveBeenCalledWith(
        req.user,
        { statuses: ['completed', 'in_progress'] }
      );
    });

    test('should filter by date range', async () => {
      const mockReport = {
        summary: { totalTasks: 8 },
        tasks: []
      };

      reportService.generateTaskReport.mockResolvedValue(mockReport);

      req.body = {
        startDate: '2025-10-01',
        endDate: '2025-10-31'
      };

      await reportController.generateTaskReport(req, res, next);

      expect(reportService.generateTaskReport).toHaveBeenCalledWith(
        req.user,
        expect.objectContaining({
          startDate: '2025-10-01',
          endDate: '2025-10-31'
        })
      );
    });

    test('should return 403 if user is not HR or Admin', async () => {
      req.user.role = 'staff';

      reportService.generateTaskReport.mockRejectedValue(
        new Error('Unauthorized: Only HR and Admin staff can generate reports')
      );

      await reportController.generateTaskReport(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Unauthorized: Only HR and Admin staff can generate reports'
        })
      );
    });

    test('should handle service errors', async () => {
      const error = new Error('Database connection failed');
      reportService.generateTaskReport.mockRejectedValue(error);

      await reportController.generateTaskReport(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });

    test('should validate required filters', async () => {
      req.body = {
        startDate: '2025-10-31', // Invalid: after end date
        endDate: '2025-10-01'
      };

      await reportController.generateTaskReport(req, res, next);

      // Controller validates dates and returns 400 directly (doesn't call service or next)
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('endDate must be after')
        })
      );
      expect(reportService.generateTaskReport).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/reports/users/productivity', () => {
    test('should generate user productivity report', async () => {
      const mockReport = {
        users: [
          {
            userId: 1,
            userName: 'Alice',
            totalTasks: 10,
            completedTasks: 7,
            inProgressTasks: 2,
            pendingTasks: 1,
            completionRate: 70,
            averageCompletionTime: 3.5
          },
          {
            userId: 2,
            userName: 'Bob',
            totalTasks: 8,
            completedTasks: 6,
            inProgressTasks: 2,
            pendingTasks: 0,
            completionRate: 75,
            averageCompletionTime: 2.8
          }
        ],
        summary: {
          totalUsers: 2,
          averageCompletionRate: 72.5
        }
      };

      reportService.generateUserProductivityReport.mockResolvedValue(mockReport);

      req.body = {
        startDate: '2025-10-01',
        endDate: '2025-10-31'
      };

      await reportController.generateUserProductivityReport(req, res, next);

      expect(reportService.generateUserProductivityReport).toHaveBeenCalledWith(
        req.user,
        req.body
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockReport
      });
    });

    test('should filter by specific user IDs', async () => {
      const mockReport = {
        users: [{ userId: 2, totalTasks: 5 }]
      };

      reportService.generateUserProductivityReport.mockResolvedValue(mockReport);

      req.body = {
        userIds: [2]
      };

      await reportController.generateUserProductivityReport(req, res, next);

      expect(reportService.generateUserProductivityReport).toHaveBeenCalledWith(
        req.user,
        { userIds: [2] }
      );
    });

    test('should handle authorization errors', async () => {
      req.user.role = 'staff';

      reportService.generateUserProductivityReport.mockRejectedValue(
        new Error('Unauthorized')
      );

      await reportController.generateUserProductivityReport(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('POST /api/reports/projects', () => {
    test('should generate project report', async () => {
      const mockReport = {
        projects: [
          {
            projectId: 1,
            projectName: 'Project Alpha',
            totalTasks: 15,
            completedTasks: 10,
            inProgressTasks: 3,
            pendingTasks: 2,
            progressPercentage: 66.67,
            teamSize: 5
          }
        ],
        summary: {
          totalProjects: 1,
          averageProgress: 66.67
        }
      };

      reportService.generateProjectReport.mockResolvedValue(mockReport);

      req.body = {
        projectIds: [1]
      };

      await reportController.generateProjectReport(req, res, next);

      expect(reportService.generateProjectReport).toHaveBeenCalledWith(
        req.user,
        req.body
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockReport
      });
    });
  });

  describe('POST /api/reports/export/pdf', () => {
    test('should export report to PDF', async () => {
      const mockPDFData = {
        format: 'pdf',
        data: Buffer.from('PDF content'),
        filename: 'task-report-2025-10-20.pdf'
      };

      reportService.exportReportToPDF.mockResolvedValue(mockPDFData);

      req.body = {
        reportData: {
          summary: { totalTasks: 10 },
          tasks: []
        }
      };

      await reportController.exportReportToPDF(req, res, next);

      expect(reportService.exportReportToPDF).toHaveBeenCalledWith(
        req.body.reportData
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/pdf'
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        `attachment; filename="${mockPDFData.filename}"`
      );
      expect(res.send).toHaveBeenCalledWith(mockPDFData.data);
    });

    test('should handle PDF generation errors', async () => {
      const error = new Error('PDF generation failed');
      reportService.exportReportToPDF.mockRejectedValue(error);

      req.body = {
        reportData: { summary: {}, tasks: [] }
      };

      await reportController.exportReportToPDF(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });

    test('should validate report data exists', async () => {
      req.body = {}; // No reportData

      await reportController.exportReportToPDF(req, res, next);

      // Controller validates and returns 400 directly (doesn't call next)
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('reportData')
        })
      );
    });
  });

  describe('POST /api/reports/export/spreadsheet', () => {
    test('should export report to Excel spreadsheet', async () => {
      const mockSpreadsheetData = {
        format: 'xlsx',
        data: Buffer.from('Excel content'),
        filename: 'task-report-2025-10-20.xlsx'
      };

      reportService.exportReportToSpreadsheet.mockResolvedValue(mockSpreadsheetData);

      req.body = {
        reportData: {
          summary: { totalTasks: 10 },
          tasks: [
            { id: 1, title: 'Task 1', status: 'completed' }
          ]
        },
        format: 'xlsx' // Controller extracts format from req.body
      };

      await reportController.exportReportToSpreadsheet(req, res, next);

      expect(reportService.exportReportToSpreadsheet).toHaveBeenCalledWith(
        req.body.reportData,
        'xlsx'
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        `attachment; filename="${mockSpreadsheetData.filename}"`
      );
      expect(res.send).toHaveBeenCalledWith(mockSpreadsheetData.data);
    });

    test('should export report to CSV format', async () => {
      const mockCSVData = {
        format: 'csv',
        data: Buffer.from('CSV content'),
        filename: 'task-report-2025-10-20.csv'
      };

      reportService.exportReportToSpreadsheet.mockResolvedValue(mockCSVData);

      req.body = {
        reportData: { tasks: [] },
        format: 'csv'
      };

      await reportController.exportReportToSpreadsheet(req, res, next);

      expect(reportService.exportReportToSpreadsheet).toHaveBeenCalledWith(
        req.body.reportData,
        'csv'
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/csv'
      );
    });

    test('should handle spreadsheet generation errors', async () => {
      const error = new Error('Spreadsheet generation failed');
      reportService.exportReportToSpreadsheet.mockRejectedValue(error);

      req.body = {
        reportData: { tasks: [] }
      };

      await reportController.exportReportToSpreadsheet(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('GET /api/reports/filters/projects', () => {
    test('should get available projects for filtering', async () => {
      const mockProjects = [
        { id: 1, name: 'Project Alpha' },
        { id: 2, name: 'Project Beta' }
      ];

      reportService.getAvailableProjects.mockResolvedValue(mockProjects);

      await reportController.getAvailableProjects(req, res, next);

      expect(reportService.getAvailableProjects).toHaveBeenCalledWith(req.user);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockProjects
      });
    });
  });

  describe('GET /api/reports/filters/users', () => {
    test('should get available users for filtering', async () => {
      const mockUsers = [
        { id: 1, name: 'Alice', email: 'alice@example.com' },
        { id: 2, name: 'Bob', email: 'bob@example.com' }
      ];

      reportService.getAvailableUsers.mockResolvedValue(mockUsers);

      await reportController.getAvailableUsers(req, res, next);

      expect(reportService.getAvailableUsers).toHaveBeenCalledWith(req.user);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockUsers
      });
    });
  });

  describe('GET /api/reports/filters/departments', () => {
    test('should get available departments for filtering', async () => {
      const mockDepartments = [
        'Engineering',
        'Engineering.Backend',
        'Engineering.Frontend'
      ];

      reportService.getAvailableDepartments.mockResolvedValue(mockDepartments);

      await reportController.getAvailableDepartments(req, res, next);

      expect(reportService.getAvailableDepartments).toHaveBeenCalledWith(req.user);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockDepartments
      });
    });
  });

  describe('POST /api/reports/departments', () => {
    test('should generate departmental performance report with valid filters', async () => {
      const mockReport = {
        summary: {
          totalDepartments: 2,
          totalTasks: 25,
          totalMembers: 10,
          averageCompletionRate: 50,
          overallStatusCounts: {
            pending: 5,
            in_progress: 8,
            completed: 12,
            cancelled: 0
          },
          overallPriorityCounts: {
            low: 8,
            medium: 10,
            high: 7
          }
        },
        departments: [
          {
            department: 'Engineering',
            totalTasks: 15,
            memberCount: 6,
            statusCounts: { pending: 3, in_progress: 5, completed: 7, cancelled: 0 },
            priorityCounts: { low: 5, medium: 6, high: 4 },
            completionRate: 47,
            averageTasksPerMember: 2.5
          },
          {
            department: 'HR',
            totalTasks: 10,
            memberCount: 4,
            statusCounts: { pending: 2, in_progress: 3, completed: 5, cancelled: 0 },
            priorityCounts: { low: 3, medium: 4, high: 3 },
            completionRate: 50,
            averageTasksPerMember: 2.5
          }
        ],
        timeSeries: null,
        insights: {
          mostProductiveDepartment: 'HR',
          leastProductiveDepartment: 'Engineering',
          highestWorkloadDepartment: 'Engineering'
        },
        filters: {
          departmentIds: ['Engineering', 'HR'],
          startDate: '2025-10-01',
          endDate: '2025-10-31',
          interval: undefined
        },
        generatedAt: '2025-10-24T10:00:00.000Z',
        generatedBy: 1,
        reportType: 'departmental_performance'
      };

      reportService.generateDepartmentalPerformanceReport.mockResolvedValue(mockReport);

      req.body = {
        departmentIds: ['Engineering', 'HR'],
        startDate: '2025-10-01',
        endDate: '2025-10-31'
      };

      await reportController.generateDepartmentalPerformanceReport(req, res, next);

      expect(reportService.generateDepartmentalPerformanceReport).toHaveBeenCalledWith(req.user, {
        departmentIds: ['Engineering', 'HR'],
        startDate: '2025-10-01',
        endDate: '2025-10-31',
        interval: undefined,
        projectIds: undefined
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockReport
      });
    });

    test('should generate departmental performance report with weekly interval', async () => {
      const mockReport = {
        summary: {
          totalDepartments: 1,
          totalTasks: 10,
          totalMembers: 5,
          averageCompletionRate: 50,
          overallStatusCounts: { pending: 2, in_progress: 3, completed: 5, cancelled: 0 },
          overallPriorityCounts: { low: 3, medium: 4, high: 3 }
        },
        departments: [
          {
            department: 'Engineering',
            totalTasks: 10,
            memberCount: 5,
            statusCounts: { pending: 2, in_progress: 3, completed: 5, cancelled: 0 },
            priorityCounts: { low: 3, medium: 4, high: 3 },
            completionRate: 50,
            averageTasksPerMember: 2.0
          }
        ],
        timeSeries: [
          {
            period: '2025-W40',
            totalTasks: 5,
            statusCounts: { pending: 1, in_progress: 2, completed: 2, cancelled: 0 },
            priorityCounts: { low: 2, medium: 2, high: 1 },
            completionRate: 40
          },
          {
            period: '2025-W41',
            totalTasks: 5,
            statusCounts: { pending: 1, in_progress: 1, completed: 3, cancelled: 0 },
            priorityCounts: { low: 1, medium: 2, high: 2 },
            completionRate: 60
          }
        ],
        insights: {
          mostProductiveDepartment: 'Engineering',
          leastProductiveDepartment: 'Engineering',
          highestWorkloadDepartment: 'Engineering'
        },
        filters: {
          departmentIds: ['Engineering'],
          startDate: '2025-10-01',
          endDate: '2025-10-31',
          interval: 'week'
        },
        generatedAt: '2025-10-24T10:00:00.000Z',
        generatedBy: 1,
        reportType: 'departmental_performance'
      };

      reportService.generateDepartmentalPerformanceReport.mockResolvedValue(mockReport);

      req.body = {
        departmentIds: ['Engineering'],
        startDate: '2025-10-01',
        endDate: '2025-10-31',
        interval: 'week'
      };

      await reportController.generateDepartmentalPerformanceReport(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockReport
      });
    });

    test('should return 400 for invalid date format', async () => {
      req.body = {
        startDate: '10-01-2025',
        endDate: '2025-10-31'
      };

      await reportController.generateDepartmentalPerformanceReport(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid startDate format. Use YYYY-MM-DD'
      });
    });

    test('should return 400 when endDate is before startDate', async () => {
      req.body = {
        startDate: '2025-10-31',
        endDate: '2025-10-01'
      };

      await reportController.generateDepartmentalPerformanceReport(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'endDate must be after or equal to startDate'
      });
    });

    test('should return 400 for invalid interval', async () => {
      req.body = {
        startDate: '2025-10-01',
        endDate: '2025-10-31',
        interval: 'daily'
      };

      await reportController.generateDepartmentalPerformanceReport(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid interval. Must be "week" or "month"'
      });
    });

    test('should return 401 when user is not authenticated', async () => {
      req.user = null;

      await reportController.generateDepartmentalPerformanceReport(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required'
      });
    });

    test('should handle service errors', async () => {
      const mockError = new Error('Database connection failed');
      reportService.generateDepartmentalPerformanceReport.mockRejectedValue(mockError);

      req.body = {
        startDate: '2025-10-01',
        endDate: '2025-10-31'
      };

      await reportController.generateDepartmentalPerformanceReport(req, res, next);

      expect(next).toHaveBeenCalledWith(mockError);
    });
  });
});

