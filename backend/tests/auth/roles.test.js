const {
  canViewUserData,
  canCreateProject,
  canEditProject,
  canAddProjectMembers
} = require('../../src/auth/roles');

describe('Role Authorization Functions', () => {
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
