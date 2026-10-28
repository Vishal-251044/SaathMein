/**
 * API router — mounts every feature router under /api.
 * Add new feature routers here as they are built (users on Day 3, catalog on Day 4, ...).
 */
const { Router } = require('express');
const { requireDatabase } = require('../middlewares/database.middleware');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const adminRoutes = require('./admin');

const router = Router();

// Health must work even when the database is down
router.use('/health', healthRoutes);

// Feature routers need MongoDB (unknown paths still fall through to the 404 handler)
router.use('/auth', requireDatabase, authRoutes);
router.use('/admin', requireDatabase, adminRoutes);

module.exports = router;
