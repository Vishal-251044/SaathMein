'use client';

/**
 * GroupsMonitor — groups by status, groups near their target, groups expiring in 24 h and
 * active community groups (PRD §10.11 Group monitor), with actions: extend the deadline
 * and cancel (every token refunded). Actions need a reason and are audited.
 */
import { useState } from 'react';
import Link from 'next/link';
import { Ban, CalendarPlus } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { useGroupsMonitor, useMonitorAction } from '@/hooks/useAdminMonitor';
import { GROUP_STATUS_META } from '@/utils/constants';
import { formatDateTime } from '@/utils/genericFunctions';
import { NumberField, PageHeader, Panel, QueryState, ReasonDialog, StatTile } from './MonitorParts';
import ScopeFilters, { canScope } from './ScopeFilters';

const OPS_ROLES = ['owner', 'admin', 'deal_manager'];

/**
 * Dialog configs for a group (shared with the Groups list).
 * @param {{ id: string, productName?: string }} group
 */
export const groupActions = (group) => ({
  extend: {
    title: `Extend ${group.productName || 'this group'}`,
    confirmLabel: 'Extend deadline',
    path: `groups/${group.id}/extend`,
    initial: { days: '3' },
    fields: (values, set) => (
      <NumberField
        label="Extra time"
        value={values.days}
        onChange={(v) => set('days', v)}
        min={1}
        max={30}
        suffix="days"
      />
    ),
    body: (values) => ({ days: Number.parseInt(values.days, 10) }),
  },
  cancel: {
    title: `Cancel ${group.productName || 'this group'}`,
    description: 'Every member gets a full refund of their token. This cannot be undone.',
    confirmLabel: 'Cancel and refund everyone',
    danger: true,
    path: `groups/${group.id}/cancel`,
  },
});

/** Row with optional actions. */
function GroupRow({ group, canAct, onAction }) {
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">
          {group.productName || 'Unknown product'}
        </p>
        <p className="text-xs text-muted">
          <span className="font-mono">
            {group.memberCount} / {group.targetSize}
          </span>{' '}
          · ends {formatDateTime(group.deadline)}
          {group.visibility === 'community' ? ' · community' : ''}
        </p>
      </div>
      {canAct ? (
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => onAction(group, 'extend')}
            aria-label={`Extend ${group.productName || 'group'}`}
          >
            <CalendarPlus className="size-4" strokeWidth={2} aria-hidden="true" />
            <span className="hidden sm:inline">Extend</span>
          </Button>
          <Button
            variant="secondary"
            onClick={() => onAction(group, 'cancel')}
            className="text-danger-text"
            aria-label={`Cancel ${group.productName || 'group'}`}
          >
            <Ban className="size-4" strokeWidth={2} aria-hidden="true" />
            <span className="hidden sm:inline">Cancel</span>
          </Button>
        </div>
      ) : null}
    </li>
  );
}

/** @returns {JSX.Element} */
export default function GroupsMonitor() {
  const { staff } = useAdminAuth();
  const [scope, setScope] = useState({ cityId: '', categoryId: '' });
  const query = useGroupsMonitor(scope);
  const action = useMonitorAction();
  const [dialog, setDialog] = useState(null);
  const canAct = OPS_ROLES.includes(staff.role);
  const data = query.data;

  const onAction = (group, key) => {
    const config = groupActions(group)[key];
    setDialog({
      ...config,
      onConfirm: (values) =>
        action.mutateAsync({
          path: config.path,
          body: { ...(config.body ? config.body(values) : {}), reason: values.reason },
        }),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Group monitor"
        description="Groups filling up, close to target or about to expire."
        live
        actions={
          <>
            {canScope(staff.role) ? <ScopeFilters value={scope} onChange={setScope} /> : null}
            <Button variant="secondary" href="/admin/groups">
              All groups
            </Button>
          </>
        }
      />

      <QueryState query={query} skeletonClass="h-24">
        {data ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            {['open', 'full', 'auction_live', 'won', 'purchasing', 'runner_up'].map((status) => (
              <StatTile
                key={status}
                label={GROUP_STATUS_META[status].label}
                value={data.byStatus[status] || 0}
              />
            ))}
            <StatTile label="Community active" value={data.communityActive} />
            <StatTile label="Completed" value={data.byStatus.completed || 0} />
            <StatTile label="Expired" value={data.byStatus.expired || 0} />
            <StatTile label="No deal" value={data.byStatus.no_deal || 0} />
            <StatTile label="Cancelled" value={data.byStatus.cancelled || 0} />
          </div>
        ) : null}
      </QueryState>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title="Near target, deadline within 24 h"
          actions={<Badge tone="warning">Push these</Badge>}
        >
          <QueryState
            query={query}
            isEmpty={data?.nearTarget.length === 0}
            emptyText="No group is close to target"
          >
            <ul className="divide-y divide-line">
              {(data?.nearTarget || []).map((group) => (
                <GroupRow key={group.id} group={group} canAct={canAct} onAction={onAction} />
              ))}
            </ul>
          </QueryState>
        </Panel>
        <Panel title="Expiring in 24 h">
          <QueryState
            query={query}
            isEmpty={data?.expiring24h.length === 0}
            emptyText="No group expires in the next 24 hours"
          >
            <ul className="divide-y divide-line">
              {(data?.expiring24h || []).map((group) => (
                <GroupRow key={group.id} group={group} canAct={canAct} onAction={onAction} />
              ))}
            </ul>
          </QueryState>
        </Panel>
      </div>
      <p className="text-sm text-muted">
        To act on any other group, open it from{' '}
        <Link href="/admin/groups" className="font-semibold text-primary-text hover:underline">
          All groups
        </Link>{' '}
        or the auction monitor.
      </p>

      <ReasonDialog
        action={dialog}
        onConfirm={(values) => dialog.onConfirm(values)}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}
