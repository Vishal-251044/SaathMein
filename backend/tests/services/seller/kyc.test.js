/**
 * Dealer KYC (TRU-1, Day 5): submission rules (email verified, coverage, PAN ↔ GSTIN,
 * required documents incl. dealer proof for vehicles, bank details never stored) and the
 * admin review rules (approve needs a payout account; reject needs pending status).
 */
jest.mock('../../../src/models/seller.model', () => ({ findById: jest.fn() }));
jest.mock('../../../src/models/user.model', () => ({ findById: jest.fn(), find: jest.fn() }));
jest.mock('../../../src/models/city.model', () => ({ findOne: jest.fn() }));
jest.mock('../../../src/models/category.model', () => ({ countDocuments: jest.fn() }));
jest.mock('../../../src/models/sellerStaff.model', () => ({ find: jest.fn() }));
jest.mock('../../../src/services/seller/routeAccount.service', () => ({
  setupLinkedAccount: jest.fn(async () => ({ status: 'requested' })),
}));
jest.mock('../../../src/services/email.service', () => ({
  sendKycSubmitted: jest.fn(async () => ({ sent: true })),
  sendKycReviewNeeded: jest.fn(async () => ({ sent: true })),
  sendKycApproved: jest.fn(async () => ({ sent: true })),
  sendKycRejected: jest.fn(async () => ({ sent: true })),
}));

const { Types } = require('mongoose');
const Seller = require('../../../src/models/seller.model');
const User = require('../../../src/models/user.model');
const City = require('../../../src/models/city.model');
const Category = require('../../../src/models/category.model');
const SellerStaff = require('../../../src/models/sellerStaff.model');
const { setupLinkedAccount } = require('../../../src/services/seller/routeAccount.service');
const emailService = require('../../../src/services/email.service');
const cloudinary = require('cloudinary').v2;
const config = require('../../../src/config/env');
const sellerAccount = require('../../../src/services/seller/sellerAccount.service');
const sellerAdmin = require('../../../src/services/seller/sellerAdmin.service');

const sellerId = new Types.ObjectId().toString();
const cityId = new Types.ObjectId().toString();
const ownerId = new Types.ObjectId();

/** Mongoose-like query chain helper. */
const chain = (value) => ({
  select: () => chain(value),
  populate: () => chain(value),
  lean: async () => value,
  then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
});

/** In-memory seller document. */
const makeSeller = (overrides = {}) => ({
  _id: sellerId,
  ownerUserId: ownerId,
  businessName: 'Shree Motors',
  cities: [cityId],
  categories: [new Types.ObjectId()],
  kyc: { status: 'not_submitted', docs: [] },
  razorpay: {},
  save: jest.fn(async () => {}),
  ...overrides,
});

/** A real signed upload, the same as Cloudinary would return it. */
const signedDoc = (type) => {
  const publicId = `saathmein/kyc/${sellerId}/${type}-abc123`;
  const version = 1700000000;
  return {
    type,
    publicId,
    version,
    format: 'pdf',
    signature: cloudinary.utils.api_sign_request(
      { public_id: publicId, version },
      config.cloudinary.apiSecret,
    ),
  };
};

const kycInput = (overrides = {}) => ({
  businessName: 'Shree Motors',
  businessType: 'proprietorship',
  contactName: 'Ravi Patil',
  contactPhone: '+919876543210',
  gstin: '27ABCPP1234F1Z5',
  pan: 'ABCPP1234F',
  address: { line1: '12 FC Road', cityId, pincode: '411005' },
  documents: ['gst_certificate', 'pan_card', 'shop_photo'].map(signedDoc),
  bank: { accountNumber: '123456789012', ifsc: 'HDFC0001234', beneficiaryName: 'Shree Motors' },
  ...overrides,
});

const givenSeller = (
  seller,
  owner = { email: 'ravi@shreemotors.in', emailVerifiedAt: new Date() },
) => {
  Seller.findById.mockResolvedValue(seller);
  User.findById.mockReturnValue(chain(owner));
  User.find.mockReturnValue(chain([{ email: 'owner@saathmein.in' }]));
  City.findOne.mockReturnValue(chain({ _id: cityId, name: 'Pune', state: 'Maharashtra' }));
  Category.countDocuments.mockResolvedValue(0);
};

