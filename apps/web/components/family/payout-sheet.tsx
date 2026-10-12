'use client'

import { useId, useState } from 'react'
import type { Hex } from 'viem'
import { Button } from '@/components/ui/button'
import { Field, describedBy, inputClass } from '@/components/ui/field'
import { InlineError } from '@/components/ui/inline-error'
import { Sheet } from '@/components/ui/sheet'
import type { FamilyPayout } from '@/hooks/use-family-payout'
import type { BankAccountDto } from '@/lib/api/bank-accounts'
import type { FxQuoteDto } from '@/lib/api/fx'
import { payrollConfig } from '@/lib/chain/config'
import { formatToken } from '@/lib/chain/format-token'
import { bankCopy, bankNames } from '@/lib/copy/family'
import { payoutCopy as t, payoutMessage } from '@/lib/copy/family-payout'
import { estimateIdr, formatIdrUnits, parseTokenAmount } from '@/lib/family-money'
import { PayoutStatus as PayoutStatusBlock } from './payout-status'

const HASH = /^0x[0-9a-fA-F]{64}$/

function BankChoice({
  accounts,
  value,
  onChange,
  name,
}: {
  accounts: BankAccountDto[]
  value: string
  onChange: (id: string) => void
  name: string
}) {
  return (
    <div className="flex flex-col gap-2">
      {accounts.map((account) => (
        <label
          key={account.id}
          className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-[1.5px] border-muted px-4 has-checked:border-brand-text"
        >
          <input
            type="radio"
            name={name}
            value={account.id}
            checked={value === account.id}
            onChange={() => onChange(account.id)}
          />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">
              {bankNames[account.bankCode] ?? account.bankCode} ·{' '}
              {bankCopy.masked(account.accountNumberLast4)}
            </span>
            <span className="block truncate text-label text-muted">
              {account.label ?? account.accountName}
            </span>
          </span>
        </label>
      ))}
    </div>
  )
}

