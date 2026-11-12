/**
 * /legal/privacy — Privacy policy (draft pending legal review; DPDP Act 2023).
 */
import LegalLayout from '@/components/features/legal/LegalLayout';
import { LEGAL } from '@/utils/legal';

export const metadata = { title: 'Privacy policy' };

/** @returns {JSX.Element} */
export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy policy" path="/legal/privacy">
      <p>
        This policy explains what personal data {LEGAL.companyName} (&ldquo;{LEGAL.brandName}
        &rdquo;) collects, why, and your choices, under the Digital Personal Data Protection Act,
        2023.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>
          Account: mobile number, name, photo (optional), city and area, preferred language,
          interests.
        </li>
        <li>
          Activity: groups you create or join, chat messages and photos, reviews, reports and
          disputes.
        </li>
        <li>
          Payments: Razorpay processes your payment. We keep payment and refund records, never your
          card details or UPI PIN.
        </li>
        <li>Device: app version, device id, push notification token and error reports.</li>
        <li>
          Dealers: business, GST, PAN, shop address and photos, bank account for payouts. KYC
          documents are stored privately.
        </li>
      </ul>
      <h2>Why we use it</h2>
      <ul>
        <li>
          To run groups, auctions, payments, refunds and purchases, and send the notifications you
          asked for.
        </li>
        <li>
          To keep the marketplace safe: verifying dealers, handling reports and disputes, preventing
          fraud.
        </li>
        <li>
          To show you relevant groups and, from our AI assistant Saathi, helpful answers based on{' '}
          {LEGAL.brandName} data.
        </li>
        <li>To meet legal duties such as tax invoices and record keeping.</li>
      </ul>
      <h2>Who sees what</h2>
      <ul>
        <li>Other members see your first name and photo only, never your phone number.</li>
        <li>
          The dealer who wins your group sees your first name, and your phone number only after the
          24-hour exit window ends, to arrange your purchase.
        </li>
        <li>
          Service providers who process data for us: Razorpay (payments), Google Firebase (sign-in
          and notifications), Cloudinary (images), Anthropic (AI features), Sentry (error reports),
          and our hosting and email providers. They may use the data only to provide their service.
        </li>
        <li>Authorities, when the law requires it.</li>
      </ul>
      <h2>How long we keep it</h2>
      <p>
        Account data is kept while your account is active. Payment, invoice and tax records are kept
        for the period the law requires (usually 8 years). Chat and evidence linked to a dispute are
        kept until the dispute is closed.
      </p>
      <h2>Your rights</h2>
      <ul>
        <li>See and correct your data in the app (Profile).</li>
        <li>
          Delete your account from Profile; we remove or anonymise your data except records we must
          keep by law.
        </li>
        <li>Turn notifications off in your phone settings.</li>
        <li>Complain to our grievance officer, and then to the Data Protection Board of India.</li>
      </ul>
      <h2>Security</h2>
      <p>
        Data travels over HTTPS, sign-in tokens are kept in your phone&apos;s secure storage, KYC
        documents and invoices are private files, and our team&apos;s access is limited by role,
        with two-factor sign-in and an audit log.
      </p>
      <h2>Contact</h2>
      <p>
        Privacy questions: {LEGAL.supportEmail}. Grievances: {LEGAL.grievanceOfficer.name},{' '}
        {LEGAL.grievanceOfficer.email}.
      </p>
    </LegalLayout>
  );
}
