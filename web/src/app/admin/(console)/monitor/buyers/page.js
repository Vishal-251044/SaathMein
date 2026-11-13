/**
 * /admin/monitor/buyers — buyer activity, suspend / reactivate (PRD §10.11). Owner, Admin, Support.
 */
import BuyersMonitor from '@/components/features/admin/monitor/BuyersMonitor';

export const metadata = { title: 'Buyers' };

/**
 * @returns {JSX.Element}
 */
export default function Page() {
  return <BuyersMonitor />;
}
