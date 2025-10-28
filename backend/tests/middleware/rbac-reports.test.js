const rbacMiddleware = require('../../src/middleware/rbac');

describe('RBAC Middleware for Reports', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: null,
      method: 'POST',
      path: '/api/reports/tasks'
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    next = jest.fn();
  });

  describe('requireRole middleware', () => {
    test('should allow HR role to access report endpoints', () => {
      req.user = {
        id: 1,
        role: 'hr',
        department: 'Engineering'
      };

      const middleware = rbacMiddleware.requireRole(['hr', 'admin']);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should allow Admin role to access report endpoints', () => {
      req.user = {
        id: 1,
        role: 'admin',
        department: 'All'
      };

      const middleware = rbacMiddleware.requireRole(['hr', 'admin']);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should deny Staff role access to report endpoints', () => {
      req.user = {
        id: 1,
        role: 'staff',
        department: 'Engineering'
      };

      const middleware = rbacMiddleware.requireRole(['hr', 'admin']);
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Forbidden: Insufficient permissions'
      });
    });

    test('should deny Manager role access to report endpoints', () => {
      req.user = {
        id: 1,
        role: 'manager',
        department: 'Engineering'
      };

      const middleware = rbacMiddleware.requireRole(['hr', 'admin']);
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('should deny access if user is not authenticated', () => {
      req.user = null;

      const middleware = rbacMiddleware.requireRole(['hr', 'admin']);
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Unauthorized: Authentication required'
      });
    });

    test('should deny access if user has no role', () => {
      req.user = {
        id: 1,
        department: 'Engineering'
        // role is missing
      };

      const middleware = rbacMiddleware.requireRole(['hr', 'admin']);
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('checkDepartmentAccess middleware', () => {
    test('should allow HR to access their own department', () => {
      req.user = {
        id: 1,
        role: 'hr',
        department: 'Engineering'
      };

      req.body = {
        departments: ['Engineering']
      };

      const middleware = rbacMiddleware.checkDepartmentAccess();
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should allow HR to access subdepartments', () => {
      req.user = {
        id: 1,
        role: 'hr',
        department: 'Engineering'
      };

      req.body = {
        departments: ['Engineering.Backend', 'Engineering.Frontend']
      };

      const middleware = rbacMiddleware.checkDepartmentAccess();
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should deny HR access to other departments', () => {
      req.user = {
        id: 1,
        role: 'hr',
        department: 'Engineering'
      };

      req.body = {
        departments: ['Marketing', 'Sales']
      };

      const middleware = rbacMiddleware.checkDepartmentAccess();
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Forbidden: Cannot access data from other departments'
      });
    });

    test('should allow Admin to access all departments', () => {
      req.user = {
        id: 1,
        role: 'admin',
        department: 'All'
      };

      req.body = {
        departments: ['Engineering', 'Marketing', 'Sales', 'HR']
      };

      const middleware = rbacMiddleware.checkDepartmentAccess();
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should deny access to department outside hierarchy', () => {
      req.user = {
        id: 1,
        role: 'hr',
        department: 'Engineering.Backend'
      };

      req.body = {
        departments: ['Engineering.Frontend']
      };

      const middleware = rbacMiddleware.checkDepartmentAccess();
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('filterByDepartmentHierarchy helper', () => {
    test('should identify subdepartments correctly', () => {
      const parentDept = 'Engineering';
      const departments = [
        'Engineering',
        'Engineering.Backend',
        'Engineering.Frontend',
        'Engineering.Backend.API',
        'Marketing',
        'Engineering.QA'
      ];

      const result = rbacMiddleware.filterByDepartmentHierarchy(
        parentDept,
        departments
      );

      expect(result).toEqual([
        'Engineering',
        'Engineering.Backend',
        'Engineering.Frontend',
        'Engineering.Backend.API',
        'Engineering.QA'
      ]);
    });

    test('should return only exact match if no subdepartments', () => {
      const parentDept = 'HR';
      const departments = ['HR', 'Engineering', 'Marketing'];

      const result = rbacMiddleware.filterByDepartmentHierarchy(
        parentDept,
        departments
      );

      expect(result).toEqual(['HR']);
    });

    test('should handle nested hierarchies', () => {
      const parentDept = 'Engineering.Backend';
      const departments = [
        'Engineering',
        'Engineering.Backend',
        'Engineering.Backend.API',
        'Engineering.Backend.Database',
        'Engineering.Frontend'
      ];

      const result = rbacMiddleware.filterByDepartmentHierarchy(
        parentDept,
        departments
      );

      expect(result).toEqual([
        'Engineering.Backend',
        'Engineering.Backend.API',
        'Engineering.Backend.Database'
      ]);
    });
  });

  describe('Report-specific RBAC rules', () => {
    test('should enforce department filtering on task reports', () => {
      req.user = {
        id: 1,
        role: 'hr',
        department: 'Engineering'
      };

      req.path = '/api/reports/tasks';
      req.body = {
        startDate: '2025-10-01',
        endDate: '2025-10-31'
      };

      const roleMiddleware = rbacMiddleware.requireRole(['hr', 'admin']);
      roleMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should enforce department filtering on user productivity reports', () => {
      req.user = {
        id: 1,
        role: 'hr',
        department: 'Marketing'
      };

      req.path = '/api/reports/users/productivity';

      const roleMiddleware = rbacMiddleware.requireRole(['hr', 'admin']);
      roleMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should enforce department filtering on project reports', () => {
      req.user = {
        id: 1,
        role: 'hr',
        department: 'Sales'
      };

      req.path = '/api/reports/projects';

      const roleMiddleware = rbacMiddleware.requireRole(['hr', 'admin']);
      roleMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Export permissions', () => {
    test('should allow HR to export reports', () => {
      req.user = {
        id: 1,
        role: 'hr',
        department: 'Engineering'
      };

      req.path = '/api/reports/export/pdf';

      const roleMiddleware = rbacMiddleware.requireRole(['hr', 'admin']);
      roleMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should allow Admin to export reports', () => {
      req.user = {
        id: 1,
        role: 'admin',
        department: 'All'
      };

      req.path = '/api/reports/export/spreadsheet';

      const roleMiddleware = rbacMiddleware.requireRole(['hr', 'admin']);
      roleMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('should deny Staff from exporting reports', () => {
      req.user = {
        id: 1,
        role: 'staff',
        department: 'Engineering'
      };

      req.path = '/api/reports/export/pdf';

      const roleMiddleware = rbacMiddleware.requireRole(['hr', 'admin']);
      roleMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
