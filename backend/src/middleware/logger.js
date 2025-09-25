const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

let chalk;
let isInitialized = false;

const isDev = process.env.NODE_ENV !== 'production';

// Create logs directory if it doesn't exist (for production)
if (!isDev) {
  try {
    if (!fs.existsSync('./logs')) {
      fs.mkdirSync('./logs', { recursive: true });
    }
  } catch (err) {
    console.error('Failed to create logs directory:', err);
  }
}

// Initialize chalk dynamically
async function initChalk() {
  if (!isInitialized) {
    try {
      chalk = (await import('chalk')).default;
      setupTokens();
      isInitialized = true;
    } catch (err) {
      console.error('Failed to load chalk:', err);
      // Fallback to no colors
      chalk = {
        hex: () => (str) => str,
        bold: (str) => str,
        cyan: (str) => str,
        yellow: (str) => str,
        dim: (str) => str,
        gray: (str) => str,
        blue: (str) => str,
        red: {
          bold: (str) => str
        },
        red: (str) => str
      };
      setupTokens();
      isInitialized = true;
    }
  }
}

// Setup morgan tokens after chalk is loaded
function setupTokens() {
  // Enhanced status token with colors
  morgan.token('status', function (req, res) {
      var status = res.statusCode;
      var color = status >= 500 ? '#ff0e00' // red
          : status >= 400 ? '#ffdd00' // yellow
              : status >= 300 ? '#00a6ff' // cyan
                  : status >= 200 ? '#11ff00' // green
                      : '#ffffff' // no color
      return chalk.hex(color).bold(res.statusCode);
  });

  // Colored method token
  morgan.token('method', function (req, res) {
      const method = req.method;
      const color = method === 'GET' ? '#00ff00' // green
          : method === 'POST' ? '#0099ff' // blue
              : method === 'PUT' ? '#ff9900' // orange
                  : method === 'DELETE' ? '#ff0000' // red
                      : method === 'PATCH' ? '#9900ff' // purple
                          : '#ffffff'; // white for others
      return chalk.hex(color).bold(method);
  });

  // Colored URL token with truncation for long URLs
  morgan.token('url', function (req, res) {
      let url = req.originalUrl || req.url;
      if (url.length > 50) {
          url = url.substring(0, 47) + '...';
      }
      return chalk.cyan(url);
  });

  // Enhanced response time with color coding
  morgan.token('response-time', function (req, res) {
      if (!req._startAt || !res._startAt) {
          return;
      }
      var ms = (res._startAt[0] - req._startAt[0]) * 1e3 +
          (res._startAt[1] - req._startAt[1]) * 1e-6;
      var color = ms >= 1000 ? '#ff0000' // red for slow
          : ms >= 500 ? '#ff9900' // orange for medium
              : ms >= 100 ? '#ffdd00' // yellow for fast
                  : '#00ff00'; // green for very fast
      return chalk.hex(color)(ms.toFixed(3));
  });

  // Response size with formatting
  morgan.token('res-size', function (req, res) {
      const size = res.getHeader('content-length');
      if (!size) return chalk.dim('-');
      const bytes = parseInt(size);
      const formatted = bytes >= 1024 ? (bytes / 1024).toFixed(1) + 'kb' : bytes + 'b';
      return chalk.yellow(formatted);
  });

  // User agent (shortened)
  morgan.token('user-agent', function (req, res) {
      const ua = req.headers['user-agent'];
      if (!ua) return chalk.dim('-');
      // Extract browser name
      const browser = ua.includes('Chrome') ? 'Chrome'
          : ua.includes('Firefox') ? 'Firefox'
              : ua.includes('Safari') ? 'Safari'
                  : ua.includes('Edge') ? 'Edge'
                      : ua.includes('curl') ? 'curl'
                          : 'Other';
      return chalk.gray(browser);
  });

  // Remote IP with proxy support (Cloudflare, etc.)
  morgan.token('remote-addr', function (req, res) {
      // Check proxy headers first (most reliable for real client IP)
      const cfConnectingIp = req.headers['cf-connecting-ip']; // Cloudflare
      const xForwardedFor = req.headers['x-forwarded-for']; // Standard proxy header
      const xRealIp = req.headers['x-real-ip']; // Nginx proxy
      const xClientIp = req.headers['x-client-ip']; // Apache proxy

      let ip;

      if (cfConnectingIp) {
          ip = cfConnectingIp;
      } else if (xForwardedFor) {
          // X-Forwarded-For can be a comma-separated list, take the first one
          ip = xForwardedFor.split(',')[0].trim();
      } else if (xRealIp) {
          ip = xRealIp;
      } else if (xClientIp) {
          ip = xClientIp;
      } else {
          // Fallback to direct connection IP
          ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress ||
              (req.connection.socket ? req.connection.socket.remoteAddress : null);
      }

      // Clean up IPv6-mapped IPv4 addresses
      if (ip && ip.startsWith('::ffff:')) {
          ip = ip.substring(7);
      }

      return ip ? chalk.blue(ip) : chalk.dim('-');
  });

  // Enhanced date token with color
  morgan.token('date', function (req, res) {
      return chalk.dim(getDateTimeMe());
  });
}

