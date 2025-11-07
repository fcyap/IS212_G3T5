// Mock dependencies before requiring the module
jest.mock('../../src/supabase-client');

const crypto = require('crypto');
const { createSession, getSession, touchSession, deleteSession } = require('../../src/auth/sessions');
const { supabase } = require('../../src/supabase-client');

describe('Sessions Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set default session idle time
    process.env.SESSION_IDLE_MINUTES = '15';
  });

  describe('createSession', () => {
    test('should create a new session successfully', async () => {
      const userId = 'user-123';
      const mockInsert = jest.fn().mockResolvedValue({ error: null });

      supabase.from = jest.fn().mockReturnValue({
        insert: mockInsert
      });

      // Mock crypto to return predictable token
      const originalRandomBytes = crypto.randomBytes;
      crypto.randomBytes = jest.fn().mockReturnValue(Buffer.from('a'.repeat(64), 'hex'));

      const result = await createSession(null, userId);

      expect(supabase.from).toHaveBeenCalledWith('sessions');
      expect(mockInsert).toHaveBeenCalledWith({
        token: expect.any(String),
        user_id: userId,
        expires_at: expect.any(String)
      });
      expect(result.token).toBeDefined();
      expect(result.token).toHaveLength(64); // 32 bytes as hex = 64 characters
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());

      // Restore original function
      crypto.randomBytes = originalRandomBytes;
    });

    test('should generate unique tokens for different sessions', async () => {
      const userId = 'user-123';
      const tokens = [];

      supabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null })
      });

      for (let i = 0; i < 5; i++) {
        const result = await createSession(null, userId);
        tokens.push(result.token);
      }

      // All tokens should be unique
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(5);
    });

    test('should set expiry based on SESSION_IDLE_MINUTES environment variable', async () => {
      // The module caches the SESSION_IDLE_MINUTES value at load time
      // So we test that the current configured value is being used
      const userId = 'user-123';

      supabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null })
      });

      const currentMinutes = Number(process.env.SESSION_IDLE_MINUTES || 15);
      const beforeTime = Date.now();
      const result = await createSession(null, userId);
      const afterTime = Date.now();

      const expectedMinTime = beforeTime + (currentMinutes * 60 * 1000);
      const expectedMaxTime = afterTime + (currentMinutes * 60 * 1000);

      expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMinTime);
      expect(result.expiresAt.getTime()).toBeLessThanOrEqual(expectedMaxTime);
    });

    test('should use default 15 minutes when SESSION_IDLE_MINUTES is not set', async () => {
      delete process.env.SESSION_IDLE_MINUTES;
      const userId = 'user-123';

      supabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: null })
      });

      const beforeTime = Date.now();
      const result = await createSession(null, userId);
      const afterTime = Date.now();

      const expectedMinTime = beforeTime + (15 * 60 * 1000);
      const expectedMaxTime = afterTime + (15 * 60 * 1000);

      expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMinTime);
      expect(result.expiresAt.getTime()).toBeLessThanOrEqual(expectedMaxTime);
    });

    test('should throw error when insert fails', async () => {
      const userId = 'user-123';
      const mockError = new Error('Database insert failed');

      supabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({ error: mockError })
      });

      await expect(createSession(null, userId)).rejects.toThrow('Database insert failed');
    });

    test('should format expires_at as ISO string', async () => {
      const userId = 'user-123';
      let capturedInsertData;

      supabase.from = jest.fn().mockReturnValue({
        insert: jest.fn().mockImplementation((data) => {
          capturedInsertData = data;
          return Promise.resolve({ error: null });
        })
      });

      await createSession(null, userId);

      expect(capturedInsertData.expires_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('getSession', () => {
    const mockToken = 'test-token-123';
    const mockSession = {
      token: mockToken,
      user_id: 'user-456',
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      last_seen_at: new Date().toISOString()
    };

    const mockUser = {
      email: 'test@example.com',
      role: 'manager',
      hierarchy: 'L2',
      division: 'Engineering',
      department: 'Backend'
    };

    test('should retrieve session with user data successfully', async () => {
      supabase.from = jest.fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockSession,
                error: null
              })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockUser,
                error: null
              })
            })
          })
        });

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await getSession(null, mockToken);

      expect(result).toEqual({
        ...mockSession,
        email: mockUser.email,
        role: mockUser.role,
        hierarchy: mockUser.hierarchy,
        division: mockUser.division,
        department: mockUser.department
      });

      consoleLogSpy.mockRestore();
    });

    test('should return null when session does not exist (PGRST116)', async () => {
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'Not found' }
            })
          })
        })
      });

      const result = await getSession(null, mockToken);

      expect(result).toBeNull();
    });

    test('should throw error for non-PGRST116 session fetch errors', async () => {
      const mockError = { code: 'OTHER_ERROR', message: 'Database error' };

      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: mockError
            })
          })
        })
      });

      await expect(getSession(null, mockToken)).rejects.toEqual(mockError);
    });

    test('should return null when user_id is invalid (null)', async () => {
      const invalidSession = { ...mockSession, user_id: null };

      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: invalidSession,
              error: null
            })
          })
        })
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await getSession(null, mockToken);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith('[getSession] Invalid user_id in session:', null);

      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    test('should return null when user_id is string "null"', async () => {
      const invalidSession = { ...mockSession, user_id: 'null' };

      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: invalidSession,
              error: null
            })
          })
        })
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await getSession(null, mockToken);

      expect(result).toBeNull();

      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    test('should return null when user_id is string "undefined"', async () => {
      const invalidSession = { ...mockSession, user_id: 'undefined' };

      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: invalidSession,
              error: null
            })
          })
        })
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await getSession(null, mockToken);

      expect(result).toBeNull();

      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    test('should return session with null user fields when user not found (PGRST116)', async () => {
      supabase.from = jest.fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockSession,
                error: null
              })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116', message: 'User not found' }
              })
            })
          })
        });

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await getSession(null, mockToken);

      expect(result).toEqual({
        ...mockSession,
        email: null,
        role: null,
        hierarchy: null,
        division: null,
        department: null
      });

      consoleLogSpy.mockRestore();
    });

    test('should throw error for non-PGRST116 user fetch errors', async () => {
      const userError = { code: 'OTHER_ERROR', message: 'Database error' };

      supabase.from = jest.fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockSession,
                error: null
              })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: userError
              })
            })
          })
        });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await expect(getSession(null, mockToken)).rejects.toEqual(userError);

      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    test('should log session retrieval details', async () => {
      supabase.from = jest.fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockSession,
                error: null
              })
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockUser,
                error: null
              })
            })
          })
        });

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await getSession(null, mockToken);

      expect(consoleLogSpy).toHaveBeenCalledWith('[getSession] Retrieved session:', mockSession);
      expect(consoleLogSpy).toHaveBeenCalledWith('[getSession] user_id:', mockSession.user_id, 'type:', 'string');

      consoleLogSpy.mockRestore();
    });
  });

  describe('touchSession', () => {
    const mockToken = 'test-token-789';

    test('should update session last_seen_at and expires_at successfully', async () => {
      let capturedUpdateData;

      supabase.from = jest.fn().mockReturnValue({
        update: jest.fn().mockImplementation((data) => {
          capturedUpdateData = data;
          return {
            eq: jest.fn().mockResolvedValue({ error: null })
          };
        })
      });

      const beforeTime = Date.now();
      const result = await touchSession(null, mockToken);
      const afterTime = Date.now();

      expect(supabase.from).toHaveBeenCalledWith('sessions');
      expect(capturedUpdateData.last_seen_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(capturedUpdateData.expires_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBeGreaterThan(beforeTime);
      expect(result.getTime()).toBeLessThan(afterTime + (15 * 60 * 1000) + 1000); // Add buffer for processing
    });

    test('should update with correct token filter', async () => {
      let capturedToken;

      supabase.from = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockImplementation((field, value) => {
            if (field === 'token') {
              capturedToken = value;
            }
            return Promise.resolve({ error: null });
          })
        })
      });

      await touchSession(null, mockToken);

      expect(capturedToken).toBe(mockToken);
    });

    test('should extend expiry by SESSION_IDLE_MINUTES', async () => {
      // The module caches the SESSION_IDLE_MINUTES value at load time
      // So we test that the current configured value is being used
      let capturedUpdateData;

      supabase.from = jest.fn().mockReturnValue({
        update: jest.fn().mockImplementation((data) => {
          capturedUpdateData = data;
          return {
            eq: jest.fn().mockResolvedValue({ error: null })
          };
        })
      });

      const currentMinutes = Number(process.env.SESSION_IDLE_MINUTES || 15);
      const beforeTime = Date.now();
      const result = await touchSession(null, mockToken);

      const expectedMinTime = beforeTime + (currentMinutes * 60 * 1000);
      const expectedMaxTime = Date.now() + (currentMinutes * 60 * 1000) + 1000;

      expect(result.getTime()).toBeGreaterThanOrEqual(expectedMinTime);
      expect(result.getTime()).toBeLessThanOrEqual(expectedMaxTime);
    });

    test('should throw error when update fails', async () => {
      const mockError = new Error('Database update failed');

      supabase.from = jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: mockError })
        })
      });

      await expect(touchSession(null, mockToken)).rejects.toThrow('Database update failed');
    });

    test('should set last_seen_at to current time', async () => {
      let capturedUpdateData;

      supabase.from = jest.fn().mockReturnValue({
        update: jest.fn().mockImplementation((data) => {
          capturedUpdateData = data;
          return {
            eq: jest.fn().mockResolvedValue({ error: null })
          };
        })
      });

      const beforeTime = new Date().toISOString();
      await touchSession(null, mockToken);
      const afterTime = new Date().toISOString();

      expect(capturedUpdateData.last_seen_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(capturedUpdateData.last_seen_at >= beforeTime).toBeTruthy();
      expect(capturedUpdateData.last_seen_at <= afterTime).toBeTruthy();
    });
  });

  describe('deleteSession', () => {
    const mockToken = 'test-token-delete';

    test('should delete session successfully', async () => {
      const mockEq = jest.fn().mockResolvedValue({ error: null });
      const mockDelete = jest.fn().mockReturnValue({
        eq: mockEq
      });

      supabase.from = jest.fn().mockReturnValue({
        delete: mockDelete
      });

      await deleteSession(null, mockToken);

      expect(supabase.from).toHaveBeenCalledWith('sessions');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('token', mockToken);
    });

    test('should not throw error when deletion succeeds', async () => {
      supabase.from = jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      });

      await expect(deleteSession(null, mockToken)).resolves.toBeUndefined();
    });

    test('should not throw error even when deletion fails', async () => {
      // The implementation doesn't check for errors in delete
      supabase.from = jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: new Error('Delete failed') })
        })
      });

      await expect(deleteSession(null, mockToken)).resolves.toBeUndefined();
    });

    test('should handle different token formats', async () => {
      const tokens = [
        'short',
        'a'.repeat(64),
        'token-with-dashes-123',
        'TOKEN_WITH_UNDERSCORES_456'
      ];

      for (const token of tokens) {
        let capturedToken;

        supabase.from = jest.fn().mockReturnValue({
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockImplementation((field, value) => {
              if (field === 'token') {
                capturedToken = value;
              }
              return Promise.resolve({ error: null });
            })
          })
        });

        await deleteSession(null, token);
        expect(capturedToken).toBe(token);
      }
    });

    test('should return undefined (no value)', async () => {
      supabase.from = jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      });

      const result = await deleteSession(null, mockToken);

      expect(result).toBeUndefined();
    });
  });
});
