/**
 * Central pino logger. Use this everywhere instead of console.log.
 * Pretty output in development, JSON in production (for Render/Railway log search).
 * Sensitive fields are redacted so OTPs, tokens and secrets never reach the logs.
 */
const pino = require('pino');
const config = require('../config/env');

const logger = pino({
  level: config.isTest ? 'silent' : config.logLevel,
  base: { service: 'saathmein-api' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-razorpay-signature"]',
      '*.password',
      '*.passwordHash',
      '*.otp',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
      '*.twoFactorSecret',
    ],
    censor: '[REDACTED]',
  },
  transport: config.isProduction
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } },
});

/**
 * Create a child logger tagged with a module name, e.g. `[PaymentService]`.
 * @param {string} moduleName - Name shown in every log line from that module
 * @returns {import('pino').Logger} Child logger
 */
const createLogger = (moduleName) => logger.child({ module: moduleName });

module.exports = { logger, createLogger };
