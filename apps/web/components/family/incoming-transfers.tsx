'use client'

import { Button } from '@/components/ui/button'
import { InlineError } from '@/components/ui/inline-error'
import { PersonCard } from '@/components/ui/person-card'
import { Skeleton } from '@/components/ui/skeleton'
import type { UsdIdrState } from '@/hooks/use-usd-idr'
import type { IncomingTransfersState } from '@/hooks/use-incoming-transfers'
import type { IncomingTransferDto } from '@/lib/api/incoming-transfers'
import { payrollConfig } from '@/lib/chain/config'
import { familyIncomingCopy, incomingError } from '@/lib/copy/family-incoming'
import { estimateIdr, formatIdrUnits } from '@/lib/family-money'
import { formatUsd } from '@/lib/format'
import { INTL_LOCALE, type Locale } from '@/lib/i18n/config'
import { useLocale } from '@/lib/i18n/client'

const when = (iso: string, locale: Locale) =>
  new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))

const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`

/** Who sent it: their Trickle name, or a short wallet address when they have none. */
export const senderName = (transfer: IncomingTransferDto) =>
  transfer.sender?.displayName?.trim() || shortAddress(transfer.workerAddress)

/**
 * "Money received" list on the family dashboard (KF-16): each `SplitPaid`
 * share with its sender, time, USD amount and a rupiah estimate.
 */
export function IncomingTransfers({
  incoming,
  fx,
}: {
  incoming: IncomingTransfersState
  fx: Pick<UsdIdrState, 'quote'>
}) {
  const { locale } = useLocale()
  const t = familyIncomingCopy[locale]
  const rows = incoming.page?.data ?? []
  return (
    <section aria-labelledby="family-incoming-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="family-incoming-heading" className="text-section font-bold">
          {t.title}
        </h2>
        <p className="mt-1 text-label text-muted">{t.body}</p>
      </div>
      {incoming.loading && !incoming.page ? (
        <div role="status" aria-label={t.loading} className="flex flex-col gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : incoming.error !== null && !incoming.page ? (
        <>
          <InlineError {...incomingError(incoming.error, false, locale)} />
          <Button variant="secondary" block onClick={incoming.reload}>
            {t.retry}
          </Button>
        </>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border-[1.5px] border-brand-text bg-surface p-4">
          <h3 className="font-bold">{t.emptyTitle}</h3>
          <p className="mt-2 text-label text-muted">{t.emptyBody}</p>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-3 md:grid md:grid-cols-2">
            {rows.map((transfer) => {
              const units = BigInt(transfer.amountUnits)
              const name = senderName(transfer)
              const date = when(transfer.paidAt, locale)
              const idr = fx.quote
                ? estimateIdr(units, payrollConfig.tokenDecimals, fx.quote.rate)
                : null
              return (
                <li key={transfer.id} className="min-w-0">
                  <PersonCard
                    name={name}
                    subtitle={
                      <>
                        <time dateTime={transfer.paidAt}>{date}</time>
                        {' · '}
                        <a
                          href={`${payrollConfig.explorerUrl}/tx/${transfer.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={t.explorerLabel(name, date)}
                          className="underline underline-offset-2"
                        >
                          {t.explorer}
                        </a>
                      </>
                    }
                    trailing={
                      <>
                        <span className="block font-semibold tabular-nums">
                          {formatUsd(Number(units) / 10 ** payrollConfig.tokenDecimals, locale)}
                        </span>
                        {idr !== null && (
                          <span className="block text-label text-muted tabular-nums">
                            {t.idrEstimate(formatIdrUnits(idr, locale))}
                          </span>
                        )}
                      </>
                    }
                  />
                </li>
              )
            })}
          </ul>
          {incoming.pageError !== null && (
            <InlineError {...incomingError(incoming.pageError, true, locale)} />
          )}
          {incoming.page?.nextCursor && (
            <Button
              variant="secondary"
              block
              onClick={incoming.loadMore}
              loading={incoming.loadingMore}
              loadingLabel={t.loadingMore}
            >
              {t.more}
            </Button>
          )}
        </>
      )}
    </section>
  )
}
