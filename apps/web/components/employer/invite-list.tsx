'use client'

import { buttonClass } from '@/components/ui/button'
import { CheckIcon, CopyIcon } from '@/components/ui/icons'
import { StatusBadge, badgeIcons, type BadgeTone } from '@/components/ui/status-badge'
import type { Invite, InviteStatus } from '@/lib/api'
import { dashboardCopy as t } from '@/lib/copy/employer'
import { daysUntil, formatDateShort } from '@/lib/format'
import { useCopy } from '@/lib/use-copy'

const statusBadge: Record<
  InviteStatus,
  { tone: BadgeTone; label: string; icon: keyof typeof badgeIcons }
> = {
  PENDING: { tone: 'warn', label: t.invitePending, icon: 'clock' },
  ACCEPTED: { tone: 'success', label: t.inviteAccepted, icon: 'success' },
  REVOKED: { tone: 'neutral', label: t.inviteRevoked, icon: 'cancel' },
  EXPIRED: { tone: 'neutral', label: t.inviteExpired, icon: 'clock' },
}

export function InviteStatusBadge({ status }: { status: InviteStatus }) {
  const b = statusBadge[status]
  return (
    <StatusBadge tone={b.tone} icon={badgeIcons[b.icon]}>
      {b.label}
    </StatusBadge>
  )
}

export function InviteList({
  invites,
  now,
  onRevoke,
}: {
  invites: Invite[]
  now: number
  onRevoke: (invite: Invite) => void
}) {
  const { copied, copy } = useCopy()

  if (invites.length === 0) {
    return (
      <p className="rounded-xl border-[1.5px] border-dashed border-brand-text bg-surface p-4 text-muted">
        {t.noInvites}
      </p>
    )
  }

  return (
    <>
      <ul className="flex flex-col gap-3 md:grid md:grid-cols-2">
        {invites.map((invite) => {
          const pending = invite.status === 'PENDING'
          const meta = pending
            ? t.daysLeft(daysUntil(invite.expiresAt, now))
            : invite.status === 'ACCEPTED' && invite.acceptedAt
              ? t.acceptedOn(formatDateShort(invite.acceptedAt))
              : t.createdOn(formatDateShort(invite.createdAt))
          return (
            <li
              key={invite.code}
              className="rounded-xl border-[1.5px] border-brand-text bg-surface p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-title text-brand-text">{invite.inviteeName}</p>
                  <p className="text-label text-muted">
                    {invite.monthlySalaryUsd !== null && t.salaryPerMonth(invite.monthlySalaryUsd)}
                    {' · '}
                    {meta}
                  </p>
                </div>
                <InviteStatusBadge status={invite.status} />
              </div>
              {pending && (
                <div className="mt-2 -mb-2 -ml-3 flex flex-wrap items-center">
                  <button
                    type="button"
                    className={buttonClass('text')}
                    onClick={() => copy(invite.url, invite.code)}
                  >
                    {copied === invite.code ? (
                      <CheckIcon className="size-4" />
                    ) : (
                      <CopyIcon className="size-4" />
                    )}
                    {copied === invite.code ? t.copied : t.copyLink}
                  </button>
                  <button
                    type="button"
                    className={buttonClass('text')}
                    onClick={() => onRevoke(invite)}
                  >
                    {t.revoke}
                    <span className="sr-only"> {invite.inviteeName}</span>
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <p className="sr-only" aria-live="polite">
        {copied ? t.copied : ''}
      </p>
    </>
  )
}
