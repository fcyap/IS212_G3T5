jest.mock('../../src/supabase-client', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const { supabase } = require('../../src/supabase-client');
const { TaskCommentService } = require('../../src/services/tasks/taskCommentService');

describe('TaskCommentService.deleteComment', () => {
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

  describe('addComment permissions', () => {
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
  });
});
