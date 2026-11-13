/**
 * Badge — small status pill. Tones: muted, brand, warning, danger.
 * (Mint is reserved for money saved, so statuses never use it.)
 */
import { cn } from '@/utils/genericFunctions';

const TONES = {
  muted: 'bg-bg-band text-muted',
  brand: 'bg-primary/10 text-primary-text',
  warning: 'bg-warning/15 text-ink',
  danger: 'bg-danger/10 text-danger-text',
};

/**
 * @param {Object} props
 * @param {'muted'|'brand'|'warning'|'danger'} [props.tone='muted'] - Colour
 * @param {React.ReactNode} props.children - Label (and optional icon)
 * @param {string} [props.className] - Extra classes
 * @returns {JSX.Element}
 */
export default function Badge({ tone = 'muted', children, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
