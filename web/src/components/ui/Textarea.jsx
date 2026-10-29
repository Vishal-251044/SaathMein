/**
 * Textarea — labelled multi-line field with hint and error text.
 */
import { useId } from 'react';
import { cn } from '@/utils/genericFunctions';

/**
 * @param {Object} props
 * @param {string} props.label - Visible label
 * @param {string} [props.error] - Error message
 * @param {string} [props.hint] - Helper text
 * @returns {JSX.Element}
 */
export default function Textarea({ label, error, hint, className, id, rows = 3, ...rest }) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <textarea
        id={fieldId}
        rows={rows}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        className={cn(
          'w-full rounded-button border bg-surface px-4 py-3 text-base text-ink',
          'placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15',
          error ? 'border-danger' : 'border-line',
          className,
        )}
        {...rest}
      />
      {error ? (
        <p id={`${fieldId}-error`} className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
