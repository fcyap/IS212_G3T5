/**
 * Test Suite for Task Deletion Notification Feature
 * User Story: As a staff, I want to be notified when a task is deleted 
 * so that I can understand changes in team workload.
 * 
 * Acceptance Criteria:
 * 1. A notification is sent to task assignees whenever a task is deleted
 * 2. The notification shows all details of the task
 * 3. Delivered both in-app and via email
 * 4. Notification is stored in the database with timestamp and dismissed status
 */

jest.mock('../../src/repository/notificationRepository', () => ({
  create: jest.fn()
}));

jest.mock('../../src/repository/userRepository', () => ({
  getUserById: jest.fn(),
  getUsersByIds: jest.fn()
}));

jest.mock('../../src/repository/taskRepository', () => ({
  getTaskById: jest.fn()
}));

jest.mock('../../src/repository/projectRepository', () => ({
  getProjectById: jest.fn()
}));

jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn()
}));

const notificationRepository = require('../../src/repository/notificationRepository');
const userRepository = require('../../src/repository/userRepository');
const taskRepository = require('../../src/repository/taskRepository');
const projectRepository = require('../../src/repository/projectRepository');
const sgMail = require('@sendgrid/mail');
const notificationService = require('../../src/services/notificationService');

describe('Task Deletion Notification - User Story Tests', () => {
  
  const mockTask = {
    id: 101,
    title: 'Implement Authentication',
    description: 'Add JWT-based authentication to the API',
    status: 'in_progress',
    priority: 'high',
    assigned_to: [1, 2, 3],
    created_by: 5,
    project_id: 10,
    due_date: '2025-11-01',
    tags: ['backend', 'security'],
    created_at: '2025-10-15T10:00:00Z',
    updated_at: '2025-10-20T15:30:00Z'
  };

  const mockProject = {
    id: 10,
    name: 'Authentication Service',
    description: 'Security improvements project'
  };

  const mockDeleter = {
    id: 5,
    name: 'John Manager',
    email: 'john.manager@company.com'
  };

  const mockAssignees = [
    { id: 1, name: 'Alice Developer', email: 'alice@company.com' },
    { id: 2, name: 'Bob Engineer', email: 'bob@company.com' },
    { id: 3, name: 'Charlie Tester', email: 'charlie@company.com' }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SENDGRID_API_KEY = 'test-sendgrid-key';
    process.env.FROM_EMAIL = 'noreply@company.com';
    process.env.FRONTEND_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    delete process.env.SENDGRID_API_KEY;
    delete process.env.FROM_EMAIL;
    delete process.env.FRONTEND_URL;
  });

  describe('AC1: Notification sent to all task assignees', () => {
    
    test('should send notification to all assigned users when task is deleted', async () => {
      // Arrange
      taskRepository.getTaskById.mockResolvedValue(mockTask);
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockImplementation(async (id) => {
        if (id === 5) return mockDeleter;
        return mockAssignees.find(u => u.id === id);
      });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });
      sgMail.send.mockResolvedValue([{ headers: { 'x-message-id': 'msg-123' } }]);

      // Act
      const result = await notificationService.createTaskDeletedNotification({
        taskId: 101,
        deleterId: 5,
        deleterName: 'John Manager'
      });

      // Assert
      expect(result.notificationsSent).toBe(3);
      expect(notificationRepository.create).toHaveBeenCalledTimes(3);
      expect(sgMail.send).toHaveBeenCalledTimes(3);
    });

    test('should send notification to each assignee individually', async () => {
      // Arrange
      taskRepository.getTaskById.mockResolvedValue(mockTask);
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockImplementation(async (id) => {
        if (id === 5) return mockDeleter;
        return mockAssignees.find(u => u.id === id);
      });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });
      sgMail.send.mockResolvedValue([{ headers: {} }]);

      // Act
      await notificationService.createTaskDeletedNotification({
        taskId: 101,
        deleterId: 5,
        deleterName: 'John Manager'
      });

      // Assert - Verify each assignee got their own notification
      expect(notificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient_emails: 'alice@company.com'
        })
      );
      expect(notificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient_emails: 'bob@company.com'
        })
      );
      expect(notificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient_emails: 'charlie@company.com'
        })
      );
    });

    test('should exclude deleter from notifications if they are also assigned', async () => {
      // Arrange - Deleter is also an assignee
      const taskWithDeleterAssigned = {
        ...mockTask,
        assigned_to: [1, 2, 5] // Deleter ID 5 is assigned
      };
      
      taskRepository.getTaskById.mockResolvedValue(taskWithDeleterAssigned);
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockImplementation(async (id) => {
        if (id === 5) return mockDeleter;
        return mockAssignees.find(u => u.id === id);
      });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });
      sgMail.send.mockResolvedValue([{ headers: {} }]);

      // Act
      const result = await notificationService.createTaskDeletedNotification({
        taskId: 101,
        deleterId: 5,
        deleterName: 'John Manager'
      });

      // Assert - Should only notify 2 users (not the deleter)
      expect(result.notificationsSent).toBe(2);
      expect(notificationRepository.create).not.toHaveBeenCalledWith(
        expect.objectContaining({
          recipient_emails: mockDeleter.email
        })
      );
    });

    test('should return zero notifications when task has no assignees', async () => {
      // Arrange
      const taskWithNoAssignees = { ...mockTask, assigned_to: [] };
      taskRepository.getTaskById.mockResolvedValue(taskWithNoAssignees);

      // Act
      const result = await notificationService.createTaskDeletedNotification({
        taskId: 101,
        deleterId: 5,
        deleterName: 'John Manager'
      });

      // Assert
      expect(result.notificationsSent).toBe(0);
      expect(notificationRepository.create).not.toHaveBeenCalled();
      expect(sgMail.send).not.toHaveBeenCalled();
    });

    test('should handle case when deleter is the only assignee', async () => {
      // Arrange
      const taskWithOnlyDeleter = {
        ...mockTask,
        assigned_to: [5] // Only the deleter
      };
      
      taskRepository.getTaskById.mockResolvedValue(taskWithOnlyDeleter);
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockResolvedValue(mockDeleter);

      // Act
      const result = await notificationService.createTaskDeletedNotification({
        taskId: 101,
        deleterId: 5,
        deleterName: 'John Manager'
      });

      // Assert
      expect(result.notificationsSent).toBe(0);
      expect(notificationRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('AC2: Notification shows all task details', () => {
    
    test('should include task title in notification message', async () => {
      // Arrange
      taskRepository.getTaskById.mockResolvedValue(mockTask);
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockImplementation(async (id) => {
        if (id === 5) return mockDeleter;
        return mockAssignees[0];
      });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });
      sgMail.send.mockResolvedValue([{ headers: {} }]);

      // Act
      await notificationService.createTaskDeletedNotification({
        taskId: 101,
        deleterId: 5,
        deleterName: 'John Manager'
      });

      // Assert
      expect(notificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Implement Authentication')
        })
      );
    });

    test('should include deleter name in notification message', async () => {
      // Arrange
      taskRepository.getTaskById.mockResolvedValue(mockTask);
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockImplementation(async (id) => {
        if (id === 5) return mockDeleter;
        return mockAssignees[0];
      });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });
      sgMail.send.mockResolvedValue([{ headers: {} }]);

      // Act
      await notificationService.createTaskDeletedNotification({
        taskId: 101,
        deleterId: 5,
        deleterName: 'John Manager'
      });

      // Assert
      expect(notificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('John Manager')
        })
      );
    });

    test('should include all task details in email body', async () => {
      // Arrange
      taskRepository.getTaskById.mockResolvedValue(mockTask);
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockImplementation(async (id) => {
        if (id === 5) return mockDeleter;
        return mockAssignees[0];
      });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });
      sgMail.send.mockResolvedValue([{ headers: {} }]);

      // Act
      await notificationService.createTaskDeletedNotification({
        taskId: 101,
        deleterId: 5,
        deleterName: 'John Manager'
      });

      // Assert
      const emailCall = sgMail.send.mock.calls[0][0];
      expect(emailCall.html).toContain('Implement Authentication'); // Title
      expect(emailCall.html).toContain('Add JWT-based authentication'); // Description
      expect(emailCall.html).toContain('in_progress'); // Status
      expect(emailCall.html).toContain('high'); // Priority
      expect(emailCall.html).toContain('2025-11-01'); // Due date
      expect(emailCall.html).toContain('Authentication Service'); // Project name
    });

    test('should handle tasks with minimal information', async () => {
      // Arrange - Task with only required fields
      const minimalTask = {
        id: 102,
        title: 'Simple Task',
        assigned_to: [1],
        project_id: 10
      };
      
      taskRepository.getTaskById.mockResolvedValue(minimalTask);
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockImplementation(async (id) => {
        if (id === 5) return mockDeleter;
        return mockAssignees[0];
      });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });
      sgMail.send.mockResolvedValue([{ headers: {} }]);

      // Act & Assert - Should not throw error
      await expect(
        notificationService.createTaskDeletedNotification({
          taskId: 102,
          deleterId: 5,
          deleterName: 'John Manager'
        })
      ).resolves.toBeDefined();
    });

    test('should include project name in notification', async () => {
      // Arrange
      taskRepository.getTaskById.mockResolvedValue(mockTask);
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockImplementation(async (id) => {
        if (id === 5) return mockDeleter;
        return mockAssignees[0];
      });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });
      sgMail.send.mockResolvedValue([{ headers: {} }]);

      // Act
      await notificationService.createTaskDeletedNotification({
        taskId: 101,
        deleterId: 5,
        deleterName: 'John Manager'
      });

      // Assert
      const emailCall = sgMail.send.mock.calls[0][0];
      expect(emailCall.html).toContain('Authentication Service');
    });
  });

  describe('AC3: Delivered both in-app and via email', () => {
    
    test('should create in-app notification in database', async () => {
      // Arrange
      taskRepository.getTaskById.mockResolvedValue(mockTask);
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockImplementation(async (id) => {
        if (id === 5) return mockDeleter;
        return mockAssignees[0];
      });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });
      sgMail.send.mockResolvedValue([{ headers: {} }]);

      // Act
      await notificationService.createTaskDeletedNotification({
        taskId: 101,
        deleterId: 5,
        deleterName: 'John Manager'
      });

      // Assert - In-app notification created
      expect(notificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          notif_types: 'task_deleted',
          message: expect.any(String),
          creator_id: 5,
          recipient_emails: expect.any(String)
        })
      );
    });

    test('should send email notification via SendGrid', async () => {
      // Arrange
      taskRepository.getTaskById.mockResolvedValue(mockTask);
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockImplementation(async (id) => {
        if (id === 5) return mockDeleter;
        return mockAssignees[0];
      });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });
      sgMail.send.mockResolvedValue([{ headers: { 'x-message-id': 'msg-abc' } }]);

      // Act
      await notificationService.createTaskDeletedNotification({
        taskId: 101,
        deleterId: 5,
        deleterName: 'John Manager'
      });

      // Assert - Email sent
      expect(sgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'alice@company.com',
          from: 'noreply@company.com',
          subject: expect.stringContaining('deleted'),
          html: expect.any(String)
        })
      );
    });

    test('should send both in-app and email for each assignee', async () => {
      // Arrange
      taskRepository.getTaskById.mockResolvedValue(mockTask);
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockImplementation(async (id) => {
        if (id === 5) return mockDeleter;
        return mockAssignees.find(u => u.id === id);
      });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });
      sgMail.send.mockResolvedValue([{ headers: {} }]);

      // Act
      await notificationService.createTaskDeletedNotification({
        taskId: 101,
        deleterId: 5,
        deleterName: 'John Manager'
      });

      // Assert - Both notifications sent for each user
      expect(notificationRepository.create).toHaveBeenCalledTimes(3);
      expect(sgMail.send).toHaveBeenCalledTimes(3);
    });

    test('should continue if email fails but in-app notification succeeds', async () => {
      // Arrange
      taskRepository.getTaskById.mockResolvedValue(mockTask);
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockImplementation(async (id) => {
        if (id === 5) return mockDeleter;
        return mockAssignees[0];
      });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });
      sgMail.send.mockRejectedValue(new Error('SendGrid API error'));

      // Act & Assert - Should not throw error
      await expect(
        notificationService.createTaskDeletedNotification({
          taskId: 101,
          deleterId: 5,
          deleterName: 'John Manager'
        })
      ).resolves.toBeDefined();

      // In-app notification should still be created
      expect(notificationRepository.create).toHaveBeenCalled();
    });

    test('should skip email when SendGrid is not configured', async () => {
      // Arrange
      delete process.env.SENDGRID_API_KEY;
      
      taskRepository.getTaskById.mockResolvedValue(mockTask);
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockImplementation(async (id) => {
        if (id === 5) return mockDeleter;
        return mockAssignees[0];
      });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });

      // Act
      await notificationService.createTaskDeletedNotification({
        taskId: 101,
        deleterId: 5,
        deleterName: 'John Manager'
      });

      // Assert - In-app created but email not sent
      expect(notificationRepository.create).toHaveBeenCalled();
      expect(sgMail.send).not.toHaveBeenCalled();
    });
  });

  describe('AC4: Notification stored in database with timestamp', () => {
    
    test('should store notification with timestamp', async () => {
      // Arrange
      const mockTimestamp = new Date('2025-10-25T14:30:00Z').toISOString();
      jest.spyOn(Date.prototype, 'toISOString').mockReturnValue(mockTimestamp);
      
      taskRepository.getTaskById.mockResolvedValue(mockTask);
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockImplementation(async (id) => {
        if (id === 5) return mockDeleter;
        return mockAssignees[0];
      });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });
      sgMail.send.mockResolvedValue([{ headers: {} }]);

      // Act
      await notificationService.createTaskDeletedNotification({
        taskId: 101,
        deleterId: 5,
        deleterName: 'John Manager'
      });

      // Assert
      expect(notificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          created_at: mockTimestamp
        })
      );

      jest.restoreAllMocks();
    });

    test('should store notification with correct type', async () => {
      // Arrange
      taskRepository.getTaskById.mockResolvedValue(mockTask);
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockImplementation(async (id) => {
        if (id === 5) return mockDeleter;
        return mockAssignees[0];
      });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });
      sgMail.send.mockResolvedValue([{ headers: {} }]);

      // Act
      await notificationService.createTaskDeletedNotification({
        taskId: 101,
        deleterId: 5,
        deleterName: 'John Manager'
      });

      // Assert
      expect(notificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          notif_types: 'task_deleted'
        })
      );
    });

    test('should store notification with creator ID', async () => {
      // Arrange
      taskRepository.getTaskById.mockResolvedValue(mockTask);
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockImplementation(async (id) => {
        if (id === 5) return mockDeleter;
        return mockAssignees[0];
      });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });
      sgMail.send.mockResolvedValue([{ headers: {} }]);

      // Act
      await notificationService.createTaskDeletedNotification({
        taskId: 101,
        deleterId: 5,
        deleterName: 'John Manager'
      });

      // Assert
      expect(notificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          creator_id: 5
        })
      );
    });

    test('should return notification ID after creation', async () => {
      // Arrange
      const mockNotificationId = 12345;
      taskRepository.getTaskById.mockResolvedValue(mockTask);
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockImplementation(async (id) => {
        if (id === 5) return mockDeleter;
        return mockAssignees[0];
      });
      notificationRepository.create.mockResolvedValue({ notif_id: mockNotificationId });
      sgMail.send.mockResolvedValue([{ headers: {} }]);

      // Act
      const result = await notificationService.createTaskDeletedNotification({
        taskId: 101,
        deleterId: 5,
        deleterName: 'John Manager'
      });

      // Assert
      expect(result.notificationIds).toContain(mockNotificationId);
    });
  });

  describe('Error Handling', () => {
    
    test('should throw error when task not found', async () => {
      // Arrange
      taskRepository.getTaskById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        notificationService.createTaskDeletedNotification({
          taskId: 999,
          deleterId: 5,
          deleterName: 'John Manager'
        })
      ).rejects.toThrow('Task not found');
    });

    test('should throw error when project not found', async () => {
      // Arrange
      taskRepository.getTaskById.mockResolvedValue(mockTask);
      projectRepository.getProjectById.mockResolvedValue(null);

      // Act & Assert
      await expect(
        notificationService.createTaskDeletedNotification({
          taskId: 101,
          deleterId: 5,
          deleterName: 'John Manager'
        })
      ).rejects.toThrow('Project not found');
    });

    test('should handle missing user gracefully', async () => {
      // Arrange
      taskRepository.getTaskById.mockResolvedValue(mockTask);
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockImplementation(async (id) => {
        if (id === 5) return mockDeleter;
        if (id === 1) return mockAssignees[0];
        // User 2 and 3 not found
        return null;
      });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });
      sgMail.send.mockResolvedValue([{ headers: {} }]);

      // Act
      const result = await notificationService.createTaskDeletedNotification({
        taskId: 101,
        deleterId: 5,
        deleterName: 'John Manager'
      });

      // Assert - Should still notify the one valid user
      expect(result.notificationsSent).toBe(1);
      expect(notificationRepository.create).toHaveBeenCalledTimes(1);
    });

    test('should handle database error gracefully', async () => {
      // Arrange
      taskRepository.getTaskById.mockResolvedValue(mockTask);
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockImplementation(async (id) => {
        if (id === 5) return mockDeleter;
        return mockAssignees[0];
      });
      notificationRepository.create.mockRejectedValue(new Error('Database connection failed'));
      sgMail.send.mockResolvedValue([{ headers: {} }]);

      // Act & Assert
      await expect(
        notificationService.createTaskDeletedNotification({
          taskId: 101,
          deleterId: 5,
          deleterName: 'John Manager'
        })
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('Integration Scenarios', () => {
    
    test('should handle task with large number of assignees', async () => {
      // Arrange - Task with 10 assignees
      const manyAssignees = Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`,
        email: `user${i + 1}@company.com`
      }));
      
      const taskWithManyAssignees = {
        ...mockTask,
        assigned_to: manyAssignees.map(u => u.id)
      };
      
      taskRepository.getTaskById.mockResolvedValue(taskWithManyAssignees);
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockImplementation(async (id) => {
        if (id === 5) return mockDeleter;
        return manyAssignees.find(u => u.id === id);
      });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });
      sgMail.send.mockResolvedValue([{ headers: {} }]);

      // Act
      const result = await notificationService.createTaskDeletedNotification({
        taskId: 101,
        deleterId: 5,
        deleterName: 'John Manager'
      });

      // Assert
      expect(result.notificationsSent).toBe(10);
      expect(notificationRepository.create).toHaveBeenCalledTimes(10);
      expect(sgMail.send).toHaveBeenCalledTimes(10);
    });

    test('should handle task with special characters in title', async () => {
      // Arrange
      const taskWithSpecialChars = {
        ...mockTask,
        title: 'Fix bug: API returns <script>alert("XSS")</script> in response',
        description: 'Handle & escape "special" characters'
      };
      
      taskRepository.getTaskById.mockResolvedValue(taskWithSpecialChars);
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockImplementation(async (id) => {
        if (id === 5) return mockDeleter;
        return mockAssignees[0];
      });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });
      sgMail.send.mockResolvedValue([{ headers: {} }]);

      // Act & Assert - Should not throw error
      await expect(
        notificationService.createTaskDeletedNotification({
          taskId: 101,
          deleterId: 5,
          deleterName: 'John Manager'
        })
      ).resolves.toBeDefined();
    });

    test('should handle concurrent deletion notifications', async () => {
      // Arrange
      taskRepository.getTaskById.mockResolvedValue(mockTask);
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockImplementation(async (id) => {
        if (id === 5) return mockDeleter;
        return mockAssignees[0];
      });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });
      sgMail.send.mockResolvedValue([{ headers: {} }]);

      // Act - Send multiple notifications concurrently
      const promises = Array.from({ length: 5 }, () =>
        notificationService.createTaskDeletedNotification({
          taskId: 101,
          deleterId: 5,
          deleterName: 'John Manager'
        })
      );

      const results = await Promise.all(promises);

      // Assert - All should succeed
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.notificationsSent).toBeGreaterThan(0);
      });
    });
  });
});
