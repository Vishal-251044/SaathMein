'use client';

/**
 * PeopleCounter — signature UI element (PRD §14.1): a row of avatars that fills up
 * with a Sunrise progress bar, e.g. "14 of 20 joined". Used on every group card.
 */
import { motion, useReducedMotion } from 'framer-motion';
import { DURATION, EASE } from '@/utils/animations';
import { formatMemberCount } from '@/utils/genericFunctions';

const MAX_AVATARS = 5;

/**
 * @param {Object} props
 * @param {number} props.count - Members joined
 * @param {number} props.target - Target group size
 * @param {string[]} [props.initials=[]] - Member initials (first names only, for privacy)
 * @returns {JSX.Element}
 */
export default function PeopleCounter({ count, target, initials = [] }) {
  const reduceMotion = useReducedMotion();
  const progress = Math.min(1, target > 0 ? count / target : 0);
  const shown = initials.slice(0, MAX_AVATARS);
  const extra = count - shown.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex -space-x-2" aria-hidden="true">
          {shown.map((letter, index) => (
            <span
              key={`${letter}-${index}`}
              className="grid size-8 place-items-center rounded-full border-2 border-surface bg-bg-band text-xs font-bold text-ink"
            >
              {letter}
            </span>
          ))}
          {extra > 0 && (
            <span className="grid size-8 place-items-center rounded-full border-2 border-surface bg-ink text-[11px] font-bold text-bg">
              +{extra}
            </span>
          )}
        </div>
        <p className="text-sm font-semibold text-ink">
          {formatMemberCount(count, target)} <span className="font-medium text-muted">joined</span>
        </p>
      </div>

      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-bg-band"
        role="progressbar"
        aria-label="Group progress"
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={count}
      >
        {/* scaleX instead of width keeps the animation on the GPU */}
        <motion.div
          className="h-full origin-left rounded-full bg-sunrise"
          initial={{ scaleX: reduceMotion ? progress : 0 }}
          whileInView={{ scaleX: progress }}
          viewport={{ once: true }}
          transition={{ duration: DURATION.slow * 2, ease: EASE.out }}
        />
      </div>
    </div>
  );
}
