jest.mock('../../src/repository/notificationRepository', () => ({
  create: jest.fn(),
  getByRecipientEmail: jest.fn(),
  getByUserEmail: jest.fn(),
  getById: jest.fn(),
  getCountByRecipient: jest.fn(),
  getHistoryByRecipient: jest.fn(),
  getByCreatorId: jest.fn(),
  getAll: jest.fn()
}));

jest.mock('../../src/repository/userRepository', () => ({
  getUserById: jest.fn(),
  getUsersByIds: jest.fn()
}));

jest.mock('../../src/repository/projectRepository', () => ({
  getProjectById: jest.fn()
}));

jest.mock('../../src/repository/taskRepository', () => ({
  getTaskById: jest.fn(),
  list: jest.fn()
}));

jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn()
}));

const notificationRepository = require('../../src/repository/notificationRepository');
const userRepository = require('../../src/repository/userRepository');
const projectRepository = require('../../src/repository/projectRepository');
const taskRepository = require('../../src/repository/taskRepository');
const sgMail = require('@sendgrid/mail');
const notificationService = require('../../src/services/notificationService');

const ORIGINAL_SENDGRID_KEY = process.env.SENDGRID_API_KEY;
const ORIGINAL_FROM_EMAIL = process.env.FROM_EMAIL;

const setSendGridKey = (value) => {
  if (value === undefined || value === null) {
    delete process.env.SENDGRID_API_KEY;
  } else {
    process.env.SENDGRID_API_KEY = value;
  }
};

const setFromEmail = (value) => {
  if (value === undefined || value === null) {
    delete process.env.FROM_EMAIL;
  } else {
    process.env.FROM_EMAIL = value;
  }
};

