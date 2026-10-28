'use client';

/**
 * AdminDashboardHome — the console home for Day 2: who is signed in, how the session is
 * protected, and which console modules arrive on which roadmap day.
 */
import { Clock, ShieldCheck, UserRound } from 'lucide-react';
import FadeIn from '@/components/animations/FadeIn';
import { Stagger, StaggerItem } from '@/components/animations/Stagger';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { navItemsForRole } from '@/components/features/admin/adminNav';
import { STAFF_ROLE_LABELS } from '@/utils/constants';

/**
 * @returns {JSX.Element}
 */
export default function AdminDashboardHome() {
  const { staff } = useAdminAuth();
  const upcoming = navItemsForRole(staff.role).filter((item) => item.availableOn);
  const firstName = (staff.name || '').split(' ')[0] || 'there';

  const facts = [
    {
      icon: UserRound,
      label: 'Signed in as',
      value: `${STAFF_ROLE_LABELS[staff.role] || staff.role} · ${staff.email}`,
    },
    {
      icon: ShieldCheck,
      label: 'Two-step verification',
      value: staff.twoFactorEnabled ? 'On' : 'Off',
    },
    { icon: Clock, label: 'Session', value: 'Ends after 8 hours, or 30 minutes without activity' },
  ];

  return (
    <div className="flex flex-col gap-8">
      <FadeIn>
        <h1 className="text-[clamp(1.5rem,3vw,2rem)] font-extrabold tracking-tight text-ink">
          Welcome, {firstName}
        </h1>
        <p className="mt-1 text-muted">The SaathMein console. Live monitoring arrives on Day 13.</p>
      </FadeIn>

      <Stagger className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {facts.map(({ icon: Icon, label, value }) => (
          <StaggerItem
            key={label}
            className="rounded-card border border-line bg-surface p-5 shadow-card"
          >
            <Icon className="size-5 text-primary" strokeWidth={2} aria-hidden="true" />
            <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted">
              {label}
            </p>
            <p className="mt-1 break-words text-sm font-semibold text-ink">{value}</p>
          </StaggerItem>
        ))}
      </Stagger>

      <FadeIn>
        <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
          <h2 className="text-lg font-bold text-ink">Coming to this console</h2>
          <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {upcoming.map(({ label, icon: Icon, availableOn }) => (
              <li
                key={label}
                className="flex min-h-11 items-center gap-3 rounded-button bg-bg-band px-3"
              >
                <Icon className="size-4 shrink-0 text-muted" strokeWidth={2} aria-hidden="true" />
                <span className="flex-1 text-sm font-semibold text-ink">{label}</span>
                <span className="text-xs font-semibold text-muted">{availableOn}</span>
              </li>
            ))}
          </ul>
        </section>
      </FadeIn>
    </div>
  );
}
