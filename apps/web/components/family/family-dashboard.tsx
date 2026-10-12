'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { InlineError } from '@/components/ui/inline-error'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccount } from '@/lib/account'
import { familyDashboardCopy as t } from '@/lib/copy/family'
import { useSession } from '@/providers/session-provider'
import { FamilyBalanceCard } from './family-balance-card'
import { FamilyShell } from './family-shell'

export function FamilyDashboard() {
  const account = useAccount()
  const session = useSession()
  const [recovering, setRecovering] = useState(false)
  const [loginFailed, setLoginFailed] = useState(false)
  async function recover() {
    if (recovering) return
    setRecovering(true)
    try {
      await session.refreshMe()
    } catch {
      /* The provider exposes the recovery error. */
    } finally {
      setRecovering(false)
    }
  }
  if (!account.configured)
    return (
      <FamilyShell>
        <InlineError title={t.configuration} message={t.configurationBody} />
      </FamilyShell>
    )
  if (!account.ready) return <DashboardSkeleton />
  if (!account.authenticated)
    return (
      <FamilyShell>
        <section className="mx-auto flex max-w-md flex-col gap-4 py-6">
          <h2 className="text-xl/7 font-bold">{t.loginTitle}</h2>
          <p className="text-muted">{t.loginBody}</p>
          {loginFailed && <InlineError title={t.loginError} message={t.loginErrorBody} />}
          <Button
            block
            onClick={() => {
              setLoginFailed(false)
              try {
                account.login()
              } catch {
                setLoginFailed(true)
              }
            }}
          >
            {t.login}
          </Button>
        </section>
      </FamilyShell>
    )
  if (session.status === 'error')
    return (
      <FamilyShell>
        <InlineError title={t.sessionError} message={t.sessionErrorBody} />
        <Button className="mt-4" onClick={recover} loading={recovering} loadingLabel={t.recovering}>
          {t.recover}
        </Button>
      </FamilyShell>
    )
  const walletMatches =
    !!session.user &&
    !!account.walletAddress &&
    session.user.address.toLowerCase() === account.walletAddress.toLowerCase()
  if (session.status === 'ready' && session.user && account.user && !walletMatches)
    return (
      <FamilyShell>
        <InlineError title={t.walletMismatch} message={t.walletMismatchBody} />
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={recover} loading={recovering} loadingLabel={t.recovering}>
            {t.recover}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              void session.logout().catch(() => undefined)
            }}
          >
            {t.logout}
          </Button>
        </div>
      </FamilyShell>
    )
  if (session.status !== 'ready' || !session.user || !account.user || !walletMatches)
    return <DashboardSkeleton />
  const name = session.user.displayName ?? t.fallbackName
  if (!session.user.roles.recipient)
    return (
      <FamilyShell name={name}>
        <div className="mx-auto flex max-w-md flex-col gap-4 py-6">
          <InlineError title={t.notRecipientTitle} message={t.notRecipientBody} />
          <Button
            variant="secondary"
            onClick={recover}
            loading={recovering}
            loadingLabel={t.recovering}
          >
            {t.recover}
          </Button>
        </div>
      </FamilyShell>
    )
  return (
    <FamilyShell name={name}>
      <div className="flex flex-col gap-8">
        <FamilyBalanceCard
          key={`${account.user.id}:${session.user.address}`}
          walletAddress={session.user.address}
          identity={`${account.user.id}:${session.user.id}`}
          ensureSession={session.ensureSession}
        />
      </div>
    </FamilyShell>
  )
}

function DashboardSkeleton() {
  return (
    <FamilyShell>
      <div role="status" aria-label={t.loading} className="flex flex-col gap-4">
        <span className="text-muted">{t.loading}</span>
        <Skeleton className="h-44" />
        <Skeleton className="h-28" />
      </div>
    </FamilyShell>
  )
}
