import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { StatusBadge, badgeIcons } from '@/components/ui/status-badge'
import { WAVE_SRC } from '@/lib/brand'
import { unitsToUsd, type FundsLevel } from '@/lib/company-streams'
import { formatUsd } from '@/lib/format'
import { useEmployerCopy } from './use-employer-copy'

/**
 * Kartu dana gaji (DESIGN.md 6.6, 7.3), mengikuti model kontrak: dana tidak dikumpulkan
 * di satu saldo, tapi dikunci per aliran gaji pekerja. Isinya gaji yang sudah didanai dan
 * belum mengalir, kapan aliran terdekat berakhir, saldo uji di akun, dan aksi "Danai gaji".
 */
export function FundsCard({
  lockedUnits,
  level,
  days,
  walletUnits,
  onFund,
  className = '',
}: {
  lockedUnits: bigint
  level: FundsLevel
  days: number | null
  /** Saldo mAUSD di akun perusahaan; `null` = belum terbaca. */
  walletUnits: bigint | null
  onFund: () => void
  className?: string
}) {
  const { copy, locale } = useEmployerCopy()
  const t = copy.dashboard
  return (
    <section
      aria-labelledby="fund-label"
      className={`relative isolate flex min-h-44 flex-col gap-3 overflow-hidden rounded-xl bg-brand-fill p-4 text-on-brand ${className}`}
    >
      <Image
        src={WAVE_SRC}
        alt=""
        width={382}
        height={199}
        unoptimized
        className="pointer-events-none absolute inset-y-0 -right-[20%] -z-10 h-full w-[120%] max-w-none object-cover object-right-bottom opacity-70 select-none"
      />
      <div>
        <h2 id="fund-label" className="text-label">
          {t.fundLabel}
        </h2>
        <p className="mt-1 font-display text-num-hero">
          {formatUsd(unitsToUsd(lockedUnits), locale)}
        </p>
        <p className="text-label">{t.fundHint}</p>
      </div>

      <FundsStatus level={level} days={days} />

      <div className="mt-auto flex flex-wrap items-end justify-between gap-3">
        {walletUnits !== null && (
          <p className="text-label">
            {t.walletLabel}{' '}
            <span className="font-bold">{formatUsd(unitsToUsd(walletUnits), locale)}</span>
            <span className="ml-2 inline-flex rounded-full border border-on-brand/50 px-2 text-label">
              {t.testMode}
            </span>
          </p>
        )}
        <Button
          variant="inverse"
          onClick={onFund}
          disabled={level === 'no-workers'}
          className="min-h-11 px-4"
        >
          {t.fundAction}
        </Button>
      </div>
    </section>
  )
}

function FundsStatus({ level, days }: { level: FundsLevel; days: number | null }) {
  const t = useEmployerCopy().copy.dashboard
  switch (level) {
    case 'no-workers':
      return <p className="text-label">{t.runwayNoWorkers}</p>
    case 'unfunded':
      return <p className="text-label">{t.unfundedHint}</p>
    case 'healthy':
      return days === null ? null : <p className="text-label">{t.runwayDays(days)}</p>
    case 'low':
      return (
        <div>
          <StatusBadge tone="warn" icon={badgeIcons.clock}>
            {t.runwayLowBadge(days ?? 0)}
          </StatusBadge>
        </div>
      )
    case 'critical':
      return (
        <div>
          <StatusBadge tone="danger" icon={badgeIcons.clock}>
            {t.runwayCriticalBadge(days ?? 0)}
          </StatusBadge>
        </div>
      )
    case 'ended':
      return (
        <div>
          <StatusBadge tone="danger" icon={badgeIcons.cancel}>
            {t.endedBadge}
          </StatusBadge>
        </div>
      )
  }
}
