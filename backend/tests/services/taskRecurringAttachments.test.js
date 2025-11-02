const taskService = require('../../src/services/taskService');
const taskRepository = require('../../src/repository/taskRepository');
const taskAttachmentService = require('../../src/services/taskAttachmentService');
const userRepository = require('../../src/repository/userRepository');
const projectRepository = require('../../src/repository/projectRepository');
const projectMemberRepository = require('../../src/repository/projectMemberRepository');
const notificationService = require('../../src/services/notificationService');
const taskAssigneeHoursService = require('../../src/services/taskAssigneeHoursService');

jest.mock('../../src/repository/taskRepository');
jest.mock('../../src/services/taskAttachmentService');
jest.mock('../../src/repository/userRepository');
jest.mock('../../src/repository/projectRepository');
jest.mock('../../src/repository/projectMemberRepository');
jest.mock('../../src/services/notificationService');
jest.mock('../../src/services/taskAssigneeHoursService');

describe('TaskService - Recurring Task Attachment Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations to prevent actual calls
    userRepository.getUserById = jest.fn().mockResolvedValue({ id: 1, name: 'Test User' });
    projectRepository.getProjectById = jest.fn().mockResolvedValue({ id: 1, name: 'Test Project' });
    projectMemberRepository.isUserInProject = jest.fn().mockResolvedValue(true);
    notificationService.createTaskAssignmentNotifications = jest.fn().mockResolvedValue({ notificationsSent: 0 });
    notificationService.createTaskDeletedNotification = jest.fn().mockResolvedValue(true);
    taskAssigneeHoursService.getTaskHoursSummary = jest.fn().mockResolvedValue({
      total_hours: 0,
      per_assignee: []
    });
    taskAssigneeHoursService.recordHours = jest.fn().mockResolvedValue(true);
    // Mock both insert and createTask methods
    taskRepository.insert = undefined;  // Ensure createTask is used
  });

  describe('createTask with attachment inheritance', () => {
    test('should copy attachments when creating recurring task', async () => {
      const parentTaskId = 123;
      const newTaskData = {
        title: 'Recurring Task',
        description: 'Task description',
        priority: 5,
        status: 'pending',
        project_id: 1,
        parent_id: parentTaskId,
        is_recurring: true,
        recurrence_frequency: 'weekly',
        assigned_to: [1, 2],
        creator_id: 1
      };

      const mockParentTask = {
        id: parentTaskId,
        title: 'Original Task',
        description: 'Original description',
        deadline: '2025-10-27',
        is_recurring: true,
        recurrence_frequency: 'weekly'
      };

      const mockNewTask = {
        id: 456,
        title: 'Recurring Task',
        parent_id: parentTaskId,
        is_recurring: true,
        recurrence_frequency: 'weekly',
        assigned_to: [1, 2],
        creator_id: 1,
        created_at: '2025-10-20T10:00:00Z'
      };

      const mockCopiedAttachments = [
        {
          id: 5,
          task_id: 456,
          file_name: 'document.pdf',
          file_type: 'application/pdf',
          file_size: 5242880,
          file_url: 'https://storage.example.com/attachments/456/document.pdf',
          uploaded_by: 1
        }
      ];

      taskRepository.getTaskById.mockResolvedValue(mockParentTask);
      taskRepository.createTask.mockResolvedValue(mockNewTask);
      taskAttachmentService.getAttachments.mockResolvedValue({
        attachments: [
          {
            id: 1,
            task_id: parentTaskId,
            file_name: 'document.pdf',
            file_type: 'application/pdf',
            file_size: 5242880
          }
        ],
        totalSize: 5242880
      });
      taskAttachmentService.copyAttachmentsToTask.mockResolvedValue({
        attachments: mockCopiedAttachments,
        totalSize: 5242880
      });

      const result = await taskService.createTask(newTaskData, 1);

      expect(taskRepository.createTask).toHaveBeenCalled();
      expect(taskAttachmentService.getAttachments).toHaveBeenCalledWith(parentTaskId);
      expect(taskAttachmentService.copyAttachmentsToTask).toHaveBeenCalledWith(
        parentTaskId,
        mockNewTask.id,
        1
      );
      expect(result.id).toBe(456);
    });

    test('should create task without copying attachments when parent has none', async () => {
      const parentTaskId = 123;
      const newTaskData = {
        title: 'Recurring Task',
        description: 'Task description',
        priority: 5,
        status: 'pending',
        project_id: 1,
        parent_id: parentTaskId,
        is_recurring: true,
        recurrence_frequency: 'weekly',
        assigned_to: [1],
        creator_id: 1
      };

      const mockParentTask = {
        id: parentTaskId,
        title: 'Original Task',
        is_recurring: true
      };

      const mockNewTask = {
        id: 456,
        title: 'Recurring Task',
        parent_id: parentTaskId,
        creator_id: 1
      };

      taskRepository.getTaskById.mockResolvedValue(mockParentTask);
      taskRepository.createTask.mockResolvedValue(mockNewTask);
      taskAttachmentService.getAttachments.mockResolvedValue({
        attachments: [],
        totalSize: 0
      });

      const result = await taskService.createTask(newTaskData, 1);

      expect(taskRepository.createTask).toHaveBeenCalled();
      expect(taskAttachmentService.getAttachments).toHaveBeenCalledWith(parentTaskId);
      expect(taskAttachmentService.copyAttachmentsToTask).not.toHaveBeenCalled();
      expect(result.id).toBe(456);
    });

    test('should handle attachment copy failure gracefully', async () => {
      const parentTaskId = 123;
      const newTaskData = {
        title: 'Recurring Task',
        description: 'Task description',
        priority: 5,
        status: 'pending',
        project_id: 1,
        parent_id: parentTaskId,
        is_recurring: true,
        recurrence_frequency: 'weekly',
        assigned_to: [1],
        creator_id: 1
      };

      const mockParentTask = {
        id: parentTaskId,
        title: 'Original Task',
        is_recurring: true
      };

      const mockNewTask = {
        id: 456,
        title: 'Recurring Task',
        parent_id: parentTaskId
      };

      taskRepository.getTaskById.mockResolvedValue(mockParentTask);
      taskRepository.createTask.mockResolvedValue(mockNewTask);
      taskAttachmentService.getAttachments.mockResolvedValue({
        attachments: [
          {
            id: 1,
            task_id: parentTaskId,
            file_name: 'document.pdf'
          }
        ],
        totalSize: 5242880
      });
      taskAttachmentService.copyAttachmentsToTask.mockRejectedValue(
        new Error('Storage copy failed')
      );

      // Task should still be created even if attachment copy fails
      const result = await taskService.createTask(newTaskData, 1);

      expect(result.id).toBe(456);
      expect(taskAttachmentService.copyAttachmentsToTask).toHaveBeenCalled();
    });

    test('should not copy attachments for non-recurring tasks', async () => {
      const newTaskData = {
        title: 'Regular Task',
        description: 'Task description',
        priority: 5,
        status: 'pending',
        project_id: 1,
        is_recurring: false,
        assigned_to: [1],
        creator_id: 1
      };

      const mockNewTask = {
        id: 456,
        title: 'Regular Task',
        is_recurring: false
      };

      taskRepository.createTask.mockResolvedValue(mockNewTask);

      const result = await taskService.createTask(newTaskData, 1);

      expect(taskRepository.createTask).toHaveBeenCalled();
      expect(taskAttachmentService.getAttachments).not.toHaveBeenCalled();
      expect(taskAttachmentService.copyAttachmentsToTask).not.toHaveBeenCalled();
      expect(result.id).toBe(456);
    });

    test('should copy attachments even when size is close to 50MB limit', async () => {
      const parentTaskId = 123;
      const newTaskData = {
        title: 'Recurring Task',
        description: 'Task description',
        priority: 5,
        status: 'pending',
        project_id: 1,
        parent_id: parentTaskId,
        is_recurring: true,
        assigned_to: [1],
        creator_id: 1
      };

      const mockParentTask = {
        id: parentTaskId,
        title: 'Original Task',
        is_recurring: true
      };

      const mockNewTask = {
        id: 456,
        title: 'Recurring Task',
        parent_id: parentTaskId
      };

      const largeAttachments = [
        {
          id: 1,
          task_id: parentTaskId,
          file_name: 'large_file1.pdf',
          file_size: 25 * 1024 * 1024 // 25MB
        },
        {
          id: 2,
          task_id: parentTaskId,
          file_name: 'large_file2.pdf',
          file_size: 24 * 1024 * 1024 // 24MB (total 49MB)
        }
      ];

      taskRepository.getTaskById.mockResolvedValue(mockParentTask);
      taskRepository.createTask.mockResolvedValue(mockNewTask);
      taskAttachmentService.getAttachments.mockResolvedValue({
        attachments: largeAttachments,
        totalSize: 49 * 1024 * 1024
      });
      taskAttachmentService.copyAttachmentsToTask.mockResolvedValue({
        attachments: largeAttachments.map(att => ({ ...att, task_id: 456 })),
        totalSize: 49 * 1024 * 1024
      });

      const result = await taskService.createTask(newTaskData, 1);

      expect(taskAttachmentService.copyAttachmentsToTask).toHaveBeenCalled();
      expect(result.id).toBe(456);
    });
  });

  describe('updateTask - attachment preservation', () => {
    test('should preserve attachments when updating task details', async () => {
      const taskId = 123;
      const updateData = {
        title: 'Updated Task Title',
        description: 'Updated description',
        status: 'in-progress'
      };

      const mockExistingTask = {
        id: taskId,
        title: 'Original Title',
        description: 'Original description',
        status: 'pending',
        assigned_to: [1],
        creator_id: 1
      };

      const mockUpdatedTask = {
        id: taskId,
        title: 'Updated Task Title',
        description: 'Updated description',
        status: 'in-progress',
        assigned_to: [1],
        creator_id: 1
      };

      taskRepository.getTaskById.mockResolvedValue(mockExistingTask);
      taskRepository.updateTask = jest.fn().mockResolvedValue(mockUpdatedTask);
      taskRepository.updateById = jest.fn().mockResolvedValue(mockUpdatedTask);

      const result = await taskService.updateTask(taskId, updateData);

      // Check either updateById or updateTask was called
      const updateCalled = taskRepository.updateById.mock.calls.length > 0 ||
                          taskRepository.updateTask.mock.calls.length > 0;
      expect(updateCalled).toBe(true);
      expect(result.id).toBe(taskId);
      expect(result.title).toBe('Updated Task Title');
      // Attachments should not be affected by task updates
      expect(taskAttachmentService.deleteByTaskId).not.toHaveBeenCalled();
    });

    test('should not remove attachments when archiving task', async () => {
      const taskId = 123;
      const updateData = {
        archived: true
      };

      const mockExistingTask = {
        id: taskId,
        title: 'Task',
        archived: false,
        assigned_to: [1],
        creator_id: 1
      };

      const mockUpdatedTask = {
        id: taskId,
        title: 'Task',
        archived: true,
        assigned_to: [1],
        creator_id: 1
      };

      taskRepository.getTaskById.mockResolvedValue(mockExistingTask);
      taskRepository.updateTask = jest.fn().mockResolvedValue(mockUpdatedTask);
      taskRepository.updateById = jest.fn().mockResolvedValue(mockUpdatedTask);

      const result = await taskService.updateTask(taskId, updateData);

      expect(result.archived).toBe(true);
      // Attachments should be preserved even when task is archived
      expect(taskAttachmentService.deleteByTaskId).not.toHaveBeenCalled();
    });
  });

  describe('deleteTask - attachment cleanup', () => {
    test('should delete attachments when deleting task', async () => {
      const taskId = 123;

      const mockTask = {
        id: taskId,
        title: 'Task to Delete'
      };

      taskRepository.getTaskById.mockResolvedValue(mockTask);
      taskRepository.deleteTask.mockResolvedValue(true);
      taskAttachmentService.deleteByTaskId = jest.fn().mockResolvedValue(true);

      await taskService.deleteTask(taskId);

      expect(taskRepository.deleteTask).toHaveBeenCalledWith(taskId);
      expect(taskAttachmentService.deleteByTaskId).toHaveBeenCalledWith(taskId);
    });

    test('should handle case when task has no attachments', async () => {
      const taskId = 123;

      const mockTask = {
        id: taskId,
        title: 'Task to Delete'
      };

      taskRepository.getTaskById.mockResolvedValue(mockTask);
      taskRepository.deleteTask.mockResolvedValue(true);
      taskAttachmentService.deleteByTaskId = jest.fn().mockResolvedValue(true);

      await taskService.deleteTask(taskId);

      expect(taskRepository.deleteTask).toHaveBeenCalledWith(taskId);
      expect(taskAttachmentService.deleteByTaskId).toHaveBeenCalledWith(taskId);
    });
  });
});
