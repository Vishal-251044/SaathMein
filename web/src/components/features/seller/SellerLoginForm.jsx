'use client';

/**
 * SellerLoginForm — dealer email + password login (F30). Signed-in dealers go straight to
 * the dashboard.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, LogIn } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import SellerAuthCard from '@/components/features/seller/SellerAuthCard';
import { useSellerAuth } from '@/context/SellerAuthContext';
import { login } from '@/services/sellerAuth.service';
import { ROUTES } from '@/utils/constants';

/**
 * @returns {JSX.Element}
 */
export default function SellerLoginForm() {
  const router = useRouter();
  const { status, completeLogin } = useSellerAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'signedIn') router.replace(ROUTES.SELLER);
  }, [status, router]);

  /** Log in and open the dashboard. */
  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      completeLogin(await login({ email: email.trim(), password }));
    } catch (err) {
      setError(err.message);
      setPassword('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SellerAuthCard
      title="Dealer login"
      subtitle="Bid on group orders and manage your shop"
      footer={
        <>
          New to SaathMein?{' '}
          <Link
            href={ROUTES.SELLER_REGISTER}
            className="font-semibold text-primary hover:underline"
          >
            Register your business
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        {error ? <Alert>{error}</Alert> : null}
        <Input
          label="Email"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button type="submit" size="lg" disabled={isSubmitting || !email || !password}>
          {isSubmitting ? (
            <Loader2 className="size-5 animate-spin" strokeWidth={2} aria-hidden="true" />
          ) : (
            <LogIn className="size-5" strokeWidth={2} aria-hidden="true" />
          )}
          Log in
        </Button>
      </form>
    </SellerAuthCard>
  );
}
