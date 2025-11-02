const express = require('express');
const router = express.Router();
const {
  getUserNotifications,
  getNotificationsByCreator,
  createTestNotification,
  dismissNotification,
  checkOverdueTasks
} = require('../controllers/notificationController');

// Get user notifications
router.get('/', getUserNotifications);

// Get notifications created by the current user
router.get('/created', getNotificationsByCreator);

// Create a test notification (for testing purposes)
router.post('/test', createTestNotification);

// Check for overdue tasks and send notifications
router.post('/check-overdue', checkOverdueTasks);

// Dismiss a notification
router.patch('/:notifId/dismiss', dismissNotification);

module.exports = router;