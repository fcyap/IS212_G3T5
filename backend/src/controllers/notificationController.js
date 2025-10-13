const notificationService = require('../services/notificationService');
const userRepository = require('../repository/userRepository');

/**
 * Notification Controller - Handles HTTP requests and responses for notifications
 */

/**
 * Get user notifications
 */
const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user?.id || 1;

    // Get user email for notification lookup
    const user = await userRepository.getUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { limit = 50, offset = 0, includeDismissed = 'true' } = req.query;
    const includeDismissedBool = includeDismissed === 'true';
    
    const notifications = await notificationService.getUserNotifications(
      user.email,
      parseInt(limit),
      parseInt(offset),
      includeDismissedBool
    );

    res.json({
      success: true,
      notifications,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (err) {
    console.error('Error in getUserNotifications:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get notifications by creator
 */
const getNotificationsByCreator = async (req, res) => {
  try {
    const creatorId = req.user?.id || 1;
    const { limit = 50, offset = 0 } = req.query;

    const notifications = await notificationService.getNotificationsByCreator(
      creatorId,
      parseInt(limit),
      parseInt(offset)
    );

    res.json({
      success: true,
      notifications,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (err) {
    console.error('Error in getNotificationsByCreator:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Create a test notification (for testing purposes)
 */
const createTestNotification = async (req, res) => {
  try {
    const { recipientEmail, message, notif_types = 'test' } = req.body;
    const creatorId = req.user?.id || 1;

    if (!recipientEmail || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Recipient email and message are required' 
      });
    }

    const notificationData = {
      message,
      creator_id: creatorId,
      recipient_emails: recipientEmail,
      notif_types
    };

    const notification = await notificationService.getNotificationById ? 
      await notificationRepository.create(notificationData) :
      await require('../repository/notificationRepository').create(notificationData);

    res.json({
      success: true,
      notification,
      message: 'Test notification created successfully'
    });
  } catch (err) {
    console.error('Error creating test notification:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Mark a notification as dismissed
 */
const dismissNotification = async (req, res) => {
  try {
    const { notifId } = req.params;

    if (!notifId) {
      return res.status(400).json({
        success: false,
        message: 'Notification ID is required'
      });
    }

    const notification = await notificationService.markAsDismissed(parseInt(notifId));

    res.json({
      success: true,
      notification,
      message: 'Notification dismissed successfully'
    });
  } catch (err) {
    console.error('Error dismissing notification:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getUserNotifications,
  getNotificationsByCreator,
  createTestNotification,
  dismissNotification
};