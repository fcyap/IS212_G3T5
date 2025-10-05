const express = require('express');
const router = express.Router();
const {
  getUserNotifications,
  getNotificationsByCreator
} = require('../controllers/notificationController');

// Get user notifications
router.get('/', getUserNotifications);

// Get notifications created by the current user
router.get('/created', getNotificationsByCreator);

module.exports = router;