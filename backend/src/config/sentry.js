/**
 * Sentry error monitoring for the API and the worker (Day 14). Loaded first by server.js
 * and worker.js. Off when SENTRY_DSN is empty or a placeholder (development, tests).
 *
 * Privacy: no default PII; auth headers, cookies, request bodies and query strings are
 * stripped before sending, so tokens, OTPs, phone numbers and payment ids never leave.
 */
const Sentry = require('@sentry/node');
const config = require('./env');

const enabled = config.sentry.isConfigured && !config.isTest;

if (enabled) {
  Sentry.init({
    dsn: config.sentry.dsn,
    environment: config.env,
    release: config.sentry.release,
    sendDefaultPii: false,
    tracesSampleRate: config.sentry.tracesSampleRate,
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
        delete event.request.query_string;
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
          delete event.request.headers['x-razorpay-signature'];
        }
      }
      delete event.user;
      return event;
    },
  });
}

/**
 * Report an unexpected error (5xx, failed job). No-op when Sentry is off.
 * @param {unknown} error
 * @param {Record<string, unknown>} [context] - Extra tags (never secrets or personal data)
 */
const captureError = (error, context = {}) => {
  if (!enabled) return;
  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([key, value]) => {
      if (value != null) scope.setTag(key, String(value));
    });
    Sentry.captureException(error);
  });
};

/**
 * Send pending events before the process exits.
 * @returns {Promise<void>}
 */
const flushSentry = async () => {
  if (enabled) await Sentry.flush(2000);
};

module.exports = { captureError, flushSentry, isSentryEnabled: enabled };
