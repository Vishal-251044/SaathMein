/**
 * Logo — the SaathMein mark (three people above a smile) with the lowercase wordmark.
 * The smile also reads as a price curve dipping down (PRD §14.1).
 */
import { useId } from 'react';
import { cn } from '@/utils/genericFunctions';

/**
 * The app-icon mark on the Sunrise gradient.
 * @param {Object} props
 * @param {number} [props.size=36] - Width and height in px
 * @param {string} [props.className] - Extra classes
 * @returns {JSX.Element}
 */
export function LogoMark({ size = 36, className }) {
  // Unique gradient id so several logos on one page do not clash
  const gradientId = `sm-logo-${useId()}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="SaathMein"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF8A1F" />
          <stop offset=".52" stopColor="#FF4D5E" />
          <stop offset="1" stopColor="#B43CF5" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="19" fill={`url(#${gradientId})`} />
      <circle cx="21.5" cy="24.5" r="5.3" fill="#FFFFFF" />
      <circle cx="32" cy="19.5" r="5.3" fill="#FFFFFF" />
      <circle cx="42.5" cy="24.5" r="5.3" fill="#FFFFFF" />
      <path
        d="M16 37.5c4.6 6.9 10 10 16 10s11.4-3.1 16-10"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="5.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Mark + "saathmein" wordmark lockup.
 * @param {Object} props
 * @param {number} [props.size=32] - Mark size in px
 * @param {string} [props.className] - Extra classes
 * @returns {JSX.Element}
 */
export default function Logo({ size = 32, className }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark size={size} />
      <span className="text-lg font-extrabold tracking-tight text-ink">saathmein</span>
    </span>
  );
}
