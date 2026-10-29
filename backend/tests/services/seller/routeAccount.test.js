/**
 * Razorpay Route linked account setup (PAY-4, Day 5) with a mocked Razorpay SDK:
 * full happy path, resuming after a failure, and missing keys.
 */
jest.mock('../../../src/config/razorpay', () => ({ getRazorpay: jest.fn() }));
jest.mock('../../../src/models/city.model', () => ({
  findById: jest.fn(() => ({ select: () => ({ lean: async () => ({ name: 'Pune' }) }) })),
}));

const { Types } = require('mongoose');
const { getRazorpay } = require('../../../src/config/razorpay');
const {
  setupLinkedAccount,
  buildAccountRequest,
  isPersonalPan,
} = require('../../../src/services/seller/routeAccount.service');

const BANK = {
  accountNumber: '123456789012',
  ifsc: 'HDFC0001234',
  beneficiaryName: 'Shree Motors',
};

/** In-memory seller with a save() spy. */
const makeSeller = (overrides = {}) => ({
  _id: new Types.ObjectId(),
  businessName: 'Shree Motors',
  businessType: 'proprietorship',
  contactName: 'Ravi Patil',
  contactEmail: 'ravi@shreemotors.in',
  contactPhone: '+919876543210',
  gstin: '27ABCPP1234F1Z5',
  pan: 'ABCPP1234F',
  address: { line1: '12 FC Road', area: 'Shivajinagar', pincode: '411005', state: 'Maharashtra' },
  razorpay: {},
  save: jest.fn(async () => {}),
  ...overrides,
});

/** Razorpay SDK mock. */
const makeRazorpay = () => ({
  accounts: { create: jest.fn(async () => ({ id: 'acc_TEST123' })) },
  stakeholders: { create: jest.fn(async () => ({ id: 'sth_TEST123' })) },
  products: {
    requestProductConfiguration: jest.fn(async () => ({
      id: 'acc_prd_TEST',
      activation_status: 'requested',
    })),
    edit: jest.fn(async () => ({ id: 'acc_prd_TEST', activation_status: 'under_review' })),
    fetch: jest.fn(async () => ({ id: 'acc_prd_TEST', activation_status: 'activated' })),
  },
});

describe('routeAccount.service', () => {
  it('detects personal PANs (4th letter P)', () => {
    expect(isPersonalPan('ABCPP1234F')).toBe(true);
    expect(isPersonalPan('ABCCP1234F')).toBe(false);
  });

  it('builds the account request from seller data (no bank details)', () => {
    const body = buildAccountRequest(makeSeller(), 'Pune');
    expect(body).toMatchObject({
      type: 'route',
      phone: '9876543210',
      legal_business_name: 'Shree Motors',
      legal_info: { pan: 'ABCPP1234F', gst: '27ABCPP1234F1Z5' },
      profile: { addresses: { registered: { city: 'Pune', state: 'MAHARASHTRA', country: 'IN' } } },
    });
    expect(JSON.stringify(body)).not.toContain('123456789012');
  });

  it('runs all four steps and marks payouts configured', async () => {
    const razorpay = makeRazorpay();
    getRazorpay.mockReturnValue(razorpay);
    const seller = makeSeller();

    const result = await setupLinkedAccount(seller, BANK);

    expect(result).toEqual({ status: 'under_review' });
    expect(seller.razorpayAccountId).toBe('acc_TEST123');
    expect(seller.razorpay).toMatchObject({
      stakeholderId: 'sth_TEST123',
      productId: 'acc_prd_TEST',
      settlementsConfigured: true,
      status: 'under_review',
    });
    expect(razorpay.stakeholders.create).toHaveBeenCalledWith(
      'acc_TEST123',
      expect.objectContaining({ kyc: { pan: 'ABCPP1234F' } }),
    );
    expect(razorpay.products.edit).toHaveBeenCalledWith('acc_TEST123', 'acc_prd_TEST', {
      settlements: {
        account_number: '123456789012',
        ifsc_code: 'HDFC0001234',
        beneficiary_name: 'Shree Motors',
      },
      tnc_accepted: true,
    });
    expect(seller.save).toHaveBeenCalled();
  });

  it('saves the error and resumes from the failed step on retry', async () => {
    const razorpay = makeRazorpay();
    razorpay.stakeholders.create.mockRejectedValueOnce({ error: { description: 'Invalid email' } });
    getRazorpay.mockReturnValue(razorpay);
    const seller = makeSeller();

    const failed = await setupLinkedAccount(seller, BANK);
    expect(failed).toEqual({ status: 'failed', error: 'Invalid email' });
    expect(seller.razorpayAccountId).toBe('acc_TEST123'); // created before the failure
    expect(seller.razorpay.lastError).toBe('Invalid email');
    expect(seller.razorpay.settlementsConfigured).toBeUndefined();

    // Retry without bank details (admin "retry payout setup"): the account is not recreated
    const retried = await setupLinkedAccount(seller, null);
    expect(retried.status).toBe('requested');
    expect(razorpay.accounts.create).toHaveBeenCalledTimes(1);
    expect(seller.razorpay.lastError).toBeUndefined();
    expect(seller.razorpay.settlementsConfigured).toBeUndefined();
  });

  it('refreshes the activation status on retry once everything exists', async () => {
    const razorpay = makeRazorpay();
    getRazorpay.mockReturnValue(razorpay);
    const seller = makeSeller({
      razorpayAccountId: 'acc_TEST123',
      razorpay: {
        stakeholderId: 'sth_1',
        productId: 'acc_prd_TEST',
        settlementsConfigured: true,
        status: 'failed',
      },
    });
    const result = await setupLinkedAccount(seller, null);
    expect(result.status).toBe('activated');
    expect(razorpay.products.fetch).toHaveBeenCalledWith('acc_TEST123', 'acc_prd_TEST');
    expect(seller.razorpay.settlementsConfigured).toBe(true);
  });

  it('fails gracefully when Razorpay keys are missing', async () => {
    getRazorpay.mockReturnValue(null);
    const seller = makeSeller({ razorpay: { stakeholderId: 'sth_OLD' } });
    const result = await setupLinkedAccount(seller, BANK);
    expect(result.status).toBe('failed');
    expect(seller.razorpay).toMatchObject({ status: 'failed', stakeholderId: 'sth_OLD' });
  });
});
