const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');

// Mock dependencies before requiring the module
jest.mock('../../src/auth/sessions');
jest.mock('../../src/auth/roles');
jest.mock('../../src/utils/supabase');
jest.mock('../../src/middleware/auth');

const { authRoutes } = require('../../src/routes/auth');
const { createSession, deleteSession } = require('../../src/auth/sessions');
const { getEffectiveRole } = require('../../src/auth/roles');
const supabase = require('../../src/utils/supabase');
const { authMiddleware, cookieName } = require('../../src/middleware/auth');

describe('Auth Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default authMiddleware mock - passes through
    authMiddleware.mockReturnValue((req, res, next) => next());

    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/auth', authRoutes());

    // Set up default environment
    process.env.NODE_ENV = 'test';
    process.env.SESSION_IDLE_MINUTES = '15';
  });

  describe('POST /auth/login', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      password_hash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456789', // Valid bcrypt hash format
      name: 'Test User',
      role: 'manager',
      hierarchy: 'L2',
      division: 'Engineering',
      department: 'Backend'
    };

    beforeEach(() => {
      createSession.mockResolvedValue({
        token: 'test-token-123',
        expiresAt: new Date(Date.now() + 900000)
      });
      getEffectiveRole.mockResolvedValue({
        label: 'manager',
        level: 2
      });
    });

    test('should login successfully with valid credentials', async () => {
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          ilike: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({
              data: [mockUser],
              error: null
            })
          })
        })
      });

      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        role: mockUser.role,
        hierarchy: mockUser.hierarchy,
        division: mockUser.division,
        department: mockUser.department
      });
      expect(res.body.role).toEqual({ label: 'manager', level: 2 });
      expect(res.body.expiresAt).toBeDefined();
      expect(createSession).toHaveBeenCalledWith(null, mockUser.id);
      expect(getEffectiveRole).toHaveBeenCalledWith(mockUser.id);
    });

    test('should return 400 when email is missing', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Email and password required');
    });

    test('should return 400 when password is missing', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Email and password required');
    });

    test('should return 400 when body is empty', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Email and password required');
    });

    test('should return 401 when user not found', async () => {
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          ilike: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        })
      });

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    test('should return 401 when password_hash is missing', async () => {
      const userWithoutHash = { ...mockUser, password_hash: null };
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          ilike: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({
              data: [userWithoutHash],
              error: null
            })
          })
        })
      });

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    test('should return 401 when password_hash is not bcrypt format', async () => {
      const userWithInvalidHash = { ...mockUser, password_hash: 'plaintext' };
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          ilike: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({
              data: [userWithInvalidHash],
              error: null
            })
          })
        })
      });

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    test('should return 401 when password is incorrect', async () => {
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          ilike: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({
              data: [mockUser],
              error: null
            })
          })
        })
      });

      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    test('should set secure cookie with session token', async () => {
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          ilike: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({
              data: [mockUser],
              error: null
            })
          })
        })
      });

      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.headers['set-cookie']).toBeDefined();
      expect(res.headers['set-cookie'][0]).toContain('spm_session=test-token-123');
      expect(res.headers['set-cookie'][0]).toContain('HttpOnly');
    });

    test('should return 500 on database error', async () => {
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          ilike: jest.fn().mockReturnValue({
            limit: jest.fn().mockRejectedValue(new Error('Database error'))
          })
        })
      });

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal Server Error');
    });

    test('should return 500 when session creation fails', async () => {
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          ilike: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({
              data: [mockUser],
              error: null
            })
          })
        })
      });

      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      createSession.mockRejectedValue(new Error('Session creation failed'));

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal Server Error');
    });
  });

  describe('POST /auth/debug-login', () => {
    const mockUser = {
      id: 'user-456',
      email: 'debug@example.com',
      password_hash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456789',
      role: 'admin'
    };

    test('should return debug info for valid credentials', async () => {
      supabase.from = jest.fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({
              data: [{ id: 'test' }],
              error: null
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            ilike: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [mockUser],
                error: null
              })
            })
          })
        });

      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const res = await request(app)
        .post('/auth/debug-login')
        .send({ email: 'debug@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.id).toBe(mockUser.id);
      expect(res.body.message).toBe('Login test successful');
    });

    test('should return 400 when email is missing', async () => {
      const res = await request(app)
        .post('/auth/debug-login')
        .send({ password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Email and password required');
    });

    test('should return 401 when user not found', async () => {
      supabase.from = jest.fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({
              data: [{ id: 'test' }],
              error: null
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            ilike: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [],
                error: null
              })
            })
          })
        });

      const res = await request(app)
        .post('/auth/debug-login')
        .send({ email: 'notfound@example.com', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('User not found');
    });

    test('should return 401 when password_hash is missing', async () => {
      const userWithoutHash = { ...mockUser, password_hash: null };
      supabase.from = jest.fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({
              data: [{ id: 'test' }],
              error: null
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            ilike: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [userWithoutHash],
                error: null
              })
            })
          })
        });

      const res = await request(app)
        .post('/auth/debug-login')
        .send({ email: 'debug@example.com', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('No password set for user');
    });

    test('should return 401 when password is incorrect', async () => {
      supabase.from = jest.fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({
              data: [{ id: 'test' }],
              error: null
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            ilike: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [mockUser],
                error: null
              })
            })
          })
        });

      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

      const res = await request(app)
        .post('/auth/debug-login')
        .send({ email: 'debug@example.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid password');
    });

    test('should return 500 on database error', async () => {
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockRejectedValue(new Error('Database error'))
        })
      });

      const res = await request(app)
        .post('/auth/debug-login')
        .send({ email: 'debug@example.com', password: 'password123' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal Server Error');
      expect(res.body.details).toBe('Database error');
    });

    test('should sanitize email in logs to prevent injection', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      supabase.from = jest.fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({
              data: [{ id: 'test' }],
              error: null
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            ilike: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [],
                error: null
              })
            })
          })
        });

      await request(app)
        .post('/auth/debug-login')
        .send({ email: 'test\n@example.com', password: 'password123' });

      // Check that email was sanitized (no newlines)
      const logCalls = consoleLogSpy.mock.calls.flat().join(' ');
      expect(logCalls).not.toContain('\n@example.com');

      consoleLogSpy.mockRestore();
    });
  });

  describe('POST /auth/logout', () => {
    test('should logout successfully with valid session', async () => {
      deleteSession.mockResolvedValue();

      const res = await request(app)
        .post('/auth/logout')
        .set('Cookie', ['spm_session=test-token-123']);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(deleteSession).toHaveBeenCalledWith(null, 'test-token-123');
      expect(res.headers['set-cookie']).toBeDefined();
      expect(res.headers['set-cookie'][0]).toContain('spm_session=;');
    });

    test('should logout successfully without session cookie', async () => {
      const res = await request(app).post('/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(deleteSession).not.toHaveBeenCalled();
    });

    test('should handle deleteSession errors gracefully', async () => {
      deleteSession.mockRejectedValue(new Error('Delete failed'));

      const res = await request(app)
        .post('/auth/logout')
        .set('Cookie', ['spm_session=test-token-123']);

      // The route doesn't catch the error, so it should propagate
      // But based on the implementation, the error is not caught
      expect(res.status).toBe(500);
    });
  });

  describe('POST /auth/supabase-login', () => {
    const mockUser = {
      id: 'user-789',
      email: 'supabase@example.com',
      password_hash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456789',
      name: 'Supabase User',
      role: 'admin',
      hierarchy: 'L3',
      division: 'IT',
      department: 'Infrastructure'
    };

    test('should login successfully via supabase', async () => {
      supabase.from = jest.fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockUser,
                error: null
              })
            })
          })
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValue({ error: null })
        });

      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const res = await request(app)
        .post('/auth/supabase-login')
        .send({ email: 'SUPABASE@EXAMPLE.COM', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(mockUser.email);
      expect(res.body.role).toEqual({ label: 'admin', level: 3 });
      expect(res.headers['set-cookie']).toBeDefined();
    });

    test('should return 400 when email is missing', async () => {
      const res = await request(app)
        .post('/auth/supabase-login')
        .send({ password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Email and password required');
    });

    test('should return 401 when user not found', async () => {
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' }
            })
          })
        })
      });

      const res = await request(app)
        .post('/auth/supabase-login')
        .send({ email: 'notfound@example.com', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    test('should return 401 when password_hash is invalid', async () => {
      const userWithInvalidHash = { ...mockUser, password_hash: 'invalid' };
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: userWithInvalidHash,
              error: null
            })
          })
        })
      });

      const res = await request(app)
        .post('/auth/supabase-login')
        .send({ email: 'supabase@example.com', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    test('should return 401 when password is incorrect', async () => {
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

      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

      const res = await request(app)
        .post('/auth/supabase-login')
        .send({ email: 'supabase@example.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    test('should return 500 when session creation fails', async () => {
      supabase.from = jest.fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockUser,
                error: null
              })
            })
          })
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValue({
            error: { message: 'Insert failed' }
          })
        });

      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const res = await request(app)
        .post('/auth/supabase-login')
        .send({ email: 'supabase@example.com', password: 'password123' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Session creation failed');
    });

    test('should handle manager role correctly', async () => {
      const managerUser = { ...mockUser, role: 'manager' };
      supabase.from = jest.fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: managerUser,
                error: null
              })
            })
          })
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValue({ error: null })
        });

      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const res = await request(app)
        .post('/auth/supabase-login')
        .send({ email: 'supabase@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.role).toEqual({ label: 'manager', level: 2 });
    });

    test('should handle staff role correctly', async () => {
      const staffUser = { ...mockUser, role: 'staff' };
      supabase.from = jest.fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: staffUser,
                error: null
              })
            })
          })
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValue({ error: null })
        });

      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const res = await request(app)
        .post('/auth/supabase-login')
        .send({ email: 'supabase@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.role).toEqual({ label: 'staff', level: 1 });
    });
  });

  describe('GET /auth/me', () => {
    const mockSession = {
      token: 'test-token-me',
      user_id: 'user-me-123',
      expires_at: new Date(Date.now() + 3600000).toISOString()
    };

    const mockUser = {
      id: 'user-me-123',
      email: 'me@example.com',
      name: 'Me User',
      role: 'manager',
      hierarchy: 'L2',
      division: 'Engineering',
      department: 'Backend'
    };

    beforeEach(() => {
      // Override authMiddleware mock for /auth/me tests
      authMiddleware.mockReturnValue((req, res, next) => {
        res.locals.session = mockSession;
        res.locals.newExpiry = new Date(Date.now() + 900000);
        next();
      });

      getEffectiveRole.mockResolvedValue({
        label: 'manager',
        level: 2
      });

      // Recreate app with new authMiddleware mock
      app = express();
      app.use(express.json());
      app.use(cookieParser());
      app.use('/auth', authRoutes());
    });

    test('should return current user info when authenticated', async () => {
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({
              data: [mockUser],
              error: null
            })
          })
        })
      });

      const res = await request(app).get('/auth/me');

      expect(res.status).toBe(200);
      expect(res.body.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        role: mockUser.role,
        hierarchy: mockUser.hierarchy,
        division: mockUser.division,
        department: mockUser.department
      });
      expect(res.body.role).toEqual({ label: 'manager', level: 2 });
      expect(res.body.expiresAt).toBeDefined();
    });

    test('should return 404 when user not found', async () => {
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        })
      });

      const res = await request(app).get('/auth/me');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('User not found');
    });

    test('should return 500 on database error', async () => {
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            limit: jest.fn().mockRejectedValue(new Error('Database error'))
          })
        })
      });

      const res = await request(app).get('/auth/me');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal Server Error');
    });

    test('should return 500 when getEffectiveRole fails', async () => {
      supabase.from = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({
              data: [mockUser],
              error: null
            })
          })
        })
      });

      getEffectiveRole.mockRejectedValue(new Error('Role lookup failed'));

      const res = await request(app).get('/auth/me');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal Server Error');
    });
  });
});
