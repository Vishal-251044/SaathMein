'use client';

/**
 * SellerPenalties — a dealer's warnings, rating penalties and auction suspensions
 * (TRU-5). Admin / Deal Manager can lift one early with a reason (Day 13): a lifted
 * suspension ends now and a lifted rating penalty stops counting in the rating. Lifted
 * penalties stay listed for history.
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { useMonitorAction } from '@/hooks/useAdminMonitor';
import { ReasonDialog } from '@/components/features/admin/monitor/MonitorParts';
import { formatDateTime } from '@/utils/genericFunctions';

const TYPE_LABELS = {
  warning: 'Warning',
  rating_penalty: 'Rating penalty (counts as 1 star)',
  auction_suspension: 'Suspended from auctions',
};
const OPS_ROLES = ['owner', 'admin', 'deal_manager'];

/**
 * @param {Object} props
 * @param {string} props.sellerId
 * @param {Object[]} props.penalties - From the seller detail
 * @returns {JSX.Element}
 */
export default function SellerPenalties({ sellerId, penalties = [] }) {
  const { staff } = useAdminAuth();
  const queryClient = useQueryClient();
  const action = useMonitorAction();
  const [dialog, setDialog] = useState(null);
  const canAct = OPS_ROLES.includes(staff.role);

  if (!penalties.length) return <p className="text-sm text-muted">No penalties.</p>;

  const lift = (penalty) =>
    setDialog({
      title: `Lift: ${TYPE_LABELS[penalty.type]}`,
      description:
        penalty.type === 'auction_suspension'
          ? 'The dealer can join auctions again right away.'
          : penalty.type === 'rating_penalty'
            ? 'The rating is recalculated without this penalty.'
            : 'The warning is marked as lifted.',
      confirmLabel: 'Lift penalty',
      onConfirm: async (values) => {
        await action.mutateAsync({
          path: `dealers/${sellerId}/penalties/${penalty.id}/lift`,
          body: { reason: values.reason },
        });
        queryClient.invalidateQueries({ queryKey: ['admin', 'sellers'] });
      },
    });

  return (
    <>
      <ul className="flex flex-col divide-y divide-line">
        {penalties.map((penalty) => {
          const active =
            !penalty.liftedAt &&
            (penalty.type !== 'auction_suspension' ||
              !penalty.until ||
              new Date(penalty.until) > new Date());
          return (
            <li key={penalty.id} className="flex flex-col gap-2 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={active ? 'danger' : 'muted'}>
                  {TYPE_LABELS[penalty.type] || penalty.type}
                </Badge>
                {penalty.liftedAt ? <Badge>Lifted {formatDateTime(penalty.liftedAt)}</Badge> : null}
              </div>
              <p className="text-sm text-ink">{penalty.reason}</p>
              <p className="text-xs text-muted">
                {formatDateTime(penalty.createdAt)}
                {penalty.until ? ` · until ${formatDateTime(penalty.until)}` : ''}
                {penalty.liftReason ? ` · lifted: ${penalty.liftReason}` : ''}
              </p>
              {canAct && active ? (
                <Button variant="secondary" onClick={() => lift(penalty)} className="self-start">
                  Lift early
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
      <ReasonDialog
        action={dialog}
        onConfirm={(values) => dialog.onConfirm(values)}
        onClose={() => setDialog(null)}
      />
    </>
  );
}
