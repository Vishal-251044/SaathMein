/**
 * HTTP request logging with a request id on every request.
 * The id is returned in the `X-Request-Id` header so a user's error report can be
 * matched to the exact log lines.
 */
const crypto = require('crypto');
const pinoHttp = require('pino-http');
const { logger } = require('../utils/logger');

const requestLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const incoming = req.headers['x-request-id'];
    const id =
      typeof incoming === 'string' && incoming.length <= 64 ? incoming : crypto.randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  // Health checks run every few seconds on the host — keep them out of the logs
  autoLogging: { ignore: (req) => req.url === '/api/health' },
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});

module.exports = requestLogger;
