/**
 * Small sub-schemas reused by several models (images, GeoJSON points).
 */
const { Schema } = require('mongoose');

/** A Cloudinary asset: public URL + public id (needed to delete or transform it). */
const imageSchema = new Schema(
  {
    url: { type: String, required: true, trim: true },
    publicId: { type: String, trim: true },
  },
  { _id: false },
);

/** GeoJSON point used with 2dsphere indexes. Coordinates are [longitude, latitude]. */
const pointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: ([lng, lat] = []) =>
          Number.isFinite(lng) &&
          Number.isFinite(lat) &&
          Math.abs(lng) <= 180 &&
          Math.abs(lat) <= 90,
        message: 'coordinates must be [longitude, latitude]',
      },
    },
  },
  { _id: false },
);

/** Mongoose validator for integer paise amounts (see utils/money.js). */
const paiseValidator = {
  validator: (value) => value == null || (Number.isSafeInteger(value) && value >= 0),
  message: '{PATH} must be a non-negative integer amount in paise',
};

module.exports = { imageSchema, pointSchema, paiseValidator };
