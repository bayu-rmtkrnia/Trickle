'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { InlineError } from '@/components/ui/inline-error'
import { PersonCard } from '@/components/ui/person-card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { useAccount } from '@/lib/account'
import { workerDashboardCopy as t, workerDashboardError } from '@/lib/copy/worker-dashboard'
import { formatDateShort, formatUsd } from '@/lib/format'
import { useSession, type SessionContextValue } from '@/providers/session-provider'
import { SalaryCard } from './salary-card'
import { WorkerShell } from './worker-shell'
import { useWorkerEmployments } from './use-worker-employments'

export function WorkerDashboard() {
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
      <WorkerShell>
        <InlineError title={t.configuration} message={t.configurationBody} />
      </WorkerShell>
    )
  if (!account.ready) return <DashboardSkeleton />
  if (!account.authenticated)
    return (
      <WorkerShell>
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
      </WorkerShell>
    )
  if (session.status === 'error')
    return (
      <WorkerShell>
        <InlineError title={t.sessionError} message={t.sessionErrorBody} />
        <Button className="mt-4" onClick={recover} loading={recovering} loadingLabel={t.recovering}>
          {t.recover}
        </Button>
      </WorkerShell>
    )
  if (
    session.status !== 'ready' ||
    !session.user ||
    !account.user ||
    !account.walletAddress ||
    session.user.address.toLowerCase() !== account.walletAddress.toLowerCase()
  )
    return <DashboardSkeleton />
  return (
    <EmploymentDashboard
      key={`${account.user.id}:${account.walletAddress}:${session.user.id}`}
      session={session}
    />
  )
}

function DashboardSkeleton() {
  return (
    <WorkerShell>
      <div role="status" aria-label={t.loading} className="flex flex-col gap-4">
        <span className="text-muted">{t.loading}</span>
        <Skeleton className="h-60" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    </WorkerShell>
  )
}

function EmploymentDashboard({ session }: { session: SessionContextValue }) {
  const { page, loading, loadingMore, error, pageError, retryUntil, reload, loadMore } =
    useWorkerEmployments(session)
  return (
    <WorkerShell name={session.user?.displayName ?? t.fallbackName}>
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
        <div className="min-w-0 md:sticky md:top-6 md:w-2/5">
          <SalaryCard
            walletAddress={session.user?.address ?? null}
            employments={page?.data ?? []}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-8">
          <section aria-labelledby="worker-employer-heading" className="flex flex-col gap-4">
            <div>
              <h2 id="worker-employer-heading" className="text-section font-bold">
                {t.employerTitle}
              </h2>
              <p className="mt-1 text-label text-muted">{t.employerBody}</p>
            </div>
            {loading ? (
              <div role="status" aria-label={t.loading} className="flex flex-col gap-3">
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
              </div>
            ) : error ? (
              <>
                <InlineError {...workerDashboardError(error)} />
                <Button variant="secondary" block onClick={reload} disabled={retryUntil > 0}>
                  {t.retry}
                </Button>
              </>
            ) : page?.data.length === 0 ? (
              <div className="rounded-xl border-[1.5px] border-brand-text bg-surface p-4">
                <h3 className="font-bold">{t.emptyTitle}</h3>
                <p className="mt-2 text-label text-muted">{t.emptyBody}</p>
              </div>
            ) : (
              <>
                <ul className="flex flex-col gap-5">
                  {page?.data.map((job) => (
                    <li key={job.id} className="min-w-0">
                      <PersonCard
                        name={job.employer.name}
                        subtitle={t.employmentName(job.displayName)}
                      />
                      <dl className="my-3 flex flex-wrap gap-x-6 gap-y-2 px-1 text-label">
                        <div>
                          <dt className="text-muted">{t.salaryReference}</dt>
                          <dd className="mt-1 font-semibold">
                            {t.perMonth(formatUsd(job.monthlySalaryUsd))}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted">{t.joined}</dt>
                          <dd className="mt-1">
                            <time dateTime={job.joinedAt}>{formatDateShort(job.joinedAt)}</time>
                          </dd>
                        </div>
                      </dl>
                      <StatusBadge tone="neutral">{t.payrollUnknown}</StatusBadge>
                    </li>
                  ))}
                </ul>
                {(page?.data.length ?? 0) > 0 && (
                  <p className="text-label text-muted">{t.salaryHint}</p>
                )}
                {pageError && <InlineError {...workerDashboardError(pageError, true)} />}
                {page?.nextCursor && (
                  <Button
                    variant="secondary"
                    block
                    onClick={loadMore}
                    loading={loadingMore}
                    loadingLabel={t.loadingMore}
                    disabled={retryUntil > 0}
                  >
                    {t.more}
                  </Button>
                )}
              </>
            )}
          </section>
          <section aria-labelledby="worker-family-heading" className="flex flex-col gap-3">
            <h2 id="worker-family-heading" className="text-section font-bold">
              {t.familyTitle}
            </h2>
            <div className="rounded-xl border border-dashed border-muted p-5">
              <p className="font-semibold">{t.familyUnavailable}</p>
              <p className="mt-2 text-label text-muted">{t.familyBody}</p>
            </div>
          </section>
        </div>
      </div>
    </WorkerShell>
  )
}
