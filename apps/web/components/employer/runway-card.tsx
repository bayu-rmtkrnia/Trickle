import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { StatusBadge, badgeIcons } from '@/components/ui/status-badge'
import { WAVE_SRC } from '@/lib/brand'
import { dashboardCopy as t } from '@/lib/copy/employer'
import { formatUsd } from '@/lib/format'
import type { RunwayLevel } from '@/lib/runway'

/**
 * Kartu dana payroll + runway (DESIGN.md 6.6, 7.3). Gaya hero: `brand-fill`
 * dengan teks `on-brand` (putih di light, near-black di dark) dan ombak di
 * kanan bawah yang tidak menutupi teks (5.1).
 */
export function RunwayCard({
  balanceUsd,
  level,
  days,
  className = '',
}: {
  balanceUsd: number
  level: RunwayLevel
  days: number | null
  className?: string
}) {
  const topUpHintId = 'topup-hint'
  return (
    <section
      aria-labelledby="fund-label"
      className={`relative isolate flex min-h-40 flex-col gap-3 overflow-hidden rounded-xl bg-brand-fill p-4 text-on-brand ${className}`}
    >
      <Image
        src={WAVE_SRC}
        alt=""
        width={382}
        height={199}
        unoptimized
        className="pointer-events-none absolute inset-y-0 -right-[20%] -z-10 h-full w-[120%] max-w-none object-cover object-right-bottom opacity-70 select-none"
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="fund-label" className="text-label">
            {t.fundLabel}
          </h2>
          <p className="mt-1 font-display text-num-hero">{formatUsd(balanceUsd)}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Button
            variant="on-brand"
            disabled
            aria-describedby={topUpHintId}
            className="min-h-11 px-4"
          >
            {t.topUp}
          </Button>
          <span id={topUpHintId} className="text-label">
            {t.comingSoon}
          </span>
        </div>
      </div>
      <div className="mt-auto">
        <RunwayStatus level={level} days={days} />
      </div>
    </section>
  )
}

function RunwayStatus({ level, days }: { level: RunwayLevel; days: number | null }) {
  switch (level) {
    case 'no-workers':
      return <p className="text-label">{t.runwayNoWorkers}</p>
    case 'healthy':
      return <p className="text-label">{t.runwayDays(days ?? 0)}</p>
    case 'low':
      return (
        <StatusBadge tone="warn" icon={badgeIcons.clock}>
          {t.runwayLowBadge(days ?? 0)}
        </StatusBadge>
      )
    case 'critical':
      return (
        <StatusBadge tone="danger" icon={badgeIcons.clock}>
          {t.runwayCriticalBadge(days ?? 0)}
        </StatusBadge>
      )
    case 'empty':
      return (
        <StatusBadge tone="danger" icon={badgeIcons.cancel}>
          {t.fundEmptyBadge}
        </StatusBadge>
      )
  }
}
