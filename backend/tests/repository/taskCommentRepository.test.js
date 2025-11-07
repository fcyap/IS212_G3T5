const { taskCommentRepository } = require('../../src/repository/tasks/taskCommentRepository');
const supabase = require('../../src/utils/supabase');

jest.mock('../../src/utils/supabase');

describe('TaskCommentRepository', () => {
  let repository;

  beforeEach(() => {
    repository = new taskCommentRepository();
    jest.clearAllMocks();
  });

  describe('table', () => {
    test('should return task_comments table name', () => {
      expect(repository.table()).toBe('task_comments');
    });
  });

  describe('getByTask', () => {
    test('should get comments for a task', async () => {
      const mockComments = [
        { id: 1, task_id: 5, content: 'Comment 1', users: { name: 'User 1' } },
        { id: 2, task_id: 5, content: 'Comment 2', users: { name: 'User 2' } }
      ];

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockComments, error: null })
      });

      const result = await repository.getByTask(5);

      expect(result).toEqual(mockComments);
      expect(supabase.from).toHaveBeenCalledWith('task_comments');
    });

    test('should return empty array when data is null', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      const result = await repository.getByTask(5);

      expect(result).toEqual([]);
    });

    test('should throw error on database error', async () => {
      const error = new Error('Database error');

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error })
      });

      await expect(repository.getByTask(5)).rejects.toThrow('Database error');
    });

    test('should order comments by created_at descending', async () => {
      const orderSpy = jest.fn().mockResolvedValue({ data: [], error: null });

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: orderSpy
      });

      await repository.getByTask(5);

      expect(orderSpy).toHaveBeenCalledWith('created_at', { ascending: false });
    });
  });

  describe('getById', () => {
    test('should get comment by id', async () => {
      const mockComment = {
        id: 1,
        task_id: 5,
        content: 'Test comment',
        users: { name: 'User 1' }
      };

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockComment, error: null })
      });

      const result = await repository.getById(1);

      expect(result).toEqual(mockComment);
    });

    test('should return null when comment not found', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Not found')
        })
      });

      const result = await repository.getById(999);

      expect(result).toBeNull();
    });

    test('should return null on any error', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Database error')
        })
      });

      const result = await repository.getById(1);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    test('should create comment successfully', async () => {
      const commentData = {
        taskId: 5,
        userId: 1,
        content: 'New comment',
        parentId: null
      };

      const mockCreatedComment = {
        id: 1,
        task_id: 5,
        user_id: 1,
        content: 'New comment',
        parent_id: null,
        users: { name: 'User 1' }
      };

      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockCreatedComment, error: null })
      });

      const result = await repository.create(commentData);

      expect(result).toEqual(mockCreatedComment);
    });

    test('should create comment with parent_id', async () => {
      const commentData = {
        taskId: 5,
        userId: 1,
        content: 'Reply comment',
        parentId: 10
      };

      const insertSpy = jest.fn().mockReturnThis();

      supabase.from.mockReturnValue({
        insert: insertSpy,
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 2, ...commentData },
          error: null
        })
      });

      await repository.create(commentData);

      expect(insertSpy).toHaveBeenCalledWith({
        task_id: 5,
        user_id: 1,
        content: 'Reply comment',
        parent_id: 10
      });
    });

    test('should default parentId to null', async () => {
      const commentData = {
        taskId: 5,
        userId: 1,
        content: 'Comment without parent'
      };

      const insertSpy = jest.fn().mockReturnThis();

      supabase.from.mockReturnValue({
        insert: insertSpy,
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 1, ...commentData },
          error: null
        })
      });

      await repository.create(commentData);

      expect(insertSpy).toHaveBeenCalledWith(
        expect.objectContaining({ parent_id: null })
      );
    });

    test('should throw error on creation failure', async () => {
      const error = new Error('Creation failed');

      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error })
      });

      await expect(repository.create({
        taskId: 5,
        userId: 1,
        content: 'Test'
      })).rejects.toThrow('Creation failed');
    });
  });

  describe('update', () => {
    test('should update comment successfully', async () => {
      const updateData = {
        id: 1,
        content: 'Updated content'
      };

      const mockUpdatedComment = {
        id: 1,
        content: 'Updated content',
        edited: true,
        users: { name: 'User 1' }
      };

      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockUpdatedComment, error: null })
      });

      const result = await repository.update(updateData);

      expect(result).toEqual(mockUpdatedComment);
    });

    test('should set edited flag to true', async () => {
      const updateSpy = jest.fn().mockReturnThis();

      supabase.from.mockReturnValue({
        update: updateSpy,
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 1, edited: true },
          error: null
        })
      });

      await repository.update({ id: 1, content: 'Updated' });

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ edited: true })
      );
    });

    test('should include updated_at timestamp', async () => {
      const updateSpy = jest.fn().mockReturnThis();

      supabase.from.mockReturnValue({
        update: updateSpy,
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 1 },
          error: null
        })
      });

      await repository.update({ id: 1, content: 'Updated' });

      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Updated',
          edited: true,
          updated_at: expect.any(String)
        })
      );
    });

    test('should throw error on update failure', async () => {
      const error = new Error('Update failed');

      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error })
      });

      await expect(repository.update({
        id: 1,
        content: 'Updated'
      })).rejects.toThrow('Update failed');
    });
  });

  describe('deleteCascade', () => {
    test('should delete comment and replies', async () => {
      supabase.from.mockReturnValueOnce({
        delete: jest.fn().mockReturnThis(),
        or: jest.fn().mockResolvedValue({ error: null })
      }).mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [], error: null })
      });

      const result = await repository.deleteCascade(1);

      expect(result.deletedReplies).toBe(true);
    });

    test('should throw error for invalid comment id', async () => {
      await expect(repository.deleteCascade('invalid')).rejects.toThrow('Invalid comment id');
    });

    test('should throw error for NaN id', async () => {
      await expect(repository.deleteCascade(NaN)).rejects.toThrow('Invalid comment id');
    });

    test('should delete using OR condition for parent and children', async () => {
      const orSpy = jest.fn().mockResolvedValue({ error: null });

      supabase.from.mockReturnValueOnce({
        delete: jest.fn().mockReturnThis(),
        or: orSpy
      }).mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [], error: null })
      });

      await repository.deleteCascade(5);

      expect(orSpy).toHaveBeenCalledWith('id.eq.5,parent_id.eq.5');
    });

    test('should throw error on deletion failure', async () => {
      const error = new Error('Deletion failed');

      supabase.from.mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        or: jest.fn().mockResolvedValue({ error })
      });

      await expect(repository.deleteCascade(1)).rejects.toThrow('Deletion failed');
    });

    test('should throw error on count check failure', async () => {
      const error = new Error('Count failed');

      supabase.from.mockReturnValueOnce({
        delete: jest.fn().mockReturnThis(),
        or: jest.fn().mockResolvedValue({ error: null })
      }).mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error })
      });

      await expect(repository.deleteCascade(1)).rejects.toThrow('Count failed');
    });

    test('should handle remaining comments check', async () => {
      const remainingComments = [{ id: 10 }, { id: 11 }];

      supabase.from.mockReturnValueOnce({
        delete: jest.fn().mockReturnThis(),
        or: jest.fn().mockResolvedValue({ error: null })
      }).mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: remainingComments, error: null })
      });

      const result = await repository.deleteCascade(1);

      expect(result.deletedReplies).toBe(false);
    });

    test('should handle null remaining data', async () => {
      supabase.from.mockReturnValueOnce({
        delete: jest.fn().mockReturnThis(),
        or: jest.fn().mockResolvedValue({ error: null })
      }).mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      const result = await repository.deleteCascade(1);

      expect(result.deletedReplies).toBe(true);
    });
  });
});
