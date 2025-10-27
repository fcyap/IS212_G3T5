const { TaskCommentService } = require('../../src/services/tasks/taskCommentService');

describe('TaskCommentService.deleteComment', () => {
  const baseRepo = {
    getById: jest.fn(),
    deleteCascade: jest.fn(),
  };

  const makeService = () => new TaskCommentService(baseRepo);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('allows users from HR Team to delete comments and cascade deletes replies', async () => {
    const repo = {
      ...baseRepo,
      getById: jest.fn().mockResolvedValue({ id: 10, user_id: 5 }),
      deleteCascade: jest.fn().mockResolvedValue({ deletedReplies: true }),
    };
    const service = new TaskCommentService(repo);

    const result = await service.deleteComment({
      id: 10,
      requester: { department: 'HR Team' },
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
        requester: { department: 'Engineering' },
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
        requester: { department: 'HR Team' },
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
        requester: { department: 'HR Team' },
      })
    ).rejects.toMatchObject({ httpCode: 400 });

    expect(repo.getById).not.toHaveBeenCalled();
  });
});
