/**
 * Admin product management (CAT-2, CAT-3): list, create, edit, images and city prices.
 * Every price change is written to priceHistory (CAT-5). Products are never deleted —
 * switching them off keeps history, groups and offers intact.
 */
const Product = require('../../models/product.model');
const Category = require('../../models/category.model');
const City = require('../../models/city.model');
const ApiError = require('../../utils/ApiError');
const { getPagination, buildPaginationMeta, slugify } = require('../../helpers/genericFunctions');
const uploadService = require('../upload.service');
const { recordPriceChanges } = require('./priceHistory.service');
const { invalidateSearchCache } = require('./productSearch.service');
const { toAdminProduct } = require('./productPresenter');

/** Escape user text for use inside a RegExp. */
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Load a product document.
 * @param {string} productId - Product id
 * @returns {Promise<Object>} Product document
 * @throws {ApiError} 404
 */
const findProductOrThrow = async (productId) => {
  const product = await Product.findById(productId);
  if (!product) throw ApiError.notFound(`Product not found with id: ${productId}`);
  return product;
};

/**
 * List products for the admin console.
 * @param {{ q?: string, categoryId?: string, status?: 'all'|'active'|'inactive'|'review', page?: string, limit?: string }} query
 * @returns {Promise<{ products: Object[], meta: Object }>}
 */
const listAdminProducts = async ({ q, categoryId, status = 'all', page, limit }) => {
  const pagination = getPagination({ page, limit });
  const filter = {};
  if (categoryId) filter.categoryId = categoryId;
  if (status === 'active') filter.active = true;
  if (status === 'inactive') filter.active = false;
  if (status === 'review') filter.needsPriceReview = true;
  if (q?.trim()) {
    const pattern = new RegExp(escapeRegex(q.trim()), 'i');
    filter.$or = [{ brand: pattern }, { model: pattern }, { slug: pattern }];
  }

  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort({ updatedAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    Product.countDocuments(filter),
  ]);
  return { products: products.map(toAdminProduct), meta: buildPaginationMeta(total, pagination) };
};

/** @param {string} productId @returns {Promise<Object>} Admin product */
const getAdminProduct = async (productId) => toAdminProduct(await findProductOrThrow(productId));

/**
 * Validate references in product input: leaf category, known cities, known variants.
 * @param {Object} input - Product fields (validated shape)
 * @param {Object[]} variants - Final variants (with keys)
 * @returns {Promise<void>}
 * @throws {ApiError} 422
 */
const assertProductReferences = async (input, variants) => {
  if (input.categoryId) {
    const category = await Category.findById(input.categoryId).lean();
    if (!category) throw new ApiError(422, 'Category not found', { code: 'INVALID_CATEGORY' });
    const hasChildren = await Category.exists({ parentId: category._id });
    if (hasChildren) {
      throw new ApiError(422, 'Pick a sub-category (e.g. Two-wheelers, not Vehicles)', {
        code: 'INVALID_CATEGORY',
      });
    }
  }

  if (input.prices) {
    const cityIds = [...new Set(input.prices.map((price) => String(price.cityId)))];
    const found = await City.countDocuments({ _id: { $in: cityIds } });
    if (found !== cityIds.length)
      throw new ApiError(422, 'Unknown city in prices', { code: 'INVALID_CITY' });

    const variantKeys = new Set(variants.map((variant) => variant.key));
    const unknown = input.prices.find(
      (price) => price.variantKey && !variantKeys.has(price.variantKey),
    );
    if (unknown) {
      throw new ApiError(422, `Price for unknown variant "${unknown.variantKey}"`, {
        code: 'INVALID_VARIANT',
      });
    }
    const keys = input.prices.map((price) => `${price.cityId}:${price.variantKey ?? ''}`);
    if (new Set(keys).size !== keys.length) {
      throw new ApiError(422, 'The same city and variant has two prices', {
        code: 'DUPLICATE_PRICE',
      });
    }
  }
};

/**
 * Turn variant input into stored variants (key = slug of the name, unless given).
 * @param {{ key?: string, name: string, attrs?: Object }[]} variants
 * @returns {Object[]} Variants with unique keys
 * @throws {ApiError} 422 for duplicate variant names
 */
const normaliseVariants = (variants = []) => {
  const result = variants.map((variant) => ({
    key: variant.key || slugify(variant.name),
    name: variant.name,
    attrs: variant.attrs || {},
  }));
  const keys = result.map((variant) => variant.key);
  if (new Set(keys).size !== keys.length) {
    throw new ApiError(422, 'Two variants have the same name', { code: 'DUPLICATE_VARIANT' });
  }
  return result;
};

