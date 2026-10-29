/**
 * /seller/profile — business details, coverage and shop location.
 */
import SellerProfileForm from '@/components/features/seller/SellerProfileForm';

export const metadata = { title: 'Business profile' };

/** @returns {JSX.Element} */
export default function SellerProfilePage() {
  return <SellerProfileForm />;
}
