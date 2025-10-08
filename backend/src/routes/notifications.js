const express = require('express');
const router = express.Router();
const {
  getUserNotifications,
  getNotificationsByCreator,
  createTestNotification
} = require('../controllers/notificationController');

// Get user notifications
router.get('/', getUserNotifications);

// Get notifications created by the current user
router.get('/created', getNotificationsByCreator);

// Create a test notification (for testing purposes)
router.post('/test', createTestNotification);

module.exports = router;