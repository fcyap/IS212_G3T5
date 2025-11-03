const reportService = require('../../src/services/reportService');
const reportRepository = require('../../src/repository/reportRepository');

jest.mock('../../src/repository/reportRepository');

describe('Report Service - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // ADVANCED SCENARIOS
  // ============================================

  describe('generateTaskReport - Complex Filtering', () => {
    test('should handle combined project and date filters', async () => {
      const adminUser = { id: 1, role: 'admin', department: 'IT' };

      const mockTasks = [
        {
          id: 1,
          title: 'Task 1',
          status: 'completed',
          deadline: '2025-10-15',
          created_at: '2025-09-15',
          project_id: 1,
          projects: { name: 'Project A' }
        },
        {
          id: 2,
          title: 'Task 2',
          status: 'in_progress',
          deadline: '2025-11-05',
          created_at: '2025-10-05',
          project_id: 2,
          projects: { name: 'Project B' }
        }
      ];

      reportRepository.getTasksForReport.mockResolvedValue({
        data: mockTasks,
        error: null
      });

      const result = await reportService.generateTaskReport(adminUser, {
        projectIds: [1, 2],
        startDate: '2025-10-01',
        endDate: '2025-11-30'
      });

      expect(reportRepository.getTasksForReport).toHaveBeenCalledWith({
        projectIds: [1, 2],
        userIds: undefined,
        startDate: '2025-10-01',
        endDate: '2025-11-30'
      });
      expect(result.tasks).toHaveLength(2);
    });

    test('should handle user-specific filtering for HR', () => {
      const hrUser = { id: 1, role: 'hr', department: 'Sales' };

      reportRepository.getUsersByDepartmentHierarchy.mockResolvedValue({
        data: [{ id: 5 }, { id: 6 }],
        error: null
      });

      reportRepository.getProjectsByDepartment.mockResolvedValue({
        data: [{ id: 10 }, { id: 11 }, { id: 12 }],
        error: null
      });

      reportRepository.getTasksForReport.mockResolvedValue({
        data: [],
        error: null
      });

      return reportService.generateTaskReport(hrUser, { projectIds: [10, 11, 99] }).then(() => {
        expect(reportRepository.getTasksForReport).toHaveBeenCalledWith(
          expect.objectContaining({
            projectIds: [10, 11] // Project 99 filtered out
          })
        );
      });
    });
  });

  // ============================================
  // EXPORT TESTS - PDF GENERATION
  // ============================================

  describe('Export Tests - PDF Generation', () => {
    test('should generate PDF with correct filename for task report', async () => {
      const reportData = {
        tasks: [
          { id: 1, title: 'Task 1', status: 'completed', priority: 'high', project_name: 'Project A' }
        ],
        summary: {
          totalTasks: 1,
          byStatus: { completed: 1, in_progress: 0, pending: 0, blocked: 0 },
          byPriority: { low: 0, medium: 0, high: 1 }
        }
      };

      const result = await reportService.exportReportToPDF(reportData);

      expect(result).toHaveProperty('format', 'pdf');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('filename');
      expect(result.filename).toMatch(/task-report-\d{4}-\d{2}-\d{2}\.pdf/);
      expect(Buffer.isBuffer(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
    });

    test('should generate PDF with correct filename for departmental report', async () => {
      const reportData = {
        reportType: 'departmental_performance',
        departments: [
          {
            department: 'Engineering',
            totalTasks: 10,
            memberCount: 5,
            completionRate: 70,
            statusCounts: { completed: 7, in_progress: 2, pending: 1 }
          }
        ],
        summary: {
          totalDepartments: 1,
          totalMembers: 5
        }
      };

      const result = await reportService.exportReportToPDF(reportData);

      expect(result.filename).toMatch(/departmental-performance-\d{4}-\d{2}-\d{2}\.pdf/);
      expect(result.data.length).toBeGreaterThan(0);
    });

    test('should generate PDF with correct filename for manual time report', async () => {
      const reportData = {
        reportType: 'manual_time',
        entries: [
          {
            taskId: 1,
            userId: 1,
            hours: 5,
            projectName: 'Project A',
            taskTitle: 'Task 1',
            taskStatus: 'completed',
            taskPriority: 'high'
          }
        ],
        summary: {
          totalHours: 5,
          byProject: [
            { projectName: 'Project A', totalHours: 5, userCount: 1, avgHoursPerUser: 5 }
          ]
        },
        view: 'project'
      };

      const result = await reportService.exportReportToPDF(reportData);

      expect(result.filename).toMatch(/logged-time-report-\d{4}-\d{2}-\d{2}\.pdf/);
    });
  });

  // ============================================
  // EXPORT TESTS - SPREADSHEET GENERATION
  // ============================================

  describe('Export Tests - Spreadsheet Generation', () => {
    test('should generate XLSX for task report', async () => {
      const reportData = {
        tasks: [
          {
            id: 1,
            title: 'Task 1',
            status: 'completed',
            priority: 'high',
            deadline: '2025-10-31',
            created_at: '2025-10-01',
            project_id: 1,
            project_name: 'Project A'
          }
        ],
        summary: {
          totalTasks: 1,
          byStatus: { completed: 1, in_progress: 0, pending: 0, blocked: 0 }
        }
      };

      const result = await reportService.exportReportToSpreadsheet(reportData, 'xlsx');

      expect(result).toHaveProperty('format', 'xlsx');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('filename');
      expect(result.filename).toMatch(/task-report-\d{4}-\d{2}-\d{2}\.xlsx/);
      expect(Buffer.isBuffer(result.data)).toBe(true);
    });

    test('should generate CSV for task report', async () => {
      const reportData = {
        tasks: [
          {
            id: 1,
            title: 'Task 1',
            status: 'completed',
            priority: 'high'
          }
        ]
      };

      const result = await reportService.exportReportToSpreadsheet(reportData, 'csv');

      expect(result.format).toBe('csv');
      expect(result.filename).toMatch(/task-report-\d{4}-\d{2}-\d{2}\.csv/);
    });

    test('should generate spreadsheet for departmental report', async () => {
      const reportData = {
        reportType: 'departmental_performance',
        departments: [
          { department: 'Engineering', totalTasks: 10, memberCount: 5 }
        ],
        summary: {
          totalDepartments: 1,
          totalMembers: 5,
          totalTasks: 10
        }
      };

      const result = await reportService.exportReportToSpreadsheet(reportData, 'xlsx');

      expect(result.filename).toMatch(/departmental-performance-\d{4}-\d{2}-\d{2}\.xlsx/);
    });

    test('should generate spreadsheet for manual time report', async () => {
      const reportData = {
        reportType: 'manual_time',
        entries: [
          { taskId: 1, userId: 1, hours: 5, projectName: 'Project A', taskTitle: 'Task 1' }
        ],
        summary: {
          totalHours: 5,
          byProject: [
            { projectName: 'Project A', totalHours: 5, userCount: 1, avgHoursPerUser: 5 }
          ]
        },
        view: 'project'
      };

      const result = await reportService.exportReportToSpreadsheet(reportData, 'xlsx');

      expect(result.filename).toMatch(/logged-time-report-\d{4}-\d{2}-\d{2}\.xlsx/);
    });
  });

  // ============================================
  // EDGE CASES AND BOUNDARY TESTS
  // ============================================

  describe('Edge Cases and Boundary Tests', () => {
    test('should handle special characters in task data', async () => {
      const adminUser = { id: 1, role: 'admin', department: 'IT' };

      const tasks = [
        {
          id: 1,
          title: 'Task with "quotes" and \'apostrophes\'',
          status: 'completed',
          priority: 'high',
          projects: { name: 'Project with <tags> & symbols' }
        }
      ];

      reportRepository.getTasksForReport.mockResolvedValue({
        data: tasks,
        error: null
      });

      const result = await reportService.generateTaskReport(adminUser, {});

      expect(result.tasks[0].title).toContain('quotes');
      expect(result.tasks[0].project_name).toContain('symbols');
    });

    test('should handle empty project list for HR user', async () => {
      const hrUser = { id: 1, role: 'hr', department: 'EmptyDept' };

      reportRepository.getUsersByDepartmentHierarchy.mockResolvedValue({
        data: [{ id: 99 }],
        error: null
      });

      reportRepository.getProjectsByDepartment.mockResolvedValue({
        data: [],
        error: null
      });

      reportRepository.getTasksForReport.mockResolvedValue({
        data: [],
        error: null
      });

      const result = await reportService.generateTaskReport(hrUser, {});

      expect(result.tasks).toEqual([]);
      expect(result.summary.totalTasks).toBe(0);
    });

    test('should handle tasks with null assigned_to', () => {
      const user = { id: 1, name: 'Test', email: 'test@test.com' };
      const tasks = [
        { id: 1, assigned_to: null, status: 'completed' },
        { id: 2, assigned_to: undefined, status: 'pending' },
        { id: 3, assigned_to: [1], status: 'completed' }
      ];

      const stats = reportService._calculateUserStats(user, tasks);

      expect(stats.totalTasks).toBe(1); // Only task 3
      expect(stats.completedTasks).toBe(1);
    });

    test('should handle very long task titles in summary', () => {
      const longTitle = 'A'.repeat(500);
      const tasks = [
        { id: 1, title: longTitle, status: 'completed', priority: 'high' }
      ];

      const summary = reportService._calculateTaskSummary(tasks);

      expect(summary.totalTasks).toBe(1);
      expect(summary.byStatus.completed).toBe(1);
    });
  });

  // ============================================
  // ERROR HANDLING - COMPREHENSIVE
  // ============================================

  describe('Error Handling - Comprehensive', () => {
    test('should handle null response from repository', async () => {
      const hrUser = { id: 1, role: 'hr', department: 'Engineering' };

      reportRepository.getUsersByDepartmentHierarchy.mockResolvedValue({
        data: null,
        error: new Error('Connection lost')
      });

      await expect(
        reportService.generateTaskReport(hrUser, {})
      ).rejects.toThrow('Connection lost');
    });

    test('should handle malformed task data gracefully', () => {
      const tasks = [
        { id: 1 }, // Missing status and priority
        { status: 'completed' }, // Missing id
        null, // Null task
        undefined // Undefined task
      ].filter(Boolean); // Filter out null/undefined

      const summary = reportService._calculateTaskSummary(tasks);

      expect(summary.totalTasks).toBe(2);
    });

    test('should handle invalid hours in manual time entries', () => {
      const entries = [
        { hours: 'not a number', userId: 1 },
        { hours: -5, userId: 2 },
        { hours: Infinity, userId: 3 },
        { hours: NaN, userId: 4 }
      ];

      const summary = reportService._summarizeManualTime(entries);

      expect(summary.totalHours).toBe(0); // Invalid hours treated as 0
    });
  });

  // ============================================
  // PERFORMANCE AND SCALABILITY TESTS
  // ============================================

  describe('Performance and Scalability Tests', () => {
    test('should handle large dataset efficiently', async () => {
      const adminUser = { id: 1, role: 'admin', department: 'IT' };

      const largeTasks = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        title: `Task ${i + 1}`,
        status: i % 2 === 0 ? 'completed' : 'in_progress',
        priority: 'medium',
        projects: { name: 'Project A' }
      }));

      reportRepository.getTasksForReport.mockResolvedValue({
        data: largeTasks,
        error: null
      });

      const startTime = Date.now();
      const result = await reportService.generateTaskReport(adminUser, {});
      const endTime = Date.now();

      expect(result.tasks).toHaveLength(1000);
      expect(result.summary.totalTasks).toBe(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should handle many unique users in manual time tracking', () => {
      const entries = Array.from({ length: 100 }, (_, i) => ({
        projectId: 1,
        hours: 5,
        userId: i + 1
      }));

      const summary = reportService._summarizeManualTime(entries);

      expect(summary.totalUsers).toBe(100);
      expect(summary.totalHours).toBe(500);

      const project1 = summary.byProject.find(p => p.projectId === 1);
      expect(project1.userCount).toBe(100);
      expect(project1.avgHoursPerUser).toBe(5);
    });
  });
});
