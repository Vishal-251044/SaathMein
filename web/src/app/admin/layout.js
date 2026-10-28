/**
 * Admin area layout (/admin/*). Provides the server-data cache and the staff session to
 * every admin page. Not linked from the public site and hidden from search engines (ADL-1).
 */
import QueryProvider from '@/context/QueryProvider';
import { AdminAuthProvider } from '@/context/AdminAuthContext';

export const metadata = {
  title: 'Admin console',
  robots: { index: false, follow: false },
};

/**
 * @param {Object} props
 * @param {React.ReactNode} props.children - Admin pages
 * @returns {JSX.Element}
 */
export default function AdminLayout({ children }) {
  return (
    <QueryProvider>
      <AdminAuthProvider>{children}</AdminAuthProvider>
    </QueryProvider>
  );
}
