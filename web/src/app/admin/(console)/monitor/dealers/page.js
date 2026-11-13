/**
 * /admin/monitor/dealers — dealer performance and penalties (PRD §10.11). Owner, Admin, Deal Manager, Support.
 */
import DealersMonitor from '@/components/features/admin/monitor/DealersMonitor';

export const metadata = { title: 'Dealer monitor' };

/**
 * @returns {JSX.Element}
 */
export default function Page() {
  return <DealersMonitor />;
}
