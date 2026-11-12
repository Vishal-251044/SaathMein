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
const { requireDatabase } = require('./middlewares/database.middleware');
const paymentController = require('./controllers/payment.controller');
const deepLinkController = require('./controllers/deepLink.controller');

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

// Razorpay webhook: RAW body (the signature covers the exact bytes), before the JSON
// parser and outside the general rate limit (Razorpay retries from few IPs). PAY-2.
app.post(
  '/api/payments/webhook',
  express.raw({ type: 'application/json', limit: '1mb' }),
  requireDatabase,
  paymentController.webhook,
);

// Small JSON limit for everything else
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

// Share links and Android App Links verification (outside /api, public)
app.get('/.well-known/assetlinks.json', deepLinkController.assetLinks);
app.get('/g/:code', apiLimiter, deepLinkController.groupLink);
app.get('/r/:code', apiLimiter, deepLinkController.referralLink);

app.use('/api', apiLimiter, apiRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
