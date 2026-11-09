/**
 * Commission records and monthly GST invoices (F17, PRD §05, §11 money step 4).
 * - A commission is earned when a purchase completes: the category rule applied to the
 *   purchase price; part was already kept from the buyer's token (Route transfer), the rest
 *   is billed on the dealer's monthly invoice.
 * - Monthly invoice per dealer: numbered per financial year (SM/2026-27/0001), GST on the
 *   commission (CGST + SGST inside the state, IGST across states), rate from settings.
 * Money is integer paise throughout.
 */
const Commission = require('../../models/commission.model');
const CommissionInvoice = require('../../models/commissionInvoice.model');
const Counter = require('../../models/counter.model');
const Seller = require('../../models/seller.model');
const ApiError = require('../../utils/ApiError');
const { createLogger } = require('../../utils/logger');
const { withTransaction } = require('../../utils/transaction');
const { getPagination, buildPaginationMeta } = require('../../helpers/genericFunctions');
const { getBillingSettings } = require('../settings.service');
const { splitToken } = require('./commission');

const log = createLogger('CommissionService');
const IST_OFFSET_MS = 330 * 60 * 1000;
const BPS = 10_000;

/* --------------------------------- Pure math -------------------------------- */

/**
 * GST on a taxable amount (paise). Inside the supplier's state: half CGST + half SGST,
 * each rounded; across states: IGST.
 * @param {number} taxablePaise
 * @param {number} rateBps - e.g. 1800 = 18%
 * @param {boolean} intraState
 * @returns {{ rateBps: number, intraState: boolean, cgstPaise: number, sgstPaise: number, igstPaise: number, totalPaise: number }}
 */
const gstBreakdown = (taxablePaise, rateBps, intraState) => {
  if (intraState) {
    const half = Math.round((taxablePaise * rateBps) / 2 / BPS);
    return {
      rateBps,
      intraState,
      cgstPaise: half,
      sgstPaise: half,
      igstPaise: 0,
      totalPaise: half * 2,
    };
  }
  const igst = Math.round((taxablePaise * rateBps) / BPS);
  return { rateBps, intraState, cgstPaise: 0, sgstPaise: 0, igstPaise: igst, totalPaise: igst };
};

/**
 * Indian financial year label (April–March, IST), e.g. 2026-27.
 * @param {Date} date
 * @returns {string}
 */
const financialYear = (date) => {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const year = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
};

/**
 * IST calendar month boundaries.
 * @param {string} key - "YYYY-MM"
 * @returns {{ key: string, from: Date, to: Date }} [from, to)
 */
const monthPeriod = (key) => {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) {
    throw ApiError.badRequest('Month must look like 2026-10', { code: 'INVALID_MONTH' });
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  return {
    key,
    from: new Date(Date.UTC(year, month, 1) - IST_OFFSET_MS),
    to: new Date(Date.UTC(year, month + 1, 1) - IST_OFFSET_MS),
  };
};

/**
 * Previous IST month key, e.g. on 1 Nov 2026 → "2026-10".
 * @param {Date} now
 * @returns {string}
 */
