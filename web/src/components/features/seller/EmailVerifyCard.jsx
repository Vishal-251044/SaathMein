'use client';

/**
 * EmailVerifyCard — enter the 6-digit code emailed at sign-up, or ask for a new one.
 * Needed before KYC can be submitted.
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, MailCheck, Send } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useSellerAuth } from '@/context/SellerAuthContext';
import { SELLER_ME_KEY } from '@/hooks/useSeller';
import { sendEmailCode, verifyEmail } from '@/services/sellerAuth.service';

/**
 * @returns {JSX.Element}
 */
export default function EmailVerifyCard() {
  const queryClient = useQueryClient();
  const { user, updateUser } = useSellerAuth();
  const [code, setCode] = useState('');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // 'verify' | 'resend' | null

  /** Check the code. */
  const handleVerify = async (event) => {
    event.preventDefault();
    setError(null);
    setBusy('verify');
    try {
      updateUser(await verifyEmail(code.trim()));
      await queryClient.invalidateQueries({ queryKey: SELLER_ME_KEY });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  /** Send a new code. */
  const handleResend = async () => {
    setError(null);
    setMessage(null);
    setBusy('resend');
    try {
      await sendEmailCode();
      setMessage(`A new code was sent to ${user?.email}. It is valid for 15 minutes.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-button bg-primary/10 text-primary-text">
          <MailCheck className="size-5" strokeWidth={2} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-ink">Verify your email</h2>
          <p className="mt-0.5 text-sm text-muted">
            We sent a 6-digit code to <span className="font-semibold text-ink">{user?.email}</span>.
          </p>
        </div>
      </div>

      <form onSubmit={handleVerify} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-48">
          <Input
            label="Code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
            className="font-mono tracking-[0.3em]"
          />
        </div>
        <Button type="submit" disabled={code.length !== 6 || busy !== null}>
          {busy === 'verify' ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
          ) : null}
          Verify
        </Button>
        <Button variant="ghost" onClick={handleResend} disabled={busy !== null}>
          {busy === 'resend' ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
          ) : (
            <Send className="size-4" strokeWidth={2} aria-hidden="true" />
          )}
          Send a new code
        </Button>
      </form>
      {error ? <Alert className="mt-3">{error}</Alert> : null}
      {message ? (
        <Alert tone="info" className="mt-3">
          {message}
        </Alert>
      ) : null}
    </section>
  );
}
