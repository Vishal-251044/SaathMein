/**
 * Notification routes — /api/notifications (logged-in users).
 */
const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requireAuth } = require('../middlewares/auth.middleware');
const controller = require('../controllers/notification.controller');
const schemas = require('../validators/chat.validator');

const router = Router();

router.use(requireAuth);
router.get('/', validate(schemas.listNotificationsSchema), controller.list);
router.post('/read', validate(schemas.markReadSchema), controller.markRead);
router.post('/push-token', validate(schemas.pushTokenSchema), controller.registerPushToken);
router.delete('/push-token', validate(schemas.removePushTokenSchema), controller.removePushToken);

module.exports = router;
