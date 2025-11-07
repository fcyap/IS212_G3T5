const userRepository = require('../../src/repository/userRepository');
const supabase = require('../../src/utils/supabase');

jest.mock('../../src/utils/supabase');

describe('UserRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllUsers', () => {
    test('should return users successfully', async () => {
      const mockUsers = [
        { id: 1, name: 'User 1', email: 'user1@test.com' },
        { id: 2, name: 'User 2', email: 'user2@test.com' }
      ];

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockUsers, error: null })
      });

      const result = await userRepository.getAllUsers();

      expect(result.users).toEqual(mockUsers);
      expect(result.totalCount).toBe(2);
      expect(result.pagination.page).toBe(1);
    });

    test('should fallback to hardcoded data on test connection error', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Connection failed' }
        })
      });

      const result = await userRepository.getAllUsers();

      expect(result.users).toHaveLength(3);
      expect(result.users[0].name).toBe('John Doe');
    });

    test('should fallback to hardcoded data on users fetch error', async () => {
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue({ data: 5, error: null })
      }).mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Fetch error' }
        })
      });

      const result = await userRepository.getAllUsers();

      expect(result.users).toHaveLength(3);
      expect(result.users[1].email).toBe('jane@example.com');
    });

    test('should handle unexpected errors', async () => {
      supabase.from.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const result = await userRepository.getAllUsers();

      expect(result.users).toHaveLength(3);
      expect(result.totalCount).toBe(3);
    });
  });

  describe('findById', () => {
    test('should find user by id successfully', async () => {
      const mockUser = { id: 1, name: 'Test User', email: 'test@test.com' };

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockUser, error: null })
      });

      const result = await userRepository.findById(1);

      expect(result).toEqual(mockUser);
      expect(supabase.from).toHaveBeenCalledWith('users');
    });

    test('should throw error when user not found', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'User not found' }
        })
      });

      await expect(userRepository.findById(999)).rejects.toThrow('Database error: User not found');
    });
  });

  describe('findAll', () => {
    test('should find all users successfully', async () => {
      const mockUsers = [
        { id: 1, name: 'User 1' },
        { id: 2, name: 'User 2' }
      ];

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockUsers, error: null })
      });

      const result = await userRepository.findAll();

      expect(result).toEqual(mockUsers);
    });

    test('should throw error on database error', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' }
        })
      });

      await expect(userRepository.findAll()).rejects.toThrow('Database error');
    });

    test('should return empty array when data is null', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      const result = await userRepository.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('getUserById', () => {
    test('should get user by id successfully', async () => {
      const mockUser = { id: 1, name: 'Test User' };

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockUser, error: null })
      });

      const result = await userRepository.getUserById(1);

      expect(result).toEqual(mockUser);
    });

    test('should throw error on database error', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' }
        })
      });

      await expect(userRepository.getUserById(999)).rejects.toThrow('Not found');
    });
  });

  describe('getUserByEmail', () => {
    test('should get user by email successfully', async () => {
      const mockUser = { id: 1, email: 'test@test.com', name: 'Test User' };

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockUser, error: null })
      });

      const result = await userRepository.getUserByEmail('test@test.com');

      expect(result).toEqual(mockUser);
    });

    test('should throw error when email not found', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Email not found' }
        })
      });

      await expect(userRepository.getUserByEmail('notfound@test.com')).rejects.toThrow('Email not found');
    });
  });

  describe('createUser', () => {
    test('should create user successfully', async () => {
      const userData = { name: 'New User', email: 'new@test.com', role: 'staff' };
      const mockCreatedUser = { id: 5, ...userData };

      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: [mockCreatedUser], error: null })
      });

      const result = await userRepository.createUser(userData);

      expect(result).toEqual(mockCreatedUser);
      expect(supabase.from).toHaveBeenCalledWith('users');
    });

    test('should throw error on creation failure', async () => {
      const userData = { name: 'New User', email: 'new@test.com' };

      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Creation failed' }
        })
      });

      await expect(userRepository.createUser(userData)).rejects.toThrow('Creation failed');
    });
  });

  describe('updateUser', () => {
    test('should update user successfully', async () => {
      const updates = { name: 'Updated Name', role: 'manager' };
      const mockUpdatedUser = { id: 1, name: 'Updated Name', role: 'manager' };

      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: [mockUpdatedUser], error: null })
      });

      const result = await userRepository.updateUser(1, updates);

      expect(result).toEqual(mockUpdatedUser);
    });

    test('should throw error on update failure', async () => {
      const updates = { name: 'Updated Name' };

      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Update failed' }
        })
      });

      await expect(userRepository.updateUser(1, updates)).rejects.toThrow('Update failed');
    });
  });

  describe('deleteUser', () => {
    test('should delete user successfully', async () => {
      supabase.from.mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null })
      });

      const result = await userRepository.deleteUser(1);

      expect(result).toBe(true);
      expect(supabase.from).toHaveBeenCalledWith('users');
    });

    test('should throw error on deletion failure', async () => {
      supabase.from.mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          error: { message: 'Deletion failed' }
        })
      });

      await expect(userRepository.deleteUser(1)).rejects.toThrow('Deletion failed');
    });
  });

  describe('getUsersByIds', () => {
    test('should get multiple users by ids', async () => {
      const mockUsers = [
        { id: 1, name: 'User 1' },
        { id: 2, name: 'User 2' }
      ];

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: mockUsers, error: null })
      });

      const result = await userRepository.getUsersByIds([1, 2]);

      expect(result).toEqual(mockUsers);
    });

    test('should return empty array for empty ids', async () => {
      const result = await userRepository.getUsersByIds([]);

      expect(result).toEqual([]);
    });

    test('should return empty array for null ids', async () => {
      const result = await userRepository.getUsersByIds(null);

      expect(result).toEqual([]);
    });

    test('should throw error on database error', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' }
        })
      });

      await expect(userRepository.getUsersByIds([1, 2])).rejects.toThrow('Database error');
    });

    test('should return empty array when data is null', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      const result = await userRepository.getUsersByIds([1, 2]);

      expect(result).toEqual([]);
    });
  });

  describe('userExists', () => {
    test('should return true when user exists', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 1, name: 'User' },
          error: null
        })
      });

      const result = await userRepository.userExists(1);

      expect(result).toBe(true);
    });

    test('should return false when user does not exist', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' }
        })
      });

      const result = await userRepository.userExists(999);

      expect(result).toBe(false);
    });
  });

  describe('emailExists', () => {
    test('should return true when email exists', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 1, email: 'test@test.com' },
          error: null
        })
      });

      const result = await userRepository.emailExists('test@test.com');

      expect(result).toBe(true);
    });

    test('should return false when email does not exist', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' }
        })
      });

      const result = await userRepository.emailExists('notfound@test.com');

      expect(result).toBe(false);
    });
  });

  describe('searchUsers', () => {
    test('should search users by name or email', async () => {
      const mockUsers = [
        { id: 1, name: 'John Doe', email: 'john@test.com' },
        { id: 2, name: 'Jane Doe', email: 'jane@test.com' }
      ];

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockUsers, error: null })
      });

      const result = await userRepository.searchUsers('Doe');

      expect(result).toEqual(mockUsers);
    });

    test('should return empty array for empty query', async () => {
      const result = await userRepository.searchUsers('');

      expect(result).toEqual([]);
    });

    test('should return empty array for whitespace query', async () => {
      const result = await userRepository.searchUsers('   ');

      expect(result).toEqual([]);
    });

    test('should return empty array for null query', async () => {
      const result = await userRepository.searchUsers(null);

      expect(result).toEqual([]);
    });

    test('should return empty array for non-string query', async () => {
      const result = await userRepository.searchUsers(123);

      expect(result).toEqual([]);
    });

    test('should handle database error gracefully', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Search error' }
        })
      });

      const result = await userRepository.searchUsers('test');

      expect(result).toEqual([]);
    });

    test('should return empty array when data is null', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      const result = await userRepository.searchUsers('test');

      expect(result).toEqual([]);
    });

    test('should use custom limit when provided', async () => {
      const mockUsers = [{ id: 1, name: 'User' }];
      const limitSpy = jest.fn().mockReturnThis();

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        limit: limitSpy,
        order: jest.fn().mockResolvedValue({ data: mockUsers, error: null })
      });

      await userRepository.searchUsers('test', 5);

      expect(limitSpy).toHaveBeenCalledWith(5);
    });
  });

  describe('getFallbackUsers', () => {
    test('should return fallback users data', () => {
      const result = userRepository.getFallbackUsers();

      expect(result.users).toHaveLength(3);
      expect(result.users[0].name).toBe('John Doe');
      expect(result.users[1].name).toBe('Jane Smith');
      expect(result.users[2].name).toBe('Bob Johnson');
      expect(result.totalCount).toBe(3);
      expect(result.pagination.totalCount).toBe(3);
    });
  });
});
