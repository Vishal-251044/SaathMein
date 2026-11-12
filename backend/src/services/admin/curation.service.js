/**
 * Admin → Curation (F34, PRD §10.11): home banners and featured group deals (per city or
 * every city, ordered, optional dates for festival campaigns) and the category order.
 * Banner links are in-app paths only (never outside URLs) so a banner cannot send buyers
 * to a phishing page.
 */
const CurationItem = require('../../models/curationItem.model');
const Category = require('../../models/category.model');
const Group = require('../../models/group.model');
const ApiError = require('../../utils/ApiError');
const { CURATION_TYPE, GROUP_VISIBILITY } = require('../../constants/enums');

/** Admin view of one item. */
const toAdminItem = (item) => ({
  id: String(item._id),
  type: item.type,
  cityId: item.cityId ? String(item.cityId) : null,
  title: item.title || '',
  titleTranslations: item.titleTranslations || {},
  subtitle: item.subtitle || '',
  subtitleTranslations: item.subtitleTranslations || {},
  imageUrl: item.image?.url || null,
  linkPath: item.linkPath || null,
  groupId: item.groupId ? String(item.groupId) : null,
  order: item.order,
  active: item.active,
  startsAt: item.startsAt || null,
  endsAt: item.endsAt || null,
  updatedAt: item.updatedAt,
});

/**
 * Check what an item points to.
 * @param {Object} input - Item fields
 * @throws {ApiError} 422
 */
const assertValidItem = async (input) => {
  if (input.type === CURATION_TYPE.BANNER && !input.title) {
    throw new ApiError(422, 'A banner needs a title', { code: 'INVALID_CURATION' });
  }
  if (input.type === CURATION_TYPE.FEATURED_GROUP) {
    const group = input.groupId
      ? await Group.findById(input.groupId).select('visibility').lean()
      : null;
    if (!group || group.visibility !== GROUP_VISIBILITY.PUBLIC) {
      throw new ApiError(422, 'Pick a public group to feature', { code: 'INVALID_CURATION' });
    }
  }
  if (input.startsAt && input.endsAt && new Date(input.endsAt) <= new Date(input.startsAt)) {
    throw new ApiError(422, 'The end date must be after the start date', {
      code: 'INVALID_CURATION',
    });
  }
};

/** @param {{ type?: string }} query @returns {Promise<Object[]>} */
const listItems = async ({ type } = {}) =>
  (
    await CurationItem.find(type ? { type } : {})
      .sort({ type: 1, order: 1, createdAt: -1 })
      .limit(200)
      .lean()
  ).map(toAdminItem);

/**
 * @param {Object} input - Validated item
 * @param {string} staffId
 * @returns {Promise<Object>}
 */
const createItem = async (input, staffId) => {
  await assertValidItem(input);
  const item = await CurationItem.create({ ...input, updatedBy: staffId });
  return toAdminItem(item.toObject());
};

/**
 * @param {string} itemId
 * @param {Object} changes - Validated partial item
 * @param {string} staffId
 * @returns {Promise<{ before: Object, after: Object }>}
 */
const updateItem = async (itemId, changes, staffId) => {
  const current = await CurationItem.findById(itemId).lean();
  if (!current) throw ApiError.notFound('Curation item not found');
  await assertValidItem({ ...current, ...changes });
  const updated = await CurationItem.findByIdAndUpdate(
    itemId,
    { $set: { ...changes, updatedBy: staffId } },
    { new: true },
  ).lean();
  return { before: toAdminItem(current), after: toAdminItem(updated) };
};

/** @param {string} itemId @returns {Promise<Object>} The removed item */
const deleteItem = async (itemId) => {
  const item = await CurationItem.findByIdAndDelete(itemId).lean();
  if (!item) throw ApiError.notFound('Curation item not found');
  return toAdminItem(item);
};

/**
 * Category order on the home screen and category grid.
 * @param {{ id: string, order: number }[]} order
 * @returns {Promise<number>} Categories updated
 */
const reorderCategories = async (order) => {
  let updated = 0;
  for (const { id, order: position } of order) {
    const result = await Category.updateOne({ _id: id }, { $set: { order: position } });
    updated += result.modifiedCount;
  }
  return updated;
};

module.exports = { toAdminItem, listItems, createItem, updateItem, deleteItem, reorderCategories };