describe('submitKyc', () => {
  beforeEach(() => jest.clearAllMocks());

  it('needs a verified email', async () => {
    givenSeller(makeSeller(), { email: 'ravi@shreemotors.in' });
    await expect(
      sellerAccount.submitKyc(sellerId, String(ownerId), kycInput()),
    ).rejects.toMatchObject({
      code: 'EMAIL_NOT_VERIFIED',
    });
  });

  it('needs coverage first', async () => {
    givenSeller(makeSeller({ cities: [] }));
    await expect(
      sellerAccount.submitKyc(sellerId, String(ownerId), kycInput()),
    ).rejects.toMatchObject({
      code: 'COVERAGE_REQUIRED',
    });
  });

  it('rejects a PAN that does not match the GSTIN', async () => {
    givenSeller(makeSeller());
    await expect(
      sellerAccount.submitKyc(sellerId, String(ownerId), kycInput({ pan: 'ZZZPP9999Z' })),
    ).rejects.toMatchObject({ statusCode: 422, code: 'PAN_GSTIN_MISMATCH' });
  });

  it('asks for the dealer proof in vehicle categories', async () => {
    givenSeller(makeSeller());
    Category.countDocuments.mockResolvedValue(1);
    await expect(
      sellerAccount.submitKyc(sellerId, String(ownerId), kycInput()),
    ).rejects.toMatchObject({
      code: 'KYC_DOCUMENTS_MISSING',
      details: { missing: ['dealer_proof'] },
    });
  });

  it('rejects documents that were not uploaded with our signature', async () => {
    givenSeller(makeSeller());
    const forged = { ...signedDoc('pan_card'), signature: 'f'.repeat(40) };
    const input = kycInput({
      documents: [signedDoc('gst_certificate'), forged, signedDoc('shop_photo')],
    });
    await expect(sellerAccount.submitKyc(sellerId, String(ownerId), input)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('cannot resubmit while under review', async () => {
    givenSeller(makeSeller({ kyc: { status: 'pending', docs: [] } }));
    await expect(
      sellerAccount.submitKyc(sellerId, String(ownerId), kycInput()),
    ).rejects.toMatchObject({
      code: 'KYC_LOCKED',
    });
  });

  it('saves KYC as pending, keeps only the last 4 bank digits and sets up Razorpay', async () => {
    const seller = makeSeller();
    givenSeller(seller);
    await sellerAccount.submitKyc(sellerId, String(ownerId), kycInput());

    expect(seller.kyc.status).toBe('pending');
    expect(seller.kyc.docs).toHaveLength(3);
    expect(seller.bank).toEqual({
      accountLast4: '9012',
      ifsc: 'HDFC0001234',
      beneficiaryName: 'Shree Motors',
    });
    expect(JSON.stringify(seller.bank)).not.toContain('123456789012');
    expect(seller.address.state).toBe('Maharashtra');
    expect(setupLinkedAccount).toHaveBeenCalledWith(seller, kycInput().bank);
    expect(emailService.sendKycReviewNeeded).toHaveBeenCalled();
  });
});

describe('admin KYC review', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    SellerStaff.find.mockReturnValue(chain([]));
  });

  const pendingSeller = (razorpay) =>
    makeSeller({
      kyc: { status: 'pending', docs: [] },
      razorpayAccountId: razorpay ? 'acc_TEST123' : undefined,
      razorpay: razorpay || { status: 'failed' },
    });

  it('refuses approval without a Razorpay linked account', async () => {
    givenSeller(pendingSeller(null));
    await expect(sellerAdmin.approveKyc(sellerId, 'staff1')).rejects.toMatchObject({
      statusCode: 409,
      code: 'PAYOUT_ACCOUNT_REQUIRED',
    });
  });

  it('refuses approval when the payout bank is not set at Razorpay', async () => {
    givenSeller(pendingSeller({ status: 'requested', settlementsConfigured: false }));
    await expect(sellerAdmin.approveKyc(sellerId, 'staff1')).rejects.toMatchObject({
      code: 'PAYOUT_BANK_REQUIRED',
    });
  });

  it('approves a pending seller with payouts set up and emails the dealer', async () => {
    const seller = pendingSeller({ status: 'under_review', settlementsConfigured: true });
    givenSeller(seller);
    const { before } = await sellerAdmin.approveKyc(sellerId, 'staff1');
    expect(before.kycStatus).toBe('pending');
    expect(seller.kyc.status).toBe('approved');
    expect(seller.kyc.reviewedBy).toBe('staff1');
    expect(emailService.sendKycApproved).toHaveBeenCalled();
  });

  it('only reviews pending KYC', async () => {
    givenSeller(makeSeller({ kyc: { status: 'approved', docs: [] } }));
    await expect(
      sellerAdmin.rejectKyc(sellerId, 'staff1', 'Blurry PAN card photo'),
    ).rejects.toMatchObject({
      code: 'KYC_NOT_PENDING',
    });
  });

  it('sends KYC back with the reason', async () => {
    const seller = pendingSeller(null);
    givenSeller(seller);
    await sellerAdmin.rejectKyc(sellerId, 'staff1', 'Blurry PAN card photo');
    expect(seller.kyc.status).toBe('rejected');
    expect(seller.kyc.rejectionReason).toBe('Blurry PAN card photo');
    expect(emailService.sendKycRejected).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'Blurry PAN card photo' }),
    );
  });
});
