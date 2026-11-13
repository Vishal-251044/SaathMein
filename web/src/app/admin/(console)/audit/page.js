/**
 * /admin/audit — audit log viewer with CSV export (ADL-5). Owner, Admin.
 */
import AuditLog from '@/components/features/admin/monitor/AuditLog';

export const metadata = { title: 'Audit log' };

/**
 * @returns {JSX.Element}
 */
export default function Page() {
  return <AuditLog />;
}
