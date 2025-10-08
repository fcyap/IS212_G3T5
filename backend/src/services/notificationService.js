const notificationRepository = require('../repository/notificationRepository');
const userRepository = require('../repository/userRepository');
const projectRepository = require('../repository/projectRepository');
const taskRepository = require('../repository/taskRepository');
const sgMail = require('@sendgrid/mail');

/**
 * Notification Service - Handles notification creation for member invitations and comments
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

  /**
   * Check for tasks with upcoming deadlines and send notifications to managers
   * @returns {Object} Summary of notifications sent
   */
  async checkAndSendDeadlineNotifications() {
    try {
      console.log('Checking for upcoming task deadlines...');

      // Get tasks due within 24 hours or on the due date
      const tasksDueSoon = await this.getTasksDueSoon();

      if (tasksDueSoon.length === 0) {
        console.log('No tasks due soon found');
        return { notificationsSent: 0, tasksChecked: 0 };
      }

      let notificationsSent = 0;

      for (const task of tasksDueSoon) {
        try {
          // Get project managers for the task's project
          const managers = await this.getProjectManagers(task.project_id);

          for (const manager of managers) {
            // Check if we already sent a notification for this task recently
            const existingNotification = await this.checkExistingDeadlineNotification(task.id, manager.email);
            if (existingNotification) {
              console.log(`Already sent deadline notification for task ${task.id} to manager ${manager.email}`);
              continue;
            }

            // Create in-app notification
            await this.createDeadlineNotification(task, manager);

            // Send email notification
            await this.sendDeadlineEmailNotification(task, manager);

            notificationsSent++;
          }
        } catch (error) {
          console.error(`Error processing deadline notification for task ${task.id}:`, error);
        }
      }

      console.log(`Deadline notification check completed. Sent ${notificationsSent} notifications.`);
      return { notificationsSent, tasksChecked: tasksDueSoon.length };

    } catch (error) {
      console.error('Error in checkAndSendDeadlineNotifications:', error);
      throw error;
    }
  }

  /**
   * Get tasks that are due today or tomorrow (for 8am notifications)
   * @returns {Array} Tasks due soon
   */
  async getTasksDueSoon() {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get tasks with deadlines today or tomorrow
      const { data: tasks, error } = await taskRepository.list({ archived: false });

      if (error) throw error;

      const tasksDueSoon = tasks.filter(task => {
        if (!task.deadline) return false;

        const deadline = new Date(task.deadline);
        const deadlineDate = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());

        // Check if deadline is today or tomorrow
        return deadlineDate.getTime() === today.getTime() || deadlineDate.getTime() === tomorrow.getTime();
      });

      // Hydrate tasks with project and assignee information
      const hydratedTasks = [];
      for (const task of tasksDueSoon) {
        try {
          let project = null;
          if (task.project_id) {
            project = await projectRepository.getProjectById(task.project_id);
          }
          const assignees = await this.getTaskAssignees(task.assigned_to);

          hydratedTasks.push({
            ...task,
            project,
            assignees
          });
        } catch (error) {
          console.error(`Error hydrating task ${task.id}:`, error);
        }
      }

      return hydratedTasks;
    } catch (error) {
      console.error('Error getting tasks due soon:', error);
      return [];
    }
  }

  /**
   * Get project managers for a given project
   * @param {Number} projectId - Project ID
   * @returns {Array} Project managers
   */
  async getProjectManagers(projectId) {
    try {
      if (!projectId) return [];

      const project = await projectRepository.getProjectById(projectId);
      if (!project) return [];

      // For now, assume the project creator is the manager
      // In a real system, you might have a separate managers table or role-based access
      const manager = await userRepository.getUserById(project.creator_id);
      return manager ? [manager] : [];
    } catch (error) {
      console.error('Error getting project managers:', error);
      return [];
    }
  }

  /**
   * Get task assignees information
   * @param {Array} assignedToIds - Array of user IDs
   * @returns {Array} Assignee objects
   */
  async getTaskAssignees(assignedToIds) {
    try {
      if (!Array.isArray(assignedToIds) || assignedToIds.length === 0) return [];

      const { data: users, error } = await userRepository.getUsersByIds(assignedToIds);
      if (error) throw error;

      return users || [];
    } catch (error) {
      console.error('Error getting task assignees:', error);
      return [];
    }
  }

  /**
   * Check if a deadline notification was already sent for this task recently
   * @param {Number} taskId - Task ID
   * @param {Number} managerId - Manager user ID
   * @returns {Boolean} Whether notification exists
   */
  async checkExistingDeadlineNotification(taskId, managerEmail) {
    try {
      // Check for notifications sent in the last 24 hours for this task
      const oneDayAgo = new Date(Date.now() - (24 * 60 * 60 * 1000));

      const notifications = await notificationRepository.getByUserEmail(
        managerEmail,
        { limit: 100 }
      );

      if (!notifications || !Array.isArray(notifications)) {
        console.log(`No notifications found for ${managerEmail}, proceeding with notification`);
        return false;
      }

      // Filter notifications for this manager about this task in the last 24 hours
      const recentNotifications = notifications.filter(notification => {
        const isRecent = new Date(notification.created_at) > oneDayAgo;
        const isDeadlineNotification = notification.message.includes(`Task "${taskId}"`) &&
                                      notification.notif_types === 'deadline';

        return isRecent && isDeadlineNotification;
      });

      return recentNotifications.length > 0;
    } catch (error) {
      console.error('Error checking existing deadline notification:', error);
      return false;
    }
  }

  /**
   * Create an in-app deadline notification
   * @param {Object} task - Task object
   * @param {Object} manager - Manager user object
   */
  async createDeadlineNotification(task, manager) {
    try {
      const deadline = new Date(task.deadline);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const deadlineDate = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());

      let urgencyMessage = '';
      let notificationType = '';

      if (deadlineDate.getTime() === today.getTime()) {
        urgencyMessage = 'is due TODAY';
        notificationType = 'Due Today';
      } else if (deadlineDate.getTime() === tomorrow.getTime()) {
        urgencyMessage = 'is due TOMORROW';
        notificationType = 'Due Tomorrow';
      }

      const assigneeNames = task.assignees.map(a => a.name).join(', ');

      const message = `Task "${task.title}" ${urgencyMessage}\n` +
                     `Project: ${task.project?.name || 'Unknown'}\n` +
                     `Assigned to: ${assigneeNames}\n` +
                     `Deadline: ${deadline.toLocaleDateString()}`;

      await notificationRepository.create({
        message,
        creator_id: manager.id, // Manager receives the notification
        recipient_emails: manager.email,
        notif_types: 'deadline'
      });

      console.log(`Created ${notificationType.toLowerCase()} notification for task "${task.title}" sent to ${manager.email}`);
    } catch (error) {
      console.error('Error creating deadline notification:', error);
      throw error;
    }
  }

  /**
   * Send deadline email notification
   * @param {Object} task - Task object
   * @param {Object} manager - Manager user object
   */
  async sendDeadlineEmailNotification(task, manager) {
    try {
      if (!sgMail || !process.env.SENDGRID_API_KEY) {
        console.warn('SendGrid not configured, skipping email notification');
        return;
      }

      const deadline = new Date(task.deadline);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const deadlineDate = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());

      let subject = '';
      let urgencyMessage = '';
      let priorityColor = '#dc3545'; // Default red for urgent

      if (deadlineDate.getTime() === today.getTime()) {
        subject = `🚨 Task Due Today: ${task.title}`;
        urgencyMessage = 'is due TODAY';
        priorityColor = '#dc3545'; // Red for today
      } else if (deadlineDate.getTime() === tomorrow.getTime()) {
        subject = `⚠️ Task Due Tomorrow: ${task.title}`;
        urgencyMessage = 'is due TOMORROW';
        priorityColor = '#ffc107'; // Yellow for tomorrow
      }

      const assigneeNames = task.assignees.map(a => a.name).join(', ');

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${priorityColor};">${subject}</h2>

          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>Task Details:</h3>
            <p><strong>Task:</strong> ${task.title}</p>
            <p><strong>Project:</strong> ${task.project?.name || 'Unknown'}</p>
            <p><strong>Assigned to:</strong> ${assigneeNames}</p>
            <p><strong>Deadline:</strong> ${deadline.toLocaleDateString()} at ${deadline.toLocaleTimeString()}</p>
            <p><strong>Status:</strong> ${task.status || 'Unknown'}</p>
          </div>

          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #856404;">
              <strong>Action Required:</strong> Please follow up with the assigned staff to ensure this task is completed on time.
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3002'}/projects/${task.project_id}"
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              View Task Details
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

          <p style="color: #6c757d; font-size: 12px;">
            This is an automated notification from the Project Management System.
          </p>
        </div>
      `;

      const msg = {
        to: manager.email,
        from: process.env.FROM_EMAIL || 'noreply@yourapp.com',
        subject,
        html: htmlContent,
      };

      await sgMail.send(msg);
      console.log(`Sent deadline email notification for task "${task.title}" to ${manager.email}`);

    } catch (error) {
      console.error('Error sending deadline email notification:', error);
      throw error;
    }
  }
}

module.exports = new NotificationService();
