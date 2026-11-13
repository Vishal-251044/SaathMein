/**
 * Input — labelled text field with hint and error text, 44 px minimum height.
 */
import { useId } from 'react';
import { cn } from '@/utils/genericFunctions';

/**
 * @param {Object} props
 * @param {string} props.label - Visible label
 * @param {string} [props.error] - Error message (marks the field invalid)
 * @param {string} [props.hint] - Helper text under the field
 * @param {string} [props.className] - Extra classes for the input
 * @returns {JSX.Element}
 */
export default function Input({ label, error, hint, className, id, ...rest }) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        className={cn(
          'min-h-11 w-full rounded-button border bg-surface px-4 text-base text-ink',
          'placeholder:text-muted/70 transition-[border-color,box-shadow] duration-150',
          'focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15',
          error ? 'border-danger' : 'border-line',
          className,
        )}
        {...rest}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-sm font-medium text-danger-text">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
