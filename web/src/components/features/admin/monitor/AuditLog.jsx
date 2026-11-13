'use client';

/**
 * AuditLog — every staff write (ADL-5): who, what, target, reason, before / after, IP and
 * time. Filter by action prefix (e.g. "payment."), target and dates; CSV export (MON-1).
 * Owner and Admin.
 */
import { Fragment, useState } from 'react';
import { ChevronDown, Download, Loader2 } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import useDebouncedValue from '@/hooks/useDebouncedValue';
import { useAuditLog } from '@/hooks/useAdminMonitor';
import { downloadAuditCsv } from '@/services/adminMonitor.service';
import { STAFF_ROLE_LABELS } from '@/utils/constants';
import { cn, formatDateTime } from '@/utils/genericFunctions';
import { PageHeader, Pager, QueryState, TableHead, TableWrap } from './MonitorParts';

const fieldClass =
  'min-h-11 w-full rounded-button border border-line bg-surface px-3 text-sm text-ink focus:border-primary focus:outline-none';
const ACTION_PRESETS = [
  ['', 'All actions'],
  ['auction.', 'Auctions'],
  ['group.', 'Groups'],
  ['payment.', 'Payments'],
  ['seller.', 'Dealers'],
  ['user.', 'Buyers'],
  ['dispute', 'Disputes'],
  ['settings', 'Settings'],
  ['staff.', 'Team'],
  ['alert.', 'Alerts'],
];

/** @returns {JSX.Element} */
export default function AuditLog() {
  const [filters, setFilters] = useState({
    action: '',
    targetType: '',
    targetId: '',
    from: '',
    to: '',
  });
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(null);
  const [csvError, setCsvError] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const targetId = useDebouncedValue(filters.targetId.trim(), 300);
  const params = { ...filters, targetId };
  const query = useAuditLog({ ...params, page, limit: 50 });
  const rows = query.data?.entries || [];

  const set = (key) => (event) => {
    setFilters((prev) => ({ ...prev, [key]: event.target.value }));
    setPage(1);
  };

  const exportCsv = async () => {
    setCsvError(null);
    setIsExporting(true);
    try {
      await downloadAuditCsv(params);
    } catch (err) {
      setCsvError(err.message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Audit log"
        description="Every change made in the console. Entries can never be edited or deleted."
        actions={
          <Button variant="secondary" onClick={exportCsv} disabled={isExporting}>
            {isExporting ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
            ) : (
              <Download className="size-4" strokeWidth={2} aria-hidden="true" />
            )}
            Export CSV
          </Button>
        }
      />
      {csvError ? <Alert>{csvError}</Alert> : null}

      <div className="grid grid-cols-1 gap-3 rounded-card border border-line bg-surface p-4 shadow-card sm:grid-cols-2 lg:grid-cols-5">
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          Action
          <select value={filters.action} onChange={set('action')} className={fieldClass}>
            {ACTION_PRESETS.map(([value, label]) => (
              <option key={label} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          Target type
          <select value={filters.targetType} onChange={set('targetType')} className={fieldClass}>
            <option value="">Any</option>
            {[
              'group',
              'payment',
              'seller',
              'user',
              'dispute',
              'settings',
              'staff_invite',
              'alert',
              'product',
              'category',
              'city',
            ].map((value) => (
              <option key={value} value={value}>
                {value.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          Target id
          <input
            value={filters.targetId}
            onChange={set('targetId')}
            className={cn(fieldClass, 'font-mono')}
            placeholder="24-character id"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          From
          <input type="date" value={filters.from} onChange={set('from')} className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          To
          <input type="date" value={filters.to} onChange={set('to')} className={fieldClass} />
        </label>
      </div>

      <QueryState
        query={query}
        isEmpty={rows.length === 0}
        emptyText="No entries match these filters"
      >
        <TableWrap minWidth={900} dim={query.isFetching}>
          <TableHead columns={['Time', 'Who', 'Action', 'Target', 'Reason', '']} />
          <tbody className="divide-y divide-line">
            {rows.map((entry) => {
              const isOpen = expanded === entry.id;
              return (
                <Fragment key={entry.id}>
                  <tr>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {formatDateTime(entry.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink">{entry.actor?.name || 'System'}</p>
                      <p className="text-xs text-muted">
                        {STAFF_ROLE_LABELS[entry.actor?.role] || entry.actor?.role || ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink">{entry.action}</td>
                    <td className="px-4 py-3 text-xs">
                      <p className="text-ink">{entry.targetType || '—'}</p>
                      <p className="font-mono text-muted">{entry.targetId || ''}</p>
                    </td>
                    <td className="max-w-xs px-4 py-3 text-ink">
                      {entry.reason || <span className="text-muted">—</span>}
                    </td>
                    <td className="px-2 py-3">
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : entry.id)}
                        aria-expanded={isOpen}
                        aria-label="Show before and after"
                        className="grid size-11 place-items-center rounded-button text-muted hover:bg-bg-band"
                      >
                        <ChevronDown
                          className={cn('size-4 transition-transform', isOpen && 'rotate-180')}
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                      </button>
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr className="bg-bg-band/60">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          {[
                            ['Before', entry.before],
                            ['After', entry.after],
                          ].map(([label, value]) => (
                            <div key={label} className="min-w-0">
                              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                                {label}
                              </p>
                              <pre className="mt-1 max-h-60 overflow-auto rounded-button bg-surface p-3 font-mono text-xs text-ink">
                                {value == null ? '—' : JSON.stringify(value, null, 2)}
                              </pre>
                            </div>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-muted">IP {entry.ip || 'unknown'}</p>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </TableWrap>
      </QueryState>
      <Pager meta={query.data?.meta} page={page} onPage={setPage} noun="entries" />
    </div>
  );
}
