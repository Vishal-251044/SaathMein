'use client';

/**
 * TwoFactorStep — admin login step 2 (ADL-2).
 * - verify: enter the 6-digit code from the authenticator app, or a backup code.
 * - setup (first login): add SaathMein to an authenticator app, then confirm a code.
 */
import { useState } from 'react';
import { Copy, Check, KeyRound, Loader2, ShieldCheck, Smartphone } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Alert from '@/components/ui/Alert';
import { verifyTwoFactor } from '@/services/adminAuth.service';

/**
 * Show a base32 secret in groups of four for easier typing.
 * @param {string} secret - Base32 secret
 * @returns {string} Grouped secret
 */
const groupSecret = (secret) => secret.replace(/(.{4})/g, '$1 ').trim();

/**
 * @param {Object} props
 * @param {'verify'|'setup'} props.mode - Verify an existing authenticator or set one up
 * @param {string} props.challengeToken - Token from step 1
 * @param {{ secret: string, otpAuthUrl: string }} [props.setup] - Setup data (setup mode)
 * @param {(data: Object) => void} props.onSuccess - Called with the session data
 * @param {() => void} props.onRestart - Back to step 1 (e.g. challenge expired)
 * @returns {JSX.Element}
 */
export default function TwoFactorStep({ mode, challengeToken, setup, onSuccess, onRestart }) {
  const [code, setCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [error, setError] = useState(null);
  const [isExpired, setIsExpired] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const isSetup = mode === 'setup';

  /** Copy the setup key to the clipboard. */
  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(setup.secret);
      setHasCopied(true);
    } catch {
      setHasCopied(false);
    }
  };

  /** Verify the code and finish the login. */
  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const data = await verifyTwoFactor({ challengeToken, code: code.trim() });
      onSuccess(data);
    } catch (err) {
      setError(err.message);
      setIsExpired(err.code === 'CHALLENGE_EXPIRED');
      setCode('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCodeComplete = useBackupCode
    ? code.replace(/[\s-]/g, '').length === 8
    : /^\d{6}$/.test(code);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {isSetup ? (
        <div className="flex flex-col gap-4 rounded-card border border-line bg-bg-band p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <Smartphone
              className="mt-0.5 size-5 shrink-0 text-primary-text"
              strokeWidth={2}
              aria-hidden="true"
            />
            <p className="text-sm text-ink">
              Two-factor authentication is required for every staff account. Open Google
              Authenticator or Authy, choose <strong>Add account → Enter a setup key</strong>, and
              type this key (time-based).
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 break-all rounded-button bg-surface px-4 py-3 font-mono text-sm font-semibold tracking-wider text-ink">
              {groupSecret(setup.secret)}
            </code>
            <Button variant="secondary" onClick={copySecret} aria-label="Copy setup key">
              {hasCopied ? (
                <Check className="size-4" strokeWidth={2} aria-hidden="true" />
              ) : (
                <Copy className="size-4" strokeWidth={2} aria-hidden="true" />
              )}
              {hasCopied ? 'Copied' : 'Copy key'}
            </Button>
          </div>
          <a
            href={setup.otpAuthUrl}
            className="text-sm font-semibold text-primary-text underline-offset-4 hover:underline"
          >
            On this phone? Open directly in your authenticator app
          </a>
        </div>
      ) : null}

      {error ? <Alert>{error}</Alert> : null}

      <Input
        label={
          useBackupCode
            ? 'Backup code'
            : isSetup
              ? 'Code from your authenticator'
              : 'Authenticator code'
        }
        hint={
          useBackupCode
            ? 'One of the 8-character codes you saved, e.g. ABCD-EFGH'
            : '6 digits, changes every 30 seconds'
        }
        value={code}
        onChange={(event) =>
          setCode(
            useBackupCode
              ? event.target.value.toUpperCase()
              : event.target.value.replace(/\D/g, '').slice(0, 6),
          )
        }
        inputMode={useBackupCode ? 'text' : 'numeric'}
        autoComplete="one-time-code"
        maxLength={useBackupCode ? 9 : 6}
        className="font-mono text-lg tracking-[0.3em]"
        autoFocus
      />

      {isExpired ? (
        <Button variant="secondary" size="lg" onClick={onRestart}>
          Sign in again
        </Button>
      ) : (
        <Button type="submit" size="lg" disabled={isSubmitting || !isCodeComplete}>
          {isSubmitting ? (
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          ) : (
            <ShieldCheck className="size-5" strokeWidth={2} aria-hidden="true" />
          )}
          {isSubmitting ? 'Verifying…' : isSetup ? 'Turn on 2FA and sign in' : 'Verify and sign in'}
        </Button>
      )}

      {!isSetup ? (
        <button
          type="button"
          onClick={() => {
            setUseBackupCode((value) => !value);
            setCode('');
            setError(null);
          }}
          className="inline-flex min-h-11 items-center justify-center gap-2 self-center rounded-button px-3 text-sm font-semibold text-muted hover:text-ink"
        >
          <KeyRound className="size-4" strokeWidth={2} aria-hidden="true" />
          {useBackupCode ? 'Use authenticator code instead' : 'Lost your phone? Use a backup code'}
        </button>
      ) : null}
    </form>
  );
}
