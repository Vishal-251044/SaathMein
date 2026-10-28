'use client';

/**
 * BackupCodesStep — shown once after 2FA setup: the 10 one-time backup codes (ADL-2).
 * The server never shows them again, so the user must save them before continuing.
 */
import { useState } from 'react';
import { Copy, Check, Download, ArrowRight } from 'lucide-react';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';

/**
 * @param {Object} props
 * @param {string[]} props.codes - Backup codes
 * @param {string} props.email - Staff email (used in the download file)
 * @param {() => void} props.onContinue - Called once the user confirms they saved the codes
 * @returns {JSX.Element}
 */
export default function BackupCodesStep({ codes, email, onContinue }) {
  const [hasConfirmed, setHasConfirmed] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const text = codes.join('\n');

  /** Copy all codes to the clipboard. */
  const copyCodes = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setHasCopied(true);
    } catch {
      setHasCopied(false);
    }
  };

  /** Download the codes as a text file. */
  const downloadCodes = () => {
    const content = `SaathMein admin backup codes for ${email}\nEach code works once.\n\n${text}\n`;
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'saathmein-backup-codes.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-5">
      <Alert tone="warning">
        Save these backup codes somewhere safe. Each one works once if you lose your phone. They
        will not be shown again.
      </Alert>

      <ol className="grid grid-cols-2 gap-2 rounded-card border border-line bg-bg-band p-4">
        {codes.map((code) => (
          <li
            key={code}
            className="font-mono text-sm font-semibold tracking-wider text-ink sm:text-base"
          >
            {code}
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button variant="secondary" onClick={copyCodes}>
          {hasCopied ? (
            <Check className="size-4" strokeWidth={2} aria-hidden="true" />
          ) : (
            <Copy className="size-4" strokeWidth={2} aria-hidden="true" />
          )}
          {hasCopied ? 'Copied' : 'Copy codes'}
        </Button>
        <Button variant="secondary" onClick={downloadCodes}>
          <Download className="size-4" strokeWidth={2} aria-hidden="true" />
          Download .txt
        </Button>
      </div>

      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-ink">
        <input
          type="checkbox"
          checked={hasConfirmed}
          onChange={(event) => setHasConfirmed(event.target.checked)}
          className="size-5 accent-[var(--sm-primary)]"
        />
        I have saved my backup codes
      </label>

      <Button size="lg" onClick={onContinue} disabled={!hasConfirmed}>
        Go to the console
        <ArrowRight className="size-5" strokeWidth={2} aria-hidden="true" />
      </Button>
    </div>
  );
}
