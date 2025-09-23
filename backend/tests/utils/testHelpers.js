const mockSupabaseClient = {
  from: jest.fn(() => ({
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    order: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    contains: jest.fn().mockReturnThis(),
    filter: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis()
  }))
};

const createMockRequest = (overrides = {}) => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  ...overrides
});

const createMockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.set = jest.fn().mockReturnValue(res);
  return res;
};

const createMockNext = () => jest.fn();

const mockProject = {
  id: 1,
  name: 'Test Project',
  description: 'Test Description',
  user_ids: [1, 2, 3],
  created_at: '2023-01-01T00:00:00.000Z',
  updated_at: '2023-01-01T00:00:00.000Z'
};

const mockTask = {
  id: 1,
  project_id: 1,
  name: 'Test Task',
  description: 'Test Task Description',
  status: 'active',
  priority: 'medium',
  assigned_to: 1,
  due_date: '2023-12-31T23:59:59.000Z',
  created_at: '2023-01-01T00:00:00.000Z',
  updated_at: '2023-01-01T00:00:00.000Z'
};

const mockUser = {
  id: 1,
  email: 'test@example.com',
  name: 'Test User',
  created_at: '2023-01-01T00:00:00.000Z'
};

const mockServiceSuccess = (data, message = 'Operation successful') => ({
  success: true,
  data,
  message
});

const mockServiceError = (error, message = 'Operation failed') => ({
  success: false,
  error,
  message
});

const mockDatabaseError = (message = 'Database error') => ({
  data: null,
  error: { message }
});

const mockDatabaseSuccess = (data) => ({
  data,
  error: null
});

const mockProjectNotFound = () => ({
  data: null,
  error: { code: 'PGRST116' }
});

const resetAllMocks = () => {
  jest.clearAllMocks();

  // Reset the supabase mock to default state
  mockSupabaseClient.from.mockReturnValue({
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    order: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    contains: jest.fn().mockReturnThis(),
    filter: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis()
  });
};

const expectControllerError = (res, statusCode, error, message) => {
  expect(res.status).toHaveBeenCalledWith(statusCode);
  expect(res.json).toHaveBeenCalledWith({
    success: false,
    error,
    message
  });
};

const expectControllerSuccess = (res, statusCode, data) => {
  expect(res.status).toHaveBeenCalledWith(statusCode);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    success: true,
    ...data
  }));
};

const generateRandomId = () => Math.floor(Math.random() * 1000000);

const generateRandomString = (length = 10) => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const generateMockProject = (overrides = {}) => ({
  ...mockProject,
  id: generateRandomId(),
  name: `Project ${generateRandomString(5)}`,
  ...overrides
});

const generateMockTask = (overrides = {}) => ({
  ...mockTask,
  id: generateRandomId(),
  name: `Task ${generateRandomString(5)}`,
  ...overrides
});

const generateMockUser = (overrides = {}) => ({
  ...mockUser,
  id: generateRandomId(),
  email: `${generateRandomString(8)}@example.com`,
  ...overrides
});

const waitFor = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const mockConsoleError = () => {
  const originalError = console.error;
  const mockError = jest.fn();
  console.error = mockError;

  return {
    restore: () => {
      console.error = originalError;
    },
    mock: mockError
  };
};

const createTestSuite = (name, tests) => {
  describe(name, () => {
    beforeEach(() => {
      resetAllMocks();
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    tests();
  });
};

module.exports = {
  mockSupabaseClient,
  createMockRequest,
  createMockResponse,
  createMockNext,
  mockProject,
  mockTask,
  mockUser,
  mockServiceSuccess,
  mockServiceError,
  mockDatabaseError,
  mockDatabaseSuccess,
  mockProjectNotFound,
  resetAllMocks,
  expectControllerError,
  expectControllerSuccess,
  generateRandomId,
  generateRandomString,
  generateMockProject,
  generateMockTask,
  generateMockUser,
  waitFor,
  mockConsoleError,
  createTestSuite
};