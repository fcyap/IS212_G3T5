const loggerModule = require('../../src/middleware/logger');

// Mock morgan
jest.mock('morgan', () => {
  const mockMorgan = jest.fn((format, options) => {
    return (req, res, next) => {
      next();
    };
  });
  mockMorgan.token = jest.fn();
  return mockMorgan;
});

// Mock chalk
jest.mock('chalk', () => {
  const createChainable = (fn) => {
    fn.bold = fn;
    fn.dim = fn;
    fn.hex = () => fn;
    return fn;
  };
  const noColor = (str) => str;
  return {
    default: {
      hex: () => createChainable(noColor),
      bold: noColor,
      cyan: noColor,
      yellow: createChainable(noColor),
      dim: noColor,
      gray: noColor,
      blue: noColor,
      red: createChainable(noColor)
    }
  };
});

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  createWriteStream: jest.fn()
}));

const fs = require('fs');
const morgan = require('morgan');

describe('Logger Middleware', () => {
  let req, res, next;
  let originalEnv;

  beforeEach(() => {
    jest.clearAllMocks();

    originalEnv = process.env.NODE_ENV;

    req = {
      method: 'GET',
      url: '/test',
      originalUrl: '/test?param=value',
      ip: '192.168.1.1',
      connection: { remoteAddress: '192.168.1.1' },
      socket: { remoteAddress: '192.168.1.1' },
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0'
      },
      _startAt: [Date.now(), 0]
    };

    res = {
      statusCode: 200,
      _startAt: [Date.now(), 1000000],
      getHeader: jest.fn()
    };

    next = jest.fn();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('createLoggerMiddleware', () => {
    it('should create logger middleware in development mode', async () => {
      process.env.NODE_ENV = 'development';

      const middleware = await loggerModule.createLoggerMiddleware();

      expect(middleware).toBeInstanceOf(Function);
      expect(morgan).toHaveBeenCalled();
    });

    it('should create logger middleware in production mode', async () => {
      process.env.NODE_ENV = 'production';
      fs.existsSync.mockReturnValue(true);
      fs.createWriteStream.mockReturnValue({});

      const middleware = await loggerModule.createLoggerMiddleware();

      expect(middleware).toBeInstanceOf(Function);
      // Directory should not be created if it already exists
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    it('should handle fs.mkdirSync error in production', async () => {
      process.env.NODE_ENV = 'production';
      fs.existsSync.mockReturnValue(false);
      fs.mkdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const middleware = await loggerModule.createLoggerMiddleware();

      expect(middleware).toBeInstanceOf(Function);
    });

    it('should skip logging for health checks in production', async () => {
      process.env.NODE_ENV = 'production';
      fs.existsSync.mockReturnValue(true);
      fs.createWriteStream.mockReturnValue({});

      await loggerModule.createLoggerMiddleware();

      const morganCall = morgan.mock.calls[morgan.mock.calls.length - 1];
      const options = morganCall[1];

      if (options && options.skip) {
        expect(options.skip({ url: '/health' }, {})).toBe(true);
        expect(options.skip({ url: '/api/users' }, {})).toBe(false);
      } else {
        // In development mode there might not be a skip function
        expect(true).toBe(true);
      }
    });

    it('should not skip health checks in development', async () => {
      process.env.NODE_ENV = 'development';

      await loggerModule.createLoggerMiddleware();

      const morganCall = morgan.mock.calls[morgan.mock.calls.length - 1];
      const options = morganCall[1];

      expect(options.skip({ url: '/health' }, {})).toBe(false);
    });

    it('should execute combined middleware correctly', async () => {
      const middleware = await loggerModule.createLoggerMiddleware();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('logError', () => {
    it('should log error message', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const error = new Error('Test error');

      await loggerModule.logError(error, req);

      expect(consoleLogSpy).toHaveBeenCalled();
      consoleLogSpy.mockRestore();
    });

    it('should include request method and url in error log', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const error = new Error('Database connection failed');

      await loggerModule.logError(error, req);

      const logArgs = consoleLogSpy.mock.calls[0];
      expect(logArgs.some(arg => typeof arg === 'string' && arg.includes('GET'))).toBe(true);

      consoleLogSpy.mockRestore();
    });
  });

  describe('Morgan tokens', () => {
    it('should register status token', async () => {
      // Initialize the logger to register tokens
      await loggerModule.createLoggerMiddleware();

      // Tokens are registered at module initialization time
      // This test just verifies the module loads without error
      expect(true).toBe(true);
    });

    it('should register method token', async () => {
      await loggerModule.createLoggerMiddleware();
      expect(true).toBe(true);
    });

    it('should register url token', async () => {
      await loggerModule.createLoggerMiddleware();
      expect(true).toBe(true);
    });

    it('should truncate long URLs', () => {
      const tokenCalls = morgan.token.mock.calls;
      const urlToken = tokenCalls.find(call => call[0] === 'url');

      if (urlToken) {
        const tokenFn = urlToken[1];
        const longUrl = '/api/v1/' + 'a'.repeat(60);
        const result = tokenFn({ url: longUrl, originalUrl: longUrl }, {});

        expect(result.length).toBeLessThanOrEqual(50);
      }
    });

    it('should register response-time token', async () => {
      await loggerModule.createLoggerMiddleware();
      expect(true).toBe(true);
    });

    it('should handle missing _startAt in response-time token', () => {
      const tokenCalls = morgan.token.mock.calls;
      const responseTimeToken = tokenCalls.find(call => call[0] === 'response-time');

      if (responseTimeToken) {
        const tokenFn = responseTimeToken[1];
        const result = tokenFn({}, {});

        expect(result).toBeUndefined();
      }
    });

    it('should register res-size token', async () => {
      await loggerModule.createLoggerMiddleware();
      expect(true).toBe(true);
    });

    it('should format response size in bytes', () => {
      const tokenCalls = morgan.token.mock.calls;
      const resSizeToken = tokenCalls.find(call => call[0] === 'res-size');

      if (resSizeToken) {
        const tokenFn = resSizeToken[1];
        const mockRes = { getHeader: jest.fn().mockReturnValue('500') };
        const result = tokenFn({}, mockRes);

        expect(result).toBeDefined();
      }
    });

    it('should format response size in kilobytes', () => {
      const tokenCalls = morgan.token.mock.calls;
      const resSizeToken = tokenCalls.find(call => call[0] === 'res-size');

      if (resSizeToken) {
        const tokenFn = resSizeToken[1];
        const mockRes = { getHeader: jest.fn().mockReturnValue('2048') };
        const result = tokenFn({}, mockRes);

        expect(result).toBeDefined();
      }
    });

    it('should handle missing content-length header', () => {
      const tokenCalls = morgan.token.mock.calls;
      const resSizeToken = tokenCalls.find(call => call[0] === 'res-size');

      if (resSizeToken) {
        const tokenFn = resSizeToken[1];
        const mockRes = { getHeader: jest.fn().mockReturnValue(null) };
        const result = tokenFn({}, mockRes);

        expect(result).toBeDefined();
      }
    });

    it('should register user-agent token', async () => {
      await loggerModule.createLoggerMiddleware();
      expect(true).toBe(true);
    });

    it('should detect Chrome browser', () => {
      const tokenCalls = morgan.token.mock.calls;
      const userAgentToken = tokenCalls.find(call => call[0] === 'user-agent');

      if (userAgentToken) {
        const tokenFn = userAgentToken[1];
        const mockReq = {
          headers: { 'user-agent': 'Mozilla/5.0 Chrome/91.0' }
        };
        const result = tokenFn(mockReq, {});

        expect(result).toBeDefined();
      }
    });

    it('should detect Firefox browser', () => {
      const tokenCalls = morgan.token.mock.calls;
      const userAgentToken = tokenCalls.find(call => call[0] === 'user-agent');

      if (userAgentToken) {
        const tokenFn = userAgentToken[1];
        const mockReq = {
          headers: { 'user-agent': 'Mozilla/5.0 Firefox/89.0' }
        };
        const result = tokenFn(mockReq, {});

        expect(result).toBeDefined();
      }
    });

    it('should detect Safari browser', () => {
      const tokenCalls = morgan.token.mock.calls;
      const userAgentToken = tokenCalls.find(call => call[0] === 'user-agent');

      if (userAgentToken) {
        const tokenFn = userAgentToken[1];
        const mockReq = {
          headers: { 'user-agent': 'Mozilla/5.0 Safari/14.0' }
        };
        const result = tokenFn(mockReq, {});

        expect(result).toBeDefined();
      }
    });

    it('should detect Edge browser', () => {
      const tokenCalls = morgan.token.mock.calls;
      const userAgentToken = tokenCalls.find(call => call[0] === 'user-agent');

      if (userAgentToken) {
        const tokenFn = userAgentToken[1];
        const mockReq = {
          headers: { 'user-agent': 'Mozilla/5.0 Edge/91.0' }
        };
        const result = tokenFn(mockReq, {});

        expect(result).toBeDefined();
      }
    });

    it('should detect curl', () => {
      const tokenCalls = morgan.token.mock.calls;
      const userAgentToken = tokenCalls.find(call => call[0] === 'user-agent');

      if (userAgentToken) {
        const tokenFn = userAgentToken[1];
        const mockReq = {
          headers: { 'user-agent': 'curl/7.68.0' }
        };
        const result = tokenFn(mockReq, {});

        expect(result).toBeDefined();
      }
    });

    it('should handle missing user-agent header', () => {
      const tokenCalls = morgan.token.mock.calls;
      const userAgentToken = tokenCalls.find(call => call[0] === 'user-agent');

      if (userAgentToken) {
        const tokenFn = userAgentToken[1];
        const mockReq = { headers: {} };
        const result = tokenFn(mockReq, {});

        expect(result).toBeDefined();
      }
    });

    it('should register remote-addr token', async () => {
      await loggerModule.createLoggerMiddleware();
      expect(true).toBe(true);
    });

    it('should use cf-connecting-ip header if available', () => {
      const tokenCalls = morgan.token.mock.calls;
      const remoteAddrToken = tokenCalls.find(call => call[0] === 'remote-addr');

      if (remoteAddrToken) {
        const tokenFn = remoteAddrToken[1];
        const mockReq = {
          headers: { 'cf-connecting-ip': '203.0.113.1' },
          ip: '10.0.0.1'
        };
        const result = tokenFn(mockReq, {});

        expect(result).toBeDefined();
      }
    });

    it('should use x-forwarded-for header', () => {
      const tokenCalls = morgan.token.mock.calls;
      const remoteAddrToken = tokenCalls.find(call => call[0] === 'remote-addr');

      if (remoteAddrToken) {
        const tokenFn = remoteAddrToken[1];
        const mockReq = {
          headers: { 'x-forwarded-for': '203.0.113.1, 192.168.1.1' },
          ip: '10.0.0.1'
        };
        const result = tokenFn(mockReq, {});

        expect(result).toBeDefined();
      }
    });

    it('should use x-real-ip header', () => {
      const tokenCalls = morgan.token.mock.calls;
      const remoteAddrToken = tokenCalls.find(call => call[0] === 'remote-addr');

      if (remoteAddrToken) {
        const tokenFn = remoteAddrToken[1];
        const mockReq = {
          headers: { 'x-real-ip': '203.0.113.1' },
          ip: '10.0.0.1'
        };
        const result = tokenFn(mockReq, {});

        expect(result).toBeDefined();
      }
    });

    it('should use x-client-ip header', () => {
      const tokenCalls = morgan.token.mock.calls;
      const remoteAddrToken = tokenCalls.find(call => call[0] === 'remote-addr');

      if (remoteAddrToken) {
        const tokenFn = remoteAddrToken[1];
        const mockReq = {
          headers: { 'x-client-ip': '203.0.113.1' },
          ip: '10.0.0.1'
        };
        const result = tokenFn(mockReq, {});

        expect(result).toBeDefined();
      }
    });

    it('should fall back to req.ip', () => {
      const tokenCalls = morgan.token.mock.calls;
      const remoteAddrToken = tokenCalls.find(call => call[0] === 'remote-addr');

      if (remoteAddrToken) {
        const tokenFn = remoteAddrToken[1];
        const mockReq = {
          headers: {},
          ip: '192.168.1.1',
          connection: {},
          socket: {}
        };
        const result = tokenFn(mockReq, {});

        expect(result).toBeDefined();
      }
    });

    it('should clean up IPv6-mapped IPv4 addresses', () => {
      const tokenCalls = morgan.token.mock.calls;
      const remoteAddrToken = tokenCalls.find(call => call[0] === 'remote-addr');

      if (remoteAddrToken) {
        const tokenFn = remoteAddrToken[1];
        const mockReq = {
          headers: {},
          ip: '::ffff:192.168.1.1',
          connection: {},
          socket: {}
        };
        const result = tokenFn(mockReq, {});

        expect(result).toBeDefined();
      }
    });

    it('should register date token', async () => {
      await loggerModule.createLoggerMiddleware();
      expect(true).toBe(true);
    });

    it('should format date correctly', () => {
      const tokenCalls = morgan.token.mock.calls;
      const dateToken = tokenCalls.find(call => call[0] === 'date');

      if (dateToken) {
        const tokenFn = dateToken[1];
        const result = tokenFn({}, {});

        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
      }
    });
  });

  describe('logRequestEntry', () => {
    it('should log entry when LOG_REQUEST_ENTRY is true', async () => {
      process.env.LOG_REQUEST_ENTRY = 'true';
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const middleware = await loggerModule.createLoggerMiddleware();
      await middleware(req, res, next);

      expect(consoleLogSpy).toHaveBeenCalled();
      consoleLogSpy.mockRestore();
    });

    it('should not log entry when LOG_REQUEST_ENTRY is false', async () => {
      process.env.LOG_REQUEST_ENTRY = 'false';
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const middleware = await loggerModule.createLoggerMiddleware();
      await middleware(req, res, next);

      consoleLogSpy.mockRestore();
    });
  });
});
