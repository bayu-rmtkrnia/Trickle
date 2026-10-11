'use client'

import { Button } from '@/components/ui/button'
import { InlineError } from '@/components/ui/inline-error'
import { StatusBadge } from '@/components/ui/status-badge'
import { workerDashboardCopy as t } from '@/lib/copy/worker-dashboard'
import { payrollCopy as p, payrollError } from '@/lib/copy/payroll'
import { payrollConfig } from '@/lib/chain/config'
import { availableAt, splitAmounts, streamStatus } from '@/lib/chain/stream-math'
import { formatToken } from '@/lib/chain/format-token'
import { useWorkerStreams } from '@/hooks/use-worker-streams'
import type { EmploymentDto } from '@/lib/api/worker'

export function SalaryCard({
  walletAddress = null,
  employments = [],
}: {
  walletAddress?: string | null
  employments?: EmploymentDto[]
}) {
  const { phase, snapshot, timestamp, refresh, refreshing, error } = useWorkerStreams(walletAddress)
  const total =
    snapshot && timestamp !== null
      ? snapshot.streams.reduce((value, s) => value + availableAt(s, timestamp), BigInt(0))
      : null
  const split =
    snapshot && timestamp !== null
      ? snapshot.streams.reduce(
          (sum, stream) => {
            const share = splitAmounts(availableAt(stream, timestamp), snapshot.split.bps)
            return { worker: sum.worker + share.worker, family: sum.family + share.family }
          },
          { worker: BigInt(0), family: BigInt(0) },
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
    <section
      aria-labelledby="worker-salary-heading"
      className="flex flex-col gap-4 rounded-xl bg-brand-fill p-5 text-on-brand sm:p-6"
    >
      <h2 id="worker-salary-heading" className="text-label">
        {t.salaryLabel}
      </h2>
      {total === null ? (
        <>
          <p className="text-2xl/8 font-bold">{p.unavailable}</p>
          {phase === 'loading' ? (
            <p role="status" className="text-sm/6">
              {p.loading}
            </p>
          ) : (
            <InlineError {...payrollError(error, phase)} />
          )}
          <p className="text-sm/6">{p.loadingBody}</p>
        </>
      ) : (
        <>
          <p
            data-testid="available-salary"
            className="break-all text-3xl/10 font-bold tabular-nums"
          >
            {amount(total)}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{snapshot!.tokenSymbol}</span>
            {payrollConfig.isMock && <StatusBadge tone="neutral">{p.demo}</StatusBadge>}
          </div>
          {payrollConfig.isMock && <p className="text-label">{p.demoHint}</p>}
          {phase === 'stale' ? (
            <div role="status">
              <p className="font-semibold">{p.stale}</p>
              <p className="mt-1 text-sm/6">{p.staleHint}</p>
            </div>
          ) : (
            <p className="text-label">{p.estimate}</p>
          )}
          {snapshot!.streams.length === 0 && (
            <div>
              <p className="font-semibold">{p.empty}</p>
              <p className="mt-1 text-sm/6">{p.emptyHint}</p>
            </div>
          )}
          <dl className="flex flex-col gap-3 border-t border-current/25 pt-4 text-label">
            <div>
              <dt>{p.walletBalance}</dt>
              <dd className="mt-1 break-all font-semibold tabular-nums">
                {token(snapshot!.walletBalance)}
              </dd>
            </div>
            <div>
              <dt>{p.workerShare}</dt>
              <dd className="mt-1 break-all font-semibold tabular-nums">{token(split!.worker)}</dd>
            </div>
            <div>
              <dt>{p.familyShare}</dt>
              <dd className="mt-1 break-all font-semibold tabular-nums">{token(split!.family)}</dd>
            </div>
          </dl>
          <p className="text-label">{p.splitHint}</p>
        </>
      )}
      {phase !== 'loading' && (
        <Button
          variant="on-brand"
          block
          onClick={refresh}
          loading={refreshing}
          loadingLabel={p.refreshing}
        >
          {p.retry}
        </Button>
      )}
      <div className="mt-2">
        <Button variant="on-brand" block disabled aria-describedby="worker-withdraw-hint">
          {t.withdraw}
        </Button>
        <p id="worker-withdraw-hint" className="mt-2 text-label">
          {t.withdrawHint}
        </p>
      </div>
      {snapshot && timestamp !== null && snapshot.streams.length > 0 && (
        <section
          aria-labelledby="worker-streams-heading"
          className="mt-2 border-t border-current/25 pt-4"
        >
          <h3 id="worker-streams-heading" className="font-semibold">
            {p.streams}
          </h3>
          <ul className="mt-4 flex flex-col gap-5">
            {snapshot.streams.map((stream) => {
              const name = employments.find(
                (job) => job.employer.ownerAddress.toLowerCase() === stream.employer.toLowerCase(),
              )?.employer.name
              return (
                <li key={stream.id.toString()} className="flex flex-col gap-2">
                  <p className="font-semibold">{p.stream(stream.id.toString())}</p>
                  <p className="break-words">{name ?? p.unknownSender}</p>
                  {!name && (
                    <a
                      href={`${payrollConfig.explorerUrl}/address/${stream.employer}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-label underline underline-offset-4"
                    >
                      {p.sender}
                    </a>
                  )}
                  <StatusBadge tone="neutral">
                    {p.statuses[streamStatus(stream, timestamp)]}
                  </StatusBadge>
                  <dl className="text-label">
                    <div>
                      <dt>{p.period}</dt>
                      <dd className="mt-1">
                        {period(stream.start)} – {period(stream.end)}
                      </dd>
                    </div>
                    <div className="mt-2">
                      <dt>{p.available}</dt>
                      <dd className="mt-1 break-all font-semibold tabular-nums">
                        {token(availableAt(stream, timestamp))}
                      </dd>
                    </div>
                  </dl>
                  <Button variant="on-brand" disabled>
                    {p.withdrawStream}
                  </Button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </section>
  )
}
