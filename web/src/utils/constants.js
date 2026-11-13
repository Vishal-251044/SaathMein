/**
 * App-wide constants for the SaathMein web app (dealer dashboard + admin console).
 */

export const APP_NAME = 'SaathMein';
export const APP_TAGLINE = 'Buy together. Save together.';

/** Base URL of the backend API (from web/.env.local). */
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

/** Request timeout for API calls, in milliseconds. */
export const API_TIMEOUT_MS = 15000;

/** Socket.io server for live auctions (from web/.env.local, no /api suffix). */
export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

/** Live events the dealer dashboard listens to (match backend constants/enums.js). */
export const SOCKET_EVENTS = Object.freeze({
  AUCTION_JOIN: 'auction:join',
  AUCTION_LOWEST: 'auction:lowest',
  AUCTION_EXTENDED: 'auction:extended',
  AUCTION_WON: 'auction:won',
  AUCTION_RANK: 'auction:rank',
  GROUP_JOIN: 'group:join',
  GROUP_LEAVE: 'group:leave',
  CHAT_MESSAGE: 'chat:message',
});

/** Live events the admin console listens to (staff room, backend sockets/emitter.js). */
export const STAFF_SOCKET_EVENTS = Object.freeze({
  MONITOR_CHANGED: 'monitor:changed',
  ALERT_NEW: 'alert:new',
  ALERT_UPDATED: 'alert:updated',
});

/** Console monitors poll this often while the staff socket is down (fallback). */
export const MONITOR_POLL_MS = 30_000;

/** Alert severity and type labels (MON-4). */
export const ALERT_SEVERITY_META = Object.freeze({
  critical: { label: 'Critical', tone: 'danger' },
  warning: { label: 'Warning', tone: 'warning' },
  info: { label: 'Info', tone: 'muted' },
});
export const ALERT_TYPE_LABELS = Object.freeze({
  payment: 'Payments',
  auction: 'Auctions',
  suspicious_bidding: 'Suspicious bidding',
  reconciliation: 'Reconciliation',
  system: 'System',
});

/** Poll the auction this often while the live connection is down (fallback). */
export const AUCTION_POLL_MS = 10_000;

/** Admin console signs out after this long without activity (ADL-4; the API enforces it too). */
export const ADMIN_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

/** Refresh the 15-minute staff access token a little before it expires. */
export const ADMIN_TOKEN_REFRESH_MS = 13 * 60 * 1000;

/** Refresh the 15-minute dealer access token a little before it expires. */
export const SELLER_TOKEN_REFRESH_MS = 13 * 60 * 1000;

/** Top-level route paths. Admin is intentionally not linked from public pages (ADL-1). */
export const ROUTES = Object.freeze({
  HOME: '/',
  SELLER: '/seller',
  SELLER_LOGIN: '/seller/login',
  SELLER_REGISTER: '/seller/register',
  SELLER_KYC: '/seller/kyc',
  SELLER_PROFILE: '/seller/profile',
  SELLER_TEAM: '/seller/team',
  SELLER_AUCTIONS: '/seller/auctions',
  SELLER_WON: '/seller/won',
  SELLER_DEALS: '/seller/deals',
  SELLER_DEAL_NEW: '/seller/deals/new',
  SELLER_PURCHASES: '/seller/purchases',
  SELLER_PAYOUTS: '/seller/payouts',
  SELLER_INVOICES: '/seller/invoices',
  ADMIN: '/admin',
  ADMIN_LOGIN: '/admin/login',
});

/** Staff role labels shown in the console (PRD §8.2). */
export const STAFF_ROLE_LABELS = Object.freeze({
  owner: 'Owner',
  admin: 'Admin',
  deal_manager: 'Deal Manager',
  finance: 'Finance',
  support: 'Support',
});

/** Dealer business types (match the API and Razorpay Route business_type). */
export const BUSINESS_TYPE_OPTIONS = Object.freeze([
  { value: 'proprietorship', label: 'Proprietorship' },
  { value: 'partnership', label: 'Partnership firm' },
  { value: 'llp', label: 'LLP' },
  { value: 'private_limited', label: 'Private limited company' },
  { value: 'public_limited', label: 'Public limited company' },
]);

/** KYC document types and their labels (TRU-1). */
export const KYC_DOC_LABELS = Object.freeze({
  gst_certificate: 'GST registration certificate',
  pan_card: 'Business PAN card',
  shop_photo: 'Shop front photo (with name board)',
  dealer_proof: 'Authorised dealer certificate',
  address_proof: 'Shop address proof',
  cancelled_cheque: 'Cancelled cheque',
  other: 'Other document',
});

/** Category slugs whose dealers must upload an authorised dealer certificate (TRU-1). */
export const VEHICLE_CATEGORY_SLUGS = Object.freeze(['cars-evs', 'two-wheelers']);

/** KYC status labels and badge tones. */
export const KYC_STATUS_META = Object.freeze({
  not_submitted: { label: 'Not submitted', tone: 'muted' },
  pending: { label: 'Under review', tone: 'warning' },
  approved: { label: 'Verified', tone: 'brand' },
  rejected: { label: 'Changes needed', tone: 'danger' },
});

/** Razorpay Route linked-account status labels (dealer payouts). */
export const PAYOUT_STATUS_LABELS = Object.freeze({
  not_started: 'Not set up',
  created: 'Account created',
  requested: 'Activation requested',
  under_review: 'Razorpay reviewing',
  needs_clarification: 'Razorpay needs details',
  activated: 'Active',
  suspended: 'Suspended',
  failed: 'Setup failed',
});

/** Group status labels and badge tones (PRD §10.3). */
export const GROUP_STATUS_META = Object.freeze({
  open: { label: 'Open', tone: 'brand' },
  full: { label: 'Full', tone: 'brand' },
  auction_live: { label: 'Auction live', tone: 'warning' },
  won: { label: 'Won', tone: 'brand' },
  purchasing: { label: 'Purchasing', tone: 'brand' },
  runner_up: { label: 'Runner-up offer', tone: 'warning' },
  completed: { label: 'Completed', tone: 'muted' },
  expired: { label: 'Expired', tone: 'muted' },
  no_deal: { label: 'No deal', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
});
