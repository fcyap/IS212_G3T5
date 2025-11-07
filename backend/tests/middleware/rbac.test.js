const rbacMiddleware = require('../../src/middleware/rbac');
const supabase = require('../../src/utils/supabase');

// Mock Supabase
jest.mock('../../src/utils/supabase', () => ({
  from: jest.fn()
}));

// Mock roles module
jest.mock('../../src/auth/roles', () => ({
  canCreateProject: jest.fn(),
  canEditProject: jest.fn(),
  canAddProjectMembers: jest.fn()
}));

const { canCreateProject, canEditProject, canAddProjectMembers } = require('../../src/auth/roles');

describe('RBAC Middleware', () => {
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

  describe('requireProjectCreation', () => {
    it('should deny access if user is not authenticated', () => {
      req.user = null;

      rbacMiddleware.requireProjectCreation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow admin to create projects', () => {
      req.user = {
        id: 1,
        role: 'admin',
        hierarchy: 3,
        division: 'Engineering'
      };

      canCreateProject.mockReturnValue(true);

      rbacMiddleware.requireProjectCreation(req, res, next);

      expect(canCreateProject).toHaveBeenCalledWith({
        id: 1,
        role: 'admin',
        hierarchy: 3,
        division: 'Engineering'
      });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow manager to create projects', () => {
      req.user = {
        id: 2,
        role: 'manager',
        hierarchy: 2,
        division: 'Sales'
      };

      canCreateProject.mockReturnValue(true);

      rbacMiddleware.requireProjectCreation(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should deny staff from creating projects', () => {
      req.user = {
        id: 3,
        role: 'staff',
        hierarchy: 1,
        division: 'Operations'
      };

      canCreateProject.mockReturnValue(false);

      rbacMiddleware.requireProjectCreation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Access denied',
        message: 'Only managers and admins can create projects'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle user with missing role and default to staff', () => {
      req.user = {
        id: 4,
        division: 'Engineering'
      };

      canCreateProject.mockReturnValue(false);

      rbacMiddleware.requireProjectCreation(req, res, next);

      expect(canCreateProject).toHaveBeenCalledWith({
        id: 4,
        role: 'staff',
        hierarchy: 1,
        division: 'Engineering'
      });
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('requireProjectEdit', () => {
    it('should deny access if user is not authenticated', async () => {
      req.user = null;
      req.params.projectId = '123';

      const middleware = rbacMiddleware.requireProjectEdit(null);
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should deny access if projectId is missing', async () => {
      req.user = { id: 1, role: 'admin' };
      req.params = {};

      const middleware = rbacMiddleware.requireProjectEdit(null);
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    });

    it('should return 404 if project not found', async () => {
      req.user = { id: 1, role: 'admin', hierarchy: 3, division: 'Eng' };
      req.params.projectId = '999';

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

      const middleware = rbacMiddleware.requireProjectEdit(null);
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Project not found' });
    });

    it('should allow admin to edit any project', async () => {
      req.user = { id: 1, role: 'admin', hierarchy: 3, division: 'Eng' };
      req.params.projectId = '123';

      const mockProject = { id: '123', creator_id: 2, name: 'Test Project', status: 'active' };
      const mockCreator = { id: 2, role: 'manager', hierarchy: 2, division: 'Eng' };

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockLimit = jest.fn();
      const mockSingle = jest.fn();

      // First call for project
      mockLimit.mockResolvedValueOnce({ data: [mockProject], error: null });
      // Second call for creator
      mockSingle.mockResolvedValueOnce({ data: mockCreator, error: null });

      supabase.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            limit: mockLimit,
            single: mockSingle
          })
        })
      });

      canEditProject.mockReturnValue(true);

      const middleware = rbacMiddleware.requireProjectEdit(null);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow project creator to edit their project', async () => {
      req.user = { id: 2, role: 'manager', hierarchy: 2, division: 'Eng' };
      req.params.id = '123';

      const mockProject = { id: '123', creator_id: 2, name: 'Test Project', status: 'active' };
      const mockCreator = { id: 2, role: 'manager', hierarchy: 2, division: 'Eng' };

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockLimit = jest.fn();
      const mockSingle = jest.fn();

      mockLimit.mockResolvedValueOnce({ data: [mockProject], error: null });
      mockSingle.mockResolvedValueOnce({ data: mockCreator, error: null });

      supabase.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            limit: mockLimit,
            single: mockSingle
          })
        })
      });

      canEditProject.mockReturnValue(true);

      const middleware = rbacMiddleware.requireProjectEdit(null);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should deny access if user cannot edit project', async () => {
      req.user = { id: 3, role: 'staff', hierarchy: 1, division: 'Eng' };
      req.params.projectId = '123';

      const mockProject = { id: '123', creator_id: 2, name: 'Test Project', status: 'active' };
      const mockCreator = { id: 2, role: 'manager', hierarchy: 2, division: 'Eng' };

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockLimit = jest.fn();
      const mockSingle = jest.fn();

      mockLimit.mockResolvedValueOnce({ data: [mockProject], error: null });
      mockSingle.mockResolvedValueOnce({ data: mockCreator, error: null });

      supabase.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            limit: mockLimit,
            single: mockSingle
          })
        })
      });

      canEditProject.mockReturnValue(false);

      const middleware = rbacMiddleware.requireProjectEdit(null);
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Access denied',
        message: 'You do not have permission to edit this project'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle database error gracefully', async () => {
      req.user = { id: 1, role: 'admin', hierarchy: 3, division: 'Eng' };
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

      const middleware = rbacMiddleware.requireProjectEdit(null);
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Project not found' });
    });

    it('should handle exception during middleware execution', async () => {
      req.user = { id: 1, role: 'admin' };
      req.params.projectId = '123';

      supabase.from.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const middleware = rbacMiddleware.requireProjectEdit(null);
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });

    it('should handle missing creator data', async () => {
      req.user = { id: 1, role: 'admin', hierarchy: 3, division: 'Eng' };
      req.params.projectId = '123';

      const mockProject = { id: '123', creator_id: 2, name: 'Test Project', status: 'active' };

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockLimit = jest.fn();
      const mockSingle = jest.fn();

      mockLimit.mockResolvedValueOnce({ data: [mockProject], error: null });
      mockSingle.mockResolvedValueOnce({ data: null, error: null });

      supabase.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            limit: mockLimit,
            single: mockSingle
          })
        })
      });

      canEditProject.mockReturnValue(true);

      const middleware = rbacMiddleware.requireProjectEdit(null);
      await middleware(req, res, next);

      expect(canEditProject).toHaveBeenCalledWith(
        expect.any(Object),
        mockProject,
        { role: null, hierarchy: null, division: null }
      );
      expect(next).toHaveBeenCalled();
    });
  });

  describe('requireAddProjectMembers', () => {
    it('should deny access if user not authenticated', async () => {
      req.user = null;
      req.params.projectId = '123';

      const middleware = rbacMiddleware.requireAddProjectMembers(null);
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    });

    it('should deny access if projectId is missing', async () => {
      req.user = { id: 1, role: 'admin' };
      req.params = {};

      const middleware = rbacMiddleware.requireAddProjectMembers(null);
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 404 if project not found', async () => {
      req.user = { id: 1, role: 'admin', hierarchy: 3 };
      req.params.projectId = '999';

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

      const middleware = rbacMiddleware.requireAddProjectMembers(null);
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Project not found' });
    });

    it('should allow admin to add project members', async () => {
      req.user = { id: 1, role: 'admin', hierarchy: 3, division: 'Eng' };
      req.params.id = '123';

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

      canAddProjectMembers.mockReturnValue(true);

      const middleware = rbacMiddleware.requireAddProjectMembers(null);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow project creator to add members', async () => {
      req.user = { id: 2, role: 'staff', hierarchy: 1, division: 'Eng' };
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

      canAddProjectMembers.mockReturnValue(true);

      const middleware = rbacMiddleware.requireAddProjectMembers(null);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should deny non-authorized users from adding members', async () => {
      req.user = { id: 3, role: 'staff', hierarchy: 1, division: 'Eng' };
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

      canAddProjectMembers.mockReturnValue(false);

      const middleware = rbacMiddleware.requireAddProjectMembers(null);
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Access denied',
        message: 'You do not have permission to add members to this project'
      });
    });

    it('should handle database errors', async () => {
      req.user = { id: 1, role: 'admin', hierarchy: 3 };
      req.params.projectId = '123';

      supabase.from.mockImplementation(() => {
        throw new Error('DB connection failed');
      });

      const middleware = rbacMiddleware.requireAddProjectMembers(null);
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  describe('filterVisibleProjects', () => {
    it('should deny access if user not authenticated', async () => {
      req.user = null;

      const middleware = rbacMiddleware.filterVisibleProjects(null);
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    });

    it('should return 404 if user not found in database', async () => {
      req.user = { id: 999 };

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

      const middleware = rbacMiddleware.filterVisibleProjects(null);
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
    });

    it('should set no filter for admin users', async () => {
      req.user = { id: 1, role: 'admin' };

      const mockUser = { id: 1, role: 'admin', hierarchy: 3, division: 'Eng', department: 'IT' };

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockResolvedValue({ data: [mockUser], error: null });

      supabase.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            limit: mockLimit
          })
        })
      });

      const middleware = rbacMiddleware.filterVisibleProjects(null);
      await middleware(req, res, next);

      expect(req.visibilityFilter).toEqual({});
      expect(next).toHaveBeenCalled();
    });

    it('should set division filter for manager users', async () => {
      req.user = { id: 2, role: 'manager' };

      const mockUser = { id: 2, role: 'manager', hierarchy: 2, division: 'Sales', department: 'Marketing' };

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockResolvedValue({ data: [mockUser], error: null });

      supabase.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            limit: mockLimit
          })
        })
      });

      const middleware = rbacMiddleware.filterVisibleProjects(null);
      await middleware(req, res, next);

      expect(req.visibilityFilter).toEqual({
        currentUser: mockUser,
        canViewAll: false
      });
      expect(next).toHaveBeenCalled();
    });

    it('should set own projects filter for staff users', async () => {
      req.user = { id: 3, role: 'staff' };

      const mockUser = { id: 3, role: 'staff', hierarchy: 1, division: 'Ops', department: 'Support' };

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockResolvedValue({ data: [mockUser], error: null });

      supabase.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            limit: mockLimit
          })
        })
      });

      const middleware = rbacMiddleware.filterVisibleProjects(null);
      await middleware(req, res, next);

      expect(req.visibilityFilter).toEqual({
        currentUser: mockUser,
        canViewAll: false,
        onlyOwnProjects: true
      });
      expect(next).toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      req.user = { id: 1 };

      supabase.from.mockImplementation(() => {
        throw new Error('DB error');
      });

      const middleware = rbacMiddleware.filterVisibleProjects(null);
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });
});
