'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { InlineError } from '@/components/ui/inline-error'
import { PersonCard } from '@/components/ui/person-card'
import { Skeleton } from '@/components/ui/skeleton'
import { useBankAccounts } from '@/hooks/use-bank-accounts'
import { MAX_BANK_ACCOUNTS, type BankAccountDto } from '@/lib/api/bank-accounts'
import { bankCopy as t, bankError, bankNames } from '@/lib/copy/family'
import type { SessionContextValue } from '@/providers/session-provider'
import { BankAccountSheet } from './bank-account-sheet'
import { DeleteBankAccountSheet } from './delete-bank-account-sheet'

type Target = { mode: 'create' } | { mode: 'edit'; account: BankAccountDto }

export function BankAccountList({ session }: { session: SessionContextValue }) {
  const bank = useBankAccounts(session)
  const [target, setTarget] = useState<Target>({ mode: 'create' })
  const [formOpen, setFormOpen] = useState(false)
  const [removing, setRemoving] = useState<BankAccountDto | null>(null)
  // A fresh key per opening remounts the form, so nothing typed survives a close.
  const [formKey, setFormKey] = useState(0)
  const accounts = bank.page?.data ?? []
  const full = accounts.length >= MAX_BANK_ACCOUNTS
  const name = (account: BankAccountDto) => bankNames[account.bankCode] ?? account.bankCode

  function open(next: Target) {
    setFormKey((value) => value + 1)
    setTarget(next)
    setFormOpen(true)
  }

  return (
    <section aria-labelledby="family-bank-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="family-bank-heading" className="text-section font-bold">
            {t.title}
          </h2>
          <p className="mt-1 text-label text-muted">{t.body}</p>
        </div>
        {bank.page && !bank.error && (
          <Button variant="secondary" disabled={full} onClick={() => open({ mode: 'create' })}>
            {t.add}
          </Button>
        )}
      </div>
      {bank.loading && !bank.page ? (
        <div role="status" aria-label={t.loading} className="flex flex-col gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : bank.error ? (
        <>
          <InlineError {...bankError(bank.error, 'load')} />
          <Button variant="secondary" block onClick={bank.reload} disabled={bank.retryUntil > 0}>
            {t.retry}
          </Button>
        </>
      ) : accounts.length === 0 ? (
        <div className="rounded-xl border-[1.5px] border-brand-text bg-surface p-4">
          <h3 className="font-bold">{t.emptyTitle}</h3>
          <p className="mt-2 text-label text-muted">{t.emptyBody}</p>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-3 md:grid md:grid-cols-2">
            {accounts.map((account) => (
              <li key={account.id} className="min-w-0">
                <PersonCard
                  name={name(account)}
                  subtitle={`${account.label ?? account.accountName} · ${t.masked(account.accountNumberLast4)}`}
                  trailing={
                    <span className="flex gap-1">
                      <Button
                        variant="text"
                        aria-label={t.editLabel(name(account), account.accountNumberLast4)}
                        onClick={() => open({ mode: 'edit', account })}
                      >
                        {t.edit}
                      </Button>
                      <Button
                        variant="text"
                        aria-label={t.removeLabel(name(account), account.accountNumberLast4)}
                        onClick={() => setRemoving(account)}
                      >
                        {t.remove}
                      </Button>
                    </span>
                  }
                />
              </li>
            ))}
          </ul>
          {full && <p className="text-label text-muted">{t.limit(MAX_BANK_ACCOUNTS)}</p>}
          {bank.pageError !== null && <InlineError {...bankError(bank.pageError, 'page')} />}
          {bank.page?.nextCursor && (
            <Button
              variant="secondary"
              block
              onClick={bank.loadMore}
              loading={bank.loadingMore}
              loadingLabel={t.loadingMore}
              disabled={bank.retryUntil > 0}
            >
              {t.more}
            </Button>
          )}
        </>
      )}
      <BankAccountSheet
        key={formKey}
        open={formOpen}
        account={target.mode === 'edit' ? target.account : null}
        onClose={() => setFormOpen(false)}
        onCreate={bank.create}
        onUpdate={bank.update}
        onGone={bank.forget}
      />
      <DeleteBankAccountSheet
        account={removing}
        onClose={() => setRemoving(null)}
        onRemove={bank.remove}
      />
    </section>
  )
}