/**
 * Apply validated input to a product document and save it, recording price history.
 * @param {Object} product - Product document (new or existing)
 * @param {Object} input - Validated fields
 * @param {string} staffUserId - Who made the change
 * @returns {Promise<Object>} Admin product
 */
const applyAndSave = async (product, input, staffUserId) => {
  const variants = input.variants ? normaliseVariants(input.variants) : product.variants;
  await assertProductReferences(input, variants);

  const oldPrices = (product.priceByCity || []).map((entry) => entry.toObject?.() ?? entry);

  if (input.categoryId) product.categoryId = input.categoryId;
  if (input.brand !== undefined) product.brand = input.brand;
  if (input.model !== undefined) product.model = input.model;
  if (input.brand !== undefined || input.model !== undefined) {
    product.slug = slugify(`${product.brand} ${product.model}`);
  }
  if (input.description !== undefined) product.description = input.description;
  if (input.tags !== undefined)
    product.tags = [...new Set(input.tags.map((tag) => tag.toLowerCase()))];
  if (input.specs !== undefined) product.specs = input.specs;
  if (input.variants !== undefined) product.variants = variants;
  if (input.prices !== undefined) {
    const now = new Date();
    product.priceByCity = input.prices.map((price) => ({
      ...price,
      variantKey: price.variantKey ?? null,
      updatedAt: now,
    }));
  }
  if (input.active !== undefined) {
    product.active = input.active;
    // Switching a product on is the staff member confirming its prices
    if (input.active) product.needsPriceReview = false;
  }

  try {
    await product.save();
  } catch (err) {
    if (err?.code === 11000) {
      throw ApiError.conflict(
        `A product called "${product.brand} ${product.model}" already exists`,
        {
          code: 'PRODUCT_EXISTS',
        },
      );
    }
    throw err;
  }

  if (input.prices !== undefined) {
    await recordPriceChanges({
      productId: product._id,
      oldPrices,
      newPrices: product.priceByCity.map((entry) => entry.toObject()),
      source: 'admin',
      changedBy: staffUserId,
    });
  }
  invalidateSearchCache();
  return toAdminProduct(product);
};

/**
 * Create a product (starts inactive unless `active: true` is sent).
 * @param {Object} input - Validated fields
 * @param {string} staffUserId - Creator
 * @returns {Promise<Object>} Admin product
 */
const createProduct = (input, staffUserId) =>
  applyAndSave(new Product({ active: false }), input, staffUserId);

/**
 * Edit a product.
 * @param {string} productId - Product id
 * @param {Object} input - Validated fields to change
 * @param {string} staffUserId - Editor
 * @returns {Promise<Object>} Admin product
 */
const updateProduct = async (productId, input, staffUserId) =>
  applyAndSave(await findProductOrThrow(productId), input, staffUserId);

/** @param {string} productId @returns Signed Cloudinary params for a new product image */
const getImageUploadParams = async (productId) => {
  await findProductOrThrow(productId);
  return uploadService.createProductImageUploadParams(productId);
};

/**
 * Attach a verified uploaded image to a product (max 10 images).
 * @param {string} productId - Product id
 * @param {{ publicId: string, version: number, signature: string }} upload - Cloudinary response
 * @returns {Promise<Object>} Admin product
 */
const addProductImage = async (productId, upload) => {
  const product = await findProductOrThrow(productId);
  if (product.images.length >= 10) {
    throw new ApiError(422, 'A product can have at most 10 images', { code: 'TOO_MANY_IMAGES' });
  }
  const image = uploadService.verifyProductImageUpload(productId, upload);
  if (!product.images.some((existing) => existing.publicId === image.publicId))
    product.images.push(image);
  await product.save();
  return toAdminProduct(product);
};

/**
 * Remove an image from a product (and from Cloudinary if we stored it there).
 * @param {string} productId - Product id
 * @param {string} imageUrl - URL of the image to remove
 * @returns {Promise<Object>} Admin product
 */
const removeProductImage = async (productId, imageUrl) => {
  const product = await findProductOrThrow(productId);
  const image = product.images.find((existing) => existing.url === imageUrl);
  if (!image) throw ApiError.notFound('Image not found on this product');
  product.images = product.images.filter((existing) => existing.url !== imageUrl);
  await product.save();
  await uploadService.deleteImage(image.publicId);
  return toAdminProduct(product);
};

module.exports = {
  listAdminProducts,
  getAdminProduct,
  createProduct,
  updateProduct,
  getImageUploadParams,
  addProductImage,
  removeProductImage,
  normaliseVariants,
};
