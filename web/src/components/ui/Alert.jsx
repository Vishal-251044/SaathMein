/**
 * Alert — inline message box for errors, warnings and information.
 */
import { CircleAlert, Info, TriangleAlert } from 'lucide-react';
import { cn } from '@/utils/genericFunctions';

const TONES = {
  error: { icon: CircleAlert, classes: 'border-danger/30 bg-danger/10 text-danger' },
  warning: { icon: TriangleAlert, classes: 'border-warning/30 bg-warning/10 text-ink' },
  info: { icon: Info, classes: 'border-line bg-bg-band text-ink' },
};

/**
 * @param {Object} props
 * @param {'error'|'warning'|'info'} [props.tone='error'] - Visual tone
 * @param {React.ReactNode} props.children - Message
 * @param {string} [props.className] - Extra classes
 * @returns {JSX.Element}
 */
export default function Alert({ tone = 'error', children, className }) {
  const { icon: Icon, classes } = TONES[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 rounded-button border px-4 py-3 text-sm',
        classes,
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
      <div className="min-w-0 font-medium">{children}</div>
    </div>
  );
}
