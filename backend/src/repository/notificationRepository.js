const supabase = require('../utils/supabase');

/**
 * Notification Repository - Handles all database operations for notifications
 * This layer only deals with CRUD operations and database queries
 * Implements 90-day retention policy as per AC2
 * 
 * Database Schema:
 * - notif_id: Primary key
 * - message: Notification message text
 * - creator_id: ID of user who created the notification
 * - recipient_emails: Text field containing recipient email addresses (comma-separated for multiple)
 * - notif_types: Type of notification (e.g., 'invitation', 'comment', 'update')
 * - created_at: Timestamp of creation
 */
class NotificationRepository {


    /**
     * Create a new notification
     * @param {Object} notificationData - Notification details
     * @param {String} notificationData.message - Notification message
     * @param {Number} notificationData.creator_id - Creator user ID
     * @param {String|Array<String>} notificationData.recipient_emails - Recipient email(s) - string or array
     * @param {String} notificationData.notif_types - Type of notification
     * @returns {Object} Created notification
     */
    async create(notificationData) {
        // Handle recipient_emails as text - convert array to comma-separated string if needed
        let recipientEmails = notificationData.recipient_emails;
        if (Array.isArray(recipientEmails)) {
            recipientEmails = recipientEmails.join(',');
        }

        const { data, error } = await supabase
            .from('notifications')
            .insert([{
                message: notificationData.message,
                creator_id: notificationData.creator_id || null,
                recipient_emails: recipientEmails || '',
                notif_types: notificationData.notif_types || 'general',
                dismissed: false
            }])
            .select('*')
            .single();

        if (error) {
            throw new Error(`Database error: ${error.message}`);
        }

        return data;
    }

