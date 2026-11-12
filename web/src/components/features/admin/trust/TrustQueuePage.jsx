'use client';

/**
 * TrustQueuePage — Admin → Disputes and reports (TRU-3, TRU-4): open disputes oldest
 * first (dealers who missed 48 h stand out) and the reports queue with a preview of the
 * reported content and Support's actions. Owner, Admin, Support.
 */
import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Flag, Loader2, RefreshCw, Scale } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';
import { DISPUTE_TYPE_LABEL, DisputeStatusBadge } from '@/components/features/trust/DisputeParts';
import { useAdminDisputes, useAdminReports, useDecideReport } from '@/hooks/useTrust';
import { cn, formatDateTime } from '@/utils/genericFunctions';

const DISPUTE_TABS = [
  { key: 'open', label: 'Open' },
  { key: 'seller_missed', label: 'Dealer missed 48 h' },
  { key: 'resolved', label: 'Decided' },
];

const REASON_LABEL = {
  spam: 'Spam',
  fraud: 'Fraud',
  abuse: 'Abuse',
  price_not_honoured: 'Price not honoured',
  other: 'Other',
};

/** Actions per target type (mirrors the API). */
const ACTIONS = {
  dismiss: { label: 'Dismiss', targets: ['group', 'member', 'seller', 'message', 'review'] },
  hide_content: { label: 'Hide', targets: ['message', 'review'] },
  restore_content: { label: 'Show again', targets: ['message', 'review'] },
  warn_seller: { label: 'Warn dealer', targets: ['seller', 'review'] },
  suspend_account: { label: 'Suspend account', targets: ['member', 'seller'] },
};

/** Pill tabs. */
function Tabs({ tabs, value, onChange, label }) {
  return (
    <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={tab.key === value}
          onClick={() => onChange(tab.key)}
          className={cn(
            'inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors duration-150',
            tab.key === value
              ? 'bg-primary/10 text-primary'
              : 'bg-bg-band text-muted hover:text-ink',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/** Disputes list. */
function DisputesList() {
  const [status, setStatus] = useState('open');
  const query = useAdminDisputes({ status, limit: 50 });
  return (
    <div className="flex flex-col gap-4">
      <Tabs tabs={DISPUTE_TABS} value={status} onChange={setStatus} label="Dispute lists" />
      {query.isPending ? (
        <div className="h-40 animate-pulse rounded-card bg-surface" aria-busy="true" />
      ) : query.isError ? (
        <div className="flex flex-col items-start gap-3">
          <Alert>{query.error.message}</Alert>
          <Button variant="secondary" onClick={() => query.refetch()}>
            <RefreshCw className="size-4" strokeWidth={2} aria-hidden="true" />
            Try again
          </Button>
        </div>
      ) : query.data.disputes.length === 0 ? (
        <div className="flex flex-col items-center rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center">
          <Scale className="size-8 text-muted" strokeWidth={1.75} aria-hidden="true" />
          <p className="mt-3 font-semibold text-ink">No disputes here</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {query.data.disputes.map((dispute) => (
            <li key={dispute.id}>
              <Link
                href={`/admin/disputes/${dispute.id}`}
                className={cn(
                  'flex items-center gap-3 rounded-card border bg-surface p-4 shadow-card hover:shadow-pop',
                  dispute.overdue ? 'border-danger/40' : 'border-line',
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink">{DISPUTE_TYPE_LABEL[dispute.type]}</p>
                    <DisputeStatusBadge status={dispute.status} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{dispute.description}</p>
                  <p className="mt-1 text-xs text-muted">
                    {dispute.sellerName} · opened {formatDateTime(dispute.createdAt)}
                    {dispute.status === 'awaiting_seller'
                      ? ` · dealer answers by ${formatDateTime(dispute.sellerDueAt)}`
                      : ''}
                  </p>
                </div>
                <ChevronRight
                  className="size-5 shrink-0 text-muted"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** One report with Support's actions. */
function ReportCard({ report }) {
  const decide = useDecideReport();
  const [action, setAction] = useState(null);
  const [note, setNote] = useState('');
  const available = Object.entries(ACTIONS).filter(([, meta]) =>
    meta.targets.includes(report.targetType),
  );

  return (
    <li className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="warning">{REASON_LABEL[report.reason] || report.reason}</Badge>
        <Badge>{report.targetType}</Badge>
        {report.reportCount > 1 ? <Badge tone="danger">{report.reportCount} reports</Badge> : null}
        <span className="text-xs text-muted">{formatDateTime(report.createdAt)}</span>
      </div>
      {report.target ? (
        <div className="rounded-button bg-bg-band px-4 py-3">
          <p className="break-words text-sm font-semibold text-ink">{report.target.title}</p>
          <p className="text-xs text-muted">{report.target.subtitle}</p>
        </div>
      ) : (
        <p className="text-sm text-muted">The reported item no longer exists.</p>
      )}
      {report.details ? <p className="text-sm text-ink">&ldquo;{report.details}&rdquo;</p> : null}
      {report.status === 'open' ? (
        action ? (
          <div className="flex flex-col gap-2">
            <Textarea
              label={`Reason for "${ACTIONS[action].label}"`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              maxLength={2000}
            />
            {decide.isError ? <Alert>{decide.error.message}</Alert> : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setAction(null)}>
                Back
              </Button>
              <Button
                disabled={note.trim().length < 10 || decide.isPending}
                onClick={() => decide.mutate({ reportId: report.id, action, note: note.trim() })}
              >
                {decide.isPending ? (
                  <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
                ) : null}
                Confirm
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {available.map(([key, meta]) => (
              <Button key={key} variant="secondary" onClick={() => setAction(key)}>
                {meta.label}
              </Button>
            ))}
          </div>
        )
      ) : (
        <p className="text-sm text-muted">
          {report.decision?.action}: {report.decision?.note}
        </p>
      )}
    </li>
  );
}

/** Reports list. */
function ReportsList() {
  const [status, setStatus] = useState('open');
  const query = useAdminReports({ status, limit: 50 });
  return (
    <div className="flex flex-col gap-4">
      <Tabs
        tabs={[
          { key: 'open', label: 'Open' },
          { key: 'resolved', label: 'Acted on' },
          { key: 'dismissed', label: 'Dismissed' },
        ]}
        value={status}
        onChange={setStatus}
        label="Report lists"
      />
      {query.isPending ? (
        <div className="h-40 animate-pulse rounded-card bg-surface" aria-busy="true" />
      ) : query.isError ? (
        <Alert>{query.error.message}</Alert>
      ) : query.data.reports.length === 0 ? (
        <div className="flex flex-col items-center rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center">
          <Flag className="size-8 text-muted" strokeWidth={1.75} aria-hidden="true" />
          <p className="mt-3 font-semibold text-ink">No reports here</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {query.data.reports.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** @returns {JSX.Element} */
export default function TrustQueuePage() {
  const [view, setView] = useState('disputes');
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Disputes and reports</h1>
        <p className="mt-1 text-muted">
          Dealers answer disputes within 48 hours, then Support decides. Every step is logged.
        </p>
      </div>
      <Tabs
        tabs={[
          { key: 'disputes', label: 'Disputes' },
          { key: 'reports', label: 'Reports' },
        ]}
        value={view}
        onChange={setView}
        label="Queue"
      />
      {view === 'disputes' ? <DisputesList /> : <ReportsList />}
    </div>
  );
}
