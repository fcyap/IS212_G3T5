const reportRepository = require('../../src/repository/reportRepository');
const supabase = require('../../src/utils/supabase');

jest.mock('../../src/utils/supabase');

describe('ReportRepository', () => {
  let mockSupabase;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock supabase with chaining
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      then: jest.fn()
    };

    supabase.from = jest.fn(() => mockSupabase);
  });

  describe('getTasksForReport', () => {
    test('should retrieve tasks with basic filters', async () => {
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
        }
      ];

      mockSupabase.then.mockResolvedValue({ data: mockTasks, error: null });

      const filters = {
        projectIds: [1],
        statuses: ['completed', 'in_progress']
      };

      const result = await reportRepository.getTasksForReport(filters);

      expect(supabase.from).toHaveBeenCalledWith('tasks');
      expect(mockSupabase.select).toHaveBeenCalled();
      expect(result).toEqual({ data: mockTasks, error: null });
    });

    test('should filter tasks by status array', async () => {
      const mockTasks = [
        { id: 1, title: 'Task 1', status: 'completed' },
        { id: 2, title: 'Task 2', status: 'completed' }
      ];

      mockSupabase.then.mockResolvedValue({ data: mockTasks, error: null });

      const filters = {
        statuses: ['completed']
      };

      await reportRepository.getTasksForReport(filters);

      expect(mockSupabase.in).toHaveBeenCalledWith('status', ['completed']);
    });

    test('should filter tasks by project IDs', async () => {
      const mockTasks = [{ id: 1, project_id: 1 }];

      mockSupabase.then.mockResolvedValue({ data: mockTasks, error: null });

      const filters = {
        projectIds: [1, 2, 3]
      };

      await reportRepository.getTasksForReport(filters);

      expect(mockSupabase.in).toHaveBeenCalledWith('project_id', [1, 2, 3]);
    });

    test('should filter tasks by date range', async () => {
      const mockTasks = [{ id: 1, created_at: '2025-10-15' }];

      mockSupabase.then.mockResolvedValue({ data: mockTasks, error: null });

      const filters = {
        startDate: '2025-10-01',
        endDate: '2025-10-31'
      };

      await reportRepository.getTasksForReport(filters);

      expect(mockSupabase.gte).toHaveBeenCalledWith('created_at', '2025-10-01');
      expect(mockSupabase.lte).toHaveBeenCalledWith('created_at', '2025-10-31');
    });

    test('should filter tasks by assigned users', async () => {
      const mockTasks = [{ id: 1, assigned_to: [1] }];

      mockSupabase.then.mockResolvedValue({ data: mockTasks, error: null });

      const filters = {
        userIds: [1, 2]
      };

      await reportRepository.getTasksForReport(filters);

      expect(mockSupabase.select).toHaveBeenCalled();
    });

    test('should handle database errors', async () => {
      const mockError = new Error('Database connection failed');

      mockSupabase.then.mockResolvedValue({ data: null, error: mockError });

      const result = await reportRepository.getTasksForReport({});

      expect(result.error).toEqual(mockError);
      expect(result.data).toBeNull();
    });

    test('should retrieve all task fields needed for report', async () => {
      const mockTasks = [{
        id: 1,
        title: 'Task 1',
        description: 'Description',
        status: 'completed',
        priority: 'high',
        deadline: '2025-10-25',
        created_at: '2025-10-01',
        updated_at: '2025-10-20',
        project_id: 1,
        assigned_to: [1],
        creator_id: 1,
        tags: ['urgent']
      }];

      mockSupabase.then.mockResolvedValue({ data: mockTasks, error: null });

      const result = await reportRepository.getTasksForReport({});

      expect(mockSupabase.select).toHaveBeenCalledWith(
        expect.stringContaining('id')
      );
    });
  });

  describe('getUsersByDepartment', () => {
    test('should retrieve users in a specific department', async () => {
      const mockUsers = [
        { id: 1, name: 'Alice', email: 'alice@example.com', department: 'Engineering', role: 'staff' },
        { id: 2, name: 'Bob', email: 'bob@example.com', department: 'Engineering', role: 'staff' }
      ];

      mockSupabase.then.mockResolvedValue({ data: mockUsers, error: null });

      const result = await reportRepository.getUsersByDepartment('Engineering');

      expect(supabase.from).toHaveBeenCalledWith('users');
      expect(mockSupabase.eq).toHaveBeenCalledWith('department', 'Engineering');
      expect(result).toEqual({ data: mockUsers, error: null });
    });

    test('should retrieve users in department hierarchy', async () => {
      const mockUsers = [
        { id: 1, department: 'Engineering' },
        { id: 2, department: 'Engineering.Backend' },
        { id: 3, department: 'Engineering.Frontend' }
      ];

      mockSupabase.then.mockResolvedValue({ data: mockUsers, error: null });

      const result = await reportRepository.getUsersByDepartmentHierarchy('Engineering');

      expect(supabase.from).toHaveBeenCalledWith('users');
      expect(result.data).toHaveLength(3);
    });
  });

  describe('getProjectsByDepartment', () => {
    test('should retrieve projects filtered by department users', async () => {
      const mockProjects = [
        { id: 1, name: 'Project A', creator_id: 1 },
        { id: 2, name: 'Project B', creator_id: 2 }
      ];

      mockSupabase.then.mockResolvedValue({ data: mockProjects, error: null });

      const userIds = [1, 2];
      const result = await reportRepository.getProjectsByDepartment(userIds);

      expect(supabase.from).toHaveBeenCalledWith('projects');
      expect(mockSupabase.in).toHaveBeenCalledWith('creator_id', userIds);
      expect(result).toEqual({ data: mockProjects, error: null });
    });

    test('should return empty array for no users', async () => {
      const result = await reportRepository.getProjectsByDepartment([]);

      expect(result).toEqual({ data: [], error: null });
    });
  });

  describe('getTaskStatisticsByStatus', () => {
    test('should aggregate tasks by status', async () => {
      const mockStats = [
        { status: 'pending', count: 5 },
        { status: 'in_progress', count: 3 },
        { status: 'completed', count: 10 },
        { status: 'blocked', count: 2 }
      ];

      mockSupabase.then.mockResolvedValue({ data: mockStats, error: null });

      const result = await reportRepository.getTaskStatisticsByStatus([1, 2]);

      expect(supabase.from).toHaveBeenCalledWith('tasks');
      expect(mockSupabase.select).toHaveBeenCalled();
    });
  });

  describe('getTaskStatisticsByPriority', () => {
    test('should aggregate tasks by priority', async () => {
      const mockStats = [
        { priority: 'low', count: 8 },
        { priority: 'medium', count: 7 },
        { priority: 'high', count: 5 }
      ];

      mockSupabase.then.mockResolvedValue({ data: mockStats, error: null });

      const result = await reportRepository.getTaskStatisticsByPriority([1]);

      expect(supabase.from).toHaveBeenCalledWith('tasks');
      expect(result).toEqual({ data: mockStats, error: null });
    });
  });

  describe('getTaskStatisticsByUser', () => {
    test('should aggregate tasks by assigned user', async () => {
      const mockTasks = [
        { id: 1, assigned_to: [1, 2], status: 'completed' },
        { id: 2, assigned_to: [1], status: 'in_progress' },
        { id: 3, assigned_to: [2], status: 'completed' }
      ];

      mockSupabase.then.mockResolvedValue({ data: mockTasks, error: null });

      const result = await reportRepository.getTaskStatisticsByUser([1, 2]);

      expect(supabase.from).toHaveBeenCalledWith('tasks');
    });
  });

  describe('getAllDepartments', () => {
    test('should retrieve all unique departments', async () => {
      const mockUsers = [
        { department: 'Engineering' },
        { department: 'Engineering.Backend' },
        { department: 'HR' },
        { department: 'Engineering' }
      ];

      mockSupabase.then.mockResolvedValue({ data: mockUsers, error: null });

      const result = await reportRepository.getAllDepartments();

      expect(supabase.from).toHaveBeenCalledWith('users');
      expect(mockSupabase.select).toHaveBeenCalledWith('department');
      expect(result.data).toEqual(['Engineering', 'Engineering.Backend', 'HR']);
    });

    test('should handle errors when fetching departments', async () => {
      const mockError = { message: 'Database error' };
      mockSupabase.then.mockResolvedValue({ data: null, error: mockError });

      const result = await reportRepository.getAllDepartments();

      expect(result).toEqual({ data: null, error: mockError });
    });
  });

  describe('getDepartmentComparison', () => {
    test('should return department statistics with task counts by status and priority', async () => {
      const mockUsers = [
        { id: 1, name: 'User 1', department: 'Engineering' },
        { id: 2, name: 'User 2', department: 'Engineering.Backend' },
        { id: 3, name: 'User 3', department: 'HR' }
      ];

      const mockTasks = [
        { id: 1, assigned_to: [1], status: 'completed', priority: 'high' },
        { id: 2, assigned_to: [1, 2], status: 'in_progress', priority: 'medium' },
        { id: 3, assigned_to: [2], status: 'completed', priority: 'low' },
        { id: 4, assigned_to: [3], status: 'pending', priority: 'high' }
      ];

      // Mock users query with proper promise chaining
      const mockUsersQuery = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        then: jest.fn((resolve) => {
          resolve({ data: mockUsers, error: null });
          return Promise.resolve({ data: mockUsers, error: null });
        })
      };

      supabase.from = jest.fn((table) => {
        if (table === 'users') return mockUsersQuery;
        return mockSupabase;
      });

      // Mock getTasksForReport call
      jest.spyOn(reportRepository, 'getTasksForReport').mockResolvedValue({
        data: mockTasks,
        error: null
      });

      const filters = {
        departmentIds: ['Engineering', 'HR'],
        startDate: '2025-10-01',
        endDate: '2025-10-31'
      };

      const result = await reportRepository.getDepartmentComparison(filters);

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(2); // Engineering and HR

      const engineeringDept = result.data.find(d => d.department === 'Engineering');
      expect(engineeringDept).toBeDefined();
      expect(engineeringDept.totalTasks).toBeGreaterThan(0);
      expect(engineeringDept.statusCounts).toHaveProperty('pending');
      expect(engineeringDept.statusCounts).toHaveProperty('in_progress');
      expect(engineeringDept.statusCounts).toHaveProperty('completed');
      expect(engineeringDept.priorityCounts).toHaveProperty('low');
      expect(engineeringDept.priorityCounts).toHaveProperty('medium');
      expect(engineeringDept.priorityCounts).toHaveProperty('high');
      expect(engineeringDept.completionRate).toBeGreaterThanOrEqual(0);
      expect(engineeringDept.averageTasksPerMember).toBeGreaterThanOrEqual(0);
    });

    test('should handle empty department list', async () => {
      const mockUsersQuery = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        then: jest.fn((resolve) => {
          resolve({ data: [], error: null });
          return Promise.resolve({ data: [], error: null });
        })
      };

      supabase.from = jest.fn(() => mockUsersQuery);

      const result = await reportRepository.getDepartmentComparison({ departmentIds: [] });

      expect(result.data).toEqual([]);
      expect(result.error).toBeNull();
    });
  });

  describe('getWeeklyMonthlyStats', () => {
    test('should group tasks by week', async () => {
      const mockTasks = [
        { id: 1, created_at: '2025-10-01T10:00:00Z', status: 'completed', priority: 'high' },
        { id: 2, created_at: '2025-10-08T10:00:00Z', status: 'in_progress', priority: 'medium' },
        { id: 3, created_at: '2025-10-15T10:00:00Z', status: 'completed', priority: 'low' }
      ];

      jest.spyOn(reportRepository, 'getTasksForReport').mockResolvedValue({
        data: mockTasks,
        error: null
      });

      const filters = {
        startDate: '2025-10-01',
        endDate: '2025-10-31',
        interval: 'week'
      };

      const result = await reportRepository.getWeeklyMonthlyStats(filters);

      expect(result.error).toBeNull();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      
      const firstPeriod = result.data[0];
      expect(firstPeriod).toHaveProperty('period');
      expect(firstPeriod).toHaveProperty('totalTasks');
      expect(firstPeriod).toHaveProperty('statusCounts');
      expect(firstPeriod).toHaveProperty('priorityCounts');
      expect(firstPeriod).toHaveProperty('completionRate');
      expect(firstPeriod.period).toMatch(/^\d{4}-W\d{2}$/); // Format: YYYY-WNN
    });

    test('should group tasks by month', async () => {
      const mockTasks = [
        { id: 1, created_at: '2025-09-15T10:00:00Z', status: 'completed', priority: 'high' },
        { id: 2, created_at: '2025-10-05T10:00:00Z', status: 'in_progress', priority: 'medium' },
        { id: 3, created_at: '2025-10-20T10:00:00Z', status: 'completed', priority: 'low' }
      ];

      jest.spyOn(reportRepository, 'getTasksForReport').mockResolvedValue({
        data: mockTasks,
        error: null
      });

      const filters = {
        startDate: '2025-09-01',
        endDate: '2025-10-31',
        interval: 'month'
      };

      const result = await reportRepository.getWeeklyMonthlyStats(filters);

      expect(result.error).toBeNull();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThanOrEqual(1);
      
      const firstPeriod = result.data[0];
      expect(firstPeriod.period).toMatch(/^\d{4}-\d{2}$/); // Format: YYYY-MM
    });

    test('should calculate correct completion rates for each period', async () => {
      const mockTasks = [
        { id: 1, created_at: '2025-10-01T10:00:00Z', status: 'completed', priority: 'high' },
        { id: 2, created_at: '2025-10-02T10:00:00Z', status: 'completed', priority: 'high' },
        { id: 3, created_at: '2025-10-03T10:00:00Z', status: 'pending', priority: 'medium' }
      ];

      jest.spyOn(reportRepository, 'getTasksForReport').mockResolvedValue({
        data: mockTasks,
        error: null
      });

      const filters = {
        startDate: '2025-10-01',
        endDate: '2025-10-31',
        interval: 'month'
      };

      const result = await reportRepository.getWeeklyMonthlyStats(filters);

      expect(result.error).toBeNull();
      const monthPeriod = result.data.find(p => p.period === '2025-10');
      expect(monthPeriod).toBeDefined();
      expect(monthPeriod.completionRate).toBe(67); // 2/3 = 66.67 rounded to 67
    });
  });
});

