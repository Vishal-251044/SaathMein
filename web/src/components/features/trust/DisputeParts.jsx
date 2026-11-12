'use client';

/**
 * Shared dispute pieces for the Support queue and the dealer page: status badge, evidence
 * viewer (private files open through short-lived signed links) and the timeline.
 */
import { FileText } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { formatDateTime } from '@/utils/genericFunctions';

export const DISPUTE_STATUS_META = {
  awaiting_seller: { label: 'Waiting for dealer', tone: 'warning' },
  seller_responded: { label: 'Dealer answered', tone: 'brand' },
  seller_missed: { label: 'Dealer missed 48 h', tone: 'danger' },
  resolved: { label: 'Decided', tone: 'muted' },
};

export const DISPUTE_TYPE_LABEL = {
  price_not_honoured: 'Price not honoured',
  product_issue: 'Product issue',
  invoice_objection: 'Dealer objected to invoice',
  other: 'Other',
};

const ACTION_LABEL = {
  opened: 'Buyer opened the dispute',
  invoice_objected: 'Dealer objected to the invoice',
  responded: 'Dealer answered',
  responded_late: 'Dealer answered after 48 h',
  seller_missed_deadline: 'Dealer did not answer in 48 h',
  decided: 'Support decided',
};

/** @param {{ status: string }} props */
export function DisputeStatusBadge({ status }) {
  const meta = DISPUTE_STATUS_META[status] || { label: status, tone: 'muted' };
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

/** @param {{ evidence: Object[] }} props */
export function EvidenceList({ evidence }) {
  if (!evidence?.length) return <p className="text-sm text-muted">No files attached.</p>;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {evidence.map((item, index) => (
        <li key={`${item.addedAt}-${index}`}>
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex aspect-square flex-col items-center justify-center gap-1 overflow-hidden rounded-button border border-line bg-bg-band text-sm text-muted hover:border-primary"
            >
              {item.format === 'pdf' ? (
                <>
                  <FileText className="size-8" strokeWidth={1.75} aria-hidden="true" />
                  PDF
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.url}
                  alt={`Evidence from the ${item.addedBy}`}
                  className="size-full object-cover"
                />
              )}
            </a>
          ) : (
            <div className="flex aspect-square items-center justify-center rounded-button bg-bg-band text-xs text-muted">
              File unavailable
            </div>
          )}
          <p className="mt-1 text-xs text-muted">From the {item.addedBy}</p>
        </li>
      ))}
    </ul>
  );
}

/** @param {{ timeline: Object[] }} props */
export function DisputeTimeline({ timeline }) {
  return (
    <ol className="flex flex-col gap-3 border-l-2 border-line pl-4">
      {timeline.map((entry, index) => (
        <li key={`${entry.at}-${index}`} className="relative">
          <span
            className="absolute -left-[1.4rem] top-1.5 size-2.5 rounded-full bg-primary"
            aria-hidden="true"
          />
          <p className="text-sm font-semibold text-ink">
            {ACTION_LABEL[entry.action] || entry.action}
          </p>
          <p className="text-xs text-muted">{formatDateTime(entry.at)}</p>
          {entry.note && entry.action !== 'opened' ? (
            <p className="mt-0.5 text-sm text-ink">{entry.note}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
