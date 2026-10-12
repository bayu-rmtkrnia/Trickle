import { InlineError } from '@/components/ui/inline-error'
import { StatusBadge, type BadgeTone } from '@/components/ui/status-badge'
import type { PayoutDto } from '@/lib/api/payouts'
import { payrollConfig } from '@/lib/chain/config'
import { formatToken } from '@/lib/chain/format-token'
import type { FamilyPayoutState } from '@/lib/chain/payout-coordinator'
import { bankNames } from '@/lib/copy/family'
import { payoutCopy as t, payoutMessage } from '@/lib/copy/family-payout'
import { formatIdr } from '@/lib/format'

const tone = (phase: FamilyPayoutState['phase']): BadgeTone =>
  phase === 'completed'
    ? 'success'
    : ['transfer-failed', 'payout-failed'].includes(phase)
      ? 'danger'
      : 'warn'

/** Server payout fields; the IDR amount shown here is the backend's, not an estimate. */
export function PayoutDetails({ payout }: { payout: PayoutDto }) {
  const rows: [string, string][] = [
    [t.sentAmount, `${payout.amountUsd} mAUSD`],
    [t.receivedIdr, payout.amountIdr === null ? '–' : formatIdr(payout.amountIdr)],
    [
      t.account,
      `${bankNames[payout.bankAccount.bankCode] ?? payout.bankAccount.bankCode} •••• ${payout.bankAccount.accountNumberLast4}`,
    ],
    [t.provider, `${payout.provider} (${t.testMode})`],
  ]
  if (payout.fxRate !== null) rows.splice(2, 0, [t.rate, String(payout.fxRate)])
  if (payout.providerRef) rows.push([t.reference, payout.providerRef])
  if (payout.failureReason) rows.push([t.failureReason, payout.failureReason])
  return (
    <dl className="flex flex-col gap-3">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-muted/20 pb-2 last:border-0"
        >
          <dt className="text-label text-muted">{label}</dt>
          <dd className="break-all font-semibold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function PayoutStatus({ state }: { state: FamilyPayoutState }) {
  const body = (t.bodies as Record<string, string | undefined>)[state.phase]
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={tone(state.phase)}>{t.phases[state.phase]}</StatusBadge>
        <StatusBadge tone="neutral">{t.testMode}</StatusBadge>
      </div>
      {body && <p role="status">{body}</p>}
      {state.amountUnits !== null && !state.payout && (
        <p className="font-semibold tabular-nums">
          {t.sentAmount}: {formatToken(state.amountUnits, payrollConfig.tokenDecimals)} mAUSD
        </p>
      )}
      {state.hash && (
        <div>
          <p className="text-label text-muted">{t.hash}</p>
          <p className="mt-1 break-all font-mono text-label">{state.hash}</p>
          <a
            href={`${payrollConfig.explorerUrl}/tx/${state.hash}`}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-label underline underline-offset-4"
          >
            {t.explorer}
          </a>
        </div>
      )}
      {state.payout && <PayoutDetails payout={state.payout} />}
      {state.error !== null && state.error !== undefined && (
        <InlineError title={t.errorTitle} message={payoutMessage(state.error)} />
      )}
    </div>
  )
}
