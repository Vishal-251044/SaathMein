/**
 * /admin — console dashboard. Day 2: welcome and session overview.
 * Live monitors (groups, auctions, Razorpay payments, alerts) arrive on Day 13.
 */
import AdminDashboardHome from '@/components/features/admin/AdminDashboardHome';

export const metadata = { title: 'Dashboard' };

/**
 * @returns {JSX.Element}
 */
export default function AdminDashboardPage() {
  return <AdminDashboardHome />;
}
