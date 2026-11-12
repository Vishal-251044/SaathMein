/**
 * CurationItem model — Admin → Curation (F34, PRD §13 `homeSections`): home banners and
 * featured group deals, per city or for every city, ordered, with optional start / end
 * dates (festival campaigns). Category order lives on the Category `order` field.
 */
const { Schema, model } = require('mongoose');
const { CURATION_TYPE, values } = require('../constants/enums');

const curationItemSchema = new Schema(
  {
    type: { type: String, enum: values(CURATION_TYPE), required: true },
    cityId: { type: Schema.Types.ObjectId, ref: 'City' }, // empty = every city
    // Banner
    title: { type: String, trim: true, maxlength: 80 },
    titleTranslations: { hi: { type: String, trim: true }, mr: { type: String, trim: true } },
    subtitle: { type: String, trim: true, maxlength: 160 },
    subtitleTranslations: { hi: { type: String, trim: true }, mr: { type: String, trim: true } },
    image: { publicId: String, url: String },
    // In-app destination, e.g. "/category/<id>" or "/group/<id>" (never an outside URL)
    linkPath: { type: String, trim: true, maxlength: 200 },
    // Featured group
    groupId: { type: Schema.Types.ObjectId, ref: 'Group' },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    startsAt: Date,
    endsAt: Date,
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

curationItemSchema.index({ type: 1, active: 1, order: 1 });

module.exports = model('CurationItem', curationItemSchema);
