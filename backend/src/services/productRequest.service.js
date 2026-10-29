/**
 * Product requests — "Request a missing product" from buyers and dealers (CAT-3).
 * Deal Managers see the list in the admin console and add products to the catalog.
 */
const ProductRequest = require('../models/productRequest.model');
const Category = require('../models/category.model');
const ApiError = require('../utils/ApiError');
const { assertWithinLimit } = require('./rateLimit.service');
const { getPagination, buildPaginationMeta } = require('../helpers/genericFunctions');

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Public/admin shape of a request.
 * @param {Object} request - ProductRequest (lean)
 * @returns {Object}
 */
const toProductRequest = (request) => ({
  id: String(request._id),
  brand: request.brand,
  model: request.model,
  note: request.note || null,
  categoryId: request.categoryId ? String(request.categoryId) : null,
  cityId: request.cityId ? String(request.cityId) : null,
  fromDealer: Boolean(request.sellerId),
  status: request.status,
  createdAt: request.createdAt,
});

/**
 * Create a request (10 per user per day).
 * @param {{ userId: string, sellerId?: string, cityId?: string }} requester
 * @param {{ brand: string, model: string, categoryId?: string, note?: string }} input
 * @returns {Promise<Object>} Created request
 */
const createProductRequest = async ({ userId, sellerId, cityId }, input) => {
  await assertWithinLimit({
    key: `product-request:${userId}`,
    limit: 10,
    windowMs: DAY_MS,
    message: 'You have sent many requests today. Please try again tomorrow.',
  });
  if (input.categoryId && !(await Category.exists({ _id: input.categoryId }))) {
    throw new ApiError(422, 'Pick a category from the list', { code: 'INVALID_CATEGORY' });
  }
  const request = await ProductRequest.create({ ...input, userId, sellerId, cityId });
  return toProductRequest(request.toObject());
};

/**
 * Requests for the admin console, newest first.
 * @param {{ status?: string, page?: string, limit?: string }} query
 * @returns {Promise<{ requests: Object[], meta: Object }>}
 */
const listProductRequests = async ({ status = 'open', page, limit }) => {
  const pagination = getPagination({ page, limit });
  const filter = status === 'all' ? {} : { status };
  const [requests, total] = await Promise.all([
    ProductRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    ProductRequest.countDocuments(filter),
  ]);
  return { requests: requests.map(toProductRequest), meta: buildPaginationMeta(total, pagination) };
};

/**
 * Mark a request as added or rejected.
 * @param {string} requestId - Request id
 * @param {{ status: 'added'|'rejected'|'open', productId?: string }} changes
 * @param {string} staffUserId - Who handled it
 * @returns {Promise<{ request: Object, before: Object }>}
 */
const updateProductRequest = async (requestId, { status, productId }, staffUserId) => {
  const request = await ProductRequest.findById(requestId);
  if (!request) throw ApiError.notFound('Request not found');
  const before = { status: request.status };
  request.status = status;
  if (productId) request.productId = productId;
  request.handledBy = staffUserId;
  request.handledAt = new Date();
  await request.save();
  return { request: toProductRequest(request.toObject()), before };
};

module.exports = { createProductRequest, listProductRequests, updateProductRequest };
