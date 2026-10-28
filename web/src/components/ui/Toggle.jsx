'use client';

/**
 * Toggle — accessible on/off switch (role="switch"), 44 px touch target.
 */
import { cn } from '@/utils/genericFunctions';

/**
 * @param {Object} props
 * @param {boolean} props.checked - Current state
 * @param {(next: boolean) => void} props.onChange - Called with the new state
 * @param {string} props.label - Accessible label
 * @param {boolean} [props.disabled] - Disable the switch
 * @returns {JSX.Element}
 */
export default function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="grid min-h-11 min-w-11 place-items-center disabled:opacity-50"
    >
      <span
        className={cn(
          'relative h-6 w-11 rounded-full transition-colors duration-150',
          checked ? 'bg-savings' : 'bg-line',
        )}
      >
        <span
          className={cn(
            'absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform duration-150',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </span>
    </button>
  );
}
