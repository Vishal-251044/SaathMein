/**
 * Setting model — platform-wide business values the Owner/Admin can edit (PRD §10.11
 * Settings). One document per key; `value` holds the section. Code reads them through
 * services/settings.service.js (cached), never hardcodes them.
 */
const { Schema, model } = require('mongoose');

const settingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: Schema.Types.Mixed, required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, minimize: false },
);

module.exports = model('Setting', settingSchema);
