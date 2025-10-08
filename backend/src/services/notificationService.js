const notificationRepository = require('../repository/notificationRepository');
const userRepository = require('../repository/userRepository');
const projectRepository = require('../repository/projectRepository');
const taskRepository = require('../repository/taskRepository');
const sgMail = require('@sendgrid/mail');

/**
 * Notification Service - Handles notification creation for member invitations, task assignments, and comments
 */
class NotificationService {
  constructor() {
    // Configure SendGrid
    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    }
  }

  /**
   * Create a project invitation notification
   */
  async createProjectInvitationNotification(projectId, invitedUserId, inviterUserId, role, customMessage = null) {
    try {
      // Get project details
      const project = await projectRepository.getProjectById(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Get inviter details
      const inviter = await userRepository.getUserById(inviterUserId);
      if (!inviter) {
        throw new Error('Inviter not found');
      }

      // Get invited user details
      const invitedUser = await userRepository.getUserById(invitedUserId);
      if (!invitedUser) {
        throw new Error('Invited user not found');
      }

      // Create notification message
      let message = `${inviter.name} has invited you to join the project "${project.name}" as a ${role}.`;
      
      // Add custom message if provided
      if (customMessage && customMessage.trim()) {
        message += `\n\nMessage: ${customMessage.trim()}`;
      }
      
      message += '\n\nYou can now start contributing to the project immediately.';

      // Create notification data matching the table schema
      const notificationData = {
        notif_types: 'invitation',  // Set notification type for collaborator invitations
        message: message,
        creator_id: inviterUserId,  // Add back creator_id referencing users.id
        recipient_emails: invitedUser.email,
        created_at: new Date().toISOString()
      };

      // Store notification in database
      const notification = await notificationRepository.create(notificationData);

      // Send email notification via SendGrid
      await this.sendProjectInvitationEmail(invitedUser, project, inviter, role, customMessage);

      return notification;
    } catch (error) {
      console.error('Error creating project invitation notification:', error);
      throw error;
    }
  }

  /**
   * Send project invitation email via SendGrid
   */
  async sendProjectInvitationEmail(user, project, inviter, role, customMessage = null) {
    try {
      if (!process.env.SENDGRID_API_KEY) {
        console.warn('SendGrid API key not configured, skipping email notification');
        return;
      }

      const msg = {
        to: user.email,
        from: process.env.FROM_EMAIL || 'noreply@yourapp.com', // Replace with your verified sender
        subject: `You've been invited to join "${project.name}"`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Project Invitation</h2>
            <p>Hello ${user.name},</p>
            <p>You have been invited to join the project <strong>"${project.name}"</strong> by <strong>${inviter.name}</strong>.</p>
            <p><strong>Your role:</strong> ${role}</p>
            ${customMessage && customMessage.trim() ? `
            <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #007bff; margin: 20px 0;">
              <strong>Personal Message:</strong><br>
              ${customMessage.trim()}
            </div>
            ` : ''}
            <p>You can now start contributing to the project immediately.</p>
            <div style="margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/projects/${project.id}"
                 style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                View Project
              </a>
            </div>
            <p>If you have any questions, please contact ${inviter.name}.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #666; font-size: 12px;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        `
      };

      const result = await sgMail.send(msg);
      console.log('Project invitation email sent via SendGrid:', result[0]?.headers?.['x-message-id']);
    } catch (error) {
      console.error('Error sending project invitation email via SendGrid:', error);
      // Don't throw error for email failures - notification is still created
    }
  }

  /**
   * Create task comment notification
   * @param {Object} params - Comment notification parameters
   * @param {number} params.taskId - Task ID
   * @param {number} params.commentId - Comment ID
   * @param {string} params.commentContent - Comment content
   * @param {number} params.commenterId - User ID of commenter
   * @param {string} params.commenterName - Name of commenter
   */
  async createCommentNotification({ taskId, commentId, commentContent, commenterId, commenterName }) {
    try {
      // 1. Get task details from Supabase
      const task = await taskRepository.getTaskById(taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      // 2. Get task assignees (assigned_to is an array of user_ids)
      const assignedUserIds = task.assigned_to || [];
      if (assignedUserIds.length === 0) {
        console.log('No users assigned to task, skipping notification');
        return { notificationsSent: 0 };
      }

      // 3. Filter out the commenter from recipients (don't notify yourself)
      const recipientIds = assignedUserIds.filter(id => id !== commenterId);
      if (recipientIds.length === 0) {
        console.log('No recipients to notify (commenter is the only assignee)');
        return { notificationsSent: 0 };
      }

      // 4. Get recipient user details with emails
      const recipients = [];
      for (const userId of recipientIds) {
        try {
          const user = await userRepository.getUserById(userId);
          if (user && user.email) {
            recipients.push(user);
          }
        } catch (err) {
          console.error(`Failed to fetch user ${userId}:`, err);
        }
      }

      if (recipients.length === 0) {
        console.log('No valid recipients found');
        return { notificationsSent: 0 };
      }

      // 5. Create comment preview (truncate to 100 chars)
      const maxPreviewLength = 100;
      const commentPreview = commentContent.length > maxPreviewLength
        ? commentContent.substring(0, maxPreviewLength) + '...'
        : commentContent;

      // 6. Create notification message
      const message = `${commenterName} commented on "${task.title}": "${commentPreview}"`;

      // 7. Insert notifications into Supabase notifications table
      const notifications = [];
      for (const recipient of recipients) {
        try {
          const notificationData = {
            notif_types: 'comment',
            message: message,
            creator_id: commenterId,
            recipient_emails: recipient.email,
            created_at: new Date().toISOString()
          };

          const notification = await notificationRepository.create(notificationData);
          notifications.push(notification);

          // 8. Send email via SendGrid
          await this.sendCommentEmail(recipient, task, commenterName, commentPreview, commentId);
        } catch (err) {
          console.error(`Failed to create notification for user ${recipient.id}:`, err);
        }
      }

      console.log(`Created ${notifications.length} comment notifications for task ${taskId}`);
      return {
        notificationsSent: notifications.length,
        notifications: notifications
      };
    } catch (error) {
      console.error('Error creating comment notification:', error);
      throw error;
    }
  }

  /**
   * Create notifications when users are assigned to a task
   * @param {Object} params - Task assignment notification parameters
   * @param {Object} params.task - Task object
   * @param {Array<number>} params.assigneeIds - User IDs newly assigned to the task
   * @param {number|null} params.assignedById - User ID of the assigner (if available)
   */
  async createTaskAssignmentNotifications({
    task,
    assigneeIds,
    assignedById = null,
    previousAssigneeIds = [],
    currentAssigneeIds = [],
    notificationType = 'task_assignment'
  }) {
    try {
      if (!Array.isArray(assigneeIds) || assigneeIds.length === 0) {
        return { notificationsSent: 0 };
      }

      const uniqueIds = Array.from(
        new Set(
          assigneeIds
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value))
            .map((value) => Math.trunc(value))
        )
      );

      // Filter out the assigner (e.g. task creator) from notifications
      const recipientIds = uniqueIds.filter((id) => assignedById == null || id !== assignedById);
      if (recipientIds.length === 0) {
        return { notificationsSent: 0 };
      }

      let taskDetails = task;
      if (!taskDetails || !taskDetails.id) {
        const lookupId = task?.id;
        if (lookupId == null) {
          console.warn('Task id missing for assignment notification, skipping');
          return { notificationsSent: 0 };
        }
        const fetchedTask = await taskRepository.getTaskById(lookupId);
        taskDetails = fetchedTask || null;
      }

      if (!taskDetails) {
        console.warn('Task details missing for assignment notification, skipping');
        return { notificationsSent: 0 };
      }

      const userMap = await this._fetchUsersByIds([
        ...recipientIds,
        ...previousAssigneeIds,
        ...currentAssigneeIds,
        assignedById != null ? assignedById : undefined
      ]);

      const assignerUser = assignedById != null ? userMap.get(assignedById) : null;
      const assignerName = assignerUser?.name || 'A team member';

      const oldAssigneesLabel = this._formatUserList(previousAssigneeIds, userMap);
      const newAssigneesLabel = this._formatUserList(currentAssigneeIds, userMap);
      const currentAssigneesLabel = this._formatUserList(currentAssigneeIds, userMap);
      const deadlineLabel = this._formatDeadline(taskDetails.deadline);

      const recipients = recipientIds
        .map((id) => userMap.get(id))
        .filter((user) => user?.email);

      if (recipients.length === 0) {
        console.log('No recipients available for task assignment notification');
        return { notificationsSent: 0 };
      }

      const notifications = [];
      for (const recipient of recipients) {
        try {
          const messageLines = [
            `${assignerName} assigned you to "${taskDetails.title}".`,
            `Old assignees: ${oldAssigneesLabel}`,
            `New assignees: ${newAssigneesLabel || currentAssigneesLabel || 'None'}`,
            `Deadline: ${deadlineLabel}`
          ];

          const notificationData = {
            notif_types: notificationType,
            message: messageLines.join('\n'),
            creator_id: assignedById || null,
            recipient_emails: recipient.email,
            created_at: new Date().toISOString()
          };

          const notification = await this._createNotificationWithFallback(notificationData);
          notifications.push(notification);

          await this.sendTaskAssignmentEmail({
            recipient,
            task: taskDetails,
            assignerName,
            oldAssigneesLabel,
            newAssigneesLabel: newAssigneesLabel || currentAssigneesLabel || 'None',
            deadlineLabel,
            notificationType
          });
        } catch (err) {
          console.error(`Failed to create task assignment notification for user ${recipient.id}:`, err);
        }
      }

      console.log(
        `Created ${notifications.length} task assignment notifications for task ${taskDetails.id}`
      );
      return {
        notificationsSent: notifications.length,
        notifications
      };
    } catch (error) {
      console.error('Error creating task assignment notifications:', error);
      throw error;
    }
  }

  /**
   * Create notifications when users are removed from a task
   * @param {Object} params - Task removal notification parameters
   * @param {Object} params.task - Task object
   * @param {Array<number>} params.assigneeIds - User IDs removed from the task
   * @param {number|null} params.assignedById - User ID of the actor (if available)
   * @param {Array<number>} params.previousAssigneeIds - Assignee IDs prior to the change
   * @param {Array<number>} params.currentAssigneeIds - Assignee IDs after the change
   */
  async createTaskRemovalNotifications({
    task,
    assigneeIds,
    assignedById = null,
    previousAssigneeIds = [],
    currentAssigneeIds = []
  }) {
    try {
      if (!Array.isArray(assigneeIds) || assigneeIds.length === 0) {
        return { notificationsSent: 0 };
      }

      const uniqueIds = Array.from(
        new Set(
          assigneeIds
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value))
            .map((value) => Math.trunc(value))
        )
      );

      const recipientIds = uniqueIds.filter((id) => assignedById == null || id !== assignedById);
      if (recipientIds.length === 0) {
        return { notificationsSent: 0 };
      }

      let taskDetails = task;
      if (!taskDetails || !taskDetails.id) {
        const lookupId = task?.id;
        if (lookupId == null) {
          console.warn('Task id missing for removal notification, skipping');
          return { notificationsSent: 0 };
        }
        const fetchedTask = await taskRepository.getTaskById(lookupId);
        taskDetails = fetchedTask || null;
      }

      if (!taskDetails) {
        console.warn('Task details missing for removal notification, skipping');
        return { notificationsSent: 0 };
      }

      const userMap = await this._fetchUsersByIds([
        ...recipientIds,
        ...previousAssigneeIds,
        ...currentAssigneeIds,
        assignedById != null ? assignedById : undefined
      ]);

      const assignerUser = assignedById != null ? userMap.get(assignedById) : null;
      const assignerName = assignerUser?.name || 'A team member';

      const oldAssigneesLabel = this._formatUserList(previousAssigneeIds, userMap);
      const newAssigneesLabel = this._formatUserList(currentAssigneeIds, userMap);
      const deadlineLabel = this._formatDeadline(taskDetails.deadline);

      const recipients = recipientIds
        .map((id) => userMap.get(id))
        .filter((user) => user?.email);

      if (recipients.length === 0) {
        console.log('No recipients available for task removal notification');
        return { notificationsSent: 0 };
      }

      const notifications = [];
      for (const recipient of recipients) {
        try {
          const messageLines = [
            `${assignerName} removed you from "${taskDetails.title}".`,
            `Old assignees: ${oldAssigneesLabel}`,
            `New assignees: ${newAssigneesLabel || 'None'}`,
            `Deadline: ${deadlineLabel}`
          ];

          const notificationData = {
            notif_types: 'remove_from_task',
            message: messageLines.join('\n'),
            creator_id: assignedById || null,
            recipient_emails: recipient.email,
            created_at: new Date().toISOString()
          };

          const notification = await this._createNotificationWithFallback(notificationData);
          notifications.push(notification);

          await this.sendTaskRemovalEmail({
            recipient,
            task: taskDetails,
            assignerName,
            oldAssigneesLabel,
            newAssigneesLabel: newAssigneesLabel || 'None',
            deadlineLabel
          });
        } catch (err) {
          console.error(`Failed to create task removal notification for user ${recipient.id}:`, err);
        }
      }

      console.log(
        `Created ${notifications.length} task removal notifications for task ${taskDetails.id}`
      );
      return {
        notificationsSent: notifications.length,
        notifications
      };
    } catch (error) {
      console.error('Error creating task removal notifications:', error);
      throw error;
    }
  }

  /**
   * Send comment notification email via SendGrid
   */
  async sendCommentEmail(recipient, task, commenterName, commentPreview, commentId) {
    try {
      if (!process.env.SENDGRID_API_KEY) {
        console.warn('SendGrid API key not configured, skipping email notification');
        return;
      }

      const msg = {
        to: recipient.email,
        from: process.env.FROM_EMAIL || 'noreply@yourapp.com',
        subject: `New comment on "${task.title}"`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">New Comment on Task</h2>
            <p>Hello ${recipient.name},</p>
            <p><strong>${commenterName}</strong> has commented on the task <strong>"${task.title}"</strong>:</p>
            <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #007bff; margin: 20px 0;">
              <em>"${commentPreview}"</em>
            </div>
            <div style="margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/tasks/${task.id}"
                 style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                View Comment
              </a>
            </div>
            <p>Click the button above to view the full comment and reply.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #666; font-size: 12px;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        `
      };

      const result = await sgMail.send(msg);
      console.log('Comment notification email sent via SendGrid:', result[0]?.headers?.['x-message-id']);
    } catch (error) {
      console.error('Error sending comment notification email via SendGrid:', error);
      // Don't throw error for email failures - notification is still created
    }
  }

  /**
   * Send task assignment email via SendGrid
   * @param {Object} params
   * @param {Object} params.recipient - Recipient user object
   * @param {Object} params.task - Task details
   * @param {String} params.assignerName - Name of the user assigning the task
   */
  async sendTaskAssignmentEmail({
    recipient,
    task,
    assignerName,
    oldAssigneesLabel,
    newAssigneesLabel,
    deadlineLabel,
    notificationType = 'task_assignment'
  }) {
    try {
      if (!process.env.SENDGRID_API_KEY) {
        console.warn('SendGrid API key not configured, skipping email notification');
        return;
      }

      const isReassignment = notificationType === 'reassignment';
      const subject = isReassignment
        ? `Task updated: ${task.title}`
        : `You have been assigned to "${task.title}"`;

      const msg = {
        to: recipient.email,
        from: process.env.FROM_EMAIL || 'noreply@yourapp.com',
        subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">${isReassignment ? 'Task Reassignment' : 'New Task Assignment'}</h2>
            <p>Hello ${recipient.name},</p>
            <p><strong>${assignerName}</strong> has assigned you to the task <strong>"${task.title}"</strong>.</p>
            <p><strong>Previous assignees:</strong> ${oldAssigneesLabel}</p>
            <p><strong>New assignees:</strong> ${newAssigneesLabel}</p>
            <p><strong>Deadline:</strong> ${deadlineLabel}</p>
            ${
              task.description
                ? `<div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #28a745; margin: 20px 0;">
                     ${task.description}
                   </div>`
                : ''
            }
            <div style="margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/tasks/${task.id}"
                 style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                View Task
              </a>
            </div>
            <p>Please review the task details and start working on it at your earliest convenience.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #666; font-size: 12px;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        `
      };

      const result = await sgMail.send(msg);
      console.log('Task assignment email sent via SendGrid:', result[0]?.headers?.['x-message-id']);
    } catch (error) {
      console.error('Error sending task assignment email via SendGrid:', error);
      // Don't throw error for email failures - notification is still created
    }
  }

  /**
   * Send task removal email via SendGrid
   * @param {Object} params
   * @param {Object} params.recipient - Recipient user object
   * @param {Object} params.task - Task details
   * @param {String} params.assignerName - Name of the user modifying the task
   * @param {String} params.oldAssigneesLabel - Old assignee names
   * @param {String} params.newAssigneesLabel - New assignee names
   * @param {String} params.deadlineLabel - Deadline label
   */
  async sendTaskRemovalEmail({
    recipient,
    task,
    assignerName,
    oldAssigneesLabel,
    newAssigneesLabel,
    deadlineLabel
  }) {
    try {
      if (!process.env.SENDGRID_API_KEY) {
        console.warn('SendGrid API key not configured, skipping email notification');
        return;
      }

      const msg = {
        to: recipient.email,
        from: process.env.FROM_EMAIL || 'noreply@yourapp.com',
        subject: `You have been removed from "${task.title}"`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Task Assignment Updated</h2>
            <p>Hello ${recipient.name},</p>
            <p><strong>${assignerName}</strong> has removed you from the task <strong>"${task.title}"</strong>.</p>
            <p><strong>Previous assignees:</strong> ${oldAssigneesLabel}</p>
            <p><strong>New assignees:</strong> ${newAssigneesLabel}</p>
            <p><strong>Deadline:</strong> ${deadlineLabel}</p>
            <p>If you believe this is an error, please contact ${assignerName} for clarification.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #666; font-size: 12px;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        `
      };

      const result = await sgMail.send(msg);
      console.log('Task removal email sent via SendGrid:', result[0]?.headers?.['x-message-id']);
    } catch (error) {
      console.error('Error sending task removal email via SendGrid:', error);
      // Don't throw error for email failures - notification is still created
    }
  }

  async _createNotificationWithFallback(notificationData) {
    try {
      return await notificationRepository.create(notificationData);
    } catch (error) {
      if (
        typeof error?.message === 'string' &&
        error.message.includes('invalid input value for enum notif_types')
      ) {
        console.warn(
          `Notification type "${notificationData.notif_types}" not supported. Falling back to "general".`
        );
        return await notificationRepository.create({
          ...notificationData,
          notif_types: 'general'
        });
      }
      throw error;
    }
  }

  async _fetchUsersByIds(ids = []) {
    const normalized = Array.from(
      new Set(
        (Array.isArray(ids) ? ids : [])
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value))
          .map((value) => Math.trunc(value))
      )
    ).filter((value) => value != null);

    if (normalized.length === 0) {
      return new Map();
    }

    if (!userRepository.getUsersByIds) {
      console.warn('userRepository.getUsersByIds not available, skipping user enrichment for notifications');
      return new Map();
    }

    try {
      const users = await userRepository.getUsersByIds(normalized);
      const map = new Map();
      (Array.isArray(users) ? users : []).forEach((user) => {
        if (user?.id != null) {
          map.set(user.id, user);
        }
      });
      return map;
    } catch (err) {
      console.error('Failed to fetch users for notification context:', err);
      return new Map();
    }
  }

  _formatUserList(ids = [], userMap = new Map()) {
    const names = (Array.isArray(ids) ? ids : [])
      .map((id) => userMap.get(id))
      .filter(Boolean)
      .map((user) => user.name || user.email || `User ${user.id}`);
    return names.length ? names.join(', ') : 'None';
  }

  _formatDeadline(deadline) {
    if (!deadline) {
      return 'No deadline set';
    }
    try {
      const date = new Date(deadline);
      if (Number.isNaN(date.getTime())) {
        return deadline;
      }
      return date.toLocaleString();
    } catch (err) {
      return deadline;
    }
  }

  /**
   * Get notifications for a user by email (matching recipient_emails)
   * @param {String} userEmail - User's email address
   * @param {Number} limit - Maximum number of notifications to return
   * @param {Number} offset - Number of notifications to skip
   * @returns {Array} List of notifications
   */
  async getUserNotifications(userEmail, limit = 50, offset = 0) {
    if (!userEmail) {
      throw new Error('User email is required');
    }

    const filters = { limit, offset };
    return await notificationRepository.getByRecipientEmail(userEmail, filters);
  }

  /**
   * Get notifications for a recipient email
   * @param {String} recipientEmail - Recipient's email address
   * @param {Object} filters - Optional filters
   * @returns {Array} List of notifications
   */
  async getNotificationsByRecipient(recipientEmail, filters = {}) {
    if (!recipientEmail) {
      throw new Error('Recipient email is required');
    }

    return await notificationRepository.getByRecipientEmail(recipientEmail, filters);
  }

  /**
   * Get notifications created by a user
   * @param {Number} creatorId - Creator's user ID
   * @param {Object} filters - Optional filters
   * @returns {Array} List of notifications
   */
  async getNotificationsByCreator(creatorId, filters = {}) {
    if (!creatorId) {
      throw new Error('Creator ID is required');
    }

    return await notificationRepository.getByCreatorId(creatorId, filters);
  }

  /**
   * Get a single notification
   * @param {Number} notifId - Notification ID
   * @returns {Object} Notification
   */
  async getNotificationById(notifId) {
    const notification = await notificationRepository.getById(notifId);

    if (!notification) {
      throw new Error('Notification not found');
    }

    return notification;
  }

  /**
   * Get notification count for a recipient
   * @param {String} recipientEmail - Recipient's email
   * @returns {Number} Count
   */
  async getCountByRecipient(recipientEmail) {
    if (!recipientEmail) {
      throw new Error('Recipient email is required');
    }

    return await notificationRepository.getCountByRecipient(recipientEmail);
  }

  /**
   * Get notification history for a recipient with pagination
   * @param {String} recipientEmail - Recipient's email
   * @param {Object} options - Pagination options
   * @returns {Object} Paginated results
   */
  async getNotificationHistory(recipientEmail, options = {}) {
    if (!recipientEmail) {
      throw new Error('Recipient email is required');
    }

    return await notificationRepository.getHistoryByRecipient(recipientEmail, options);
  }

  /**
   * Get all notifications (admin only)
   * @param {Object} options - Pagination options
   * @returns {Object} Paginated results
   */
  async getAllNotifications(options = {}) {
    return await notificationRepository.getAll(options);
  }
}

module.exports = new NotificationService();
