import { Avatar } from '@/components/ui/avatar'
import { buttonClass } from '@/components/ui/button'
import { StatusBadge, badgeIcons, type BadgeTone } from '@/components/ui/status-badge'
import type { CompanyStream, Worker } from '@/lib/api'
import {
  streamedToWorker,
  unitsToUsd,
  workerPayState,
  type WorkerPayState,
} from '@/lib/company-streams'
import { formatDateShort, formatUsd } from '@/lib/format'
import { useEmployerCopy } from './use-employer-copy'

export interface WorkerActions {
  onFund: (workerId: string) => void
  onStop: (target: { streamId: string; name: string }) => void
}

/**
 * Daftar pekerja dengan status gaji dari indexer (DESIGN.md 6.6): kartu di HP, tabel di
 * layar >= 768px. Tiap pekerja bisa didanai; aliran yang sedang berjalan bisa dihentikan.
 */
export function WorkerList({
  workers,
  streams,
  nowSeconds,
  onFund,
  onStop,
}: {
  workers: Worker[]
  streams: CompanyStream[]
  nowSeconds: number
} & WorkerActions) {
  const { copy, locale } = useEmployerCopy()
  const t = copy.dashboard
  if (workers.length === 0) {
    return (
      <p className="rounded-xl border-[1.5px] border-dashed border-brand-text bg-surface p-4 text-muted">
        {t.noWorkersYet}
      </p>
    )
  }

  const rows = workers.map((w) => ({
    worker: w,
    pay: workerPayState(w, streams, nowSeconds),
    streamed: unitsToUsd(streamedToWorker(w, streams, nowSeconds)),
  }))

  const actions = (w: Worker, pay: WorkerPayState) => (
    <>
      <button type="button" className={buttonClass('text')} onClick={() => onFund(w.id)}>
        {t.fundWorker}
        <span className="sr-only"> {w.displayName}</span>
      </button>
      {pay.kind === 'active' && (
        <button
          type="button"
          className={buttonClass('text')}
          onClick={() => onStop({ streamId: pay.streamId, name: w.displayName })}
        >
          {t.stopWorker}
          <span className="sr-only"> {w.displayName}</span>
        </button>
      )}
    </>
  )

  return (
    <>
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map(({ worker: w, pay, streamed }) => (
          <li key={w.id} className="rounded-xl border-[1.5px] border-brand-text bg-surface p-3">
            <div className="flex items-center gap-3">
              <Avatar name={w.displayName} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-title text-brand-text">{w.displayName}</span>
                <span className="block truncate text-label text-muted">
                  {streamed > 0
                    ? t.workerSince(
                        formatDateShort(w.joinedAt, locale),
                        formatUsd(streamed, locale),
                      )
                    : t.workerSinceOnly(formatDateShort(w.joinedAt, locale))}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-bold text-ink">
                  {formatUsd(w.monthlySalaryUsd, locale)}
                </span>
                <span className="block text-label text-muted">{t.perMonth}</span>
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <PayBadge pay={pay} />
              <div className="-mr-2 flex">{actions(w, pay)}</div>
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-hidden rounded-xl border-[1.5px] border-brand-text bg-surface md:block">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-muted/30 text-label text-muted">
              <th scope="col" className="px-4 py-3 font-medium">
                {t.colName}
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                {t.colSalary}
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                {t.colStatus}
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                {t.colStreamed}
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                <span className="sr-only">{t.colActions}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ worker: w, pay, streamed }) => (
              <tr key={w.id} className="border-b border-muted/20 last:border-0">
                <td className="px-4 py-3">
                  <span className="flex items-center gap-3">
                    <Avatar name={w.displayName} size={32} />
                    <span className="font-semibold text-brand-text">{w.displayName}</span>
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-bold tabular-nums">
                  {formatUsd(w.monthlySalaryUsd, locale)}
                </td>
                <td className="px-4 py-3">
                  <PayBadge pay={pay} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{formatUsd(streamed, locale)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="-mr-3 flex justify-end">{actions(w, pay)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function PayBadge({ pay }: { pay: WorkerPayState }) {
  const { copy, locale } = useEmployerCopy()
  const t = copy.dashboard
  const date = (iso: string) => formatDateShort(iso, locale)
  const badge: { tone: BadgeTone; icon: keyof typeof badgeIcons; label: string } =
    pay.kind === 'active'
      ? {
          tone: 'success',
          icon: 'success',
          label: t.payActive(date(pay.scheduledUntil ?? pay.endsAt)),
        }
      : pay.kind === 'scheduled'
        ? { tone: 'neutral', icon: 'clock', label: t.payScheduled(date(pay.startsAt)) }
        : pay.kind === 'ended'
          ? { tone: 'danger', icon: 'cancel', label: t.payEnded(date(pay.endedAt)) }
          : { tone: 'warn', icon: 'clock', label: t.payUnfunded }
  return (
    <StatusBadge tone={badge.tone} icon={badgeIcons[badge.icon]}>
      {badge.label}
    </StatusBadge>
  )
}
