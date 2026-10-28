'use client';

/**
 * AdminLoginFlow — the staff sign-in wizard at /admin/login:
 * credentials → 2FA (verify, or setup on first login) → backup codes (setup only).
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import { LogoMark } from '@/components/ui/Logo';
import CredentialsStep from '@/components/features/admin/CredentialsStep';
import TwoFactorStep from '@/components/features/admin/TwoFactorStep';
import BackupCodesStep from '@/components/features/admin/BackupCodesStep';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { DURATION, EASE } from '@/utils/animations';
import { ROUTES } from '@/utils/constants';

const STEP_COPY = {
  credentials: { title: 'Admin sign in', subtitle: 'SaathMein Owner and staff console' },
  verify: {
    title: 'Two-step verification',
    subtitle: 'Enter the code from your authenticator app',
  },
  setup: {
    title: 'Set up two-step verification',
    subtitle: 'Required once for every staff account',
  },
  backup: { title: 'Save your backup codes', subtitle: 'Your account is now protected with 2FA' },
};

/**
 * @returns {JSX.Element}
 */
export default function AdminLoginFlow() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { status, notice, completeLogin } = useAdminAuth();
  const [step, setStep] = useState('credentials');
  const [challenge, setChallenge] = useState(null);
  const [email, setEmail] = useState('');
  const [pendingSession, setPendingSession] = useState(null);

  // Already signed in (and not in the middle of saving backup codes) → go to the console
  useEffect(() => {
    if (status === 'signedIn' && step !== 'backup') router.replace(ROUTES.ADMIN);
  }, [status, step, router]);

  /** Password accepted: show the right 2FA step. */
  const handleCredentials = (result, enteredEmail) => {
    setChallenge(result);
    setEmail(enteredEmail);
    setStep(result.step === 'setup_2fa' ? 'setup' : 'verify');
  };

  /** 2FA accepted: show backup codes once (setup), otherwise sign in now. */
  const handleTwoFactor = (data) => {
    if (data.backupCodes?.length) {
      setPendingSession(data);
      setStep('backup');
      return;
    }
    completeLogin(data);
  };

  const restart = () => {
    setChallenge(null);
    setStep('credentials');
  };

  const copy = STEP_COPY[step];
  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, x: 24 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -24 },
        transition: { duration: DURATION.base, ease: EASE.out },
      };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg-band px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <LogoMark size={48} />
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">{copy.title}</h1>
          <p className="mt-1 text-sm text-muted">{copy.subtitle}</p>
        </div>

        <div className="overflow-hidden rounded-card border border-line bg-surface p-5 shadow-card sm:p-7">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step} {...motionProps}>
              {step === 'credentials' ? (
                <CredentialsStep onSuccess={handleCredentials} notice={notice} />
              ) : null}
              {step === 'verify' || step === 'setup' ? (
                <TwoFactorStep
                  mode={step}
                  challengeToken={challenge.challengeToken}
                  setup={challenge.setup}
                  onSuccess={handleTwoFactor}
                  onRestart={restart}
                />
              ) : null}
              {step === 'backup' ? (
                <BackupCodesStep
                  codes={pendingSession.backupCodes}
                  email={email}
                  onContinue={() => {
                    completeLogin(pendingSession);
                    router.replace(ROUTES.ADMIN);
                  }}
                />
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>

        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted">
          <ShieldCheck className="size-4" strokeWidth={2} aria-hidden="true" />
          Protected area. Every action is logged.
        </p>
      </div>
    </main>
  );
}
