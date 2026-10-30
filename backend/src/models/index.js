/**
 * Registers and re-exports every Mongoose model so they can be imported from one place.
 */
module.exports = {
  User: require('./user.model'),
  Seller: require('./seller.model'),
  Category: require('./category.model'),
  Product: require('./product.model'),
  City: require('./city.model'),
  Group: require('./group.model'),
  GroupMember: require('./groupMember.model'),
  Bid: require('./bid.model'),
  Payment: require('./payment.model'),
  Ledger: require('./ledger.model'),
  Session: require('./session.model'),
  DemandSignal: require('./demandSignal.model'),
  PriceHistory: require('./priceHistory.model'),
  SellerStaff: require('./sellerStaff.model'),
  SellerInvite: require('./sellerInvite.model'),
  AuditLog: require('./auditLog.model'),
  ProductRequest: require('./productRequest.model'),
  Setting: require('./setting.model'),
};
