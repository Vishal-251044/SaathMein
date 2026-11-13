'use client';

/**
 * SellerTeam — /seller/team (F31): team members, pending invites, invite by email, remove
 * staff. Only the owner manages the team; staff see the list.
 */
import { useState } from 'react';
import { Loader2, MailPlus, RefreshCw, Trash2, UserRound, UsersRound, X } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import FadeIn from '@/components/animations/FadeIn';
import {
  useInviteMember,
  useRemoveMember,
  useRevokeInvite,
  useSellerMe,
  useSellerTeam,
} from '@/hooks/useSeller';

/** Invite form (owner only). */
function InviteForm() {
  const invite = useInviteMember();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [sentTo, setSentTo] = useState(null);

  const handleSubmit = (event) => {
    event.preventDefault();
    setSentTo(null);
    const trimmed = email.trim();
    invite.mutate(
      { email: trimmed, ...(name.trim() ? { name: name.trim() } : {}) },
      {
        onSuccess: () => {
          setSentTo(trimmed);
          setEmail('');
          setName('');
        },
      },
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6"
    >
      <h2 className="text-lg font-bold text-ink">Invite a team member</h2>
      <p className="mt-0.5 text-sm text-muted">
        Staff can bid and manage purchases. They cannot change KYC, bank or team.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Input
          label="Email"
          type="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Input
          label="Name (optional)"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Button type="submit" disabled={invite.isPending || !/^\S+@\S+\.\S+$/.test(email.trim())}>
          {invite.isPending ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
          ) : (
            <MailPlus className="size-4" strokeWidth={2} aria-hidden="true" />
          )}
          Send invite
        </Button>
      </div>
      {invite.isError ? <Alert className="mt-3">{invite.error.message}</Alert> : null}
      {sentTo ? (
        <Alert tone="info" className="mt-3">
          Invitation sent to {sentTo}. The link works for 7 days.
        </Alert>
      ) : null}
    </form>
  );
}

/**
 * @returns {JSX.Element}
 */
export default function SellerTeam() {
  const { data: seller } = useSellerMe();
  const team = useSellerTeam();
  const revoke = useRevokeInvite();
  const remove = useRemoveMember();
  const isOwner = seller.role === 'owner';
  const actionError = revoke.error || remove.error;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Team</h1>
        <p className="mt-1 text-muted">People who can use the {seller.businessName} dashboard.</p>
      </div>

      {isOwner ? <InviteForm /> : null}
      {actionError ? <Alert>{actionError.message}</Alert> : null}

      <FadeIn as="section" className="rounded-card border border-line bg-surface shadow-card">
        <h2 className="border-b border-line px-5 py-4 text-lg font-bold text-ink sm:px-6">
          Members
        </h2>
        {team.isPending ? (
          <div className="flex flex-col gap-3 p-5" aria-busy="true">
            {[0, 1].map((key) => (
              <div key={key} className="h-12 animate-pulse rounded-button bg-bg-band" />
            ))}
          </div>
        ) : team.isError ? (
          <div className="flex flex-col items-start gap-3 p-5">
            <Alert>{team.error.message}</Alert>
            <Button variant="secondary" onClick={() => team.refetch()}>
              <RefreshCw className="size-4" strokeWidth={2} aria-hidden="true" />
              Try again
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {team.data.members.map((member) => (
              <li key={member.userId} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-bg-band text-muted">
                  <UserRound className="size-5" strokeWidth={2} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{member.name || member.email}</p>
                  <p className="truncate text-sm text-muted">{member.email}</p>
                </div>
                <Badge tone={member.role === 'owner' ? 'brand' : 'muted'}>
                  {member.role === 'owner' ? 'Owner' : 'Staff'}
                </Badge>
                {isOwner && member.role !== 'owner' ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Remove ${member.name || member.email} from the team?`))
                        remove.mutate(member.userId);
                    }}
                    disabled={remove.isPending}
                    aria-label={`Remove ${member.name || member.email}`}
                    className="grid size-11 place-items-center rounded-button text-muted hover:bg-bg-band hover:text-danger-text"
                  >
                    <Trash2 className="size-4" strokeWidth={2} aria-hidden="true" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </FadeIn>

      {team.data?.invites.length ? (
        <FadeIn as="section" className="rounded-card border border-line bg-surface shadow-card">
          <h2 className="border-b border-line px-5 py-4 text-lg font-bold text-ink sm:px-6">
            Pending invitations
          </h2>
          <ul className="divide-y divide-line">
            {team.data.invites.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{item.name || item.email}</p>
                  <p className="text-sm text-muted">
                    Expires {new Date(item.expiresAt).toLocaleDateString('en-IN')}
                  </p>
                </div>
                {isOwner ? (
                  <Button
                    variant="ghost"
                    onClick={() => revoke.mutate(item.id)}
                    disabled={revoke.isPending}
                  >
                    <X className="size-4" strokeWidth={2} aria-hidden="true" />
                    Cancel
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </FadeIn>
      ) : team.data && !isOwner && team.data.members.length === 1 ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <UsersRound className="size-4" strokeWidth={2} aria-hidden="true" />
          No other team members yet.
        </p>
      ) : null}
    </div>
  );
}
