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
}

module.exports = new NotificationService();