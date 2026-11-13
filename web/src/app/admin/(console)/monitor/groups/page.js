/**
 * /admin/monitor/groups — groups by status, near target, expiring (PRD §10.11). Owner, Admin, Deal Manager, Support.
 */
import GroupsMonitor from '@/components/features/admin/monitor/GroupsMonitor';

export const metadata = { title: 'Group monitor' };

/**
 * @returns {JSX.Element}
 */
export default function Page() {
  return <GroupsMonitor />;
}
