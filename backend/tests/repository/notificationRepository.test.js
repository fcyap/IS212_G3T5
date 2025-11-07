const notificationRepository = require('../../src/repository/notificationRepository');
const supabase = require('../../src/utils/supabase');

jest.mock('../../src/utils/supabase');

describe('NotificationRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    test('should create notification with string recipient_emails', async () => {
      const mockNotif = {
        notif_id: 1,
        message: 'Test notification',
        recipient_emails: 'test@example.com',
        creator_id: 1,
        notif_types: 'test'
      };

      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockNotif, error: null })
      });

      const result = await notificationRepository.create({
        message: 'Test notification',
        recipient_emails: 'test@example.com',
        creator_id: 1,
        notif_types: 'test'
      });

      expect(result).toEqual(mockNotif);
    });

    test('should convert array recipient_emails to comma-separated string', async () => {
      const mockNotif = {
        notif_id: 1,
        message: 'Test',
        recipient_emails: 'test1@example.com,test2@example.com'
      };

      const mockChain = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockNotif, error: null })
      };

      supabase.from.mockReturnValue(mockChain);

      await notificationRepository.create({
        message: 'Test',
        recipient_emails: ['test1@example.com', 'test2@example.com']
      });

      expect(mockChain.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          recipient_emails: 'test1@example.com,test2@example.com'
        })
      ]);
    });

    test('should include optional task_id and project_id', async () => {
      const mockChain = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: {}, error: null })
      };

      supabase.from.mockReturnValue(mockChain);

      await notificationRepository.create({
        message: 'Test',
        recipient_emails: 'test@example.com',
        task_id: 5,
        project_id: 10
      });

      expect(mockChain.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          task_id: 5,
          project_id: 10
        })
      ]);
    });

    test('should throw error on database error', async () => {
      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } })
      });

      await expect(notificationRepository.create({
        message: 'Test'
      })).rejects.toThrow('Database error: Insert failed');
    });
  });

  describe('getByUserEmail', () => {
    test('should get notifications by user email', async () => {
      const mockNotifs = [{ notif_id: 1 }, { notif_id: 2 }];

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockResolvedValue({ data: mockNotifs, error: null })
      });

      const result = await notificationRepository.getByUserEmail('test@example.com');

      expect(result).toEqual(mockNotifs);
    });

    test('should apply limit and offset filters', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: [], error: null })
      };

      supabase.from.mockReturnValue(mockChain);

      await notificationRepository.getByUserEmail('test@example.com', {
        limit: 10,
        offset: 5
      });

      expect(mockChain.limit).toHaveBeenCalledWith(10);
      expect(mockChain.range).toHaveBeenCalledWith(5, 14);
    });

    test('should return empty array when data is null', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      const result = await notificationRepository.getByUserEmail('test@example.com');

      expect(result).toEqual([]);
    });

    test('should throw error on database error', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockResolvedValue({ data: null, error: { message: 'Query failed' } })
      });

      await expect(notificationRepository.getByUserEmail('test@example.com'))
        .rejects.toThrow('Database error: Query failed');
    });
  });

  describe('getByCreatorId', () => {
    test('should get notifications by creator id', async () => {
      const mockNotifs = [{ notif_id: 1 }];

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockNotifs, error: null })
      });

      const result = await notificationRepository.getByCreatorId(1);

      expect(result).toEqual(mockNotifs);
    });

    test('should apply pagination', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: [], error: null })
      };

      supabase.from.mockReturnValue(mockChain);

      await notificationRepository.getByCreatorId(1, { limit: 20, offset: 10 });

      expect(mockChain.limit).toHaveBeenCalledWith(20);
      expect(mockChain.range).toHaveBeenCalledWith(10, 29);
    });
  });

  describe('getByRecipientEmail', () => {
    test('should get notifications for recipient', async () => {
      const mockNotifs = [{ notif_id: 1 }];

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        like: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockNotifs, error: null })
      });

      const result = await notificationRepository.getByRecipientEmail('test@example.com');

      expect(result).toEqual(mockNotifs);
    });

    test('should filter dismissed notifications when includeDismissed is false', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        like: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [], error: null })
      };

      supabase.from.mockReturnValue(mockChain);

      await notificationRepository.getByRecipientEmail('test@example.com', {
        includeDismissed: false
      });

      expect(mockChain.eq).toHaveBeenCalledWith('dismissed', false);
    });

    test('should apply pagination', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        like: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: [], error: null })
      };

      supabase.from.mockReturnValue(mockChain);

      await notificationRepository.getByRecipientEmail('test@example.com', {
        limit: 50,
        offset: 25
      });

      expect(mockChain.limit).toHaveBeenCalledWith(50);
      expect(mockChain.range).toHaveBeenCalledWith(25, 74);
    });
  });

  describe('getById', () => {
    test('should get notification by id', async () => {
      const mockNotif = { notif_id: 1, message: 'Test' };

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockNotif, error: null })
      });

      const result = await notificationRepository.getById(1);

      expect(result).toEqual(mockNotif);
    });

    test('should return null when notification not found', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'Not found' }
        })
      });

      const result = await notificationRepository.getById(999);

      expect(result).toBeNull();
    });

    test('should throw error on database error', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' }
        })
      });

      await expect(notificationRepository.getById(1))
        .rejects.toThrow('Database error: Database error');
    });
  });

  describe('update', () => {
    test('should update notification', async () => {
      const mockUpdated = { notif_id: 1, message: 'Updated' };

      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockUpdated, error: null })
      });

      const result = await notificationRepository.update(1, { message: 'Updated' });

      expect(result).toEqual(mockUpdated);
    });

    test('should throw error on update failure', async () => {
      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Update failed' } })
      });

      await expect(notificationRepository.update(1, {}))
        .rejects.toThrow('Database error: Update failed');
    });
  });

  describe('delete', () => {
    test('should delete notification', async () => {
      supabase.from.mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null })
      });

      const result = await notificationRepository.delete(1);

      expect(result).toBe(true);
    });

    test('should throw error on deletion failure', async () => {
      supabase.from.mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: { message: 'Delete failed' } })
      });

      await expect(notificationRepository.delete(1))
        .rejects.toThrow('Database error: Delete failed');
    });
  });

  describe('getCountByRecipient', () => {
    test('should get count by recipient', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        contains: jest.fn().mockResolvedValue({ count: 5, error: null })
      });

      const result = await notificationRepository.getCountByRecipient('test@example.com');

      expect(result).toBe(5);
    });

    test('should return 0 when count is null', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        contains: jest.fn().mockResolvedValue({ count: null, error: null })
      });

      const result = await notificationRepository.getCountByRecipient('test@example.com');

      expect(result).toBe(0);
    });

    test('should throw error on database error', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        contains: jest.fn().mockResolvedValue({ count: null, error: { message: 'Count failed' } })
      });

      await expect(notificationRepository.getCountByRecipient('test@example.com'))
        .rejects.toThrow('Database error: Count failed');
    });
  });

  describe('getAll', () => {
    test('should get all notifications with pagination', async () => {
      const mockNotifs = [{ notif_id: 1 }, { notif_id: 2 }];

      // First call for count
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue({ count: 100 })
      });

      // Second call for data
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: mockNotifs, error: null })
      });

      const result = await notificationRepository.getAll({ limit: 50, offset: 0 });

      expect(result).toEqual({
        notifications: mockNotifs,
        pagination: {
          total: 100,
          limit: 50,
          offset: 0,
          hasMore: true
        }
      });
    });

    test('should use default pagination values', async () => {
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue({ count: 10 })
      });

      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: [], error: null })
      });

      const result = await notificationRepository.getAll();

      expect(result.pagination.limit).toBe(50);
      expect(result.pagination.offset).toBe(0);
    });

    test('should throw error on database error', async () => {
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue({ count: 10 })
      });

      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: null, error: { message: 'Query failed' } })
      });

      await expect(notificationRepository.getAll())
        .rejects.toThrow('Database error: Query failed');
    });
  });

  describe('getHistoryByRecipient', () => {
    test('should get notification history with pagination', async () => {
      const mockNotifs = [{ notif_id: 1 }];

      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        contains: jest.fn().mockResolvedValue({ count: 50 })
      });

      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        contains: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: mockNotifs, error: null })
      });

      const result = await notificationRepository.getHistoryByRecipient('test@example.com');

      expect(result).toEqual({
        notifications: mockNotifs,
        pagination: {
          total: 50,
          limit: 20,
          offset: 0,
          hasMore: true
        }
      });
    });

    test('should use custom pagination options', async () => {
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        contains: jest.fn().mockResolvedValue({ count: 100 })
      });

      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        contains: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({ data: [], error: null })
      });

      const result = await notificationRepository.getHistoryByRecipient('test@example.com', {
        limit: 50,
        offset: 25
      });

      expect(result.pagination.limit).toBe(50);
      expect(result.pagination.offset).toBe(25);
      expect(result.pagination.hasMore).toBe(true);
    });
  });

  describe('bulkCreate', () => {
    test('should bulk create notifications', async () => {
      const mockNotifs = [{ notif_id: 1 }, { notif_id: 2 }];

      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: mockNotifs, error: null })
      });

      const result = await notificationRepository.bulkCreate([
        { message: 'Test 1', recipient_emails: 'test1@example.com' },
        { message: 'Test 2', recipient_emails: 'test2@example.com' }
      ]);

      expect(result).toEqual(mockNotifs);
    });

    test('should return empty array when data is null', async () => {
      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      const result = await notificationRepository.bulkCreate([]);

      expect(result).toEqual([]);
    });

    test('should throw error on insert failure', async () => {
      supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } })
      });

      await expect(notificationRepository.bulkCreate([{ message: 'Test' }]))
        .rejects.toThrow('Database error: Insert failed');
    });
  });

  describe('markAsDismissed', () => {
    test('should mark notification as dismissed', async () => {
      const mockNotif = { notif_id: 1, dismissed: true };

      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockNotif, error: null })
      });

      const result = await notificationRepository.markAsDismissed(1);

      expect(result).toEqual(mockNotif);
      expect(result.dismissed).toBe(true);
    });

    test('should throw error on update failure', async () => {
      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Update failed' } })
      });

      await expect(notificationRepository.markAsDismissed(1))
        .rejects.toThrow('Database error: Update failed');
    });
  });
});
