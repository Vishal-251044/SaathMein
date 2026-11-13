/**
 * /admin/team — staff invites, roles, disable (ADL-1). Owner only.
 */
import TeamPage from '@/components/features/admin/monitor/TeamPage';

export const metadata = { title: 'Team' };

/**
 * @returns {JSX.Element}
 */
export default function Page() {
  return <TeamPage />;
}
