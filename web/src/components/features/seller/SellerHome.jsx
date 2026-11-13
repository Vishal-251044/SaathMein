'use client';

/**
 * SellerHome — /seller: onboarding checklist until the dealer is verified (TRU-1), then a
 * summary. Auctions, deals and payouts arrive on later roadmap days.
 */
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  CircleCheck,
  Circle,
  Clock,
  Gavel,
  TriangleAlert,
} from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import FadeIn from '@/components/animations/FadeIn';
import EmailVerifyCard from '@/components/features/seller/EmailVerifyCard';
import { useSellerMe } from '@/hooks/useSeller';
import { ROUTES } from '@/utils/constants';
import { cn } from '@/utils/genericFunctions';

/**
 * One checklist row.
 * @param {{ done: boolean, title: string, text: string, href?: string, action?: string }} props
 * @returns {JSX.Element}
 */
function ChecklistItem({ done, title, text, href, action }) {
  const Icon = done ? CircleCheck : Circle;
  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Icon
          className={cn('mt-0.5 size-5 shrink-0', done ? 'text-primary-text' : 'text-muted')}
          strokeWidth={2}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className={cn('font-semibold', done ? 'text-muted line-through' : 'text-ink')}>
            {title}
          </p>
          <p className="text-sm text-muted">{text}</p>
        </div>
      </div>
      {!done && href ? (
        <Button href={href} variant="secondary" className="self-start sm:self-auto">
          {action}
          <ArrowRight className="size-4" strokeWidth={2} aria-hidden="true" />
        </Button>
      ) : null}
    </li>
  );
}

/**
 * @returns {JSX.Element}
 */
export default function SellerHome() {
  const { data: seller } = useSellerMe();
  const { checklist, kyc, role } = seller;
  const isOwner = role === 'owner';

  return (
    <div className="flex flex-col gap-6">
      <FadeIn>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          Namaste, {seller.contactName?.split(' ')[0] || seller.businessName}
        </h1>
        <p className="mt-1 text-muted">
          {checklist.approved
            ? 'Your business is verified. You will see live group auctions here.'
            : 'Finish these steps to start bidding on group orders.'}
        </p>
      </FadeIn>

      {kyc.status === 'rejected' ? (
        <Alert tone="warning">
          <p className="font-bold">Your verification needs changes</p>
          <p className="mt-1">{kyc.rejectionReason}</p>
          {isOwner ? (
            <Link
              href={ROUTES.SELLER_KYC}
              className="mt-2 inline-block font-semibold text-primary-text underline"
            >
              Update and resubmit
            </Link>
          ) : null}
        </Alert>
      ) : null}

      {isOwner && !checklist.emailVerified ? <EmailVerifyCard /> : null}

      {checklist.approved ? (
        <FadeIn className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
          <div className="flex items-start gap-3">
            <BadgeCheck
              className="size-6 shrink-0 text-primary-text"
              strokeWidth={2}
              aria-hidden="true"
            />
            <div>
              <h2 className="text-lg font-bold text-ink">Verified dealer</h2>
              <p className="text-sm text-muted">
                Buyers see your verified badge. Auctions open when groups in your cities and
                categories fill up.
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-button bg-bg-band px-4 py-3 text-sm text-muted">
            <Gavel className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            Live auctions arrive in the dashboard on Day 9 of the launch plan.
          </div>
        </FadeIn>
      ) : (
        <FadeIn className="rounded-card border border-line bg-surface px-5 shadow-card sm:px-6">
          <h2 className="pt-5 text-lg font-bold text-ink">Get verified</h2>
          <ul className="divide-y divide-line">
            <ChecklistItem
              done={checklist.emailVerified}
              title="Verify your email"
              text="Enter the code we emailed you."
            />
            <ChecklistItem
              done={checklist.profileComplete}
              title="Choose where and what you sell"
              text="Cities and categories decide which group auctions you can join."
              href={ROUTES.SELLER_PROFILE}
              action="Set coverage"
            />
            <ChecklistItem
              done={checklist.kycSubmitted}
              title="Submit KYC and payout bank"
              text="GST, PAN, shop photo and the bank account for your payouts."
              href={isOwner ? ROUTES.SELLER_KYC : undefined}
              action="Start KYC"
            />
            <ChecklistItem
              done={checklist.approved}
              title="SaathMein review"
              text="Our team checks your documents, usually within one working day."
            />
          </ul>
          {kyc.status === 'pending' ? (
            <p className="flex items-center gap-2 border-t border-line py-4 text-sm font-semibold text-ink">
              <Clock className="size-4 text-warning-text" strokeWidth={2} aria-hidden="true" />
              Under review since {new Date(kyc.submittedAt).toLocaleDateString('en-IN')}
            </p>
          ) : null}
          {!isOwner && !checklist.kycSubmitted ? (
            <p className="flex items-center gap-2 border-t border-line py-4 text-sm text-muted">
              <TriangleAlert
                className="size-4 text-warning-text"
                strokeWidth={2}
                aria-hidden="true"
              />
              Only the account owner can submit KYC.
            </p>
          ) : null}
        </FadeIn>
      )}
    </div>
  );
}
