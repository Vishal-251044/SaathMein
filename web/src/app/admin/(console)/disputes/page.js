/**
 * /admin/disputes — Disputes and reports queue (TRU-3, TRU-4). Owner, Admin, Support.
 */
import TrustQueuePage from '@/components/features/admin/trust/TrustQueuePage';

export const metadata = { title: 'Disputes and reports' };

/** @returns {JSX.Element} */
export default function AdminDisputesPage() {
  return <TrustQueuePage />;
}
