'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { PlusIcon, UsersIcon } from '@/components/ui/icons'
import { InlineError } from '@/components/ui/inline-error'
import { Logo } from '@/components/ui/logo'
import { Skeleton } from '@/components/ui/skeleton'
import {
  applyMockScenario,
  getEmployer,
  getPayrollFund,
  listInvites,
  listWorkers,
  type Employer,
  type Invite,
  type PayrollFund,
  type Worker,
} from '@/lib/api'
import { dashboardCopy as t } from '@/lib/copy/employer'
import type { EmployerState } from '@/lib/dev-state'
import { formatUsd } from '@/lib/format'
import { computeRunway } from '@/lib/runway'
import { InviteList } from './invite-list'
import { InviteWorkerSheet } from './invite-worker-sheet'
import { RevokeInviteSheet } from './revoke-invite-sheet'
import { RunwayCard } from './runway-card'
import { WorkerList } from './worker-list'

type Data = {
  employer: Employer
  workers: Worker[]
  invites: Invite[]
  fund: PayrollFund
  loadedAt: number
}
type Tab = 'workers' | 'invites'

/** `null` = belum punya profil perusahaan. */
async function loadDashboard(): Promise<Data | null | 'failed'> {
  try {
    const employer = await getEmployer()
    if (!employer) return null
    const [workers, invites, fund] = await Promise.all([
      listWorkers(),
      listInvites(),
      getPayrollFund(),
    ])
    return { employer, workers, invites, fund, loadedAt: Date.now() }
  } catch {
    return 'failed'
  }
}

/** Dashboard employer, mobile-first (DESIGN.md 6.6, 7.3). */
export function EmployerDashboard({ devState }: { devState?: EmployerState }) {
  const router = useRouter()
  const [data, setData] = useState<Data | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [tab, setTab] = useState<Tab>(devState === 'ada-undangan' ? 'invites' : 'workers')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<Invite | null>(null)

  const apply = useCallback(
    (result: Data | null | 'failed') => {
      if (result === 'failed') setLoadFailed(true)
      else if (result === null) router.replace('/employer/setup')
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
    setLoadFailed(false)
    apply(await loadDashboard())
  }

  async function refreshInvites() {
    try {
      const invites = await listInvites()
      setData((d) => (d ? { ...d, invites, loadedAt: Date.now() } : d))
    } catch {
      // Daftar lama tetap tampil; pembaruan berikutnya akan mencoba lagi.
    }
  }

  if (loadFailed) {
    return (
      <Shell>
        <InlineError
          title={t.loadFailedTitle}
          message={t.loadFailedMessage}
          action={{ label: t.retry, onClick: retry }}
        />
      </Shell>
    )
  }

  if (!data) return <DashboardSkeleton />

  const { employer, workers, invites, fund, loadedAt } = data
  const runway = computeRunway(fund.balanceUsd, workers)
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
        {runway.level === 'critical' && (
          <div className="enter enter-4">
            <InlineError title={t.criticalTitle(runway.days ?? 0)} message={t.criticalMessage} />
          </div>
        )}
        {runway.level === 'empty' && (
          <div className="enter enter-1">
            <InlineError title={t.fundEmptyTitle} message={t.fundEmptyMessage(workers.length)} />
          </div>
        )}

        <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <RunwayCard
            balanceUsd={fund.balanceUsd}
            level={runway.level}
            days={runway.days}
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
            value={formatUsd(runway.monthlyUsd)}
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
              workers={<WorkerList workers={workers} now={loadedAt} />}
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
  return (
    <div className="min-h-dvh pb-[calc(96px+env(safe-area-inset-bottom))] md:pb-10">
      <header className="sticky top-0 z-10 bg-bg pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex min-h-16 max-w-[1120px] items-center gap-3 px-4">
          <Logo height={24} priority />
          {companyName && (
            <p className="min-w-0 flex-1 truncate text-label text-muted">
              <span className="sr-only">Perusahaan: </span>
              {companyName}
            </p>
          )}
          <div className="ml-auto flex items-center gap-3">
            {headerAction}
            {companyName && <Avatar name={companyName} />}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1120px] px-4 pt-2">
        <h1 className="sr-only">Dashboard perusahaan</h1>
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
              <span className="sr-only"> menunggu</span>
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
