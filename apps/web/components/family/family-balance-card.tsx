'use client'
import Image from 'next/image'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { InlineError } from '@/components/ui/inline-error'
import { Sheet } from '@/components/ui/sheet'
import { StatusBadge } from '@/components/ui/status-badge'
import { useFamilyBalance } from '@/hooks/use-family-balance'
import { useUsdIdr } from '@/hooks/use-usd-idr'
import { WAVE_SRC } from '@/lib/brand'
import { payrollConfig } from '@/lib/chain/config'
import { formatToken } from '@/lib/chain/format-token'
import { familyBalanceError, familyDashboardCopy as t } from '@/lib/copy/family'
import { estimateIdr, formatIdrUnits, formatRate } from '@/lib/family-money'

const dateTime = (value: number | string) =>
  new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value))

export function FamilyBalanceCard({
  walletAddress,
  identity,
  ensureSession,
}: {
  walletAddress: string | null
  identity: string | null
  ensureSession: () => Promise<string | null>
}) {
  const balance = useFamilyBalance(walletAddress)
  const fx = useUsdIdr(identity, ensureSession)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const { phase, snapshot, error } = balance
  const quote = fx.quote
  const idr =
    snapshot && quote
      ? estimateIdr(snapshot.balance, payrollConfig.tokenDecimals, quote.rate)
      : null
  const token = snapshot
    ? `${formatToken(snapshot.balance, payrollConfig.tokenDecimals)} ${snapshot.tokenSymbol}`
    : null
  const status = !snapshot
    ? phase === 'loading'
      ? t.balanceLoading
      : familyBalanceError(error, phase).title
    : phase === 'stale'
      ? t.balanceStale
      : snapshot.balance === BigInt(0)
        ? t.balanceEmpty
        : t.balanceReady
  function refresh() {
    balance.refresh()
    fx.refresh()
  }
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <section
        aria-labelledby="family-balance-heading"
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
            <h2 id="family-balance-heading" className="text-label">
              {t.balanceLabel}
            </h2>
            {!snapshot ? (
              <p className="mt-1 text-2xl/8 font-bold">{t.balanceUnavailable}</p>
            ) : idr !== null ? (
              <>
                <p
                  data-testid="family-balance-idr"
                  className="mt-1 break-all font-display text-num-hero tabular-nums"
                >
                  {t.idrEstimate(formatIdrUnits(idr))}
                </p>
                <p
                  data-testid="family-balance-token"
                  className="break-all font-semibold tabular-nums"
                >
                  {token}
                </p>
              </>
            ) : (
              <>
                <p
                  data-testid="family-balance-token"
                  className="mt-1 break-all font-display text-num-hero tabular-nums"
                >
                  {token}
                </p>
                <p className="font-semibold">{fx.loading ? t.rateLoading : t.idrUnavailable}</p>
              </>
            )}
          </div>
          <Button
            variant="on-brand"
            onClick={() => setDetailsOpen(true)}
            className="min-h-11 shrink-0 px-4"
          >
            {t.details}
          </Button>
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-2 text-label">
          {payrollConfig.isMock && <StatusBadge tone="neutral">{t.demo}</StatusBadge>}
          <span role="status">{status}</span>
        </div>
      </section>
      <section
        aria-labelledby="family-actions-heading"
        className="flex min-h-44 flex-col rounded-xl border-[1.5px] border-brand-text bg-surface p-4 md:col-span-1"
      >
        <h2 id="family-actions-heading" className="font-semibold text-brand-text">
          {t.actionsTitle}
        </h2>
        <p className="mt-1 text-label text-muted">{t.actionsPending}</p>
        <div className="mt-auto flex flex-col gap-2 pt-4">
          <Button block disabled>
            {t.payout}
          </Button>
          <Button variant="secondary" block disabled>
            {t.history}
          </Button>
        </div>
      </section>
      <Sheet
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        title={t.detailsTitle}
        description={payrollConfig.isMock ? t.demoHint : undefined}
        footer={
          <Button
            variant="secondary"
            block
            onClick={refresh}
            loading={balance.refreshing || fx.loading}
            loadingLabel={t.refreshing}
          >
            {t.refresh}
          </Button>
        }
      >
        {detailsOpen &&
          (snapshot ? (
            <div className="flex flex-col gap-4">
              <dl className="flex flex-col gap-4">
                {[
                  [t.tokenAmount, token],
                  [
                    t.idrLabel,
                    idr !== null ? t.idrEstimate(formatIdrUnits(idr)) : t.idrUnavailable,
                  ],
                  [t.rateLabel, quote ? formatRate(quote.rate) : t.idrUnavailable],
                  [t.rateSource, quote ? t.rateSources[quote.source] : t.idrUnavailable],
                  [t.rateTime, quote?.rateTime ? dateTime(quote.rateTime) : t.rateTimeUnknown],
                  [t.readTime, balance.readAt ? dateTime(balance.readAt) : t.rateTimeUnknown],
                  [t.block, snapshot.blockNumber.toString()],
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
              {quote?.source === 'fallback' && (
                <p className="text-label text-muted">{t.fallbackHint}</p>
              )}
              <p className="text-label text-muted">
                {phase === 'stale'
                  ? t.staleHint
                  : snapshot.balance === BigInt(0)
                    ? t.emptyHint
                    : t.estimateHint}
              </p>
            </div>
          ) : phase === 'loading' ? (
            <p role="status">{t.balanceLoading}</p>
          ) : (
            <InlineError {...familyBalanceError(error, phase)} />
          ))}
      </Sheet>
    </div>
  )
}
