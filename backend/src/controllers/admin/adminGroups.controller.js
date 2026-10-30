/**
 * Admin groups controller — /api/admin/groups (read-only list + CSV export).
 * Owner, Admin, Deal Manager, Support.
 */
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/ApiResponse');
const groupAdmin = require('../../services/groups/groupAdmin.service');

/** GET /api/admin/groups?cityId=&categoryId=&status=&visibility=&from=&to=&q=&format=csv */
const listGroups = asyncHandler(async (req, res) => {
  if (req.validatedQuery.format === 'csv') {
    const csv = await groupAdmin.exportAdminGroupsCsv(req.validatedQuery);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="saathmein-groups.csv"');
    return res.send(csv);
  }
  const { groups, meta } = await groupAdmin.listAdminGroups(req.validatedQuery);
  return sendSuccess(res, { message: 'Groups fetched', data: { groups }, meta });
});

module.exports = { listGroups };
