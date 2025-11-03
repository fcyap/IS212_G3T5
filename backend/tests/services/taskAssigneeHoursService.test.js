const taskAssigneeHoursService = require('../../src/services/taskAssigneeHoursService');
const taskAssigneeHoursRepository = require('../../src/repository/taskAssigneeHoursRepository');

jest.mock('../../src/repository/taskAssigneeHoursRepository');

describe('taskAssigneeHoursService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('recordHours', () => {
    test('should normalise ids and hours then upsert', async () => {
      const upsertResult = { task_id: 12, user_id: 5, hours: 3.25 };
      taskAssigneeHoursRepository.upsert.mockResolvedValue(upsertResult);

      const result = await taskAssigneeHoursService.recordHours({
        taskId: '12',
        userId: '5',
        hours: 3.251
      });

      expect(taskAssigneeHoursRepository.upsert).toHaveBeenCalledWith({
        taskId: 12,
        userId: 5,
        hours: 3.25
      });
      expect(result).toEqual(upsertResult);
    });

    test('should reject negative hours', async () => {
      await expect(
        taskAssigneeHoursService.recordHours({ taskId: 1, userId: 1, hours: -2 })
      ).rejects.toThrow('Hours spent must be a non-negative number');
      expect(taskAssigneeHoursRepository.upsert).not.toHaveBeenCalled();
    });

    test('should reject taskId that is not a positive integer', async () => {
      await expect(
        taskAssigneeHoursService.recordHours({ taskId: 'abc', userId: 1, hours: 1 })
      ).rejects.toThrow('taskId must be a positive integer');
      await expect(
        taskAssigneeHoursService.recordHours({ taskId: 0, userId: 1, hours: 1 })
      ).rejects.toThrow('taskId must be a positive integer');
      expect(taskAssigneeHoursRepository.upsert).not.toHaveBeenCalled();
    });

    test('should reject userId that is not a positive integer', async () => {
      await expect(
        taskAssigneeHoursService.recordHours({ taskId: 1, userId: 0, hours: 1 })
      ).rejects.toThrow('userId must be a positive integer');
      await expect(
        taskAssigneeHoursService.recordHours({ taskId: 1, userId: 'foo', hours: 1 })
      ).rejects.toThrow('userId must be a positive integer');
      expect(taskAssigneeHoursRepository.upsert).not.toHaveBeenCalled();
    });

    test('should reject hours that exceed maximum', async () => {
      await expect(
        taskAssigneeHoursService.recordHours({ taskId: 1, userId: 1, hours: 20000 })
      ).rejects.toThrow('Hours spent cannot exceed 10000');
      expect(taskAssigneeHoursRepository.upsert).not.toHaveBeenCalled();
    });
  });

  describe('getTaskHoursSummary', () => {
    test('should return total and per assignee hours', async () => {
      taskAssigneeHoursRepository.findByTask.mockResolvedValue([
        { task_id: 42, user_id: 1, hours: 1.75 },
        { task_id: 42, user_id: 2, hours: 2.5 }
      ]);

      const summary = await taskAssigneeHoursService.getTaskHoursSummary(42, [1, 2]);

      expect(taskAssigneeHoursRepository.findByTask).toHaveBeenCalledWith(42);
      expect(summary).toEqual({
        total_hours: 4.25,
        per_assignee: [
          { user_id: 1, hours: 1.75 },
          { user_id: 2, hours: 2.5 }
        ]
      });
    });

    test('should include zero entries for provided assignees without hours', async () => {
      taskAssigneeHoursRepository.findByTask.mockResolvedValue([
        { task_id: 99, user_id: 5, hours: 4 }
      ]);

      const summary = await taskAssigneeHoursService.getTaskHoursSummary(99, [5, 6]);

      expect(summary).toEqual({
        total_hours: 4,
        per_assignee: [
          { user_id: 5, hours: 4 },
          { user_id: 6, hours: 0 }
        ]
      });
    });

    test('should throw when taskId is invalid', async () => {
      await expect(taskAssigneeHoursService.getTaskHoursSummary('foo')).rejects.toThrow(
        'taskId must be a positive integer'
      );
      expect(taskAssigneeHoursRepository.findByTask).not.toHaveBeenCalled();
    });

    test('should tolerate rows with invalid user_id or hours values', async () => {
      taskAssigneeHoursRepository.findByTask.mockResolvedValue([
        { task_id: 77, user_id: 'not-a-number', hours: 5 },
        { task_id: 77, user_id: 8, hours: '3.456' },
        { task_id: 77, user_id: 9, hours: 1.111 }
      ]);

      const summary = await taskAssigneeHoursService.getTaskHoursSummary(77);

      expect(summary).toEqual({
        total_hours: 4.57,
        per_assignee: [
          { user_id: 8, hours: 3.46 },
          { user_id: 9, hours: 1.11 }
        ]
      });
    });
  });

  describe('removeHoursForUsers', () => {
    test('should remove hours for specified users', async () => {
      const deleteResult = { deletedCount: 2, deletedUserIds: [1, 2] };
      taskAssigneeHoursRepository.deleteByTaskAndUsers.mockResolvedValue(deleteResult);

      const result = await taskAssigneeHoursService.removeHoursForUsers({
        taskId: 42,
        userIds: [1, 2]
      });

      expect(taskAssigneeHoursRepository.deleteByTaskAndUsers).toHaveBeenCalledWith(42, [1, 2]);
      expect(result).toEqual(deleteResult);
    });

    test('should normalize user IDs before deleting', async () => {
      const deleteResult = { deletedCount: 2, deletedUserIds: [5, 8] };
      taskAssigneeHoursRepository.deleteByTaskAndUsers.mockResolvedValue(deleteResult);

      await taskAssigneeHoursService.removeHoursForUsers({
        taskId: '42',
        userIds: ['5', 8.9]
      });

      expect(taskAssigneeHoursRepository.deleteByTaskAndUsers).toHaveBeenCalledWith(42, [5, 8]);
    });

    test('should return zero deleted count when userIds is empty', async () => {
      const result = await taskAssigneeHoursService.removeHoursForUsers({
        taskId: 42,
        userIds: []
      });

      expect(result).toEqual({ deletedCount: 0 });
      expect(taskAssigneeHoursRepository.deleteByTaskAndUsers).not.toHaveBeenCalled();
    });

    test('should handle invalid user IDs gracefully', async () => {
      const result = await taskAssigneeHoursService.removeHoursForUsers({
        taskId: 42,
        userIds: ['invalid', null, undefined, -1, 0]
      });

      expect(result).toEqual({ deletedCount: 0 });
      expect(taskAssigneeHoursRepository.deleteByTaskAndUsers).not.toHaveBeenCalled();
    });

    test('should throw when taskId is invalid', async () => {
      await expect(
        taskAssigneeHoursService.removeHoursForUsers({ taskId: 'invalid', userIds: [1] })
      ).rejects.toThrow('taskId must be a positive integer');

      await expect(
        taskAssigneeHoursService.removeHoursForUsers({ taskId: 0, userIds: [1] })
      ).rejects.toThrow('taskId must be a positive integer');

      expect(taskAssigneeHoursRepository.deleteByTaskAndUsers).not.toHaveBeenCalled();
    });

    test('should filter out invalid user IDs and process valid ones', async () => {
      const deleteResult = { deletedCount: 2, deletedUserIds: [5, 10] };
      taskAssigneeHoursRepository.deleteByTaskAndUsers.mockResolvedValue(deleteResult);

      await taskAssigneeHoursService.removeHoursForUsers({
        taskId: 99,
        userIds: ['invalid', 5, null, 10, 'foo', -3]
      });

      expect(taskAssigneeHoursRepository.deleteByTaskAndUsers).toHaveBeenCalledWith(99, [5, 10]);
    });
  });
});
