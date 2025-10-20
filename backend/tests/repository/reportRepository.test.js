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
});
