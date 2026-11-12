/**
 * Report model — a user reports a group, member, seller, chat message or review (TRU-3,
 * PRD §13 `reports`). One report per reporter and target; Support decides from the
 * Disputes and Reports queue. Every step is kept in `timeline`.
 */
const { Schema, model } = require('mongoose');
const { REPORT_REASON, REPORT_STATUS, REPORT_TARGET, values } = require('../constants/enums');

const timelineSchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    actorType: { type: String, enum: ['user', 'staff', 'system'], required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true, trim: true },
    note: { type: String, trim: true, maxlength: 1000 },
  },
  { _id: false },
);

const reportSchema = new Schema(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: values(REPORT_TARGET), required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    groupId: { type: Schema.Types.ObjectId, ref: 'Group' }, // context (message, member)
    reason: { type: String, enum: values(REPORT_REASON), required: true },
    details: { type: String, trim: true, maxlength: 1000 },
    status: { type: String, enum: values(REPORT_STATUS), default: REPORT_STATUS.OPEN },
    decision: {
      action: { type: String, trim: true },
      note: { type: String, trim: true, maxlength: 1000 },
      by: { type: Schema.Types.ObjectId, ref: 'User' },
      at: Date,
    },
    timeline: [timelineSchema],
  },
  { timestamps: true },
);

reportSchema.index({ reporterId: 1, targetType: 1, targetId: 1 }, { unique: true });
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ targetType: 1, targetId: 1 });

module.exports = model('Report', reportSchema);
