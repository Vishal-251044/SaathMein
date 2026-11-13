'use client';

/**
 * Shared pieces of the console monitors: page header with the live indicator, stat tiles,
 * panels, loading / error / empty states, a pager and the reason dialog every staff
 * action goes through (reason note required, PRD §10.11).
 */
import { useEffect, useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Inbox, Loader2, RefreshCw, X } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';
import { useStaffSocketConnected } from '@/hooks/useAdminMonitor';
import { DURATION, EASE } from '@/utils/animations';
import { cn } from '@/utils/genericFunctions';

/** "Live" (socket connected) or "Refreshing every 30 s" (polling fallback). */
export function LiveIndicator() {
  const live = useStaffSocketConnected();
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-muted"
      role="status"
    >
      <span
        className={cn('size-2 rounded-full', live ? 'bg-primary animate-pulse' : 'bg-muted')}
        aria-hidden="true"
      />
      {live ? 'Live' : 'Refreshing every 30 s'}
    </span>
  );
}

/**
 * @param {Object} props
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {React.ReactNode} [props.actions] - Buttons on the right
 * @param {boolean} [props.live] - Show the live indicator
 */
export function PageHeader({ title, description, actions, live = false }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">{title}</h1>
          {live ? <LiveIndicator /> : null}
        </div>
        {description ? <p className="mt-1 text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/**
 * Headline number.
 * @param {Object} props
 * @param {string} props.label
 * @param {React.ReactNode} props.value
 * @param {string} [props.hint] - Small text under the value
 * @param {React.ComponentType} [props.icon] - Lucide icon
 * @param {'default'|'savings'|'warning'|'danger'} [props.tone]
 */
export function StatTile({ label, value, hint, icon: Icon, tone = 'default' }) {
  const valueTone = {
    default: 'text-ink',
    savings: 'text-savings-text',
    warning: 'text-ink',
    danger: 'text-danger-text',
  }[tone];
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-1 rounded-card border bg-surface p-4 shadow-card',
        tone === 'warning'
          ? 'border-warning/40'
          : tone === 'danger'
            ? 'border-danger/30'
            : 'border-line',
      )}
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
        {Icon ? <Icon className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" /> : null}
        <span className="truncate">{label}</span>
      </div>
      <p className={cn('truncate font-mono text-2xl font-bold', valueTone)}>{value}</p>
      {hint ? <p className="truncate text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

/** Card section with a title. */
export function Panel({ title, actions, children, className }) {
  return (
    <section
      className={cn(
        'min-w-0 rounded-card border border-line bg-surface p-4 shadow-card sm:p-5',
        className,
      )}
    >
      {title || actions ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {title ? <h2 className="flex-1 text-base font-bold text-ink">{title}</h2> : null}
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/**
 * Loading skeleton, error with retry, or empty state; renders children when ready.
 * @param {Object} props
 * @param {import('@tanstack/react-query').UseQueryResult} props.query
 * @param {boolean} [props.isEmpty]
 * @param {string} [props.emptyText]
 * @param {string} [props.skeletonClass]
 * @param {React.ReactNode} props.children
 */
export function QueryState({
  query,
  isEmpty = false,
  emptyText = 'Nothing here yet',
  skeletonClass = 'h-48',
  children,
}) {
  if (query.isError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Alert>{query.error.message}</Alert>
        <Button variant="secondary" onClick={() => query.refetch()}>
          <RefreshCw className="size-4" strokeWidth={2} aria-hidden="true" />
          Try again
        </Button>
      </div>
    );
  }
  if (query.isPending) {
    return (
      <div
        className={cn('animate-pulse rounded-card bg-bg-band', skeletonClass)}
        aria-busy="true"
      />
    );
  }
  if (isEmpty) {
    return (
      <div className="flex flex-col items-center rounded-card border border-dashed border-line px-6 py-10 text-center">
        <Inbox className="size-7 text-muted" strokeWidth={1.75} aria-hidden="true" />
        <p className="mt-2 text-sm font-semibold text-ink">{emptyText}</p>
      </div>
    );
  }
  return children;
}

/** Previous / next page buttons. */
export function Pager({ meta, page, onPage, noun = 'rows' }) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-muted">
        Page {meta.page} of {meta.totalPages} · {meta.total} {noun}
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" strokeWidth={2} aria-hidden="true" />
        </Button>
        <Button
          variant="secondary"
          onClick={() => onPage(page + 1)}
          disabled={page >= meta.totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" strokeWidth={2} aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

/** Table container that scrolls on phones. */
export function TableWrap({ children, minWidth = 760, dim = false }) {
  return (
    <div
      className={cn(
        'overflow-x-auto rounded-card border border-line bg-surface shadow-card transition-opacity',
        dim && 'opacity-70',
      )}
    >
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

/** Table header row from labels. */
export function TableHead({ columns }) {
  return (
    <thead className="border-b border-line text-xs font-semibold uppercase tracking-wider text-muted">
      <tr>
        {columns.map((column) => (
          <th key={column} scope="col" className="px-4 py-3">
            {column}
          </th>
        ))}
      </tr>
    </thead>
  );
}

/**
 * Confirm a staff action with a reason note (min 10 characters) and optional fields.
 * @param {Object} props
 * @param {{ title: string, description?: string, confirmLabel: string, danger?: boolean,
 *   fields?: (state: Object, set: Function) => React.ReactNode, initial?: Object } | null} props.action
 * @param {(values: Object) => Promise<void>} props.onConfirm - Receives { reason, ...fields }
 * @param {() => void} props.onClose
 */
export function ReasonDialog({ action, onConfirm, onClose }) {
  return (
    <AnimatePresence>
      {action ? <ReasonForm action={action} onConfirm={onConfirm} onClose={onClose} /> : null}
    </AnimatePresence>
  );
}

/** The dialog body; mounted fresh on every open, so its fields start from `action.initial`. */
function ReasonForm({ action, onConfirm, onClose }) {
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const [values, setValues] = useState(() => action.initial || {});
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (key, value) => setValues((prev) => ({ ...prev, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    if (reason.trim().length < 10) {
      setError('Write a reason (at least 10 characters). It goes to the audit log.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onConfirm({ ...values, reason: reason.trim() });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end sm:place-items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <motion.button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-ink/40"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: DURATION.fast }}
      />
      <motion.form
        onSubmit={submit}
        className="relative m-0 w-full max-w-lg rounded-t-card bg-surface p-5 shadow-pop sm:m-4 sm:rounded-card sm:p-6"
        initial={reduceMotion ? { opacity: 0 } : { y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { y: 24, opacity: 0 }}
        transition={{ duration: DURATION.base, ease: EASE.out }}
      >
        <div className="flex items-start gap-3">
          <h2 id={titleId} className="flex-1 text-lg font-bold text-ink">
            {action.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-m-2 grid size-11 place-items-center rounded-button text-muted hover:bg-bg-band"
          >
            <X className="size-5" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        {action.description ? (
          <p className="mt-1 text-sm text-muted">{action.description}</p>
        ) : null}
        <div className="mt-4 flex flex-col gap-4">
          {action.fields ? action.fields(values, set) : null}
          <Textarea
            label="Reason (saved in the audit log)"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            maxLength={1000}
            required
          />
          {error ? <Alert>{error}</Alert> : null}
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSaving}
            className={action.danger ? 'bg-danger! bg-none! text-white' : undefined}
          >
            {isSaving ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
            ) : null}
            {action.confirmLabel}
          </Button>
        </div>
      </motion.form>
    </div>
  );
}

/** Small number field for dialogs (hours, days, rupees). */
export function NumberField({ label, value, onChange, min, max, suffix }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
      {label}
      <span className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-11 w-32 rounded-button border border-line bg-surface px-3 font-mono text-ink focus:border-primary focus:outline-none"
        />
        {suffix ? <span className="text-sm font-normal text-muted">{suffix}</span> : null}
      </span>
    </label>
  );
}
