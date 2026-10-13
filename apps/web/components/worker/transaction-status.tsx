import { StatusBadge } from '@/components/ui/status-badge'
import { InlineError } from '@/components/ui/inline-error'
import { withdrawCopy, withdrawalMessage } from '@/lib/copy/withdraw'
import { useLocale } from '@/lib/i18n/client'
import { payrollConfig as config } from '@/lib/chain/config'
import { formatToken } from '@/lib/chain/format-token'
import type { WithdrawalState } from '@/lib/chain/withdrawal-coordinator'
export function TransactionStatus({
  state,
  tokenSymbol,
}: {
  state: WithdrawalState
  tokenSymbol: string
}) {
  const { locale } = useLocale()
  const t = withdrawCopy[locale]
  return (
    <div className="flex flex-col gap-3" role="status">
      <StatusBadge tone="neutral">{t.phases[state.phase]}</StatusBadge>
      {state.phase === 'signing' && <p className="text-sm/6">{t.signing}</p>}
      {state.phase === 'pending' && <p className="text-sm/6">{t.pending}</p>}
      {state.phase === 'unknown' && <p className="text-sm/6">{t.unknown}</p>}
      {!!state.error && (
        <InlineError title={t.errorTitle} message={withdrawalMessage(state.error, locale)} />
      )}
      {state.result && (
        <div>
          <p className="font-semibold">{t.actual}</p>
          <dl className="mt-2 flex flex-col gap-3">
            <div>
              <dt>{t.worker}</dt>
              <dd className="break-all font-semibold tabular-nums">
                {formatToken(state.result.toWorker, config.tokenDecimals, locale)} {tokenSymbol}
              </dd>
            </div>
            <div>
              <dt>{t.family}</dt>
              <dd className="break-all font-semibold tabular-nums">
                {formatToken(state.result.toRecipients, config.tokenDecimals, locale)} {tokenSymbol}
              </dd>
            </div>
            {state.result.paid.map((payment, index) => (
              <div key={`${payment.recipient}:${index}`}>
                <dt className="text-label text-muted">
                  {t.recipient(index + 1, payment.recipient)}
                </dt>
                <dd className="break-all tabular-nums">
                  {formatToken(payment.amount, config.tokenDecimals, locale)} {tokenSymbol}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {state.hash && (
        <a
          href={`${config.explorerUrl}/tx/${state.hash}`}
          target="_blank"
          rel="noreferrer"
          className="text-sm/6 underline underline-offset-4"
        >
          {t.explorer}
        </a>
      )}
    </div>
  )
}
