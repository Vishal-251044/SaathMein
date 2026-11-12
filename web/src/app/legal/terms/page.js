/**
 * /legal/terms — Terms of use (draft pending legal review, open question 9).
 */
import Link from 'next/link';
import LegalLayout from '@/components/features/legal/LegalLayout';
import { LEGAL } from '@/utils/legal';

export const metadata = { title: 'Terms of use' };

const linkClass = 'font-semibold text-primary hover:underline';

/** @returns {JSX.Element} */
export default function TermsPage() {
  return (
    <LegalLayout title="Terms of use" path="/legal/terms">
      <p>
        These terms apply when you use the {LEGAL.brandName} app or website, run by{' '}
        {LEGAL.companyName}, {LEGAL.registeredAddress}. By using {LEGAL.brandName} you agree to
        them.
      </p>
      <h2>What SaathMein does</h2>
      <p>
        {LEGAL.brandName} is a marketplace. Buyers who want the same product in the same city join
        one group. When the group is full, verified dealers offer prices in a live auction and the
        lowest all-inclusive price wins, or a dealer publishes a group deal with prices that drop as
        more people join. You buy the product from the dealer. {LEGAL.brandName} is not the seller
        of the product; the dealer is responsible for the product, its delivery, its warranty and
        its tax invoice.
      </p>
      <h2>Your account</h2>
      <ul>
        <li>
          You sign in with your mobile number and a one-time code. Keep your phone secure; actions
          from your account are treated as yours.
        </li>
        <li>You must be 18 or older and give true details. One person, one account.</li>
        <li>We may suspend accounts that break these terms, misuse refunds or harass others.</li>
      </ul>
      <h2>Joining a group and the token</h2>
      <ul>
        <li>
          To join, you pay a small refundable token through Razorpay. The token is a part-payment of
          your purchase: at the shop you pay the winning price minus the token.
        </li>
        <li>
          Leaving and refunds follow the{' '}
          <Link href="/legal/refund-policy" className={linkClass}>
            refund and cancellation policy
          </Link>
          .
        </li>
        <li>
          Prices in an auction are all-inclusive per unit and come from the dealers. The winning
          dealer must honour the winning price for every member until the validity date on the deal
          code.
        </li>
      </ul>
      <h2>Dealers</h2>
      <ul>
        <li>
          Dealers are verified (GST, PAN, shop and bank details) before they can bid. A dealer who
          backs out or does not honour a winning price can be warned, lose rating, or be suspended
          from auctions.
        </li>
        <li>
          {LEGAL.brandName} earns a commission from the dealer on completed purchases. Buyers do not
          pay a convenience fee at launch.
        </li>
      </ul>
      <h2>Reviews, chat and reports</h2>
      <ul>
        <li>
          Only buyers who completed a purchase can review the dealer. Be honest and respectful;
          abusive content is hidden.
        </li>
        <li>
          Group chat shows first names only. Do not share phone numbers or payment details in chat.
        </li>
        <li>
          You can report a group, member, dealer, message or review. Our team reviews every report.
        </li>
      </ul>
      <h2>Disputes</h2>
      <p>
        If the dealer does not honour the winning price or there is a problem with your purchase,
        open a dispute in the app with photos or the invoice. The dealer has 48 hours to answer,
        then our Support team decides. Decisions can include a refund of your token,{' '}
        {LEGAL.brandName} credits and penalties for the dealer.
      </p>
      <h2>Credits</h2>
      <p>
        {LEGAL.brandName} credits from referrals, group-leader bonuses or disputes are not money,
        cannot be withdrawn or transferred, and can be used only as {LEGAL.brandName} allows in the
        app.
      </p>
      <h2>Liability</h2>
      <p>
        We work hard to keep {LEGAL.brandName} available and accurate, but we are not liable for the
        product itself, which the dealer sells. Nothing in these terms limits your rights under the
        Consumer Protection Act, 2019.
      </p>
      <h2>Changes and contact</h2>
      <p>
        We may update these terms and will show the date above. Questions: {LEGAL.supportEmail}.
        Complaints: see our{' '}
        <Link href="/legal/grievance-officer" className={linkClass}>
          grievance officer
        </Link>
        . These terms are governed by the laws of India; courts in Pune have jurisdiction.
      </p>
    </LegalLayout>
  );
}
