'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { InlineError } from '@/components/ui/inline-error'
import { PersonCard } from '@/components/ui/person-card'
import { Skeleton } from '@/components/ui/skeleton'
import { afterSheetHistory } from '@/components/ui/sheet'
import { StatusBadge } from '@/components/ui/status-badge'
import type { WorkerStreamState } from '@/hooks/use-worker-streams'
import { useSplitSettings } from '@/hooks/use-split-settings'
import { useWorkerFamily } from '@/hooks/use-worker-family'
import type { RecipientDto } from '@/lib/api/recipients'
import { bpsToPercent } from '@/lib/chain/split'
import { familyApiMessage, workerFamilyCopy as t } from '@/lib/copy/worker-family'
import { useCopy } from '@/lib/use-copy'
import type { SessionContextValue } from '@/providers/session-provider'
import { InviteFamilySheet } from './invite-family-sheet'
import { RemoveRecipientSheet } from './remove-recipient-sheet'
import { SplitSheet } from './split-sheet'

const percent = (bps: number) => bpsToPercent(bps).replace('.', ',')
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

export function WorkerFamilySection({
  session,
  walletAddress,
  streams,
}: {
  session: SessionContextValue
  walletAddress: string | null
  streams: WorkerStreamState
}) {
  const family = useWorkerFamily(session)
  const rootRef = useRef<HTMLElement | null>(null)
  const signingHandoff = useRef(false)
  const [splitOpen, setSplitOpen] = useState(false)
  const [splitKey, setSplitKey] = useState(0)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteKey, setInviteKey] = useState(0)
  const [removing, setRemoving] = useState<RecipientDto | null>(null)
  const [inviteError, setInviteError] = useState<unknown>(null)
  const { copied, copy } = useCopy()
  const settings = useSplitSettings(walletAddress, streams.refresh, () => {
    // Privy shows its own modal; close ours so it does not trap focus.
    signingHandoff.current = true
    Array.from(rootRef.current?.querySelectorAll<HTMLDialogElement>('dialog') ?? [])
      .find((dialog) => dialog.open)
      ?.close()
    setSplitOpen(false)
  })
  const phase = settings.state.phase
  useEffect(() => {
    if (!signingHandoff.current || ['idle', 'preparing', 'signing'].includes(phase)) return
    let active = true
    queueMicrotask(() => {
      if (active && signingHandoff.current) {
        signingHandoff.current = false
        setSplitOpen(true)
      }
    })
    return () => {
      active = false
    }
  }, [phase])

  const splits = streams.snapshot?.splits ?? null
  const recipients = family.recipients ?? []
  const shareOf = (address: string) => splits?.find((split) => same(split.recipient, address))
  const nameOf = (address: string) =>
    recipients.find((recipient) => same(recipient.address, address))?.displayName ??
    t.unnamed(address)
  const totalBps = splits?.reduce((sum, split) => sum + split.bps, 0) ?? 0

  function openSplit() {
    if (['idle', 'failed', 'success'].includes(phase)) {
      if (phase !== 'idle') settings.reset()
      setSplitKey((value) => value + 1)
    }
    setRemoving(null)
    setSplitOpen(true)
  }

  return (
    <section ref={rootRef} aria-labelledby="worker-family-heading" className="flex flex-col gap-5">
      <div>
        <h2 id="worker-family-heading" className="text-section font-bold">
          {t.title}
        </h2>
        <p className="mt-1 text-label text-muted">{t.body}</p>
      </div>

      <div className="rounded-xl border-[1.5px] border-brand-text bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 className="font-semibold">{t.splitTitle}</h3>
          <Button
            variant="secondary"
            onClick={openSplit}
            disabled={!splits || !settings.ready || family.loading}
          >
            {t.editSplit}
          </Button>
        </div>
        {!splits ? (
          <p className="mt-2 text-label text-muted">{t.splitUnknown}</p>
        ) : splits.length === 0 ? (
          <p className="mt-2 text-label text-muted">{t.splitOff}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2 text-label">
            {splits.map((split) => (
              <li key={split.recipient} className="flex justify-between gap-3">
                <span className="min-w-0 truncate">{nameOf(split.recipient)}</span>
                <span className="font-semibold tabular-nums">{percent(split.bps)}%</span>
              </li>
            ))}
            <li className="flex justify-between gap-3 text-muted">
              <span>{t.splitWorker(percent(10_000 - totalBps))}</span>
            </li>
          </ul>
        )}
      </div>

      {family.loading && !family.recipients ? (
        <div role="status" aria-label={t.loading} className="flex flex-col gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : family.error ? (
        <div className="flex flex-col gap-3">
          <InlineError title={t.loadError} message={t.loadErrorBody} />
          <Button variant="secondary" block onClick={family.reload}>
            {t.retry}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <h3 className="font-semibold">{t.recipientsTitle}</h3>
            {recipients.length === 0 ? (
              <p className="text-label text-muted">{t.recipientsEmpty}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {recipients.map((recipient) => {
                  const share = shareOf(recipient.address)
                  return (
                    <li key={recipient.id}>
                      <PersonCard
                        name={recipient.displayName}
                        subtitle={`${recipient.relation ? `${recipient.relation} · ` : ''}${
                          share ? t.share(percent(share.bps)) : t.noShare
                        }`}
                        trailing={
                          <Button
                            variant="text"
                            aria-label={t.removeLabel(recipient.displayName)}
                            onClick={() => setRemoving(recipient)}
                          >
                            {t.remove}
                          </Button>
                        }
                      />
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">{t.invitesTitle}</h3>
              <Button
                variant="secondary"
                onClick={() => {
                  setInviteKey((value) => value + 1)
                  setInviteOpen(true)
                }}
              >
                {t.invite}
              </Button>
            </div>
            {inviteError !== null && <InlineError {...familyApiMessage(inviteError)} />}
            {(family.invites ?? []).length === 0 ? (
              <p className="text-label text-muted">{t.invitesEmpty}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {(family.invites ?? []).map((invite) => (
                  <li
                    key={invite.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-muted/30 p-3"
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold">{invite.inviteeName}</span>
                      {invite.relation && (
                        <span className="block text-label text-muted">{invite.relation}</span>
                      )}
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={invite.status === 'PENDING' ? 'warn' : 'neutral'}>
                        {t.inviteStatus[invite.status] ?? invite.status}
                      </StatusBadge>
                      {invite.status === 'PENDING' && (
                        <>
                          <Button variant="text" onClick={() => copy(invite.url, invite.id)}>
                            {copied === invite.id ? t.copied : t.copyLink}
                          </Button>
                          <Button
                            variant="text"
                            aria-label={t.cancelLabel(invite.inviteeName)}
                            onClick={async () => {
                              setInviteError(null)
                              try {
                                await family.cancel(invite.id)
                              } catch (problem) {
                                setInviteError(problem)
                              }
                            }}
                          >
                            {t.cancelInvite}
                          </Button>
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <SplitSheet
        key={`split-${splitKey}`}
        open={splitOpen}
        onClose={() => setSplitOpen(false)}
        recipients={recipients}
        current={splits ?? []}
        settings={settings}
        worker={walletAddress}
      />
      <InviteFamilySheet
        key={`invite-${inviteKey}`}
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onCreate={family.invite}
      />
      <RemoveRecipientSheet
        recipient={removing}
        onClose={() => setRemoving(null)}
        onRemove={family.remove}
        onEditSplit={() => {
          // Close this sheet first; open the split sheet after its history settles.
          setRemoving(null)
          afterSheetHistory(openSplit)
        }}
      />
    </section>
  )
}
