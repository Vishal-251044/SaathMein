/**
 * /legal/refund-policy — Refund and cancellation policy (draft pending legal review).
 * Matches the product rules: PAY-6, back-out fee, exit window, price validity, disputes.
 */
import Link from 'next/link';
import LegalLayout from '@/components/features/legal/LegalLayout';
import { LEGAL } from '@/utils/legal';

export const metadata = { title: 'Refund and cancellation policy' };

/** @returns {JSX.Element} */
export default function RefundPolicyPage() {
  return (
    <LegalLayout title="Refund and cancellation policy" path="/legal/refund-policy">
      <p>
        When you join a group on {LEGAL.brandName} you pay a small token. This page explains when
        you get it back. Refunds go to the account or card you paid from, through Razorpay.
      </p>
      <h2>Full refund of your token</h2>
      <ul>
        <li>You leave a group that is still open (not yet full).</li>
        <li>
          The group does not fill by its deadline, no dealer makes an offer, or the group is
          cancelled.
        </li>
        <li>The winning dealer backs out and no other dealer takes the group.</li>
        <li>
          Our Support team decides a dispute in your favour while your token has not yet been paid
          out to the dealer.
        </li>
      </ul>
      <h2>Refund minus the back-out fee</h2>
      <ul>
        <li>
          You leave after the group is full (seats are locked while dealers compete), or within 24
          hours after a dealer wins. The back-out fee (for example ₹99, always shown before you
          leave) covers payment costs.
        </li>
        <li>
          You do not buy before your deal code&apos;s validity date. We remind you before it ends.
        </li>
      </ul>
      <h2>No refund</h2>
      <ul>
        <li>While the live auction is running, seats are locked and you cannot leave.</li>
        <li>
          After you buy, your token is part of the price you paid the dealer. Product returns and
          warranty follow the dealer&apos;s policy and the law.
        </li>
      </ul>
      <h2>When the dealer does not honour the price</h2>
      <p>
        Open a dispute in the app with your invoice or photos. The dealer has 48 hours to answer and
        Support then decides. If your token was already paid out to the dealer, we may give you{' '}
        {LEGAL.brandName} credits instead of a bank refund.
      </p>
      <h2>How long refunds take</h2>
      <p>
        We start the refund at once. Banks and UPI apps usually show it within 5 to 7 working days.
        You can follow every step in the money timeline of your group.
      </p>
      <h2>Questions</h2>
      <p>
        Write to {LEGAL.supportEmail} with your group and payment details, or contact our{' '}
        <Link
          href="/legal/grievance-officer"
          className="font-semibold text-primary hover:underline"
        >
          grievance officer
        </Link>
        .
      </p>
    </LegalLayout>
  );
}
