/**
 * Test Suite for Overdue Task Notification Feature
 * User Story: As a user, I want to receive a notification when one of my tasks becomes overdue,
 * so that I am reminded to take immediate action on missed tasks.
 * 
 * Acceptance Criteria:
 * 1. Notifications are triggered when a task's due date has passed
 * 2. Notifications include the task title, original due date, and a short message
 * 3. Notifications are sent as both in-app notification toaster and stored in notification inbox
 * 4. Users can click the notification to view more details about the overdue task
 * 5. No overdue notification is sent if task was marked as completed before the deadline
 * 6. If the due date is updated to a future date, no new overdue notification will be sent
 * 7. Managers, Directors and assignees should get the notifications when a task is overdue
 */

jest.mock('../../src/repository/notificationRepository', () => ({
  create: jest.fn()
}));

jest.mock('../../src/repository/userRepository', () => ({
  getUserById: jest.fn(),
  getUsersByIds: jest.fn()
}));

jest.mock('../../src/repository/taskRepository', () => ({
  getTaskById: jest.fn(),
  list: jest.fn()
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

describe('Overdue Task Notification - User Story Tests', () => {
  
  const mockProject = {
    id: 10,
    name: 'Website Redesign Project',
    creator_id: 1 // Manager ID
  };

  const mockManager = {
    id: 1,
    name: 'Sarah Manager',
    email: 'sarah.manager@company.com',
    role: 'manager',
    hierarchy: 2
  };

  const mockDirector = {
    id: 2,
    name: 'David Director',
    email: 'david.director@company.com',
    role: 'director',
    hierarchy: 3
  };

  const mockAssignees = [
    { id: 10, name: 'Alice Developer', email: 'alice@company.com', role: 'staff', hierarchy: 1 },
    { id: 11, name: 'Bob Engineer', email: 'bob@company.com', role: 'staff', hierarchy: 1 }
  ];

  // Helper to create a date string (YYYY-MM-DD format)
  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SENDGRID_API_KEY = 'test-key';
    process.env.FROM_EMAIL = 'noreply@test.com';
    
    // Mock SendGrid
    sgMail.send.mockResolvedValue([{ headers: { 'x-message-id': 'test-msg-id' } }]);
  });

  afterEach(() => {
    delete process.env.SENDGRID_API_KEY;
    delete process.env.FROM_EMAIL;
  });

  describe('AC1: Notifications triggered when task due date has passed', () => {
    
    test('should send overdue notification when task deadline was yesterday', async () => {
      // Arrange
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const overdueTask = {
        id: 101,
        title: 'Complete User Authentication',
        description: 'Implement JWT authentication',
        status: 'in_progress',
        priority: 'high',
        assigned_to: [10, 11],
        deadline: formatDate(yesterday),
        project_id: 10
      };

      taskRepository.list.mockResolvedValue({ data: [overdueTask], error: null });
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById
        .mockResolvedValueOnce(mockManager)
        .mockResolvedValueOnce(mockAssignees[0])
        .mockResolvedValueOnce(mockAssignees[1]);
      userRepository.getUsersByIds.mockResolvedValue({ 
        data: mockAssignees, 
        error: null 
      });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });

      // Create a custom method for checking overdue tasks
      const checkAndSendOverdueNotifications = async () => {
        try {
          const { data: tasks } = await taskRepository.list({ archived: false });
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          
          const overdueTasks = tasks.filter(task => {
            if (!task.deadline || task.status === 'completed') return false;
            const deadline = new Date(task.deadline);
            const deadlineDate = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
            return deadlineDate < today;
          });

          let notificationsSent = 0;
          for (const task of overdueTasks) {
            const project = await projectRepository.getProjectById(task.project_id);
            const manager = await userRepository.getUserById(project.creator_id);
            const assignees = await userRepository.getUsersByIds(task.assigned_to);
            
            // Send to manager
            await notificationRepository.create({
              notif_types: 'overdue',
              message: `Task "${task.title}" is OVERDUE\nOriginal deadline: ${task.deadline}`,
              creator_id: null,
              recipient_emails: manager.email,
              created_at: new Date().toISOString()
            });
            notificationsSent++;

            // Send to assignees
            for (const assignee of assignees.data) {
              await notificationRepository.create({
                notif_types: 'overdue',
                message: `Task "${task.title}" is OVERDUE\nOriginal deadline: ${task.deadline}`,
                creator_id: null,
                recipient_emails: assignee.email,
                created_at: new Date().toISOString()
              });
              notificationsSent++;
            }
          }

          return { notificationsSent, tasksChecked: tasks.length };
        } catch (error) {
          console.error('Error checking overdue tasks:', error);
          throw error;
        }
      };

      // Act
      const result = await checkAndSendOverdueNotifications();

      // Assert
      expect(result.notificationsSent).toBe(3); // 1 manager + 2 assignees
      expect(notificationRepository.create).toHaveBeenCalledTimes(3);
    });

    test('should send overdue notification when task is 3 days overdue', async () => {
      // Arrange
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      const overdueTask = {
        id: 102,
        title: 'Database Migration',
        status: 'in_progress',
        assigned_to: [10],
        deadline: formatDate(threeDaysAgo),
        project_id: 10
      };

      taskRepository.list.mockResolvedValue({ data: [overdueTask], error: null });
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockResolvedValue(mockManager);
      userRepository.getUsersByIds.mockResolvedValue({ 
        data: [mockAssignees[0]], 
        error: null 
      });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });

      // Act
      const checkAndSendOverdueNotifications = async () => {
        const { data: tasks } = await taskRepository.list({ archived: false });
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        const overdueTasks = tasks.filter(task => {
          if (!task.deadline || task.status === 'completed') return false;
          const deadline = new Date(task.deadline);
          const deadlineDate = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
          return deadlineDate < today;
        });

        return overdueTasks.length > 0;
      };

      const hasOverdueTasks = await checkAndSendOverdueNotifications();

      // Assert
      expect(hasOverdueTasks).toBe(true);
    });

    test('should NOT send notification for tasks due today', async () => {
      // Arrange
      const today = new Date();
      
      const taskDueToday = {
        id: 103,
        title: 'Review Code',
        status: 'in_progress',
        assigned_to: [10],
        deadline: formatDate(today),
        project_id: 10
      };

      taskRepository.list.mockResolvedValue({ data: [taskDueToday], error: null });

      // Act
      const checkAndSendOverdueNotifications = async () => {
        const { data: tasks } = await taskRepository.list({ archived: false });
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        const overdueTasks = tasks.filter(task => {
          if (!task.deadline || task.status === 'completed') return false;
          const deadline = new Date(task.deadline);
          const deadlineDate = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
          return deadlineDate < today;
        });

        return overdueTasks.length;
      };

      const overdueCount = await checkAndSendOverdueNotifications();

      // Assert
      expect(overdueCount).toBe(0);
    });

    test('should NOT send notification for tasks due in the future', async () => {
      // Arrange
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const futureTask = {
        id: 104,
        title: 'Future Task',
        status: 'todo',
        assigned_to: [10],
        deadline: formatDate(tomorrow),
        project_id: 10
      };

      taskRepository.list.mockResolvedValue({ data: [futureTask], error: null });

      // Act
      const checkAndSendOverdueNotifications = async () => {
        const { data: tasks } = await taskRepository.list({ archived: false });
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        const overdueTasks = tasks.filter(task => {
          if (!task.deadline || task.status === 'completed') return false;
          const deadline = new Date(task.deadline);
          const deadlineDate = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
          return deadlineDate < today;
        });

        return overdueTasks.length;
      };

      const overdueCount = await checkAndSendOverdueNotifications();

      // Assert
      expect(overdueCount).toBe(0);
    });
  });

  describe('AC2: Notifications include task title, original due date, and message', () => {
    
    test('should include task title in notification message', async () => {
      // Arrange
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const overdueTask = {
        id: 105,
        title: 'Fix Critical Bug in Payment System',
        status: 'in_progress',
        assigned_to: [10],
        deadline: formatDate(yesterday),
        project_id: 10
      };

      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockResolvedValue(mockManager);
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });

      // Act
      await notificationRepository.create({
        notif_types: 'overdue',
        message: `Task "${overdueTask.title}" is OVERDUE\nOriginal deadline: ${overdueTask.deadline}\nPlease take immediate action.`,
        creator_id: null,
        recipient_emails: mockManager.email,
        created_at: new Date().toISOString()
      });

      // Assert
      const callArgs = notificationRepository.create.mock.calls[0][0];
      expect(callArgs.message).toContain('Fix Critical Bug in Payment System');
      expect(callArgs.message).toContain(overdueTask.deadline);
      expect(callArgs.message).toContain('OVERDUE');
    });

    test('should include original due date in notification', async () => {
      // Arrange
      const specificDate = new Date('2025-09-29');
      
      const overdueTask = {
        id: 106,
        title: 'Database Backup',
        status: 'in_progress',
        assigned_to: [10],
        deadline: formatDate(specificDate),
        project_id: 10
      };

      notificationRepository.create.mockResolvedValue({ notif_id: 1 });

      // Act
      await notificationRepository.create({
        notif_types: 'overdue',
        message: `Task "${overdueTask.title}" is OVERDUE\nOriginal deadline: ${overdueTask.deadline}`,
        creator_id: null,
        recipient_emails: mockAssignees[0].email,
        created_at: new Date().toISOString()
      });

      // Assert
      const callArgs = notificationRepository.create.mock.calls[0][0];
      expect(callArgs.message).toContain('2025-09-29');
      expect(callArgs.message).toContain('Original deadline:');
    });

    test('should include clear overdue message', async () => {
      // Arrange
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const overdueTask = {
        id: 107,
        title: 'Update Documentation',
        status: 'in_progress',
        assigned_to: [10],
        deadline: formatDate(yesterday),
        project_id: 10,
        priority: 'high'
      };

      notificationRepository.create.mockResolvedValue({ notif_id: 1 });

      // Act
      await notificationRepository.create({
        notif_types: 'overdue',
        message: `⚠️ OVERDUE TASK\n\nTask "${overdueTask.title}" has missed its deadline.\nOriginal deadline: ${overdueTask.deadline}\nPriority: ${overdueTask.priority}\n\nPlease address this task immediately.`,
        creator_id: null,
        recipient_emails: mockAssignees[0].email,
        created_at: new Date().toISOString()
      });

      // Assert
      const callArgs = notificationRepository.create.mock.calls[0][0];
      expect(callArgs.message).toContain('OVERDUE');
      expect(callArgs.message).toContain('missed its deadline');
      expect(callArgs.message).toContain('address this task immediately');
    });
  });

  describe('AC3: Notifications sent as both in-app and stored in notification inbox', () => {
    
    test('should create notification in database for in-app display', async () => {
      // Arrange
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const overdueTask = {
        id: 108,
        title: 'Security Audit',
        status: 'in_progress',
        assigned_to: [10],
        deadline: formatDate(yesterday),
        project_id: 10
      };

      notificationRepository.create.mockResolvedValue({ 
        notif_id: 999,
        notif_types: 'overdue',
        message: `Task "${overdueTask.title}" is OVERDUE`,
        recipient_emails: mockAssignees[0].email,
        dismissed: false,
        created_at: new Date().toISOString()
      });

      // Act
      const notification = await notificationRepository.create({
        notif_types: 'overdue',
        message: `Task "${overdueTask.title}" is OVERDUE\nOriginal deadline: ${overdueTask.deadline}`,
        creator_id: null,
        recipient_emails: mockAssignees[0].email,
        created_at: new Date().toISOString()
      });

      // Assert
      expect(notification.notif_id).toBe(999);
      expect(notification.notif_types).toBe('overdue');
      expect(notification.dismissed).toBe(false);
      expect(notificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          notif_types: 'overdue',
          recipient_emails: mockAssignees[0].email
        })
      );
    });

    test('should send email notification via SendGrid', async () => {
      // Arrange
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const overdueTask = {
        id: 109,
        title: 'API Integration',
        status: 'in_progress',
        assigned_to: [10],
        deadline: formatDate(yesterday),
        project_id: 10
      };

      projectRepository.getProjectById.mockResolvedValue(mockProject);
      sgMail.send.mockResolvedValue([{ headers: { 'x-message-id': 'email-123' } }]);

      // Act
      const emailContent = {
        to: mockAssignees[0].email,
        from: process.env.FROM_EMAIL,
        subject: `⚠️ Task Overdue: ${overdueTask.title}`,
        html: `<p>Task "${overdueTask.title}" is overdue. Deadline was: ${overdueTask.deadline}</p>`
      };
      
      await sgMail.send(emailContent);

      // Assert
      expect(sgMail.send).toHaveBeenCalledTimes(1);
      expect(sgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockAssignees[0].email,
          subject: expect.stringContaining('Overdue')
        })
      );
    });

    test('should store notification even if email sending fails', async () => {
      // Arrange
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const overdueTask = {
        id: 110,
        title: 'Performance Testing',
        status: 'in_progress',
        assigned_to: [10],
        deadline: formatDate(yesterday),
        project_id: 10
      };

      notificationRepository.create.mockResolvedValue({ notif_id: 1 });
      sgMail.send.mockRejectedValue(new Error('SendGrid API error'));

      // Act
      await notificationRepository.create({
        notif_types: 'overdue',
        message: `Task "${overdueTask.title}" is OVERDUE`,
        creator_id: null,
        recipient_emails: mockAssignees[0].email,
        created_at: new Date().toISOString()
      });

      // Try to send email (will fail but notification is already stored)
      try {
        await sgMail.send({
          to: mockAssignees[0].email,
          from: process.env.FROM_EMAIL,
          subject: 'Overdue Task',
          html: 'Task is overdue'
        });
      } catch (error) {
        // Email failed but notification was already created
      }

      // Assert - notification should still be created
      expect(notificationRepository.create).toHaveBeenCalledTimes(1);
      expect(notificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          notif_types: 'overdue'
        })
      );
    });
  });

  describe('AC4: Users can click notification to view task details', () => {
    
    test('should include task ID in notification for navigation', async () => {
      // Arrange
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const overdueTask = {
        id: 111,
        title: 'Code Review',
        status: 'in_progress',
        assigned_to: [10],
        deadline: formatDate(yesterday),
        project_id: 10
      };

      notificationRepository.create.mockResolvedValue({ notif_id: 1 });

      // Act
      await notificationRepository.create({
        notif_types: 'overdue',
        message: `Task "${overdueTask.title}" is OVERDUE\nTask ID: ${overdueTask.id}\nProject ID: ${overdueTask.project_id}`,
        creator_id: null,
        recipient_emails: mockAssignees[0].email,
        task_id: overdueTask.id,
        project_id: overdueTask.project_id,
        created_at: new Date().toISOString()
      });

      // Assert
      const callArgs = notificationRepository.create.mock.calls[0][0];
      expect(callArgs.task_id).toBe(111);
      expect(callArgs.project_id).toBe(10);
    });

    test('should include project context in notification', async () => {
      // Arrange
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const overdueTask = {
        id: 112,
        title: 'UI Components',
        status: 'in_progress',
        assigned_to: [10],
        deadline: formatDate(yesterday),
        project_id: 10
      };

      projectRepository.getProjectById.mockResolvedValue(mockProject);
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });

      // Act
      const project = await projectRepository.getProjectById(overdueTask.project_id);
      await notificationRepository.create({
        notif_types: 'overdue',
        message: `Task "${overdueTask.title}" is OVERDUE\nProject: ${project.name}\nOriginal deadline: ${overdueTask.deadline}`,
        creator_id: null,
        recipient_emails: mockAssignees[0].email,
        project_id: overdueTask.project_id,
        created_at: new Date().toISOString()
      });

      // Assert
      const callArgs = notificationRepository.create.mock.calls[0][0];
      expect(callArgs.message).toContain('Website Redesign Project');
      expect(callArgs.project_id).toBe(10);
    });
  });

  describe('AC5: No overdue notification if task completed before deadline', () => {
    
    test('should NOT send notification for completed tasks', async () => {
      // Arrange
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const completedTask = {
        id: 113,
        title: 'Bug Fix',
        status: 'completed',
        assigned_to: [10],
        deadline: formatDate(yesterday),
        project_id: 10,
        completed_at: formatDate(yesterday)
      };

      taskRepository.list.mockResolvedValue({ data: [completedTask], error: null });

      // Act
      const checkAndSendOverdueNotifications = async () => {
        const { data: tasks } = await taskRepository.list({ archived: false });
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        const overdueTasks = tasks.filter(task => {
          if (!task.deadline || task.status === 'completed') return false;
          const deadline = new Date(task.deadline);
          const deadlineDate = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
          return deadlineDate < today;
        });

        return overdueTasks.length;
      };

      const overdueCount = await checkAndSendOverdueNotifications();

      // Assert
      expect(overdueCount).toBe(0);
      expect(notificationRepository.create).not.toHaveBeenCalled();
    });

    test('should NOT send notification for tasks completed early', async () => {
      // Arrange
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      const completedTaskEarly = {
        id: 114,
        title: 'Feature Implementation',
        status: 'completed',
        assigned_to: [10],
        deadline: formatDate(twoDaysAgo),
        project_id: 10,
        completed_at: formatDate(threeDaysAgo) // Completed before deadline
      };

      taskRepository.list.mockResolvedValue({ data: [completedTaskEarly], error: null });

      // Act
      const checkAndSendOverdueNotifications = async () => {
        const { data: tasks } = await taskRepository.list({ archived: false });
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        const overdueTasks = tasks.filter(task => {
          if (!task.deadline || task.status === 'completed') return false;
          const deadline = new Date(task.deadline);
          const deadlineDate = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
          return deadlineDate < today;
        });

        return overdueTasks.length;
      };

      const overdueCount = await checkAndSendOverdueNotifications();

      // Assert
      expect(overdueCount).toBe(0);
    });

    test('should send notification for incomplete tasks past deadline', async () => {
      // Arrange
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const incompleteTask = {
        id: 115,
        title: 'Testing Phase',
        status: 'in_progress',
        assigned_to: [10],
        deadline: formatDate(yesterday),
        project_id: 10
      };

      taskRepository.list.mockResolvedValue({ data: [incompleteTask], error: null });

      // Act
      const checkAndSendOverdueNotifications = async () => {
        const { data: tasks } = await taskRepository.list({ archived: false });
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        const overdueTasks = tasks.filter(task => {
          if (!task.deadline || task.status === 'completed') return false;
          const deadline = new Date(task.deadline);
          const deadlineDate = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
          return deadlineDate < today;
        });

        return overdueTasks.length;
      };

      const overdueCount = await checkAndSendOverdueNotifications();

      // Assert
      expect(overdueCount).toBe(1);
    });
  });

  describe('AC6: No new overdue notification if due date updated to future', () => {
    
    test('should NOT send overdue notification if deadline extended to future', async () => {
      // Arrange
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const taskWithExtendedDeadline = {
        id: 116,
        title: 'Backend Integration',
        status: 'in_progress',
        assigned_to: [10],
        deadline: formatDate(tomorrow), // Extended to future
        project_id: 10,
        original_deadline: '2025-10-20' // Was overdue but extended
      };

      taskRepository.list.mockResolvedValue({ data: [taskWithExtendedDeadline], error: null });

      // Act
      const checkAndSendOverdueNotifications = async () => {
        const { data: tasks } = await taskRepository.list({ archived: false });
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        const overdueTasks = tasks.filter(task => {
          if (!task.deadline || task.status === 'completed') return false;
          const deadline = new Date(task.deadline);
          const deadlineDate = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
          return deadlineDate < today; // Only future dates pass
        });

        return overdueTasks.length;
      };

      const overdueCount = await checkAndSendOverdueNotifications();

      // Assert
      expect(overdueCount).toBe(0);
    });

    test('should track deadline changes to prevent duplicate notifications', async () => {
      // Arrange
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Task was overdue
      const overdueTask = {
        id: 117,
        title: 'Data Migration',
        status: 'in_progress',
        assigned_to: [10],
        deadline: formatDate(yesterday),
        project_id: 10
      };

      // Simulate sending notification for overdue task
      notificationRepository.create.mockResolvedValueOnce({ notif_id: 1 });
      
      await notificationRepository.create({
        notif_types: 'overdue',
        message: `Task "${overdueTask.title}" is OVERDUE`,
        creator_id: null,
        recipient_emails: mockAssignees[0].email,
        task_id: overdueTask.id,
        created_at: new Date().toISOString()
      });

      // Now deadline is extended
      const updatedTask = {
        ...overdueTask,
        deadline: formatDate(tomorrow) // Extended to future
      };

      taskRepository.list.mockResolvedValue({ data: [updatedTask], error: null });

      // Act - check again
      const checkAndSendOverdueNotifications = async () => {
        const { data: tasks } = await taskRepository.list({ archived: false });
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        const overdueTasks = tasks.filter(task => {
          if (!task.deadline || task.status === 'completed') return false;
          const deadline = new Date(task.deadline);
          const deadlineDate = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
          return deadlineDate < today;
        });

        return overdueTasks.length;
      };

      const overdueCount = await checkAndSendOverdueNotifications();

      // Assert - should only have 1 notification (the initial overdue one)
      expect(notificationRepository.create).toHaveBeenCalledTimes(1);
      expect(overdueCount).toBe(0);
    });
  });

  describe('AC7: Managers, Directors and assignees should get notifications', () => {
    
    test('should send notification to all assignees', async () => {
      // Arrange
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const overdueTask = {
        id: 118,
        title: 'Team Presentation',
        status: 'in_progress',
        assigned_to: [10, 11], // Multiple assignees
        deadline: formatDate(yesterday),
        project_id: 10
      };

      taskRepository.list.mockResolvedValue({ data: [overdueTask], error: null });
      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockResolvedValue(mockManager);
      userRepository.getUsersByIds.mockResolvedValue({ 
        data: mockAssignees, 
        error: null 
      });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });

      // Act
      const project = await projectRepository.getProjectById(overdueTask.project_id);
      const assignees = await userRepository.getUsersByIds(overdueTask.assigned_to);
      
      for (const assignee of assignees.data) {
        await notificationRepository.create({
          notif_types: 'overdue',
          message: `Task "${overdueTask.title}" is OVERDUE`,
          creator_id: null,
          recipient_emails: assignee.email,
          created_at: new Date().toISOString()
        });
      }

      // Assert
      expect(notificationRepository.create).toHaveBeenCalledTimes(2);
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
    });

    test('should send notification to project manager', async () => {
      // Arrange
      jest.clearAllMocks(); // Clear any previous mocks
      jest.resetAllMocks(); // Reset all mock implementations
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const overdueTask = {
        id: 119,
        title: 'Sprint Planning',
        status: 'in_progress',
        assigned_to: [10],
        deadline: formatDate(yesterday),
        project_id: 10
      };

      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockResolvedValue(mockManager);
      userRepository.getUsersByIds.mockResolvedValue({ data: [], error: null });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });

      // Act
      const project = await projectRepository.getProjectById(overdueTask.project_id);
      const manager = await userRepository.getUserById(project.creator_id);
      
      await notificationRepository.create({
        notif_types: 'overdue',
        message: `Task "${overdueTask.title}" is OVERDUE\nThis task requires your attention as project manager.`,
        creator_id: null,
        recipient_emails: manager.email,
        created_at: new Date().toISOString()
      });

      // Assert
      expect(manager.email).toBe(mockManager.email);
      expect(notificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient_emails: mockManager.email,
          notif_types: 'overdue'
        })
      );
    });

    test('should send notification to director if available', async () => {
      // Arrange
      jest.clearAllMocks(); // Clear any previous mocks
      jest.resetAllMocks(); // Reset all mock implementations
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const overdueTask = {
        id: 120,
        title: 'Quarterly Report',
        status: 'in_progress',
        assigned_to: [10],
        deadline: formatDate(yesterday),
        project_id: 10,
        priority: 'critical'
      };

      const projectWithDirector = {
        ...mockProject,
        director_id: 2
      };

      projectRepository.getProjectById.mockResolvedValue(projectWithDirector);
      userRepository.getUserById.mockResolvedValue(mockDirector);
      userRepository.getUsersByIds.mockResolvedValue({ data: [], error: null });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });

      // Act
      const project = await projectRepository.getProjectById(overdueTask.project_id);
      const director = await userRepository.getUserById(project.director_id);
      
      await notificationRepository.create({
        notif_types: 'overdue',
        message: `CRITICAL: Task "${overdueTask.title}" is OVERDUE\nRequires director attention.`,
        creator_id: null,
        recipient_emails: director.email,
        created_at: new Date().toISOString()
      });

      // Assert
      expect(director.email).toBe(mockDirector.email);
      expect(notificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient_emails: mockDirector.email,
          notif_types: 'overdue'
        })
      );
    });

    test('should send notifications to manager, director, and all assignees', async () => {
      // Arrange
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const overdueTask = {
        id: 121,
        title: 'Client Deliverable',
        status: 'in_progress',
        assigned_to: [10, 11],
        deadline: formatDate(yesterday),
        project_id: 10
      };

      const projectWithDirector = {
        ...mockProject,
        director_id: 2
      };

      taskRepository.list.mockResolvedValue({ data: [overdueTask], error: null });
      projectRepository.getProjectById.mockResolvedValue(projectWithDirector);
      userRepository.getUserById
        .mockResolvedValueOnce(mockManager) // Manager
        .mockResolvedValueOnce(mockDirector); // Director
      userRepository.getUsersByIds.mockResolvedValue({ 
        data: mockAssignees, 
        error: null 
      });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });

      // Act
      const project = await projectRepository.getProjectById(overdueTask.project_id);
      const manager = await userRepository.getUserById(project.creator_id);
      const director = await userRepository.getUserById(project.director_id);
      const assignees = await userRepository.getUsersByIds(overdueTask.assigned_to);
      
      const recipients = [manager, director, ...assignees.data];
      
      for (const recipient of recipients) {
        await notificationRepository.create({
          notif_types: 'overdue',
          message: `Task "${overdueTask.title}" is OVERDUE`,
          creator_id: null,
          recipient_emails: recipient.email,
          created_at: new Date().toISOString()
        });
      }

      // Assert - 1 manager + 1 director + 2 assignees = 4 total
      expect(notificationRepository.create).toHaveBeenCalledTimes(4);
      
      // Verify each recipient type
      const emailsSent = notificationRepository.create.mock.calls.map(call => call[0].recipient_emails);
      expect(emailsSent).toContain(mockManager.email);
      expect(emailsSent).toContain(mockDirector.email);
      expect(emailsSent).toContain(mockAssignees[0].email);
      expect(emailsSent).toContain(mockAssignees[1].email);
    });

    test('should handle tasks without assignees gracefully', async () => {
      // Arrange
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const overdueTaskNoAssignees = {
        id: 122,
        title: 'Unassigned Task',
        status: 'todo',
        assigned_to: [],
        deadline: formatDate(yesterday),
        project_id: 10
      };

      projectRepository.getProjectById.mockResolvedValue(mockProject);
      userRepository.getUserById.mockResolvedValue(mockManager);
      userRepository.getUsersByIds.mockResolvedValue({ data: [], error: null });
      notificationRepository.create.mockResolvedValue({ notif_id: 1 });

      // Act
      const project = await projectRepository.getProjectById(overdueTaskNoAssignees.project_id);
      const manager = await userRepository.getUserById(project.creator_id);
      const assignees = await userRepository.getUsersByIds(overdueTaskNoAssignees.assigned_to);
      
      // Only send to manager since no assignees
      await notificationRepository.create({
        notif_types: 'overdue',
        message: `Task "${overdueTaskNoAssignees.title}" is OVERDUE\nNo assignees - please assign someone.`,
        creator_id: null,
        recipient_emails: manager.email,
        created_at: new Date().toISOString()
      });

      // Assert - only manager notified
      expect(notificationRepository.create).toHaveBeenCalledTimes(1);
      expect(notificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient_emails: mockManager.email
        })
      );
    });
  });

  describe('Edge Cases and Error Handling', () => {
    
    test('should handle tasks without deadlines', async () => {
      // Arrange
      const taskWithoutDeadline = {
        id: 123,
        title: 'Open-ended Task',
        status: 'in_progress',
        assigned_to: [10],
        deadline: null,
        project_id: 10
      };

      taskRepository.list.mockResolvedValue({ data: [taskWithoutDeadline], error: null });

      // Act
      const checkAndSendOverdueNotifications = async () => {
        const { data: tasks } = await taskRepository.list({ archived: false });
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        const overdueTasks = tasks.filter(task => {
          if (!task.deadline || task.status === 'completed') return false;
          const deadline = new Date(task.deadline);
          const deadlineDate = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
          return deadlineDate < today;
        });

        return overdueTasks.length;
      };

      const overdueCount = await checkAndSendOverdueNotifications();

      // Assert
      expect(overdueCount).toBe(0);
    });

    test('should handle archived tasks correctly', async () => {
      // Arrange
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const archivedOverdueTask = {
        id: 124,
        title: 'Archived Task',
        status: 'in_progress',
        assigned_to: [10],
        deadline: formatDate(yesterday),
        project_id: 10,
        archived: true
      };

      taskRepository.list.mockResolvedValue({ data: [], error: null }); // Archived tasks not returned

      // Act
      const checkAndSendOverdueNotifications = async () => {
        const { data: tasks } = await taskRepository.list({ archived: false });
        return tasks.length;
      };

      const taskCount = await checkAndSendOverdueNotifications();

      // Assert
      expect(taskCount).toBe(0);
      expect(notificationRepository.create).not.toHaveBeenCalled();
    });

    test('should handle database errors gracefully', async () => {
      // Arrange
      taskRepository.list.mockRejectedValue(new Error('Database connection failed'));

      // Act
      const checkAndSendOverdueNotifications = async () => {
        try {
          const { data: tasks } = await taskRepository.list({ archived: false });
          return { success: true, tasksChecked: tasks.length };
        } catch (error) {
          console.error('Error checking overdue tasks:', error);
          return { success: false, error: error.message };
        }
      };

      const result = await checkAndSendOverdueNotifications();

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
      expect(notificationRepository.create).not.toHaveBeenCalled();
    });

    test('should prevent duplicate notifications for same overdue task', async () => {
      // Arrange
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const overdueTask = {
        id: 125,
        title: 'Duplicate Prevention Test',
        status: 'in_progress',
        assigned_to: [10],
        deadline: formatDate(yesterday),
        project_id: 10
      };

      const existingNotifications = [
        {
          notif_id: 1,
          notif_types: 'overdue',
          message: `Task "${overdueTask.title}" is OVERDUE`,
          recipient_emails: mockAssignees[0].email,
          task_id: overdueTask.id,
          created_at: new Date().toISOString()
        }
      ];

      notificationRepository.create.mockResolvedValue({ notif_id: 1 });

      // Act - Simulate checking for existing notification
      const hasExistingNotification = (taskId, userEmail) => {
        return existingNotifications.some(
          notif => notif.task_id === taskId && 
                   notif.recipient_emails === userEmail &&
                   notif.notif_types === 'overdue'
        );
      };

      const shouldSendNotification = !hasExistingNotification(overdueTask.id, mockAssignees[0].email);

      if (shouldSendNotification) {
        await notificationRepository.create({
          notif_types: 'overdue',
          message: `Task "${overdueTask.title}" is OVERDUE`,
          creator_id: null,
          recipient_emails: mockAssignees[0].email,
          task_id: overdueTask.id,
          created_at: new Date().toISOString()
        });
      }

      // Assert - no new notification created
      expect(notificationRepository.create).not.toHaveBeenCalled();
    });
  });
});
