'use client';

/**
 * /seller/disputes/[disputeId] — one dispute: the buyer's side, your answer, the decision.
 */
import { useParams } from 'next/navigation';
import { SellerDisputeDetail } from '@/components/features/seller/disputes/SellerDisputesPage';

/** @returns {JSX.Element} */
export default function SellerDisputePage() {
  const { disputeId } = useParams();
  return <SellerDisputeDetail disputeId={String(disputeId)} />;
}
