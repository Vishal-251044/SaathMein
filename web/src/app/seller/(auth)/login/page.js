/**
 * /seller/login — dealer email + password login (F30).
 */
import SellerLoginForm from '@/components/features/seller/SellerLoginForm';

export const metadata = { title: 'Dealer login' };

/** @returns {JSX.Element} */
export default function SellerLoginPage() {
  return <SellerLoginForm />;
}
