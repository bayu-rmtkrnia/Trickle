import { Avatar } from '@/components/ui/avatar'
import { PersonCard } from '@/components/ui/person-card'
import type { Worker } from '@/lib/api'
import { dashboardCopy as t } from '@/lib/copy/employer'
import { formatDateShort, formatUsd } from '@/lib/format'
import { streamedSince } from '@/lib/runway'

/** List kartu di mobile, tabel di layar >= 768px (DESIGN.md 6.6). */
export function WorkerList({ workers, now }: { workers: Worker[]; now: number }) {
  if (workers.length === 0) {
    return (
      <p className="rounded-xl border-[1.5px] border-dashed border-brand-text bg-surface p-4 text-muted">
        {t.noWorkersYet}
      </p>
    )
  }

  return (
    <>
      <ul className="flex flex-col gap-3 md:hidden">
        {workers.map((w) => (
          <li key={w.id}>
            <PersonCard
              name={w.displayName}
              subtitle={t.workerSince(
                formatDateShort(w.joinedAt),
                formatUsd(streamedSince(w, now)),
              )}
              trailing={
                <span className="block">
                  <span className="block font-bold text-ink">{formatUsd(w.monthlySalaryUsd)}</span>
                  <span className="block text-label text-muted">{t.perMonth}</span>
                </span>
              }
            />
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
                {t.colJoined}
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                {t.colStreamed}
              </th>
            </tr>
          </thead>
          <tbody>
            {workers.map((w) => (
              <tr key={w.id} className="border-b border-muted/20 last:border-0">
                <td className="px-4 py-3">
                  <span className="flex items-center gap-3">
                    <Avatar name={w.displayName} size={32} />
                    <span className="font-semibold text-brand-text">{w.displayName}</span>
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-bold tabular-nums">
                  {formatUsd(w.monthlySalaryUsd)}
                </td>
                <td className="px-4 py-3 text-muted">{formatDateShort(w.joinedAt)}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatUsd(streamedSince(w, now))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