const previousMonthKey = (now) => {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const date = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() - 1, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

/** First two digits of a GSTIN are the state code. */
const stateOf = (gstin, fallback) => (gstin && /^\d{2}/.test(gstin) ? gstin.slice(0, 2) : fallback);

/**
 * Invoice totals from its lines (pure, for tests).
 * @param {{ commissionPaise: number, fromTokenPaise: number }[]} lines
 * @param {number} rateBps
 * @param {boolean} intraState
 */
const invoiceTotals = (lines, rateBps, intraState) => {
  const taxablePaise = lines.reduce((sum, line) => sum + line.commissionPaise, 0);
  const fromTokensPaise = lines.reduce((sum, line) => sum + line.fromTokenPaise, 0);
  const gst = gstBreakdown(taxablePaise, rateBps, intraState);
  const totalPaise = taxablePaise + gst.totalPaise;
  return {
    taxablePaise,
    gst,
    totalPaise,
    fromTokensPaise,
    balanceDuePaise: Math.max(0, totalPaise - fromTokensPaise),
  };
};

/* ---------------------------- Commission per sale ---------------------------- */

/**
 * Record the commission of a completed purchase (idempotent per purchase).
 * @param {Object} purchase - Completed purchase (lean)
 * @param {{ group: Object, category: Object, payment: Object|null, productName: string }} context
 * @param {import('mongoose').ClientSession} [session]
 * @returns {Promise<void>}
 */
const recordCommission = async (purchase, { group, category, payment, productName }, session) => {
  const rule = category?.commission || { type: 'percent', value: 0 };
  const split = splitToken({
    tokenPaise: purchase.tokenPaise || 0,
    pricePerUnitPaise: purchase.pricePaise,
    rule,
  });
  // What was really kept from the token when the transfer was created
  const fromTokenPaise = payment?.transfer?.commissionPaise ?? split.fromTokenPaise;
  await Commission.updateOne(
    { purchaseId: purchase._id },
    {
      $setOnInsert: {
        purchaseId: purchase._id,
        sellerId: purchase.sellerId,
        groupId: purchase.groupId,
        categoryId: group.categoryId,
        cityId: group.cityId,
        productName,
        rule: { type: rule.type, value: rule.value },
        pricePaise: purchase.pricePaise,
        commissionPaise: split.commissionPaise,
        fromTokenPaise: Math.min(fromTokenPaise, split.commissionPaise),
        invoicedPaise: Math.max(0, split.commissionPaise - fromTokenPaise),
        earnedAt: purchase.completedAt || new Date(),
      },
    },
    { upsert: true, session },
  );
};

/* ------------------------------ Monthly invoices ----------------------------- */

/**
 * Issue one dealer's invoice for a month (idempotent: one invoice per dealer and month).
 * @param {string} sellerId
 * @param {{ key: string, from: Date, to: Date }} period
 * @param {Object} billing - Billing settings
 * @returns {Promise<Object|null>} The invoice, or null when nothing to bill
 */
const issueSellerInvoice = async (sellerId, period, billing) => {
  const existing = await CommissionInvoice.findOne({ sellerId, 'period.key': period.key }).lean();
  if (existing) return existing;
  const [commissions, seller] = await Promise.all([
    Commission.find({
      sellerId,
      invoiceId: { $exists: false },
      earnedAt: { $gte: period.from, $lt: period.to },
    })
      .sort({ earnedAt: 1 })
      .lean(),
    Seller.findById(sellerId).select('businessName gstin address').lean(),
  ]);
  if (!commissions.length) return null;

  const supplierState = stateOf(billing.gstin, billing.stateCode);
  const recipientState = stateOf(seller?.gstin, null);
  const intraState = !recipientState || recipientState === supplierState;
  const lines = commissions.map((commission) => ({
    commissionId: commission._id,
    purchaseId: commission.purchaseId,
    productName: commission.productName,
    completedAt: commission.earnedAt,
    pricePaise: commission.pricePaise,
    commissionPaise: commission.commissionPaise,
    fromTokenPaise: commission.fromTokenPaise,
  }));
  const totals = invoiceTotals(lines, billing.gstRateBps, intraState);

  return withTransaction(async (session) => {
    // Financial year of the billed month (its last moment)
    const fy = financialYear(new Date(period.to.getTime() - 1));
    const seq = await Counter.nextSequence(`commission-invoice:${fy}`, session);
    const invoiceNo = `${billing.invoicePrefix}/${fy}/${String(seq).padStart(4, '0')}`;
    const [invoice] = await CommissionInvoice.create(
      [
        {
          invoiceNo,
          sellerId,
          period,
          supplier: {
            legalName: billing.legalName,
            gstin: billing.gstin,
            address: billing.address,
            stateCode: supplierState,
            sacCode: billing.sacCode,
          },
          recipient: {
            businessName: seller?.businessName,
            gstin: seller?.gstin,
            address: [seller?.address?.line1, seller?.address?.area, seller?.address?.pincode]
              .filter(Boolean)
              .join(', '),
            stateCode: recipientState,
          },
          lines,
          ...totals,
        },
      ],
      { session },
    );
    await Commission.updateMany(
      { _id: { $in: commissions.map((commission) => commission._id) } },
      { $set: { invoiceId: invoice._id } },
      { session },
    );
    log.info(
      { sellerId: String(sellerId), invoiceNo, totalPaise: totals.totalPaise },
      'Commission invoice issued',
    );
    return invoice.toObject();
  });
};

/**
 * Issue every dealer's invoice for a month (job on the 1st, or Finance from the console).
 * @param {string} [periodKey] - "YYYY-MM"; default: the previous IST month
 * @param {Date} [now]
 * @returns {Promise<{ period: string, issued: number, failed: number }>}
 */
const generateMonthlyInvoices = async (periodKey, now = new Date()) => {
  const period = monthPeriod(periodKey || previousMonthKey(now));
  if (period.to > now) {
    throw ApiError.badRequest('Invoices can be issued only after the month ends', {
      code: 'MONTH_NOT_OVER',
    });
  }
  const billing = await getBillingSettings();
  const sellerIds = await Commission.distinct('sellerId', {
    invoiceId: { $exists: false },
    earnedAt: { $gte: period.from, $lt: period.to },
  });
  let issued = 0;
  let failed = 0;
  for (const sellerId of sellerIds) {
    try {
      if (await issueSellerInvoice(sellerId, period, billing)) issued += 1;
    } catch (err) {
      failed += 1;
      log.error(
        { err: err.message, sellerId: String(sellerId), period: period.key },
        '[CommissionService] invoice failed',
      );
    }
  }
  return { period: period.key, issued, failed };
};

/* --------------------------------- Reading ---------------------------------- */

/** Invoice for screens and printing. */
const toInvoiceView = (invoice) => ({
  id: String(invoice._id),
  invoiceNo: invoice.invoiceNo,
  period: invoice.period,
  issuedAt: invoice.issuedAt,
  supplier: invoice.supplier,
  recipient: invoice.recipient,
  lines: invoice.lines.map((line) => ({
    productName: line.productName,
    completedAt: line.completedAt,
    pricePaise: line.pricePaise,
    commissionPaise: line.commissionPaise,
    fromTokenPaise: line.fromTokenPaise,
  })),
  taxablePaise: invoice.taxablePaise,
  gst: invoice.gst,
  totalPaise: invoice.totalPaise,
  fromTokensPaise: invoice.fromTokensPaise,
  balanceDuePaise: invoice.balanceDuePaise,
  status: invoice.status,
  paidAt: invoice.paidAt || null,
  sellerId: String(invoice.sellerId),
});

/**
 * One invoice. Dealers only see their own.
 * @param {string} invoiceId
 * @param {{ sellerId?: string }} [scope]
 */
const getInvoice = async (invoiceId, { sellerId } = {}) => {
  const invoice = await CommissionInvoice.findOne({
    _id: invoiceId,
    ...(sellerId ? { sellerId } : {}),
  }).lean();
  if (!invoice) throw ApiError.notFound('Invoice not found');
  return toInvoiceView(invoice);
};

/**
 * Invoices list (dealer: own; admin: filter by month / dealer).
 * @param {{ sellerId?: string, month?: string, page?: string, limit?: string }} query
 */
const listInvoices = async ({ sellerId, month, ...query }) => {
  const pagination = getPagination(query);
  const filter = { ...(sellerId ? { sellerId } : {}), ...(month ? { 'period.key': month } : {}) };
  const [invoices, total] = await Promise.all([
    CommissionInvoice.find(filter)
      .sort({ issuedAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    CommissionInvoice.countDocuments(filter),
  ]);
  return { invoices: invoices.map(toInvoiceView), meta: buildPaginationMeta(total, pagination) };
};

/**
 * Mongo filter for the admin commission list (city, category, dealer, dates — MON-1).
 * @param {{ cityId?: string, categoryId?: string, sellerId?: string, from?: string, to?: string }} query
 */
const commissionFilter = ({ cityId, categoryId, sellerId, from, to }) => ({
  ...(cityId ? { cityId } : {}),
  ...(categoryId ? { categoryId } : {}),
  ...(sellerId ? { sellerId } : {}),
  ...(from || to
    ? {
        earnedAt: {
          ...(from ? { $gte: new Date(from) } : {}),
          ...(to ? { $lte: new Date(to) } : {}),
        },
      }
    : {}),
});

/**
 * Admin Commissions page: rows + totals.
 * @param {Object} query - Filters + page
 */
const listCommissions = async (query) => {
  const pagination = getPagination(query);
  const filter = commissionFilter(query);
  const [rows, total, sums] = await Promise.all([
    Commission.find(filter)
      .sort({ earnedAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .populate('sellerId', 'businessName')
      .lean(),
    Commission.countDocuments(filter),
    Commission.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          commissionPaise: { $sum: '$commissionPaise' },
          fromTokenPaise: { $sum: '$fromTokenPaise' },
          invoicedPaise: { $sum: '$invoicedPaise' },
          gmvPaise: { $sum: '$pricePaise' },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);
  return {
    commissions: rows.map(toCommissionRow),
    totals: sums[0]
      ? { ...sums[0], _id: undefined }
      : { commissionPaise: 0, fromTokenPaise: 0, invoicedPaise: 0, gmvPaise: 0, count: 0 },
    meta: buildPaginationMeta(total, pagination),
  };
};

/** Admin row. */
const toCommissionRow = (row) => ({
  id: String(row._id),
  earnedAt: row.earnedAt,
  sellerName: row.sellerId?.businessName || null,
  sellerId: String(row.sellerId?._id || row.sellerId),
  productName: row.productName,
  pricePaise: row.pricePaise,
  rule: row.rule,
  commissionPaise: row.commissionPaise,
  fromTokenPaise: row.fromTokenPaise,
  invoicedPaise: row.invoicedPaise,
  invoiced: Boolean(row.invoiceId),
});

/**
 * CSV rows for export (MON-1), at most 5,000.
 * @param {Object} query - Filters
 * @returns {Promise<string[][]>}
 */
const commissionCsvRows = async (query) => {
  const rows = await Commission.find(commissionFilter(query))
    .sort({ earnedAt: -1 })
    .limit(5000)
    .populate('sellerId', 'businessName')
    .lean();
  const rupees = (paise) => (paise / 100).toFixed(2);
  return [
    [
      'Date',
      'Dealer',
      'Product',
      'Price (INR)',
      'Rule',
      'Commission (INR)',
      'From token (INR)',
      'To invoice (INR)',
      'Invoiced',
    ],
    ...rows.map((row) => {
      const view = toCommissionRow(row);
      return [
        view.earnedAt.toISOString(),
        view.sellerName || '',
        view.productName || '',
        rupees(view.pricePaise),
        view.rule?.type === 'flat'
          ? `flat ${rupees(view.rule.value)}`
          : `${(view.rule?.value || 0) / 100}%`,
        rupees(view.commissionPaise),
        rupees(view.fromTokenPaise),
        rupees(view.invoicedPaise),
        view.invoiced ? 'yes' : 'no',
      ];
    }),
  ];
};

module.exports = {
  gstBreakdown,
  financialYear,
  monthPeriod,
  previousMonthKey,
  invoiceTotals,
  recordCommission,
  issueSellerInvoice,
  generateMonthlyInvoices,
  getInvoice,
  listInvoices,
  listCommissions,
  commissionCsvRows,
};