function getDateTimeMe() {
    var date = new Date();
    var weekDay = date.toLocaleString('default', {weekday: 'short'});
    var month = date.toLocaleString('default', {month: 'short'});
    var day = date.toLocaleString('default', {day: 'numeric'});
    var year = date.toLocaleString('default', {year: 'numeric'});
    var time = date.toLocaleTimeString('default', {hour12: false});

    return weekDay + " "
        + month + " "
        + day + " "
        + year + " "
        + time;
}

const devFormat = ':date :status :method :url :response-time ms :res-size [:remote-addr] :user-agent';
const prodFormat = ':date :status :method :url :response-time ms :res-size [:remote-addr] :user-agent';

const logFormat = isDev ? devFormat : prodFormat;

// Create file logging streams for production
let accessLogStream;
if (!isDev) {
  try {
    accessLogStream = fs.createWriteStream(path.join('./logs', 'access.log'), { flags: 'a' });
  } catch (err) {
    console.error('Failed to create access log stream:', err);
  }
}

// Request entry logger (logs immediately when request arrives)
function logRequestEntry(req, res, next) {
  // Only log entry if LOG_REQUEST_ENTRY env var is set to 'true'
  const shouldLogEntry = process.env.LOG_REQUEST_ENTRY === 'true';

  if (shouldLogEntry) {
    const method = req.method;
    const url = req.originalUrl || req.url;
    const ip = req.ip || req.connection.remoteAddress || '-';
    const timestamp = getDateTimeMe();

    // Color code method
    const coloredMethod = method === 'GET' ? chalk.hex('#00ff00').bold(method)
      : method === 'POST' ? chalk.hex('#0099ff').bold(method)
      : method === 'PUT' ? chalk.hex('#ff9900').bold(method)
      : method === 'DELETE' ? chalk.hex('#ff0000').bold(method)
      : method === 'PATCH' ? chalk.hex('#9900ff').bold(method)
      : chalk.hex('#ffffff').bold(method);

    console.log(
      chalk.dim(timestamp),
      chalk.yellow.bold('[ENTRY]'),
      coloredMethod,
      chalk.cyan(url),
      chalk.blue(`[${ip}]`)
    );
  }

  next();
}

// Create and configure the morgan middleware
async function createLoggerMiddleware() {
  await initChalk();

  const morganOptions = {
    skip: function (req, res) {
      // Skip logging for health checks in production
      if (!isDev && req.url === '/health') return true;
      return false;
    }
  };

  // Return array of middlewares: entry logger first, then morgan
  const loggerMiddlewares = [];

  // Add entry logger if enabled
  loggerMiddlewares.push(logRequestEntry);

  // Add morgan logger
  if (!isDev && accessLogStream) {
    morganOptions.stream = accessLogStream;
    // Use plain format for file logging (no colors)
    const plainFormat = ':date[iso] :status :method :url :response-time ms :res-size [:remote-addr] :user-agent';
    loggerMiddlewares.push(morgan(plainFormat, morganOptions));
  } else {
    loggerMiddlewares.push(morgan(logFormat, morganOptions));
  }

  // Return a combined middleware function
  return function combinedLogger(req, res, next) {
    let index = 0;

    function runNext() {
      if (index >= loggerMiddlewares.length) {
        return next();
      }

      const middleware = loggerMiddlewares[index++];
      middleware(req, res, runNext);
    }

    runNext();
  };
}

// Error logging function
async function logError(err, req) {
  await initChalk();
  console.log(chalk.red.bold('[ERROR]'), chalk.dim(getDateTimeMe()),
    chalk.red(err.message),
    chalk.dim(`${req.method} ${req.url}`));
}

module.exports = {
  createLoggerMiddleware,
  logError
};