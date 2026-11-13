/**
 * Admin router — mounts every admin console router under /api/admin.
 * Everything except /auth is staff-only; each module router adds its own role check.
 * Every successful write below /auth is recorded in the audit log (ADL-5).
 */
const { Router } = require('express');
const { requireStaff } = require('../../middlewares/staffAuth.middleware');
const { auditAdminWrites } = require('../../middlewares/audit.middleware');
const adminAuthRoutes = require('./admin.auth.routes');
const adminCitiesRoutes = require('./admin.cities.routes');
const adminCatalogRoutes = require('./admin.catalog.routes');
const adminSellersRoutes = require('./admin.sellers.routes');
const adminGroupsRoutes = require('./admin.groups.routes');
const adminCommissionsRoutes = require('./admin.commissions.routes');
const adminDiscoveryRoutes = require('./admin.discovery.routes');
const adminTrustRoutes = require('./admin.trust.routes');
const adminMonitorRoutes = require('./admin.monitor.routes');
const adminTeamRoutes = require('./admin.team.routes');

const router = Router();

router.use('/auth', adminAuthRoutes);

// Every admin route below this line requires a staff session (buyers get 403)
router.use(requireStaff(), auditAdminWrites);
router.use('/cities', adminCitiesRoutes);
router.use(adminCatalogRoutes); // /categories, /products
router.use(adminSellersRoutes); // /sellers, /product-requests, /audit-logs
router.use(adminGroupsRoutes); // /groups
router.use(adminCommissionsRoutes); // /commissions, /commission-invoices
router.use(adminDiscoveryRoutes); // /curation, /settings
router.use(adminTrustRoutes); // /disputes, /reports
router.use(adminMonitorRoutes); // /monitor/*, /alerts
router.use(adminTeamRoutes); // /team (Owner only)

module.exports = router;
