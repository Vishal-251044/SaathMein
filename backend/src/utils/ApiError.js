/**
 * ApiError — the only error type services should throw for expected failures.
 * The error middleware turns it into the standard
 * `{ success: false, message, error: { code, details } }` response.
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode - HTTP status code (400, 401, 403, 404, 409, 422, 429...)
   * @param {string} message - Human-readable message shown to the client
   * @param {Object} [options]
   * @param {string} [options.code] - Stable machine-readable code, e.g. `BID_TOO_HIGH`
   * @param {*} [options.details] - Extra info (validation issues etc.)
   */
  constructor(statusCode, message, { code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code || ApiError.defaultCode(statusCode);
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace?.(this, ApiError);
  }

  /**
   * Map a status code to a default error code.
   * @param {number} statusCode - HTTP status code
   * @returns {string} Default error code
   */
  static defaultCode(statusCode) {
    const codes = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'VALIDATION_ERROR',
      429: 'TOO_MANY_REQUESTS',
      503: 'SERVICE_UNAVAILABLE',
    };
    return codes[statusCode] || 'INTERNAL_ERROR';
  }

  /** @param {string} message @param {Object} [options] @returns {ApiError} 400 error */
  static badRequest(message, options) {
    return new ApiError(400, message, options);
  }

  /** @param {string} [message] @returns {ApiError} 401 error */
  static unauthorized(message = 'Please log in to continue') {
    return new ApiError(401, message);
  }

  /** @param {string} [message] @returns {ApiError} 403 error */
  static forbidden(message = 'You do not have permission to do this') {
    return new ApiError(403, message);
  }

  /** @param {string} message @returns {ApiError} 404 error */
  static notFound(message) {
    return new ApiError(404, message);
  }

  /** @param {string} message @param {Object} [options] @returns {ApiError} 409 error */
  static conflict(message, options) {
    return new ApiError(409, message, options);
  }
}

module.exports = ApiError;
