/**
 * /admin/settings — platform rules and feature flags (F35). Owner, Admin.
 */
import SettingsPage from '@/components/features/admin/settings/SettingsPage';

export const metadata = { title: 'Settings' };

/** @returns {JSX.Element} */
export default function AdminSettingsPage() {
  return <SettingsPage />;
}
