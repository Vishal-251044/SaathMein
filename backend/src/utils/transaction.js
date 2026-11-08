/**
 * Run work inside one MongoDB transaction (Atlas replica set). Used by every money flow
 * that must change several documents together (PAY-2): payment + member + group count +
 * ledger. Mongoose retries transient transaction errors automatically.
 */
const mongoose = require('mongoose');

/**
 * @template T
 * @param {(session: import('mongoose').ClientSession) => Promise<T>} work - Writes using `session`
 * @returns {Promise<T>} What `work` returned (after commit)
 */
const withTransaction = async (work) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
};

module.exports = { withTransaction };
