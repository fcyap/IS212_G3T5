const taskAssigneeHoursRepository = require('../../src/repository/taskAssigneeHoursRepository');
const supabase = require('../../src/utils/supabase');

jest.mock('../../src/utils/supabase');

describe('TaskAssigneeHoursRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('upsert', () => {
    it('should successfully upsert task assignee hours', async () => {
      const mockData = {
        task_id: 1,
        user_id: 10,
        hours: 5
      };

      supabase.from = jest.fn().mockReturnValue({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockData,
              error: null
            })
          })
        })
      });

      const result = await taskAssigneeHoursRepository.upsert({
        taskId: 1,
        userId: 10,
        hours: 5
      });

      expect(result).toEqual(mockData);
      expect(supabase.from).toHaveBeenCalledWith('task_assignee_hours');
    });

    it('should throw error on upsert failure', async () => {
      supabase.from = jest.fn().mockReturnValue({
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' }
            })
          })
        })
      });

      await expect(
        taskAssigneeHoursRepository.upsert({
          taskId: 1,
          userId: 10,
          hours: 5
        })
      ).rejects.toThrow('Database error');
    });
  });

  describe('findByTask', () => {
    it('should return task assignee hours for a task', async () => {
      const mockData = [
        { task_id: 1, user_id: 10, hours: 5 },
        { task_id: 1, user_id: 11, hours: 3 }
      ];

      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockData,
            error: null
          })
        })
      });

      const result = await taskAssigneeHoursRepository.findByTask(1);

      expect(result).toEqual(mockData);
      expect(supabase.from).toHaveBeenCalledWith('task_assignee_hours');
    });

    it('should return empty array when no hours found', async () => {
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: null
          })
        })
      });

      const result = await taskAssigneeHoursRepository.findByTask(999);

      expect(result).toEqual([]);
    });

    it('should throw error on query failure', async () => {
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' }
          })
        })
      });

      await expect(
        taskAssigneeHoursRepository.findByTask(1)
      ).rejects.toThrow('Database error');
    });
  });

  describe('deleteByTaskAndUsers', () => {
    it('should delete hours for specified users', async () => {
      const mockData = [
        { user_id: 10 },
        { user_id: 11 }
      ];

      supabase.from = jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({
                data: mockData,
                error: null
              })
            })
          })
        })
      });

      const result = await taskAssigneeHoursRepository.deleteByTaskAndUsers(1, [10, 11]);

      expect(result).toEqual({
        deletedCount: 2,
        deletedUserIds: [10, 11]
      });
      expect(supabase.from).toHaveBeenCalledWith('task_assignee_hours');
    });

    it('should return zero deletedCount for empty userIds array', async () => {
      const result = await taskAssigneeHoursRepository.deleteByTaskAndUsers(1, []);

      expect(result).toEqual({ deletedCount: 0 });
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('should return zero deletedCount for non-array userIds', async () => {
      const result = await taskAssigneeHoursRepository.deleteByTaskAndUsers(1, null);

      expect(result).toEqual({ deletedCount: 0 });
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('should throw error on delete failure', async () => {
      supabase.from = jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database error' }
              })
            })
          })
        })
      });

      await expect(
        taskAssigneeHoursRepository.deleteByTaskAndUsers(1, [10, 11])
      ).rejects.toThrow('Database error');
    });

    it('should handle null data response gracefully', async () => {
      supabase.from = jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({
                data: null,
                error: null
              })
            })
          })
        })
      });

      const result = await taskAssigneeHoursRepository.deleteByTaskAndUsers(1, [10]);

      expect(result).toEqual({
        deletedCount: 0,
        deletedUserIds: []
      });
    });
  });
});
