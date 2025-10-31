const request = require('supertest');
const express = require('express');

jest.mock('../../src/repository/taskRepository');
jest.mock('../../src/repository/projectRepository');
jest.mock('../../src/repository/userRepository');
jest.mock('../../src/services/notificationService');
jest.mock('../../src/middleware/rbac', () => ({
  requireTaskCreation: () => (req, _res, next) => next(),
  requireTaskModification: () => (req, _res, next) => next()
}));
jest.mock('../../src/middleware/auth', () => ({
  authMiddleware: () => (req, _res, next) => {
    req.user = req.user || { id: 1, role: 'staff' };
    next();
  },
}));

const taskRepository = require('../../src/repository/taskRepository');
const projectRepository = require('../../src/repository/projectRepository');
const notificationService = require('../../src/services/notificationService');

const tasksRouter = require('../../src/routes/tasks');

describe('Tasks routes - project assignment integration', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = { id: 1, role: 'staff' };
      next();
    });
    app.use('/tasks', tasksRouter);

    projectRepository.getProjectById.mockReset();
    projectRepository.getProjectById.mockImplementation(async (id) => ({ id, status: 'active' }));
    if (taskRepository.insert?.mockReset) taskRepository.insert.mockReset();
    if (taskRepository.getTaskById?.mockReset) taskRepository.getTaskById.mockReset();
    if (taskRepository.updateById?.mockReset) taskRepository.updateById.mockReset();

    notificationService.createTaskAssignmentNotifications.mockResolvedValue({ notificationsSent: 0 });
    notificationService.createTaskRemovalNotifications = jest.fn().mockResolvedValue({ notificationsSent: 0 });
    notificationService.createTaskUpdateNotifications = jest.fn().mockResolvedValue({ notificationsSent: 0 });
  });

  test('POST /tasks rejects inactive project assignments', async () => {
    projectRepository.getProjectById.mockResolvedValueOnce({ id: 5, status: 'archived' });

    const response = await request(app)
      .post('/tasks')
      .send({
        title: 'Inactive project task',
        project_id: 5,
        assigned_to: [1]
      })
      .expect(400);

    expect(response.body.error).toBe('Tasks can only be assigned to active projects.');
    expect(taskRepository.insert).not.toHaveBeenCalled();
  });

  test('POST /tasks inherits project from parent task for subtasks', async () => {
    taskRepository.getTaskById.mockResolvedValueOnce({
      id: 7,
      project_id: 12
    });
    projectRepository.getProjectById.mockResolvedValueOnce({ id: 12, status: 'active' });
    taskRepository.insert.mockImplementation(async (payload) => ({
      id: 88,
      ...payload
    }));

    const response = await request(app)
      .post('/tasks')
      .send({
        title: 'Child task',
        parent_id: 7,
        project_id: 999,
        assigned_to: [1]
      })
      .expect(201);

    expect(taskRepository.getTaskById).toHaveBeenCalledWith(7);
    expect(projectRepository.getProjectById).toHaveBeenCalledWith(12);
    expect(taskRepository.insert).toHaveBeenCalledWith(expect.objectContaining({
      project_id: 12,
      parent_id: 7
    }));
    expect(response.body.project_id).toBe(12);
    expect(response.body.parent_id).toBe(7);
  });

});
