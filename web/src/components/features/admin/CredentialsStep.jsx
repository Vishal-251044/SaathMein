'use client';

/**
 * CredentialsStep — admin login step 1: email and password (ADL-1).
 */
import { useState } from 'react';
import { Loader2, LogIn } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Alert from '@/components/ui/Alert';
import { loginWithPassword } from '@/services/adminAuth.service';

/**
 * @param {Object} props
 * @param {(result: Object, email: string) => void} props.onSuccess - Called with the login step result
 * @param {string|null} [props.notice] - Message from a previous sign-out (e.g. idle timeout)
 * @returns {JSX.Element}
 */
export default function CredentialsStep({ onSuccess, notice }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /** Submit credentials and move to the 2FA step. */
  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await loginWithPassword({ email: email.trim(), password });
      setPassword('');
      onSuccess(result, email.trim());
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {notice ? <Alert tone="info">{notice}</Alert> : null}
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
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        ) : (
          <LogIn className="size-5" strokeWidth={2} aria-hidden="true" />
        )}
        {isSubmitting ? 'Checking…' : 'Continue'}
      </Button>
    </form>
  );
}
