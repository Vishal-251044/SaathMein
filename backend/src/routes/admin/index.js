/**
 * Admin router — mounts every admin console router under /api/admin.
 * Everything except /auth is staff-only; each module router adds its own role check.
 */
const { Router } = require('express');
const { requireStaff } = require('../../middlewares/staffAuth.middleware');
const adminAuthRoutes = require('./admin.auth.routes');
const adminCitiesRoutes = require('./admin.cities.routes');
const adminCatalogRoutes = require('./admin.catalog.routes');

const router = Router();

router.use('/auth', adminAuthRoutes);

// Every admin route below this line requires a staff session (buyers get 403)
router.use(requireStaff());
router.use('/cities', adminCitiesRoutes);
router.use(adminCatalogRoutes); // /categories, /products

module.exports = router;
