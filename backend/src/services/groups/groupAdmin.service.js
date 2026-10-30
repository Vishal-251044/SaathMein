/**
 * Admin Groups (PRD §10.11 Groups, read-only on Day 6): search and filter every group by
 * city, category, status, visibility and created date, with CSV export (MON-1).
 * Extend / cancel / feature actions arrive with the full console on Day 13.
 */
const Group = require('../../models/group.model');
const Product = require('../../models/product.model');
const { getPagination, buildPaginationMeta } = require('../../helpers/genericFunctions');
const { toCsv } = require('../../utils/csv');
const { toAdminGroup } = require('./groupPresenter');

const CSV_LIMIT = 5000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Escape text for a RegExp. */
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Mongo filter from the admin query.
 * @param {Object} query - Validated query
 * @returns {Promise<Object>}
 */
const buildFilter = async ({ cityId, categoryId, status, visibility, from, to, q }) => {
  const filter = {};
  if (cityId) filter.cityId = cityId;
  if (categoryId) filter.categoryId = categoryId;
  if (status) filter.status = status;
  if (visibility) filter.visibility = visibility;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(`${from}T00:00:00+05:30`);
    if (to) filter.createdAt.$lt = new Date(new Date(`${to}T00:00:00+05:30`).getTime() + DAY_MS);
  }
  if (q?.trim()) {
    const text = q.trim();
    if (/^[A-Z0-9]{6,12}$/i.test(text)) {
      filter.$or = [{ inviteCode: text.toUpperCase() }];
    }
    const pattern = new RegExp(escapeRegex(text), 'i');
    const products = await Product.find({ $or: [{ brand: pattern }, { model: pattern }] })
      .select('_id')
      .limit(200)
      .lean();
    filter.$or = [...(filter.$or || []), { productId: { $in: products.map((p) => p._id) } }];
  }
  return filter;
};

/** Populated query for admin rows. */
const findRows = (filter) =>
  Group.find(filter)
    .sort({ createdAt: -1 })
    .populate('productId', 'brand model')
    .populate('cityId', 'name')
    .populate('leaderId', 'name');

/**
 * @param {Object} query - Validated admin query
 * @returns {Promise<{ groups: Object[], meta: Object }>}
 */
const listAdminGroups = async (query) => {
  const pagination = getPagination(query);
  const filter = await buildFilter(query);
  const [groups, total] = await Promise.all([
    findRows(filter).skip(pagination.skip).limit(pagination.limit).lean(),
    Group.countDocuments(filter),
  ]);
  return { groups: groups.map(toAdminGroup), meta: buildPaginationMeta(total, pagination) };
};

/**
 * CSV of the filtered groups (up to 5,000 rows). Money in rupees for spreadsheets.
 * @param {Object} query - Validated admin query
 * @returns {Promise<string>} CSV text
 */
const exportAdminGroupsCsv = async (query) => {
  const groups = (
    await findRows(await buildFilter(query))
      .limit(CSV_LIMIT)
      .lean()
  ).map(toAdminGroup);
  const header = [
    'Group ID',
    'Status',
    'Type',
    'Visibility',
    'Product',
    'City',
    'Leader',
    'Members',
    'Target',
    'Token (INR)',
    'Deadline',
    'Extended',
    'Invite code',
    'Created',
  ];
  return toCsv([
    header,
    ...groups.map((group) => [
      group.id,
      group.status,
      group.type,
      group.visibility,
      group.productName,
      group.cityName,
      group.leaderName,
      group.memberCount,
      group.targetSize,
      (group.tokenAmountPaise / 100).toFixed(2),
      group.deadline?.toISOString(),
      group.deadlineExtended ? 'yes' : 'no',
      group.inviteCode,
      group.createdAt?.toISOString(),
    ]),
  ]);
};

module.exports = { listAdminGroups, exportAdminGroupsCsv };
