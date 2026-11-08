/**
 * Payment routes — /api/payments (logged-in buyers). The webhook is mounted separately in
 * app.js because it needs the raw request body for the signature check.
 */
const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requireAuth } = require('../middlewares/auth.middleware');
const controller = require('../controllers/payment.controller');
const schemas = require('../validators/payment.validator');

const router = Router();

router.use(requireAuth);
router.post('/order', validate(schemas.createOrderSchema), controller.createOrder);
router.post('/verify', validate(schemas.verifySchema), controller.verify);
router.post('/:paymentId/cancel', validate(schemas.paymentIdParams), controller.cancel);
router.get('/me', validate(schemas.myPaymentsSchema), controller.myPayments);

module.exports = router;