export function PayoutSheet({
  open,
  onClose,
  payout,
  accounts,
  balance,
  tokenSymbol,
  quote,
  walletAddress,
}: {
  open: boolean
  onClose: () => void
  payout: FamilyPayout
  accounts: BankAccountDto[]
  /** Verified `balanceOf` for the current snapshot, or `null` while unknown/stale. */
  balance: bigint | null
  tokenSymbol: string
  quote: FxQuoteDto | null
  walletAddress: string | null
}) {
  const amountId = useId()
  const bankGroup = useId()
  const recoveryId = useId()
  const [bankId, setBankId] = useState('')
  const [amount, setAmount] = useState('')
  const [errors, setErrors] = useState<{ amount?: string; bank?: string }>({})
  const [recoveryHash, setRecoveryHash] = useState('')
  const [replacementBank, setReplacementBank] = useState('')
  const [checkedExplorer, setCheckedExplorer] = useState(false)
  const { state } = payout
  const unreadable = state.phase === 'submission-unknown' && state.unreadable
  const decimals = payrollConfig.tokenDecimals
  const parsed = parseTokenAmount(amount, decimals)
  const estimate =
    parsed.ok && quote ? formatIdrUnits(estimateIdr(parsed.units, decimals, quote.rate)) : null
  const busy = state.checking || state.phase === 'signing'
  const bankMissing =
    state.phase === 'registration-pending' &&
    (state.error as { code?: unknown } | null)?.code === 'BANK_ACCOUNT_NOT_FOUND'
  const finished = ['processing', 'completed', 'transfer-failed', 'payout-failed'].includes(
    state.phase,
  )
  const selectedBank = bankId || (accounts.length === 1 ? accounts[0]!.id : '')

  function submit() {
    const next: typeof errors = {}
    if (!parsed.ok) next.amount = t.amountErrors[parsed.reason]
    else if (balance === null || parsed.units > balance) next.amount = t.amountErrors.balance
    if (!accounts.some((account) => account.id === selectedBank)) next.bank = t.bankRequired
    setErrors(next)
    if (next.amount || next.bank || !parsed.ok) return
    payout.submit({ amountUnits: parsed.units, bankAccountId: selectedBank })
  }
  function close() {
    if (state.phase === 'confirming') {
      payout.cancel()
      setAmount('')
      setErrors({})
    }
    setRecoveryHash('')
    onClose()
  }
  function finish() {
    payout.dismiss()
    setAmount('')
    setRecoveryHash('')
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title={
        state.phase === 'confirming' || state.phase === 'idle' ? t.title : t.phases[state.phase]
      }
      description={t.testModeHint}
      footer={
        <>
          {state.phase === 'confirming' && (
            <Button
              block
              onClick={submit}
              loading={state.checking}
              loadingLabel={t.preparing}
              disabled={!payout.configured || balance === null || accounts.length === 0}
            >
              {t.confirm}
            </Button>
          )}
          {unreadable && (
            <Button
              block
              variant="danger"
              disabled={!checkedExplorer}
              onClick={() => {
                payout.discardUnreadable(checkedExplorer)
                setCheckedExplorer(false)
              }}
            >
              {t.discard}
            </Button>
          )}
          {state.phase === 'submission-unknown' && !unreadable && (
            <Button
              block
              onClick={() =>
                recoveryHash.trim() ? payout.resume(recoveryHash.trim() as Hex) : payout.resume()
              }
              loading={state.checking}
              loadingLabel={t.checking}
              disabled={recoveryHash.trim() ? !HASH.test(recoveryHash.trim()) : !state.hash}
            >
              {t.check}
            </Button>
          )}
          {state.phase === 'submission-unknown' && !unreadable && state.hash === null && (
            <Button
              block
              variant="secondary"
              onClick={payout.abandon}
              loading={state.checking}
              loadingLabel={t.checking}
            >
              {t.verifyUnsent}
            </Button>
          )}
          {state.phase === 'registration-pending' && !bankMissing && (
            <Button
              block
              onClick={payout.retryRegistration}
              loading={state.checking}
              loadingLabel={t.registering}
            >
              {t.retryRegistration}
            </Button>
          )}
          {bankMissing && (
            <Button
              block
              onClick={() => payout.changeBank(replacementBank)}
              loading={state.checking}
              loadingLabel={t.registering}
              disabled={!accounts.some((account) => account.id === replacementBank)}
            >
              {t.changeBank}
            </Button>
          )}
          {finished && (
            <Button block onClick={finish}>
              {t.done}
            </Button>
          )}
          <Button block variant="secondary" onClick={close} disabled={state.phase === 'signing'}>
            {state.phase === 'confirming' ? t.cancel : t.close}
          </Button>
        </>
      }
    >
      {state.phase === 'confirming' ? (
        !payout.configured ? (
          <InlineError title={t.notConfigured} message={t.notConfiguredBody} />
        ) : accounts.length === 0 ? (
          <p>{t.noBank}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <fieldset
              className="flex flex-col gap-2"
              aria-describedby={errors.bank ? `${bankGroup}-error` : undefined}
            >
              <legend className="mb-1 text-label">{t.bank}</legend>
              <BankChoice
                accounts={accounts}
                value={selectedBank}
                onChange={setBankId}
                name={bankGroup}
              />
              {errors.bank && (
                <p id={`${bankGroup}-error`} className="text-label text-danger">
                  {errors.bank}
                </p>
              )}
            </fieldset>
            <Field
              id={amountId}
              label={t.amount}
              hint={
                balance === null
                  ? undefined
                  : t.amountHint(`${formatToken(balance, decimals)} ${tokenSymbol}`)
              }
              error={errors.amount}
            >
              <div className="flex gap-2">
                <input
                  id={amountId}
                  inputMode="decimal"
                  autoComplete="off"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={busy}
                  aria-invalid={Boolean(errors.amount)}
                  aria-describedby={describedBy(amountId, errors.amount, balance !== null)}
                  className={`${inputClass(Boolean(errors.amount))} tabular-nums`}
                />
                <Button
                  variant="secondary"
                  disabled={balance === null || balance === BigInt(0) || busy}
                  onClick={() =>
                    balance !== null && setAmount(formatToken(balance, decimals).replace(/\./g, ''))
                  }
                >
                  {t.max}
                </Button>
              </div>
            </Field>
            <div className="rounded-xl border-[1.5px] border-muted/50 bg-bg p-4">
              <p className="text-label text-muted">{t.estimate}</p>
              <p className="mt-1 text-xl/7 font-bold tabular-nums">
                {estimate ? `≈ ${estimate}` : '–'}
              </p>
              <p className="mt-2 text-label text-muted">
                {quote ? t.estimateHint : t.rateUnavailable}
              </p>
            </div>
            {state.error !== null && state.error !== undefined && (
              <PayoutStatusError error={state.error} />
            )}
          </div>
        )
      ) : (
        <div className="flex flex-col gap-4">
          <PayoutStatusBlock state={state} />
          {bankMissing && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 font-semibold">{t.changeBankTitle}</legend>
              <p className="text-label text-muted">{t.changeBankBody}</p>
              <BankChoice
                accounts={accounts.filter((account) => account.id !== state.bankAccountId)}
                value={replacementBank}
                onChange={setReplacementBank}
                name={`${bankGroup}-replacement`}
              />
            </fieldset>
          )}
          {unreadable && (
            <div className="flex flex-col gap-3">
              <InlineError title={t.unreadableTitle} message={t.unreadableBody} />
              {state.hash && (
                <div>
                  <p className="text-label text-muted">{t.unreadableHash}</p>
                  <a
                    href={`${payrollConfig.explorerUrl}/tx/${state.hash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block break-all font-mono text-label underline underline-offset-4"
                  >
                    {state.hash}
                  </a>
                </div>
              )}
              {walletAddress && (
                <a
                  href={`${payrollConfig.explorerUrl}/address/${walletAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-label underline underline-offset-4"
                >
                  {t.recoveryExplorer}
                </a>
              )}
              <label className="flex items-start gap-3 text-label">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checkedExplorer}
                  onChange={(e) => setCheckedExplorer(e.target.checked)}
                />
                <span>{t.unreadableConfirm}</span>
              </label>
            </div>
          )}
          {state.phase === 'submission-unknown' && !unreadable && (
            <>
              {state.hash === null && <p className="text-label text-muted">{t.verifyUnsentHint}</p>}
              <Field id={recoveryId} label={t.recoveryLabel} hint={t.recoveryHint}>
                <input
                  id={recoveryId}
                  aria-describedby={`${recoveryId}-hint`}
                  className={inputClass()}
                  value={recoveryHash}
                  onChange={(e) => setRecoveryHash(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={busy}
                />
              </Field>
              {walletAddress && (
                <a
                  href={`${payrollConfig.explorerUrl}/address/${walletAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-label underline underline-offset-4"
                >
                  {t.recoveryExplorer}
                </a>
              )}
            </>
          )}
        </div>
      )}
    </Sheet>
  )
}

function PayoutStatusError({ error }: { error: unknown }) {
  return <InlineError title={t.errorTitle} message={payoutMessage(error)} />
}
