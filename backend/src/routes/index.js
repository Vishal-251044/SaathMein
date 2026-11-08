/**
 * API router — mounts every feature router under /api.
 * Add new feature routers here as they are built.
 */
const { Router } = require('express');
const { requireDatabase } = require('../middlewares/database.middleware');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const catalogRoutes = require('./catalog.routes');
const sellerRoutes = require('./seller.routes');
const marketplaceRoutes = require('./marketplace.routes');
const groupRoutes = require('./group.routes');
const paymentRoutes = require('./payment.routes');
const notificationRoutes = require('./notification.routes');
const adminRoutes = require('./admin');

const router = Router();

// Health must work even when the database is down
router.use('/health', healthRoutes);

// Feature routers need MongoDB (unknown paths still fall through to the 404 handler)
router.use('/auth', requireDatabase, authRoutes);
router.use('/users', requireDatabase, userRoutes);
router.use('/admin', requireDatabase, adminRoutes);
router.use('/seller', requireDatabase, sellerRoutes);
router.use('/groups', requireDatabase, groupRoutes);
router.use('/payments', requireDatabase, paymentRoutes);
router.use('/notifications', requireDatabase, notificationRoutes);
router.use(
  ['/categories', '/cities', '/products', '/sellers', '/product-requests'],
  requireDatabase,
);
router.use(catalogRoutes);
router.use(marketplaceRoutes);

module.exports = router;
