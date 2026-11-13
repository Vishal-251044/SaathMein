/**
 * /admin/monitor/auctions — every live auction and recent results (PRD §10.11). Owner, Admin, Deal Manager, Support.
 */
import AuctionsMonitor from '@/components/features/admin/monitor/AuctionsMonitor';

export const metadata = { title: 'Live auctions' };

/**
 * @returns {JSX.Element}
 */
export default function Page() {
  return <AuctionsMonitor />;
}
