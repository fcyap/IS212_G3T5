const {
  getAllUsers,
  createUser,
  getUserById,
  getUserByEmail,
  updateUser,
  deleteUser,
  updateUserPassword,
  getUserProjects,
  getUserTasks,
  searchUsers
} = require('../../src/controllers/userController');
const userService = require('../../src/services/userService');

jest.mock('../../src/services/userService');

describe('UserController', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
      user: { id: 1 }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();

    // Ensure all methods are mocked
    userService.getAllUsers = jest.fn();
    userService.getUserById = jest.fn();
    userService.getUserByEmail = jest.fn();
    userService.createUser = jest.fn();
    userService.updateUser = jest.fn();
    userService.deleteUser = jest.fn();
    userService.updateUserPassword = jest.fn();
    userService.getUserProjects = jest.fn();
    userService.getUserTasks = jest.fn();
    userService.searchUsers = jest.fn();
  });

  describe('getAllUsers', () => {
    test('should get all users successfully', async () => {
      req.query = {
        page: '1',
        limit: '10',
        sortBy: 'name',
        sortOrder: 'asc'
      };

      const mockUsers = [
        { id: 1, name: 'User 1', email: 'user1@test.com' },
        { id: 2, name: 'User 2', email: 'user2@test.com' }
      ];
      userService.getAllUsers.mockResolvedValue(mockUsers);

      await getAllUsers(req, res);

      expect(userService.getAllUsers).toHaveBeenCalledWith({
        role: undefined,
        email: undefined,
        searchTerm: undefined,
        isActive: undefined,
        sortBy: 'name',
        sortOrder: 'asc',
        page: 1,
        limit: 10,
        offset: 0
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        users: mockUsers,
        totalUsers: 2,
        pagination: {
          page: 1,
          limit: 10,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
          totalCount: 2
        },
        filters: {
          role: null,
          email: null,
          searchTerm: null,
          isActive: null,
          sortBy: 'name',
          sortOrder: 'asc'
        }
      });
    });

    test('should handle invalid page parameter', async () => {
      req.query = { page: '0' };

      await getAllUsers(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Page must be a positive integer'
      });
    });

    test('should handle invalid limit parameter', async () => {
      req.query = { limit: '101' };

      await getAllUsers(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Limit must be between 1 and 100'
      });
    });

    test('should handle service error', async () => {
      userService.getAllUsers.mockRejectedValue(new Error('Database error'));

      await getAllUsers(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Database error'
      });
    });
  });

  describe('getUserById', () => {
    test('should get user by id successfully', async () => {
      req.params.userId = '1';
      const mockUser = { id: 1, name: 'Test User', email: 'test@example.com' };

      userService.getUserById.mockResolvedValue(mockUser);

      await getUserById(req, res);

      expect(userService.getUserById).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        user: mockUser
      });
    });

    test('should handle invalid user id', async () => {
      req.params.userId = 'invalid';

      await getUserById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Valid user ID is required'
      });
    });

    test('should handle user not found', async () => {
      req.params.userId = '999';
      userService.getUserById.mockRejectedValue(new Error('User not found'));

      await getUserById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found'
      });
    });

    test('should handle service error', async () => {
      req.params.userId = '1';
      userService.getUserById.mockRejectedValue(new Error('Database error'));

      await getUserById(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Database error'
      });
    });
  });

  describe('getUserByEmail', () => {
    test('should get user by email successfully', async () => {
      req.params.email = 'test@example.com';
      const mockUser = { id: 1, name: 'Test User', email: 'test@example.com' };

      userService.getUserByEmail.mockResolvedValue(mockUser);

      await getUserByEmail(req, res);

      expect(userService.getUserByEmail).toHaveBeenCalledWith('test@example.com');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        user: mockUser
      });
    });

    test('should handle missing email', async () => {
      req.params.email = '';

      await getUserByEmail(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email is required'
      });
    });

    test('should handle invalid email format', async () => {
      req.params.email = 'invalid-email';

      await getUserByEmail(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid email format'
      });
    });

    test('should handle user not found', async () => {
      req.params.email = 'notfound@example.com';
      userService.getUserByEmail.mockRejectedValue(new Error('User not found'));

      await getUserByEmail(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found'
      });
    });
  });

  describe('createUser', () => {
    test('should create user successfully', async () => {
      req.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        role: 'team_member'
      };

      const mockUser = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashedpassword',
        role: 'team_member'
      };
      userService.createUser.mockResolvedValue(mockUser);

      await createUser(req, res);

      expect(userService.createUser).toHaveBeenCalledWith({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        role: 'team_member'
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        user: {
          id: 1,
          name: 'Test User',
          email: 'test@example.com',
          role: 'team_member'
        }
      });
    });

    test('should handle missing name', async () => {
      req.body = {
        email: 'test@example.com',
        password: 'password123'
      };

      await createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Name is required'
      });
    });

    test('should handle missing email', async () => {
      req.body = {
        name: 'Test User',
        password: 'password123'
      };

      await createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email is required'
      });
    });

    test('should handle invalid email format', async () => {
      req.body = {
        name: 'Test User',
        email: 'invalid-email',
        password: 'password123'
      };

      await createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid email format'
      });
    });

    test('should handle password too short', async () => {
      req.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: '123'
      };

      await createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    });

    test('should handle invalid role', async () => {
      req.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        role: 'invalid_role'
      };

      await createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Role must be one of: admin, project_manager, team_member'
      });
    });

    test('should handle email already exists', async () => {
      req.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      };

      userService.createUser.mockRejectedValue(new Error('Email already exists'));

      await createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email already exists'
      });
    });

    test('should default role to team_member', async () => {
      req.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      };

      const mockUser = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashedpassword',
        role: 'team_member'
      };
      userService.createUser.mockResolvedValue(mockUser);

      await createUser(req, res);

      expect(userService.createUser).toHaveBeenCalledWith({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        role: 'team_member'
      });
    });
  });

  describe('updateUser', () => {
    test('should update user successfully', async () => {
      req.params.userId = '1';
      req.body = {
        name: 'Updated User',
        email: 'updated@example.com'
      };

      const mockUpdatedUser = {
        id: 1,
        name: 'Updated User',
        email: 'updated@example.com'
      };
      userService.updateUser.mockResolvedValue(mockUpdatedUser);

      await updateUser(req, res);

      expect(userService.updateUser).toHaveBeenCalledWith(1, {
        name: 'Updated User',
        email: 'updated@example.com'
      }, 1);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        user: mockUpdatedUser
      });
    });

    test('should handle invalid user id', async () => {
      req.params.userId = 'invalid';

      await updateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Valid user ID is required'
      });
    });

    test('should handle empty name', async () => {
      req.params.userId = '1';
      req.body = { name: '' };

      await updateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Name cannot be empty'
      });
    });

    test('should handle invalid email format', async () => {
      req.params.userId = '1';
      req.body = { email: 'invalid-email' };

      await updateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid email format'
      });
    });

    test('should handle empty email', async () => {
      req.params.userId = '1';
      req.body = { email: '' };

      await updateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email cannot be empty'
      });
    });

    test('should handle invalid role', async () => {
      req.params.userId = '1';
      req.body = { role: 'invalid_role' };

      await updateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Role must be one of: admin, project_manager, team_member'
      });
    });

    test('should handle invalid isActive type', async () => {
      req.params.userId = '1';
      req.body = { isActive: 'not-a-boolean' };

      await updateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'isActive must be a boolean value'
      });
    });

    test('should handle no fields to update', async () => {
      req.params.userId = '1';
      req.body = {};

      await updateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'At least one field to update is required'
      });
    });

    test('should handle permission error', async () => {
      req.params.userId = '1';
      req.body = { name: 'Updated User' };
      userService.updateUser.mockRejectedValue(new Error('permission denied'));

      await updateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'permission denied'
      });
    });

    test('should handle email already exists', async () => {
      req.params.userId = '1';
      req.body = { email: 'existing@example.com' };
      userService.updateUser.mockRejectedValue(new Error('Email already exists'));

      await updateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email already exists'
      });
    });

    test('should handle service error', async () => {
      req.params.userId = '1';
      req.body = { name: 'Updated User' };
      userService.updateUser.mockRejectedValue(new Error('Database error'));

      await updateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Database error'
      });
    });
  });

  describe('deleteUser', () => {
    test('should delete user successfully', async () => {
      req.params.userId = '1';
      userService.deleteUser.mockResolvedValue();

      await deleteUser(req, res);

      expect(userService.deleteUser).toHaveBeenCalledWith(1, 1);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'User deleted successfully'
      });
    });

    test('should handle invalid user id', async () => {
      req.params.userId = 'invalid';

      await deleteUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Valid user ID is required'
      });
    });

    test('should use default requesting user id when not provided', async () => {
      req.params.userId = '2';
      req.user = null;
      userService.deleteUser.mockResolvedValue();

      await deleteUser(req, res);

      // Should use default user ID of 1
      expect(userService.deleteUser).toHaveBeenCalledWith(2, 1);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'User deleted successfully'
      });
    });

    test('should handle permission error', async () => {
      req.params.userId = '1';
      userService.deleteUser.mockRejectedValue(new Error('permission denied'));

      await deleteUser(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'permission denied'
      });
    });

    test('should handle service error', async () => {
      req.params.userId = '1';
      userService.deleteUser.mockRejectedValue(new Error('Database error'));

      await deleteUser(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Database error'
      });
    });
  });

  describe('updateUserPassword', () => {
    test('should update password successfully', async () => {
      req.params.userId = '1';
      req.body = {
        currentPassword: 'oldpass123',
        newPassword: 'newpass123'
      };
      userService.updateUserPassword.mockResolvedValue();

      await updateUserPassword(req, res);

      expect(userService.updateUserPassword).toHaveBeenCalledWith(1, 'oldpass123', 'newpass123', 1);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password updated successfully'
      });
    });

    test('should handle invalid user id', async () => {
      req.params.userId = 'invalid';

      await updateUserPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Valid user ID is required'
      });
    });

    test('should handle missing currentPassword', async () => {
      req.params.userId = '1';
      req.body = { newPassword: 'newpass123' };

      await updateUserPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Current password and new password are required'
      });
    });

    test('should handle missing newPassword', async () => {
      req.params.userId = '1';
      req.body = { currentPassword: 'oldpass123' };

      await updateUserPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Current password and new password are required'
      });
    });

    test('should handle new password too short', async () => {
      req.params.userId = '1';
      req.body = {
        currentPassword: 'oldpass123',
        newPassword: '123'
      };

      await updateUserPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    });

    test('should handle permission error', async () => {
      req.params.userId = '1';
      req.body = {
        currentPassword: 'oldpass123',
        newPassword: 'newpass123'
      };
      userService.updateUserPassword.mockRejectedValue(new Error('permission denied'));

      await updateUserPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'permission denied'
      });
    });

    test('should handle incorrect current password', async () => {
      req.params.userId = '1';
      req.body = {
        currentPassword: 'wrongpass',
        newPassword: 'newpass123'
      };
      userService.updateUserPassword.mockRejectedValue(new Error('Incorrect current password'));

      await updateUserPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Incorrect current password'
      });
    });

    test('should handle service error', async () => {
      req.params.userId = '1';
      req.body = {
        currentPassword: 'oldpass123',
        newPassword: 'newpass123'
      };
      userService.updateUserPassword.mockRejectedValue(new Error('Database error'));

      await updateUserPassword(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Database error'
      });
    });
  });

  describe('getUserProjects', () => {
    test('should get user projects successfully', async () => {
      req.params.userId = '1';
      req.query = { includeCompleted: 'false' };
      const mockProjects = [
        { id: 1, name: 'Project 1' },
        { id: 2, name: 'Project 2' }
      ];
      userService.getUserProjects.mockResolvedValue(mockProjects);

      await getUserProjects(req, res);

      expect(userService.getUserProjects).toHaveBeenCalledWith(1, { includeCompleted: false });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        userId: 1,
        projects: mockProjects,
        includeCompleted: false
      });
    });

    test('should handle includeCompleted true', async () => {
      req.params.userId = '1';
      req.query = { includeCompleted: 'true' };
      const mockProjects = [{ id: 1, name: 'Project 1' }];
      userService.getUserProjects.mockResolvedValue(mockProjects);

      await getUserProjects(req, res);

      expect(userService.getUserProjects).toHaveBeenCalledWith(1, { includeCompleted: true });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        userId: 1,
        projects: mockProjects,
        includeCompleted: true
      });
    });

    test('should handle invalid user id', async () => {
      req.params.userId = 'invalid';

      await getUserProjects(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Valid user ID is required'
      });
    });

    test('should handle user not found', async () => {
      req.params.userId = '999';
      userService.getUserProjects.mockRejectedValue(new Error('User not found'));

      await getUserProjects(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found'
      });
    });

    test('should handle service error', async () => {
      req.params.userId = '1';
      userService.getUserProjects.mockRejectedValue(new Error('Database error'));

      await getUserProjects(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Database error'
      });
    });
  });

  describe('getUserTasks', () => {
    test('should get user tasks successfully', async () => {
      req.params.userId = '1';
      req.query = {
        status: 'in_progress',
        priority: 'high',
        includeCompleted: 'false'
      };
      const mockTasks = [
        { id: 1, name: 'Task 1' },
        { id: 2, name: 'Task 2' }
      ];
      userService.getUserTasks.mockResolvedValue(mockTasks);

      await getUserTasks(req, res);

      expect(userService.getUserTasks).toHaveBeenCalledWith(1, {
        status: 'in_progress',
        priority: 'high',
        includeCompleted: false
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        userId: 1,
        tasks: mockTasks,
        filters: {
          status: 'in_progress',
          priority: 'high',
          includeCompleted: false
        }
      });
    });

    test('should handle no filters', async () => {
      req.params.userId = '1';
      req.query = {};
      const mockTasks = [];
      userService.getUserTasks.mockResolvedValue(mockTasks);

      await getUserTasks(req, res);

      expect(userService.getUserTasks).toHaveBeenCalledWith(1, {
        status: undefined,
        priority: undefined,
        includeCompleted: false
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        userId: 1,
        tasks: mockTasks,
        filters: {
          status: null,
          priority: null,
          includeCompleted: false
        }
      });
    });

    test('should handle invalid user id', async () => {
      req.params.userId = 'invalid';

      await getUserTasks(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Valid user ID is required'
      });
    });

    test('should handle user not found', async () => {
      req.params.userId = '999';
      userService.getUserTasks.mockRejectedValue(new Error('User not found'));

      await getUserTasks(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found'
      });
    });

    test('should handle service error', async () => {
      req.params.userId = '1';
      userService.getUserTasks.mockRejectedValue(new Error('Database error'));

      await getUserTasks(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Database error'
      });
    });
  });

  describe('searchUsers', () => {
    test('should search users successfully', async () => {
      req.query = { q: 'john', limit: '10' };
      const mockUsers = [
        { id: 1, name: 'John Doe', email: 'john@example.com' },
        { id: 2, name: 'John Smith', email: 'jsmith@example.com' }
      ];
      userService.searchUsers.mockResolvedValue(mockUsers);

      await searchUsers(req, res);

      expect(userService.searchUsers).toHaveBeenCalledWith('john', 10);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        users: mockUsers
      });
    });

    test('should use default limit', async () => {
      req.query = { q: 'john' };
      const mockUsers = [{ id: 1, name: 'John Doe', email: 'john@example.com' }];
      userService.searchUsers.mockResolvedValue(mockUsers);

      await searchUsers(req, res);

      expect(userService.searchUsers).toHaveBeenCalledWith('john', 8);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        users: mockUsers
      });
    });

    test('should handle missing query parameter', async () => {
      req.query = {};

      await searchUsers(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Query parameter q is required'
      });
    });

    test('should handle empty query parameter', async () => {
      req.query = { q: '   ' };

      await searchUsers(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Query parameter q is required'
      });
    });

    test('should handle non-string query parameter', async () => {
      req.query = { q: 123 };

      await searchUsers(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Query parameter q is required'
      });
    });

    test('should handle service error', async () => {
      req.query = { q: 'john' };
      userService.searchUsers.mockRejectedValue(new Error('Database error'));

      await searchUsers(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Database error'
      });
    });
  });

  describe('getAllUsers - Additional Coverage', () => {
    test('should handle limit less than 1', async () => {
      req.query = { limit: '0' };

      await getAllUsers(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Limit must be between 1 and 100'
      });
    });

    test('should handle new format response from service', async () => {
      req.query = {};
      const mockResponse = {
        users: [{ id: 1, name: 'User 1' }],
        totalCount: 1,
        pagination: {
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
          totalCount: 1
        }
      };
      userService.getAllUsers.mockResolvedValue(mockResponse);

      await getAllUsers(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        users: mockResponse.users,
        totalUsers: mockResponse.totalCount,
        pagination: mockResponse.pagination,
        filters: {
          role: null,
          email: null,
          searchTerm: null,
          isActive: null,
          sortBy: 'created_at',
          sortOrder: 'desc'
        }
      });
    });

    test('should handle all query filters', async () => {
      req.query = {
        role: 'admin',
        email: 'test@example.com',
        search: '  john  ',
        isActive: 'true',
        sortBy: 'name',
        sortOrder: 'asc',
        page: '2',
        limit: '15'
      };

      const mockUsers = [{ id: 1, name: 'John' }];
      userService.getAllUsers.mockResolvedValue(mockUsers);

      await getAllUsers(req, res);

      expect(userService.getAllUsers).toHaveBeenCalledWith({
        role: 'admin',
        email: 'test@example.com',
        searchTerm: 'john',
        isActive: true,
        sortBy: 'name',
        sortOrder: 'asc',
        page: 2,
        limit: 15,
        offset: 15
      });
    });

    test('should handle isActive false', async () => {
      req.query = { isActive: 'false' };
      const mockUsers = [];
      userService.getAllUsers.mockResolvedValue(mockUsers);

      await getAllUsers(req, res);

      expect(userService.getAllUsers).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false
        })
      );
    });
  });

  describe('getUserById - Additional Coverage', () => {
    test('should handle missing userId', async () => {
      req.params.userId = undefined;

      await getUserById(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Valid user ID is required'
      });
    });
  });

  describe('createUser - Additional Coverage', () => {
    test('should handle missing password', async () => {
      req.body = {
        name: 'Test User',
        email: 'test@example.com'
      };

      await createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    });

    test('should handle empty name with whitespace', async () => {
      req.body = {
        name: '   ',
        email: 'test@example.com',
        password: 'password123'
      };

      await createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Name is required'
      });
    });

    test('should handle empty email with whitespace', async () => {
      req.body = {
        name: 'Test User',
        email: '   ',
        password: 'password123'
      };

      await createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email is required'
      });
    });

    test('should handle service error with unique constraint', async () => {
      req.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      };
      userService.createUser.mockRejectedValue(new Error('unique constraint violation'));

      await createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email already exists'
      });
    });

    test('should handle general service error', async () => {
      req.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      };
      userService.createUser.mockRejectedValue(new Error('Database connection failed'));

      await createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Database connection failed'
      });
    });
  });

  describe('getUserByEmail - Additional Coverage', () => {
    test('should handle undefined email', async () => {
      req.params.email = undefined;

      await getUserByEmail(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Email is required'
      });
    });

    test('should handle service error (non-404)', async () => {
      req.params.email = 'test@example.com';
      userService.getUserByEmail.mockRejectedValue(new Error('Database error'));

      await getUserByEmail(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Database error'
      });
    });
  });
});