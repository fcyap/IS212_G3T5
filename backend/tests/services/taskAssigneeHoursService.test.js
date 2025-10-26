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
  });
});
