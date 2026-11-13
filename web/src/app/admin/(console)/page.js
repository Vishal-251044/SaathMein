/**
 * /admin — console Overview (PRD §10.11): live platform numbers, 7-day chart, alerts and
 * disputes SLA. Every staff role.
 */
import OverviewDashboard from '@/components/features/admin/monitor/OverviewDashboard';

export const metadata = { title: 'Overview' };

/**
 * @returns {JSX.Element}
 */
export default function AdminDashboardPage() {
  return <OverviewDashboard />;
}
