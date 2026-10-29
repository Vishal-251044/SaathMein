/**
 * /seller/register — dealer sign-up (F30).
 */
import SellerRegisterForm from '@/components/features/seller/SellerRegisterForm';

export const metadata = { title: 'Register your business' };

/** @returns {JSX.Element} */
export default function SellerRegisterPage() {
  return <SellerRegisterForm />;
}
