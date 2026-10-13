import { Avatar } from '@/components/ui/avatar'
import { StatusBadge, badgeIcons } from '@/components/ui/status-badge'
import type { LandingCopy } from '@/lib/copy/landing'
import { formatUsd } from '@/lib/format'
import type { Locale } from '@/lib/i18n/config'

/** Data contoh untuk cuplikan dashboard; jelas diberi label "Contoh". */
const WORKERS = [
  { name: 'Siti Aminah', salaryUsd: 800 },
  { name: 'Dewi Lestari', salaryUsd: 850 },
  { name: 'Agus Pratama', salaryUsd: 750 },
]
const PENDING_INVITE = 'Budi Santoso'

/** Bukti visual di hero perusahaan: cuplikan dashboard dengan data contoh. */
export function CompanyPreview({
  p,
  locale,
}: {
  p: LandingCopy['company']['hero']['preview']
  locale: Locale
}) {
  const total = WORKERS.reduce((sum, w) => sum + w.salaryUsd, 0)
  return (
    <div className="rounded-2xl bg-surface p-5 text-ink md:p-6">
      <span className="sr-only">{p.srSummary}</span>
      <div aria-hidden="true">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-label text-muted">{p.company}</p>
          <span className="shrink-0 rounded-full border border-muted px-2.5 py-0.5 text-label text-muted">
            {p.example}
          </span>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <dt className="text-label text-muted">{p.activeWorkers}</dt>
            <dd className="font-display text-[32px]/9 text-brand-text">{WORKERS.length}</dd>
          </div>
          <div>
            <dt className="text-label text-muted">{p.monthlyPayroll}</dt>
            <dd className="font-display text-[32px]/9 text-brand-text">
              {formatUsd(total, locale)}
            </dd>
          </div>
        </dl>

        <ul className="mt-4 divide-y divide-dashed divide-muted/40 border-t border-dashed border-muted/40">
          {WORKERS.map((w) => (
            <li key={w.name} className="flex items-center gap-3 py-2.5">
              <Avatar name={w.name} size={32} />
              <span className="min-w-0 flex-1 truncate font-semibold">{w.name}</span>
              <span className="shrink-0 tabular-nums">
                <span className="font-bold">{formatUsd(w.salaryUsd, locale)}</span>
                <span className="text-label text-muted">{p.perMonth}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-2 flex items-center justify-between gap-3 border-t border-dashed border-muted/40 pt-3">
          <span className="min-w-0 truncate">
            <span className="text-label text-muted">{p.invitesTitle} · </span>
            <span className="font-semibold">{PENDING_INVITE}</span>
          </span>
          <StatusBadge tone="warn" icon={badgeIcons.clock}>
            {p.pending}
          </StatusBadge>
        </div>
      </div>
    </div>
  )
}
