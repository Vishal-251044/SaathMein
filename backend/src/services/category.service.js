/**
 * Category service — the public category tree used by onboarding and browsing.
 * Admin editing of categories and rules comes on Day 4 (catalog).
 */
const Category = require('../models/category.model');
const ApiError = require('../utils/ApiError');

/**
 * Public shape of a category. Only buyer-facing rules are exposed (no commission).
 * @param {Object} category - Category document
 * @returns {Object} Category for the apps
 */
const toPublicCategory = (category) => ({
  id: String(category._id),
  name: category.name,
  nameTranslations: category.nameTranslations || {},
  slug: category.slug,
  icon: category.icon || null,
  parentId: category.parentId ? String(category.parentId) : null,
  featuredBrands: category.featuredBrands || [],
  rules: {
    minSize: category.rules?.minSize,
    maxSize: category.rules?.maxSize,
    tokenAmountPaise: category.rules?.tokenAmountPaise,
  },
});

/**
 * Active categories as a tree: top-level categories with their active children.
 * @returns {Promise<Object[]>} [{ ...parent, children: [...] }]
 */
const getActiveCategoryTree = async () => {
  const categories = await Category.find({ active: true }).sort({ order: 1, name: 1 }).lean();
  const byParent = new Map();
  categories.forEach((category) => {
    const key = category.parentId ? String(category.parentId) : 'root';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(toPublicCategory(category));
  });

  return (byParent.get('root') || [])
    .map((parent) => ({ ...parent, children: byParent.get(parent.id) || [] }))
    .filter((parent) => parent.children.length > 0);
};

/**
 * Check that every id is an active category.
 * @param {string[]} categoryIds - Ids from a request
 * @returns {Promise<Object[]>} The matching categories (lean)
 * @throws {ApiError} 422 INVALID_CATEGORY when any id is unknown or inactive
 */
const assertActiveCategories = async (categoryIds) => {
  const unique = [...new Set(categoryIds.map(String))];
  if (unique.length === 0) return [];
  const found = await Category.find({ _id: { $in: unique }, active: true }).lean();
  if (found.length !== unique.length) {
    throw new ApiError(422, 'One of the chosen categories is not available', {
      code: 'INVALID_CATEGORY',
    });
  }
  return found;
};

module.exports = { toPublicCategory, getActiveCategoryTree, assertActiveCategories };
