/**
 * Commission math (PRD §05, PAY-4). Rules come from the category (admin-editable):
 * - flat: paise per unit (e.g. cars ₹5,000)
 * - percent: basis points of the winning price (e.g. 300 = 3%)
 * The commission is taken from the buyer's token before the Route transfer; anything
 * above the token is invoiced to the dealer (token at the shop = part-payment, decided
 * 8 Nov 2026).
 */
const { COMMISSION_TYPE } = require('../../constants/enums');
const { percentOfPaise, isValidPaise } = require('../../utils/money');

/**
 * @param {{ type: 'flat'|'percent', value: number }} rule - Category commission rule
 * @param {number} pricePerUnitPaise - Winning all-inclusive price
 * @returns {number} Commission in paise for one unit
 */
const commissionForUnit = (rule, pricePerUnitPaise) => {
  if (!rule || !rule.value) return 0;
  if (rule.type === COMMISSION_TYPE.FLAT) return rule.value;
  return percentOfPaise(pricePerUnitPaise, rule.value);
};

/**
 * Split one member's token between the dealer and SaathMein.
 * @param {{ tokenPaise: number, pricePerUnitPaise: number, rule: Object }} input
 * @returns {{ commissionPaise: number, fromTokenPaise: number, invoicedPaise: number, transferPaise: number }}
 *   commissionPaise = total; fromTokenPaise taken from the token; invoicedPaise billed to the
 *   dealer; transferPaise sent to the dealer
 * @throws {TypeError} For amounts that are not integer paise
 */
const splitToken = ({ tokenPaise, pricePerUnitPaise, rule }) => {
  if (!isValidPaise(tokenPaise) || !isValidPaise(pricePerUnitPaise)) {
    throw new TypeError('[Commission] amounts must be integer paise');
  }
  const commissionPaise = commissionForUnit(rule, pricePerUnitPaise);
  const fromTokenPaise = Math.min(commissionPaise, tokenPaise);
  return {
    commissionPaise,
    fromTokenPaise,
    invoicedPaise: commissionPaise - fromTokenPaise,
    transferPaise: tokenPaise - fromTokenPaise,
  };
};

module.exports = { commissionForUnit, splitToken };
