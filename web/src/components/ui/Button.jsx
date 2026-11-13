/**
 * Button — the one button component for the web app.
 * Variants: primary (Sunrise gradient), secondary (outline), ghost.
 * Renders a Next.js Link when `href` is given. Minimum 44 px touch target.
 */
import Link from 'next/link';
import { cn } from '@/utils/genericFunctions';

const BASE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-button px-5 text-sm font-semibold ' +
  'transition-[transform,opacity,box-shadow] duration-150 active:scale-[0.97] ' +
  'disabled:pointer-events-none disabled:opacity-50';

const VARIANTS = {
  // Soft shadow keeps white labels readable on the gradient (WCAG, Day 14)
  primary:
    'bg-sunrise text-white shadow-pop hover:opacity-95 [text-shadow:0_1px_2px_rgb(18_19_31/0.35)]',
  secondary: 'border border-line bg-surface text-ink hover:bg-bg-band',
  ghost: 'text-ink hover:bg-bg-band',
};

const SIZES = {
  md: 'h-11',
  lg: 'h-13 px-6 text-base',
};

/**
 * @param {Object} props
 * @param {'primary'|'secondary'|'ghost'} [props.variant='primary'] - Visual style
 * @param {'md'|'lg'} [props.size='md'] - Size
 * @param {string} [props.href] - When set, renders a link
 * @param {string} [props.className] - Extra classes
 * @param {React.ReactNode} props.children - Label (and optional icon)
 * @returns {JSX.Element}
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  href,
  className,
  children,
  ...rest
}) {
  const classes = cn(BASE, VARIANTS[variant], SIZES[size], className);

  if (href) {
    return (
      <Link href={href} className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  );
}
