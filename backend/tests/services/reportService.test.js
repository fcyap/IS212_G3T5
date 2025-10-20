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
});
