/**
 * Admin router — mounts every admin console router under /api/admin.
 * Everything except /auth is staff-only. Console modules are added from Day 3 onwards.
 */
const { Router } = require('express');
const { requireStaff } = require('../../middlewares/staffAuth.middleware');
const adminAuthRoutes = require('./admin.auth.routes');

const router = Router();

router.use('/auth', adminAuthRoutes);

// Every admin route below this line requires a staff session (buyers get 403)
router.use(requireStaff());

module.exports = router;
