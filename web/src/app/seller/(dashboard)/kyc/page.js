/**
 * /seller/kyc — KYC wizard and payout bank (TRU-1, PAY-4).
 */
import KycWizard from '@/components/features/seller/KycWizard';

export const metadata = { title: 'Verification' };

/** @returns {JSX.Element} */
export default function SellerKycPage() {
  return <KycWizard />;
}
