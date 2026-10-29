/**
 * Dashboard layout for every signed-in dealer page.
 */
import SellerGuard from '@/components/features/seller/SellerGuard';

/**
 * @param {Object} props
 * @param {React.ReactNode} props.children - Dashboard page
 * @returns {JSX.Element}
 */
export default function DashboardLayout({ children }) {
  return <SellerGuard>{children}</SellerGuard>;
}
