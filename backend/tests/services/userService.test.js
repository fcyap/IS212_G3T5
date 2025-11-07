const userService = require('../../src/services/userService');
const userRepository = require('../../src/repository/userRepository');

jest.mock('../../src/repository/userRepository');

describe('UserService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllUsers', () => {
    test('should get all users with filters', async () => {
      const filters = {
        role: 'admin',
        searchTerm: 'john',
        page: 1,
        limit: 10
      };

      const mockResult = {
        users: [
          { id: 1, name: 'John Doe', email: 'john@example.com', role: 'admin' }
        ],
        totalCount: 1,
        pagination: {
          page: 1,
          limit: 10,
          totalPages: 1
        }
      };

      userRepository.getAllUsers.mockResolvedValue(mockResult);

      const result = await userService.getAllUsers(filters);

      expect(userRepository.getAllUsers).toHaveBeenCalledWith(filters);
      expect(result).toEqual(mockResult);
    });

    test('should handle empty filters for compatibility', async () => {
      const mockUsers = [
        { id: 1, name: 'User 1', email: 'user1@example.com' },
        { id: 2, name: 'User 2', email: 'user2@example.com' }
      ];

      userRepository.getAllUsers.mockResolvedValue(mockUsers);

      const result = await userService.getAllUsers();

      expect(userRepository.getAllUsers).toHaveBeenCalledWith();
      expect(result).toEqual(mockUsers);
    });

    test('should handle object result for compatibility', async () => {
      const mockResult = {
        users: [
          { id: 1, name: 'User 1', email: 'user1@example.com' }
        ],
        totalCount: 1
      };

      userRepository.getAllUsers.mockResolvedValue(mockResult);

      const result = await userService.getAllUsers({});

      expect(result).toEqual([
        { id: 1, name: 'User 1', email: 'user1@example.com' }
      ]);
    });

    test('should handle repository error', async () => {
      const error = new Error('Database connection failed');
      userRepository.getAllUsers.mockRejectedValue(error);

      await expect(userService.getAllUsers()).rejects.toThrow('Database connection failed');
    });
  });

  describe('getUserById', () => {
    test('should get user by id successfully', async () => {
      const mockUser = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'admin'
      };

      userRepository.getUserById.mockResolvedValue(mockUser);

      const result = await userService.getUserById(1);

      expect(userRepository.getUserById).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockUser);
    });

    test('should fallback to findById method', async () => {
      const mockUser = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com'
      };

      userRepository.getUserById.mockRejectedValue(new Error('Method not found'));
      userRepository.findById.mockResolvedValue(mockUser);

      const result = await userService.getUserById(1);

      expect(userRepository.getUserById).toHaveBeenCalledWith(1);
      expect(userRepository.findById).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockUser);
    });

    test('should throw original error if both methods fail', async () => {
      const originalError = new Error('User not found');
      const fallbackError = new Error('Fallback failed');

      userRepository.getUserById.mockRejectedValue(originalError);
      userRepository.findById.mockRejectedValue(fallbackError);

      await expect(userService.getUserById(999)).rejects.toThrow('User not found');
    });
  });

  describe('getUserByEmail', () => {
    test('should get user by email successfully', async () => {
      const mockUser = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'admin'
      };

      userRepository.getUserByEmail.mockResolvedValue(mockUser);

      const result = await userService.getUserByEmail('john@example.com');

      expect(userRepository.getUserByEmail).toHaveBeenCalledWith('john@example.com');
      expect(result).toEqual(mockUser);
    });

    test('should handle user not found by email', async () => {
      userRepository.getUserByEmail.mockRejectedValue(new Error('User not found'));

      await expect(userService.getUserByEmail('notfound@example.com'))
        .rejects.toThrow('User not found');
    });

    test('should handle repository error', async () => {
      userRepository.getUserByEmail.mockRejectedValue(new Error('Database error'));

      await expect(userService.getUserByEmail('john@example.com'))
        .rejects.toThrow('Database error');
    });
  });

  describe('createUser', () => {
    test('should create user successfully', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        role: 'admin'
      };

      const mockCreatedUser = {
        id: 1,
        ...userData,
        password: 'hashed_password',
        created_at: new Date().toISOString()
      };

      userRepository.emailExists.mockResolvedValue(false);
      userRepository.createUser.mockResolvedValue(mockCreatedUser);

      const result = await userService.createUser(userData);

      // The service adds timestamps, so check that the call includes them
      expect(userRepository.createUser).toHaveBeenCalledWith({
        ...userData,
        created_at: expect.any(Date),
        updated_at: expect.any(Date)
      });
      expect(result).toEqual(mockCreatedUser);
    });

    test('should handle duplicate email error', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123'
      };

      userRepository.emailExists.mockResolvedValue(true);

      await expect(userService.createUser(userData))
        .rejects.toThrow('User with this email already exists');
    });

    test('should handle validation error', async () => {
      const userData = {
        name: '',
        email: 'invalid-email',
        password: '123'
      };

      await expect(userService.createUser(userData))
        .rejects.toThrow('Email, name, and password are required');
    });

    test('should handle invalid email format', async () => {
      const userData = {
        name: 'John Doe',
        email: 'invalid-email-format',
        password: 'password123'
      };

      userRepository.emailExists.mockResolvedValue(false);

      await expect(userService.createUser(userData))
        .rejects.toThrow('Invalid email format');
    });
  });

  describe('updateUser', () => {
    test('should update user successfully', async () => {
      const userId = 1;
      const updateData = {
        name: 'John Updated',
        email: 'john.updated@example.com'
      };
      const requestingUserId = 1;

      const mockCurrentUser = {
        id: userId,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'admin'
      };

      const mockRequestingUser = {
        id: requestingUserId,
        name: 'John Doe',
        role: 'admin'
      };

      const mockUpdatedUser = {
        id: userId,
        ...updateData,
        role: 'admin',
        updated_at: new Date().toISOString()
      };

      userRepository.getUserById.mockResolvedValueOnce(mockCurrentUser);
      userRepository.getUserById.mockResolvedValueOnce(mockRequestingUser);
      userRepository.emailExists.mockResolvedValue(false);
      userRepository.updateUser.mockResolvedValue(mockUpdatedUser);

      const result = await userService.updateUser(userId, updateData, requestingUserId);

      expect(userRepository.updateUser).toHaveBeenCalledWith(userId, {
        ...updateData,
        updated_at: expect.any(Date)
      });
      expect(result).toEqual(mockUpdatedUser);
    });

    test('should handle user not found during update', async () => {
      const userId = 999;
      const updateData = { name: 'Updated Name' };
      const requestingUserId = 1;

      userRepository.updateUser.mockRejectedValue(new Error('User not found'));

      await expect(userService.updateUser(userId, updateData, requestingUserId))
        .rejects.toThrow('User not found');
    });

    test('should handle permission error', async () => {
      const userId = 2;
      const updateData = { role: 'admin' };
      const requestingUserId = 3;

      const mockCurrentUser = {
        id: userId,
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'staff'
      };

      const mockRequestingUser = {
        id: requestingUserId,
        name: 'Bob Smith',
        role: 'staff'
      };

      userRepository.getUserById.mockResolvedValueOnce(mockCurrentUser);
      userRepository.getUserById.mockResolvedValueOnce(mockRequestingUser);

      await expect(userService.updateUser(userId, updateData, requestingUserId))
        .rejects.toThrow('You do not have permission to update this user');
    });

    test('should handle duplicate email when updating', async () => {
      const userId = 1;
      const updateData = { email: 'existing@example.com' };
      const requestingUserId = 1;

      const mockCurrentUser = {
        id: userId,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'admin'
      };

      const mockRequestingUser = {
        id: requestingUserId,
        name: 'John Doe',
        role: 'admin'
      };

      userRepository.getUserById.mockResolvedValueOnce(mockCurrentUser);
      userRepository.getUserById.mockResolvedValueOnce(mockRequestingUser);
      userRepository.emailExists.mockResolvedValue(true);

      await expect(userService.updateUser(userId, updateData, requestingUserId))
        .rejects.toThrow('User with this email already exists');
    });

    test('should handle invalid email format when updating', async () => {
      const userId = 1;
      const updateData = { email: 'invalid-email-format' };
      const requestingUserId = 1;

      const mockCurrentUser = {
        id: userId,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'admin'
      };

      const mockRequestingUser = {
        id: requestingUserId,
        name: 'John Doe',
        role: 'admin'
      };

      userRepository.getUserById.mockResolvedValueOnce(mockCurrentUser);
      userRepository.getUserById.mockResolvedValueOnce(mockRequestingUser);
      userRepository.emailExists.mockResolvedValue(false);

      await expect(userService.updateUser(userId, updateData, requestingUserId))
        .rejects.toThrow('Invalid email format');
    });

    test('should prevent non-manager from updating role', async () => {
      const userId = 1;
      const updateData = { role: 'manager' };
      const requestingUserId = 1;

      const mockCurrentUser = {
        id: userId,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'staff'
      };

      const mockRequestingUser = {
        id: requestingUserId,
        name: 'John Doe',
        role: 'staff'
      };

      userRepository.getUserById.mockResolvedValueOnce(mockCurrentUser);
      userRepository.getUserById.mockResolvedValueOnce(mockRequestingUser);

      await expect(userService.updateUser(userId, updateData, requestingUserId))
        .rejects.toThrow('Only managers can update user roles');
    });
  });

  describe('deleteUser', () => {
    test('should delete user successfully', async () => {
      const userId = 2;
      const requestingUserId = 1;

      const mockRequestingUser = {
        id: requestingUserId,
        name: 'Manager',
        role: 'manager'
      };

      const mockResult = {
        success: true,
        message: 'User deleted successfully'
      };

      userRepository.getUserById.mockResolvedValue(mockRequestingUser);
      userRepository.deleteUser.mockResolvedValue(mockResult);

      const result = await userService.deleteUser(userId, requestingUserId);

      expect(userRepository.deleteUser).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockResult);
    });

    test('should handle user not found during deletion', async () => {
      const userId = 999;
      const requestingUserId = 1;

      userRepository.deleteUser.mockRejectedValue(new Error('User not found'));

      await expect(userService.deleteUser(userId, requestingUserId))
        .rejects.toThrow('User not found');
    });

    test('should handle permission error for deletion', async () => {
      const userId = 2;
      const requestingUserId = 3;

      const mockRequestingUser = {
        id: requestingUserId,
        name: 'Regular User',
        role: 'staff'
      };

      userRepository.getUserById.mockResolvedValue(mockRequestingUser);

      await expect(userService.deleteUser(userId, requestingUserId))
        .rejects.toThrow('Only managers can delete users');
    });

    test('should prevent user from deleting themselves', async () => {
      const userId = 1;
      const requestingUserId = 1;

      const mockRequestingUser = {
        id: requestingUserId,
        name: 'Manager',
        role: 'manager'
      };

      userRepository.getUserById.mockResolvedValue(mockRequestingUser);

      await expect(userService.deleteUser(userId, requestingUserId))
        .rejects.toThrow('You cannot delete your own account');
    });
  });

  describe('getUsersByIds', () => {
    test('should get multiple users by IDs', async () => {
      const userIds = [1, 2, 3];
      const mockUsers = [
        { id: 1, name: 'User 1', email: 'user1@example.com' },
        { id: 2, name: 'User 2', email: 'user2@example.com' },
        { id: 3, name: 'User 3', email: 'user3@example.com' }
      ];

      userRepository.getUsersByIds.mockResolvedValue(mockUsers);

      const result = await userService.getUsersByIds(userIds);

      expect(userRepository.getUsersByIds).toHaveBeenCalledWith(userIds);
      expect(result).toEqual(mockUsers);
    });

    test('should return empty array for empty input', async () => {
      const result = await userService.getUsersByIds([]);

      expect(result).toEqual([]);
      expect(userRepository.getUsersByIds).not.toHaveBeenCalled();
    });

    test('should return empty array for null input', async () => {
      const result = await userService.getUsersByIds(null);

      expect(result).toEqual([]);
      expect(userRepository.getUsersByIds).not.toHaveBeenCalled();
    });
  });

  describe('validateCredentials', () => {
    test('should validate credentials successfully', async () => {
      const email = 'john@example.com';
      const password = 'password123';
      const mockUser = {
        id: 1,
        name: 'John Doe',
        email: email,
        password: password,
        role: 'admin'
      };

      userRepository.getUserByEmail.mockResolvedValue(mockUser);

      const result = await userService.validateCredentials(email, password);

      expect(result).toEqual({
        id: 1,
        name: 'John Doe',
        email: email,
        role: 'admin'
      });
      expect(result.password).toBeUndefined();
    });

    test('should reject invalid password', async () => {
      const email = 'john@example.com';
      const password = 'wrongpassword';
      const mockUser = {
        id: 1,
        name: 'John Doe',
        email: email,
        password: 'correctpassword',
        role: 'admin'
      };

      userRepository.getUserByEmail.mockResolvedValue(mockUser);

      await expect(userService.validateCredentials(email, password))
        .rejects.toThrow('Invalid credentials');
    });

    test('should reject non-existent user', async () => {
      const email = 'nonexistent@example.com';
      const password = 'password123';

      userRepository.getUserByEmail.mockRejectedValue(new Error('User not found'));

      await expect(userService.validateCredentials(email, password))
        .rejects.toThrow('Invalid credentials');
    });
  });


  describe('searchUsers', () => {
    test('should search users successfully', async () => {
      const searchTerm = 'john';
      const mockUsers = [
        { id: 1, name: 'John Doe', email: 'john@example.com' },
        { id: 2, name: 'Johnny Smith', email: 'johnny@example.com' }
      ];

      userRepository.searchUsers.mockResolvedValue(mockUsers);

      const result = await userService.searchUsers(searchTerm);

      expect(userRepository.searchUsers).toHaveBeenCalledWith(searchTerm, 8);
      expect(result).toEqual(mockUsers);
    });

    test('should handle empty search results', async () => {
      const searchTerm = 'nonexistent';
      userRepository.searchUsers.mockResolvedValue([]);

      const result = await userService.searchUsers(searchTerm);

      expect(result).toEqual([]);
    });

    test('should handle search error', async () => {
      const searchTerm = 'john';
      userRepository.searchUsers.mockRejectedValue(new Error('Search failed'));

      await expect(userService.searchUsers(searchTerm))
        .rejects.toThrow('Search failed');
    });
  });
});