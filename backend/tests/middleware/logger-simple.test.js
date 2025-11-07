// Simple logger tests focused on core functionality
const path = require('path');

// Set NODE_ENV before requiring the module
process.env.NODE_ENV = 'test';

describe('Logger Middleware - Integration', () => {
  let loggerModule;

  beforeAll(() => {
    // Require after setting NODE_ENV
    loggerModule = require('../../src/middleware/logger');
  });

  describe('createLoggerMiddleware', () => {
    it('should create middleware function', async () => {
      const middleware = await loggerModule.createLoggerMiddleware();

      expect(middleware).toBeInstanceOf(Function);
    });

    it('should execute middleware without errors', async () => {
      const middleware = await loggerModule.createLoggerMiddleware();

      const req = {
        method: 'GET',
        url: '/test',
        originalUrl: '/test',
        ip: '127.0.0.1',
        connection: {},
        socket: {},
        headers: {}
      };

      const res = {
        statusCode: 200,
        getHeader: jest.fn()
      };

      const next = jest.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('logError', () => {
    it('should log error without throwing', async () => {
      const error = new Error('Test error');
      const req = {
        method: 'GET',
        url: '/test'
      };

      await expect(loggerModule.logError(error, req)).resolves.not.toThrow();
    });
  });
});
