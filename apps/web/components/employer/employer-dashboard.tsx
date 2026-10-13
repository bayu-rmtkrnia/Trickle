'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { DashboardHeader } from '@/components/ui/dashboard-header'
import { PlusIcon, UsersIcon } from '@/components/ui/icons'
import { AuthGate } from '@/components/auth/auth-gate'
import { SignOutButton } from '@/components/auth/sign-out-button'
import { InlineError } from '@/components/ui/inline-error'
import { Skeleton } from '@/components/ui/skeleton'
import { useStreamFunding } from '@/hooks/use-stream-funding'
import {
  applyMockScenario,
  getEmployer,
  isMockMode,
  listInvites,
  listStreams,
  listWorkers,
  mockFunding,
  type CompanyStream,
  type Employer,
  type Invite,
  type Worker,
} from '@/lib/api'
import { apiErrorMessage } from '@/lib/api-error-message'
import type { EmployerState } from '@/lib/dev-state'
import { formatUsd } from '@/lib/format'
import { summarizeFunds } from '@/lib/company-streams'
import { createFundingPort } from '@/lib/chain/stream-funder'
import type { Address } from 'viem'
import { InviteList } from './invite-list'
import { useEmployerCopy } from './use-employer-copy'
import { InviteWorkerSheet } from './invite-worker-sheet'
import { RevokeInviteSheet } from './revoke-invite-sheet'
import { FundSheet } from './fund-sheet'
import { FundsCard } from './funds-card'
import { StopStreamSheet } from './stop-stream-sheet'
import { WorkerList } from './worker-list'

type Data = {
  employer: Employer
  workers: Worker[]
  invites: Invite[]
  /** Aliran gaji dari indexer backend. */
  streams: CompanyStream[]
  loadedAt: number
}
type Tab = 'workers' | 'invites'

type LoadResult = Data | null | { error: unknown }

/** Saldo mAUSD di akun perusahaan. `null` kalau belum bisa dibaca (kartu cukup menyembunyikannya). */
async function loadWalletUnits(address: Address | null): Promise<bigint | null> {
  try {
    if (isMockMode()) return await mockFunding.walletUnits()
    if (!address) return null
    return await createFundingPort(async () => {
      throw new Error('Gas tidak dibutuhkan untuk membaca saldo')
    }).tokenBalance(address)
  } catch {
    return null
  }
}

/** `null` = belum punya profil perusahaan. */
async function loadDashboard(): Promise<LoadResult> {
  try {
    const employer = await getEmployer()
    if (!employer) return null
    const [workers, invites, streams] = await Promise.all([
      listWorkers(),
      listInvites(),
      listStreams(),
    ])
    return { employer, workers, invites, streams, loadedAt: Date.now() }
  } catch (error) {
    return { error }
  }
}

/** Dashboard employer, mobile-first (DESIGN.md 6.6, 7.3). Butuh login, kecuali pratinjau `?state=`. */
export function EmployerDashboard({ devState }: { devState?: EmployerState }) {
  return (
    <AuthGate
      mock={devState !== undefined}
      loading={<DashboardSkeleton />}
      frame={(node) => <Shell>{node}</Shell>}
    >
      <DashboardContent devState={devState} />
    </AuthGate>
  )
}

