'use client';

/**
 * TeamPage — Owner only (ADL-1, PRD §8.2): invite staff by email with a role, see pending
 * invites, change a role or disable an account (their sessions end at once). The Owner
 * account itself cannot be changed here. Role changes and disabling need a reason.
 */
import { useState } from 'react';
import { Loader2, MailPlus, ShieldCheck, ShieldOff, UserCheck, UserX, X } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useAdminAuth } from '@/context/AdminAuthContext';
import {
  useChangeRole,
  useInviteStaff,
  useRevokeInvite,
  useSetStaffStatus,
  useTeam,
} from '@/hooks/useAdminMonitor';
import { STAFF_ROLE_LABELS } from '@/utils/constants';
import { formatDateTime } from '@/utils/genericFunctions';
import { PageHeader, Panel, QueryState, ReasonDialog, TableHead, TableWrap } from './MonitorParts';

const INVITABLE = ['admin', 'deal_manager', 'finance', 'support'];
const ROLE_HINTS = {
  admin: 'Everything except Team',
  deal_manager: 'Catalog, dealers, groups and auctions',
  finance: 'Payments, refunds, commissions',
  support: 'Disputes, reports, buyers',
};

/** @returns {JSX.Element} */
export default function TeamPage() {
  const { staff } = useAdminAuth();
  const query = useTeam();
  const invite = useInviteStaff();
  const revoke = useRevokeInvite();
  const changeRole = useChangeRole();
  const setStatus = useSetStaffStatus();
  const [form, setForm] = useState({ email: '', role: 'support' });
  const [sent, setSent] = useState(null);
  const [dialog, setDialog] = useState(null);

  if (staff.role !== 'owner') {
    return <Alert tone="info">Only the Owner manages the team.</Alert>;
  }

  const submit = async (event) => {
    event.preventDefault();
    setSent(null);
    try {
      await invite.mutateAsync(form);
      setSent(form.email);
      setForm({ email: '', role: form.role });
    } catch {
      // shown below
    }
  };

  const openRole = (member) =>
    setDialog({
      title: `Change ${member.name || member.email}'s role`,
      description: 'They are signed out and get the new role when they sign in again.',
      confirmLabel: 'Change role',
      initial: { role: member.role },
      fields: (values, set) => (
        <Select
          label="New role"
          value={values.role}
          onChange={(event) => set('role', event.target.value)}
        >
          {INVITABLE.map((role) => (
            <option key={role} value={role}>
              {STAFF_ROLE_LABELS[role]}
            </option>
          ))}
        </Select>
      ),
      onConfirm: (values) =>
        changeRole.mutateAsync({ userId: member.userId, role: values.role, reason: values.reason }),
    });

  const openStatus = (member) => {
    const disable = member.status === 'active';
    setDialog({
      title: disable
        ? `Disable ${member.name || member.email}`
        : `Enable ${member.name || member.email}`,
      description: disable
        ? 'They are signed out now and cannot sign in until you enable the account again.'
        : undefined,
      confirmLabel: disable ? 'Disable account' : 'Enable account',
      danger: disable,
      onConfirm: (values) =>
        setStatus.mutateAsync({ userId: member.userId, active: !disable, reason: values.reason }),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Team"
        description="Staff accounts for the console. Every staff member must use 2-step verification."
      />

      <Panel title="Invite a staff member">
        <form
          onSubmit={submit}
          className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end"
        >
          <Input
            label="Work email"
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            required
            autoComplete="off"
          />
          <Select
            label="Role"
            value={form.role}
            onChange={(event) => setForm({ ...form, role: event.target.value })}
            hint={ROLE_HINTS[form.role]}
          >
            {INVITABLE.map((role) => (
              <option key={role} value={role}>
                {STAFF_ROLE_LABELS[role]}
              </option>
            ))}
          </Select>
          <Button type="submit" disabled={invite.isPending}>
            {invite.isPending ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
            ) : (
              <MailPlus className="size-4" strokeWidth={2} aria-hidden="true" />
            )}
            Send invite
          </Button>
        </form>
        {invite.isError ? <Alert className="mt-3">{invite.error.message}</Alert> : null}
        {sent ? (
          <Alert tone="info" className="mt-3">
            Invitation emailed to {sent}. The link works for 72 hours.
          </Alert>
        ) : null}
      </Panel>

      <QueryState query={query} skeletonClass="h-64">
        {query.data ? (
          <>
            {query.data.invites.length ? (
              <Panel title="Pending invites">
                <ul className="divide-y divide-line">
                  {query.data.invites.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{item.email}</p>
                        <p className="text-xs text-muted">
                          {STAFF_ROLE_LABELS[item.role]} · expires {formatDateTime(item.expiresAt)}
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        disabled={revoke.isPending}
                        onClick={() => revoke.mutate(item.id)}
                      >
                        <X className="size-4" strokeWidth={2} aria-hidden="true" />
                        Cancel invite
                      </Button>
                    </li>
                  ))}
                </ul>
              </Panel>
            ) : null}

            <TableWrap minWidth={760}>
              <TableHead columns={['Name', 'Role', '2-step', 'Last sign-in', 'Status', '']} />
              <tbody className="divide-y divide-line">
                {query.data.members.map((member) => {
                  const isOwner = member.role === 'owner';
                  return (
                    <tr key={member.userId}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-ink">{member.name || '—'}</p>
                        <p className="text-xs text-muted">{member.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={isOwner ? 'brand' : 'muted'}>
                          {STAFF_ROLE_LABELS[member.role] || member.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {member.twoFactorEnabled ? (
                          <ShieldCheck
                            className="size-5 text-ink"
                            strokeWidth={2}
                            aria-label="On"
                          />
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-muted">
                            <ShieldOff className="size-4" strokeWidth={2} aria-hidden="true" />
                            Set up at first sign-in
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {formatDateTime(member.lastLoginAt) || 'Never'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={member.status === 'active' ? 'muted' : 'danger'}>
                          {member.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {isOwner ? null : (
                          <div className="flex gap-2">
                            <Button variant="secondary" onClick={() => openRole(member)}>
                              Role
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => openStatus(member)}
                              aria-label={
                                member.status === 'active'
                                  ? `Disable ${member.email}`
                                  : `Enable ${member.email}`
                              }
                            >
                              {member.status === 'active' ? (
                                <UserX
                                  className="size-4 text-danger"
                                  strokeWidth={2}
                                  aria-hidden="true"
                                />
                              ) : (
                                <UserCheck className="size-4" strokeWidth={2} aria-hidden="true" />
                              )}
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
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
