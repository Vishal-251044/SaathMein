/**
 * Health controller — GET /api/health.
 */
const { sendSuccess } = require('../utils/ApiResponse');
const { getHealthReport } = require('../services/health.service');

/**
 * Return API and dependency status. Responds 503 when the database is not connected
 * so hosts (Render/Railway) can detect an unhealthy instance.
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @returns {import('express').Response} Health report
 */
const getHealth = (req, res) => {
  const { isHealthy, ...report } = getHealthReport();

  if (!isHealthy) {
    return res.status(503).json({
      success: false,
      message: 'Service degraded',
      error: { code: 'SERVICE_UNAVAILABLE', details: report },
    });
  }

  return sendSuccess(res, { message: 'Service healthy', data: report });
};

module.exports = { getHealth };
