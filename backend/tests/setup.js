// Global test setup
process.env.NODE_ENV = 'test';

// Set dummy Supabase credentials for tests (allows tests to run in CI)
// These are not real credentials, just placeholders to prevent import errors
if (!process.env.SUPABASE_URL) {
  process.env.SUPABASE_URL = 'https://dummy-project.supabase.co';
}
if (!process.env.SUPABASE_KEY) {
  process.env.SUPABASE_KEY = 'dummy-anon-key-for-testing';
}

// Mock console methods if needed
// global.console = {
//   log: jest.fn(),
//   error: jest.fn(),
//   warn: jest.fn(),
// };