describe('notificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setSendGridKey(ORIGINAL_SENDGRID_KEY);
    setFromEmail(ORIGINAL_FROM_EMAIL);
  });

  describe('createProjectInvitationNotification', () => {
    it('creates notification and sends email when data is valid', async () => {
      const originalApiKey = process.env.SENDGRID_API_KEY;
      process.env.SENDGRID_API_KEY = 'test-key';
      projectRepository.getProjectById.mockResolvedValue({ id: 1, name: 'Apollo' });
      userRepository.getUserById
        .mockResolvedValueOnce({ id: 10, name: 'Inviter', email: 'inviter@example.com' })
        .mockResolvedValueOnce({ id: 20, name: 'Invitee', email: 'invitee@example.com' });
      notificationRepository.create.mockResolvedValue({ notif_id: 99 });
      sgMail.send.mockResolvedValue([{ headers: { 'x-message-id': 'abc' } }]);

      const result = await notificationService.createProjectInvitationNotification(
        1,
        20,
        10,
        'collaborator',
        'Welcome aboard'
      );

      expect(notificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          notif_types: 'invitation',
          creator_id: 10,
          recipient_emails: 'invitee@example.com'
        })
      );
      expect(sgMail.send).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ notif_id: 99 });
      process.env.SENDGRID_API_KEY = originalApiKey;
    });

    it('throws when project is missing', async () => {
      projectRepository.getProjectById.mockResolvedValue(null);

      await expect(
        notificationService.createProjectInvitationNotification(1, 20, 10, 'role')
      ).rejects.toThrow('Project not found');
    });
  });

  describe('createCommentNotification', () => {
    it('creates notifications for task assignees (excluding commenter)', async () => {
      setSendGridKey('key');
      setFromEmail('from@example.com');
      sgMail.send.mockResolvedValue([{ headers: {} }]);
      taskRepository.getTaskById.mockResolvedValue({
        id: 5,
        title: 'Review PR',
        assigned_to: [100, 101]
      });
      userRepository.getUserById.mockImplementation(async (id) => {
        if (id === 101) return { id, email: 'reviewer@example.com', name: 'Reviewer' };
        return { id, email: 'author@example.com', name: 'Author' };
      });
      notificationRepository.create.mockResolvedValue({ id: 1 });
      sgMail.send.mockResolvedValue([{ headers: {} }]);

      const result = await notificationService.createCommentNotification({
        taskId: 5,
        commentId: 12,
        commentContent: 'Looks good to me',
        commenterId: 100,
        commenterName: 'Author'
      });

      expect(result.notificationsSent).toBe(1);
      expect(notificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          notif_types: 'comment',
          creator_id: 100,
          recipient_emails: 'reviewer@example.com'
        })
      );
      expect(sgMail.send).toHaveBeenCalledTimes(1);
    });

    it('returns zero when task has no assignees', async () => {
      taskRepository.getTaskById.mockResolvedValue({
        id: 5,
        title: 'Review PR',
        assigned_to: []
      });

      const result = await notificationService.createCommentNotification({
        taskId: 5,
        commentId: 12,
        commentContent: 'Comment',
        commenterId: 100,
        commenterName: 'Author'
      });

      expect(result.notificationsSent).toBe(0);
      expect(notificationRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('task assignment lifecycle', () => {
    const baseTask = {
      id: 7,
      title: 'Spec Update',
      deadline: '2025-06-01T09:00:00.000Z',
      project_id: 22
    };

    const userLookup = [
      { id: 200, name: 'Manager', email: 'manager@example.com' },
      { id: 201, name: 'Alice', email: 'alice@example.com' },
      { id: 202, name: 'Bob', email: 'bob@example.com' }
    ];

    let fallbackSpy;
    let assignmentEmailSpy;
    let removalEmailSpy;

    beforeEach(() => {
      userRepository.getUsersByIds.mockResolvedValue(userLookup);
      fallbackSpy = jest
        .spyOn(notificationService, '_createNotificationWithFallback')
        .mockImplementation(async (payload) => ({ id: Date.now(), ...payload }));
      assignmentEmailSpy = jest
        .spyOn(notificationService, 'sendTaskAssignmentEmail')
        .mockResolvedValue();
      removalEmailSpy = jest
        .spyOn(notificationService, 'sendTaskRemovalEmail')
        .mockResolvedValue();
    });

    afterEach(() => {
      fallbackSpy.mockRestore();
      assignmentEmailSpy.mockRestore();
      removalEmailSpy.mockRestore();
    });

    it('creates notifications for newly assigned users', async () => {
      const result = await notificationService.createTaskAssignmentNotifications({
        task: baseTask,
        assigneeIds: [201, 202],
        assignedById: 200,
        previousAssigneeIds: [],
        currentAssigneeIds: [201, 202],
        notificationType: 'task_assignment'
      });

      expect(result.notificationsSent).toBe(2);
      expect(fallbackSpy).toHaveBeenCalledTimes(2);
      expect(assignmentEmailSpy).toHaveBeenCalledTimes(2);
      expect(fallbackSpy.mock.calls[0][0]).toMatchObject({
        notif_types: 'task_assignment',
        recipient_emails: 'alice@example.com'
      });
    });

    it('creates reassignment notifications with context', async () => {
      const result = await notificationService.createTaskAssignmentNotifications({
        task: baseTask,
        assigneeIds: [201, 202],
        assignedById: 200,
        previousAssigneeIds: [201],
        currentAssigneeIds: [201, 202],
        notificationType: 'reassignment'
      });

      expect(result.notificationsSent).toBe(2);
      expect(fallbackSpy).toHaveBeenCalledTimes(2);
      expect(fallbackSpy.mock.calls[0][0].notif_types).toBe('reassignment');
      expect(fallbackSpy.mock.calls[0][0].message).toContain('Old assignees: Alice');
      expect(fallbackSpy.mock.calls[0][0].message).toContain('New assignees: Alice, Bob');
    });

    it('creates removal notifications for users removed from task', async () => {
      const result = await notificationService.createTaskRemovalNotifications({
        task: baseTask,
        assigneeIds: [201],
        assignedById: 200,
        previousAssigneeIds: [201, 202],
        currentAssigneeIds: [202]
      });

      expect(result.notificationsSent).toBe(1);
      expect(fallbackSpy).toHaveBeenCalledTimes(1);
      expect(removalEmailSpy).toHaveBeenCalledTimes(1);
      expect(fallbackSpy.mock.calls[0][0]).toMatchObject({
        notif_types: 'remove_from_task',
        recipient_emails: 'alice@example.com'
      });
    });
  });

  describe('createTaskUpdateNotifications', () => {
    const task = {
      id: 42,
      title: 'Refine Requirements',
      description: 'Align with stakeholder feedback',
      assigned_to: [300, 301, 302]
    };

    const changes = [
      { field: 'status', label: 'Status', before: 'pending', after: 'in_progress' },
      { field: 'deadline', label: 'Deadline', before: 'None', after: '2025-09-01T00:00:00.000Z' }
    ];

    let fallbackSpy;
    let updateEmailSpy;

    beforeEach(() => {
      userRepository.getUsersByIds.mockResolvedValue([
        { id: 300, name: 'Actor', email: 'actor@example.com' },
        { id: 301, name: 'Casey', email: 'casey@example.com' },
        { id: 302, name: 'Drew', email: 'drew@example.com' }
      ]);
      fallbackSpy = jest
        .spyOn(notificationService, '_createNotificationWithFallback')
        .mockImplementation(async (payload) => ({ id: Date.now(), ...payload }));
      updateEmailSpy = jest
        .spyOn(notificationService, 'sendTaskUpdateEmail')
        .mockResolvedValue();
    });

    afterEach(() => {
      fallbackSpy.mockRestore();
      updateEmailSpy.mockRestore();
    });

    it('creates notifications for assignees excluding the actor', async () => {
      const result = await notificationService.createTaskUpdateNotifications({
        task,
        changes,
        updatedById: 300,
        assigneeIds: [300, 301, 302]
      });

      expect(result.notificationsSent).toBe(2);
      expect(userRepository.getUsersByIds).toHaveBeenCalledWith(expect.arrayContaining([300, 301, 302]));
      expect(fallbackSpy).toHaveBeenCalledTimes(2);
      expect(updateEmailSpy).toHaveBeenCalledTimes(2);
      expect(fallbackSpy.mock.calls[0][0]).toMatchObject({
        notif_types: 'task_modif',
        recipient_emails: 'casey@example.com',
        creator_id: 300
      });
      expect(fallbackSpy.mock.calls[0][0].message).toContain('updated "Refine Requirements"');
      expect(fallbackSpy.mock.calls[0][0].message).toContain('- Status');
    });

    it('returns zero notifications when no changes are provided', async () => {
      const result = await notificationService.createTaskUpdateNotifications({
        task,
        changes: [],
        updatedById: 300,
        assigneeIds: [300, 301]
      });

      expect(result.notificationsSent).toBe(0);
      expect(fallbackSpy).not.toHaveBeenCalled();
      expect(updateEmailSpy).not.toHaveBeenCalled();
    });

    it('skips recipients without email addresses', async () => {
      userRepository.getUsersByIds.mockResolvedValue([
        { id: 300, name: 'Actor', email: 'actor@example.com' },
        { id: 301, name: 'Casey' }, // missing email
        { id: 302, name: 'Drew', email: 'drew@example.com' }
      ]);

      const result = await notificationService.createTaskUpdateNotifications({
        task,
        changes,
        updatedById: 300,
        assigneeIds: [300, 301, 302]
      });

      expect(result.notificationsSent).toBe(1);
      expect(fallbackSpy).toHaveBeenCalledTimes(1);
      expect(fallbackSpy.mock.calls[0][0].recipient_emails).toBe('drew@example.com');
    });
  });

  describe('_createNotificationWithFallback', () => {
    it('retries with general type when enum error is thrown', async () => {
      notificationRepository.create
        .mockRejectedValueOnce(new Error('invalid input value for enum notif_types'))
        .mockResolvedValueOnce({ notif_types: 'general' });

      const result = await notificationService._createNotificationWithFallback({
        notif_types: 'custom_type',
        message: 'payload'
      });

      expect(notificationRepository.create).toHaveBeenCalledTimes(2);
      expect(notificationRepository.create.mock.calls[1][0].notif_types).toBe('general');
      expect(result).toEqual({ notif_types: 'general' });
    });

    it('rethrows non-enum errors', async () => {
      notificationRepository.create.mockRejectedValue(new Error('database down'));

      await expect(
        notificationService._createNotificationWithFallback({ notif_types: 'custom' })
      ).rejects.toThrow('database down');
      expect(notificationRepository.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('_fetchUsersByIds', () => {
    it('returns map keyed by user id', async () => {
      userRepository.getUsersByIds.mockResolvedValue([
        { id: 1, name: 'A' },
        { id: 2, name: 'B' }
      ]);

      const map = await notificationService._fetchUsersByIds([1, '2', 2, null]);

      expect(userRepository.getUsersByIds).toHaveBeenCalledWith(expect.arrayContaining([1, 2]));
      expect(map.get(1).name).toBe('A');
      expect(map.get(2).name).toBe('B');
    });

    it('returns empty map when repository method is missing', async () => {
      const original = userRepository.getUsersByIds;
      delete userRepository.getUsersByIds;

      try {
        const map = await notificationService._fetchUsersByIds([1]);
        expect(map.size).toBe(0);
      } finally {
        userRepository.getUsersByIds = original;
      }
    });
  });

  describe('_format helpers', () => {
    it('formats user list with fallbacks', () => {
      const map = new Map([
        [1, { id: 1, name: 'Alice' }],
        [2, { id: 2, email: 'bob@example.com' }]
      ]);

      expect(notificationService._formatUserList([1, 2], map)).toBe('Alice, bob@example.com');
      expect(notificationService._formatUserList([3], map)).toBe('None');
      expect(notificationService._formatUserList(undefined, map)).toBe('None');
    });

    it('formats deadline values', () => {
      const iso = '2025-07-01T12:00:00.000Z';
      const formatted = notificationService._formatDeadline(iso);
      expect(formatted).toBe(new Date(iso).toLocaleString());
      expect(notificationService._formatDeadline('not-date')).toBe('not-date');
      expect(notificationService._formatDeadline(null)).toBe('No deadline set');
    });
  });

  describe('email helper functions', () => {
    const recipient = { id: 1, name: 'Recipient', email: 'recipient@example.com' };
    const task = {
      id: 9,
      title: 'Draft Report',
      project_id: 3,
      project: { name: 'Project X' },
      assignees: [{ name: 'Alice' }],
      status: 'in_progress',
      deadline: new Date().toISOString()
    };

    it('sendCommentEmail skips when API key missing', async () => {
      setSendGridKey(undefined);
      await notificationService.sendCommentEmail(recipient, task, 'Author', 'Preview', 1);
      expect(sgMail.send).not.toHaveBeenCalled();
    });

    it('sendCommentEmail sends when API key configured', async () => {
      setSendGridKey('key');
      setFromEmail('from@example.com');
      sgMail.send.mockResolvedValue([{ headers: { 'x-message-id': 'comment' } }]);

      await notificationService.sendCommentEmail(recipient, task, 'Author', 'Preview', 1);

      expect(sgMail.send).toHaveBeenCalledTimes(1);
    });

    it('sendTaskAssignmentEmail respects notificationType and API key', async () => {
      setSendGridKey('key');
      setFromEmail('from@example.com');
      sgMail.send.mockResolvedValue([{ headers: {} }]);

      await notificationService.sendTaskAssignmentEmail({
        recipient,
        task,
        assignerName: 'Manager',
        oldAssigneesLabel: 'Alice',
        newAssigneesLabel: 'Bob',
        deadlineLabel: 'Tomorrow',
        notificationType: 'reassignment'
      });

      expect(sgMail.send).toHaveBeenCalledTimes(1);
    });

    it('sendTaskAssignmentEmail skips when API key missing', async () => {
      setSendGridKey(undefined);

      await notificationService.sendTaskAssignmentEmail({
        recipient,
        task,
        assignerName: 'Manager',
        oldAssigneesLabel: 'A',
        newAssigneesLabel: 'B',
        deadlineLabel: 'Tomorrow'
      });

      expect(sgMail.send).not.toHaveBeenCalled();
    });

    it('sendTaskRemovalEmail sends when configured', async () => {
      setSendGridKey('key');
      setFromEmail('from@example.com');
      sgMail.send.mockResolvedValue([{ headers: {} }]);

      await notificationService.sendTaskRemovalEmail({
        recipient,
        task,
        assignerName: 'Manager',
        oldAssigneesLabel: 'Alice',
        newAssigneesLabel: 'Bob',
        deadlineLabel: 'Soon'
      });

      expect(sgMail.send).toHaveBeenCalledTimes(1);
    });

    it('sendTaskRemovalEmail skips when API key missing', async () => {
      setSendGridKey(undefined);

      await notificationService.sendTaskRemovalEmail({
        recipient,
        task,
        assignerName: 'Manager',
        oldAssigneesLabel: 'A',
        newAssigneesLabel: 'B',
        deadlineLabel: 'Soon'
      });

      expect(sgMail.send).not.toHaveBeenCalled();
    });

    it('sendDeadlineEmailNotification sends when configured', async () => {
      setSendGridKey('key');
      setFromEmail('from@example.com');
      sgMail.send.mockResolvedValue([{ headers: {} }]);

      const today = new Date();
      const taskDueToday = {
        ...task,
        deadline: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12).toISOString()
      };

      await notificationService.sendDeadlineEmailNotification(taskDueToday, recipient);

      expect(sgMail.send).toHaveBeenCalledTimes(1);
    });

    it('sendDeadlineEmailNotification skips when API key missing', async () => {
      setSendGridKey(undefined);

      await notificationService.sendDeadlineEmailNotification(task, recipient);

      expect(sgMail.send).not.toHaveBeenCalled();
    });
  });

  describe('repository passthrough methods', () => {
    it('getUserNotifications validates email', async () => {
      notificationRepository.getByRecipientEmail.mockResolvedValue(['notification']);
      const result = await notificationService.getUserNotifications('user@example.com', 5, 2);
      expect(notificationRepository.getByRecipientEmail).toHaveBeenCalledWith('user@example.com', { limit: 5, offset: 2, includeDismissed: true });
      expect(result).toEqual(['notification']);

      await expect(notificationService.getUserNotifications()).rejects.toThrow('User email is required');
    });

    it('getNotificationsByRecipient validates email', async () => {
      await notificationService.getNotificationsByRecipient('user@example.com', { limit: 1 });
      expect(notificationRepository.getByRecipientEmail).toHaveBeenCalledWith('user@example.com', { limit: 1 });

      await expect(notificationService.getNotificationsByRecipient()).rejects.toThrow('Recipient email is required');
    });

    it('getNotificationsByCreator validates creatorId', async () => {
      notificationRepository.getByCreatorId.mockResolvedValue(['created']);
      const result = await notificationService.getNotificationsByCreator(5, { limit: 1 });
      expect(notificationRepository.getByCreatorId).toHaveBeenCalledWith(5, { limit: 1 });
      expect(result).toEqual(['created']);

      await expect(notificationService.getNotificationsByCreator()).rejects.toThrow('Creator ID is required');
    });

    it('getNotificationById throws when missing', async () => {
      notificationRepository.getById.mockResolvedValue({ id: 1 });
      await expect(notificationService.getNotificationById(1)).resolves.toEqual({ id: 1 });

      notificationRepository.getById.mockResolvedValue(null);
      await expect(notificationService.getNotificationById(2)).rejects.toThrow('Notification not found');
    });

    it('getCountByRecipient validates input', async () => {
      notificationRepository.getCountByRecipient.mockResolvedValue(3);
      const count = await notificationService.getCountByRecipient('user@example.com');
      expect(notificationRepository.getCountByRecipient).toHaveBeenCalledWith('user@example.com');
      expect(count).toBe(3);

      await expect(notificationService.getCountByRecipient()).rejects.toThrow('Recipient email is required');
    });

    it('getNotificationHistory validates input', async () => {
      notificationRepository.getHistoryByRecipient.mockResolvedValue({ notifications: [] });
      await notificationService.getNotificationHistory('user@example.com', { limit: 1 });
      expect(notificationRepository.getHistoryByRecipient).toHaveBeenCalledWith('user@example.com', { limit: 1 });

      await expect(notificationService.getNotificationHistory()).rejects.toThrow('Recipient email is required');
    });

    it('getAllNotifications returns repository result', async () => {
      notificationRepository.getAll.mockResolvedValue({ notifications: [] });
      const result = await notificationService.getAllNotifications({ limit: 10 });
      expect(notificationRepository.getAll).toHaveBeenCalledWith({ limit: 10 });
      expect(result).toEqual({ notifications: [] });
    });
  });

  describe('project and task helpers', () => {
    it('getProjectManagers returns creator when available', async () => {
      projectRepository.getProjectById.mockResolvedValue({ creator_id: 5 });
      userRepository.getUserById.mockResolvedValue({ id: 5, email: 'manager@example.com' });

      const result = await notificationService.getProjectManagers(1);

      expect(projectRepository.getProjectById).toHaveBeenCalledWith(1);
      expect(result).toEqual([{ id: 5, email: 'manager@example.com' }]);
    });

    it('getProjectManagers returns empty array when project missing or error', async () => {
      projectRepository.getProjectById.mockResolvedValue(null);
      expect(await notificationService.getProjectManagers(1)).toEqual([]);

      projectRepository.getProjectById.mockRejectedValue(new Error('db error'));
      expect(await notificationService.getProjectManagers(1)).toEqual([]);
    });

    it('getTaskAssignees returns users or empty on error', async () => {
      userRepository.getUsersByIds.mockResolvedValue({ data: [{ id: 1 }], error: null });
      expect(await notificationService.getTaskAssignees([1])).toEqual([{ id: 1 }]);

      userRepository.getUsersByIds.mockResolvedValue({ data: null, error: new Error('db error') });
      expect(await notificationService.getTaskAssignees([1])).toEqual([]);

      userRepository.getUsersByIds.mockRejectedValue(new Error('unexpected'));
      expect(await notificationService.getTaskAssignees([1])).toEqual([]);
    });
  });

  describe('deadline notifications pipeline', () => {
    it('checkExistingDeadlineNotification detects recent deadline notification', async () => {
      const now = new Date().toISOString();
      notificationRepository.getByUserEmail.mockResolvedValue([
        { created_at: now, message: 'Task "123" reminder', notif_types: 'deadline' }
      ]);

      const hasNotification = await notificationService.checkExistingDeadlineNotification(123, 'manager@example.com');
      expect(hasNotification).toBe(true);
    });

    it('checkExistingDeadlineNotification returns false on error', async () => {
      notificationRepository.getByUserEmail.mockRejectedValue(new Error('db error'));
      await expect(notificationService.checkExistingDeadlineNotification(1, 'manager@example.com')).resolves.toBe(false);
    });

    it('createDeadlineNotification persists message and rethrows on error', async () => {
      const manager = { id: 1, email: 'manager@example.com' };
      const deadline = new Date();
      const task = {
        id: 2,
        title: 'Deploy',
        deadline: deadline.toISOString(),
        assignees: [{ name: 'Alice' }],
        project: { name: 'Project' }
      };

      notificationRepository.create.mockResolvedValue({ id: 1 });
      await notificationService.createDeadlineNotification(task, manager);
      expect(notificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          notif_types: 'deadline',
          recipient_emails: 'manager@example.com'
        })
      );

      notificationRepository.create.mockRejectedValue(new Error('insert error'));
      await expect(notificationService.createDeadlineNotification(task, manager)).rejects.toThrow('insert error');
    });

    it('checkAndSendDeadlineNotifications processes tasks', async () => {
      const getTasksSpy = jest.spyOn(notificationService, 'getTasksDueSoon').mockResolvedValue([{ id: 1, project_id: 2 }]);
      const getManagersSpy = jest.spyOn(notificationService, 'getProjectManagers').mockResolvedValue([{ id: 10, email: 'manager@example.com' }]);
      const checkExistingSpy = jest.spyOn(notificationService, 'checkExistingDeadlineNotification').mockResolvedValue(false);
      const createSpy = jest.spyOn(notificationService, 'createDeadlineNotification').mockResolvedValue();
      const sendSpy = jest.spyOn(notificationService, 'sendDeadlineEmailNotification').mockResolvedValue();

      const result = await notificationService.checkAndSendDeadlineNotifications();

      expect(result).toEqual({ notificationsSent: 1, tasksChecked: 1 });
      expect(createSpy).toHaveBeenCalledTimes(1);
      expect(sendSpy).toHaveBeenCalledTimes(1);

      getTasksSpy.mockRestore();
      getManagersSpy.mockRestore();
      checkExistingSpy.mockRestore();
      createSpy.mockRestore();
      sendSpy.mockRestore();
    });

    it('checkAndSendDeadlineNotifications handles empty task list', async () => {
      const getTasksSpy = jest.spyOn(notificationService, 'getTasksDueSoon').mockResolvedValue([]);
      const result = await notificationService.checkAndSendDeadlineNotifications();
      expect(result).toEqual({ notificationsSent: 0, tasksChecked: 0 });
      getTasksSpy.mockRestore();
    });

    it('checkAndSendDeadlineNotifications propagates unexpected errors', async () => {
      const getTasksSpy = jest.spyOn(notificationService, 'getTasksDueSoon').mockRejectedValue(new Error('failure'));
      await expect(notificationService.checkAndSendDeadlineNotifications()).rejects.toThrow('failure');
      getTasksSpy.mockRestore();
    });

    it('getTasksDueSoon filters and hydrates tasks', async () => {
      const today = new Date();
      const todayIso = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10).toISOString();
      const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 10).toISOString();

      taskRepository.list.mockResolvedValue({
        data: [
          { id: 1, deadline: todayIso, project_id: 1, assigned_to: [1] },
          { id: 2, deadline: tomorrow, project_id: 1, assigned_to: [1] },
          { id: 3, deadline: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3).toISOString(), project_id: 1, assigned_to: [1] },
          { id: 4, deadline: null, project_id: 1, assigned_to: [1] }
        ],
        error: null
      });

      projectRepository.getProjectById.mockResolvedValue({ id: 1, name: 'Project' });
      const assigneesSpy = jest.spyOn(notificationService, 'getTaskAssignees').mockResolvedValue([{ name: 'Alice' }]);

      const tasks = await notificationService.getTasksDueSoon();

      expect(tasks).toHaveLength(2);
      expect(tasks[0]).toHaveProperty('project');
      expect(tasks[0]).toHaveProperty('assignees');

      assigneesSpy.mockRestore();
    });

    it('getTasksDueSoon returns empty array on repository error', async () => {
      taskRepository.list.mockResolvedValue({ data: null, error: new Error('db error') });
      expect(await notificationService.getTasksDueSoon()).toEqual([]);
    });

    it('checkExistingDeadlineNotification ignores missing notifications', async () => {
      notificationRepository.getByUserEmail.mockResolvedValue([]);
      const result = await notificationService.checkExistingDeadlineNotification(1, 'manager@example.com');
      expect(result).toBe(false);
    });
  });
});
