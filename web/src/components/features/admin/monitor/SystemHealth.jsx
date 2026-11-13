'use client';

/**
 * SystemHealth — API errors and response time (last 15 minutes, this API process),
 * live socket connections, MongoDB / Redis, job queues with "retry failed jobs", and
 * whether Razorpay / Firebase are configured (PRD §10.11 System health). Admin only.
 */
import { useState } from 'react';
import { CircleCheck, CircleX, RotateCcw } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { useMonitorAction, useSystemHealth } from '@/hooks/useAdminMonitor';
import { formatBps, formatINR } from '@/utils/genericFunctions';
import {
  PageHeader,
  Panel,
  QueryState,
  ReasonDialog,
  StatTile,
  TableHead,
  TableWrap,
} from './MonitorParts';

/** Up / down line. */
function Check({ label, ok, detail }) {
  const Icon = ok ? CircleCheck : CircleX;
  return (
    <li className="flex min-h-11 items-center gap-3">
      <Icon
        className={ok ? 'size-5 text-ink' : 'size-5 text-danger'}
        strokeWidth={2}
        aria-hidden="true"
      />
      <span className="flex-1 text-sm font-semibold text-ink">{label}</span>
      <span className="text-sm text-muted">{detail}</span>
    </li>
  );
}

/** @returns {JSX.Element} */
export default function SystemHealth() {
  const query = useSystemHealth();
  const action = useMonitorAction();
  const [dialog, setDialog] = useState(null);
  const data = query.data;

  const retry = (queue) =>
    setDialog({
      title: `Retry failed jobs in ${queue}`,
      confirmLabel: 'Retry failed jobs',
      onConfirm: (values) =>
        action.mutateAsync({
          path: `system/queues/${queue}/retry`,
          body: { reason: values.reason },
        }),
    });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="System health" description="Refreshes every 30 seconds." />
      <QueryState query={query} skeletonClass="h-96">
        {data ? (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatTile label="Requests (15 min)" value={data.api.requests} />
              <StatTile
                label="Server errors"
                value={data.api.errors}
                tone={data.api.errors ? 'danger' : 'default'}
                hint={`${formatBps(data.api.errorRateBps)} of requests`}
              />
              <StatTile
                label="p95 response"
                value={data.api.p95Ms != null ? `${data.api.p95Ms} ms` : '—'}
                tone={data.api.p95Ms > 1000 ? 'warning' : 'default'}
              />
              <StatTile label="Live connections" value={data.sockets.connections ?? '—'} />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Panel title="Services">
                <ul className="divide-y divide-line">
                  <Check
                    label="API"
                    ok={data.health.isHealthy}
                    detail={`${data.health.env} · v${data.health.version} · up ${Math.round(data.health.uptimeSeconds / 60)} min`}
                  />
                  <Check
                    label="MongoDB"
                    ok={data.health.services.database === 'connected'}
                    detail={data.health.services.database}
                  />
                  <Check
                    label="Redis"
                    ok={
                      data.health.services.redis === 'ready' ||
                      data.health.services.redis === 'connected'
                    }
                    detail={data.health.services.redis}
                  />
                  <Check
                    label="Razorpay keys"
                    ok={data.services.razorpay}
                    detail={data.services.razorpay ? 'Configured' : 'Missing'}
                  />
                  <Check
                    label="Firebase"
                    ok={data.services.firebase}
                    detail={data.services.firebase ? 'Configured' : 'Missing'}
                  />
                  <Check label="AI cost today" ok detail={formatINR(data.aiCostTodayPaise)} />
                </ul>
              </Panel>
              <Panel title="Errors per minute">
                {data.api.perMinute?.length ? (
                  <ul className="flex flex-col gap-1 text-sm">
                    {data.api.perMinute.slice(-8).map((minute) => (
                      <li key={minute.minute} className="flex gap-3 font-mono">
                        <span className="flex-1 text-muted">
                          {new Date(minute.minute).toLocaleTimeString('en-IN', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                        <span className="text-ink">{minute.requests} req</span>
                        <span className={minute.errors ? 'text-danger' : 'text-muted'}>
                          {minute.errors} err
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">No requests recorded yet.</p>
                )}
              </Panel>
            </div>
            <Panel title="Job queues">
              <TableWrap minWidth={640}>
                <TableHead columns={['Queue', 'Waiting', 'Active', 'Delayed', 'Failed', '']} />
                <tbody className="divide-y divide-line">
                  {data.queues.map((queue) => (
                    <tr key={queue.name}>
                      <td className="px-4 py-3 font-mono text-ink">{queue.name}</td>
                      {queue.available ? (
                        <>
                          <td className="px-4 py-3 font-mono text-ink">{queue.waiting}</td>
                          <td className="px-4 py-3 font-mono text-ink">{queue.active}</td>
                          <td className="px-4 py-3 font-mono text-ink">{queue.delayed}</td>
                          <td className="px-4 py-3 font-mono text-ink">
                            {queue.failed ? <span className="text-danger">{queue.failed}</span> : 0}
                          </td>
                          <td className="px-4 py-3">
                            {queue.failed ? (
                              <Button variant="secondary" onClick={() => retry(queue.name)}>
                                <RotateCcw className="size-4" strokeWidth={2} aria-hidden="true" />
                                Retry
                              </Button>
                            ) : null}
                          </td>
                        </>
                      ) : (
                        <td colSpan={5} className="px-4 py-3">
                          <Badge tone="warning">
                            Unavailable
                            {queue.error ? `: ${queue.error}` : ' (Redis not configured)'}
                          </Badge>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </Panel>
          </>
        ) : null}
      </QueryState>
      <ReasonDialog
        action={dialog}
        onConfirm={(values) => dialog.onConfirm(values)}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}
