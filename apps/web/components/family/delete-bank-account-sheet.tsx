'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { InlineError } from '@/components/ui/inline-error'
import { Sheet } from '@/components/ui/sheet'
import type { BankAccountDto } from '@/lib/api/bank-accounts'
import { isApiError } from '@/lib/api/errors'
import { bankCopy, bankError, bankNames } from '@/lib/copy/family'
import { useLocale } from '@/lib/i18n/client'

/** Confirmation before a soft delete. Payout history is kept by the backend. */
export function DeleteBankAccountSheet({
  account,
  onClose,
  onRemove,
}: {
  account: BankAccountDto | null
  onClose: () => void
  onRemove: (id: string) => Promise<void>
}) {
  const { locale } = useLocale()
  const t = bankCopy[locale].delete
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<unknown>(null)
  const pending = useRef(false)

  function close() {
    if (pending.current) return
    setFailure(null)
    onClose()
  }

  async function confirm() {
    if (!account || pending.current) return
    pending.current = true
    setBusy(true)
    setFailure(null)
    try {
      await onRemove(account.id)
      pending.current = false
      setBusy(false)
      onClose()
    } catch (problem) {
      pending.current = false
      setBusy(false)
      // Already removed elsewhere: the row is gone, nothing left to confirm.
      if (isApiError(problem) && problem.status === 404) onClose()
      else setFailure(problem)
    }
  }

  return (
    <Sheet
      open={account !== null}
      onClose={close}
      title={t.title}
      description={
        account
          ? t.body(bankNames[account.bankCode] ?? account.bankCode, account.accountNumberLast4)
          : undefined
      }
      footer={
        <>
          <Button
            variant="danger"
            block
            loading={busy}
            loadingLabel={t.confirming}
            onClick={confirm}
          >
            {t.confirm}
          </Button>
          <Button variant="secondary" block onClick={close} disabled={busy}>
            {t.cancel}
          </Button>
        </>
      }
    >
      {failure !== null && <InlineError {...bankError(failure, 'mutation', locale)} />}
    </Sheet>
  )
}