    /**
     * Get all notifications (by creator or recipient)
     * @param {String} userEmail - User's email address
     * @param {Object} filters - Optional filters (limit, offset)
     * @returns {Array} List of notifications
     */
    async getByUserEmail(userEmail, filters = {}) {
        let query = supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false });

        // Filter notifications where user is recipient (check if email is in comma-separated list)
        query = query.ilike('recipient_emails', `%${userEmail}%`);

        if (filters.limit) {
            query = query.limit(filters.limit);
        }

        if (filters.offset) {
            query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
        }

        const { data, error } = await query;

        if (error) {
            throw new Error(`Database error: ${error.message}`);
        }

        return data || [];
    }

    /**
     * Get all notifications created by a user
     * @param {Number} creatorId - Creator's user ID
     * @param {Object} filters - Optional filters (limit, offset)
     * @returns {Array} List of notifications
     */
    async getByCreatorId(creatorId, filters = {}) {
        let query = supabase
            .from('notifications')
            .select('*')
            .eq('creator_id', creatorId)
            .order('created_at', { ascending: false });

        if (filters.limit) {
            query = query.limit(filters.limit);
        }

        if (filters.offset) {
            query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
        }

        const { data, error } = await query;

        if (error) {
            throw new Error(`Database error: ${error.message}`);
        }

        return data || [];
    }

    /**
     * Get notifications for a specific recipient email
     * @param {String} recipientEmail - Recipient's email address
     * @param {Object} filters - Optional filters (limit, offset, includeDismissed)
     * @returns {Array} List of notifications
     */
    async getByRecipientEmail(recipientEmail, filters = {}) {
        // Calculate 90 days ago
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        // Since recipient_emails is text type, we need to use text search
        let query = supabase
            .from('notifications')
            .select('*')
            .like('recipient_emails', `%${recipientEmail}%`)
            .gte('created_at', ninetyDaysAgo.toISOString()) // Only get notifications from last 90 days
            .order('created_at', { ascending: false });

        // Only filter out dismissed notifications if explicitly requested
        if (filters.includeDismissed === false) {
            query = query.eq('dismissed', false);
        }

        if (filters.limit) {
            query = query.limit(filters.limit);
        }

        if (filters.offset) {
            query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
        }

        const { data, error } = await query;

        if (error) {
            throw new Error(`Database error: ${error.message}`);
        }

        return data || [];
    }

    /**
     * Get a single notification by ID
     * @param {Number} notifId - Notification ID
     * @returns {Object|null} Notification or null
     */
    async getById(notifId) {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('notif_id', notifId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') { // Not found
                return null;
            }
            throw new Error(`Database error: ${error.message}`);
        }

        return data;
    }

    /**
     * Update a notification
     * @param {Number} notifId - Notification ID
     * @param {Object} updates - Fields to update
     * @returns {Object} Updated notification
     */
    async update(notifId, updates) {
        const { data, error } = await supabase
            .from('notifications')
            .update(updates)
            .eq('notif_id', notifId)
            .select('*')
            .single();

        if (error) {
            throw new Error(`Database error: ${error.message}`);
        }

        return data;
    }

    /**
     * Delete a notification
     * @param {Number} notifId - Notification ID
     * @returns {Boolean} Success status
     */
    async delete(notifId) {
        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('notif_id', notifId);

        if (error) {
            throw new Error(`Database error: ${error.message}`);
        }

        return true;
    }

    /**
     * Get notification count for a recipient
     * @param {String} recipientEmail - Recipient's email
     * @returns {Number} Count of notifications
     */
    async getCountByRecipient(recipientEmail) {
        const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .contains('recipient_emails', [recipientEmail]);

        if (error) {
            throw new Error(`Database error: ${error.message}`);
        }

        return count || 0;
    }

    /**
     * Get all notifications (for admin/history purposes)
     * @param {Object} options - Pagination options
     * @returns {Object} Paginated results with metadata
     */
    async getAll(options = {}) {
        const limit = options.limit || 50;
        const offset = options.offset || 0;

        // Get total count
        const { count } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true });

        // Get paginated data
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            throw new Error(`Database error: ${error.message}`);
        }

        return {
            notifications: data || [],
            pagination: {
                total: count || 0,
                limit,
                offset,
                hasMore: (offset + limit) < (count || 0)
            }
        };
    }

    /**
     * Get notification history for a recipient with pagination
     * Includes all notifications (even older than 90 days)
     * @param {String} recipientEmail - Recipient's email
     * @param {Object} options - Pagination options
     * @returns {Object} Paginated results
     */
    async getHistoryByRecipient(recipientEmail, options = {}) {
        const limit = options.limit || 20;
        const offset = options.offset || 0;

        // Get total count
        const { count } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .contains('recipient_emails', [recipientEmail]);

        // Get paginated data
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .contains('recipient_emails', [recipientEmail])
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            throw new Error(`Database error: ${error.message}`);
        }

        return {
            notifications: data || [],
            pagination: {
                total: count || 0,
                limit,
                offset,
                hasMore: (offset + limit) < (count || 0)
            }
        };
    }

    /**
     * Bulk create notifications
     * @param {Array} notificationDataArray - Array of notification objects
     * @returns {Array} Created notifications
     */
    async bulkCreate(notificationDataArray) {
        const notificationsToInsert = notificationDataArray.map(notif => ({
            message: notif.message,
            creator_id: notif.creator_id || null,
            recipient_emails: notif.recipient_emails || []
        }));

        const { data, error } = await supabase
            .from('notifications')
            .insert(notificationsToInsert)
            .select('*');

        if (error) {
            throw new Error(`Database error: ${error.message}`);
        }

        return data || [];
    }

    /**
     * Mark a notification as dismissed
     * @param {Number} notifId - Notification ID
     * @returns {Object} Updated notification
     */
    async markAsDismissed(notifId) {
        const { data, error } = await supabase
            .from('notifications')
            .update({ dismissed: true })
            .eq('notif_id', notifId)
            .select('*')
            .single();

        if (error) {
            throw new Error(`Database error: ${error.message}`);
        }

        return data;
    }
}

module.exports = new NotificationRepository();
