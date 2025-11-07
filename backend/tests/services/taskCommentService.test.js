jest.mock('../../src/supabase-client', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('../../src/services/notificationService', () => ({
  createCommentNotification: jest.fn().mockResolvedValue({}),
}));

const { supabase } = require('../../src/supabase-client');
const { TaskCommentService } = require('../../src/services/tasks/taskCommentService');
const notificationService = require('../../src/services/notificationService');

describe('TaskCommentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildTree', () => {
    test('builds tree from flat comments', () => {
      const service = new TaskCommentService();
      const flatComments = [
        { id: 1, content: 'First', user_id: 1, created_at: '2024-01-01', parent_id: null, task_id: 1, users: { name: 'John Doe' } },
        { id: 2, content: 'Reply', user_id: 2, created_at: '2024-01-02', parent_id: 1, task_id: 1, users: { name: 'Jane Smith' } },
        { id: 3, content: 'Second', user_id: 1, created_at: '2024-01-03', parent_id: null, task_id: 1, users: { name: 'John Doe' } },
      ];

      const tree = service.buildTree(flatComments);

      expect(tree).toHaveLength(2);
      expect(tree[0].id).toBe(3); // Most recent first
      expect(tree[1].id).toBe(1);
      expect(tree[1].replies).toHaveLength(1);
      expect(tree[1].replies[0].id).toBe(2);
    });

    test('handles empty array', () => {
      const service = new TaskCommentService();
      const tree = service.buildTree([]);
      expect(tree).toEqual([]);
    });

    test('handles orphaned replies gracefully', () => {
      const service = new TaskCommentService();
      const flatComments = [
        { id: 1, content: 'Reply', user_id: 1, created_at: '2024-01-01', parent_id: 999, task_id: 1, users: { name: 'John Doe' } },
      ];

      const tree = service.buildTree(flatComments);
      expect(tree).toHaveLength(0); // Orphaned reply doesn't appear as root
    });
  });

  describe('rowToVM', () => {
    test('transforms database row to view model', () => {
      const service = new TaskCommentService();
      const row = {
        id: 1,
        content: 'Test comment',
        user_id: 10,
        users: { name: 'John Doe' },
        created_at: '2024-01-01T12:00:00Z',
        parent_id: null,
        task_id: 5,
        edited: false,
      };

      const vm = service.rowToVM(row);

      expect(vm).toEqual({
        id: 1,
        content: 'Test comment',
        user: { id: 10, name: 'John Doe', initials: 'JD' },
        timestamp: new Date('2024-01-01T12:00:00Z').getTime(),
        parentId: null,
        taskId: 5,
        edited: false,
      });
    });

    test('handles edited flag', () => {
      const service = new TaskCommentService();
      const row = {
        id: 1,
        content: 'Edited',
        user_id: 10,
        users: { name: 'John Doe' },
        created_at: '2024-01-01T12:00:00Z',
        parent_id: null,
        task_id: 5,
        edited: true,
      };

      const vm = service.rowToVM(row);
      expect(vm.edited).toBe(true);
    });
  });

  describe('initials', () => {
    test('extracts initials from full name', () => {
      const service = new TaskCommentService();
      expect(service.initials('John Doe')).toBe('JD');
    });

    test('handles single name', () => {
      const service = new TaskCommentService();
      expect(service.initials('John')).toBe('J');
    });

    test('handles three names', () => {
      const service = new TaskCommentService();
      expect(service.initials('John Paul Jones')).toBe('JP');
    });

    test('handles empty string', () => {
      const service = new TaskCommentService();
      expect(service.initials('')).toBe('');
    });

    test('handles extra spaces', () => {
      const service = new TaskCommentService();
      expect(service.initials('  John   Doe  ')).toBe('JD');
    });
  });

  describe('listThread', () => {
    test('retrieves and builds comment tree', async () => {
      const repo = {
        getByTask: jest.fn().mockResolvedValue([
          { id: 1, content: 'First', user_id: 1, created_at: '2024-01-01', parent_id: null, task_id: 1, users: { name: 'John Doe' } },
        ]),
      };
      const service = new TaskCommentService(repo);

      const result = await service.listThread(1);

      expect(repo.getByTask).toHaveBeenCalledWith(1);
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('First');
    });

    test('throws error when taskId is missing', async () => {
      const service = new TaskCommentService();
      await expect(service.listThread(null)).rejects.toMatchObject({ httpCode: 400 });
    });

    test('returns empty array for task with no comments', async () => {
      const repo = {
        getByTask: jest.fn().mockResolvedValue([]),
      };
      const service = new TaskCommentService(repo);

      const result = await service.listThread(1);
      expect(result).toEqual([]);
    });
  });

  describe('canUserComment', () => {
    beforeEach(() => {
      supabase.from.mockReset();
    });

    test('returns false when taskId is missing', async () => {
      const service = new TaskCommentService();
      const result = await service.canUserComment(null, { id: 1 });
      expect(result).toBe(false);
    });

    test('returns false when requester is missing', async () => {
      const service = new TaskCommentService();
      const result = await service.canUserComment(1, null);
      expect(result).toBe(false);
    });

    test('returns false when requester has no id', async () => {
      const service = new TaskCommentService();
      const result = await service.canUserComment(1, {});
      expect(result).toBe(false);
    });

    test('fetches user context when missing role fields', async () => {
      const service = new TaskCommentService();
      const user = { id: 1, role: 'admin', hierarchy: 5, division: 'eng', department: 'dev' };
      const task = { project_id: 1, assigned_to: [] };

      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: user, error: null }),
              }),
            }),
          };
        }
        if (table === 'tasks') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: task, error: null }),
              }),
            }),
          };
        }
        return { select: () => ({}) };
      });

      const result = await service.canUserComment(1, { id: 1 });
      expect(result).toBe(true); // Admin can comment
    });

    test('returns false when user context fetch fails', async () => {
      const service = new TaskCommentService();

      supabase.from.mockImplementation(() => ({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: { message: 'User not found' } }),
          }),
        }),
      }));

      const result = await service.canUserComment(1, { id: 999 });
      expect(result).toBe(false);
    });

    test('allows admin users', async () => {
      const service = new TaskCommentService();
      const user = { id: 1, role: 'admin', hierarchy: 5, division: 'eng', department: 'dev' };
      const task = { project_id: 1, assigned_to: [] };

      supabase.from.mockImplementation((table) => {
        if (table === 'tasks') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: task, error: null }),
              }),
            }),
          };
        }
        return { select: () => ({}) };
      });

      const result = await service.canUserComment(1, user);
      expect(result).toBe(true);
    });

    test('allows HR users', async () => {
      const service = new TaskCommentService();
      const user = { id: 1, role: 'hr', hierarchy: 5, division: 'eng', department: 'hr' };
      const task = { project_id: 1, assigned_to: [] };

      supabase.from.mockImplementation((table) => {
        if (table === 'tasks') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: task, error: null }),
              }),
            }),
          };
        }
        return { select: () => ({}) };
      });

      const result = await service.canUserComment(1, user);
      expect(result).toBe(true);
    });

    test('allows assigned users', async () => {
      const service = new TaskCommentService();
      const user = { id: 10, role: 'staff', hierarchy: 1, division: 'eng', department: 'dev' };
      const task = { project_id: 1, assigned_to: ['10', '20'] };

      supabase.from.mockImplementation((table) => {
        if (table === 'tasks') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: task, error: null }),
              }),
            }),
          };
        }
        return { select: () => ({}) };
      });

      const result = await service.canUserComment(1, user);
      expect(result).toBe(true);
    });
  });

  describe('_getUserContext', () => {
    beforeEach(() => {
      supabase.from.mockReset();
    });

    test('returns null when userId is missing', async () => {
      const service = new TaskCommentService();
      const result = await service._getUserContext(null);
      expect(result).toBe(null);
    });

    test('fetches user data from database', async () => {
      const service = new TaskCommentService();
      const user = { id: 1, role: 'admin', hierarchy: 5, division: 'eng', department: 'dev' };

      supabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: user, error: null }),
          }),
        }),
      });

      const result = await service._getUserContext(1);
      expect(result).toEqual(user);
    });

    test('returns null on database error', async () => {
      const service = new TaskCommentService();

      supabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: { message: 'Error' } }),
          }),
        }),
      });

      const result = await service._getUserContext(1);
      expect(result).toBe(null);
    });
  });

  describe('_getSubordinateUserIds', () => {
    beforeEach(() => {
      supabase.from.mockReset();
    });

    test('returns empty array when hierarchy is invalid', async () => {
      const service = new TaskCommentService();
      const result = await service._getSubordinateUserIds('invalid', 'sales');
      expect(result).toEqual([]);
    });

    test('returns empty array when division is missing', async () => {
      const service = new TaskCommentService();
      const result = await service._getSubordinateUserIds(3, null);
      expect(result).toEqual([]);
    });

    test('fetches subordinate user ids', async () => {
      const service = new TaskCommentService();

      supabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            lt: () => Promise.resolve({ data: [{ id: 1 }, { id: 2 }], error: null }),
          }),
        }),
      });

      const result = await service._getSubordinateUserIds(3, 'sales');
      expect(result).toEqual(['1', '2']);
    });

    test('filters out null/undefined ids', async () => {
      const service = new TaskCommentService();

      supabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            lt: () => Promise.resolve({ data: [{ id: 1 }, { id: null }, { id: 2 }], error: null }),
          }),
        }),
      });

      const result = await service._getSubordinateUserIds(3, 'sales');
      expect(result).toEqual(['1', '2']);
    });

    test('returns empty array on database error', async () => {
      const service = new TaskCommentService();

      supabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            lt: () => Promise.resolve({ data: null, error: { message: 'Error' } }),
          }),
        }),
      });

      const result = await service._getSubordinateUserIds(3, 'sales');
      expect(result).toEqual([]);
    });

    test('handles non-array response', async () => {
      const service = new TaskCommentService();

      supabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            lt: () => Promise.resolve({ data: 'not-an-array', error: null }),
          }),
        }),
      });

      const result = await service._getSubordinateUserIds(3, 'sales');
      expect(result).toEqual([]);
    });
  });

  describe('_canUserCommentOnTask', () => {
    beforeEach(() => {
      supabase.from.mockReset();
    });

    test('returns false when requester is missing', async () => {
      const service = new TaskCommentService();
      const result = await service._canUserCommentOnTask(1, null);
      expect(result).toBe(false);
    });

    test('returns false when task fetch fails', async () => {
      const service = new TaskCommentService();

      supabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: { message: 'Error' } }),
          }),
        }),
      });

      const result = await service._canUserCommentOnTask(1, { id: 1, role: 'staff' });
      expect(result).toBe(false);
    });

    test('allows admin with roleName field', async () => {
      const service = new TaskCommentService();
      const task = { project_id: 1, assigned_to: [] };

      supabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: task, error: null }),
          }),
        }),
      });

      const result = await service._canUserCommentOnTask(1, { id: 1, roleName: 'admin' });
      expect(result).toBe(true);
    });

    test('allows admin with role_label field', async () => {
      const service = new TaskCommentService();
      const task = { project_id: 1, assigned_to: [] };

      supabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: task, error: null }),
          }),
        }),
      });

      const result = await service._canUserCommentOnTask(1, { id: 1, role_label: 'admin' });
      expect(result).toBe(true);
    });

    test('handles case-insensitive role comparison', async () => {
      const service = new TaskCommentService();
      const task = { project_id: 1, assigned_to: [] };

      supabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: task, error: null }),
          }),
        }),
      });

      const result = await service._canUserCommentOnTask(1, { id: 1, role: 'ADMIN' });
      expect(result).toBe(true);
    });

    test('allows HR with different case', async () => {
      const service = new TaskCommentService();
      const task = { project_id: 1, assigned_to: [] };

      supabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: task, error: null }),
          }),
        }),
      });

      const result = await service._canUserCommentOnTask(1, { id: 1, role: 'Hr' });
      expect(result).toBe(true);
    });
  });

  describe('deleteComment', () => {
  const baseRepo = {
    getById: jest.fn(),
    deleteCascade: jest.fn(),
  };

  const makeService = () => new TaskCommentService(baseRepo);

  beforeEach(() => {
    jest.clearAllMocks();
    supabase.from.mockReset();
  });

  test('allows users with HR role to delete comments and cascade deletes replies', async () => {
    const repo = {
      ...baseRepo,
      getById: jest.fn().mockResolvedValue({ id: 10, user_id: 5 }),
      deleteCascade: jest.fn().mockResolvedValue({ deletedReplies: true }),
    };
    const service = new TaskCommentService(repo);

    const result = await service.deleteComment({
      id: 10,
      requester: { role: 'admin' },
    });

    expect(repo.getById).toHaveBeenCalledWith(10);
    expect(repo.deleteCascade).toHaveBeenCalledWith(10);
    expect(result).toEqual({ success: true, deletedReplies: true });
  });

  test('rejects deletion attempts by non admin users', async () => {
    const repo = {
      ...baseRepo,
      getById: jest.fn().mockResolvedValue({ id: 10, user_id: 5 }),
    };
    const service = new TaskCommentService(repo);

    await expect(
      service.deleteComment({
        id: 10,
        requester: { role: 'staff' },
      })
    ).rejects.toMatchObject({ httpCode: 403 });

    expect(repo.deleteCascade).not.toHaveBeenCalled();
  });

  test('propagates 404 when comment is missing and never calls delete', async () => {
    const repo = {
      ...baseRepo,
      getById: jest.fn().mockResolvedValue(null),
    };
    const service = new TaskCommentService(repo);

    await expect(
      service.deleteComment({
        id: 999,
        requester: { role: 'hr' },
      })
    ).rejects.toMatchObject({ httpCode: 404 });

    expect(repo.deleteCascade).not.toHaveBeenCalled();
  });

  test('rejects invalid ids before repository is called', async () => {
    const repo = {
      ...baseRepo,
    };
    const service = new TaskCommentService(repo);

    await expect(
      service.deleteComment({
        id: 'not-a-number',
        requester: { role: 'hr' },
      })
    ).rejects.toMatchObject({ httpCode: 400 });

    expect(repo.getById).not.toHaveBeenCalled();
  });
});

  describe('addComment', () => {
    const commentRepo = {
      create: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
      supabase.from.mockReset();
      commentRepo.create.mockReset();
    });

    test('allows managers when subordinate assigned to task', async () => {
      const service = new TaskCommentService({
        ...commentRepo,
      });

      const manager = { id: 10, role: 'manager', hierarchy: 3, division: 'sales', department: 'sales' };
      const task = { project_id: 44, assigned_to: [101, 102] };
      const subordinates = [{ id: 101 }, { id: 103 }];

      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            select: (fields) => {
              if (fields.includes('role')) {
                return {
                  eq: () => ({
                    single: () => Promise.resolve({ data: manager, error: null }),
                  }),
                };
              }
              return {
                eq: () => ({
                  lt: () => Promise.resolve({ data: subordinates, error: null }),
                }),
              };
            },
          };
        }
        if (table === 'tasks') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: task, error: null }),
              }),
            }),
          };
        }
        return { select: () => ({}) };
      });

      commentRepo.create.mockResolvedValue({
        id: 1,
        task_id: task.project_id,
        user_id: manager.id,
        content: 'Hello',
        created_at: new Date().toISOString(),
        parent_id: null,
        users: { name: 'Manager' },
      });

      const result = await service.addComment({
        taskId: 99,
        content: 'Hello',
        userId: manager.id,
      });

      expect(result).toMatchObject({ content: 'Hello' });
      expect(commentRepo.create).toHaveBeenCalled();
    });

    test('rejects staff not assigned to task', async () => {
      const service = new TaskCommentService({
        ...commentRepo,
      });

      const staff = { id: 20, role: 'staff', hierarchy: 1, division: 'sales', department: 'sales' };
      const task = { project_id: 44, assigned_to: [101, 102] };

      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            select: (fields) => ({
              eq: () => ({
                single: () => Promise.resolve({ data: staff, error: null }),
              }),
            }),
          };
        }
        if (table === 'tasks') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: task, error: null }),
              }),
            }),
          };
        }
        return { select: () => ({}) };
      });

      await expect(
        service.addComment({
          taskId: 99,
          content: 'Not allowed',
          userId: staff.id,
        })
      ).rejects.toMatchObject({ httpCode: 403 });

      expect(commentRepo.create).not.toHaveBeenCalled();
    });

    test('allows assigned user when task stores numeric identifiers', async () => {
      const service = new TaskCommentService({
        ...commentRepo,
      });

      const staff = { id: '20', role: 'staff', hierarchy: 1, division: 'sales', department: 'sales' };
      const task = { project_id: 44, assigned_to: [20, 102] };

      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: staff, error: null }),
              }),
            }),
          };
        }
        if (table === 'tasks') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: task, error: null }),
              }),
            }),
          };
        }
        return { select: () => ({}) };
      });

      commentRepo.create.mockResolvedValue({
        id: 2,
        task_id: task.project_id,
        user_id: staff.id,
        content: 'Ready to go',
        created_at: new Date().toISOString(),
        parent_id: null,
        users: { name: 'Staff Member' },
      });

      await expect(
        service.addComment({
          taskId: 99,
          content: 'Ready to go',
          userId: staff.id,
        })
      ).resolves.toMatchObject({ content: 'Ready to go' });

      expect(commentRepo.create).toHaveBeenCalled();
    });

    test('blocks managers when task is outside their division hierarchy', async () => {
      const service = new TaskCommentService({
        ...commentRepo,
      });

      const manager = { id: 30, role: 'manager', hierarchy: 3, division: 'sales', department: 'sales' };
      const task = { project_id: 88, assigned_to: [501] };

      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            select: (fields) => {
              if (fields.includes('role')) {
                return {
                  eq: () => ({
                    single: () => Promise.resolve({ data: manager, error: null }),
                  }),
                };
              }
              return {
                eq: () => ({
                  lt: () => Promise.resolve({ data: [], error: null }),
                }),
              };
            },
          };
        }
        if (table === 'tasks') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: task, error: null }),
              }),
            }),
          };
        }
        return { select: () => ({}) };
      });

      await expect(
        service.addComment({
          taskId: 501,
          content: 'Checking in',
          userId: manager.id,
        })
      ).rejects.toMatchObject({ httpCode: 403 });

      expect(commentRepo.create).not.toHaveBeenCalled();
    });

    test('throws error when taskId is missing', async () => {
      const repo = { create: jest.fn() };
      const service = new TaskCommentService(repo);

      await expect(
        service.addComment({ content: 'Test', userId: 1 })
      ).rejects.toMatchObject({ httpCode: 400 });
    });

    test('throws error when content is missing', async () => {
      const repo = { create: jest.fn() };
      const service = new TaskCommentService(repo);

      await expect(
        service.addComment({ taskId: 1, userId: 1 })
      ).rejects.toMatchObject({ httpCode: 400 });
    });

    test('throws error when content is empty', async () => {
      const repo = { create: jest.fn() };
      const service = new TaskCommentService(repo);

      await expect(
        service.addComment({ taskId: 1, content: '   ', userId: 1 })
      ).rejects.toMatchObject({ httpCode: 400 });
    });

    test('throws error when userId is missing', async () => {
      const repo = { create: jest.fn() };
      const service = new TaskCommentService(repo);

      await expect(
        service.addComment({ taskId: 1, content: 'Test' })
      ).rejects.toMatchObject({ httpCode: 400 });
    });

    test('trims whitespace from content', async () => {
      const repo = { create: jest.fn().mockResolvedValue({
        id: 1,
        task_id: 1,
        user_id: 1,
        content: 'Test',
        created_at: new Date().toISOString(),
        parent_id: null,
        users: { name: 'Admin User' },
      })};
      const service = new TaskCommentService(repo);
      const admin = { id: 1, role: 'admin', hierarchy: 5, division: 'eng', department: 'dev' };
      const task = { project_id: 1, assigned_to: [] };

      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: admin, error: null }),
              }),
            }),
          };
        }
        if (table === 'tasks') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: task, error: null }),
              }),
            }),
          };
        }
        return { select: () => ({}) };
      });

      await service.addComment({ taskId: 1, content: '  Test  ', userId: 1 });

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
        content: 'Test',
      }));
    });

    test('creates notification on successful comment', async () => {
      const repo = { create: jest.fn().mockResolvedValue({
        id: 1,
        task_id: 1,
        user_id: 1,
        content: 'Test',
        created_at: new Date().toISOString(),
        parent_id: null,
        users: { name: 'Admin User' },
      })};
      const service = new TaskCommentService(repo);
      const admin = { id: 1, role: 'admin', hierarchy: 5, division: 'eng', department: 'dev' };
      const task = { project_id: 1, assigned_to: [] };

      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: admin, error: null }),
              }),
            }),
          };
        }
        if (table === 'tasks') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: task, error: null }),
              }),
            }),
          };
        }
        return { select: () => ({}) };
      });

      await service.addComment({ taskId: 1, content: 'Test', userId: 1 });

      expect(notificationService.createCommentNotification).toHaveBeenCalledWith({
        taskId: 1,
        commentId: 1,
        commentContent: 'Test',
        commenterId: 1,
        commenterName: 'Admin User'
      });
    });

    test('continues even if notification fails', async () => {
      const repo = { create: jest.fn().mockResolvedValue({
        id: 1,
        task_id: 1,
        user_id: 1,
        content: 'Test',
        created_at: new Date().toISOString(),
        parent_id: null,
        users: { name: 'Admin User' },
      })};
      const service = new TaskCommentService(repo);
      const admin = { id: 1, role: 'admin', hierarchy: 5, division: 'eng', department: 'dev' };
      const task = { project_id: 1, assigned_to: [] };

      notificationService.createCommentNotification.mockRejectedValueOnce(new Error('Notification failed'));

      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: admin, error: null }),
              }),
            }),
          };
        }
        if (table === 'tasks') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: task, error: null }),
              }),
            }),
          };
        }
        return { select: () => ({}) };
      });

      const result = await service.addComment({ taskId: 1, content: 'Test', userId: 1 });

      expect(result).toMatchObject({ content: 'Test' });
    });

    test('supports parentId for threaded comments', async () => {
      const repo = { create: jest.fn().mockResolvedValue({
        id: 2,
        task_id: 1,
        user_id: 1,
        content: 'Reply',
        created_at: new Date().toISOString(),
        parent_id: 1,
        users: { name: 'Admin User' },
      })};
      const service = new TaskCommentService(repo);
      const admin = { id: 1, role: 'admin', hierarchy: 5, division: 'eng', department: 'dev' };
      const task = { project_id: 1, assigned_to: [] };

      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: admin, error: null }),
              }),
            }),
          };
        }
        if (table === 'tasks') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: task, error: null }),
              }),
            }),
          };
        }
        return { select: () => ({}) };
      });

      await service.addComment({ taskId: 1, content: 'Reply', userId: 1, parentId: 1 });

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
        parentId: 1,
      }));
    });

    test('handles user with no name in notification', async () => {
      const repo = { create: jest.fn().mockResolvedValue({
        id: 1,
        task_id: 1,
        user_id: 1,
        content: 'Test',
        created_at: new Date().toISOString(),
        parent_id: null,
        users: {},
      })};
      const service = new TaskCommentService(repo);
      const admin = { id: 1, role: 'admin', hierarchy: 5, division: 'eng', department: 'dev' };
      const task = { project_id: 1, assigned_to: [] };

      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: admin, error: null }),
              }),
            }),
          };
        }
        if (table === 'tasks') {
          return {
            select: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: task, error: null }),
              }),
            }),
          };
        }
        return { select: () => ({}) };
      });

      await service.addComment({ taskId: 1, content: 'Test', userId: 1 });

      expect(notificationService.createCommentNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          commenterName: 'Unknown User'
        })
      );
    });
  });

  describe('editComment', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('updates comment content', async () => {
      const repo = {
        getById: jest.fn().mockResolvedValue({ id: 1, user_id: 10, content: 'Old content' }),
        update: jest.fn().mockResolvedValue({
          id: 1,
          user_id: 10,
          content: 'New content',
          created_at: new Date().toISOString(),
          parent_id: null,
          task_id: 1,
          edited: true,
          users: { name: 'John Doe' },
        }),
      };
      const service = new TaskCommentService(repo);

      const result = await service.editComment({ id: 1, content: 'New content', userId: 10 });

      expect(repo.getById).toHaveBeenCalledWith(1);
      expect(repo.update).toHaveBeenCalledWith({ id: 1, content: 'New content' });
      expect(result.content).toBe('New content');
    });

    test('throws error when id is missing', async () => {
      const repo = { getById: jest.fn(), update: jest.fn() };
      const service = new TaskCommentService(repo);

      await expect(
        service.editComment({ content: 'Test', userId: 1 })
      ).rejects.toMatchObject({ httpCode: 400 });

      expect(repo.getById).not.toHaveBeenCalled();
    });

    test('throws 404 when comment not found', async () => {
      const repo = {
        getById: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      };
      const service = new TaskCommentService(repo);

      await expect(
        service.editComment({ id: 999, content: 'Test', userId: 1 })
      ).rejects.toMatchObject({ httpCode: 404 });

      expect(repo.update).not.toHaveBeenCalled();
    });

    test('throws 403 when user is not the author', async () => {
      const repo = {
        getById: jest.fn().mockResolvedValue({ id: 1, user_id: 10, content: 'Test' }),
        update: jest.fn(),
      };
      const service = new TaskCommentService(repo);

      await expect(
        service.editComment({ id: 1, content: 'New content', userId: 20 })
      ).rejects.toMatchObject({ httpCode: 403 });

      expect(repo.update).not.toHaveBeenCalled();
    });

    test('trims whitespace from content', async () => {
      const repo = {
        getById: jest.fn().mockResolvedValue({ id: 1, user_id: 10, content: 'Old' }),
        update: jest.fn().mockResolvedValue({
          id: 1,
          user_id: 10,
          content: 'New',
          created_at: new Date().toISOString(),
          parent_id: null,
          task_id: 1,
          edited: true,
          users: { name: 'John Doe' },
        }),
      };
      const service = new TaskCommentService(repo);

      await service.editComment({ id: 1, content: '  New  ', userId: 10 });

      expect(repo.update).toHaveBeenCalledWith({ id: 1, content: 'New' });
    });

    test('allows empty content after trimming', async () => {
      const repo = {
        getById: jest.fn().mockResolvedValue({ id: 1, user_id: 10, content: 'Old' }),
        update: jest.fn().mockResolvedValue({
          id: 1,
          user_id: 10,
          content: '',
          created_at: new Date().toISOString(),
          parent_id: null,
          task_id: 1,
          edited: true,
          users: { name: 'John Doe' },
        }),
      };
      const service = new TaskCommentService(repo);

      await service.editComment({ id: 1, content: '', userId: 10 });

      expect(repo.update).toHaveBeenCalledWith({ id: 1, content: '' });
    });

    test('handles undefined content', async () => {
      const repo = {
        getById: jest.fn().mockResolvedValue({ id: 1, user_id: 10, content: 'Old' }),
        update: jest.fn().mockResolvedValue({
          id: 1,
          user_id: 10,
          content: '',
          created_at: new Date().toISOString(),
          parent_id: null,
          task_id: 1,
          edited: true,
          users: { name: 'John Doe' },
        }),
      };
      const service = new TaskCommentService(repo);

      await service.editComment({ id: 1, userId: 10 });

      expect(repo.update).toHaveBeenCalledWith({ id: 1, content: '' });
    });
  });
});
