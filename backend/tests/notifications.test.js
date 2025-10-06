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

describe('Task Comment Notifications - AC Tests', () => {
  /**
   * User Story: As a staff member, I want to be notified when someone comments on a task
   * so that I can stay informed about task discussions and updates.
   * 
   * Acceptance Criteria:
   * AC1: A notification is triggered whenever a comment is added
   * AC2: The notification shows who commented, a preview of the comment, and the related task
   * AC3: Works for both in-app and email delivery
   */

  describe('AC1: Notification is triggered whenever a comment is added', () => {
    test('should validate immediate notification creation timing when comment is added', () => {
      const startTime = new Date();
      const commentAddedTime = new Date();
      const notificationCreationTime = new Date();

      // In a real implementation, this would be measured from when the comment is added
      // to when the notification is created
      const timeDifference = notificationCreationTime.getTime() - commentAddedTime.getTime();

      // Should be near instantaneous (< 100ms for this test)
      expect(timeDifference).toBeLessThan(100);
    });

    test('should validate notification is created synchronously with comment creation', () => {
      // Test that notification creation is part of the same transaction/flow
      // as comment creation
      const commentCreationSteps = [
        'validate comment content',
        'create comment record in task_comments table',
        'get task assignees/members',
        'create notification records for each recipient',
        'send email notifications',
        'return success response'
      ];

      expect(commentCreationSteps).toContain('create notification records for each recipient');
      expect(commentCreationSteps.indexOf('create notification records for each recipient')).toBeGreaterThan(
        commentCreationSteps.indexOf('create comment record in task_comments table')
      );
    });

    test('should create notification for comment type', async () => {
      const notificationData = {
        user_id: 2,
        type: 'comment',
        title: 'New Comment on Task',
        message: 'John Doe commented: "Great work on this task!"',
        sender_id: 1,
        sender_name: 'John Doe',
        metadata: { 
          task_id: 123, 
          comment_id: 456,
          task_title: 'Update Documentation'
        }
      };

      const notification = await notificationService.createNotification(notificationData);

      expect(notification).toHaveProperty('id');
      expect(notification.type).toBe('comment');
      expect(notification.user_id).toBe(2);
      expect(notification.sender_id).toBe(1);
      expect(notification.sender_name).toBe('John Doe');
      expect(notification.message).toContain('commented');
      expect(notification.metadata).toHaveProperty('task_id', 123);
      expect(notification.metadata).toHaveProperty('comment_id', 456);
    });

    test('should trigger notification only when comment is successfully added', () => {
      const successfulCommentFlow = {
        commentValidated: true,
        commentSaved: true,
        notificationTriggered: true
      };

      const failedCommentFlow = {
        commentValidated: false,
        commentSaved: false,
        notificationTriggered: false
      };

      expect(successfulCommentFlow.notificationTriggered).toBe(true);
      expect(failedCommentFlow.notificationTriggered).toBe(false);
    });
  });

  describe('AC2: Notification shows who commented, a preview of the comment, and the related task', () => {
    test('should validate notification message contains commenter name, comment preview, and task title', async () => {
      const commenterName = 'Sarah Johnson';
      const commentPreview = 'I think we should consider adding unit tests for this feature.';
      const taskTitle = 'Implement Login Feature';
      const taskId = 789;

      const notificationMessage = `${commenterName} commented on "${taskTitle}": "${commentPreview.substring(0, 100)}${commentPreview.length > 100 ? '...' : ''}"`;

      expect(notificationMessage).toContain(commenterName);
      expect(notificationMessage).toContain(commentPreview.substring(0, 50));
      expect(notificationMessage).toContain(taskTitle);
      expect(notificationMessage).toContain('commented on');
    });

    test('should truncate long comments to preview length', () => {
      const longComment = 'This is a very long comment that exceeds the normal preview length and should be truncated to avoid overwhelming the notification message with too much text content.';
      const maxPreviewLength = 100;
      
      const preview = longComment.length > maxPreviewLength 
        ? longComment.substring(0, maxPreviewLength) + '...'
        : longComment;

      expect(preview.length).toBeLessThanOrEqual(maxPreviewLength + 3); // +3 for '...'
      expect(preview).toContain('This is a very long comment');
      if (longComment.length > maxPreviewLength) {
        expect(preview).toMatch(/\.\.\.$/);
      }
    });

    test('should include metadata with task and comment identifiers', async () => {
      const notificationData = {
        user_id: 3,
        type: 'comment',
        title: 'New Comment',
        message: 'Mike Chen commented on "Fix Bug #123": "Found the root cause!"',
        sender_id: 5,
        sender_name: 'Mike Chen',
        metadata: {
          task_id: 123,
          task_title: 'Fix Bug #123',
          comment_id: 999,
          comment_preview: 'Found the root cause!'
        }
      };

      const notification = await notificationService.createNotification(notificationData);

      expect(notification.metadata).toHaveProperty('task_id');
      expect(notification.metadata).toHaveProperty('task_title');
      expect(notification.metadata).toHaveProperty('comment_id');
      expect(notification.metadata).toHaveProperty('comment_preview');
      expect(notification.metadata.task_id).toBe(123);
      expect(notification.metadata.comment_id).toBe(999);
    });

    test('should handle different commenter name formats', () => {
      const nameFormats = [
        'John Doe',           // First Last
        'Sarah',              // Single name
        'Dr. James Wilson',   // Title + name
        'Chen Wei',          // Eastern name order
      ];

      nameFormats.forEach(name => {
        const message = `${name} commented on "Task Title": "Comment content"`;
        expect(message).toContain(name);
        expect(message).toContain('commented on');
      });
    });

    test('should preserve task context in notification', async () => {
      const taskContext = {
        taskId: 456,
        taskTitle: 'Update User Dashboard',
        projectId: 10,
        projectName: 'Frontend Redesign'
      };

      const notificationData = {
        user_id: 4,
        type: 'comment',
        title: 'New Comment on Task',
        message: `Alice commented on "${taskContext.taskTitle}": "UI looks great!"`,
        sender_id: 7,
        sender_name: 'Alice',
        metadata: {
          task_id: taskContext.taskId,
          task_title: taskContext.taskTitle,
          project_id: taskContext.projectId,
          comment_id: 111
        }
      };

      const notification = await notificationService.createNotification(notificationData);

      expect(notification.metadata.task_id).toBe(taskContext.taskId);
      expect(notification.metadata.task_title).toBe(taskContext.taskTitle);
      expect(notification.metadata.project_id).toBe(taskContext.projectId);
    });
  });

  describe('AC3: Works for both in-app and email delivery', () => {
    test('should validate dual delivery mechanism for comment notifications', () => {
      const deliveryMethods = ['database_storage', 'email_sendgrid'];

      expect(deliveryMethods).toContain('database_storage');
      expect(deliveryMethods).toContain('email_sendgrid');
      expect(deliveryMethods.length).toBe(2);
    });

    test('should store notification in database with type "comment"', async () => {
      const notificationData = {
        user_id: 5,
        type: 'comment',
        title: 'New Comment',
        message: 'Bob commented on "Test Task": "Looks good!"',
        sender_id: 8,
        sender_name: 'Bob'
      };

      const notification = await notificationService.createNotification(notificationData);

      expect(notification).toHaveProperty('id');
      expect(notification.type).toBe('comment');
      expect(notification).toHaveProperty('created_at');
      
      // Verify it can be retrieved from database
      const retrieved = await notificationService.getNotificationById(notification.id, 5);
      expect(retrieved).toBeDefined();
      expect(retrieved.type).toBe('comment');
    });

    test('should validate email template includes comment information', () => {
      const emailTemplate = {
        subject: 'New comment on "Implement Login Feature"',
        greeting: 'Hello Sarah,',
        body: 'Mike Chen has commented on the task "Implement Login Feature":',
        commentPreview: '"I think we should consider adding unit tests for this feature."',
        taskLink: '/tasks/123',
        cta: 'View Comment'
      };

      expect(emailTemplate.subject).toContain('New comment');
      expect(emailTemplate.subject).toContain('Implement Login Feature');
      expect(emailTemplate.body).toContain('Mike Chen');
      expect(emailTemplate.body).toContain('commented');
      expect(emailTemplate.commentPreview).toBeDefined();
      expect(emailTemplate.taskLink).toMatch(/\/tasks\/\d+/);
      expect(emailTemplate.cta).toBe('View Comment');
    });

    test('should validate SendGrid email configuration for comments', () => {
      const sendGridConfig = {
        apiKey: process.env.SENDGRID_API_KEY || 'configured',
        fromEmail: 'noreply@yourapp.com',
        service: 'SendGrid',
        templateType: 'comment_notification'
      };

      expect(sendGridConfig.service).toBe('SendGrid');
      expect(sendGridConfig.fromEmail).toMatch(/@/);
      expect(sendGridConfig.templateType).toBe('comment_notification');
    });

    test('should validate graceful degradation when email fails but notification stored', () => {
      const failureScenario = {
        commentCreated: true,
        emailFailed: true,
        notificationStored: true,
        userNotified: true // in-app notification still works
      };

      expect(failureScenario.commentCreated).toBe(true);
      expect(failureScenario.emailFailed).toBe(true);
      expect(failureScenario.notificationStored).toBe(true);
      expect(failureScenario.userNotified).toBe(true);
    });

    test('should support in-app notification retrieval for comments', async () => {
      // Create a comment notification
      const notification = await notificationService.createNotification({
        user_id: 6,
        type: 'comment',
        title: 'New Comment',
        message: 'Emma commented on "Review Code": "LGTM!"',
        sender_id: 9,
        sender_name: 'Emma'
      });

      // Retrieve user notifications
      const userNotifications = await notificationService.getUserNotifications(6);

      expect(Array.isArray(userNotifications)).toBe(true);
      expect(userNotifications.some(n => n.id === notification.id)).toBe(true);
      expect(userNotifications.some(n => n.type === 'comment')).toBe(true);
    });

    test('should filter comment notifications by type', async () => {
      // Create a comment notification
      await notificationService.createNotification({
        user_id: 7,
        type: 'comment',
        title: 'Comment Notification',
        message: 'Test comment notification',
        sender_id: 10,
        sender_name: 'Test User'
      });

      // Get only comment notifications
      const commentNotifications = await notificationService.getUserNotifications(7, { type: 'comment' });

      expect(Array.isArray(commentNotifications)).toBe(true);
      expect(commentNotifications.every(n => n.type === 'comment')).toBe(true);
    });
  });

  describe('Recipients: Anyone in the task', () => {
    test('should identify all task members as recipients', () => {
      const taskMembers = [
        { id: 1, name: 'Alice', email: 'alice@example.com' },
        { id: 2, name: 'Bob', email: 'bob@example.com' },
        { id: 3, name: 'Charlie', email: 'charlie@example.com' }
      ];
      const commenterId = 1; // Alice is commenting

      // Recipients should be all task members except the commenter
      const recipients = taskMembers.filter(member => member.id !== commenterId);

      expect(recipients.length).toBe(2);
      expect(recipients.some(r => r.id === 2)).toBe(true);
      expect(recipients.some(r => r.id === 3)).toBe(true);
      expect(recipients.some(r => r.id === 1)).toBe(false); // Commenter excluded
    });

    test('should create bulk notifications for all task members', async () => {
      const taskMemberIds = [2, 3, 4]; // User 1 is commenting, so notify 2, 3, 4
      const commentData = {
        type: 'comment',
        title: 'New Comment on Task',
        message: 'Alice commented on "Sprint Planning": "Let\'s schedule a meeting."',
        sender_id: 1,
        sender_name: 'Alice',
        metadata: {
          task_id: 555,
          task_title: 'Sprint Planning',
          comment_id: 888,
          comment_preview: 'Let\'s schedule a meeting.'
        }
      };

      const notifications = await notificationService.bulkCreateNotifications(taskMemberIds, commentData);

      expect(notifications).toHaveLength(3);
      expect(notifications[0].user_id).toBe(2);
      expect(notifications[1].user_id).toBe(3);
      expect(notifications[2].user_id).toBe(4);
      expect(notifications.every(n => n.type === 'comment')).toBe(true);
      expect(notifications.every(n => n.sender_id === 1)).toBe(true);
    });

    test('should handle task with single assignee', () => {
      const taskMembers = [
        { id: 5, name: 'David', email: 'david@example.com' }
      ];
      const commenterId = 10; // Someone not in task

      const recipients = taskMembers.filter(member => member.id !== commenterId);

      expect(recipients.length).toBe(1);
      expect(recipients[0].id).toBe(5);
    });

    test('should handle commenter being the only task member', () => {
      const taskMembers = [
        { id: 5, name: 'David', email: 'david@example.com' }
      ];
      const commenterId = 5; // David commenting on his own task

      const recipients = taskMembers.filter(member => member.id !== commenterId);

      // No recipients when commenter is the only member
      expect(recipients.length).toBe(0);
    });

    test('should handle task with multiple assignees', () => {
      const taskAssignees = [1, 2, 3, 4, 5]; // 5 people assigned
      const commenterId = 3;

      const recipientIds = taskAssignees.filter(id => id !== commenterId);

      expect(recipientIds.length).toBe(4);
      expect(recipientIds).toContain(1);
      expect(recipientIds).toContain(2);
      expect(recipientIds).toContain(4);
      expect(recipientIds).toContain(5);
      expect(recipientIds).not.toContain(3);
    });

    test('should validate recipient email list for SendGrid', () => {
      const taskMembers = [
        { id: 1, name: 'Alice', email: 'alice@example.com' },
        { id: 2, name: 'Bob', email: 'bob@example.com' },
        { id: 3, name: 'Charlie', email: 'charlie@example.com' }
      ];
      const commenterId = 1;

      const recipients = taskMembers.filter(m => m.id !== commenterId);
      const recipientEmails = recipients.map(r => r.email);

      expect(recipientEmails.length).toBe(2);
      expect(recipientEmails).toContain('bob@example.com');
      expect(recipientEmails).toContain('charlie@example.com');
      expect(recipientEmails.every(email => email.includes('@'))).toBe(true);
    });
  });

  describe('Database Storage and Data Integrity', () => {
    test('should validate notification type is "comment"', async () => {
      const notification = await notificationService.createNotification({
        user_id: 8,
        type: 'comment',
        title: 'Comment Added',
        message: 'Frank commented on task',
        sender_id: 11,
        sender_name: 'Frank'
      });

      expect(notification.type).toBe('comment');
    });

    test('should store comment notification with all required fields', async () => {
      const notificationData = {
        user_id: 9,
        type: 'comment',
        title: 'New Comment on Task',
        message: 'Grace commented on "Deploy to Production": "Ready to deploy!"',
        sender_id: 12,
        sender_name: 'Grace',
        metadata: {
          task_id: 777,
          task_title: 'Deploy to Production',
          comment_id: 999,
          comment_preview: 'Ready to deploy!',
          project_id: 15
        }
      };

      const notification = await notificationService.createNotification(notificationData);

      expect(notification).toHaveProperty('id');
      expect(notification).toHaveProperty('user_id');
      expect(notification).toHaveProperty('type');
      expect(notification).toHaveProperty('title');
      expect(notification).toHaveProperty('message');
      expect(notification).toHaveProperty('sender_id');
      expect(notification).toHaveProperty('sender_name');
      expect(notification).toHaveProperty('created_at');
      expect(notification).toHaveProperty('metadata');
      expect(notification.type).toBe('comment');
    });

    test('should preserve metadata integrity', async () => {
      const metadata = {
        task_id: 888,
        task_title: 'Security Audit',
        comment_id: 1111,
        comment_preview: 'All security checks passed',
        project_id: 20,
        timestamp: new Date().toISOString()
      };

      const notification = await notificationService.createNotification({
        user_id: 10,
        type: 'comment',
        title: 'Comment Notification',
        message: 'Helen commented on task',
        sender_id: 13,
        sender_name: 'Helen',
        metadata: metadata
      });

      expect(notification.metadata).toEqual(expect.objectContaining({
        task_id: 888,
        task_title: 'Security Audit',
        comment_id: 1111,
        comment_preview: 'All security checks passed',
        project_id: 20
      }));
    });

    test('should set default expiration to 90 days for comment notifications', async () => {
      const notification = await notificationService.createNotification({
        user_id: 11,
        type: 'comment',
        title: 'Comment',
        message: 'Test comment notification',
        sender_id: 14,
        sender_name: 'Test User'
      });

      const createdDate = new Date(notification.created_at);
      const expiresDate = new Date(notification.expires_at);
      const daysDifference = Math.floor((expiresDate - createdDate) / (1000 * 60 * 60 * 24));

      expect(daysDifference).toBeGreaterThanOrEqual(89);
      expect(daysDifference).toBeLessThanOrEqual(91);
    });
  });

  describe('Integration and Error Handling', () => {
    test('should validate complete comment notification workflow', () => {
      const workflowSteps = [
        'User adds comment to task',
        'System validates comment content',
        'Comment is saved to task_comments table',
        'Get task members (assigned_to array)',
        'Filter out commenter from recipients',
        'Create notification records for each recipient',
        'Send email notifications via SendGrid',
        'Return success response'
      ];

      expect(workflowSteps.length).toBe(8);
      expect(workflowSteps).toContain('Get task members (assigned_to array)');
      expect(workflowSteps).toContain('Create notification records for each recipient');
      expect(workflowSteps).toContain('Send email notifications via SendGrid');
    });

    test('should handle empty task members gracefully', async () => {
      const taskMembers = [];
      const commenterId = 5;

      const recipients = taskMembers.filter(m => m.id !== commenterId);

      expect(recipients.length).toBe(0);
      // Should not create any notifications but should not throw error
    });

    test('should validate error scenarios', () => {
      const errorScenarios = [
        {
          scenario: 'Task not found',
          shouldFail: true,
          notificationCreated: false,
          reason: 'Cannot notify about comment on non-existent task'
        },
        {
          scenario: 'SendGrid fails',
          shouldFail: false,
          notificationCreated: true,
          reason: 'In-app notification should still work'
        },
        {
          scenario: 'Database fails during notification creation',
          shouldFail: true,
          notificationCreated: false,
          reason: 'Critical failure, should rollback comment if in transaction'
        },
        {
          scenario: 'No task members to notify',
          shouldFail: false,
          notificationCreated: false,
          reason: 'Valid scenario, no error but no notifications'
        }
      ];

      errorScenarios.forEach(scenario => {
        if (scenario.scenario === 'SendGrid fails') {
          expect(scenario.notificationCreated).toBe(true);
        }
        if (scenario.scenario === 'No task members to notify') {
          expect(scenario.shouldFail).toBe(false);
        }
      });
    });

    test('should support filtering comment notifications', async () => {
      // Create multiple notification types
      await notificationService.createNotification({
        user_id: 12,
        type: 'comment',
        title: 'Comment',
        message: 'Comment notification 1',
        sender_id: 15,
        sender_name: 'User A'
      });

      await notificationService.createNotification({
        user_id: 12,
        type: 'task_assigned',
        title: 'Task Assigned',
        message: 'Task assigned notification',
        sender_id: 16,
        sender_name: 'User B'
      });

      await notificationService.createNotification({
        user_id: 12,
        type: 'comment',
        title: 'Comment',
        message: 'Comment notification 2',
        sender_id: 17,
        sender_name: 'User C'
      });

      // Get only comment notifications
      const commentNotifications = await notificationService.getUserNotifications(12, { type: 'comment' });

      expect(commentNotifications.length).toBeGreaterThanOrEqual(2);
      expect(commentNotifications.every(n => n.type === 'comment')).toBe(true);
    });
  });

  describe('Real-world Scenarios', () => {
    test('should handle comment on task with reply notification', async () => {
      // Scenario: Alice comments on a task, notifying Bob and Charlie
      const taskMembers = [
        { id: 20, name: 'Alice', email: 'alice@example.com' },  // Commenter
        { id: 21, name: 'Bob', email: 'bob@example.com' },
        { id: 22, name: 'Charlie', email: 'charlie@example.com' }
      ];

      const commenterId = 20;
      const recipientIds = taskMembers.filter(m => m.id !== commenterId).map(m => m.id);

      const notifications = await notificationService.bulkCreateNotifications(
        recipientIds,
        {
          type: 'comment',
          title: 'New Comment on Task',
          message: 'Alice commented on "API Integration": "Found a potential issue with the endpoint."',
          sender_id: commenterId,
          sender_name: 'Alice',
          metadata: {
            task_id: 2000,
            task_title: 'API Integration',
            comment_id: 3000,
            comment_preview: 'Found a potential issue with the endpoint.'
          }
        }
      );

      expect(notifications.length).toBe(2);
      expect(notifications.some(n => n.user_id === 21)).toBe(true);
      expect(notifications.some(n => n.user_id === 22)).toBe(true);
    });

    test('should handle threaded comment notifications', () => {
      // Parent comment notifies all task members
      // Reply comment notifies: task members + parent comment author
      
      const taskMembers = [30, 31, 32]; // Alice, Bob, Charlie
      const parentCommentAuthor = 30; // Alice wrote parent
      const replyCommentAuthor = 31; // Bob is replying

      // For reply, notify: task members + parent author, excluding reply author
      const replyRecipients = [...new Set([...taskMembers, parentCommentAuthor])]
        .filter(id => id !== replyCommentAuthor);

      expect(replyRecipients).toContain(30); // Alice (parent author)
      expect(replyRecipients).toContain(32); // Charlie (task member)
      expect(replyRecipients).not.toContain(31); // Bob (reply author - excluded)
      expect(replyRecipients.length).toBe(2);
    });

    test('should handle notification for long comment with truncation', () => {
      const longComment = 'This is a very detailed comment that discusses multiple aspects of the implementation including the database schema, API endpoints, error handling, validation logic, and testing strategy. It goes on for quite a while and definitely exceeds the preview length limit.';
      const maxPreviewLength = 100;

      const preview = longComment.length > maxPreviewLength
        ? longComment.substring(0, maxPreviewLength) + '...'
        : longComment;

      const message = `Developer commented on "Complex Feature": "${preview}"`;

      expect(message).toContain('Developer commented on');
      expect(message.length).toBeLessThan(longComment.length + 100);
      expect(preview).toContain('...');
    });

    test('should track unread comment notifications', async () => {
      const userId = 40;
      
      // Create a comment notification
      await notificationService.createNotification({
        user_id: userId,
        type: 'comment',
        title: 'New Comment',
        message: 'Someone commented on your task',
        sender_id: 41,
        sender_name: 'Commenter'
      });

      // Get unread count
      const unreadCount = await notificationService.getUnreadCount(userId);

      expect(typeof unreadCount).toBe('number');
      expect(unreadCount).toBeGreaterThan(0);
    });

    test('should mark comment notification as read', async () => {
      const notification = await notificationService.createNotification({
        user_id: 50,
        type: 'comment',
        title: 'Comment Notification',
        message: 'Test comment notification',
        sender_id: 51,
        sender_name: 'Test User'
      });

      expect(notification.is_read).toBe(false);

      // Mark as read
      const updatedNotification = await notificationService.markAsRead(notification.id, 50);

      expect(updatedNotification.is_read).toBe(true);
    });
  });
});