/**
 * Catalog routes — public /api/categories and /api/cities (no login needed, so the app
 * can show cities and categories during onboarding). Products are added on Day 4.
 */
const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const controller = require('../controllers/catalog.controller');
const { matchLocationSchema } = require('../validators/city.validator');

const router = Router();

router.get('/categories', controller.getCategories);
router.get('/cities', controller.getCities);
router.get('/cities/match', validate(matchLocationSchema), controller.matchCity);

module.exports = router;
