/**
 * Home feed routes — /api/feed (DIS-1). Works for guests (pass ?cityId=) and logged-in
 * buyers (their city, area and interests).
 */
const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { optionalAuth } = require('../middlewares/auth.middleware');
const controller = require('../controllers/discovery.controller');
const schemas = require('../validators/discovery.validator');

const router = Router();

router.get('/home', optionalAuth, validate(schemas.homeFeedSchema), controller.homeFeed);

module.exports = router;
