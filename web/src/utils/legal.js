/**
 * Company and grievance officer details shown on the legal pages (Consumer Protection
 * (E-Commerce) Rules 2020, IT Rules 2021). PLACEHOLDERS — the Owner fills these in before
 * live payments, and the page texts are reviewed by a lawyer (open question 9).
 */
export const LEGAL = Object.freeze({
  /** Shown on every legal page until a lawyer has reviewed the texts. */
  isDraft: true,
  lastUpdated: '12 November 2026',
  companyName: '[Registered company name]',
  brandName: 'SaathMein',
  registeredAddress: '[Registered office address, Pune, Maharashtra]',
  cin: '[CIN]',
  gstin: '[GSTIN]',
  supportEmail: '[support email]',
  supportPhone: '[support phone]',
  grievanceOfficer: Object.freeze({
    name: '[Grievance officer name]',
    designation: 'Grievance Officer',
    email: '[grievance email]',
    phone: '[grievance phone]',
    address: '[Address for grievances]',
    hours: 'Monday to Friday, 10 am to 6 pm IST',
  }),
});

export const LEGAL_PAGES = Object.freeze([
  { href: '/legal/terms', label: 'Terms of use' },
  { href: '/legal/privacy', label: 'Privacy policy' },
  { href: '/legal/refund-policy', label: 'Refund and cancellation policy' },
  { href: '/legal/grievance-officer', label: 'Grievance officer' },
]);
