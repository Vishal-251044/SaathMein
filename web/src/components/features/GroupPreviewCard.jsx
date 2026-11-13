/**
 * GroupPreviewCard — an example live group, shown on the landing page to explain the idea.
 * Mirrors the PRD cover example (Tata Nexon EV, Pune). Clearly labelled as an example.
 */
import { BadgeCheck, MapPin, Sparkles } from 'lucide-react';
import PeopleCounter from '@/components/features/PeopleCounter';
import { formatINR } from '@/utils/genericFunctions';

const EXAMPLE = {
  product: 'Tata Nexon EV',
  city: 'Pune',
  count: 14,
  target: 20,
  initials: ['R', 'P', 'A', 'M', 'S'],
  tierLabel: 'Tier 2 unlocked',
  savingPaise: 6800000, // ₹68,000
  aiHint: '6 more joins could take it to about ₹82,000 off',
};

/**
 * @returns {JSX.Element}
 */
export default function GroupPreviewCard() {
  return (
    <article
      className="w-full rounded-card border border-line bg-surface p-5 shadow-card sm:p-6"
      aria-label="Example group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Example group</p>
          <h3 className="mt-1 truncate text-lg font-bold text-ink">{EXAMPLE.product}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-muted">
            <MapPin className="size-4" strokeWidth={2} aria-hidden="true" />
            {EXAMPLE.city}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs font-semibold text-muted">You save</p>
          <p className="text-xl font-extrabold text-savings-text">
            {formatINR(EXAMPLE.savingPaise)}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <PeopleCounter count={EXAMPLE.count} target={EXAMPLE.target} initials={EXAMPLE.initials} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-savings-soft px-3 py-1.5 text-xs font-semibold text-savings-text">
          <BadgeCheck className="size-4" strokeWidth={2} aria-hidden="true" />
          {EXAMPLE.tierLabel}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-ai-soft px-3 py-1.5 text-xs font-semibold text-ai-text">
          <Sparkles className="size-4" strokeWidth={2} aria-hidden="true" />
          Saathi AI: {EXAMPLE.aiHint}
        </span>
      </div>
    </article>
  );
}
