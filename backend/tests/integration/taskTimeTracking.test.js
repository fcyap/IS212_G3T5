const request = require('supertest');
const express = require('express');

process.env.SUPABASE_URL_LT = 'http://supabase.test';
process.env.SUPABASE_SECRET_KEY_LT = 'secret-key';

jest.mock('../../src/middleware/auth', () => ({
  authMiddleware: () => (req, _res, next) => {
    req.user = { id: 1 };
    next();
  }
}));

jest.mock('../../src/repository/taskAssigneeHoursRepository', () => ({
  findByTask: jest.fn(),
  upsert: jest.fn()
}));

const supabaseMocks = {};

jest.mock('@supabase/supabase-js', () => {
  const buildQuery = (singleHandler) => {
    const state = {};
    const query = {
      eq: jest.fn((column, value) => {
        state[column] = value;
        return query;
      }),
      single: jest.fn(() => singleHandler(state))
    };
    return query;
  };

  supabaseMocks.projectSingle = jest.fn();
  supabaseMocks.taskSingle = jest.fn();
  supabaseMocks.from = jest.fn((table) => {
    if (table === 'projects') {
      return {
        select: jest.fn(() => buildQuery((state) => supabaseMocks.projectSingle(state)))
      };
    }

    if (table === 'tasks') {
      return {
        select: jest.fn(() => buildQuery((state) => supabaseMocks.taskSingle(state)))
      };
    }

    return {
      select: jest.fn(() => buildQuery(() => Promise.resolve({ data: null, error: null })))
    };
  });

  return {
    createClient: jest.fn(() => ({ from: supabaseMocks.from })),
    __mock: supabaseMocks
  };
});

const { __mock: supabaseMock } = require('@supabase/supabase-js');
const taskAssigneeHoursRepository = require('../../src/repository/taskAssigneeHoursRepository');
const projectTasksRoutes = require('../../src/routes/projectTasks');

describe('Project task time tracking (integration)', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    supabaseMock.projectSingle.mockImplementation(({ id }) =>
      Promise.resolve({ data: { id }, error: null })
    );

    supabaseMock.taskSingle.mockImplementation(({ id, project_id }) =>
      Promise.resolve({
        data: {
          id: Number(id),
          project_id: Number(project_id),
          title: 'Tracked task',
          assigned_to: [1, 2]
        },
        error: null
      })
    );

    taskAssigneeHoursRepository.findByTask.mockResolvedValue([
      { user_id: 1, hours: 2.5 },
      { user_id: 2, hours: 3 }
    ]);

    app = express();
    app.use(express.json());
    app.use('/projects', projectTasksRoutes);
  });

  test('returns aggregated hours for all assignees', async () => {
    const res = await request(app)
      .get('/projects/5/tasks/42')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.task.time_tracking).toEqual({
      total_hours: 5.5,
      per_assignee: [
        { user_id: 1, hours: 2.5 },
        { user_id: 2, hours: 3 }
      ]
    });

    expect(taskAssigneeHoursRepository.findByTask).toHaveBeenCalledWith(42);
    expect(supabaseMock.taskSingle).toHaveBeenCalledWith({ id: 42, project_id: 5 });
  });

  test('includes zero-hour entries for assigned members without records', async () => {
    taskAssigneeHoursRepository.findByTask.mockResolvedValue([{ user_id: 1, hours: 1.25 }]);

    const res = await request(app)
      .get('/projects/5/tasks/42')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.task.time_tracking).toEqual({
      total_hours: 1.25,
      per_assignee: [
        { user_id: 1, hours: 1.25 },
        { user_id: 2, hours: 0 }
      ]
    });
  });

  test('handles missing task hours gracefully', async () => {
    taskAssigneeHoursRepository.findByTask.mockResolvedValue([]);

    const res = await request(app)
      .get('/projects/5/tasks/42')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.task.time_tracking).toEqual({
      total_hours: 0,
      per_assignee: [
        { user_id: 1, hours: 0 },
        { user_id: 2, hours: 0 }
      ]
    });
  });
});
