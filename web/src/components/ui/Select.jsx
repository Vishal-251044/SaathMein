/**
 * Select — labelled native select with hint and error text, 44 px minimum height.
 */
import { useId } from 'react';
import { cn } from '@/utils/genericFunctions';

/**
 * @param {Object} props
 * @param {string} props.label - Visible label
 * @param {string} [props.error] - Error message
 * @param {string} [props.hint] - Helper text
 * @param {React.ReactNode} props.children - <option> elements
 * @returns {JSX.Element}
 */
export default function Select({ label, error, hint, className, id, children, ...rest }) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const describedBy = error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <select
        id={selectId}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        className={cn(
          'min-h-11 w-full rounded-button border bg-surface px-3 text-base text-ink',
          'focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15',
          error ? 'border-danger' : 'border-line',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      {error ? (
        <p id={`${selectId}-error`} className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${selectId}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
