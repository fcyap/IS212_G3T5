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
   * Create notifications when a task is updated
   * @param {Object} params - Task update notification parameters
   * @param {Object} params.task - Updated task object
   * @param {Array<Object>} params.changes - List of change descriptors
   * @param {number|null} params.updatedById - User ID of the actor (if available)
   * @param {Array<number>} params.assigneeIds - Current task assignee IDs
   */
  async createTaskUpdateNotifications({
    task,
    changes,
    updatedById = null,
    assigneeIds = []
  }) {
    try {
      if (!task || !task.id) {
        console.warn('Task details missing for update notification, skipping');
        return { notificationsSent: 0 };
      }

      if (!Array.isArray(changes) || changes.length === 0) {
        return { notificationsSent: 0 };
      }

      const normalizedAssigneeIds = Array.from(
        new Set(
          (Array.isArray(assigneeIds) && assigneeIds.length
            ? assigneeIds
            : Array.isArray(task.assigned_to)
              ? task.assigned_to
              : []
          )
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value))
            .map((value) => Math.trunc(value))
        )
      );

      if (normalizedAssigneeIds.length === 0) {
        console.log('No assignees found for task update notification');
        return { notificationsSent: 0 };
      }

      const recipientIds = normalizedAssigneeIds.filter(
        (id) => updatedById == null || id !== updatedById
      );
      if (recipientIds.length === 0) {
        console.log('No recipients for task update notification after filtering actor');
        return { notificationsSent: 0 };
      }

      const userMap = await this._fetchUsersByIds([
        ...recipientIds,
        updatedById != null ? updatedById : undefined
      ]);

      const updaterUser = updatedById != null ? userMap.get(updatedById) : null;
      const updaterName = updaterUser?.name || 'A team member';

      const changeLines = changes
        .map((change) => this._formatTaskChangeLine(change))
        .filter(Boolean);

      if (changeLines.length === 0) {
        console.log('No formatted change lines for task update notification');
        return { notificationsSent: 0 };
      }

      const notifications = [];
      for (const recipientId of recipientIds) {
        const recipient = userMap.get(recipientId);
        if (!recipient?.email) {
          console.warn(`Skipping task update notification for user ${recipientId} due to missing email`);
          continue;
        }

        const messageLines = [
          `${updaterName} updated "${task.title}".`,
          ...changeLines.map((line) => `- ${line}`)
        ];

        const notificationData = {
          notif_types: 'task_modif',
          message: messageLines.join('\n'),
          creator_id: updatedById || null,
          recipient_emails: recipient.email,
          created_at: new Date().toISOString()
        };

        const notification = await this._createNotificationWithFallback(notificationData);
        notifications.push(notification);

        await this.sendTaskUpdateEmail({
          recipient,
          task,
          updaterName,
          changeLines
        });
      }

      console.log(
        `Created ${notifications.length} task update notifications for task ${task.id}`
      );
      return {
        notificationsSent: notifications.length,
        notifications
      };
    } catch (error) {
      console.error('Error creating task update notifications:', error);
      throw error;
    }
  }

  /**
   * Create task deletion notification
   * @param {Object} params - Task deletion notification parameters
   * @param {Object} params.task - Task object that was deleted
   * @param {number} params.deleterId - User ID of the person who deleted the task
   * @param {string} params.deleterName - Name of the person who deleted the task
   */
  async createTaskDeletedNotification({ task, taskId, deleterId, deleterName }) {
    try {
      // If task not provided, fetch it
      let taskDetails = task;
      if (!taskDetails && taskId) {
        taskDetails = await taskRepository.getTaskById(taskId);
      }

      if (!taskDetails) {
        throw new Error('Task not found');
      }

      // Get task assignees (assigned_to is an array of user_ids)
      const assignedUserIds = taskDetails.assigned_to || [];
      console.log(`Task assignees:`, assignedUserIds);
      if (assignedUserIds.length === 0) {
        console.log('No users assigned to task, skipping deletion notification');
        return { notificationsSent: 0, notificationIds: [] };
      }

      // Filter out the deleter from recipients (don't notify the person who deleted it)
      // TODO: For testing purposes, allow deleter to receive notification too
      // const recipientIds = assignedUserIds.filter(id => id !== deleterId);
      const recipientIds = assignedUserIds; // Temporarily allow deleter to receive notification
      console.log(`Deleter ID: ${deleterId}, Recipient IDs after filtering:`, recipientIds);
      if (recipientIds.length === 0) {
        console.log('No recipients to notify (deleter is the only/all assignees)');
        return { notificationsSent: 0, notificationIds: [] };
      }

      // Get project details if available
      let project = null;
      if (taskDetails.project_id) {
        try {
          project = await projectRepository.getProjectById(taskDetails.project_id);
          if (!project) {
            throw new Error('Project not found');
          }
        } catch (err) {
          console.error(`Failed to fetch project ${taskDetails.project_id}:`, err);
          throw err;
        }
      }

      // Get recipient user details with emails
      const recipients = [];
      for (const userId of recipientIds) {
        try {
          const user = await userRepository.getUserById(userId);
          console.log(`User ${userId} lookup result:`, {
            user: user ? { id: user.id, name: user.name, email: user.email } : null,
            hasEmail: !!user?.email,
            email: user?.email
          });
          if (user && user.email) {
            recipients.push(user);
          } else {
            console.log(`Skipping user ${userId} - no email or user not found. User data:`, user);
          }
        } catch (err) {
          console.error(`Failed to fetch user ${userId}:`, err);
        }
      }

      console.log(`Final recipients list:`, recipients.map(r => ({ id: r.id, email: r.email })));

      if (recipients.length === 0) {
        console.log('No valid recipients found with emails');
        return { notificationsSent: 0, notificationIds: [] };
      }

      // Create notification message
      const message = `${deleterName} has deleted the task "${taskDetails.title}"${project ? ` from project "${project.name}"` : ''}.`;

      // Insert notifications into database and send emails
      const notifications = [];
      const notificationIds = [];
      for (const recipient of recipients) {
        try {
          const notificationData = {
            notif_types: 'task_deletion',
            message: message,
            creator_id: deleterId,
            recipient_emails: recipient.email,
            created_at: new Date().toISOString()
          };

          const notification = await notificationRepository.create(notificationData);
          notifications.push(notification);
          notificationIds.push(notification.notif_id);

          // Send email via SendGrid
          await this.sendTaskDeletedEmail(recipient, taskDetails, project, deleterName);
        } catch (err) {
          console.error(`Failed to create notification for user ${recipient.id}:`, err);
        }
      }

      console.log(`Created ${notifications.length} task deletion notifications for task ${taskDetails.id}`);
      return {
        notificationsSent: notifications.length,
        notifications: notifications,
        notificationIds: notificationIds
      };
    } catch (error) {
      console.error('Error creating task deletion notification:', error);
      throw error;
    }
  }

  /**
   * Send task deleted email via SendGrid
   * @param {Object} recipient - Recipient user object
   * @param {Object} task - Task details that was deleted
   * @param {Object} project - Project details (if task was in a project)
   * @param {string} deleterName - Name of the person who deleted the task
   */
  async sendTaskDeletedEmail(recipient, task, project, deleterName) {
    try {
      if (!process.env.SENDGRID_API_KEY) {
        console.warn('SendGrid API key not configured, skipping email notification');
        return;
      }

      // Format task details for email
      const taskDetails = {
        title: task.title || 'Untitled Task',
        description: task.description || 'No description provided',
        status: task.status || 'N/A',
        priority: task.priority || 'N/A',
        dueDate: task.due_date || task.deadline || 'No due date',
        tags: task.tags && Array.isArray(task.tags) ? task.tags.join(', ') : 'No tags',
        projectName: project?.name || 'No project',
        createdAt: task.created_at ? new Date(task.created_at).toLocaleString() : 'Unknown',
        updatedAt: task.updated_at ? new Date(task.updated_at).toLocaleString() : 'Unknown'
      };

      const msg = {
        to: recipient.email,
        from: process.env.FROM_EMAIL || 'noreply@yourapp.com',
        subject: `Task Deleted: "${taskDetails.title}"`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc3545;">⚠️ Task Deleted</h2>
            <p>Hello ${recipient.name},</p>
            <p><strong>${deleterName}</strong> has deleted a task that was assigned to you.</p>
            
            <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #856404;">
                <strong>Note:</strong> This task has been permanently removed from the system.
              </p>
            </div>

            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #333;">Task Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;"><strong>Title:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">${taskDetails.title}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;"><strong>Description:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">${taskDetails.description}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;"><strong>Project:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">${taskDetails.projectName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;"><strong>Status:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">${taskDetails.status}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;"><strong>Priority:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">${taskDetails.priority}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;"><strong>Due Date:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">${taskDetails.dueDate}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;"><strong>Tags:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">${taskDetails.tags}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;"><strong>Created:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #dee2e6;">${taskDetails.createdAt}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Last Updated:</strong></td>
                  <td style="padding: 8px 0;">${taskDetails.updatedAt}</td>
                </tr>
              </table>
            </div>

            <p>This notification is to help you understand changes in your team's workload. If you have any questions about this deletion, please contact ${deleterName}.</p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #666; font-size: 12px;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        `
      };

      const result = await sgMail.send(msg);
      console.log('Task deletion email sent via SendGrid:', result[0]?.headers?.['x-message-id']);
    } catch (error) {
      console.error('Error sending task deletion email via SendGrid:', error);
      // Don't throw error for email failures - notification is still created
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
        ? `Task reassignment: ${task.title}`
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

  /**
   * Send task update email via SendGrid
   * @param {Object} params
   * @param {Object} params.recipient - Recipient user object
   * @param {Object} params.task - Task details
   * @param {String} params.updaterName - Name of the user updating the task
   * @param {Array<String>} params.changeLines - Formatted change descriptions
   */
  async sendTaskUpdateEmail({ recipient, task, updaterName, changeLines = [] }) {
    try {
      if (!process.env.SENDGRID_API_KEY) {
        console.warn('SendGrid API key not configured, skipping email notification');
        return;
      }

      const changesHtml = changeLines.length
        ? `
          <ul>
            ${changeLines.map((line) => `<li>${line}</li>`).join('')}
          </ul>
        `
        : '<p>Changes were applied to this task.</p>';

      const msg = {
        to: recipient.email,
        from: process.env.FROM_EMAIL || 'noreply@yourapp.com',
        subject: `Task updated: ${task.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Task Updated</h2>
            <p>Hello ${recipient.name},</p>
            <p><strong>${updaterName}</strong> updated the task <strong>"${task.title}"</strong>.</p>
            ${changesHtml}
            ${
              task.description
                ? `<div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #17a2b8; margin: 20px 0;">
                     ${task.description}
                   </div>`
                : ''
            }
            <div style="margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/tasks/${task.id}"
                 style="background-color: #17a2b8; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                View Task
              </a>
            </div>
            <p>Please review the updates at your earliest convenience.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #666; font-size: 12px;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        `
      };

      const result = await sgMail.send(msg);
      console.log('Task update email sent via SendGrid:', result[0]?.headers?.['x-message-id']);
    } catch (error) {
      console.error('Error sending task update email via SendGrid:', error);
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

  _formatTaskChangeLine(change) {
    if (!change) {
      return null;
    }

    const label = change.label || change.field || 'Field';
    const before = change.before ?? 'None';
    const after = change.after ?? 'None';

    if (before === after) {
      return null;
    }

    if (before === 'None' && after !== 'None') {
      return `${label}: set to ${after}`;
    }

    if (after === 'None' && before !== 'None') {
      return `${label}: cleared (was ${before})`;
    }

    return `${label}: ${before} → ${after}`;
  }

  /**
   * Get notifications for a user by email (matching recipient_emails)
   * @param {String} userEmail - User's email address
   * @param {Number} limit - Maximum number of notifications to return
   * @param {Number} offset - Number of notifications to skip
   * @returns {Array} List of notifications
   */
  async getUserNotifications(userEmail, limit = 50, offset = 0, includeDismissed = true) {
    if (!userEmail) {
      throw new Error('User email is required');
    }

    const filters = { limit, offset, includeDismissed };
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

  /**
   * Mark a notification as dismissed
   * @param {Number} notifId - Notification ID
   * @returns {Object} Updated notification
   */
  async markAsDismissed(notifId) {
    try {
      if (!notifId) {
        throw new Error('Notification ID is required');
      }

      return await notificationRepository.markAsDismissed(notifId);
    } catch (error) {
      console.error('Error marking notification as dismissed:', error);
      throw error;
    }
  }
}

module.exports = new NotificationService();
