/**
 * Express application setup: security middleware, body parsing, logging,
 * rate limiting, routes and the central error handler.
 * Kept separate from server.js so tests can import the app without starting a server.
 */
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config/env');
const ApiError = require('./utils/ApiError');
const requestLogger = require('./middlewares/requestLogger.middleware');
const { apiLimiter } = require('./middlewares/rateLimit.middleware');
const { notFound, errorHandler } = require('./middlewares/error.middleware');
const apiRoutes = require('./routes');

const app = express();

// Behind Render/Railway's proxy: trust the first hop so req.ip and rate limits use the real IP
if (config.isProduction) app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(requestLogger);
app.use(helmet());

/**
 * CORS whitelist. Requests without an Origin header (the Android app, server-to-server,
 * curl) are allowed; browser requests must come from CORS_ORIGINS.
 */
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
      return callback(ApiError.forbidden(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
  }),
);

// Small JSON limit by default. (The Razorpay webhook route will need the raw body — Day 7.)
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

app.use('/api', apiLimiter, apiRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
