/**
 * /admin/commissions — commission per purchase, totals, CSV export and monthly GST
 * invoices (PRD §10.11). Owner, Admin, Finance.
 */
import CommissionsPage from '@/components/features/admin/commissions/CommissionsPage';

export const metadata = { title: 'Commissions' };

/** @returns {JSX.Element} */
export default function AdminCommissionsPage() {
  return <CommissionsPage />;
}
