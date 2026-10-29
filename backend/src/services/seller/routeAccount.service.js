/**
 * Razorpay Route linked account for a dealer (PRD §10.4, PAY-4) — the account winning
 * tokens are transferred to. Steps (each is skipped if already done, so it can be retried):
 *   1. create the linked account (business details, PAN, GST, registered address)
 *   2. add the contact person as stakeholder
 *   3. request the Route product configuration
 *   4. set the settlement bank account (needs the bank details from the KYC form)
 * Bank details are passed straight to Razorpay and never stored by SaathMein.
 * Status and the last error are saved on the seller for the admin KYC screen. A retry
 * without bank details also refreshes the activation status from Razorpay.
 */
const City = require('../../models/city.model');
const config = require('../../config/env');
const { getRazorpay } = require('../../config/razorpay');
const { createLogger } = require('../../utils/logger');

const log = createLogger('RouteAccount');

/** Razorpay activation_status → our status. */
const ACTIVATION_STATUS = {
  requested: 'requested',
  needs_clarification: 'needs_clarification',
  under_review: 'under_review',
  activated: 'activated',
  suspended: 'suspended',
};

/**
 * Human-readable error from a Razorpay SDK failure.
 * @param {*} err - Error thrown by the SDK
 * @returns {string}
 */
const razorpayErrorMessage = (err) =>
  (
    err?.error?.description ||
    err?.error?.reason ||
    err?.message ||
    'Razorpay request failed'
  ).slice(0, 500);

/**
 * Personal PANs have "P" as the 4th character; only those identify a person (stakeholder KYC).
 * @param {string} pan - PAN
 * @returns {boolean}
 */
const isPersonalPan = (pan) => /^[A-Z]{3}P[A-Z]\d{4}[A-Z]$/.test(pan || '');

/**
 * Build the linked-account request from seller data.
 * @param {Object} seller - Seller document
 * @param {string} cityName - City of the shop
 * @returns {Object} POST /v2/accounts body
 */
const buildAccountRequest = (seller, cityName) => ({
  email: seller.contactEmail,
  phone: seller.contactPhone?.replace(/^\+91/, ''),
  type: 'route',
  reference_id: String(seller._id),
  legal_business_name: seller.businessName,
  business_type: seller.businessType,
  contact_name: seller.contactName,
  profile: {
    category: config.razorpay.routeCategory,
    subcategory: config.razorpay.routeSubcategory,
    addresses: {
      registered: {
        street1: seller.address.line1,
        street2: seller.address.line2 || seller.address.area || seller.address.line1,
        city: cityName,
        state: (seller.address.state || 'Maharashtra').toUpperCase(),
        postal_code: seller.address.pincode,
        country: 'IN',
      },
    },
  },
  legal_info: { pan: seller.pan, gst: seller.gstin },
});

/**
 * Create or continue the dealer's Route linked account. Saves progress on the seller and
 * never throws: failures are stored in `seller.razorpay.lastError` for staff to see.
 * @param {Object} seller - Seller document (saved by this function)
 * @param {{ accountNumber: string, ifsc: string, beneficiaryName: string }|null} bank - From the KYC form
 * @returns {Promise<{ status: string, error?: string }>}
 */
const setupLinkedAccount = async (seller, bank) => {
  const razorpay = getRazorpay();
  // Mongoose subdocument or plain object (both keep earlier progress)
  const saved = () => seller.razorpay?.toObject?.() ?? { ...seller.razorpay };
  const fail = async (message) => {
    seller.razorpay = {
      ...saved(),
      status: 'failed',
      lastError: message,
      updatedAt: new Date(),
    };
    await seller.save();
    return { status: 'failed', error: message };
  };

  if (!razorpay) return fail('Razorpay keys are not set (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).');

  const progress = saved();
  // A retry starts from the last good state; each step below sets the real status again
  if (progress.status === 'failed')
    progress.status = seller.razorpayAccountId ? 'created' : 'not_started';
  try {
    if (!seller.razorpayAccountId) {
      const city = await City.findById(seller.address?.cityId).select('name').lean();
      const account = await razorpay.accounts.create(
        buildAccountRequest(seller, city?.name || 'Pune'),
      );
      seller.razorpayAccountId = account.id;
      progress.status = 'created';
    }

    if (!progress.stakeholderId) {
      const stakeholder = await razorpay.stakeholders.create(seller.razorpayAccountId, {
        name: seller.contactName,
        email: seller.contactEmail,
        ...(isPersonalPan(seller.pan) ? { kyc: { pan: seller.pan } } : {}),
      });
      progress.stakeholderId = stakeholder.id;
    }

    if (!progress.productId) {
      const product = await razorpay.products.requestProductConfiguration(
        seller.razorpayAccountId,
        {
          product_name: 'route',
          tnc_accepted: true,
        },
      );
      progress.productId = product.id;
      progress.status = ACTIVATION_STATUS[product.activation_status] || 'requested';
    } else if (!bank) {
      // Retry / refresh: read the current activation status from Razorpay
      const product = await razorpay.products.fetch(seller.razorpayAccountId, progress.productId);
      progress.status = ACTIVATION_STATUS[product.activation_status] || progress.status;
    }

    if (bank) {
      const product = await razorpay.products.edit(seller.razorpayAccountId, progress.productId, {
        settlements: {
          account_number: bank.accountNumber,
          ifsc_code: bank.ifsc,
          beneficiary_name: bank.beneficiaryName,
        },
        tnc_accepted: true,
      });
      progress.status = ACTIVATION_STATUS[product.activation_status] || progress.status;
      progress.settlementsConfigured = true;
    }

    seller.razorpay = { ...progress, lastError: undefined, updatedAt: new Date() };
    await seller.save();
    log.info(
      { sellerId: String(seller._id), status: progress.status, live: config.razorpay.isLiveMode },
      'Linked account updated',
    );
    return { status: progress.status };
  } catch (err) {
    const message = razorpayErrorMessage(err);
    log.error({ sellerId: String(seller._id), err: message }, 'Linked account setup failed');
    seller.razorpay = { ...progress, status: 'failed', lastError: message, updatedAt: new Date() };
    await seller.save();
    return { status: 'failed', error: message };
  }
};

module.exports = { setupLinkedAccount, buildAccountRequest, isPersonalPan, razorpayErrorMessage };
