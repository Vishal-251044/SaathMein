/**
 * Phone privacy (PRD §14, decided 12 Nov 2026): other members never see phone numbers;
 * the winning dealer sees a member's number masked (+91******3210) until the 24 h exit
 * window ends (the member can no longer leave), then in full to arrange the sale.
 */
const { maskPhone } = require('../../helpers/genericFunctions');

/**
 * Phone as the winning dealer may see it.
 * @param {string|null|undefined} phone - E.164 phone
 * @param {Date|string|null|undefined} exitWindowEndsAt - Group exit window end
 * @param {Date} [now]
 * @returns {{ phone: string|null, phoneMasked: boolean }}
 */
const phoneForDealer = (phone, exitWindowEndsAt, now = new Date()) => {
  if (!phone) return { phone: null, phoneMasked: false };
  const accepted = exitWindowEndsAt && new Date(exitWindowEndsAt) <= now;
  return accepted ? { phone, phoneMasked: false } : { phone: maskPhone(phone), phoneMasked: true };
};

module.exports = { phoneForDealer };
