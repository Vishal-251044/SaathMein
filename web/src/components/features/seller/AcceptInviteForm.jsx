'use client';

/**
 * AcceptInviteForm — /seller/invite/[token]: a staff member joins a dealer team (F31).
 * New people set a password; people with an account confirm theirs.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2, UserPlus } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import SellerAuthCard from '@/components/features/seller/SellerAuthCard';
import { useSellerAuth } from '@/context/SellerAuthContext';
import { acceptInvite, getInvite } from '@/services/sellerAuth.service';
import { ROUTES } from '@/utils/constants';

/**
 * @returns {JSX.Element}
 */
export default function AcceptInviteForm() {
  const token = String(useParams().token);
  const router = useRouter();
  const { completeLogin } = useSellerAuth();
  const invite = useQuery({ queryKey: ['seller-invite', token], queryFn: () => getInvite(token) });
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /** Join the team and open the dashboard. */
  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const data = await acceptInvite({
        token,
        password,
        ...(name.trim() ? { name: name.trim() } : {}),
      });
      completeLogin(data);
      router.replace(ROUTES.SELLER);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (invite.isPending) {
    return (
      <SellerAuthCard title="Join your team">
        <div className="flex flex-col gap-4" aria-busy="true">
          <div className="h-5 w-3/4 animate-pulse rounded-button bg-bg-band" />
          <div className="h-11 animate-pulse rounded-button bg-bg-band" />
          <div className="h-11 animate-pulse rounded-button bg-bg-band" />
        </div>
      </SellerAuthCard>
    );
  }

  if (invite.isError) {
    return (
      <SellerAuthCard title="Invitation not valid">
        <div className="flex flex-col gap-4">
          <Alert>{invite.error.message}</Alert>
          <Button href={ROUTES.SELLER_LOGIN} variant="secondary">
            Go to dealer login
          </Button>
        </div>
      </SellerAuthCard>
    );
  }

  const { businessName, email, hasAccount } = invite.data;

  return (
    <SellerAuthCard
      title={`Join ${businessName}`}
      subtitle={`You were invited as ${email}`}
      footer={
        <Link
          href={ROUTES.SELLER_LOGIN}
          className="font-semibold text-primary-text hover:underline"
        >
          Back to login
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {error ? <Alert>{error}</Alert> : null}
        {hasAccount ? (
          <Alert tone="info">
            You already have a SaathMein dealer login. Enter its password to join.
          </Alert>
        ) : (
          <Input
            label="Your name"
            autoComplete="name"
            value={name}
            placeholder={invite.data.name || ''}
            onChange={(event) => setName(event.target.value)}
          />
        )}
        <Input
          label={hasAccount ? 'Password' : 'Create a password'}
          type="password"
          autoComplete={hasAccount ? 'current-password' : 'new-password'}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          hint={hasAccount ? undefined : 'At least 10 characters with a letter and a number'}
        />
        <Button type="submit" size="lg" disabled={isSubmitting || !password}>
          {isSubmitting ? (
            <Loader2 className="size-5 animate-spin" strokeWidth={2} aria-hidden="true" />
          ) : (
            <UserPlus className="size-5" strokeWidth={2} aria-hidden="true" />
          )}
          Join the team
        </Button>
      </form>
    </SellerAuthCard>
  );
}
