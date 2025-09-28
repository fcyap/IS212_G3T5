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
  });
});