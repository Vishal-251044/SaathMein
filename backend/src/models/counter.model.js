/**
 * Counter model — atomic sequences (e.g. commission invoice numbers per financial year).
 * Use `nextSequence` in helpers; never compute the next number by counting documents.
 */
const { Schema, model } = require('mongoose');

const counterSchema = new Schema(
  {
    _id: { type: String, required: true }, // e.g. "commission-invoice:2026-27"
    seq: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

/**
 * Next number of a sequence (1, 2, 3 ...), atomically.
 * @param {string} name - Sequence name
 * @param {import('mongoose').ClientSession} [session]
 * @returns {Promise<number>}
 */
counterSchema.statics.nextSequence = async function nextSequence(name, session) {
  const counter = await this.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session },
  );
  return counter.seq;
};

module.exports = model('Counter', counterSchema);
