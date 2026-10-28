/**
 * User controller — /api/users/me (the logged-in user's own profile).
 */
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const profileService = require('../services/profile.service');
const { toAppUser } = require('../services/user.service');

/** GET /api/users/me */
const getMe = asyncHandler(async (req, res) => {
  const user = await profileService.getActiveUser(req.auth.userId);
  return sendSuccess(res, { message: 'Profile fetched', data: { user: toAppUser(user) } });
});

/** PATCH /api/users/me — name, language, city, area, pincode (ACC-2). */
const updateMe = asyncHandler(async (req, res) => {
  const user = await profileService.updateProfile(req.auth.userId, req.body);
  return sendSuccess(res, { message: 'Profile updated', data: { user } });
});

/** POST /api/users/me/interests — onboarding interests (ACC-3). Empty lists = skip. */
const saveInterests = asyncHandler(async (req, res) => {
  const user = await profileService.saveInterests(req.auth.userId, req.body);
  return sendSuccess(res, { message: 'Interests saved', data: { user } });
});

/** POST /api/users/me/avatar/upload-params — signed Cloudinary upload parameters. */
const getAvatarUploadParams = asyncHandler(async (req, res) => {
  const data = await profileService.getAvatarUploadParams(req.auth.userId);
  return sendSuccess(res, { message: 'Upload authorised', data });
});

/** PUT /api/users/me/avatar — attach a verified upload. */
const setAvatar = asyncHandler(async (req, res) => {
  const user = await profileService.setAvatar(req.auth.userId, req.body);
  return sendSuccess(res, { message: 'Photo updated', data: { user } });
});

/** DELETE /api/users/me/avatar */
const removeAvatar = asyncHandler(async (req, res) => {
  const user = await profileService.removeAvatar(req.auth.userId);
  return sendSuccess(res, { message: 'Photo removed', data: { user } });
});

/** DELETE /api/users/me — delete the account (ACC-5). */
const deleteMe = asyncHandler(async (req, res) => {
  await profileService.deleteAccount(req.auth.userId);
  return sendSuccess(res, { message: 'Account deleted' });
});

module.exports = {
  getMe,
  updateMe,
  saveInterests,
  getAvatarUploadParams,
  setAvatar,
  removeAvatar,
  deleteMe,
};
