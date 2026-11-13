/**
 * /admin/alerts — alerts centre (MON-4). Every staff role.
 */
import AlertsCentre from '@/components/features/admin/monitor/AlertsCentre';

export const metadata = { title: 'Alerts' };

/**
 * @returns {JSX.Element}
 */
export default function Page() {
  return <AlertsCentre />;
}
