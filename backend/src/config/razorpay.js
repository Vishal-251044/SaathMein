/**
 * Razorpay client (Route linked accounts, payments, refunds, transfers).
 * Created lazily, only when RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are real keys.
 */
const Razorpay = require('razorpay');
const config = require('./env');

let client = null;

/**
 * @returns {import('razorpay')|null} Razorpay client, or null when not configured
 */
const getRazorpay = () => {
  if (!config.razorpay.isConfigured) return null;
  client ??= new Razorpay({ key_id: config.razorpay.keyId, key_secret: config.razorpay.keySecret });
  return client;
};

module.exports = { getRazorpay };
