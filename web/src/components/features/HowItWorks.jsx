/**
 * HowItWorks — the three-step SaathMein loop (PRD §01): join, dealers bid, everyone saves.
 */
import { Users, Gavel, BadgeIndianRupee } from 'lucide-react';
import { Stagger, StaggerItem } from '@/components/animations/Stagger';

const STEPS = [
  {
    icon: Users,
    title: 'Join a group',
    body: 'People who want the same product in the same city join one group with a small refundable token.',
  },
  {
    icon: Gavel,
    title: 'Dealers bid, lowest wins',
    body: 'When the group is full, verified dealers bid live. Every bid must beat the last. The lowest price wins.',
  },
  {
    icon: BadgeIndianRupee,
    title: 'Everyone saves',
    body: 'Every member gets a deal code for the winning dealer at the locked price, paid safely through Razorpay.',
  },
];

/**
 * @returns {JSX.Element}
 */
export default function HowItWorks() {
  return (
    <Stagger as="ol" className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
      {STEPS.map(({ icon: Icon, title, body }, index) => (
        <StaggerItem
          as="li"
          key={title}
          className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6"
        >
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-button bg-sunrise text-white">
              <Icon className="size-5" strokeWidth={2} aria-hidden="true" />
            </span>
            <span className="font-mono text-sm font-semibold text-muted">0{index + 1}</span>
          </div>
          <h3 className="mt-4 text-lg font-bold text-ink">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
        </StaggerItem>
      ))}
    </Stagger>
  );
}
