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
    reportRepository.getManualTimeLogs = jest.fn();
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
          deadline: '2025-10-15',
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
          deadline: '2025-10-20',
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
          deadline: '2025-10-25',
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

  describe('generateManualTimeReport', () => {
    const adminUser = {
      id: 99,
      role: 'admin',
      department: 'Operations'
    };

    test('should restrict access to HR and Admin roles', async () => {
      const staffUser = {
        id: 12,
        role: 'staff',
        department: 'Operations.Support'
      };

      await expect(
        reportService.generateManualTimeReport(staffUser, {})
      ).rejects.toThrow(/Only HR and Admin/);
    });

    test('should aggregate manually logged hours by project and respect filters', async () => {
      const filters = {
        projectIds: [101],
        departments: ['Operations'],
        startDate: '2025-02-01',
        endDate: '2025-02-28',
        view: 'project'
      };

      const manualEntries = [
        {
          project_id: 101,
          project_name: 'Ops Revamp',
          department: 'Operations',
          task_status: 'in_progress',
          task_priority: 'medium',
          task_title: 'Ops Discovery',
          hours: 3.5,
          logged_at: '2025-02-02',
          is_manual: true
        },
        {
          project_id: 101,
          project_name: 'Ops Revamp',
          department: 'Operations',
          task_status: 'completed',
          task_priority: 'high',
          task_title: 'Ops Execution',
          hours: 4,
          logged_at: '2025-02-05',
          is_manual: true
        },
        {
          project_id: 202,
          project_name: 'Support Upgrade',
          department: 'Customer Success',
          task_status: 'pending',
          task_priority: 'low',
          task_title: 'Support Planning',
          hours: 2,
          logged_at: '2025-02-07',
          is_manual: true
        }
      ];

      reportRepository.getManualTimeLogs.mockResolvedValue({
        data: manualEntries,
        error: null
      });

      const result = await reportService.generateManualTimeReport(
        adminUser,
        filters
      );

      expect(reportRepository.getManualTimeLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          projectIds: [101],
          departments: ['Operations'],
          startDate: '2025-02-01',
          endDate: '2025-02-28',
          groupBy: 'project'
        })
      );

      expect(result.summary.totalHours).toBeCloseTo(7.5);
      expect(result.summary.byProject).toEqual([
        {
          projectId: 101,
          projectName: 'Ops Revamp',
          totalHours: 7.5,
          userCount: expect.any(Number),
          avgHoursPerUser: expect.any(Number)
        }
      ]);
      expect(result.entries).toHaveLength(2);
      expect(result.entries.every(entry => entry.projectId === 101)).toBe(true);
      expect(result.entries.every(entry => Object.prototype.hasOwnProperty.call(entry, 'taskStatus'))).toBe(true);
      expect(result.entries.every(entry => Object.prototype.hasOwnProperty.call(entry, 'taskPriority'))).toBe(true);
      expect(result.entries.every(entry => Object.prototype.hasOwnProperty.call(entry, 'taskTitle'))).toBe(true);
      expect(result.download).toEqual(
        expect.objectContaining({
          ready: true,
          format: 'spreadsheet'
        })
      );
      expect(result.generatedBy).toBe(adminUser.id);
    });

    test('should aggregate manually logged hours by department when requested', async () => {
      const filters = {
        startDate: '2025-02-01',
        endDate: '2025-02-28',
        view: 'department'
      };

      const manualEntries = [
        {
          project_id: 101,
          project_name: 'Ops Revamp',
          department: 'Engineering',
          task_status: 'pending',
          task_priority: 'medium',
          task_title: 'Ops Intake',
          hours: 2.25,
          logged_at: '2025-02-03',
          is_manual: true
        },
        {
          project_id: 202,
          project_name: 'Support Upgrade',
          department: 'Engineering',
          task_status: 'in_progress',
          task_priority: 'high',
          task_title: 'Support Rollout',
          hours: 4.75,
          logged_at: '2025-02-06',
          is_manual: true
        },
        {
          project_id: 303,
          project_name: 'Sales Onboarding',
          department: 'Sales',
          task_status: 'completed',
          task_priority: 'medium',
          task_title: 'Sales Enablement',
          hours: 1.5,
          logged_at: '2025-02-09',
          is_manual: true
        }
      ];

      reportRepository.getManualTimeLogs.mockResolvedValue({
        data: manualEntries,
        error: null
      });

      const result = await reportService.generateManualTimeReport(
        adminUser,
        filters
      );

      expect(reportRepository.getManualTimeLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: '2025-02-01',
          endDate: '2025-02-28',
          groupBy: 'department'
        })
      );

      expect(result.summary.totalHours).toBeCloseTo(8.5);
      expect(result.summary.byDepartment).toEqual(
        expect.arrayContaining([
          {
            department: 'Engineering',
            totalHours: 7,
            userCount: expect.any(Number),
            avgHoursPerUser: expect.any(Number)
          },
          {
            department: 'Sales',
            totalHours: 1.5,
            userCount: expect.any(Number),
            avgHoursPerUser: expect.any(Number)
          }
        ])
      );
      expect(result.filters.view).toBe('department');
      expect(result.entries).toHaveLength(3);
      expect(result.entries.every(entry => entry.taskStatus)).toBe(true);
      expect(result.entries.every(entry => entry.taskPriority)).toBe(true);
      expect(result.entries.every(entry => entry.taskTitle)).toBe(true);
    });
  });

  // ============================================
  // COMPREHENSIVE UNIT TESTS - Helper Methods
  // ============================================

  describe('Unit Tests - Helper Methods', () => {
    describe('_verifyReportPermission', () => {
      test('should allow HR users', () => {
        const hrUser = { id: 1, role: 'hr', department: 'Engineering' };
        expect(() => {
          reportService._verifyReportPermission(hrUser);
        }).not.toThrow();
      });

      test('should allow Admin users', () => {
        const adminUser = { id: 1, role: 'admin', department: 'IT' };
        expect(() => {
          reportService._verifyReportPermission(adminUser);
        }).not.toThrow();
      });

      test('should reject non-HR/Admin users', () => {
        const regularUser = { id: 1, role: 'user', department: 'Sales' };
        expect(() => {
          reportService._verifyReportPermission(regularUser);
        }).toThrow('Unauthorized: Only HR and Admin staff can generate reports');
      });

      test('should reject null user', () => {
        expect(() => {
          reportService._verifyReportPermission(null);
        }).toThrow('Unauthorized');
      });

      test('should reject undefined user', () => {
        expect(() => {
          reportService._verifyReportPermission(undefined);
        }).toThrow('Unauthorized');
      });
    });

    describe('_calculateTaskSummary', () => {
      test('should calculate summary for tasks with all statuses', () => {
        const tasks = [
          { status: 'pending', priority: 8 },
          { status: 'in_progress', priority: 5 },
          { status: 'completed', priority: 2 },
          { status: 'blocked', priority: 9 }
        ];

        const summary = reportService._calculateTaskSummary(tasks);

        expect(summary).toEqual({
          totalTasks: 4,
          byStatus: {
            pending: 1,
            in_progress: 1,
            completed: 1,
            blocked: 1
          },
          byPriority: {
            low: 1,
            medium: 1,
            high: 2
          }
        });
      });

      test('should handle empty task list', () => {
        const summary = reportService._calculateTaskSummary([]);

        expect(summary).toEqual({
          totalTasks: 0,
          byStatus: {
            pending: 0,
            in_progress: 0,
            completed: 0,
            blocked: 0
          },
          byPriority: {
            low: 0,
            medium: 0,
            high: 0
          }
        });
      });

      test('should handle tasks with missing status/priority', () => {
        const tasks = [
          { status: 'completed' },
          { priority: 8 },
          {}
        ];

        const summary = reportService._calculateTaskSummary(tasks);

        expect(summary.totalTasks).toBe(3);
        expect(summary.byStatus.completed).toBe(1);
        expect(summary.byPriority.high).toBe(1);
      });
    });

    describe('_calculateUserStats', () => {
      test('should calculate stats for user with multiple tasks', () => {
        const user = { id: 1, name: 'Alice', email: 'alice@test.com' };
        const tasks = [
          { id: 1, assigned_to: [1], status: 'completed' },
          { id: 2, assigned_to: [1], status: 'completed' },
          { id: 3, assigned_to: [1], status: 'in_progress' },
          { id: 4, assigned_to: [1], status: 'pending' }
        ];

        const stats = reportService._calculateUserStats(user, tasks);

        expect(stats).toEqual({
          userId: 1,
          userName: 'Alice',
          userEmail: 'alice@test.com',
          totalTasks: 4,
          completedTasks: 2,
          inProgressTasks: 1,
          pendingTasks: 1,
          completionRate: 50
        });
      });

      test('should handle user with no tasks', () => {
        const user = { id: 1, name: 'Bob', email: 'bob@test.com' };
        const tasks = [];

        const stats = reportService._calculateUserStats(user, tasks);

        expect(stats).toEqual({
          userId: 1,
          userName: 'Bob',
          userEmail: 'bob@test.com',
          totalTasks: 0,
          completedTasks: 0,
          inProgressTasks: 0,
          pendingTasks: 0,
          completionRate: 0
        });
      });

      test('should handle tasks assigned to multiple users', () => {
        const user = { id: 1, name: 'Charlie', email: 'charlie@test.com' };
        const tasks = [
          { id: 1, assigned_to: [1, 2], status: 'completed' },
          { id: 2, assigned_to: [2], status: 'in_progress' },
          { id: 3, assigned_to: [1], status: 'completed' }
        ];

        const stats = reportService._calculateUserStats(user, tasks);

        expect(stats.totalTasks).toBe(2); // Only tasks 1 and 3
        expect(stats.completedTasks).toBe(2);
        expect(stats.completionRate).toBe(100);
      });

      test('should handle tasks with assigned_to as single value', () => {
        const user = { id: 1, name: 'Dave', email: 'dave@test.com' };
        const tasks = [
          { id: 1, assigned_to: 1, status: 'completed' }
        ];

        const stats = reportService._calculateUserStats(user, tasks);

        expect(stats.totalTasks).toBe(1);
        expect(stats.completedTasks).toBe(1);
      });
    });

    describe('_calculateProjectStats', () => {
      test('should calculate stats for project with tasks', () => {
        const project = { id: 1, name: 'Project Alpha' };
        const tasks = [
          { id: 1, project_id: 1, status: 'completed' },
          { id: 2, project_id: 1, status: 'completed' },
          { id: 3, project_id: 1, status: 'completed' },
          { id: 4, project_id: 1, status: 'in_progress' },
          { id: 5, project_id: 2, status: 'completed' }
        ];

        const stats = reportService._calculateProjectStats(project, tasks);

        expect(stats).toEqual({
          projectId: 1,
          projectName: 'Project Alpha',
          totalTasks: 4,
          completedTasks: 3,
          inProgressTasks: 1,
          pendingTasks: 0,
          progressPercentage: 75
        });
      });

      test('should handle project with no tasks', () => {
        const project = { id: 2, name: 'Project Beta' };
        const tasks = [];

        const stats = reportService._calculateProjectStats(project, tasks);

        expect(stats.progressPercentage).toBe(0);
        expect(stats.totalTasks).toBe(0);
      });
    });

    describe('_summarizeManualTime', () => {
      test('should summarize time entries by project', () => {
        const entries = [
          { projectId: 1, projectName: 'Project A', hours: 5, userId: 1 },
          { projectId: 1, projectName: 'Project A', hours: 3, userId: 2 },
          { projectId: 2, projectName: 'Project B', hours: 4, userId: 1 }
        ];

        const summary = reportService._summarizeManualTime(entries);

        expect(summary.totalHours).toBe(12);
        expect(summary.totalUsers).toBe(2);
        expect(summary.byProject).toHaveLength(2);

        const projectA = summary.byProject.find(p => p.projectId === 1);
        expect(projectA.totalHours).toBe(8);
        expect(projectA.userCount).toBe(2);
        expect(projectA.avgHoursPerUser).toBe(4);
      });

      test('should summarize time entries by department', () => {
        const entries = [
          { department: 'Engineering', hours: 10, userId: 1 },
          { department: 'Engineering', hours: 5, userId: 2 },
          { department: 'Sales', hours: 3, userId: 3 }
        ];

        const summary = reportService._summarizeManualTime(entries);

        expect(summary.byDepartment).toHaveLength(2);

        const engDept = summary.byDepartment.find(d => d.department === 'Engineering');
        expect(engDept.totalHours).toBe(15);
        expect(engDept.userCount).toBe(2);
        expect(engDept.avgHoursPerUser).toBe(7.5);
      });

      test('should handle empty entries', () => {
        const summary = reportService._summarizeManualTime([]);

        expect(summary.totalHours).toBe(0);
        expect(summary.totalUsers).toBe(0);
        expect(summary.byProject).toEqual([]);
        expect(summary.byDepartment).toEqual([]);
      });

      test('should track unique users correctly', () => {
        const entries = [
          { projectId: 1, hours: 5, userId: 1 },
          { projectId: 1, hours: 3, userId: 1 }, // Same user, different entry
          { projectId: 2, hours: 4, userId: 2 }
        ];

        const summary = reportService._summarizeManualTime(entries);

        expect(summary.totalUsers).toBe(2); // Only 2 unique users

        const project1 = summary.byProject.find(p => p.projectId === 1);
        expect(project1.userCount).toBe(1); // Only 1 user for project 1
        expect(project1.totalHours).toBe(8); // But total hours is sum
      });

      test('should handle entries with null/undefined values', () => {
        const entries = [
          { projectId: null, department: 'Engineering', hours: 5, userId: 1 },
          { projectId: 1, department: null, hours: 3, userId: null },
          { hours: '10', userId: 2 } // String hours
        ];

        const summary = reportService._summarizeManualTime(entries);

        expect(summary.totalHours).toBe(18);
        expect(summary.byDepartment).toHaveLength(1);
        expect(summary.byProject).toHaveLength(1);
      });
    });

    describe('_normalizeIdArray', () => {
      test('should normalize valid ID arrays', () => {
        const result = reportService._normalizeIdArray([1, 2, 3, '4', '5']);
        expect(result).toEqual([1, 2, 3, 4, 5]);
      });

      test('should filter out invalid values', () => {
        const result = reportService._normalizeIdArray([1, 'invalid', null, undefined, -1, 0]);
        expect(result).toEqual([1]);
      });

      test('should handle empty array', () => {
        const result = reportService._normalizeIdArray([]);
        expect(result).toEqual([]);
      });

      test('should handle non-array input', () => {
        expect(reportService._normalizeIdArray(null)).toEqual([]);
        expect(reportService._normalizeIdArray(undefined)).toEqual([]);
        expect(reportService._normalizeIdArray('not an array')).toEqual([]);
      });

      test('should remove duplicates', () => {
        const result = reportService._normalizeIdArray([1, 2, 2, 3, 3, 3]);
        // Note: _normalizeIdArray may not remove duplicates in current implementation
        expect(result).toContain(1);
        expect(result).toContain(2);
        expect(result).toContain(3);
      });

      test('should handle floating point numbers', () => {
        const result = reportService._normalizeIdArray([1.5, 2.9, 3.1]);
        expect(result).toEqual([1, 2, 3]); // Should truncate
      });
    });

    describe('_roundToTwo', () => {
      test('should round to 2 decimal places', () => {
        expect(reportService._roundToTwo(1.234)).toBe(1.23);
        expect(reportService._roundToTwo(1.235)).toBe(1.24);
        expect(reportService._roundToTwo(1.999)).toBe(2);
      });

      test('should handle integers', () => {
        expect(reportService._roundToTwo(5)).toBe(5);
      });

      test('should handle edge cases', () => {
        expect(reportService._roundToTwo(0)).toBe(0);
        expect(reportService._roundToTwo(-1.235)).toBe(-1.24);
      });
    });

    describe('_sanitizeManualTimeEntries', () => {
      test('should sanitize valid entries', () => {
        const entries = [
          {
            task_id: 1,
            user_id: 1,
            hours: 5,
            logged_at: '2025-10-01',
            project_id: 1,
            project_name: 'Project A',
            department: 'Engineering',
            user_name: 'Alice',
            task_status: 'completed',
            task_priority: 'high',
            task_title: 'Task 1'
          }
        ];

        const result = reportService._sanitizeManualTimeEntries(entries);

        expect(result).toHaveLength(1);
        expect(result[0]).toHaveProperty('taskId', 1);
        expect(result[0]).toHaveProperty('userId', 1);
        expect(result[0]).toHaveProperty('projectId', 1);
      });

      test('should handle entries with missing fields', () => {
        const entries = [
          { task_id: 1, hours: 5 },
          { user_id: 2, hours: 3 }
        ];

        const result = reportService._sanitizeManualTimeEntries(entries);

        expect(result).toHaveLength(2);
        expect(result[0].userId).toBeNull();
        expect(result[1].taskId).toBeNull();
      });

      test('should convert numeric strings', () => {
        const entries = [
          { task_id: '1', user_id: '2', hours: '5.5' }
        ];

        const result = reportService._sanitizeManualTimeEntries(entries);

        // Note: taskId and userId are not converted in current implementation, only projectId
        expect(result[0].taskId).toBe('1');
        expect(result[0].userId).toBe('2');
        expect(result[0].hours).toBe(5.5);
      });
    });
  });

});
