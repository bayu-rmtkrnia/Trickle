'use client'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { InlineError } from '@/components/ui/inline-error'
import { StatusBadge } from '@/components/ui/status-badge'
import { Sheet } from '@/components/ui/sheet'
import { WAVE_SRC } from '@/lib/brand'
import { workerDashboardCopy as t } from '@/lib/copy/worker-dashboard'
import { payrollCopy as p, payrollError } from '@/lib/copy/payroll'
import { payrollConfig } from '@/lib/chain/config'
import { previewSplit } from '@/lib/chain/split'
import { availableAt, streamStatus } from '@/lib/chain/stream-math'
import { formatToken } from '@/lib/chain/format-token'
import { useWorkerStreams, type WorkerStreamState } from '@/hooks/use-worker-streams'
import type { EmploymentDto } from '@/lib/api/worker'
import { useWithdrawal } from '@/hooks/use-withdrawal'
import { WithdrawSheet } from './withdraw-sheet'
import { withdrawCopy as w } from '@/lib/copy/withdraw'

export function SalaryCard({
  walletAddress = null,
  employments = [],
  streams,
}: {
  walletAddress?: string | null
  employments?: EmploymentDto[]
  /** Shared snapshot from the dashboard; without it the card reads its own. */
  streams?: WorkerStreamState
}) {
  const own = useWorkerStreams(streams ? null : walletAddress)
  const { phase, snapshot, timestamp, refresh, refreshing, error } = streams ?? own
  const [sheetOpen, setSheetOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [payrollOpen, setPayrollOpen] = useState(false)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const signingHandoff = useRef(false)
  const withdrawal = useWithdrawal(walletAddress, refresh, () => {
    signingHandoff.current = true
    Array.from(cardRef.current?.querySelectorAll<HTMLDialogElement>('dialog') ?? [])
      .find((dialog) => dialog.open)
      ?.close()
    setSheetOpen(false)
  })
  useEffect(() => {
    if (
      !signingHandoff.current ||
      ['idle', 'confirming', 'signing'].includes(withdrawal.state.phase)
    )
      return
    let active = true
    queueMicrotask(() => {
      if (active && signingHandoff.current) {
        signingHandoff.current = false
        setSheetOpen(true)
      }
    })
    return () => {
      active = false
    }
  }, [withdrawal.state.phase])
  const locked =
    withdrawal.state.checking || ['signing', 'pending', 'unknown'].includes(withdrawal.state.phase)
  const eligible =
    snapshot && timestamp !== null
      ? snapshot.streams.filter((s) => availableAt(s, timestamp) > BigInt(0))
      : []
  const canWithdraw = withdrawal.ready && phase === 'ready' && eligible.length > 0 && !locked
  function openWithdrawal(id?: bigint) {
    if (!locked) {
      if (id !== undefined) withdrawal.select(id)
      else if (eligible.length === 1) withdrawal.select(eligible[0]!.id)
      else withdrawal.choose()
    }
    setSheetOpen(true)
  }
  const total =
    snapshot && timestamp !== null
      ? snapshot.streams.reduce((value, s) => value + availableAt(s, timestamp), BigInt(0))
      : null
  const split =
    snapshot && timestamp !== null
      ? snapshot.streams.reduce(
          (sum, stream) => {
            // Same rounding as `withdraw`, which splits each stream on its own.
            const preview = previewSplit(availableAt(stream, timestamp), snapshot.splits)
            return {
              worker: sum.worker + preview.toWorker,
              family: sum.family + preview.toRecipients,
              shares: sum.shares.map((value, index) => value + preview.shares[index]!.amount),
            }
          },
          {
            worker: BigInt(0),
            family: BigInt(0),
            shares: snapshot.splits.map(() => BigInt(0)),
          },
        )
      : null
  const amount = (value: bigint) => formatToken(value, payrollConfig.tokenDecimals)
  const token = (value: bigint) => `${amount(value)} ${snapshot!.tokenSymbol}`
  const period = (value: bigint) =>
    new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(Number(value) * 1000))
  return (
    <div ref={cardRef} className="grid gap-3 md:grid-cols-4">
      <section
        aria-labelledby="worker-salary-heading"
        className="relative isolate flex min-h-44 flex-col gap-3 overflow-hidden rounded-xl bg-brand-fill p-4 text-on-brand md:col-span-3"
      >
        <Image
          src={WAVE_SRC}
          alt=""
          width={382}
          height={199}
          unoptimized
          className="pointer-events-none absolute inset-y-0 -right-[20%] -z-10 h-full w-[120%] max-w-none object-cover object-right-bottom opacity-70 select-none"
        />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="worker-salary-heading" className="text-label">
              {t.salaryLabel}
            </h2>
            {total === null ? (
              <p className="mt-1 text-2xl/8 font-bold">{p.unavailable}</p>
            ) : (
              <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
                <p
                  data-testid="available-salary"
                  className="break-all font-display text-num-hero tabular-nums"
                >
                  {amount(total)}
                </p>
                <span className="font-semibold">{snapshot!.tokenSymbol}</span>
              </div>
            )}
          </div>
          <Button
            variant="on-brand"
            onClick={() => setDetailsOpen(true)}
            className="min-h-11 shrink-0 px-4"
          >
            {p.details}
          </Button>
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-2 text-label">
          {payrollConfig.isMock && <StatusBadge tone="neutral">{p.demo}</StatusBadge>}
          <span role="status">
            {total === null
              ? phase === 'loading'
                ? p.loading
                : payrollError(error, phase).title
              : snapshot!.streams.length === 0
                ? p.empty
                : phase === 'stale'
                  ? p.stale
                  : p.estimate}
          </span>
        </div>
      </section>
      <section
        aria-labelledby="worker-payroll-actions-heading"
        className="flex min-h-44 flex-col rounded-xl border-[1.5px] border-brand-text bg-surface p-4 md:col-span-1"
      >
        <h2 id="worker-payroll-actions-heading" className="font-semibold text-brand-text">
          {p.streams}
        </h2>
        <p className="mt-1 text-label text-muted">
          {snapshot ? p.payrollCount(snapshot.streams.length) : p.payrollPending}
        </p>
        <div className="mt-auto flex flex-col gap-2 pt-4">
          <Button block disabled={!canWithdraw && !locked} onClick={() => openWithdrawal()}>
            {locked ? w.status : t.withdraw}
          </Button>
          <Button
            variant="secondary"
            block
            disabled={!snapshot}
            onClick={() => setPayrollOpen(true)}
          >
            {p.viewPayroll}
          </Button>
        </div>
      </section>
      <Sheet
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        title={p.detailsTitle}
        description={payrollConfig.isMock ? p.demoHint : undefined}
        footer={
          <Button
            variant="secondary"
            block
            onClick={refresh}
            loading={refreshing}
            loadingLabel={p.refreshing}
          >
            {p.retry}
          </Button>
        }
      >
        {detailsOpen &&
          (snapshot && split ? (
            <div className="flex flex-col gap-4">
              <dl className="flex flex-col gap-4">
                {[
                  [p.walletBalance, token(snapshot.walletBalance)],
                  [p.workerShare, token(split.worker)],
                  [p.familyShare, token(split.family)],
                  ...snapshot.splits.map(({ recipient, bps }, index) => [
                    p.recipientShare(index + 1, recipient, (bps / 100).toString()),
                    token(split.shares[index]!),
                  ]),
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-muted/20 pb-3 last:border-0"
                  >
                    <dt className="text-label text-muted">{label}</dt>
                    <dd className="break-all font-semibold tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-label text-muted">
                {phase === 'stale'
                  ? p.staleHint
                  : snapshot.splits.length === 0
                    ? p.noSplit
                    : p.splitHint}
              </p>
            </div>
          ) : phase === 'loading' ? (
            <p role="status">{p.loading}</p>
          ) : (
            <InlineError {...payrollError(error, phase)} />
          ))}
      </Sheet>
      <Sheet open={payrollOpen} onClose={() => setPayrollOpen(false)} title={p.streams}>
        {payrollOpen &&
          (snapshot && timestamp !== null ? (
            snapshot.streams.length === 0 ? (
              <p className="text-muted">{p.emptyHint}</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {snapshot.streams.map((stream) => {
                  const name = employments.find(
                    (job) =>
                      job.employer.ownerAddress.toLowerCase() === stream.employer.toLowerCase(),
                  )?.employer.name
                  return (
                    <li
                      key={stream.id.toString()}
                      className="rounded-xl border border-muted/30 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">{p.stream(stream.id.toString())}</p>
                          <p className="mt-1 text-label text-muted">{name ?? p.unknownSender}</p>
                        </div>
                        <StatusBadge tone="neutral">
                          {p.statuses[streamStatus(stream, timestamp)]}
                        </StatusBadge>
                      </div>
                      {!name && (
                        <a
                          href={`${payrollConfig.explorerUrl}/address/${stream.employer}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block text-label underline underline-offset-4"
                        >
                          {p.sender}
                        </a>
                      )}
                      <p className="mt-3 text-label text-muted">
                        {p.period}: {period(stream.start)} – {period(stream.end)}
                      </p>
                      <p className="mt-2 break-all font-semibold tabular-nums">
                        {p.available}: {token(availableAt(stream, timestamp))}
                      </p>
                    </li>
                  )
                })}
              </ul>
            )
          ) : (
            <InlineError {...payrollError(error, phase)} />
          ))}
      </Sheet>
      <WithdrawSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        state={withdrawal.state}
        streams={snapshot?.streams ?? []}
        timestamp={phase === 'ready' ? timestamp : null}
        splits={snapshot?.splits ?? []}
        tokenSymbol={snapshot?.tokenSymbol ?? w.tokenFallback}
        walletAddress={walletAddress}
        select={withdrawal.select}
        submit={withdrawal.submit}
        resume={withdrawal.resume}
        abandon={withdrawal.abandon}
      />
    </div>
  )
}
