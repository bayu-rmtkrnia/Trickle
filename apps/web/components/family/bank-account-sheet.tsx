'use client'

import { useId, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Field, describedBy, inputClass } from '@/components/ui/field'
import { InlineError } from '@/components/ui/inline-error'
import { Sheet } from '@/components/ui/sheet'
import {
  BANK_CODES,
  normalizeAccountNumber,
  type BankAccountDto,
  type BankCode,
  type CreateBankAccountInput,
  type UpdateBankAccountInput,
} from '@/lib/api/bank-accounts'
import { isApiError } from '@/lib/api/errors'
import { bankCopy, bankError, bankNames } from '@/lib/copy/family'

const t = bankCopy.form
type Errors = { bank?: string; number?: string; name?: string; label?: string }

/**
 * Add or rename a bank account. Mount with a key per target so closing the
 * sheet discards every field, including the full account number.
 */
export function BankAccountSheet({
  open,
  account,
  onClose,
  onCreate,
  onUpdate,
  onGone,
}: {
  open: boolean
  /** `null` adds a new account; otherwise only name and label can change. */
  account: BankAccountDto | null
  onClose: () => void
  onCreate: (input: CreateBankAccountInput) => Promise<unknown>
  onUpdate: (id: string, input: UpdateBankAccountInput) => Promise<unknown>
  onGone: (id: string) => void
}) {
  const formId = useId()
  const bankId = useId()
  const numberId = useId()
  const nameId = useId()
  const labelId = useId()
  const [bankCode, setBankCode] = useState<BankCode | ''>('')
  const [number, setNumber] = useState('')
  const [name, setName] = useState(account?.accountName ?? '')
  const [label, setLabel] = useState(account?.label ?? '')
  const [errors, setErrors] = useState<Errors>({})
  const [failure, setFailure] = useState<unknown>(null)
  const [submitting, setSubmitting] = useState(false)
  const busy = useRef(false)
  const editing = account !== null

  function clear() {
    setBankCode('')
    setNumber('')
    setName(account?.accountName ?? '')
    setLabel(account?.label ?? '')
    setErrors({})
    setFailure(null)
  }
  function close() {
    if (busy.current) return
    clear()
    onClose()
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy.current) return
    const next: Errors = {}
    const digits = editing ? null : normalizeAccountNumber(number)
    const accountName = name.trim()
    const nickname = label.trim()
    if (!editing && !bankCode) next.bank = t.bankRequired
    if (!editing && !digits) next.number = t.numberInvalid
    if (accountName.length < 2 || accountName.length > 100) next.name = t.nameInvalid
    if (nickname.length > 40) next.label = t.labelInvalid
    setErrors(next)
    setFailure(null)
    const first = (
      [
        [next.bank, bankId],
        [next.number, numberId],
        [next.name, nameId],
        [next.label, labelId],
      ] as const
    ).find(([message]) => message)?.[1]
    if (first) {
      document.getElementById(first)?.focus()
      return
    }
    busy.current = true
    setSubmitting(true)
    try {
      // The API rejects an empty label; `null` clears it.
      if (account) await onUpdate(account.id, { accountName, label: nickname || null })
      else
        await onCreate({
          bankCode: bankCode as BankCode,
          accountNumber: digits!,
          accountName,
          label: nickname || null,
        })
      busy.current = false
      setSubmitting(false)
      clear()
      onClose()
    } catch (problem) {
      busy.current = false
      setSubmitting(false)
      if (account && isApiError(problem) && problem.status === 404) onGone(account.id)
      setFailure(problem)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title={editing ? t.editTitle : t.addTitle}
      description={editing ? t.editHint : bankCopy.body}
      footer={
        <Button type="submit" form={formId} block loading={submitting} loadingLabel={t.saving}>
          {t.save}
        </Button>
      }
    >
      <form id={formId} noValidate onSubmit={submit} className="flex flex-col gap-4">
        {account ? (
          <p className="rounded-xl border-[1.5px] border-muted/50 bg-bg px-4 py-3 font-semibold">
            {bankNames[account.bankCode] ?? account.bankCode} ·{' '}
            {bankCopy.masked(account.accountNumberLast4)}
          </p>
        ) : (
          <>
            <Field id={bankId} label={t.bank} error={errors.bank}>
              <select
                id={bankId}
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value as BankCode | '')}
                aria-invalid={Boolean(errors.bank)}
                aria-describedby={describedBy(bankId, errors.bank)}
                className={inputClass(Boolean(errors.bank))}
              >
                <option value="">{t.bankPlaceholder}</option>
                {BANK_CODES.map((code) => (
                  <option key={code} value={code}>
                    {bankNames[code] ?? code}
                  </option>
                ))}
              </select>
            </Field>
            <Field id={numberId} label={t.number} hint={t.numberHint} error={errors.number}>
              <input
                id={numberId}
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                maxLength={40}
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                aria-invalid={Boolean(errors.number)}
                aria-describedby={describedBy(numberId, errors.number, true)}
                className={`${inputClass(Boolean(errors.number))} tabular-nums`}
              />
            </Field>
          </>
        )}
        <Field id={nameId} label={t.name} error={errors.name}>
          <input
            id={nameId}
            autoComplete="off"
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={describedBy(nameId, errors.name)}
            className={inputClass(Boolean(errors.name))}
          />
        </Field>
        <Field id={labelId} label={t.label} hint={t.labelHint} error={errors.label}>
          <input
            id={labelId}
            autoComplete="off"
            maxLength={40}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            aria-invalid={Boolean(errors.label)}
            aria-describedby={describedBy(labelId, errors.label, true)}
            className={inputClass(Boolean(errors.label))}
          />
        </Field>
        {failure !== null && <InlineError {...bankError(failure)} />}
      </form>
    </Sheet>
  )
}
