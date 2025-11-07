const {
  getEffectiveRole,
  canViewUserData,
  canCreateProject,
  canEditProject,
  canAddProjectMembers,
  getVisibleUsers
} = require('../../src/auth/roles');

const { supabase } = require('../../src/supabase-client');

// Mock Supabase
jest.mock('../../src/supabase-client', () => ({
  supabase: {
    from: jest.fn()
  }
}));

describe('Role Authorization Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getEffectiveRole', () => {
    it('should return staff role for invalid userId (null)', async () => {
      const result = await getEffectiveRole(null);

      expect(result).toEqual({
        label: 'staff',
        level: 1,
        hierarchy: 1,
        division: null,
        department: null
      });
    });

    it('should return staff role for invalid userId (undefined)', async () => {
      const result = await getEffectiveRole(undefined);

      expect(result).toEqual({
        label: 'staff',
        level: 1,
        hierarchy: 1,
        division: null,
        department: null
      });
    });

    it('should return staff role for invalid userId (string "null")', async () => {
      const result = await getEffectiveRole('null');

      expect(result).toEqual({
        label: 'staff',
        level: 1,
        hierarchy: 1,
        division: null,
        department: null
      });
    });

    it('should return staff role for invalid userId (string "undefined")', async () => {
      const result = await getEffectiveRole('undefined');

      expect(result).toEqual({
        label: 'staff',
        level: 1,
        hierarchy: 1,
        division: null,
        department: null
      });
    });

    it('should return admin role for admin user', async () => {
      const mockUser = {
        role: 'admin',
        hierarchy: 3,
        division: 'Engineering',
        department: 'IT'
      };

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({ data: mockUser, error: null });

      supabase.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            single: mockSingle
          })
        })
      });

      const result = await getEffectiveRole('user123');

      expect(result).toEqual({
        label: 'admin',
        level: 3,
        hierarchy: 3,
        division: 'Engineering',
        department: 'IT'
      });
    });

    it('should return manager role for manager user', async () => {
      const mockUser = {
        role: 'manager',
        hierarchy: 2,
        division: 'Sales',
        department: 'Marketing'
      };

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({ data: mockUser, error: null });

      supabase.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            single: mockSingle
          })
        })
      });

      const result = await getEffectiveRole('user456');

      expect(result).toEqual({
        label: 'manager',
        level: 2,
        hierarchy: 2,
        division: 'Sales',
        department: 'Marketing'
      });
    });

    it('should return staff role for staff user', async () => {
      const mockUser = {
        role: 'staff',
        hierarchy: 1,
        division: 'Operations',
        department: 'Support'
      };

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({ data: mockUser, error: null });

      supabase.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            single: mockSingle
          })
        })
      });

      const result = await getEffectiveRole('user789');

      expect(result).toEqual({
        label: 'staff',
        level: 1,
        hierarchy: 1,
        division: 'Operations',
        department: 'Support'
      });
    });

    it('should return staff role for unknown role', async () => {
      const mockUser = {
        role: 'unknown_role',
        hierarchy: 2,
        division: 'Operations',
        department: 'Support'
      };

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({ data: mockUser, error: null });

      supabase.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            single: mockSingle
          })
        })
      });

      const result = await getEffectiveRole('user999');

      expect(result).toEqual({
        label: 'staff',
        level: 1,
        hierarchy: 2,
        division: 'Operations',
        department: 'Support'
      });
    });

    it('should return staff role when database error occurs', async () => {
      const mockError = new Error('Database connection failed');

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({ data: null, error: mockError });

      supabase.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            single: mockSingle
          })
        })
      });

      const result = await getEffectiveRole('user123');

      expect(result).toEqual({
        label: 'staff',
        level: 1,
        hierarchy: 1,
        division: null,
        department: null
      });
    });

    it('should return staff role when user not found', async () => {
      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({ data: null, error: null });

      supabase.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            single: mockSingle
          })
        })
      });

      const result = await getEffectiveRole('nonexistent');

      expect(result).toEqual({
        label: 'staff',
        level: 1,
        hierarchy: 1,
        division: null,
        department: null
      });
    });

    it('should handle missing role field and default to staff', async () => {
      const mockUser = {
        hierarchy: 1,
        division: 'Operations',
        department: 'Support'
      };

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({ data: mockUser, error: null });

      supabase.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            single: mockSingle
          })
        })
      });

      const result = await getEffectiveRole('user000');

      expect(result).toEqual({
        label: 'staff',
        level: 1,
        hierarchy: 1,
        division: 'Operations',
        department: 'Support'
      });
    });

    it('should handle case-insensitive role matching (uppercase ADMIN)', async () => {
      const mockUser = {
        role: 'ADMIN',
        hierarchy: 3,
        division: 'Engineering',
        department: 'IT'
      };

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({ data: mockUser, error: null });

      supabase.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            single: mockSingle
          })
        })
      });

      const result = await getEffectiveRole('user111');

      expect(result).toEqual({
        label: 'admin',
        level: 3,
        hierarchy: 3,
        division: 'Engineering',
        department: 'IT'
      });
    });

    it('should handle missing hierarchy and use default values', async () => {
      const mockUser = {
        role: 'admin',
        division: 'Engineering',
        department: 'IT'
      };

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockSingle = jest.fn().mockResolvedValue({ data: mockUser, error: null });

      supabase.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            single: mockSingle
          })
        })
      });

      const result = await getEffectiveRole('user222');

      expect(result).toEqual({
        label: 'admin',
        level: 3,
        hierarchy: 3,
        division: 'Engineering',
        department: 'IT'
      });
    });

    it('should handle exception thrown during query', async () => {
      supabase.from.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const result = await getEffectiveRole('user333');

      expect(result).toEqual({
        label: 'staff',
        level: 1,
        hierarchy: 1,
        division: null,
        department: null
      });
    });
  });

  describe('getVisibleUsers', () => {
    it('should return all users for admin', async () => {
      const adminUser = { role: 'admin', hierarchy: 3, division: 'Engineering' };
      const mockUsers = [
        { id: 1, name: 'User 1', email: 'user1@test.com', role: 'staff', hierarchy: 1, division: 'A', department: 'Dept1' },
        { id: 2, name: 'User 2', email: 'user2@test.com', role: 'manager', hierarchy: 2, division: 'B', department: 'Dept2' }
      ];

      const mockSelect = jest.fn().mockReturnThis();
      const mockOrder1 = jest.fn().mockReturnThis();
      const mockOrder2 = jest.fn().mockResolvedValue({ data: mockUsers, error: null });

      supabase.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          order: mockOrder1.mockReturnValue({
            order: mockOrder2
          })
        })
      });

      const result = await getVisibleUsers(adminUser);

      expect(result).toEqual(mockUsers);
    });

    it('should return users in same division with lower hierarchy for manager', async () => {
      const managerUser = { role: 'manager', hierarchy: 3, division: 'Engineering' };
      const mockUsers = [
        { id: 1, name: 'Staff 1', email: 'staff1@test.com', role: 'staff', hierarchy: 1, division: 'Engineering', department: 'Dev' },
        { id: 2, name: 'Staff 2', email: 'staff2@test.com', role: 'staff', hierarchy: 2, division: 'Engineering', department: 'QA' }
      ];

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockLt = jest.fn().mockReturnThis();
      const mockOrder1 = jest.fn().mockReturnThis();
      const mockOrder2 = jest.fn().mockResolvedValue({ data: mockUsers, error: null });

      supabase.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            lt: mockLt.mockReturnValue({
              order: mockOrder1.mockReturnValue({
                order: mockOrder2
              })
            })
          })
        })
      });

      const result = await getVisibleUsers(managerUser);

      expect(result).toEqual(mockUsers);
    });

    it('should return only self for staff user', async () => {
      const staffUser = { id: 1, role: 'staff', hierarchy: 1, division: 'Engineering' };
      const mockUsers = [
        { id: 1, name: 'Staff User', email: 'staff@test.com', role: 'staff', hierarchy: 1, division: 'Engineering', department: 'Dev' }
      ];

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();

      supabase.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockResolvedValue({ data: mockUsers, error: null })
        })
      });

      const result = await getVisibleUsers(staffUser);

      expect(result).toEqual(mockUsers);
    });

    it('should return empty array when database error occurs for admin', async () => {
      const adminUser = { role: 'admin', hierarchy: 3, division: 'Engineering' };

      const mockSelect = jest.fn().mockReturnThis();
      const mockOrder1 = jest.fn().mockReturnThis();
      const mockOrder2 = jest.fn().mockResolvedValue({ data: null, error: new Error('DB Error') });

      supabase.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          order: mockOrder1.mockReturnValue({
            order: mockOrder2
          })
        })
      });

      const result = await getVisibleUsers(adminUser);

      expect(result).toEqual([]);
    });

    it('should return empty array when database error occurs for manager', async () => {
      const managerUser = { role: 'manager', hierarchy: 3, division: 'Engineering' };

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockLt = jest.fn().mockReturnThis();
      const mockOrder1 = jest.fn().mockReturnThis();
      const mockOrder2 = jest.fn().mockResolvedValue({ data: null, error: new Error('DB Error') });

      supabase.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            lt: mockLt.mockReturnValue({
              order: mockOrder1.mockReturnValue({
                order: mockOrder2
              })
            })
          })
        })
      });

      const result = await getVisibleUsers(managerUser);

      expect(result).toEqual([]);
    });

    it('should return empty array when database error occurs for staff', async () => {
      const staffUser = { id: 1, role: 'staff', hierarchy: 1, division: 'Engineering' };

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();

      supabase.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockResolvedValue({ data: null, error: new Error('DB Error') })
        })
      });

      const result = await getVisibleUsers(staffUser);

      expect(result).toEqual([]);
    });

    it('should return empty array when exception thrown', async () => {
      const managerUser = { role: 'manager', hierarchy: 3, division: 'Engineering' };

      supabase.from.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const result = await getVisibleUsers(managerUser);

      expect(result).toEqual([]);
    });

    it('should handle manager with missing hierarchy (default to 0)', async () => {
      const managerUser = { role: 'manager', division: 'Engineering' };
      const mockUsers = [];

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockLt = jest.fn().mockReturnThis();
      const mockOrder1 = jest.fn().mockReturnThis();
      const mockOrder2 = jest.fn().mockResolvedValue({ data: mockUsers, error: null });

      supabase.from.mockReturnValue({
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            lt: mockLt.mockReturnValue({
              order: mockOrder1.mockReturnValue({
                order: mockOrder2
              })
            })
          })
        })
      });

      const result = await getVisibleUsers(managerUser);

      expect(result).toEqual([]);
      expect(mockLt).toHaveBeenCalledWith('hierarchy', 0);
    });
  });

  describe('canViewUserData', () => {
    it('should allow admin to view any user data', () => {
      const adminUser = { id: 1, role: 'admin', division: 'A', hierarchy: 3 };
      const targetUser = { id: 2, role: 'staff', division: 'B', hierarchy: 1 };

      expect(canViewUserData(adminUser, targetUser)).toBe(true);
    });

    it('should allow users to view their own data', () => {
      const user = { id: 1, role: 'staff', division: 'A', hierarchy: 1 };

      expect(canViewUserData(user, user)).toBe(true);
    });

    it('should allow manager to view staff in same division with lower hierarchy', () => {
      const managerUser = { id: 1, role: 'manager', division: 'A', hierarchy: 3 };
      const staffUser = { id: 2, role: 'staff', division: 'A', hierarchy: 1 };

      expect(canViewUserData(managerUser, staffUser)).toBe(true);
    });

    it('should not allow manager to view staff in different division', () => {
      const managerUser = { id: 1, role: 'manager', division: 'A', hierarchy: 3 };
      const staffUser = { id: 2, role: 'staff', division: 'B', hierarchy: 1 };

      expect(canViewUserData(managerUser, staffUser)).toBe(false);
    });

    it('should not allow manager to view staff with equal or higher hierarchy', () => {
      const managerUser = { id: 1, role: 'manager', division: 'A', hierarchy: 2 };
      const seniorStaff = { id: 2, role: 'staff', division: 'A', hierarchy: 2 };

      expect(canViewUserData(managerUser, seniorStaff)).toBe(false);
    });

    it('should not allow staff to view other staff data', () => {
      const staffUser1 = { id: 1, role: 'staff', division: 'A', hierarchy: 1 };
      const staffUser2 = { id: 2, role: 'staff', division: 'A', hierarchy: 1 };

      expect(canViewUserData(staffUser1, staffUser2)).toBe(false);
    });
  });

  describe('canCreateProject', () => {
    it('should allow admin to create projects', () => {
      const adminUser = { role: 'admin' };

      expect(canCreateProject(adminUser)).toBe(true);
    });

    it('should allow manager to create projects', () => {
      const managerUser = { role: 'manager' };

      expect(canCreateProject(managerUser)).toBe(true);
    });

    it('should not allow staff to create projects', () => {
      const staffUser = { role: 'staff' };

      expect(canCreateProject(staffUser)).toBe(false);
    });
  });

  describe('canEditProject', () => {
    const project = { id: 1, creator_id: 1, name: 'Test Project' };

    it('should allow admin to edit any project', () => {
      const adminUser = { id: 2, role: 'admin', division: 'B', hierarchy: 3 };
      const creator = { id: 1, role: 'manager', division: 'A', hierarchy: 2 };

      expect(canEditProject(adminUser, project, creator)).toBe(true);
    });

    it('should allow project creator to edit their own project', () => {
      const creatorUser = { id: 1, role: 'manager', division: 'A', hierarchy: 2 };

      expect(canEditProject(creatorUser, project, creatorUser)).toBe(true);
    });

    it('should allow manager with higher hierarchy in same division to edit', () => {
      const managerUser = { id: 2, role: 'manager', division: 'A', hierarchy: 3 };
      const creator = { id: 1, role: 'manager', division: 'A', hierarchy: 2 };

      expect(canEditProject(managerUser, project, creator)).toBe(true);
    });

    it('should not allow manager from different division to edit', () => {
      const managerUser = { id: 2, role: 'manager', division: 'B', hierarchy: 3 };
      const creator = { id: 1, role: 'manager', division: 'A', hierarchy: 2 };

      expect(canEditProject(managerUser, project, creator)).toBe(false);
    });

    it('should not allow manager with equal or lower hierarchy to edit', () => {
      const managerUser = { id: 2, role: 'manager', division: 'A', hierarchy: 2 };
      const creator = { id: 1, role: 'manager', division: 'A', hierarchy: 2 };

      expect(canEditProject(managerUser, project, creator)).toBe(false);
    });

    it('should not allow staff to edit projects they did not create', () => {
      const staffUser = { id: 2, role: 'staff', division: 'A', hierarchy: 1 };
      const creator = { id: 1, role: 'manager', division: 'A', hierarchy: 2 };

      expect(canEditProject(staffUser, project, creator)).toBe(false);
    });
  });

  describe('canAddProjectMembers', () => {
    const project = { id: 1, creator_id: 1, name: 'Test Project' };

    it('should allow admin to add project members', () => {
      const adminUser = { id: 2, role: 'admin' };

      expect(canAddProjectMembers(adminUser, project)).toBe(true);
    });

    it('should allow manager to add project members', () => {
      const managerUser = { id: 2, role: 'manager' };

      expect(canAddProjectMembers(managerUser, project)).toBe(true);
    });

    it('should allow project creator to add members', () => {
      const creatorUser = { id: 1, role: 'staff' };

      expect(canAddProjectMembers(creatorUser, project)).toBe(true);
    });

    it('should not allow non-creator staff to add members', () => {
      const staffUser = { id: 2, role: 'staff' };

      expect(canAddProjectMembers(staffUser, project)).toBe(false);
    });
  });
});
