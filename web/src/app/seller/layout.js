/**
 * Dealer area layout (/seller/*). Provides the server-data cache and the dealer session
 * (separate from the admin console session) to every dealer page.
 */
import QueryProvider from '@/context/QueryProvider';
import { SellerAuthProvider } from '@/context/SellerAuthContext';

export const metadata = {
  title: { default: 'Dealer dashboard', template: '%s · SaathMein for dealers' },
  robots: { index: false, follow: false },
};

/**
 * @param {Object} props
 * @param {React.ReactNode} props.children - Dealer pages
 * @returns {JSX.Element}
 */
export default function SellerLayout({ children }) {
  return (
    <QueryProvider>
      <SellerAuthProvider>{children}</SellerAuthProvider>
    </QueryProvider>
  );
}
