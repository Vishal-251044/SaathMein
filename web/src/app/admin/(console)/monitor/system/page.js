/**
 * /admin/monitor/system — API, sockets, queues, services (PRD §10.11). Owner, Admin.
 */
import SystemHealth from '@/components/features/admin/monitor/SystemHealth';

export const metadata = { title: 'System health' };

/**
 * @returns {JSX.Element}
 */
export default function Page() {
  return <SystemHealth />;
}
