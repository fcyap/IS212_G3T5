const notificationRepository = require('../repository/notificationRepository');
const userRepository = require('../repository/userRepository');
const projectRepository = require('../repository/projectRepository');
const sgMail = require('@sendgrid/mail');

/**
 * Notification Service - Handles notification creation for member invitations
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
}

module.exports = new NotificationService();