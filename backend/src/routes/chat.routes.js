/**
 * Group chat routes — /api/groups/:groupId/messages (members and the leader).
 * Mounted inside the group router (mergeParams for :groupId).
 */
const { Router } = require('express');
const validate = require('../middlewares/validate.middleware');
const { requireAuth } = require('../middlewares/auth.middleware');
const controller = require('../controllers/chat.controller');
const schemas = require('../validators/chat.validator');

const router = Router({ mergeParams: true });

router.use(requireAuth);
router.get('/', validate(schemas.listMessagesSchema), controller.listMessages);
router.post('/', validate(schemas.sendMessageSchema), controller.sendMessage);
router.post(
  '/image-upload-params',
  validate({ params: schemas.groupParams }),
  controller.imageUploadParams,
);
router.post('/:messageId/vote', validate(schemas.voteSchema), controller.vote);
router.post('/:messageId/pin', validate(schemas.pinSchema), controller.pin);
router.post('/:messageId/report', validate(schemas.reportSchema), controller.report);

module.exports = router;
