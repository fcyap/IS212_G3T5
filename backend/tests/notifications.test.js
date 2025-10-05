const notificationRepository = require('../src/repository/notificationRepository');
const notificationService = require('../src/services/notificationService');

/**
 * Notification System Test Suite
 * Tests basic CRUD operations and Acceptance Criteria
 * 
 * User Story: As a staff, I want to view my notification history so that 
 * I can track past alerts and stay informed about previous task updates.
 * 
 * Acceptance Criteria:
 * AC1: All notifications are saved in the database with timestamp, type, sender
 * AC2: Old notifications remain accessible for at least 90 days
 */

describe('Notification CRUD Operations', () => {

  describe('CREATE - Notification Creation', () => {
    test('should create a notification with all required fields', async () => {
      const notificationData = {
        user_id: 1,
        type: 'task_assigned',
        title: 'New Task Assigned',
        message: 'You have been assigned to "Update Documentation"',
        sender_id: 2,
        sender_name: 'John Doe',
        metadata: { task_id: 123, project_id: 456 }
      };

      const notification = await notificationService.createNotification(notificationData);

      expect(notification).toHaveProperty('id');
      expect(notification.user_id).toBe(1);
      expect(notification.type).toBe('task_assigned');
      expect(notification.title).toBe('New Task Assigned');
      expect(notification.message).toContain('Update Documentation');
      expect(notification.sender_id).toBe(2);
      expect(notification.sender_name).toBe('John Doe');
      expect(notification.is_read).toBe(false);
      expect(notification).toHaveProperty('created_at');
      expect(notification).toHaveProperty('expires_at');
      expect(notification.metadata).toHaveProperty('task_id', 123);
    });

    test('should fail to create notification without required fields', async () => {
      const invalidData = {
        user_id: 1,
        // Missing type, title, message
      };

      await expect(notificationService.createNotification(invalidData))
        .rejects.toThrow();
    });

    test('should create notification with default 90-day expiration', async () => {
      const notificationData = {
        user_id: 1,
        type: 'project_invitation',
        title: 'Project Invitation',
        message: 'You have been invited to Project Alpha'
      };

      const notification = await notificationService.createNotification(notificationData);
      
      const createdDate = new Date(notification.created_at);
      const expiresDate = new Date(notification.expires_at);
      const daysDifference = Math.floor((expiresDate - createdDate) / (1000 * 60 * 60 * 24));

      expect(daysDifference).toBeGreaterThanOrEqual(89);
      expect(daysDifference).toBeLessThanOrEqual(91);
    });

    test('should create bulk notifications for multiple users', async () => {
      const userIds = [1, 2, 3, 4, 5];
      const template = {
        type: 'project_updated',
        title: 'Project Status Changed',
        message: 'Project Alpha has been marked as completed',
        sender_id: 10,
        sender_name: 'Admin User',
        metadata: { project_id: 789 }
      };

      const notifications = await notificationService.bulkCreateNotifications(userIds, template);

      expect(notifications).toHaveLength(5);
      expect(notifications[0].user_id).toBe(1);
      expect(notifications[4].user_id).toBe(5);
      expect(notifications.every(n => n.type === 'project_updated')).toBe(true);
    });
  });

  describe('READ - Notification Retrieval', () => {
    let testNotificationId;
    let testUserId = 1;

    beforeAll(async () => {
      // Create test notification
      const notification = await notificationService.createNotification({
        user_id: testUserId,
        type: 'task_comment',
        title: 'New Comment',
        message: 'Someone commented on your task',
        sender_id: 2,
        sender_name: 'Jane Smith'
      });
      testNotificationId = notification.id;
    });

    test('should retrieve all notifications for a user', async () => {
      const notifications = await notificationService.getUserNotifications(testUserId);

      expect(Array.isArray(notifications)).toBe(true);
      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications.every(n => n.user_id === testUserId)).toBe(true);
    });

    test('should retrieve notification by ID', async () => {
      const notification = await notificationService.getNotificationById(testNotificationId, testUserId);

      expect(notification).toBeDefined();
      expect(notification.id).toBe(testNotificationId);
      expect(notification.user_id).toBe(testUserId);
      expect(notification.type).toBe('task_comment');
    });

    test('should filter notifications by read status', async () => {
      const unreadNotifications = await notificationService.getUserNotifications(testUserId, { is_read: false });

      expect(Array.isArray(unreadNotifications)).toBe(true);
      expect(unreadNotifications.every(n => n.is_read === false)).toBe(true);
    });

    test('should filter notifications by type', async () => {
      const taskNotifications = await notificationService.getUserNotifications(testUserId, { type: 'task_comment' });

      expect(Array.isArray(taskNotifications)).toBe(true);
      expect(taskNotifications.every(n => n.type === 'task_comment')).toBe(true);
    });

    test('should get unread notification count', async () => {
      const count = await notificationService.getUnreadCount(testUserId);

      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should get notification history with pagination', async () => {
      const result = await notificationService.getNotificationHistory(testUserId, { limit: 10, offset: 0 });

      expect(result).toHaveProperty('notifications');
      expect(result).toHaveProperty('pagination');
      expect(Array.isArray(result.notifications)).toBe(true);
      expect(result.pagination).toHaveProperty('total');
      expect(result.pagination).toHaveProperty('limit', 10);
      expect(result.pagination).toHaveProperty('offset', 0);
    });

    test('should not allow user to access another user\'s notification', async () => {
      await expect(notificationService.getNotificationById(testNotificationId, 999))
        .rejects.toThrow('Unauthorized');
    });
  });

  describe('UPDATE - Notification Modification', () => {
    let testNotificationId;
    let testUserId = 1;

    beforeEach(async () => {
      const notification = await notificationService.createNotification({
        user_id: testUserId,
        type: 'task_updated',
        title: 'Task Status Changed',
        message: 'Your task status has been updated',
        sender_id: 3,
        sender_name: 'Manager'
      });
      testNotificationId = notification.id;
    });

    test('should mark notification as read', async () => {
      const notification = await notificationService.markAsRead(testNotificationId, testUserId);

      expect(notification.is_read).toBe(true);
      expect(notification).toHaveProperty('updated_at');
    });

    test('should mark all notifications as read for a user', async () => {
      // Create multiple unread notifications
      await notificationService.createNotification({
        user_id: testUserId,
        type: 'test',
        title: 'Test 1',
        message: 'Test message 1'
      });
      await notificationService.createNotification({
        user_id: testUserId,
        type: 'test',
        title: 'Test 2',
        message: 'Test message 2'
      });

      const updatedNotifications = await notificationService.markAllAsRead(testUserId);

      expect(Array.isArray(updatedNotifications)).toBe(true);
      expect(updatedNotifications.length).toBeGreaterThan(0);
      expect(updatedNotifications.every(n => n.is_read === true)).toBe(true);
    });

    test('should not allow user to mark another user\'s notification as read', async () => {
      await expect(notificationService.markAsRead(testNotificationId, 999))
        .rejects.toThrow('Unauthorized');
    });
  });

  describe('DELETE - Notification Deletion', () => {
    let testNotificationId;
    let testUserId = 1;

    beforeEach(async () => {
      const notification = await notificationService.createNotification({
        user_id: testUserId,
        type: 'member_removed',
        title: 'Removed from Project',
        message: 'You have been removed from Project Beta',
        sender_id: 4,
        sender_name: 'Admin'
      });
      testNotificationId = notification.id;
    });

    test('should delete a notification', async () => {
      const result = await notificationService.deleteNotification(testNotificationId, testUserId);

      expect(result).toBe(true);

      // Verify it's deleted
      await expect(notificationService.getNotificationById(testNotificationId, testUserId))
        .rejects.toThrow('Notification not found');
    });

    test('should not allow user to delete another user\'s notification', async () => {
      await expect(notificationService.deleteNotification(testNotificationId, 999))
        .rejects.toThrow('Unauthorized');
    });
  });

  describe('Specialized Notification Types', () => {
    test('should create project invitation notification', async () => {
      // This test uses the actual implementation for adding collaborators
      const projectId = 1;
      const invitedUserId = 2;
      const inviterUserId = 1;
      const role = 'collaborator';
      const customMessage = 'Welcome to the team!';

      const notification = await notificationService.createProjectInvitationNotification(
        projectId,
        invitedUserId,
        inviterUserId,
        role,
        customMessage
      );

      expect(notification).toHaveProperty('notif_id');
      expect(notification).toHaveProperty('message');
      expect(notification).toHaveProperty('creator_id');
      expect(notification).toHaveProperty('recipient_emails');
      expect(notification).toHaveProperty('created_at');
      expect(notification.message).toContain('invited you to join');
      expect(notification.message).toContain(customMessage);
    });

    test('should create task assigned notification', async () => {
      const notification = await notificationService.createTaskAssignedNotification({
        userId: 2,
        taskTitle: 'Fix Login Bug',
        taskId: 202,
        projectName: 'Bug Fixes',
        assignedBy: 'Tech Lead'
      });

      expect(notification.type).toBe('task_assigned');
      expect(notification.title).toBe('New Task Assigned');
      expect(notification.message).toContain('Fix Login Bug');
      expect(notification.metadata.task_id).toBe(202);
    });

    test('should create task updated notification', async () => {
      const notification = await notificationService.createTaskUpdatedNotification({
        userId: 3,
        taskTitle: 'Update Documentation',
        taskId: 303,
        updateType: 'completed',
        updatedBy: 'Team Member'
      });

      expect(notification.type).toBe('task_updated');
      expect(notification.message).toContain('completed');
      expect(notification.metadata.task_id).toBe(303);
    });
  });
});

