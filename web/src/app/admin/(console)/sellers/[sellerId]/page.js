'use client';

/**
 * /admin/sellers/[sellerId] — review one dealer's KYC. The id is read on the client (the
 * console is client-rendered behind the staff session).
 */
import { useParams } from 'next/navigation';
import SellerReview from '@/components/features/admin/sellers/SellerReview';

/**
 * @returns {JSX.Element}
 */
export default function AdminSellerReviewPage() {
  const { sellerId } = useParams();
  return <SellerReview sellerId={String(sellerId)} />;
}
