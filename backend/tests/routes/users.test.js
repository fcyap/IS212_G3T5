const request = require('supertest');
const express = require('express');
const usersRouter = require('../../src/routes/users');
const userController = require('../../src/controllers/userController');

jest.mock('../../src/controllers/userController');

describe('Users Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/users', usersRouter);
    jest.clearAllMocks();

    // Mock default responses
    userController.getAllUsers.mockImplementation((req, res) => {
      res.json({ success: true, users: [] });
    });
    userController.searchUsers.mockImplementation((req, res) => {
      res.json({ success: true, users: [] });
    });
    userController.getUserById.mockImplementation((req, res) => {
      res.json({ success: true, user: {} });
    });
    userController.getUserByEmail.mockImplementation((req, res) => {
      res.json({ success: true, user: {} });
    });
    userController.createUser.mockImplementation((req, res) => {
      res.json({ success: true });
    });
    userController.updateUser.mockImplementation((req, res) => {
      res.json({ success: true });
    });
    userController.deleteUser.mockImplementation((req, res) => {
      res.json({ success: true });
    });
    userController.updateUserPassword.mockImplementation((req, res) => {
      res.json({ success: true });
    });
    userController.getUserProjects.mockImplementation((req, res) => {
      res.json({ success: true, projects: [] });
    });
    userController.getUserTasks.mockImplementation((req, res) => {
      res.json({ success: true, tasks: [] });
    });
  });

  describe('GET /', () => {
    test('should call getAllUsers controller', async () => {
      await request(app).get('/users');

      expect(userController.getAllUsers).toHaveBeenCalled();
    });
  });

  describe('GET /search', () => {
    test('should call searchUsers controller', async () => {
      await request(app).get('/users/search');

      expect(userController.searchUsers).toHaveBeenCalled();
    });
  });

  describe('GET /:userId', () => {
    test('should call getUserById controller with userId param', async () => {
      await request(app).get('/users/123');

      expect(userController.getUserById).toHaveBeenCalled();
      const req = userController.getUserById.mock.calls[0][0];
      expect(req.params.userId).toBe('123');
    });
  });

  describe('GET /email/:email', () => {
    test('should call getUserByEmail controller with email param', async () => {
      await request(app).get('/users/email/test@example.com');

      expect(userController.getUserByEmail).toHaveBeenCalled();
      const req = userController.getUserByEmail.mock.calls[0][0];
      expect(req.params.email).toBe('test@example.com');
    });
  });

  describe('POST /', () => {
    test('should call createUser controller', async () => {
      await request(app)
        .post('/users')
        .send({ email: 'new@example.com', name: 'New User' });

      expect(userController.createUser).toHaveBeenCalled();
    });
  });

  describe('PUT /:userId', () => {
    test('should call updateUser controller with userId param', async () => {
      await request(app)
        .put('/users/123')
        .send({ name: 'Updated Name' });

      expect(userController.updateUser).toHaveBeenCalled();
      const req = userController.updateUser.mock.calls[0][0];
      expect(req.params.userId).toBe('123');
    });
  });

  describe('DELETE /:userId', () => {
    test('should call deleteUser controller with userId param', async () => {
      await request(app).delete('/users/123');

      expect(userController.deleteUser).toHaveBeenCalled();
      const req = userController.deleteUser.mock.calls[0][0];
      expect(req.params.userId).toBe('123');
    });
  });

  describe('PATCH /:userId/password', () => {
    test('should call updateUserPassword controller with userId param', async () => {
      await request(app)
        .patch('/users/123/password')
        .send({ password: 'newpassword' });

      expect(userController.updateUserPassword).toHaveBeenCalled();
      const req = userController.updateUserPassword.mock.calls[0][0];
      expect(req.params.userId).toBe('123');
    });
  });

  describe('GET /:userId/projects', () => {
    test('should call getUserProjects controller with userId param', async () => {
      await request(app).get('/users/123/projects');

      expect(userController.getUserProjects).toHaveBeenCalled();
      const req = userController.getUserProjects.mock.calls[0][0];
      expect(req.params.userId).toBe('123');
    });
  });

  describe('GET /:userId/tasks', () => {
    test('should call getUserTasks controller with userId param', async () => {
      await request(app).get('/users/123/tasks');

      expect(userController.getUserTasks).toHaveBeenCalled();
      const req = userController.getUserTasks.mock.calls[0][0];
      expect(req.params.userId).toBe('123');
    });
  });
});
