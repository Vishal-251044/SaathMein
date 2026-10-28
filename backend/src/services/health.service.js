/**
 * Health service — reports the status of the API and its dependencies.
 * Used by GET /api/health (host health checks and the admin System health monitor).
 */
const config = require('../config/env');
const { getDBStatus } = require('../config/db');
const { getRedisStatus } = require('../config/redis');
const { version } = require('../../package.json');

/**
 * Build the current health report.
 * The API is "ok" only when MongoDB is connected; Redis is optional until Day 6.
 * @returns {{ status: 'ok'|'degraded', isHealthy: boolean, version: string, env: string,
 *   uptimeSeconds: number, timestamp: string, services: { database: string, redis: string } }}
 */
const getHealthReport = () => {
  const database = getDBStatus();
  const redis = getRedisStatus();
  const isHealthy = database === 'connected';

  return {
    status: isHealthy ? 'ok' : 'degraded',
    isHealthy,
    version,
    env: config.env,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    services: { database, redis },
  };
};

module.exports = { getHealthReport };
