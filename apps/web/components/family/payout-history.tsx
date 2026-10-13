'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { InlineError } from '@/components/ui/inline-error'
import { Sheet } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge, type BadgeTone } from '@/components/ui/status-badge'
import type { FamilyPayoutsState } from '@/hooks/use-family-payouts'
import type { PayoutDto } from '@/lib/api/payouts'
import { payrollConfig } from '@/lib/chain/config'
import { bankNames } from '@/lib/copy/family'
import { payoutDictionary, payoutMessage } from '@/lib/copy/family-payout'
import { formatIdr } from '@/lib/format'
import { INTL_LOCALE } from '@/lib/i18n/config'
import { useDict, useLocale } from '@/lib/i18n/client'
import { PayoutDetails } from './payout-status'

const statusTone = (status: string): BadgeTone =>
  status === 'COMPLETED' ? 'success' : status === 'FAILED' ? 'danger' : 'warn'
/** "12.5" -> "12,5" without converting the server decimal string to Number. */
const tokenText = (amountUsd: string, locale: 'id' | 'en') =>
  `${locale === 'id' ? amountUsd.replace('.', ',') : amountUsd} mAUSD`
const when = (iso: string, locale: 'id' | 'en') =>
  new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))

export function PayoutStatusBadge({ status }: { status: string }) {
  const h = useDict(payoutDictionary).history
  return <StatusBadge tone={statusTone(status)}>{h.statuses[status] ?? status}</StatusBadge>
}

function Explorer({ hash }: { hash: string }) {
  const p = useDict(payoutDictionary)
  return (
    <a
      href={`${payrollConfig.explorerUrl}/tx/${hash}`}
      target="_blank"
      rel="noreferrer"
      className="text-label underline underline-offset-4"
    >
      {p.explorer}
    </a>
  )
}

function Detail({ payout }: { payout: PayoutDto }) {
  const p = useDict(payoutDictionary)
  const h = p.history
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <PayoutStatusBadge status={payout.status} />
        <StatusBadge tone="neutral">{p.testMode}</StatusBadge>
      </div>
      <PayoutDetails payout={payout} />
      <div>
        <p className="text-label text-muted">{p.hash}</p>
        <p className="mt-1 break-all font-mono text-label">{payout.sourceTxHash}</p>
        <Explorer hash={payout.sourceTxHash} />
      </div>
      <p className="text-label text-muted">
        {payout.status === 'FAILED' ? h.failedHint : h.providerHint}
      </p>
    </div>
  )
}

export function PayoutHistory({
  open,
  onClose,
  history,
}: {
  open: boolean
  onClose: () => void
  history: FamilyPayoutsState
}) {
  const p = useDict(payoutDictionary)
  const h = p.history
  const { locale } = useLocale()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = history.find(selectedId ?? undefined)
  const rows = history.page?.data ?? []
  function close() {
    setSelectedId(null)
    onClose()
  }
  return (
    <Sheet
      open={open}
      onClose={close}
      title={selected ? h.detailTitle : h.title}
      description={p.testModeHint}
      footer={
        selected ? (
          <Button variant="secondary" block onClick={() => setSelectedId(null)}>
            {h.back}
          </Button>
        ) : undefined
      }
    >
      {selected ? (
        <Detail payout={selected} />
      ) : history.loading && !history.page ? (
        <div role="status" aria-label={h.loading} className="flex flex-col gap-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : history.error ? (
        <div className="flex flex-col gap-3">
          <InlineError title={h.loadError} message={h.loadErrorBody} />
          <Button
            variant="secondary"
            block
            onClick={history.reload}
            disabled={history.retryUntil > 0}
          >
            {h.retry}
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border-[1.5px] border-brand-text bg-surface p-4">
          <h3 className="font-bold">{h.emptyTitle}</h3>
          <p className="mt-2 text-label text-muted">{h.emptyBody}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {history.pollError !== null && (
            <p role="status" className="text-label text-muted">
              {h.pollError}
            </p>
          )}
          <ul className="flex flex-col gap-3">
            {rows.map((payout) => (
              <li key={payout.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(payout.id)}
                  aria-label={h.detail(when(payout.createdAt, locale))}
                  className="flex w-full flex-col gap-2 rounded-xl border-[1.5px] border-brand-text bg-surface p-4 text-left active:scale-[0.99]"
                >
                  <span className="flex w-full flex-wrap items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block font-bold tabular-nums">
                        {payout.amountIdr === null
                          ? h.idrPending
                          : formatIdr(payout.amountIdr, locale)}
                      </span>
                      <span className="block text-label text-muted tabular-nums">
                        {tokenText(payout.amountUsd, locale)}
                      </span>
                    </span>
                    <PayoutStatusBadge status={payout.status} />
                  </span>
                  <span className="text-label text-muted">
                    {bankNames[payout.bankAccount.bankCode] ?? payout.bankAccount.bankCode} ••••{' '}
                    {payout.bankAccount.accountNumberLast4} ·{' '}
                    <time dateTime={payout.createdAt}>{when(payout.createdAt, locale)}</time>
                  </span>
                  <StatusBadge tone="neutral">{p.testMode}</StatusBadge>
                </button>
              </li>
            ))}
          </ul>
          {history.pageError !== null && (
            <InlineError title={h.pageError} message={payoutMessage(history.pageError, locale)} />
          )}
          {history.page?.nextCursor && (
            <Button
              variant="secondary"
              block
              onClick={history.loadMore}
              loading={history.loadingMore}
              loadingLabel={h.loadingMore}
              disabled={history.retryUntil > 0}
            >
              {h.more}
            </Button>
          )}
        </div>
      )}
    </Sheet>
  )
}
