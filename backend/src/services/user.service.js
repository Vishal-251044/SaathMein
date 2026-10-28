/**
 * User service — user lookups and the public shapes of a user returned by the API.
 * Never return a raw user document: it can contain secrets (password hash, 2FA data).
 */
const User = require('../models/user.model');
const ApiError = require('../utils/ApiError');
const { APP_ROLE } = require('../constants/enums');

/**
 * Shape a user for the buyer app / dealer dashboard (the user's own profile).
 * @param {Object} user - User document
 * @returns {Object} Safe public profile
 */
const toAppUser = (user) => {
  const interests = user.interests || {};
  return {
    id: String(user._id),
    name: user.name || null,
    phone: user.phone || null,
    email: user.email || null,
    avatar: user.avatar?.url ? { url: user.avatar.url } : null,
    cityId: user.cityId ? String(user.cityId) : null,
    area: user.area || null,
    pincode: user.pincode || null,
    language: user.language,
    interests: {
      categories: (interests.categories || []).map(String),
      products: (interests.products || []).map(String),
      brands: interests.brands || [],
      budgetMinPaise: interests.budgetMinPaise ?? null,
      budgetMaxPaise: interests.budgetMaxPaise ?? null,
      timeline: interests.timeline || null,
    },
    onboardingCompletedAt: user.onboardingCompletedAt || null,
    walletBalancePaise: user.walletBalancePaise ?? 0,
    createdAt: user.createdAt,
  };
};

/**
 * Shape a staff user for the admin console.
 * @param {Object} user - User document with staffRole
 * @returns {Object} Safe staff profile
 */
const toStaffUser = (user) => ({
  id: String(user._id),
  name: user.name || null,
  email: user.email,
  role: user.staffRole,
  twoFactorEnabled: Boolean(user.twoFactorEnabled),
  lastLoginAt: user.lastLoginAt || null,
});

/**
 * App roles for a user (PRD §8.2). Everyone is a buyer; "seller" is added on Day 5 when
 * seller membership exists.
 * @param {Object} _user - User document
 * @returns {string[]} Roles for the access token
 */
const getAppRoles = (_user) => [APP_ROLE.BUYER];

/**
 * Load a user by id.
 * @param {string} userId - User id
 * @returns {Promise<Object>} User document
 * @throws {ApiError} 404 if not found
 */
const getUserById = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound(`User not found with id: ${userId}`);
  return user;
};

module.exports = { toAppUser, toStaffUser, getAppRoles, getUserById };
