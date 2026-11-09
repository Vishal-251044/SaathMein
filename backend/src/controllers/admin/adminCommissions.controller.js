/**
 * Admin Commissions — /api/admin/commissions, /api/admin/commission-invoices (PRD §10.11).
 * Owner, Admin, Finance. Filters by city, category, dealer and dates; CSV export (MON-1).
 */
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/ApiResponse');
const { toCsv } = require('../../utils/csv');
const commissionService = require('../../services/payments/commission.service');

/** GET /api/admin/commissions?cityId=&categoryId=&sellerId=&from=&to=&format=csv */
const listCommissions = asyncHandler(async (req, res) => {
  if (req.validatedQuery.format === 'csv') {
    const rows = await commissionService.commissionCsvRows(req.validatedQuery);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="saathmein-commissions.csv"');
    return res.send(toCsv(rows));
  }
  const { commissions, totals, meta } = await commissionService.listCommissions(req.validatedQuery);
  return sendSuccess(res, { message: 'Commissions fetched', data: { commissions, totals }, meta });
});

/** GET /api/admin/commission-invoices?month=&sellerId= */
const listInvoices = asyncHandler(async (req, res) => {
  const { invoices, meta } = await commissionService.listInvoices(req.validatedQuery);
  return sendSuccess(res, { message: 'Invoices fetched', data: { invoices }, meta });
});

/** GET /api/admin/commission-invoices/:invoiceId */
const getInvoice = asyncHandler(async (req, res) => {
  const invoice = await commissionService.getInvoice(req.params.invoiceId);
  return sendSuccess(res, { message: 'Invoice fetched', data: { invoice } });
});

/** POST /api/admin/commission-invoices/generate { month } — issue a finished month now */
const generateInvoices = asyncHandler(async (req, res) => {
  const result = await commissionService.generateMonthlyInvoices(req.body.month);
  return sendSuccess(res, { message: `${result.issued} invoices issued`, data: result });
});

module.exports = { listCommissions, listInvoices, getInvoice, generateInvoices };
