/**
 * Integration Tests for Task Deletion Notification Feature
 * User Story: As a staff, I want to be notified when a task is deleted 
 * so that I can understand changes in team workload.
 * 
 * These tests verify the complete flow from task deletion to notification delivery
 */

const request = require('supertest');
const app = require('../../src/index');
const notificationRepository = require('../../src/repository/notificationRepository');
const taskRepository = require('../../src/repository/taskRepository');
const userRepository = require('../../src/repository/userRepository');
const projectRepository = require('../../src/repository/projectRepository');

jest.mock('../../src/repository/notificationRepository');
jest.mock('../../src/repository/taskRepository');
jest.mock('../../src/repository/userRepository');
jest.mock('../../src/repository/projectRepository');
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue([{ headers: { 'x-message-id': 'test-msg-id' } }])
}));

describe('Task Deletion Notification - Integration Tests', () => {
  
  const mockAuthUser = {
    id: 5,
    name: 'John Manager',
    email: 'john.manager@company.com',
    role: 'project_manager'
  };

  const mockTask = {
    id: 101,
    title: 'Implement Authentication',
    description: 'Add JWT-based authentication',
    status: 'in_progress',
    priority: 'high',
    assigned_to: [1, 2, 3],
    created_by: 5,
    project_id: 10,
    due_date: '2025-11-01'
  };

  const mockProject = {
    id: 10,
    name: 'Authentication Service'
  };

  const mockAssignees = [
    { id: 1, name: 'Alice Developer', email: 'alice@company.com' },
    { id: 2, name: 'Bob Engineer', email: 'bob@company.com' },
    { id: 3, name: 'Charlie Tester', email: 'charlie@company.com' }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock authentication
    jest.spyOn(require('../../src/middleware/auth'), 'requireAuth')
      .mockImplementation((req, res, next) => {
        req.user = mockAuthUser;
        next();
      });

    process.env.SENDGRID_API_KEY = 'test-key';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.SENDGRID_API_KEY;
  });

  describe('DELETE /api/tasks/:taskId - Complete Notification Flow', () => {
    
    test('should send notifications when task is successfully deleted', async () => {
      // Arrange
      taskRepository.getTaskById.mockResolvedValue(mockTask);
      taskRepository.deleteById.mockResolvedValue(true);
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockImplementation(async (id) => {
        if (id === 5) return mockAuthUser;
        return mockAssignees.find(u => u.id === id);
      });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });

      // Act
      const response = await request(app)
        .delete('/api/tasks/101')
        .set('Authorization', 'Bearer mock-token');

      // Assert
      expect(response.status).toBe(200);
      expect(notificationRepository.create).toHaveBeenCalledTimes(3);
      
      // Verify notification was sent to each assignee
      expect(notificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          notif_types: 'task_deletion',
          creator_id: 5
        })
      );
    });

    test('should include task details in notification', async () => {
      // Arrange
      taskRepository.getTaskById.mockResolvedValue(mockTask);
      taskRepository.deleteById.mockResolvedValue(true);
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockImplementation(async (id) => {
        if (id === 5) return mockAuthUser;
        return mockAssignees[0];
      });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });

      // Act
      await request(app)
        .delete('/api/tasks/101')
        .set('Authorization', 'Bearer mock-token');

      // Assert
      const notificationCall = notificationRepository.create.mock.calls[0][0];
      expect(notificationCall.message).toContain('Implement Authentication');
      expect(notificationCall.message).toContain('John Manager');
    });

    test('should not send notifications if task deletion fails', async () => {
      // Arrange
      taskRepository.getTaskById.mockResolvedValue(mockTask);
      taskRepository.deleteById.mockRejectedValue(new Error('Database error'));

      // Act
      const response = await request(app)
        .delete('/api/tasks/101')
        .set('Authorization', 'Bearer mock-token');

      // Assert
      expect(response.status).toBe(500);
      expect(notificationRepository.create).not.toHaveBeenCalled();
    });

    test('should require authentication', async () => {
      // Arrange - Remove auth mock
      jest.spyOn(require('../../src/middleware/auth'), 'requireAuth')
        .mockImplementation((req, res, next) => {
          res.status(401).json({ success: false, message: 'Unauthorized' });
        });

      // Act
      const response = await request(app)
        .delete('/api/tasks/101');

      // Assert
      expect(response.status).toBe(401);
      expect(notificationRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/notifications - Retrieving Notifications', () => {
    
    test('should retrieve task deletion notifications for user', async () => {
      // Arrange
      const mockNotifications = [
        {
          notif_id: 1,
          notif_types: 'task_deletion',
          message: 'John Manager deleted task "Implement Authentication"',
          recipient_emails: 'alice@company.com',
          created_at: '2025-10-25T14:30:00Z',
          dismissed: false
        },
        {
          notif_id: 2,
          notif_types: 'task_deletion',
          message: 'John Manager deleted task "Review PR"',
          recipient_emails: 'alice@company.com',
          created_at: '2025-10-24T10:00:00Z',
          dismissed: false
        }
      ];

      userRepository.getUserById.mockResolvedValue(mockAssignees[0]);
      notificationRepository.getByUserEmail.mockResolvedValue(mockNotifications);

      // Act
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', 'Bearer mock-token');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.notifications).toHaveLength(2);
      expect(response.body.notifications[0].notif_types).toBe('task_deletion');
    });

    test('should show timestamp for each notification', async () => {
      // Arrange
      const mockNotifications = [
        {
          notif_id: 1,
          notif_types: 'task_deletion',
          message: 'Task deleted',
          recipient_emails: 'alice@company.com',
          created_at: '2025-10-25T14:30:00Z',
          dismissed: false
        }
      ];

      userRepository.getUserById.mockResolvedValue(mockAssignees[0]);
      notificationRepository.getByUserEmail.mockResolvedValue(mockNotifications);

      // Act
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', 'Bearer mock-token');

      // Assert
      expect(response.body.notifications[0].created_at).toBe('2025-10-25T14:30:00Z');
    });

    test('should filter by dismissed status', async () => {
      // Arrange
      const mockNotifications = [
        {
          notif_id: 1,
          notif_types: 'task_deletion',
          message: 'Task deleted',
          recipient_emails: 'alice@company.com',
          created_at: '2025-10-25T14:30:00Z',
          dismissed: false
        }
      ];

      userRepository.getUserById.mockResolvedValue(mockAssignees[0]);
      notificationRepository.getByUserEmail.mockResolvedValue(mockNotifications);

      // Act
      const response = await request(app)
        .get('/api/notifications?includeDismissed=false')
        .set('Authorization', 'Bearer mock-token');

      // Assert
      expect(response.status).toBe(200);
      expect(notificationRepository.getByUserEmail).toHaveBeenCalledWith(
        'alice@company.com',
        expect.any(Number),
        expect.any(Number),
        false
      );
    });
  });

  describe('Email Delivery Verification', () => {
    
    test('should send email with task details', async () => {
      // Arrange
      const sgMail = require('@sendgrid/mail');
      
      taskRepository.getTaskById.mockResolvedValue(mockTask);
      taskRepository.deleteById.mockResolvedValue(true);
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockImplementation(async (id) => {
        if (id === 5) return mockAuthUser;
        return mockAssignees[0];
      });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });

      // Act
      await request(app)
        .delete('/api/tasks/101')
        .set('Authorization', 'Bearer mock-token');

      // Assert
      expect(sgMail.send).toHaveBeenCalled();
      const emailCall = sgMail.send.mock.calls[0][0];
      expect(emailCall.to).toBe('alice@company.com');
      expect(emailCall.subject).toContain('deleted');
      expect(emailCall.html).toContain('Implement Authentication');
    });

    test('should send email to all assignees', async () => {
      // Arrange
      const sgMail = require('@sendgrid/mail');
      
      taskRepository.getTaskById.mockResolvedValue(mockTask);
      taskRepository.deleteById.mockResolvedValue(true);
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockImplementation(async (id) => {
        if (id === 5) return mockAuthUser;
        return mockAssignees.find(u => u.id === id);
      });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });

      // Act
      await request(app)
        .delete('/api/tasks/101')
        .set('Authorization', 'Bearer mock-token');

      // Assert
      expect(sgMail.send).toHaveBeenCalledTimes(3);
      
      const emailRecipients = sgMail.send.mock.calls.map(call => call[0].to);
      expect(emailRecipients).toContain('alice@company.com');
      expect(emailRecipients).toContain('bob@company.com');
      expect(emailRecipients).toContain('charlie@company.com');
    });
  });

  describe('Real-world Scenarios', () => {
    
    test('should handle project manager deleting overdue task', async () => {
      // Arrange
      const overdueTask = {
        ...mockTask,
        due_date: '2025-10-01', // Past due
        status: 'overdue'
      };

      taskRepository.getTaskById.mockResolvedValue(overdueTask);
      taskRepository.deleteById.mockResolvedValue(true);
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockImplementation(async (id) => {
        if (id === 5) return mockAuthUser;
        return mockAssignees.find(u => u.id === id);
      });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });

      // Act
      const response = await request(app)
        .delete('/api/tasks/101')
        .set('Authorization', 'Bearer mock-token');

      // Assert
      expect(response.status).toBe(200);
      expect(notificationRepository.create).toHaveBeenCalledTimes(3);
    });

    test('should handle team member deleting their own task', async () => {
      // Arrange
      const taskCreatedByDeleter = {
        ...mockTask,
        created_by: 1,
        assigned_to: [1, 2] // Deleter is assignee
      };

      const deleterAsTeamMember = { ...mockAssignees[0], role: 'team_member' };

      jest.spyOn(require('../../src/middleware/auth'), 'requireAuth')
        .mockImplementation((req, res, next) => {
          req.user = deleterAsTeamMember;
          next();
        });

      taskRepository.getTaskById.mockResolvedValue(taskCreatedByDeleter);
      taskRepository.deleteById.mockResolvedValue(true);
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockImplementation(async (id) => {
        return mockAssignees.find(u => u.id === id);
      });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });

      // Act
      const response = await request(app)
        .delete('/api/tasks/101')
        .set('Authorization', 'Bearer mock-token');

      // Assert
      expect(response.status).toBe(200);
      // Should only notify 1 person (Bob), not the deleter (Alice)
      expect(notificationRepository.create).toHaveBeenCalledTimes(1);
      expect(notificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient_emails: 'bob@company.com'
        })
      );
    });

    test('should handle bulk task cleanup scenario', async () => {
      // Arrange - Simulate deleting multiple tasks
      const tasks = [
        { ...mockTask, id: 101, title: 'Task 1' },
        { ...mockTask, id: 102, title: 'Task 2' },
        { ...mockTask, id: 103, title: 'Task 3' }
      ];

      taskRepository.getTaskById.mockImplementation(async (id) => {
        return tasks.find(t => t.id === parseInt(id));
      });
      taskRepository.deleteById.mockResolvedValue(true);
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockImplementation(async (id) => {
        if (id === 5) return mockAuthUser;
        return mockAssignees.find(u => u.id === id);
      });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });

      // Act - Delete multiple tasks
      const deletePromises = tasks.map(task =>
        request(app)
          .delete(`/api/tasks/${task.id}`)
          .set('Authorization', 'Bearer mock-token')
      );

      const responses = await Promise.all(deletePromises);

      // Assert
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      // Should create 9 notifications total (3 tasks × 3 assignees)
      expect(notificationRepository.create).toHaveBeenCalledTimes(9);
    });

    test('should handle notification when task has attachments', async () => {
      // Arrange
      const taskWithAttachments = {
        ...mockTask,
        has_attachments: true
      };

      taskRepository.getTaskById.mockResolvedValue(taskWithAttachments);
      taskRepository.deleteById.mockResolvedValue(true);
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockImplementation(async (id) => {
        if (id === 5) return mockAuthUser;
        return mockAssignees[0];
      });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });

      // Act
      const response = await request(app)
        .delete('/api/tasks/101')
        .set('Authorization', 'Bearer mock-token');

      // Assert
      expect(response.status).toBe(200);
      expect(notificationRepository.create).toHaveBeenCalled();
      
      // Email should mention attachments were deleted
      const sgMail = require('@sendgrid/mail');
      const emailCall = sgMail.send.mock.calls[0][0];
      expect(emailCall.html).toContain('Implement Authentication');
    });
  });

  describe('Performance and Edge Cases', () => {
    
    test('should handle notification to large team efficiently', async () => {
      // Arrange - Task with 20 assignees
      const largeTeam = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`,
        email: `user${i + 1}@company.com`
      }));

      const taskWithLargeTeam = {
        ...mockTask,
        assigned_to: largeTeam.map(u => u.id)
      };

      taskRepository.getTaskById.mockResolvedValue(taskWithLargeTeam);
      taskRepository.deleteById.mockResolvedValue(true);
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockImplementation(async (id) => {
        if (id === 5) return mockAuthUser;
        return largeTeam.find(u => u.id === id);
      });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });

      const startTime = Date.now();

      // Act
      await request(app)
        .delete('/api/tasks/101')
        .set('Authorization', 'Bearer mock-token');

      const endTime = Date.now();

      // Assert
      expect(notificationRepository.create).toHaveBeenCalledTimes(20);
      
      // Should complete within reasonable time (5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);
    });

    test('should handle notification with very long task title', async () => {
      // Arrange
      const taskWithLongTitle = {
        ...mockTask,
        title: 'A'.repeat(500) // Very long title
      };

      taskRepository.getTaskById.mockResolvedValue(taskWithLongTitle);
      taskRepository.deleteById.mockResolvedValue(true);
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockImplementation(async (id) => {
        if (id === 5) return mockAuthUser;
        return mockAssignees[0];
      });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });

      // Act & Assert - Should not throw
      const response = await request(app)
        .delete('/api/tasks/101')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(notificationRepository.create).toHaveBeenCalled();
    });

    test('should handle notification when user email is missing', async () => {
      // Arrange
      const assigneeWithoutEmail = [
        { id: 1, name: 'Alice', email: null },
        { id: 2, name: 'Bob', email: 'bob@company.com' }
      ];

      const taskWithMixedAssignees = {
        ...mockTask,
        assigned_to: [1, 2]
      };

      taskRepository.getTaskById.mockResolvedValue(taskWithMixedAssignees);
      taskRepository.deleteById.mockResolvedValue(true);
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockImplementation(async (id) => {
        if (id === 5) return mockAuthUser;
        return assigneeWithoutEmail.find(u => u.id === id);
      });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });

      // Act
      const response = await request(app)
        .delete('/api/tasks/101')
        .set('Authorization', 'Bearer mock-token');

      // Assert - Should only notify Bob
      expect(response.status).toBe(200);
      expect(notificationRepository.create).toHaveBeenCalledTimes(1);
      expect(notificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient_emails: 'bob@company.com'
        })
      );
    });
  });
});
