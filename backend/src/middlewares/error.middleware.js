/**
 * Central error handling: 404 for unknown routes, and one error handler that turns
 * every error into the standard `{ success: false, message, error }` response.
 */
const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const config = require('../config/env');
const { createLogger } = require('../utils/logger');

const log = createLogger('ErrorHandler');

/**
 * Catch requests that matched no route.
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {Function} next - Next middleware
 */
const notFound = (req, res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

/**
 * Convert known library errors (Mongoose, JSON parser) into ApiError.
 * @param {Error} err - Any thrown error
 * @returns {ApiError} Normalised error
 */
const normaliseError = (err) => {
  if (err instanceof ApiError) return err;

  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return new ApiError(422, 'Some fields are invalid', { details });
  }
  if (err instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid value for ${err.path}`, { code: 'INVALID_ID' });
  }
  if (err?.code === 11000) {
    const fields = Object.keys(err.keyValue || {});
    return ApiError.conflict(`Duplicate value for ${fields.join(', ') || 'a unique field'}`, {
      code: 'DUPLICATE',
    });
  }
  if (err?.type === 'entity.parse.failed') {
    return ApiError.badRequest('Request body is not valid JSON', { code: 'INVALID_JSON' });
  }
  if (err?.type === 'entity.too.large') {
    return new ApiError(413, 'Request body is too large', { code: 'PAYLOAD_TOO_LARGE' });
  }

  // Unknown error: hide internal details from the client
  const unknown = new ApiError(500, 'Something went wrong. Please try again.');
  unknown.isOperational = false;
  unknown.cause = err;
  return unknown;
};

/**
 * Express error handler (must keep 4 arguments).
 * @param {Error} err - Thrown error
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {Function} _next - Unused, required by Express signature
 */
const errorHandler = (err, req, res, _next) => {
  const apiError = normaliseError(err);
  const context = { reqId: req.id, method: req.method, url: req.originalUrl };

  if (apiError.statusCode >= 500) {
    log.error({ ...context, err: apiError.cause || err }, 'Unhandled error');
  } else {
    log.warn({ ...context, code: apiError.code }, apiError.message);
  }

  const body = {
    success: false,
    message: apiError.message,
    error: { code: apiError.code },
  };
  if (apiError.details) body.error.details = apiError.details;
  // Stack traces help debugging locally but must never leak in production
  if (!config.isProduction && apiError.statusCode >= 500) {
    body.error.stack = (apiError.cause || err)?.stack;
  }

  res.status(apiError.statusCode).json(body);
};

module.exports = { notFound, errorHandler };
