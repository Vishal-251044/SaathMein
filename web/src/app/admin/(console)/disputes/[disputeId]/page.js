'use client';

/**
 * /admin/disputes/[disputeId] — one dispute: evidence, dealer answer, money state, decision.
 */
import { useParams } from 'next/navigation';
import DisputeCase from '@/components/features/admin/trust/DisputeCase';

/** @returns {JSX.Element} */
export default function AdminDisputePage() {
  const { disputeId } = useParams();
  return <DisputeCase disputeId={String(disputeId)} />;
}
