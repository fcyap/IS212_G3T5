const request = require('supertest');
const express = require('express');
const notificationsRouter = require('../../src/routes/notifications');
const notificationController = require('../../src/controllers/notificationController');

jest.mock('../../src/controllers/notificationController');

describe('Notifications Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/notifications', notificationsRouter);
    jest.clearAllMocks();

    // Mock default responses
    notificationController.getUserNotifications.mockImplementation((req, res) => {
      res.json({ success: true, notifications: [] });
    });
    notificationController.getNotificationsByCreator.mockImplementation((req, res) => {
      res.json({ success: true, notifications: [] });
    });
    notificationController.createTestNotification.mockImplementation((req, res) => {
      res.json({ success: true });
    });
    notificationController.dismissNotification.mockImplementation((req, res) => {
      res.json({ success: true });
    });
    notificationController.checkOverdueTasks.mockImplementation((req, res) => {
      res.json({ success: true });
    });
  });

  describe('GET /', () => {
    test('should call getUserNotifications controller', async () => {
      await request(app).get('/notifications');

      expect(notificationController.getUserNotifications).toHaveBeenCalled();
    });
  });

  describe('GET /created', () => {
    test('should call getNotificationsByCreator controller', async () => {
      await request(app).get('/notifications/created');

      expect(notificationController.getNotificationsByCreator).toHaveBeenCalled();
    });
  });

  describe('POST /test', () => {
    test('should call createTestNotification controller', async () => {
      await request(app)
        .post('/notifications/test')
        .send({ recipientEmail: 'test@example.com', message: 'Test' });

      expect(notificationController.createTestNotification).toHaveBeenCalled();
    });
  });

  describe('POST /check-overdue', () => {
    test('should call checkOverdueTasks controller', async () => {
      await request(app).post('/notifications/check-overdue');

      expect(notificationController.checkOverdueTasks).toHaveBeenCalled();
    });
  });

  describe('PATCH /:notifId/dismiss', () => {
    test('should call dismissNotification controller with notifId param', async () => {
      await request(app).patch('/notifications/123/dismiss');

      expect(notificationController.dismissNotification).toHaveBeenCalled();

      // Verify the route parameter was passed
      const req = notificationController.dismissNotification.mock.calls[0][0];
      expect(req.params.notifId).toBe('123');
    });
  });
});
