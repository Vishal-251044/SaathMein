/**
 * Admin group routes — /api/admin/groups (read-only on Day 6).
 * Allowed: Owner, Admin, Deal Manager, Support (PRD §8.2). Scoped by path because this
 * router is mounted at /api/admin.
 */
const { Router } = require('express');
const validate = require('../../middlewares/validate.middleware');
const { requireStaff } = require('../../middlewares/staffAuth.middleware');
const controller = require('../../controllers/admin/adminGroups.controller');
const schemas = require('../../validators/group.validator');
const { STAFF_ROLE } = require('../../constants/enums');

const router = Router();

router.use('/groups', requireStaff(STAFF_ROLE.ADMIN, STAFF_ROLE.DEAL_MANAGER, STAFF_ROLE.SUPPORT));
router.get('/groups', validate(schemas.adminListGroupsSchema), controller.listGroups);

module.exports = router;
