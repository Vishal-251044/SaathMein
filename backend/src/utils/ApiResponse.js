/**
 * Standard success response helper.
 * Every successful API response has the shape `{ success: true, message, data }`.
 */

/**
 * Send a standard success response.
 * @param {import('express').Response} res - Express response
 * @param {Object} options
 * @param {number} [options.statusCode=200] - HTTP status code
 * @param {string} options.message - Short message, e.g. "Group fetched"
 * @param {*} [options.data={}] - Response payload
 * @param {Object} [options.meta] - Optional extra info (pagination etc.)
 * @returns {import('express').Response} The sent response
 */
const sendSuccess = (res, { statusCode = 200, message, data = {}, meta }) => {
  const body = { success: true, message, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
};

module.exports = { sendSuccess };
