'use client';

/**
 * StaffInviteAccept — the page behind a staff invitation link (ADL-1). Shows the invited
 * email and role, then the invitee sets their name and password. Two-step verification
 * is set up at the first sign-in, so the account is never usable without it.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CircleCheck, Loader2 } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { LogoMark } from '@/components/ui/Logo';
import { acceptInvite, previewInvite } from '@/services/adminMonitor.service';
import { ROUTES } from '@/utils/constants';

/**
 * @param {Object} props
 * @param {string} props.token - Invitation token from the link
 * @returns {JSX.Element}
 */
export default function StaffInviteAccept({ token }) {
  const invite = useQuery({
    queryKey: ['staff-invite', token],
    queryFn: () => previewInvite(token),
    retry: false,
  });
  const [form, setForm] = useState({ name: '', password: '', confirm: '' });
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    if (form.password !== form.confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setIsSaving(true);
    try {
      await acceptInvite({ token, name: form.name.trim(), password: form.password });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg-band px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <LogoMark size={44} />
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-ink">
            Join the SaathMein console
          </h1>
        </div>
        <div className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-7">
          {invite.isPending ? (
            <div className="flex justify-center py-8" aria-busy="true">
              <Loader2
                className="size-6 animate-spin text-muted"
                strokeWidth={2}
                aria-label="Loading"
              />
            </div>
          ) : invite.isError ? (
            <Alert>{invite.error.message}</Alert>
          ) : done ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <CircleCheck className="size-10 text-primary" strokeWidth={1.75} aria-hidden="true" />
              <p className="font-semibold text-ink">Your account is ready.</p>
              <p className="text-sm text-muted">
                Sign in with {invite.data.email}. You will set up an authenticator app for 2-step
                verification first.
              </p>
              <Button href={ROUTES.ADMIN_LOGIN}>Go to sign in</Button>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4">
              <p className="text-sm text-muted">
                You are invited as{' '}
                <span className="font-semibold text-ink">{invite.data.roleLabel}</span> with{' '}
                <span className="font-semibold text-ink">{invite.data.email}</span>.
              </p>
              <Input
                label="Your full name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                minLength={2}
                maxLength={80}
                autoComplete="name"
              />
              <Input
                label="Password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                hint="At least 10 characters with a letter and a number"
                required
                minLength={10}
                autoComplete="new-password"
              />
              <Input
                label="Confirm password"
                type="password"
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                required
                autoComplete="new-password"
              />
              {error ? <Alert>{error}</Alert> : null}
              <Button type="submit" size="lg" disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
                ) : null}
                Create my account
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
