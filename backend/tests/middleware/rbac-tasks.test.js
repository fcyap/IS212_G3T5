const rbacMiddleware = require('../../src/middleware/rbac');
const supabase = require('../../src/utils/supabase');

// Mock Supabase
jest.mock('../../src/utils/supabase', () => ({
  from: jest.fn()
}));

describe('RBAC Middleware - Task Operations', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      user: null,
      params: {},
      body: {}
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      locals: {}
    };

    next = jest.fn();
  });

  describe('requireTaskCreation', () => {
    it('should deny access if user not authenticated', async () => {
      req.user = null;
      res.locals.session = null;
      req.params.projectId = '123';

      const middleware = rbacMiddleware.requireTaskCreation();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow task creation if no project specified (personal tasks)', async () => {
      req.user = { id: 1, role: 'staff' };
      req.params.projectId = null;
      req.body.project_id = null;

      const middleware = rbacMiddleware.requireTaskCreation();
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 404 if project not found', async () => {
      req.user = { id: 1, role: 'staff' };
      req.body.project_id = '999';

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockResolvedValue({ data: [], error: null });

      supabase.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            limit: mockLimit
          })
        })
      });

      const middleware = rbacMiddleware.requireTaskCreation();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Project not found' });
    });

    it('should handle database query error', async () => {
      req.user = { id: 1, role: 'staff' };
      req.params.projectId = '123';

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockResolvedValue({ data: null, error: new Error('DB Error') });

      supabase.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            limit: mockLimit
          })
        })
      });

      const middleware = rbacMiddleware.requireTaskCreation();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Database query failed' });
    });

    it('should allow admin to create tasks in any project', async () => {
      req.user = { id: 1, role: 'admin', hierarchy: 3, division: 'Eng' };
      req.params.projectId = '123';

      const mockProject = { id: '123', creator_id: 2 };

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockResolvedValue({ data: [mockProject], error: null });

      supabase.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            limit: mockLimit
          })
        })
      });

      const middleware = rbacMiddleware.requireTaskCreation();
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow project creator to create tasks', async () => {
      req.user = { id: 2, role: 'staff', hierarchy: 1, division: 'Eng' };
      req.body.project_id = '123';

      const mockProject = { id: '123', creator_id: 2 };

      // Mock the Supabase call for project
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: [mockProject], error: null })
          })
        })
      });

      const middleware = rbacMiddleware.requireTaskCreation();
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow project member to create tasks', async () => {
      res.locals.session = { user_id: 3, role: 'staff', hierarchy: 1, division: 'Eng' };
      req.params.projectId = '123';

      const mockProject = { id: '123', creator_id: 2 };
      const mockMember = [{ user_id: 3 }];

      // First call for project
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: [mockProject], error: null })
          })
        })
      });

      // Second call for project members
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: mockMember, error: null })
            })
          })
        })
      });

      const middleware = rbacMiddleware.requireTaskCreation();
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow manager with higher hierarchy to create tasks', async () => {
      req.user = { id: 4, role: 'manager', hierarchy: 3, division: 'Eng' };
      req.params.projectId = '123';

      const mockProject = { id: '123', creator_id: 2 };
      const mockCreator = { role: 'manager', hierarchy: 2, division: 'Eng' };

      // First call for project
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: [mockProject], error: null })
          })
        })
      });

      // Second call for project members (not a member)
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: [], error: null })
            })
          })
        })
      });

      // Third call for creator info
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockCreator, error: null })
          })
        })
      });

      const middleware = rbacMiddleware.requireTaskCreation();
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should deny manager from different division', async () => {
      req.user = { id: 4, role: 'manager', hierarchy: 3, division: 'Sales' };
      req.params.projectId = '123';

      const mockProject = { id: '123', creator_id: 2 };
      const mockCreator = { role: 'manager', hierarchy: 2, division: 'Eng' };

      // First call for project
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: [mockProject], error: null })
          })
        })
      });

      // Second call for project members (not a member)
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: [], error: null })
            })
          })
        })
      });

      // Third call for creator info
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockCreator, error: null })
          })
        })
      });

      const middleware = rbacMiddleware.requireTaskCreation();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Access denied',
        message: 'You do not have permission to create tasks in this project'
      });
    });

    it('should deny manager with equal or lower hierarchy', async () => {
      req.user = { id: 4, role: 'manager', hierarchy: 2, division: 'Eng' };
      req.params.projectId = '123';

      const mockProject = { id: '123', creator_id: 2 };
      const mockCreator = { role: 'manager', hierarchy: 2, division: 'Eng' };

      // First call for project
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: [mockProject], error: null })
          })
        })
      });

      // Second call for project members (not a member)
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: [], error: null })
            })
          })
        })
      });

      // Third call for creator info
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockCreator, error: null })
          })
        })
      });

      const middleware = rbacMiddleware.requireTaskCreation();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should deny non-member staff from creating tasks', async () => {
      req.user = { id: 5, role: 'staff', hierarchy: 1, division: 'Eng' };
      req.params.projectId = '123';

      const mockProject = { id: '123', creator_id: 2 };
      const mockCreator = { role: 'manager', hierarchy: 2, division: 'Eng' };

      // First call for project
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: [mockProject], error: null })
          })
        })
      });

      // Second call for project members (not a member)
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: [], error: null })
            })
          })
        })
      });

      // Third call for creator info
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockCreator, error: null })
          })
        })
      });

      const middleware = rbacMiddleware.requireTaskCreation();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should handle exception during execution', async () => {
      req.user = { id: 1, role: 'staff' };
      req.params.projectId = '123';

      supabase.from.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const middleware = rbacMiddleware.requireTaskCreation();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  describe('requireTaskModification', () => {
    it('should deny access if user not authenticated', async () => {
      req.user = null;
      res.locals.session = null;
      req.params.id = '456';

      const middleware = rbacMiddleware.requireTaskModification();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    });

    it('should deny access if taskId is missing', async () => {
      req.user = { id: 1, role: 'staff' };
      req.params = {};

      const middleware = rbacMiddleware.requireTaskModification();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 404 if task not found', async () => {
      req.user = { id: 1, role: 'staff' };
      req.params.taskId = '999';

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockResolvedValue({ data: [], error: null });

      supabase.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            limit: mockLimit
          })
        })
      });

      const middleware = rbacMiddleware.requireTaskModification();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Task not found' });
    });

    it('should handle database query error', async () => {
      req.user = { id: 1, role: 'staff' };
      req.params.id = '456';

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockResolvedValue({ data: null, error: new Error('DB Error') });

      supabase.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            limit: mockLimit
          })
        })
      });

      const middleware = rbacMiddleware.requireTaskModification();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Database query failed' });
    });

    it('should allow admin to modify any task', async () => {
      req.user = { id: 1, role: 'admin', hierarchy: 3, division: 'Eng' };
      req.params.id = '456';

      const mockTask = { id: '456', project_id: '123', assigned_to: [2] };

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockResolvedValue({ data: [mockTask], error: null });

      supabase.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            limit: mockLimit
          })
        })
      });

      const middleware = rbacMiddleware.requireTaskModification();
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow assigned user to modify task', async () => {
      res.locals.session = { user_id: 2, role: 'staff', hierarchy: 1, division: 'Eng' };
      req.params.id = '456';

      const mockTask = { id: '456', project_id: '123', assigned_to: [2, 3] };

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockResolvedValue({ data: [mockTask], error: null });

      supabase.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            limit: mockLimit
          })
        })
      });

      const middleware = rbacMiddleware.requireTaskModification();
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow project creator to modify task', async () => {
      req.user = { id: 2, role: 'manager', hierarchy: 2, division: 'Eng' };
      req.params.id = '456';

      const mockTask = { id: '456', project_id: '123', assigned_to: [3] };
      const mockProject = { creator_id: 2 };

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockLimit = jest.fn();
      const mockSingle = jest.fn();

      // First call for task
      mockLimit.mockResolvedValueOnce({ data: [mockTask], error: null });
      // Second call for project
      mockSingle.mockResolvedValueOnce({ data: mockProject, error: null });

      supabase.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            limit: mockLimit,
            single: mockSingle
          })
        })
      });

      const middleware = rbacMiddleware.requireTaskModification();
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow project member to modify task', async () => {
      req.user = { id: 3, role: 'staff', hierarchy: 1, division: 'Eng' };
      req.params.id = '456';

      const mockTask = { id: '456', project_id: '123', assigned_to: [2] };
      const mockProject = { creator_id: 2 };
      const mockMember = [{ user_id: 3 }];

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockLimit = jest.fn();
      const mockSingle = jest.fn();

      // First call for task
      mockLimit.mockResolvedValueOnce({ data: [mockTask], error: null });
      // Second call for project
      mockSingle.mockResolvedValueOnce({ data: mockProject, error: null });
      // Third call for project members
      mockLimit.mockResolvedValueOnce({ data: mockMember, error: null });

      supabase.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            limit: mockLimit,
            single: mockSingle
          })
        })
      });

      const middleware = rbacMiddleware.requireTaskModification();
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow manager with higher hierarchy to modify task', async () => {
      req.user = { id: 4, role: 'manager', hierarchy: 3, division: 'Eng' };
      req.params.id = '456';

      const mockTask = { id: '456', project_id: '123', assigned_to: [2] };
      const mockProject = { creator_id: 2 };
      const mockCreator = { role: 'manager', hierarchy: 2, division: 'Eng' };

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockLimit = jest.fn();
      const mockSingle = jest.fn();

      // First call for task
      mockLimit.mockResolvedValueOnce({ data: [mockTask], error: null });
      // Second call for project
      mockSingle.mockResolvedValueOnce({ data: mockProject, error: null });
      // Third call for project members (not a member)
      mockLimit.mockResolvedValueOnce({ data: [], error: null });
      // Fourth call for creator info
      mockSingle.mockResolvedValueOnce({ data: mockCreator, error: null });

      supabase.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            limit: mockLimit,
            single: mockSingle
          })
        })
      });

      const middleware = rbacMiddleware.requireTaskModification();
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should deny unauthorized user from modifying task', async () => {
      req.user = { id: 5, role: 'staff', hierarchy: 1, division: 'Eng' };
      req.params.id = '456';

      const mockTask = { id: '456', project_id: '123', assigned_to: [2] };
      const mockProject = { creator_id: 2 };
      const mockCreator = { role: 'manager', hierarchy: 2, division: 'Eng' };

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockLimit = jest.fn();
      const mockSingle = jest.fn();

      mockLimit.mockResolvedValueOnce({ data: [mockTask], error: null });
      mockSingle.mockResolvedValueOnce({ data: mockProject, error: null });
      mockLimit.mockResolvedValueOnce({ data: [], error: null });
      mockSingle.mockResolvedValueOnce({ data: mockCreator, error: null });

      supabase.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            limit: mockLimit,
            single: mockSingle
          })
        })
      });

      const middleware = rbacMiddleware.requireTaskModification();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Access denied',
        message: 'You do not have permission to modify this task'
      });
    });

    it('should handle personal task (no project_id)', async () => {
      req.user = { id: 2, role: 'staff', hierarchy: 1, division: 'Eng' };
      req.params.id = '456';

      const mockTask = { id: '456', project_id: null, assigned_to: [2] };

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockResolvedValue({ data: [mockTask], error: null });

      supabase.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            limit: mockLimit
          })
        })
      });

      const middleware = rbacMiddleware.requireTaskModification();
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should handle exception during execution', async () => {
      req.user = { id: 1, role: 'staff' };
      req.params.id = '456';

      supabase.from.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const middleware = rbacMiddleware.requireTaskModification();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });
});
