const reportService = require('../../src/services/reportService');
const reportRepository = require('../../src/repository/reportRepository');
const userRepository = require('../../src/repository/userRepository');
const projectRepository = require('../../src/repository/projectRepository');

jest.mock('../../src/repository/reportRepository');
jest.mock('../../src/repository/userRepository');
jest.mock('../../src/repository/projectRepository');

describe('ReportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateTaskReport', () => {
    test('should generate a complete task report for HR staff with department filtering', async () => {
      const mockHRUser = {
        id: 1,
        role: 'hr',
        department: 'Engineering'
      };

      const mockDepartmentUsers = [
        { id: 1, department: 'Engineering' },
        { id: 2, department: 'Engineering.Backend' },
        { id: 3, department: 'Engineering.Frontend' }
      ];

      const mockProjects = [
        { id: 1, name: 'Project A', creator_id: 1 },
        { id: 2, name: 'Project B', creator_id: 2 }
      ];

      const mockTasks = [
        {
          id: 1,
          title: 'Task 1',
          status: 'completed',
          priority: 'high',
          deadline: '2025-10-25',
          created_at: '2025-10-01',
          project_id: 1,
          assigned_to: [1, 2],
          creator_id: 1
        },
        {
          id: 2,
          title: 'Task 2',
          status: 'in_progress',
          priority: 'medium',
          deadline: '2025-10-30',
          created_at: '2025-10-05',
          project_id: 1,
          assigned_to: [2],
          creator_id: 1
        },
        {
          id: 3,
          title: 'Task 3',
          status: 'pending',
          priority: 'low',
          deadline: '2025-11-01',
          created_at: '2025-10-10',
          project_id: 2,
          assigned_to: [3],
          creator_id: 2
        }
      ];

      reportRepository.getUsersByDepartmentHierarchy.mockResolvedValue({
        data: mockDepartmentUsers,
        error: null
      });

      reportRepository.getProjectsByDepartment.mockResolvedValue({
        data: mockProjects,
        error: null
      });

      reportRepository.getTasksForReport.mockResolvedValue({
        data: mockTasks,
        error: null
      });

      userRepository.findById.mockResolvedValue({
        data: mockDepartmentUsers,
        error: null
      });

      const filters = {
        startDate: '2025-10-01',
        endDate: '2025-10-31'
      };

      const result = await reportService.generateTaskReport(mockHRUser, filters);

      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('tasks');
      expect(result).toHaveProperty('filters');
      expect(result.summary).toHaveProperty('totalTasks', 3);
      expect(result.summary).toHaveProperty('byStatus');
      expect(result.summary.byStatus).toEqual({
        pending: 1,
        in_progress: 1,
        completed: 1,
        blocked: 0
      });
    });

    test('should filter report by specific project IDs', async () => {
      const mockHRUser = {
        id: 1,
        role: 'hr',
        department: 'Engineering'
      };

      const mockTasks = [
        { id: 1, project_id: 1, status: 'completed' },
        { id: 2, project_id: 1, status: 'in_progress' }
      ];

      reportRepository.getUsersByDepartmentHierarchy.mockResolvedValue({
        data: [{ id: 1 }],
        error: null
      });

      reportRepository.getProjectsByDepartment.mockResolvedValue({
        data: [{ id: 1 }, { id: 2 }],
        error: null
      });

      reportRepository.getTasksForReport.mockResolvedValue({
        data: mockTasks,
        error: null
      });

      const filters = {
        projectIds: [1]
      };

      const result = await reportService.generateTaskReport(mockHRUser, filters);

      expect(reportRepository.getTasksForReport).toHaveBeenCalledWith(
        expect.objectContaining({
          projectIds: [1]
        })
      );
      expect(result.tasks).toHaveLength(2);
    });

    test('should filter report by task status', async () => {
      const mockHRUser = {
        id: 1,
        role: 'hr',
        department: 'Engineering'
      };

      const mockTasks = [
        { id: 1, status: 'completed', title: 'Completed Task' }
      ];

      reportRepository.getUsersByDepartmentHierarchy.mockResolvedValue({
        data: [{ id: 1 }],
        error: null
      });

      reportRepository.getProjectsByDepartment.mockResolvedValue({
        data: [{ id: 1 }],
        error: null
      });

      reportRepository.getTasksForReport.mockResolvedValue({
        data: mockTasks,
        error: null
      });

      const filters = {
        statuses: ['completed']
      };

      const result = await reportService.generateTaskReport(mockHRUser, filters);

      expect(reportRepository.getTasksForReport).toHaveBeenCalledWith(
        expect.objectContaining({
          statuses: ['completed']
        })
      );
      expect(result.summary.byStatus.completed).toBe(1);
    });

    test('should filter report by date range', async () => {
      const mockHRUser = {
        id: 1,
        role: 'hr',
        department: 'Engineering'
      };

      reportRepository.getUsersByDepartmentHierarchy.mockResolvedValue({
        data: [{ id: 1 }],
        error: null
      });

      reportRepository.getProjectsByDepartment.mockResolvedValue({
        data: [{ id: 1 }],
        error: null
      });

      reportRepository.getTasksForReport.mockResolvedValue({
        data: [],
        error: null
      });

      const filters = {
        startDate: '2025-10-01',
        endDate: '2025-10-31'
      };

      await reportService.generateTaskReport(mockHRUser, filters);

      expect(reportRepository.getTasksForReport).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: '2025-10-01',
          endDate: '2025-10-31'
        })
      );
    });

    test('should only include tasks from HR staff department hierarchy', async () => {
      const mockHRUser = {
        id: 1,
        role: 'hr',
        department: 'Engineering'
      };

      const mockDepartmentUsers = [
        { id: 1, department: 'Engineering' },
        { id: 2, department: 'Engineering.Backend' }
      ];

      reportRepository.getUsersByDepartmentHierarchy.mockResolvedValue({
        data: mockDepartmentUsers,
        error: null
      });

      reportRepository.getProjectsByDepartment.mockResolvedValue({
        data: [{ id: 1 }],
        error: null
      });

      reportRepository.getTasksForReport.mockResolvedValue({
        data: [],
        error: null
      });

      await reportService.generateTaskReport(mockHRUser, {});

      expect(reportRepository.getUsersByDepartmentHierarchy).toHaveBeenCalledWith(
        'Engineering'
      );
      expect(reportRepository.getProjectsByDepartment).toHaveBeenCalledWith([1, 2]);
    });

    test('should throw error if user is not HR or Admin', async () => {
      const mockStaffUser = {
        id: 1,
        role: 'staff',
        department: 'Engineering'
      };

      await expect(
        reportService.generateTaskReport(mockStaffUser, {})
      ).rejects.toThrow('Unauthorized: Only HR and Admin staff can generate reports');
    });

    test('should handle repository errors gracefully', async () => {
      const mockHRUser = {
        id: 1,
        role: 'hr',
        department: 'Engineering'
      };

      reportRepository.getUsersByDepartmentHierarchy.mockResolvedValue({
        data: null,
        error: new Error('Database connection failed')
      });

      await expect(
        reportService.generateTaskReport(mockHRUser, {})
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('generateUserProductivityReport', () => {
    test('should generate productivity report per user', async () => {
      const mockHRUser = {
        id: 1,
        role: 'hr',
        department: 'Engineering'
      };

      const mockUsers = [
        { id: 1, name: 'Alice', email: 'alice@example.com' },
        { id: 2, name: 'Bob', email: 'bob@example.com' }
      ];

      const mockTasks = [
        { id: 1, assigned_to: [1], status: 'completed', priority: 'high' },
        { id: 2, assigned_to: [1], status: 'in_progress', priority: 'medium' },
        { id: 3, assigned_to: [2], status: 'completed', priority: 'low' },
        { id: 4, assigned_to: [1, 2], status: 'completed', priority: 'high' }
      ];

      reportRepository.getUsersByDepartmentHierarchy.mockResolvedValue({
        data: mockUsers,
        error: null
      });

      reportRepository.getTasksForReport.mockResolvedValue({
        data: mockTasks,
        error: null
      });

      const result = await reportService.generateUserProductivityReport(mockHRUser, {});

      expect(result).toHaveProperty('users');
      expect(result.users).toHaveLength(2);
      
      const aliceReport = result.users.find(u => u.userId === 1);
      expect(aliceReport).toHaveProperty('totalTasks');
      expect(aliceReport).toHaveProperty('completedTasks');
      expect(aliceReport).toHaveProperty('inProgressTasks');
      expect(aliceReport).toHaveProperty('completionRate');
    });

    test('should calculate completion rate correctly', async () => {
      const mockHRUser = {
        id: 1,
        role: 'admin',
        department: 'Engineering'
      };

      const mockUsers = [
        { id: 1, name: 'Alice', email: 'alice@example.com' }
      ];

      const mockTasks = [
        { id: 1, assigned_to: [1], status: 'completed' },
        { id: 2, assigned_to: [1], status: 'completed' },
        { id: 3, assigned_to: [1], status: 'in_progress' },
        { id: 4, assigned_to: [1], status: 'pending' }
      ];

      reportRepository.getUsersByDepartmentHierarchy.mockResolvedValue({
        data: mockUsers,
        error: null
      });

      reportRepository.getTasksForReport.mockResolvedValue({
        data: mockTasks,
        error: null
      });

      const result = await reportService.generateUserProductivityReport(mockHRUser, {});

      const aliceReport = result.users[0];
      expect(aliceReport.totalTasks).toBe(4);
      expect(aliceReport.completedTasks).toBe(2);
      expect(aliceReport.completionRate).toBe(50); // 2/4 * 100
    });

    test('should filter by specific user IDs', async () => {
      const mockHRUser = {
        id: 1,
        role: 'hr',
        department: 'Engineering'
      };

      const mockUsers = [
        { id: 2, name: 'Bob', email: 'bob@example.com' }
      ];

      reportRepository.getUsersByDepartmentHierarchy.mockResolvedValue({
        data: mockUsers,
        error: null
      });

      reportRepository.getTasksForReport.mockResolvedValue({
        data: [],
        error: null
      });

      const filters = {
        userIds: [2]
      };

      const result = await reportService.generateUserProductivityReport(mockHRUser, filters);

      expect(result.users).toHaveLength(1);
      expect(result.users[0].userId).toBe(2);
    });
  });

  describe('generateProjectReport', () => {
    test('should generate report per project', async () => {
      const mockHRUser = {
        id: 1,
        role: 'hr',
        department: 'Engineering'
      };

      const mockProjects = [
        { id: 1, name: 'Project Alpha', creator_id: 1 },
        { id: 2, name: 'Project Beta', creator_id: 2 }
      ];

      const mockTasks = [
        { id: 1, project_id: 1, status: 'completed', priority: 'high' },
        { id: 2, project_id: 1, status: 'in_progress', priority: 'medium' },
        { id: 3, project_id: 2, status: 'completed', priority: 'low' }
      ];

      reportRepository.getUsersByDepartmentHierarchy.mockResolvedValue({
        data: [{ id: 1 }, { id: 2 }],
        error: null
      });

      reportRepository.getProjectsByDepartment.mockResolvedValue({
        data: mockProjects,
        error: null
      });

      reportRepository.getTasksForReport.mockResolvedValue({
        data: mockTasks,
        error: null
      });

      const result = await reportService.generateProjectReport(mockHRUser, {});

      expect(result).toHaveProperty('projects');
      expect(result.projects).toHaveLength(2);
      
      const project1Report = result.projects.find(p => p.projectId === 1);
      expect(project1Report.totalTasks).toBe(2);
      expect(project1Report.completedTasks).toBe(1);
      expect(project1Report.inProgressTasks).toBe(1);
    });

    test('should calculate project progress percentage', async () => {
      const mockHRUser = {
        id: 1,
        role: 'admin',
        department: 'Engineering'
      };

      const mockProjects = [
        { id: 1, name: 'Project Alpha', creator_id: 1 }
      ];

      const mockTasks = [
        { id: 1, project_id: 1, status: 'completed' },
        { id: 2, project_id: 1, status: 'completed' },
        { id: 3, project_id: 1, status: 'completed' },
        { id: 4, project_id: 1, status: 'in_progress' }
      ];

      reportRepository.getUsersByDepartmentHierarchy.mockResolvedValue({
        data: [{ id: 1 }],
        error: null
      });

      reportRepository.getProjectsByDepartment.mockResolvedValue({
        data: mockProjects,
        error: null
      });

      reportRepository.getTasksForReport.mockResolvedValue({
        data: mockTasks,
        error: null
      });

      const result = await reportService.generateProjectReport(mockHRUser, {});

      expect(result.projects[0].progressPercentage).toBe(75); // 3/4 * 100
    });
  });

  describe('exportReportToPDF', () => {
    test('should export report data to PDF format', async () => {
      const mockReportData = {
        summary: {
          totalTasks: 10,
          byStatus: { completed: 5, in_progress: 3, pending: 2 }
        },
        tasks: [
          { id: 1, title: 'Task 1', status: 'completed' }
        ]
      };

      const result = await reportService.exportReportToPDF(mockReportData);

      expect(result).toHaveProperty('format', 'pdf');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('filename');
      expect(result.filename).toMatch(/report.*\.pdf$/);
    });

    test('should include timestamp in PDF filename', async () => {
      const mockReportData = {
        summary: { totalTasks: 0 },
        tasks: []
      };

      const result = await reportService.exportReportToPDF(mockReportData);

      expect(result.filename).toMatch(/\d{4}-\d{2}-\d{2}/); // Date format
    });
  });

  describe('exportReportToSpreadsheet', () => {
    test('should export report data to spreadsheet format', async () => {
      const mockReportData = {
        summary: {
          totalTasks: 10,
          byStatus: { completed: 5, in_progress: 3, pending: 2 }
        },
        tasks: [
          { id: 1, title: 'Task 1', status: 'completed', priority: 'high' },
          { id: 2, title: 'Task 2', status: 'in_progress', priority: 'medium' }
        ]
      };

      const result = await reportService.exportReportToSpreadsheet(mockReportData);

      expect(result).toHaveProperty('format', 'xlsx');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('filename');
      expect(result.filename).toMatch(/report.*\.xlsx$/);
    });

    test('should format spreadsheet with proper columns', async () => {
      const mockReportData = {
        tasks: [
          {
            id: 1,
            title: 'Task 1',
            status: 'completed',
            priority: 'high',
            deadline: '2025-10-25',
            assigned_to: [1, 2]
          }
        ]
      };

      const result = await reportService.exportReportToSpreadsheet(mockReportData);

      expect(result.data).toBeDefined();
      // Should contain rows with task data
    });

    test('should support CSV format option', async () => {
      const mockReportData = {
        tasks: [
          { id: 1, title: 'Task 1', status: 'completed' }
        ]
      };

      const result = await reportService.exportReportToSpreadsheet(mockReportData, 'csv');

      expect(result.format).toBe('csv');
      expect(result.filename).toMatch(/\.csv$/);
    });
  });

  describe('getDepartmentHierarchy', () => {
    test('should return all descendant departments', async () => {
      const parentDept = 'Engineering';
      const mockUsers = [
        { id: 1, department: 'Engineering' },
        { id: 2, department: 'Engineering.Backend' },
        { id: 3, department: 'Engineering.Frontend' },
        { id: 4, department: 'Engineering.Backend.API' },
        { id: 5, department: 'Marketing' } // Should not be included
      ];

      reportRepository.getUsersByDepartmentHierarchy.mockResolvedValue({
        data: mockUsers.filter(u => u.department.startsWith('Engineering')),
        error: null
      });

      const result = await reportService.getDepartmentHierarchy(parentDept);

      expect(result).toHaveLength(4);
      expect(result.every(u => u.department.startsWith('Engineering'))).toBe(true);
    });
  });

  describe('validateReportFilters', () => {
    test('should validate date range filters', () => {
      const validFilters = {
        startDate: '2025-10-01',
        endDate: '2025-10-31'
      };

      const result = reportService.validateReportFilters(validFilters);

      expect(result.isValid).toBe(true);
    });

    test('should reject invalid date range (end before start)', () => {
      const invalidFilters = {
        startDate: '2025-10-31',
        endDate: '2025-10-01'
      };

      const result = reportService.validateReportFilters(invalidFilters);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('End date must be after start date');
    });

    test('should validate status array', () => {
      const validFilters = {
        statuses: ['pending', 'in_progress', 'completed']
      };

      const result = reportService.validateReportFilters(validFilters);

      expect(result.isValid).toBe(true);
    });

    test('should reject invalid status values', () => {
      const invalidFilters = {
        statuses: ['invalid_status', 'pending']
      };

      const result = reportService.validateReportFilters(invalidFilters);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid status value: invalid_status');
    });
  });

  describe('generateDepartmentalPerformanceReport', () => {
    test('should generate departmental performance report for Admin with all departments', async () => {
      const mockAdminUser = {
        id: 1,
        role: 'admin',
        department: 'Corporate'
      };

      const mockDepartments = ['Engineering', 'HR', 'Sales'];
      const mockDepartmentComparison = [
        {
          department: 'Engineering',
          totalTasks: 15,
          memberCount: 5,
          statusCounts: { pending: 3, in_progress: 5, completed: 7, cancelled: 0 },
          priorityCounts: { low: 4, medium: 6, high: 5 },
          completionRate: 47,
          averageTasksPerMember: 3.0
        },
        {
          department: 'HR',
          totalTasks: 10,
          memberCount: 3,
          statusCounts: { pending: 2, in_progress: 3, completed: 5, cancelled: 0 },
          priorityCounts: { low: 3, medium: 4, high: 3 },
          completionRate: 50,
          averageTasksPerMember: 3.3
        },
        {
          department: 'Sales',
          totalTasks: 20,
          memberCount: 8,
          statusCounts: { pending: 5, in_progress: 5, completed: 10, cancelled: 0 },
          priorityCounts: { low: 8, medium: 8, high: 4 },
          completionRate: 50,
          averageTasksPerMember: 2.5
        }
      ];

      reportRepository.getAllDepartments.mockResolvedValue({
        data: mockDepartments,
        error: null
      });

      reportRepository.getDepartmentComparison.mockResolvedValue({
        data: mockDepartmentComparison,
        error: null
      });

      const filters = {
        startDate: '2025-10-01',
        endDate: '2025-10-31'
      };

      const result = await reportService.generateDepartmentalPerformanceReport(mockAdminUser, filters);

      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('departments');
      expect(result).toHaveProperty('insights');
      expect(result).toHaveProperty('reportType', 'departmental_performance');
      
      expect(result.summary.totalDepartments).toBe(3);
      expect(result.summary.totalTasks).toBe(45);
      expect(result.summary.totalMembers).toBe(16);
      expect(result.summary.averageCompletionRate).toBe(49); // (47+50+50)/3
      
      expect(result.insights.mostProductiveDepartment).toBeDefined();
      expect(result.insights.leastProductiveDepartment).toBeDefined();
      expect(result.insights.highestWorkloadDepartment).toBeDefined();
    });

    test('should generate departmental performance report for HR with department hierarchy filtering', async () => {
      const mockHRUser = {
        id: 2,
        role: 'hr',
        department: 'Engineering'
      };

      const mockDepartmentUsers = [
        { id: 1, department: 'Engineering' },
        { id: 2, department: 'Engineering.Backend' },
        { id: 3, department: 'Engineering.Frontend' }
      ];

      const mockDepartmentComparison = [
        {
          department: 'Engineering',
          totalTasks: 15,
          memberCount: 5,
          statusCounts: { pending: 3, in_progress: 5, completed: 7, cancelled: 0 },
          priorityCounts: { low: 4, medium: 6, high: 5 },
          completionRate: 47,
          averageTasksPerMember: 3.0
        }
      ];

      reportRepository.getUsersByDepartmentHierarchy.mockResolvedValue({
        data: mockDepartmentUsers,
        error: null
      });

      reportRepository.getDepartmentComparison.mockResolvedValue({
        data: mockDepartmentComparison,
        error: null
      });

      const filters = {
        startDate: '2025-10-01',
        endDate: '2025-10-31'
      };

      const result = await reportService.generateDepartmentalPerformanceReport(mockHRUser, filters);

      expect(result.summary.totalDepartments).toBe(1);
      expect(result.departments).toHaveLength(1);
      expect(result.departments[0].department).toBe('Engineering');
    });

    test('should include weekly time-series data when interval is specified', async () => {
      const mockAdminUser = {
        id: 1,
        role: 'admin',
        department: 'Corporate'
      };

      const mockDepartments = ['Engineering'];
      const mockDepartmentComparison = [
        {
          department: 'Engineering',
          totalTasks: 10,
          memberCount: 5,
          statusCounts: { pending: 2, in_progress: 3, completed: 5, cancelled: 0 },
          priorityCounts: { low: 3, medium: 4, high: 3 },
          completionRate: 50,
          averageTasksPerMember: 2.0
        }
      ];

      const mockWeeklyStats = [
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
      ];

      reportRepository.getAllDepartments.mockResolvedValue({
        data: mockDepartments,
        error: null
      });

      reportRepository.getDepartmentComparison.mockResolvedValue({
        data: mockDepartmentComparison,
        error: null
      });

      reportRepository.getWeeklyMonthlyStats.mockResolvedValue({
        data: mockWeeklyStats,
        error: null
      });

      const filters = {
        startDate: '2025-10-01',
        endDate: '2025-10-31',
        interval: 'week'
      };

      const result = await reportService.generateDepartmentalPerformanceReport(mockAdminUser, filters);

      expect(result.timeSeries).toBeDefined();
      expect(result.timeSeries).toHaveLength(2);
      expect(result.timeSeries[0].period).toBe('2025-W40');
      expect(result.filters.interval).toBe('week');
    });

    test('should reject unauthorized non-HR/Admin users', async () => {
      const mockUser = {
        id: 3,
        role: 'staff',
        department: 'Engineering'
      };

      const filters = {};

      await expect(
        reportService.generateDepartmentalPerformanceReport(mockUser, filters)
      ).rejects.toThrow('Unauthorized: Only HR and Admin staff can generate departmental reports');
    });

    test('should handle errors from repository layer', async () => {
      const mockAdminUser = {
        id: 1,
        role: 'admin',
        department: 'Corporate'
      };

      reportRepository.getAllDepartments.mockResolvedValue({
        data: ['Engineering'],
        error: null
      });

      reportRepository.getDepartmentComparison.mockResolvedValue({
        data: null,
        error: { message: 'Database connection error' }
      });

      const filters = {};

      await expect(
        reportService.generateDepartmentalPerformanceReport(mockAdminUser, filters)
      ).rejects.toThrow('Database connection error');
    });
  });
});