function DashboardContent({ devState }: { devState?: EmployerState }) {
  const { copy, locale } = useEmployerCopy()
  const t = copy.dashboard
  const router = useRouter()
  const [data, setData] = useState<Data | null>(null)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [tab, setTab] = useState<Tab>(devState === 'ada-undangan' ? 'invites' : 'workers')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<Invite | null>(null)
  const [fundOpen, setFundOpen] = useState(false)
  const [fundWorkerId, setFundWorkerId] = useState<string | null>(null)
  const [stopTarget, setStopTarget] = useState<{ streamId: string; name: string } | null>(null)
  const [walletUnits, setWalletUnits] = useState<bigint | null>(null)

  const apply = useCallback(
    (result: LoadResult) => {
      if (result === null) router.replace('/employer/setup')
      else if ('error' in result) setLoadError(result.error)
      else setData(result)
    },
    [router],
  )

  useEffect(() => {
    applyMockScenario(devState)
    let alive = true
    loadDashboard().then((result) => {
      if (alive) apply(result)
    })
    return () => {
      alive = false
    }
  }, [devState, apply])

  async function retry() {
    setLoadError(null)
    apply(await loadDashboard())
  }

  /** Setelah transaksi: muat ulang aliran gaji. Saldo ikut dimuat ulang lewat effect di bawah. */
  async function refreshFunding() {
    try {
      const streams = await listStreams()
      setData((d) => (d ? { ...d, streams, loadedAt: Date.now() } : d))
    } catch {
      // Daftar lama tetap tampil; status akan terbarui saat dashboard dimuat ulang.
    }
  }

  const funding = useStreamFunding(() => void refreshFunding())
  const walletAddress = funding.walletAddress
  // Saldo uji di akun: dimuat setiap data dashboard berubah (termasuk setelah transaksi).
  useEffect(() => {
    if (!data) return
    let alive = true
    loadWalletUnits(walletAddress).then((units) => {
      if (alive) setWalletUnits(units)
    })
    return () => {
      alive = false
    }
  }, [data, walletAddress])

  async function refreshInvites() {
    try {
      const invites = await listInvites()
      setData((d) => (d ? { ...d, invites, loadedAt: Date.now() } : d))
    } catch {
      // Daftar lama tetap tampil; pembaruan berikutnya akan mencoba lagi.
    }
  }

  if (loadError) {
    const { title, message } = apiErrorMessage(loadError, locale)
    return (
      <Shell>
        <InlineError title={title} message={message} action={{ label: t.retry, onClick: retry }} />
      </Shell>
    )
  }

  if (!data) return <DashboardSkeleton />

  const { employer, workers, invites, streams, loadedAt } = data
  const nowSeconds = Math.floor(loadedAt / 1000)
  const funds = summarizeFunds(workers, streams, nowSeconds)
  const monthlyUsd = workers.reduce((sum, w) => sum + w.monthlySalaryUsd, 0)
  const openFund = (workerId: string | null) => {
    setFundWorkerId(workerId)
    setFundOpen(true)
  }
  const pendingCount = invites.filter((i) => i.status === 'PENDING').length
  const isEmpty = workers.length === 0 && invites.length === 0
  const openInvite = () => setInviteOpen(true)

  return (
    <Shell
      companyName={employer.name}
      headerAction={
        // Di HP tombol ini sudah ada sebagai tombol sticky di bawah, jadi hanya tampil di >= 768px.
        // Dibungkus div karena `hidden` langsung di Button kalah oleh `inline-flex` bawaannya.
        !isEmpty && (
          <div className="hidden md:block">
            <Button onClick={openInvite}>
              <PlusIcon />
              {t.inviteWorker}
            </Button>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-6">
        {funds.level === 'critical' && (
          <div className="enter enter-4">
            <InlineError
              title={t.criticalTitle(funds.days ?? 0)}
              message={t.criticalMessage}
              action={{ label: t.fundAction, onClick: () => openFund(null) }}
            />
          </div>
        )}
        {funds.level === 'ended' && (
          <div className="enter enter-1">
            <InlineError
              title={t.endedTitle}
              message={t.endedMessage(funds.unfundedWorkers)}
              action={{ label: t.fundAction, onClick: () => openFund(null) }}
            />
          </div>
        )}

        <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <FundsCard
            lockedUnits={funds.lockedUnits}
            level={funds.level}
            days={funds.days}
            walletUnits={walletUnits}
            onFund={() => openFund(null)}
            className="enter enter-2 col-span-2 md:col-span-1"
          />
          <StatCard
            className="enter enter-3"
            label={t.activeWorkers}
            value={String(workers.length)}
          />
          <StatCard
            className="enter enter-3"
            label={t.monthlyPayroll}
            value={formatUsd(monthlyUsd, locale)}
          />
        </section>

        <div className="enter enter-4">
          {isEmpty ? (
            <EmptyState onInvite={openInvite} />
          ) : (
            <Tabs
              tab={tab}
              onChange={setTab}
              pendingCount={pendingCount}
              workers={
                <WorkerList
                  workers={workers}
                  streams={streams}
                  nowSeconds={nowSeconds}
                  onFund={openFund}
                  onStop={setStopTarget}
                />
              }
              invites={<InviteList invites={invites} now={loadedAt} onRevoke={setRevokeTarget} />}
            />
          )}
        </div>
      </div>

      {!isEmpty && (
        <div className="enter enter-5 fixed inset-x-0 bottom-0 z-10 border-t border-muted/20 bg-bg px-4 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))] md:hidden">
          <Button block onClick={openInvite} className="mx-auto max-w-[480px]">
            <PlusIcon />
            {t.inviteWorker}
          </Button>
        </div>
      )}

      <FundSheet
        key={fundWorkerId ?? 'any'}
        open={fundOpen}
        onClose={() => setFundOpen(false)}
        workers={workers}
        streams={streams}
        initialWorkerId={fundWorkerId}
        nowSeconds={nowSeconds}
        funding={funding}
      />
      <StopStreamSheet target={stopTarget} onClose={() => setStopTarget(null)} funding={funding} />
      <InviteWorkerSheet
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        companyName={employer.name}
        onCreated={() => {
          setTab('invites')
          void refreshInvites()
        }}
      />
      <RevokeInviteSheet
        invite={revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onRevoked={() => {
          setRevokeTarget(null)
          void refreshInvites()
        }}
      />
    </Shell>
  )
}

function Shell({
  companyName,
  headerAction,
  children,
}: {
  companyName?: string
  headerAction?: ReactNode
  children: ReactNode
}) {
  const t = useEmployerCopy().copy.dashboard
  return (
    <div className="min-h-dvh pb-[calc(96px+env(safe-area-inset-bottom))] md:pb-10">
      <DashboardHeader
        name={companyName}
        nameLabel={t.companyLabel}
        action={companyName && headerAction}
        end={companyName && <SignOutButton />}
      />
      <main className="mx-auto max-w-[1120px] px-4 pt-2">
        <h1 className="sr-only">{t.heading}</h1>
        {children}
      </main>
    </div>
  )
}

function StatCard({
  label,
  value,
  className = '',
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div
      className={`flex flex-col justify-between gap-1 rounded-xl bg-brand-fill p-4 text-on-brand ${className}`}
    >
      <p className="text-label">{label}</p>
      <p className="font-display text-[28px]/9">{value}</p>
    </div>
  )
}

function Tabs({
  tab,
  onChange,
  pendingCount,
  workers,
  invites,
}: {
  tab: Tab
  onChange: (tab: Tab) => void
  pendingCount: number
  workers: ReactNode
  invites: ReactNode
}) {
  const t = useEmployerCopy().copy.dashboard
  const refs = useRef<Record<Tab, HTMLButtonElement | null>>({ workers: null, invites: null })
  const order: Tab[] = ['workers', 'invites']

  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const next =
      order[(order.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : -1) + order.length) % order.length]!
    onChange(next)
    refs.current[next]?.focus()
  }

  const tabClass = (active: boolean) =>
    [
      'inline-flex min-h-11 items-center gap-2 rounded-xl px-4 font-bold',
      active ? 'bg-brand-text text-on-brand' : 'text-brand-text',
    ].join(' ')

  return (
    <section>
      <div
        role="tablist"
        aria-label={t.tabsLabel}
        className="mb-3 flex gap-2"
        onKeyDown={onKeyDown}
      >
        <button
          ref={(el) => {
            refs.current.workers = el
          }}
          type="button"
          role="tab"
          id="tab-workers"
          aria-selected={tab === 'workers'}
          aria-controls="panel-workers"
          tabIndex={tab === 'workers' ? 0 : -1}
          onClick={() => onChange('workers')}
          className={tabClass(tab === 'workers')}
        >
          {t.tabWorkers}
        </button>
        <button
          ref={(el) => {
            refs.current.invites = el
          }}
          type="button"
          role="tab"
          id="tab-invites"
          aria-selected={tab === 'invites'}
          aria-controls="panel-invites"
          tabIndex={tab === 'invites' ? 0 : -1}
          onClick={() => onChange('invites')}
          className={tabClass(tab === 'invites')}
        >
          {t.tabInvites}
          {pendingCount > 0 && (
            <span
              className={`grid min-w-6 place-items-center rounded-full px-1.5 text-label ${
                tab === 'invites' ? 'bg-on-brand text-brand-text' : 'bg-brand-text text-on-brand'
              }`}
            >
              {pendingCount}
              <span className="sr-only"> {t.pendingSuffix}</span>
            </span>
          )}
        </button>
      </div>
      <div
        role="tabpanel"
        id="panel-workers"
        aria-labelledby="tab-workers"
        hidden={tab !== 'workers'}
      >
        {workers}
      </div>
      <div
        role="tabpanel"
        id="panel-invites"
        aria-labelledby="tab-invites"
        hidden={tab !== 'invites'}
      >
        {invites}
      </div>
    </section>
  )
}

function EmptyState({ onInvite }: { onInvite: () => void }) {
  const t = useEmployerCopy().copy.dashboard
  return (
    <section className="flex flex-col items-center gap-3 rounded-xl border-[1.5px] border-dashed border-brand-text bg-surface px-6 py-10 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-brand-fill text-on-brand">
        <UsersIcon className="size-8" />
      </span>
      <h2 className="font-display text-section text-brand-text uppercase">{t.noWorkersTitle}</h2>
      <p className="max-w-sm text-muted">{t.noWorkersBody}</p>
      <Button onClick={onInvite} className="mt-2 w-full max-w-sm">
        <PlusIcon />
        {t.inviteFirst}
      </Button>
    </section>
  )
}

function DashboardSkeleton() {
  const t = useEmployerCopy().copy.dashboard
  return (
    <Shell>
      <div role="status" className="flex flex-col gap-6">
        <span className="sr-only">{t.loading}</span>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Skeleton className="col-span-2 h-36 md:col-span-1" />
          <Skeleton className="h-24 md:h-36" />
          <Skeleton className="h-24 md:h-36" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-11 w-24" />
          <Skeleton className="h-11 w-28" />
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </div>
    </Shell>
  )
}
