/**
 * Console layout for every signed-in admin page (dashboard and modules).
 */
import AdminGuard from '@/components/features/admin/AdminGuard';

/**
 * @param {Object} props
 * @param {React.ReactNode} props.children - Console page
 * @returns {JSX.Element}
 */
export default function ConsoleLayout({ children }) {
  return <AdminGuard>{children}</AdminGuard>;
}
