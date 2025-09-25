const projectRepository = require('../../src/repository/projectRepository');
const supabase = require('../../src/utils/supabase');

jest.mock('../../src/utils/supabase', () => ({
  from: jest.fn(() => ({
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn(),
    order: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    contains: jest.fn().mockReturnThis()
  }))
}));

describe('ProjectRepository', () => {
  let mockFrom, mockChain;

  beforeEach(() => {
    jest.clearAllMocks();

    mockChain = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn(),
      order: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      contains: jest.fn().mockReturnThis()
    };

    mockFrom = jest.fn(() => mockChain);
    supabase.from = mockFrom;
  });

  describe('create', () => {
    test('should create project successfully', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'Test Description',
        user_ids: [1, 2],
        created_at: '2023-01-01T00:00:00.000Z'
      };

      const mockResult = { data: { id: 1, ...projectData }, error: null };
      mockChain.single.mockResolvedValue(mockResult);

      const result = await projectRepository.create(projectData);

      expect(supabase.from).toHaveBeenCalledWith('projects');
      expect(mockChain.insert).toHaveBeenCalledWith([projectData]);
      expect(mockChain.select).toHaveBeenCalledWith('*');
      expect(mockChain.single).toHaveBeenCalled();
      expect(result).toEqual({ id: 1, ...projectData });
    });

    test('should throw error when database error occurs', async () => {
      const projectData = { name: 'Test Project' };
      const mockResult = { data: null, error: { message: 'Database error' } };
      mockChain.single.mockResolvedValue(mockResult);

      await expect(projectRepository.create(projectData)).rejects.toThrow('Database error: Database error');
    });
  });

  describe('findAll', () => {
    test('should find all projects successfully', async () => {
      const mockProjects = [
        { id: 1, name: 'Project 1' },
        { id: 2, name: 'Project 2' }
      ];
      const mockResult = { data: mockProjects, error: null };
      mockChain.order.mockResolvedValue(mockResult);

      const result = await projectRepository.findAll();

      expect(supabase.from).toHaveBeenCalledWith('projects');
      expect(mockChain.select).toHaveBeenCalledWith('*');
      expect(mockChain.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(result).toEqual(mockProjects);
    });

    test('should throw error when database error occurs', async () => {
      const mockResult = { data: null, error: { message: 'Database error' } };
      mockChain.order.mockResolvedValue(mockResult);

      await expect(projectRepository.findAll()).rejects.toThrow('Database error: Database error');
    });

    test('should return empty array when no projects exist', async () => {
      const mockResult = { data: [], error: null };
      mockChain.order.mockResolvedValue(mockResult);

      const result = await projectRepository.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    test('should find project by id successfully', async () => {
      const mockProject = { id: 1, name: 'Test Project' };
      const mockResult = { data: mockProject, error: null };
      mockChain.single.mockResolvedValue(mockResult);

      const result = await projectRepository.findById(1);

      expect(supabase.from).toHaveBeenCalledWith('projects');
      expect(mockChain.select).toHaveBeenCalledWith('*');
      expect(mockChain.eq).toHaveBeenCalledWith('id', 1);
      expect(mockChain.single).toHaveBeenCalled();
      expect(result).toEqual(mockProject);
    });

    test('should return null when project not found', async () => {
      const mockResult = { data: null, error: { code: 'PGRST116' } };
      mockChain.single.mockResolvedValue(mockResult);

      const result = await projectRepository.findById(999);

      expect(result).toBeNull();
    });

    test('should throw error when database error occurs', async () => {
      const mockResult = { data: null, error: { message: 'Database error' } };
      mockChain.single.mockResolvedValue(mockResult);

      await expect(projectRepository.findById(1)).rejects.toThrow('Database error: Database error');
    });
  });

  describe('update', () => {
    test('should update project successfully', async () => {
      const updateData = { name: 'Updated Project' };
      const mockProject = { id: 1, name: 'Updated Project' };
      const mockResult = { data: mockProject, error: null };
      mockChain.single.mockResolvedValue(mockResult);

      const result = await projectRepository.update(1, updateData);

      expect(supabase.from).toHaveBeenCalledWith('projects');
      expect(mockChain.update).toHaveBeenCalledWith(updateData);
      expect(mockChain.eq).toHaveBeenCalledWith('id', 1);
      expect(mockChain.select).toHaveBeenCalledWith('*');
      expect(mockChain.single).toHaveBeenCalled();
      expect(result).toEqual(mockProject);
    });

    test('should return null when project not found', async () => {
      const updateData = { name: 'Updated Project' };
      const mockResult = { data: null, error: { code: 'PGRST116' } };
      mockChain.single.mockResolvedValue(mockResult);

      const result = await projectRepository.update(999, updateData);

      expect(result).toBeNull();
    });

    test('should throw error when database error occurs', async () => {
      const updateData = { name: 'Updated Project' };
      const mockResult = { data: null, error: { message: 'Database error' } };
      mockChain.single.mockResolvedValue(mockResult);

      await expect(projectRepository.update(1, updateData)).rejects.toThrow('Database error: Database error');
    });
  });

  describe('delete', () => {
    test('should delete project successfully', async () => {
      const mockResult = { error: null };
      mockChain.delete.mockResolvedValue(mockResult);

      const result = await projectRepository.delete(1);

      expect(supabase.from).toHaveBeenCalledWith('projects');
      expect(mockChain.delete).toHaveBeenCalled();
      expect(mockChain.eq).toHaveBeenCalledWith('id', 1);
      expect(result).toBe(true);
    });

    test('should throw error when database error occurs', async () => {
      const mockResult = { error: { message: 'Database error' } };
      mockChain.delete.mockResolvedValue(mockResult);

      await expect(projectRepository.delete(1)).rejects.toThrow('Database error: Database error');
    });
  });

  describe('findByUserId', () => {
    test('should find projects by user id successfully', async () => {
      const mockProjects = [
        { id: 1, name: 'Project 1', user_ids: [1, 2] },
        { id: 2, name: 'Project 2', user_ids: [1, 3] }
      ];
      const mockResult = { data: mockProjects, error: null };
      mockChain.order.mockResolvedValue(mockResult);

      const result = await projectRepository.findByUserId(1);

      expect(supabase.from).toHaveBeenCalledWith('projects');
      expect(mockChain.select).toHaveBeenCalledWith('*');
      expect(mockChain.contains).toHaveBeenCalledWith('user_ids', [1]);
      expect(mockChain.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(result).toEqual(mockProjects);
    });

    test('should throw error when database error occurs', async () => {
      const mockResult = { data: null, error: { message: 'Database error' } };
      mockChain.order.mockResolvedValue(mockResult);

      await expect(projectRepository.findByUserId(1)).rejects.toThrow('Database error: Database error');
    });

    test('should return empty array when user has no projects', async () => {
      const mockResult = { data: [], error: null };
      mockChain.order.mockResolvedValue(mockResult);

      const result = await projectRepository.findByUserId(999);

      expect(result).toEqual([]);
    });
  });

  describe('exists', () => {
    test('should return true when project exists', async () => {
      const mockResult = { data: { id: 1 }, error: null };
      mockChain.single.mockResolvedValue(mockResult);

      const result = await projectRepository.exists(1);

      expect(supabase.from).toHaveBeenCalledWith('projects');
      expect(mockChain.select).toHaveBeenCalledWith('id');
      expect(mockChain.eq).toHaveBeenCalledWith('id', 1);
      expect(mockChain.single).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    test('should return false when project does not exist', async () => {
      const mockResult = { data: null, error: { code: 'PGRST116' } };
      mockChain.single.mockResolvedValue(mockResult);

      const result = await projectRepository.exists(999);

      expect(result).toBe(false);
    });

    test('should throw error when database error occurs', async () => {
      const mockResult = { data: null, error: { message: 'Database error' } };
      mockChain.single.mockResolvedValue(mockResult);

      await expect(projectRepository.exists(1)).rejects.toThrow('Database error: Database error');
    });

    test('should return false when data is null but no PGRST116 error', async () => {
      const mockResult = { data: null, error: null };
      mockChain.single.mockResolvedValue(mockResult);

      const result = await projectRepository.exists(1);

      expect(result).toBe(false);
    });
  });
});