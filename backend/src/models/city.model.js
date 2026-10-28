/**
 * City model — launch cities and their areas. Groups and seller coverage are per city (CAT-4).
 */
const { Schema, model } = require('mongoose');
const { pointSchema } = require('./shared.schemas');

const areaSchema = new Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. "Kothrud"
    slug: { type: String, required: true, trim: true, lowercase: true },
    pincodes: [{ type: String, trim: true, match: /^\d{6}$/ }],
    location: pointSchema,
    active: { type: Boolean, default: true },
  },
  { _id: true },
);

const citySchema = new Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. "Pune"
    slug: { type: String, required: true, trim: true, lowercase: true },
    state: { type: String, required: true, trim: true },
    location: pointSchema, // city centre, used for auto-detect
    areas: [areaSchema],
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

citySchema.index({ slug: 1 }, { unique: true });
citySchema.index({ 'areas.pincodes': 1 });

module.exports = model('City', citySchema);
