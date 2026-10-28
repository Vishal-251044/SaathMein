/**
 * /admin/login — staff sign in with password + mandatory 2FA (ADL-1, ADL-2).
 */
import AdminLoginFlow from '@/components/features/admin/AdminLoginFlow';

export const metadata = { title: 'Admin sign in' };

/**
 * @returns {JSX.Element}
 */
export default function AdminLoginPage() {
  return <AdminLoginFlow />;
}
