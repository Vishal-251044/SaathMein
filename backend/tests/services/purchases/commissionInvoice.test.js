/**
 * Monthly commission invoices (F17): one invoice per dealer and month, numbered per
 * financial year from an atomic counter, GST split by state, commissions linked to it;
 * a month cannot be billed before it ends.
 */
jest.mock('../../../src/utils/transaction', () => ({
  withTransaction: jest.fn(async (work) => work({ id: 'session' })),
}));
jest.mock('../../../src/services/settings.service', () => ({
  getBillingSettings: jest.fn(async () => ({
    legalName: 'SaathMein Technologies',
    gstin: '27ABCDE1234F1Z5',
    stateCode: '27',
    gstRateBps: 1800,
    invoicePrefix: 'SM',
  })),
}));

const { Types } = require('mongoose');
const Commission = require('../../../src/models/commission.model');
const CommissionInvoice = require('../../../src/models/commissionInvoice.model');
const Counter = require('../../../src/models/counter.model');
const Seller = require('../../../src/models/seller.model');
const { getBillingSettings } = require('../../../src/services/settings.service');
const service = require('../../../src/services/payments/commission.service');

const sellerId = new Types.ObjectId();
const chain = (value) => ({
  sort: () => chain(value),
  lean: async () => value,
  select: () => chain(value),
});
const commission = (commissionPaise, fromTokenPaise) => ({
  _id: new Types.ObjectId(),
  purchaseId: new Types.ObjectId(),
  productName: 'Honda Activa',
  earnedAt: new Date('2026-10-10T06:00:00Z'),
  pricePaise: 9_500_000,
  commissionPaise,
  fromTokenPaise,
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

const givenSeller = (gstin) => {
  jest.spyOn(CommissionInvoice, 'findOne').mockReturnValue(chain(null));
  jest
    .spyOn(Commission, 'find')
    .mockReturnValue(chain([commission(100_000, 99_900), commission(150_000, 99_900)]));
  jest.spyOn(Seller, 'findById').mockReturnValue(chain({ businessName: 'Pune Motors', gstin }));
  jest.spyOn(Counter, 'nextSequence').mockResolvedValue(7);
  jest
    .spyOn(CommissionInvoice, 'create')
    .mockImplementation(async ([doc]) => [{ ...doc, _id: 'inv1', toObject: () => doc }]);
  jest.spyOn(Commission, 'updateMany').mockResolvedValue({});
};

describe('issueSellerInvoice', () => {
  const period = service.monthPeriod('2026-10');

  it('numbers per financial year and splits CGST/SGST inside Maharashtra', async () => {
    givenSeller('27PQRSX6789K1Z2');
    const invoice = await service.issueSellerInvoice(sellerId, period, await getBillingSettings());
    expect(Counter.nextSequence).toHaveBeenCalledWith('commission-invoice:2026-27', {
      id: 'session',
    });
    expect(invoice.invoiceNo).toBe('SM/2026-27/0007');
    expect(invoice).toMatchObject({
      taxablePaise: 250_000,
      gst: { cgstPaise: 22_500, sgstPaise: 22_500, igstPaise: 0, totalPaise: 45_000 },
      totalPaise: 295_000,
      fromTokensPaise: 199_800,
      balanceDuePaise: 95_200,
    });
    expect(Commission.updateMany.mock.calls[0][1]).toEqual({ $set: { invoiceId: 'inv1' } });
  });

  it('uses IGST for a dealer in another state', async () => {
    givenSeller('29PQRSX6789K1Z2'); // Karnataka
    const invoice = await service.issueSellerInvoice(sellerId, period, await getBillingSettings());
    expect(invoice.gst).toMatchObject({ intraState: false, igstPaise: 45_000, cgstPaise: 0 });
  });

  it('returns the existing invoice instead of billing twice', async () => {
    jest
      .spyOn(CommissionInvoice, 'findOne')
      .mockReturnValue(chain({ invoiceNo: 'SM/2026-27/0001' }));
    const create = jest.spyOn(CommissionInvoice, 'create');
    expect((await service.issueSellerInvoice(sellerId, period, {})).invoiceNo).toBe(
      'SM/2026-27/0001',
    );
    expect(create).not.toHaveBeenCalled();
  });
});

describe('generateMonthlyInvoices', () => {
  it('refuses a month that has not ended', async () => {
    await expect(
      service.generateMonthlyInvoices('2026-11', new Date('2026-11-20T00:00:00Z')),
    ).rejects.toMatchObject({ code: 'MONTH_NOT_OVER' });
  });
});
