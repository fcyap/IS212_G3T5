const supabase = require('../utils/supabase');

/**
 * Notification Repository - Handles database operations for notifications
 */
class NotificationRepository {
  /**
   * Create a new notification
   */
  async create(notificationData) {
    const { data, error } = await supabase
      .from('notifications')
      .insert(notificationData)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }
}

module.exports = new NotificationRepository();