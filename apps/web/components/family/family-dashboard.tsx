'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { InlineError } from '@/components/ui/inline-error'
import { Skeleton } from '@/components/ui/skeleton'
import { useBankAccounts } from '@/hooks/use-bank-accounts'
import { useFamilyBalance } from '@/hooks/use-family-balance'
import { useFamilyPayout } from '@/hooks/use-family-payout'
import { useFamilyPayouts } from '@/hooks/use-family-payouts'
import { useUsdIdr } from '@/hooks/use-usd-idr'
import { useAccount } from '@/lib/account'
import { statusPhase } from '@/lib/chain/payout-coordinator'
import { familyDashboardCopy } from '@/lib/copy/family'
import { payoutCopy } from '@/lib/copy/family-payout'
import { useDict, useLocale } from '@/lib/i18n/client'
import { useSession, type SessionContextValue } from '@/providers/session-provider'
import { BankAccountList } from './bank-account-list'
import { FamilyBalanceCard } from './family-balance-card'
import { FamilyShell } from './family-shell'
import { PayoutHistory } from './payout-history'
import { PayoutSheet } from './payout-sheet'

export function FamilyDashboard() {
  const account = useAccount()
  const session = useSession()
  const t = useDict(familyDashboardCopy)
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
      <FamilyOverview
        key={`${account.user.id}:${session.user.id}:${session.user.address}`}
        session={session}
        wallet={session.user.address}
        identity={`${account.user.id}:${session.user.id}`}
      />
    </FamilyShell>
  )
}

/**
 * Everything below is scoped to one account (see the key above): the balance,
 * rate, bank accounts and payout flow restart empty after a switch.
 */
function FamilyOverview({
  session,
  wallet,
  identity,
}: {
  session: SessionContextValue
  wallet: string
  identity: string
}) {
  const { locale } = useLocale()
  const t = familyDashboardCopy[locale]
  const p = payoutCopy[locale]
  const balance = useFamilyBalance(wallet)
  const fx = useUsdIdr(identity, session.ensureSession)
  const bank = useBankAccounts(session)
  const [sheetOpen, setSheetOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const signingHandoff = useRef(false)
  const payout = useFamilyPayout(wallet, balance.refresh, () => {
    // Privy shows its own modal; close ours so it does not trap focus.
    signingHandoff.current = true
    Array.from(rootRef.current?.querySelectorAll<HTMLDialogElement>('dialog') ?? [])
      .find((dialog) => dialog.open)
      ?.close()
    setSheetOpen(false)
  })
  const phase = payout.state.phase
  useEffect(() => {
    if (!signingHandoff.current || ['idle', 'confirming', 'signing'].includes(phase)) return
    let active = true
    queueMicrotask(() => {
      if (active && signingHandoff.current) {
        signingHandoff.current = false
        setSheetOpen(true)
      }
    })
    return () => {
      active = false
    }
  }, [phase])
  const history = useFamilyPayouts(session)
  const [historyOpen, setHistoryOpen] = useState(false)
  const registered = payout.state.payout
  const track = history.track
  // A payout just registered joins the history so its status is polled.
  useEffect(() => {
    if (registered) track(registered)
  }, [registered, track])
  const latest = history.find(registered?.id)
  // Status after registration comes from the polled backend DTO only.
  const live =
    registered && latest && ['processing', 'completed', 'payout-failed'].includes(phase)
      ? { ...payout.state, payout: latest, phase: statusPhase(latest) }
      : payout.state
  const livePhase = live.phase
  const snapshot = balance.phase === 'ready' ? balance.snapshot : null
  const inFlight = livePhase !== 'idle' && livePhase !== 'confirming'
  const accounts = bank.page?.data ?? []
  const canStart =
    payout.ready &&
    payout.configured &&
    !!snapshot &&
    snapshot.balance > BigInt(0) &&
    accounts.length > 0
  const hint = inFlight
    ? p.phases[livePhase]
    : !payout.configured
      ? p.notConfigured
      : !bank.page
        ? t.actionsPending
        : accounts.length === 0
          ? p.noBank
          : snapshot && snapshot.balance === BigInt(0)
            ? p.noBalance
            : p.testModeHint
  function openPayout() {
    if (!inFlight) payout.start()
    setSheetOpen(true)
  }
  return (
    <div ref={rootRef} className="flex flex-col gap-8">
      <FamilyBalanceCard
        balance={balance}
        fx={fx}
        payoutLabel={inFlight ? p.status : p.open}
        payoutDisabled={!inFlight && !canStart}
        payoutHint={hint}
        onPayout={openPayout}
        onHistory={() => setHistoryOpen(true)}
      />
      <BankAccountList bank={bank} />
      <PayoutSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        payout={{ ...payout, state: live }}
        accounts={accounts}
        balance={snapshot?.balance ?? null}
        tokenSymbol={snapshot?.tokenSymbol ?? 'mAUSD'}
        quote={fx.quote}
        walletAddress={wallet}
      />
      <PayoutHistory open={historyOpen} onClose={() => setHistoryOpen(false)} history={history} />
    </div>
  )
}

function DashboardSkeleton() {
  const t = useDict(familyDashboardCopy)
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
