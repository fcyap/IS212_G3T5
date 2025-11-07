// Mock dependencies before requiring the module
jest.mock('../../src/auth/sessions');
jest.mock('../../src/utils/supabase');

const { authMiddleware, optionalAuthMiddleware, cookieName } = require('../../src/middleware/auth');
const { getSession, touchSession, deleteSession } = require('../../src/auth/sessions');
const supabase = require('../../src/utils/supabase');

describe('Auth Middleware', () => {
  let req, res, next;
  const mockToken = 'valid-token-123';
  const mockSession = {
    token: mockToken,
    user_id: 'user-123',
    email: 'test@example.com',
    expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    last_seen_at: new Date().toISOString()
  };

  beforeEach(() => {
    req = {
      cookies: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      locals: {}
    };
    next = jest.fn();
    jest.clearAllMocks();

    // Set default environment variable
    process.env.SESSION_COOKIE_NAME = 'spm_session';
  });

  describe('authMiddleware', () => {
    describe('when no token is provided', () => {
      test('should return 401 with Unauthenticated error', async () => {
        req.cookies = {};

        const middleware = authMiddleware();
        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Unauthenticated' });
        expect(next).not.toHaveBeenCalled();
      });

      test('should return 401 when cookies object is undefined', async () => {
        req.cookies = undefined;

        const middleware = authMiddleware();
        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Unauthenticated' });
        expect(next).not.toHaveBeenCalled();
      });

      test('should return 401 when token is empty string', async () => {
        req.cookies = { [cookieName]: '' };

        const middleware = authMiddleware();
        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Unauthenticated' });
        expect(next).not.toHaveBeenCalled();
      });
    });

    describe('when session is invalid', () => {
      test('should return 401 when session does not exist', async () => {
        req.cookies = { [cookieName]: mockToken };
        getSession.mockResolvedValue(null);
        deleteSession.mockResolvedValue();

        const middleware = authMiddleware();
        await middleware(req, res, next);

        expect(getSession).toHaveBeenCalledWith(null, mockToken);
        expect(deleteSession).toHaveBeenCalledWith(null, mockToken);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Invalid session' });
        expect(next).not.toHaveBeenCalled();
      });

      test('should handle deleteSession errors gracefully when session is invalid', async () => {
        req.cookies = { [cookieName]: mockToken };
        getSession.mockResolvedValue(null);
        deleteSession.mockRejectedValue(new Error('Delete failed'));

        const middleware = authMiddleware();
        await middleware(req, res, next);

        expect(deleteSession).toHaveBeenCalledWith(null, mockToken);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Invalid session' });
        expect(next).not.toHaveBeenCalled();
      });
    });

    describe('when session is expired', () => {
      test('should return 401 and delete session when expired', async () => {
        const expiredSession = {
          ...mockSession,
          expires_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
        };
        req.cookies = { [cookieName]: mockToken };
        getSession.mockResolvedValue(expiredSession);
        deleteSession.mockResolvedValue();

        const middleware = authMiddleware();
        await middleware(req, res, next);

        expect(getSession).toHaveBeenCalledWith(null, mockToken);
        expect(deleteSession).toHaveBeenCalledWith(null, mockToken);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Session expired' });
        expect(next).not.toHaveBeenCalled();
      });

      test('should handle deleteSession errors gracefully when session is expired', async () => {
        const expiredSession = {
          ...mockSession,
          expires_at: new Date(Date.now() - 3600000).toISOString()
        };
        req.cookies = { [cookieName]: mockToken };
        getSession.mockResolvedValue(expiredSession);
        deleteSession.mockRejectedValue(new Error('Delete failed'));

        const middleware = authMiddleware();
        await middleware(req, res, next);

        expect(deleteSession).toHaveBeenCalledWith(null, mockToken);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Session expired' });
        expect(next).not.toHaveBeenCalled();
      });

      test('should treat session expired exactly at current time as expired', async () => {
        const nowSession = {
          ...mockSession,
          expires_at: new Date(Date.now() - 1).toISOString() // 1ms in the past
        };
        req.cookies = { [cookieName]: mockToken };
        getSession.mockResolvedValue(nowSession);
        deleteSession.mockResolvedValue();

        // Mock supabase for buildUserFromSession (won't be called but needs to be defined)
        supabase.from = jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: null
              })
            })
          })
        });

        const middleware = authMiddleware();
        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: 'Session expired' });
        expect(next).not.toHaveBeenCalled();
      });
    });

    describe('when session is valid', () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'manager',
        hierarchy: 'L2',
        division: 'Engineering',
        department: 'Backend'
      };

      beforeEach(() => {
        req.cookies = { [cookieName]: mockToken };
        getSession.mockResolvedValue(mockSession);
        touchSession.mockResolvedValue(new Date(Date.now() + 3600000));
        supabase.from = jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockUser,
                error: null
              })
            })
          })
        });
      });

      test('should authenticate user successfully with full user data', async () => {
        const middleware = authMiddleware();
        await middleware(req, res, next);

        expect(getSession).toHaveBeenCalledWith(null, mockToken);
        expect(touchSession).toHaveBeenCalledWith(null, mockToken);
        expect(res.locals.sessionToken).toBe(mockToken);
        expect(res.locals.session).toEqual(mockSession);
        expect(res.locals.newExpiry).toBeDefined();
        expect(req.user).toEqual(mockUser);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      test('should use fallback user data when database query fails', async () => {
        supabase.from = jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'User not found' }
              })
            })
          })
        });

        const middleware = authMiddleware();
        await middleware(req, res, next);

        expect(req.user).toEqual({
          id: mockSession.user_id,
          email: mockSession.email
        });
        expect(next).toHaveBeenCalled();
      });

      test('should use fallback user data when user is null', async () => {
        supabase.from = jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: null
              })
            })
          })
        });

        const middleware = authMiddleware();
        await middleware(req, res, next);

        expect(req.user).toEqual({
          id: mockSession.user_id,
          email: mockSession.email
        });
        expect(next).toHaveBeenCalled();
      });

      test('should set all response locals correctly', async () => {
        const newExpiry = new Date(Date.now() + 7200000);
        touchSession.mockResolvedValue(newExpiry);

        const middleware = authMiddleware();
        await middleware(req, res, next);

        expect(res.locals.sessionToken).toBe(mockToken);
        expect(res.locals.session).toBe(mockSession);
        expect(res.locals.newExpiry).toBe(newExpiry);
      });

      test('should work with custom cookie name from environment', async () => {
        const customCookieName = 'custom_session';
        process.env.SESSION_COOKIE_NAME = customCookieName;

        // Re-require the module to pick up the new environment variable
        jest.resetModules();
        jest.mock('../../src/auth/sessions');
        jest.mock('../../src/utils/supabase');
        const { authMiddleware: customAuthMiddleware } = require('../../src/middleware/auth');
        const { getSession: getSessionMock, touchSession: touchSessionMock } = require('../../src/auth/sessions');
        const supabaseMock = require('../../src/utils/supabase');

        getSessionMock.mockResolvedValue(mockSession);
        touchSessionMock.mockResolvedValue(new Date(Date.now() + 3600000));
        supabaseMock.from = jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockUser,
                error: null
              })
            })
          })
        });

        req.cookies = { [customCookieName]: mockToken };
        const middleware = customAuthMiddleware();
        await middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.user).toBeDefined();

        // Reset for other tests
        process.env.SESSION_COOKIE_NAME = 'spm_session';
      });
    });
  });

  describe('optionalAuthMiddleware', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'manager',
      hierarchy: 'L2',
      division: 'Engineering',
      department: 'Backend'
    };

    beforeEach(() => {
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockUser,
              error: null
            })
          })
        })
      });
    });

    describe('when no token is provided', () => {
      test('should call next without authentication', async () => {
        req.cookies = {};

        const middleware = optionalAuthMiddleware();
        await middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.user).toBeUndefined();
        expect(res.locals.session).toBeUndefined();
      });

      test('should call next when cookies is undefined', async () => {
        req.cookies = undefined;

        const middleware = optionalAuthMiddleware();
        await middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.user).toBeUndefined();
      });

      test('should call next when token is empty string', async () => {
        req.cookies = { [cookieName]: '' };

        const middleware = optionalAuthMiddleware();
        await middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.user).toBeUndefined();
      });
    });

    describe('when session is invalid or expired', () => {
      test('should call next without error when session does not exist', async () => {
        req.cookies = { [cookieName]: mockToken };
        getSession.mockResolvedValue(null);

        const middleware = optionalAuthMiddleware();
        await middleware(req, res, next);

        expect(getSession).toHaveBeenCalledWith(null, mockToken);
        expect(next).toHaveBeenCalled();
        expect(req.user).toBeUndefined();
        expect(res.locals.session).toBeUndefined();
      });

      test('should call next without error when session is expired', async () => {
        const expiredSession = {
          ...mockSession,
          expires_at: new Date(Date.now() - 3600000).toISOString()
        };
        req.cookies = { [cookieName]: mockToken };
        getSession.mockResolvedValue(expiredSession);

        const middleware = optionalAuthMiddleware();
        await middleware(req, res, next);

        expect(getSession).toHaveBeenCalledWith(null, mockToken);
        expect(next).toHaveBeenCalled();
        expect(req.user).toBeUndefined();
        expect(res.locals.session).toBeUndefined();
      });

      test('should call next without error when session is exactly expired', async () => {
        const nowSession = {
          ...mockSession,
          expires_at: new Date(Date.now() - 1).toISOString() // 1ms in the past
        };
        req.cookies = { [cookieName]: mockToken };
        getSession.mockResolvedValue(nowSession);

        const middleware = optionalAuthMiddleware();
        await middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.user).toBeUndefined();
      });
    });

    describe('when session is valid', () => {
      beforeEach(() => {
        req.cookies = { [cookieName]: mockToken };
        getSession.mockResolvedValue(mockSession);
        touchSession.mockResolvedValue(new Date(Date.now() + 3600000));
      });

      test('should authenticate user and call next', async () => {
        const middleware = optionalAuthMiddleware();
        await middleware(req, res, next);

        expect(getSession).toHaveBeenCalledWith(null, mockToken);
        expect(touchSession).toHaveBeenCalledWith(null, mockToken);
        expect(res.locals.sessionToken).toBe(mockToken);
        expect(res.locals.session).toEqual(mockSession);
        expect(res.locals.newExpiry).toBeDefined();
        expect(req.user).toEqual(mockUser);
        expect(next).toHaveBeenCalled();
      });

      test('should set all response locals correctly', async () => {
        const newExpiry = new Date(Date.now() + 7200000);
        touchSession.mockResolvedValue(newExpiry);

        const middleware = optionalAuthMiddleware();
        await middleware(req, res, next);

        expect(res.locals.sessionToken).toBe(mockToken);
        expect(res.locals.session).toBe(mockSession);
        expect(res.locals.newExpiry).toBe(newExpiry);
      });

      test('should handle errors gracefully and continue', async () => {
        getSession.mockRejectedValue(new Error('Database error'));
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        const middleware = optionalAuthMiddleware();
        await middleware(req, res, next);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[optionalAuthMiddleware] error',
          expect.any(Error)
        );
        expect(next).toHaveBeenCalled();
        expect(req.user).toBeUndefined();

        consoleErrorSpy.mockRestore();
      });

      test('should handle touchSession errors and continue', async () => {
        touchSession.mockRejectedValue(new Error('Touch failed'));
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        const middleware = optionalAuthMiddleware();
        await middleware(req, res, next);

        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(next).toHaveBeenCalled();

        consoleErrorSpy.mockRestore();
      });

      test('should handle buildUserFromSession errors and continue', async () => {
        supabase.from = jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockRejectedValue(new Error('User fetch failed'))
            })
          })
        });
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        const middleware = optionalAuthMiddleware();
        await middleware(req, res, next);

        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(next).toHaveBeenCalled();

        consoleErrorSpy.mockRestore();
      });
    });
  });

  describe('cookieName export', () => {
    test('should export the correct cookie name from environment', () => {
      expect(cookieName).toBe('spm_session');
    });

    test('should use default cookie name when environment variable is not set', () => {
      const originalEnv = process.env.SESSION_COOKIE_NAME;
      delete process.env.SESSION_COOKIE_NAME;

      jest.resetModules();
      const { cookieName: defaultCookieName } = require('../../src/middleware/auth');

      expect(defaultCookieName).toBe('spm_session');

      process.env.SESSION_COOKIE_NAME = originalEnv;
    });
  });
});