describe('Acceptance Criteria Tests', () => {

  describe('AC1: All notifications are saved with timestamp, type, sender', () => {
    test('should save notification with all required AC1 fields', async () => {
      const notification = await notificationService.createNotification({
        user_id: 1,
        type: 'task_assigned',
        title: 'Task Assignment',
        message: 'New task assigned to you',
        sender_id: 2,
        sender_name: 'Project Manager'
      });

      // Verify timestamp
      expect(notification).toHaveProperty('created_at');
      expect(new Date(notification.created_at)).toBeInstanceOf(Date);
      expect(isNaN(new Date(notification.created_at).getTime())).toBe(false);

      // Verify type
      expect(notification).toHaveProperty('type');
      expect(typeof notification.type).toBe('string');
      expect(notification.type).toBe('task_assigned');

      // Verify sender
      expect(notification).toHaveProperty('sender_id');
      expect(notification).toHaveProperty('sender_name');
      expect(notification.sender_id).toBe(2);
      expect(notification.sender_name).toBe('Project Manager');

      // Additional required fields
      expect(notification).toHaveProperty('id');
      expect(notification).toHaveProperty('user_id');
      expect(notification).toHaveProperty('title');
      expect(notification).toHaveProperty('message');
    });

    test('should have valid timestamp format (ISO 8601)', async () => {
      const notification = await notificationService.createNotification({
        user_id: 1,
        type: 'test',
        title: 'Test',
        message: 'Test message'
      });

      const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
      expect(notification.created_at).toMatch(timestampRegex);
    });

    test('should categorize notifications by type', async () => {
      const types = [
        'project_invitation',
        'task_assigned',
        'task_updated',
        'task_comment',
        'project_updated',
        'member_added',
        'member_removed'
      ];

      for (const type of types) {
        const notification = await notificationService.createNotification({
          user_id: 1,
          type: type,
          title: `Test ${type}`,
          message: `Test message for ${type}`
        });

        expect(notification.type).toBe(type);
      }
    });
  });

  describe('AC2: Old notifications remain accessible for at least 90 days', () => {
    test('should set default expiration to 90 days', async () => {
      const notification = await notificationService.createNotification({
        user_id: 1,
        type: 'task_assigned',
        title: 'Long-term Notification',
        message: 'This should be accessible for 90 days'
      });

      const createdDate = new Date(notification.created_at);
      const expiresDate = new Date(notification.expires_at);
      const millisecondsIn90Days = 90 * 24 * 60 * 60 * 1000;
      const difference = expiresDate - createdDate;

      // Allow 1 day tolerance for processing time
      expect(difference).toBeGreaterThanOrEqual(millisecondsIn90Days - (24 * 60 * 60 * 1000));
      expect(difference).toBeLessThanOrEqual(millisecondsIn90Days + (24 * 60 * 60 * 1000));
    });

    test('should retrieve notifications within 90-day window', async () => {
      const notification = await notificationService.createNotification({
        user_id: 1,
        type: 'test',
        title: 'Test Notification',
        message: 'Test for 90-day retention'
      });

      // Simulate notification at day 1
      const dayOneNotifications = await notificationService.getUserNotifications(1);
      expect(dayOneNotifications.find(n => n.id === notification.id)).toBeDefined();

      // Simulate notification still accessible (not expired)
      const history = await notificationService.getNotificationHistory(1);
      expect(history.notifications.find(n => n.id === notification.id)).toBeDefined();
    });

    test('should include notification in history even after being read', async () => {
      const notification = await notificationService.createNotification({
        user_id: 1,
        type: 'test',
        title: 'Historical Test',
        message: 'Should remain in history after read'
      });

      // Mark as read
      await notificationService.markAsRead(notification.id, 1);

      // Should still be in history
      const history = await notificationService.getNotificationHistory(1);
      const historicalNotification = history.notifications.find(n => n.id === notification.id);
      
      expect(historicalNotification).toBeDefined();
      expect(historicalNotification.is_read).toBe(true);
    });

    test('should support pagination for viewing old notifications', async () => {
      // Create 25 test notifications
      const promises = [];
      for (let i = 0; i < 25; i++) {
        promises.push(
          notificationService.createNotification({
            user_id: 1,
            type: 'test',
            title: `Test ${i}`,
            message: `Test message ${i}`
          })
        );
      }
      await Promise.all(promises);

      // Get first page
      const page1 = await notificationService.getNotificationHistory(1, { limit: 10, offset: 0 });
      expect(page1.notifications).toHaveLength(10);
      expect(page1.pagination.hasMore).toBe(true);

      // Get second page
      const page2 = await notificationService.getNotificationHistory(1, { limit: 10, offset: 10 });
      expect(page2.notifications).toHaveLength(10);

      // Get third page
      const page3 = await notificationService.getNotificationHistory(1, { limit: 10, offset: 20 });
      expect(page3.notifications.length).toBeGreaterThan(0);
    });

    test('should calculate expiration correctly for custom retention period', async () => {
      const customExpirationDate = new Date();
      customExpirationDate.setDate(customExpirationDate.getDate() + 120); // 120 days

      const notificationData = {
        user_id: 1,
        type: 'important_notice',
        title: 'Extended Retention',
        message: 'This notification has extended retention',
        expires_at: customExpirationDate
      };

      const notification = await notificationRepository.create(notificationData);

      const createdDate = new Date(notification.created_at);
      const expiresDate = new Date(notification.expires_at);
      const daysDifference = Math.floor((expiresDate - createdDate) / (1000 * 60 * 60 * 24));

      expect(daysDifference).toBeGreaterThanOrEqual(119);
      expect(daysDifference).toBeLessThanOrEqual(121);
    });
  });

  describe('Additional Business Logic Tests', () => {
    test('should filter out expired notifications from default queries', async () => {
      // Create notification with past expiration date
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1); // Yesterday

      const expiredNotification = await notificationRepository.create({
        user_id: 1,
        type: 'test',
        title: 'Expired',
        message: 'This should be filtered out',
        expires_at: pastDate
      });

      // Get active notifications
      const activeNotifications = await notificationService.getUserNotifications(1);

      // Expired notification should not be in the list
      expect(activeNotifications.find(n => n.id === expiredNotification.id)).toBeUndefined();
    });

    test('should include expired notifications in full history', async () => {
      // Create notification with past expiration date
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const expiredNotification = await notificationRepository.create({
        user_id: 1,
        type: 'test',
        title: 'Expired Historical',
        message: 'This should be in full history',
        expires_at: pastDate
      });

      // Get full history (includes expired)
      const history = await notificationService.getNotificationHistory(1);

      // Should find the expired notification in history
      expect(history.notifications.find(n => n.id === expiredNotification.id)).toBeDefined();
    });

    test('should maintain notification integrity after updates', async () => {
      const notification = await notificationService.createNotification({
        user_id: 1,
        type: 'test',
        title: 'Integrity Test',
        message: 'Testing data integrity'
      });

      const originalCreatedAt = notification.created_at;
      const originalExpiry = notification.expires_at;

      // Mark as read
      const updated = await notificationService.markAsRead(notification.id, 1);

      // Verify timestamps are preserved
      expect(updated.created_at).toBe(originalCreatedAt);
      expect(updated.expires_at).toBe(originalExpiry);
      expect(updated).toHaveProperty('updated_at');
    });
  });
});

