/**
 * Zod schemas for group chat (/api/groups/:groupId/messages) and notifications.
 */
const { z } = require('zod');

const objectId = z.string().regex(/^[a-f0-9]{24}$/, 'Invalid id');
const groupParams = z.object({ groupId: objectId });
const messageParams = z.object({ groupId: objectId, messageId: objectId });

const listMessagesSchema = {
  params: groupParams,
  query: z.object({ before: objectId.optional(), limit: z.string().regex(/^\d+$/).optional() }),
};

/** Dealer posts text only (as the business). */
const dealerMessageSchema = {
  params: groupParams,
  body: z.object({ text: z.string().trim().min(1).max(1000) }).strict(),
};

const sendMessageSchema = {
  params: groupParams,
  body: z
    .object({
      text: z.string().trim().min(1).max(1000).optional(),
      image: z
        .object({
          publicId: z.string().trim().min(1).max(200),
          version: z.coerce.number().int().positive(),
          signature: z
            .string()
            .trim()
            .regex(/^[a-f0-9]{40,64}$/, 'Invalid upload'),
        })
        .strict()
        .optional(),
      poll: z
        .object({
          question: z.string().trim().min(3).max(200),
          options: z.array(z.string().trim().min(1).max(80)).min(2).max(6),
        })
        .strict()
        .optional(),
    })
    .strict(),
};

const voteSchema = {
  params: messageParams,
  body: z.object({ optionIndex: z.number().int().min(0).max(5) }).strict(),
};

const pinSchema = { params: messageParams, body: z.object({ pinned: z.boolean() }).strict() };

const reportSchema = {
  params: messageParams,
  body: z.object({ reason: z.string().trim().max(200).optional() }).strict(),
};

const listNotificationsSchema = {
  query: z.object({
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
  }),
};

const markReadSchema = {
  body: z
    .object({ ids: z.array(objectId).max(100).optional(), all: z.boolean().optional() })
    .strict()
    .refine((body) => body.all || body.ids?.length, 'Send ids or all: true'),
};

const pushTokenSchema = {
  body: z
    .object({
      token: z
        .string()
        .trim()
        .max(200)
        .regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, 'Invalid push token'),
      platform: z.enum(['android', 'ios']).default('android'),
    })
    .strict(),
};

const removePushTokenSchema = {
  body: z.object({ token: z.string().trim().max(200) }).strict(),
};

module.exports = {
  dealerMessageSchema,
  groupParams,
  listMessagesSchema,
  sendMessageSchema,
  voteSchema,
  pinSchema,
  reportSchema,
  listNotificationsSchema,
  markReadSchema,
  pushTokenSchema,
  removePushTokenSchema,
};
