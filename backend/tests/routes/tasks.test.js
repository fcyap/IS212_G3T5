const request = require('supertest');
const express = require('express');

jest.mock('../../src/services/taskService');
jest.mock('../../src/middleware/rbac', () => ({
  requireTaskCreation: () => (req, _res, next) => next(),
  requireTaskModification: () => (req, _res, next) => next()
}));

const taskService = require('../../src/services/taskService');
const tasksRouter = require('../../src/routes/tasks');

describe('Tasks routes', () => {
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
  });

  test('POST /tasks returns created task with 201 status', async () => {
    const mockTask = { id: 10, title: 'Demo', project_id: 3 };
    taskService.createTask.mockResolvedValue(mockTask);

    const response = await request(app)
      .post('/tasks')
      .send({ title: 'Demo', project_id: 3, assigned_to: [1] })
      .expect(201);

    expect(response.body).toEqual(mockTask);
    expect(taskService.createTask).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Demo'
    }), 1);
  });

  test('POST /tasks propagates service validation errors', async () => {
    const error = new Error('Tasks can only be assigned to active projects.');
    error.status = 400;
    taskService.createTask.mockRejectedValue(error);

    const response = await request(app)
      .post('/tasks')
      .send({ title: 'Invalid', project_id: 4, assigned_to: [1] })
      .expect(400);

    expect(response.body.error).toBe('Tasks can only be assigned to active projects.');
  });

  test('PUT /tasks/:id returns status from service errors', async () => {
    const error = new Error('Project assignment cannot be changed after creation.');
    error.status = 400;
    taskService.updateTask.mockRejectedValue(error);

    const response = await request(app)
      .put('/tasks/5')
      .send({ project_id: 99 })
      .expect(400);

    expect(response.body.message).toBe('Project assignment cannot be changed after creation.');
  });
});
