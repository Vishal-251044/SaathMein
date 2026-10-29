/**
 * Category service — the public category tree (onboarding, browsing) and admin management
 * of categories and their business rules (CAT-1).
 */
const Category = require('../models/category.model');
const ApiError = require('../utils/ApiError');
const { slugify } = require('../helpers/genericFunctions');

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

/* ----------------------------- Admin ----------------------------- */

/**
 * Admin shape of a category: everything, including commission rules.
 * @param {Object} category - Category document
 * @returns {Object} Admin category
 */
const toAdminCategory = (category) => {
  const plain = category.toObject ? category.toObject() : category;
  return {
    id: String(plain._id),
    name: plain.name,
    nameTranslations: plain.nameTranslations || {},
    slug: plain.slug,
    icon: plain.icon || null,
    parentId: plain.parentId ? String(plain.parentId) : null,
    featuredBrands: plain.featuredBrands || [],
    rules: plain.rules,
    order: plain.order,
    active: plain.active,
    updatedAt: plain.updatedAt,
  };
};

/** @returns {Promise<Object[]>} Every category (flat list, parents first) */
const listAdminCategories = async () => {
  const categories = await Category.find().sort({ order: 1, name: 1 }).lean();
  return categories.map(toAdminCategory);
};

/**
 * One category in the admin shape (also the "before" snapshot for the audit log).
 * @param {string} categoryId - Category id
 * @returns {Promise<Object>} Admin category
 * @throws {ApiError} 404
 */
const getAdminCategory = async (categoryId) => {
  const category = await Category.findById(categoryId).lean();
  if (!category) throw ApiError.notFound(`Category not found with id: ${categoryId}`);
  return toAdminCategory(category);
};

/**
 * Check a parent: it must exist and be a top-level category (two levels only).
 * @param {string|null} parentId - Parent id
 * @param {string} [selfId] - Category being edited
 * @throws {ApiError} 422
 */
const assertValidParent = async (parentId, selfId) => {
  if (!parentId) return;
  if (String(parentId) === String(selfId)) {
    throw new ApiError(422, 'A category cannot be its own parent', { code: 'INVALID_PARENT' });
  }
  const parent = await Category.findById(parentId).lean();
  if (!parent || parent.parentId) {
    throw new ApiError(422, 'Parent must be a top-level category', { code: 'INVALID_PARENT' });
  }
  if (selfId && (await Category.exists({ parentId: selfId }))) {
    throw new ApiError(422, 'This category has sub-categories, so it must stay top-level', {
      code: 'INVALID_PARENT',
    });
  }
};

/**
 * Create a category.
 * @param {Object} input - Validated fields (rules in paise / basis points)
 * @returns {Promise<Object>} Admin category
 */
const createCategory = async (input) => {
  await assertValidParent(input.parentId);
  try {
    const category = await Category.create({ ...input, slug: slugify(input.name) });
    return toAdminCategory(category);
  } catch (err) {
    if (err?.code === 11000) {
      throw ApiError.conflict(`A category called "${input.name}" already exists`, {
        code: 'CATEGORY_EXISTS',
      });
    }
    throw err;
  }
};

/**
 * Edit a category, including its business rules (CAT-1).
 * Rules are merged section by section, so sending only `rules.auction` keeps the rest.
 * @param {string} categoryId - Category id
 * @param {Object} changes - Validated fields
 * @returns {Promise<Object>} Admin category
 */
const updateCategory = async (categoryId, changes) => {
  const category = await Category.findById(categoryId);
  if (!category) throw ApiError.notFound(`Category not found with id: ${categoryId}`);
  if (changes.parentId !== undefined) await assertValidParent(changes.parentId, categoryId);

  const { rules, ...fields } = changes;
  category.set(fields);
  if (rules) {
    const current = category.rules?.toObject ? category.rules.toObject() : category.rules || {};
    category.rules = {
      ...current,
      ...rules,
      deadlineDays: { ...current.deadlineDays, ...rules.deadlineDays },
      auction: { ...current.auction, ...rules.auction },
      commission: { ...current.commission, ...rules.commission },
    };
  }
  await category.save();
  return toAdminCategory(category);
};

module.exports = {
  toPublicCategory,
  getActiveCategoryTree,
  assertActiveCategories,
  toAdminCategory,
  listAdminCategories,
  getAdminCategory,
  createCategory,
  updateCategory,
};
