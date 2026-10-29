/**
 * Dealer dashboard service — /api/seller/* (PRD §10.10): profile, coverage, KYC, team and
 * product requests, plus the public city and category lists used by the forms.
 */
import { sellerApi, uploadToCloudinary } from '@/services/api';

/** @returns {Promise<Object>} The dealer (self view) with the onboarding checklist */
export const getMe = async () => (await sellerApi.get('/seller/me')).data.seller;

/** @param {Object} changes - Profile fields @returns {Promise<Object>} Updated dealer */
export const updateProfile = async (changes) =>
  (await sellerApi.patch('/seller/profile', changes)).data.seller;

/**
 * Upload one KYC document privately to Cloudinary (signed by the API).
 * @param {string} docType - KYC document type
 * @param {File} file - PDF, JPG or PNG
 * @returns {Promise<{ type: string, publicId: string, version: number, signature: string, format: string }>}
 */
export const uploadKycDocument = async (docType, file) => {
  const params = (await sellerApi.post('/seller/kyc/upload-params', { docType })).data;
  const uploaded = await uploadToCloudinary(
    params,
    file,
    'The document could not be uploaded. Use a PDF, JPG or PNG under 10 MB.',
  );
  return {
    type: docType,
    publicId: uploaded.public_id,
    version: uploaded.version,
    signature: uploaded.signature,
    format: uploaded.format,
  };
};

/** @param {Object} kyc - KYC form @returns {Promise<Object>} Updated dealer */
export const submitKyc = async (kyc) => (await sellerApi.post('/seller/kyc', kyc)).data.seller;

/** @returns {Promise<{ members: Object[], invites: Object[] }>} */
export const getTeam = async () => (await sellerApi.get('/seller/team')).data.team;

/** @param {{ email: string, name?: string }} invite @returns {Promise<Object>} Team */
export const inviteMember = async (invite) =>
  (await sellerApi.post('/seller/team/invites', invite)).data.team;

/** @param {string} inviteId @returns {Promise<Object>} Team */
export const revokeInvite = async (inviteId) =>
  (await sellerApi.delete(`/seller/team/invites/${inviteId}`)).data.team;

/** @param {string} userId @returns {Promise<Object>} Team */
export const removeMember = async (userId) =>
  (await sellerApi.delete(`/seller/team/members/${userId}`)).data.team;

/** @param {{ brand: string, model: string, categoryId?: string, note?: string }} request */
export const requestProduct = async (request) =>
  (await sellerApi.post('/seller/product-requests', request)).data.request;

/** @returns {Promise<Object[]>} Active cities with areas (public) */
export const listCities = async () => (await sellerApi.get('/cities')).data.cities;

/** @returns {Promise<Object[]>} Active category tree (public) */
export const listCategories = async () => (await sellerApi.get('/categories')).data.categories;