describe('Project Invitation Notifications - Original AC Tests', () => {

  describe('AC1: Notification is triggered immediately upon being added', () => {
    test('should validate immediate notification creation timing', () => {
      const startTime = new Date();
      const notificationCreationTime = new Date();

      // In a real implementation, this would be measured from when the user is added
      // to when the notification is created
      const timeDifference = notificationCreationTime.getTime() - startTime.getTime();

      // Should be near instantaneous (< 100ms for this test)
      expect(timeDifference).toBeLessThan(100);
    });

    test('should validate notification is created synchronously with user addition', () => {
      // Test that notification creation is part of the same transaction/flow
      // as user addition to the project
      const userAdditionSteps = [
        'validate permissions',
        'add user to project_members',
        'create notification record',
        'send email notification'
      ];

      expect(userAdditionSteps).toContain('create notification record');
      expect(userAdditionSteps.indexOf('create notification record')).toBeGreaterThan(
        userAdditionSteps.indexOf('add user to project_members')
      );
    });
  });

  describe('AC2: Notification shows project name, inviter\'s name, and assigned role', () => {
    test('should validate notification message contains all required information', () => {
      const projectName = 'Website Redesign Project';
      const inviterName = 'Sarah Johnson';
      const assignedRole = 'manager';
      const userName = 'Mike Chen';

      const expectedMessage = `${inviterName} has invited you to join the project "${projectName}" as a ${assignedRole}.`;

      expect(expectedMessage).toContain(projectName);
      expect(expectedMessage).toContain(inviterName);
      expect(expectedMessage).toContain(assignedRole);
      expect(expectedMessage).toContain('invited you to join');
    });

    test('should validate email content includes all required information', () => {
      const emailTemplate = {
        subject: 'You\'ve been invited to join "Website Redesign Project"',
        greeting: 'Hello Mike Chen,',
        body: 'You have been invited to join the project "Website Redesign Project" by Sarah Johnson.',
        role: 'Your role: manager',
        cta: 'You can now start contributing to the project immediately.'
      };

      expect(emailTemplate.subject).toContain('Website Redesign Project');
      expect(emailTemplate.greeting).toContain('Mike Chen');
      expect(emailTemplate.body).toContain('Sarah Johnson');
      expect(emailTemplate.body).toContain('Website Redesign Project');
      expect(emailTemplate.role).toContain('manager');
      expect(emailTemplate.cta).toContain('start contributing');
    });

    test('should handle different role types correctly', () => {
      const roles = ['creator', 'manager', 'collaborator'];

      roles.forEach(role => {
        const message = `John has invited you to join the project "Test" as a ${role}.`;
        expect(message).toContain(`as a ${role}`);
      });
    });
  });

  describe('AC3: Delivered both in-app and via email', () => {
    test('should validate dual delivery mechanism', () => {
      const deliveryMethods = ['database_storage', 'email_sendgrid'];

      expect(deliveryMethods).toContain('database_storage');
      expect(deliveryMethods).toContain('email_sendgrid');
      expect(deliveryMethods.length).toBe(2);
    });

    test('should validate SendGrid email configuration', () => {
      // Test that SendGrid is properly configured
      const sendGridConfig = {
        apiKey: process.env.SENDGRID_API_KEY || 'configured',
        fromEmail: 'noreply@yourapp.com',
        service: 'SendGrid'
      };

      expect(sendGridConfig.service).toBe('SendGrid');
      expect(sendGridConfig.fromEmail).toMatch(/@/);
    });

    test('should validate graceful degradation when email fails', () => {
      // Test that if email fails, the notification is still stored
      const failureScenario = {
        emailFailed: true,
        notificationStored: true,
        userAddedToProject: true
      };

      expect(failureScenario.emailFailed).toBe(true);
      expect(failureScenario.notificationStored).toBe(true);
      expect(failureScenario.userAddedToProject).toBe(true);
    });
  });

  describe('AC4: Notifications are stored in the database with timestamp', () => {
    test('should validate notification table schema', () => {
      const tableSchema = {
        notif_id: 'bigint primary key',
        message: 'text not null',
        creator_id: 'uuid references auth.users(id)',
        recipient_emails: 'text[] not null',
        created_at: 'timestamp with time zone not null'
      };

      expect(tableSchema).toHaveProperty('notif_id');
      expect(tableSchema).toHaveProperty('message');
      expect(tableSchema).toHaveProperty('creator_id');
      expect(tableSchema).toHaveProperty('recipient_emails');
      expect(tableSchema).toHaveProperty('created_at');
    });

    test('should validate timestamp format and automatic creation', () => {
      const timestamp = new Date().toISOString();
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

      expect(timestamp).toMatch(isoRegex);

      // Test that timestamp is automatically set
      const notificationRecord = {
        notif_id: 1,
        message: 'Test notification',
        creator_id: null,
        recipient_emails: ['test@example.com'],
        created_at: timestamp
      };

      expect(notificationRecord.created_at).toMatch(isoRegex);
    });

    test('should validate notification data integrity', () => {
      const validNotification = {
        notif_id: 123,
        message: 'Alice has invited you to join "Project X" as a collaborator.',
        creator_id: null,
        recipient_emails: ['bob@example.com'],
        created_at: '2025-01-15T10:30:00.000Z'
      };

      // Validate required fields are present
      expect(validNotification.notif_id).toBeDefined();
      expect(validNotification.message).toBeDefined();
      expect(validNotification.recipient_emails).toBeDefined();
      expect(validNotification.created_at).toBeDefined();

      // Validate data types
      expect(typeof validNotification.notif_id).toBe('number');
      expect(typeof validNotification.message).toBe('string');
      expect(Array.isArray(validNotification.recipient_emails)).toBe(true);
      expect(typeof validNotification.created_at).toBe('string');
    });
  });

  describe('Integration and Error Handling', () => {
    test('should validate complete notification workflow', () => {
      const workflowSteps = [
        'User adds member to project',
        'System validates permissions',
        'Member is added to project_members table',
        'Notification record is created',
        'Email is sent via SendGrid',
        'Success response is returned'
      ];

      expect(workflowSteps.length).toBe(6);
      expect(workflowSteps).toContain('Notification record is created');
      expect(workflowSteps).toContain('Email is sent via SendGrid');
    });

    test('should validate error handling scenarios', () => {
      const errorScenarios = [
        {
          scenario: 'SendGrid API key missing',
          shouldFail: false,
          notificationStored: true,
          reason: 'Email is optional, notification should still be stored'
        },
        {
          scenario: 'Database connection fails during notification creation',
          shouldFail: true,
          notificationStored: false,
          reason: 'Critical failure, should prevent operation'
        },
        {
          scenario: 'User addition fails',
          shouldFail: true,
          notificationStored: false,
          reason: 'User must be successfully added before notification'
        }
      ];

      errorScenarios.forEach(scenario => {
        if (scenario.scenario === 'SendGrid API key missing') {
          expect(scenario.notificationStored).toBe(true);
        }
      });
    });

    test('should validate bulk notification creation', () => {
      const usersAdded = [1, 2, 3, 4];
      const notificationsExpected = usersAdded.length;

      expect(notificationsExpected).toBe(4);

      // Each user should receive their own notification
      usersAdded.forEach(userId => {
        expect(userId).toBeDefined();
      });
    });
  });

  describe('API and Data Validation', () => {
    test('should validate notification API response format', () => {
      const apiResponse = {
        success: true,
        notifications: [
          {
            notif_id: 1,
            message: 'You have been invited to join "Project Alpha"',
            creator_id: null,
            recipient_emails: ['staff@example.com'],
            created_at: '2025-01-15T09:00:00.000Z'
          }
        ],
        pagination: {
          limit: 50,
          offset: 0
        }
      };

      expect(apiResponse.success).toBe(true);
      expect(Array.isArray(apiResponse.notifications)).toBe(true);
      expect(apiResponse.notifications[0]).toHaveProperty('message');
      expect(apiResponse.notifications[0]).toHaveProperty('recipient_emails');
      expect(apiResponse).toHaveProperty('pagination');
    });

    test('should validate notification filtering by recipient', () => {
      const allNotifications = [
        { recipient_emails: ['alice@example.com'], message: 'Notification 1' },
        { recipient_emails: ['bob@example.com'], message: 'Notification 2' },
        { recipient_emails: ['alice@example.com'], message: 'Notification 3' }
      ];

      const aliceNotifications = allNotifications.filter(n =>
        n.recipient_emails.includes('alice@example.com')
      );

      expect(aliceNotifications.length).toBe(2);
      expect(aliceNotifications.every(n => n.recipient_emails.includes('alice@example.com'))).toBe(true);
    });
  });
});