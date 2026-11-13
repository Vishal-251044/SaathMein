'use client';

/**
 * OverviewDashboard — the console home (PRD §10.11 Overview): live users, groups filling,
 * auctions live, purchases and sales today, commission, tokens held, refunds, savings
 * delivered, open disputes and alerts, with a 7-day chart. Live through the staff socket
 * (30 s polling fallback). Panels a role cannot use are not shown (the API also refuses).
 */
import { useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  BellRing,
  Gavel,
  HandCoins,
  IndianRupee,
  Receipt,
  RotateCcw,
  Scale,
  ShoppingBag,
  Sparkles,
  UsersRound,
  Wallet,
} from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { Stagger, StaggerItem } from '@/components/animations/Stagger';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { useAlerts, useDisputesMonitor, useOverview } from '@/hooks/useAdminMonitor';
import { ALERT_SEVERITY_META } from '@/utils/constants';
import { formatDateTime, formatINR } from '@/utils/genericFunctions';
import { PageHeader, Panel, QueryState, StatTile } from './MonitorParts';
import ScopeFilters, { canScope } from './ScopeFilters';
import WeekBars from './WeekBars';

/** @returns {JSX.Element} */
export default function OverviewDashboard() {
  const { staff } = useAdminAuth();
  const [scope, setScope] = useState({ cityId: '', categoryId: '' });
  const overview = useOverview(scope);
  const alerts = useAlerts({ status: 'active', limit: 5 });
  const showDisputes = ['owner', 'admin', 'support'].includes(staff.role);
  const disputes = useDisputesMonitor(showDisputes);
  const data = overview.data;
  const firstName = (staff.name || '').split(' ')[0] || 'there';

  const tiles = data
    ? [
        {
          label: 'Live users',
          value: data.activeConnections ?? '—',
          icon: Activity,
          hint: 'App and dashboard connections',
        },
        { label: 'Groups filling', value: data.groupsFilling, icon: UsersRound },
        { label: 'Auctions live', value: data.auctionsLive, icon: Gavel },
        { label: 'Purchases today', value: data.purchasesToday, icon: ShoppingBag },
        { label: 'Sales today', value: formatINR(data.gmvTodayPaise), icon: IndianRupee },
        { label: 'Commission today', value: formatINR(data.commissionTodayPaise), icon: Receipt },
        {
          label: 'Tokens held',
          value: formatINR(data.tokensHeldPaise),
          icon: Wallet,
          hint: `${data.tokensHeldCount} tokens with SaathMein or on hold`,
        },
        {
          label: 'Refunds today',
          value: formatINR(data.refundsTodayPaise),
          icon: RotateCcw,
          hint: `${data.refundsTodayCount} refunds`,
        },
        {
          label: 'Savings this week',
          value: formatINR(data.savingsWeekPaise),
          icon: HandCoins,
          tone: 'savings',
          hint: 'Buyers saved vs the ceiling price',
        },
        {
          label: 'Open disputes',
          value: data.openDisputes,
          icon: Scale,
          tone: data.openDisputes ? 'warning' : 'default',
        },
        {
          label: 'Open alerts',
          value: data.openAlerts,
          icon: BellRing,
          tone: data.openAlerts ? 'danger' : 'default',
        },
        {
          label: 'AI cost today',
          value: formatINR(data.aiCostTodayPaise),
          icon: Sparkles,
          hint: 'Saathi starts on Day 15',
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Good to see you, ${firstName}`}
        description="Everything happening on SaathMein right now."
        live
        actions={canScope(staff.role) ? <ScopeFilters value={scope} onChange={setScope} /> : null}
      />

      <QueryState query={overview} skeletonClass="h-72">
        <Stagger className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {tiles.map((tile) => (
            <StaggerItem key={tile.label}>
              <StatTile {...tile} />
            </StaggerItem>
          ))}
        </Stagger>
      </QueryState>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Last 7 days">
          <QueryState query={overview}>
            {data ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <WeekBars
                  title="Purchases completed"
                  data={data.last7Days.map((row) => ({ day: row.day, value: row.purchases }))}
                />
                <WeekBars
                  title="Sales (GMV)"
                  data={data.last7Days.map((row) => ({ day: row.day, value: row.gmvPaise }))}
                  format={formatINR}
                />
              </div>
            ) : null}
          </QueryState>
        </Panel>

        <Panel
          title="Alerts"
          actions={
            <Link
              href="/admin/alerts"
              className="inline-flex min-h-11 items-center text-sm font-semibold text-primary-text hover:underline"
            >
              Alerts centre
            </Link>
          }
        >
          <QueryState
            query={alerts}
            isEmpty={alerts.data?.alerts.length === 0}
            emptyText="No open alerts"
          >
            <ul className="flex flex-col divide-y divide-line">
              {(alerts.data?.alerts || []).map((alert) => {
                const severity = ALERT_SEVERITY_META[alert.severity] || ALERT_SEVERITY_META.info;
                return (
                  <li key={alert.id} className="flex items-start gap-3 py-3">
                    <Badge tone={severity.tone}>{severity.label}</Badge>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={alert.link}
                        className="block truncate text-sm font-semibold text-ink hover:underline"
                      >
                        {alert.title}
                      </Link>
                      <p className="text-xs text-muted">
                        {formatDateTime(alert.lastSeenAt)}
                        {alert.count > 1 ? ` · seen ${alert.count} times` : ''}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </QueryState>
        </Panel>
      </div>

      {showDisputes ? (
        <Panel title="Disputes SLA">
          <QueryState query={disputes} skeletonClass="h-24">
            {disputes.data ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <StatTile label="Open" value={disputes.data.open} />
                <StatTile label="Under 1 day" value={disputes.data.byAge.under1d} />
                <StatTile
                  label="1 to 3 days"
                  value={disputes.data.byAge.d1to3}
                  tone={disputes.data.byAge.d1to3 ? 'warning' : 'default'}
                />
                <StatTile
                  label="Over 3 days"
                  value={disputes.data.byAge.over3d}
                  tone={disputes.data.byAge.over3d ? 'danger' : 'default'}
                />
                <StatTile
                  label="Dealer due in 24 h"
                  value={disputes.data.dealerDueNext24h}
                  hint={`${disputes.data.dealerMissed} missed the 48 h reply`}
                />
              </div>
            ) : null}
          </QueryState>
        </Panel>
      ) : null}
    </div>
  );
}
