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

    const { limit = 50, offset = 0 } = req.query;
    const notifications = await notificationService.getUserNotifications(
      user.email,
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

module.exports = {
  getUserNotifications,
  getNotificationsByCreator
};