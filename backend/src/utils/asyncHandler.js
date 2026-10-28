/**
 * Wrap an async controller so any rejected promise goes to the error middleware.
 * Express 5 already forwards rejected promises, but we keep this wrapper so every
 * controller follows one explicit pattern.
 */

/**
 * @param {Function} handler - Async (req, res, next) controller
 * @returns {Function} Express middleware that forwards errors to next()
 */
const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

module.exports = asyncHandler;
