/**
 * Mongoose plugin that makes a collection append-only.
 * Used by the money ledger (PAY-5) and dealer bids (AUC-7): records can be created
 * but never deleted, and (optionally) never updated. Corrections are new records.
 *
 * Note: this guards normal Mongoose model/query calls. Raw driver calls and bulkWrite
 * bypass it, so never use those on append-only collections.
 */

const UPDATE_QUERIES = [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'replaceOne',
  'findOneAndReplace',
];
const DELETE_QUERIES = ['deleteOne', 'deleteMany', 'findOneAndDelete'];

/**
 * @param {import('mongoose').Schema} schema - Schema to protect
 * @param {Object} [options]
 * @param {boolean} [options.allowUpdates=false] - Allow updates (e.g. bid status) but still
 *   block deletes. Pair this with `immutable: true` on fields that must never change.
 */
const appendOnlyPlugin = (schema, { allowUpdates = false } = {}) => {
  /**
   * Build a hook that always rejects the operation.
   * @param {string} action - "update" or "delete" (used in the error message)
   * @returns {Function} Mongoose middleware that throws
   */
  const reject = (action) =>
    function rejectAppendOnly() {
      const modelName = this.model?.modelName || this.constructor?.modelName || 'Model';
      throw new Error(`[${modelName}] is append-only: ${action} is not allowed`);
    };

  schema.pre(DELETE_QUERIES, { document: false, query: true }, reject('delete'));
  schema.pre('deleteOne', { document: true, query: false }, reject('delete'));

  if (!allowUpdates) {
    schema.pre(UPDATE_QUERIES, { document: false, query: true }, reject('update'));
    schema.pre('save', function blockResave() {
      if (!this.isNew) reject('update').call(this);
    });
  }
};

module.exports = appendOnlyPlugin;
