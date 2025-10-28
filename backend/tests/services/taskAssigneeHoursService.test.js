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
});
