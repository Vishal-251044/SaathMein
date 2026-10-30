/**
 * /admin/groups — every buyer group, read-only (PRD §10.11 Groups). Owner, Admin, Deal
 * Manager, Support.
 */
import GroupsList from '@/components/features/admin/groups/GroupsList';

export const metadata = { title: 'Groups' };

/**
 * @returns {JSX.Element}
 */
export default function AdminGroupsPage() {
  return <GroupsList />;
}
