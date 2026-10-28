/**
 * API router — mounts every feature router under /api.
 * Add new feature routers here as they are built (auth on Day 2, users on Day 3, ...).
 */
const { Router } = require('express');
const healthRoutes = require('./health.routes');

const router = Router();

router.use('/health', healthRoutes);

module.exports = router;
