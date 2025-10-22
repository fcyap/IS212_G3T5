const request = require('supertest');
const express = require('express');

jest.mock('../../src/utils/supabase', () => ({
  from: jest.fn()
}));

jest.mock('../../src/repository/taskRepository');
jest.mock('../../src/repository/projectRepository');
jest.mock('../../src/repository/projectMemberRepository');
jest.mock('../../src/repository/userRepository');
jest.mock('../../src/services/notificationService');

const supabase = require('../../src/utils/supabase');
const taskRepository = require('../../src/repository/taskRepository');
const projectRepository = require('../../src/repository/projectRepository');
const projectMemberRepository = require('../../src/repository/projectMemberRepository');
const userRepository = require('../../src/repository/userRepository');
const taskService = require('../../src/services/taskService');
const tasksRouter = require('../../src/routes/Tasks');

describe('Task access RBAC (integration)', () => {
  let app;
  let currentUser;

  const baseTasks = [
    { id: 1, title: 'Manager personal', project_id: 90, assigned_to: [40], status: 'pending' },
    { id: 2, title: 'Subordinate project', project_id: 55, assigned_to: [301], status: 'pending' },
    { id: 3, title: 'External project', project_id: 77, assigned_to: [302], status: 'pending' }
  ];

  const baseUsers = [
    { id: 40, name: 'Manager' },
    { id: 301, name: 'Sales Staff' },
    { id: 302, name: 'Other Staff' }
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    supabase.from.mockReset();
    supabase.from.mockImplementation(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve({ data: [], error: null }))
        })),
        in: jest.fn(() => Promise.resolve({ data: [], error: null }))
      }))
    }));

    projectRepository.canUserManageMembers.mockResolvedValue(false);
    projectMemberRepository.getProjectIdsForUser.mockResolvedValue([]);
    userRepository.getUserById = jest.fn();

    currentUser = { id: 1, role: 'staff', hierarchy: 1, division: 'sales' };

    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = currentUser;
      next();
    });
    app.use('/tasks', tasksRouter);
  });

  test('manager can view tasks from accessible projects and their own tasks', async () => {
    taskRepository.list.mockResolvedValue({ data: baseTasks, error: null });
    taskRepository.getUsersByIds.mockResolvedValue({ data: baseUsers, error: null });

    const rbacSpy = jest.spyOn(taskService, '_getAccessibleProjectIds').mockResolvedValue([55]);

    currentUser = { id: 40, role: 'manager', hierarchy: 3, division: 'sales' };

    const res = await request(app).get('/tasks').expect(200);

    expect(res.body.map((t) => t.id)).toEqual([1, 2]);
    expect(rbacSpy).toHaveBeenCalledWith(40, 'manager', 3, 'sales');
    rbacSpy.mockRestore();
  });

  test('staff only sees tasks assigned to them or projects they belong to', async () => {
    taskRepository.list.mockResolvedValue({ data: baseTasks, error: null });
    taskRepository.getUsersByIds.mockResolvedValue({ data: baseUsers, error: null });

    const memberProjectIds = [55];
    const rbacSpy = jest.spyOn(taskService, '_getAccessibleProjectIds').mockResolvedValue([]);
    const membershipSpy = jest.spyOn(taskService, '_getProjectMemberships').mockResolvedValue(memberProjectIds);
    projectMemberRepository.getProjectIdsForUser.mockResolvedValue(memberProjectIds);

    currentUser = { id: 301, role: 'staff', hierarchy: 1, division: 'sales' };

    const res = await request(app).get('/tasks').expect(200);

    expect(res.body.map((t) => t.id)).toEqual([2]);
    expect(rbacSpy).toHaveBeenCalledWith(301, 'staff', 1, 'sales');
    expect(membershipSpy).toHaveBeenCalledWith(301);
    rbacSpy.mockRestore();
    membershipSpy.mockRestore();
  });
});
