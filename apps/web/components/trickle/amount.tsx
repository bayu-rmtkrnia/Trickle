import { cn } from 'cn'
import { formatIdr, formatUsd } from '@/lib/format'

export interface AmountProps {
  usd: number
  /** Optional estimate supplied by the caller. Amount never fetches/converts currency. */
  idr?: number
  className?: string
}

export function Amount({ usd, idr, className }: AmountProps) {
  return (
    <div className={cn('flex flex-col gap-1 tabular-nums', className)}>
      <span className="text-2xl font-semibold tracking-tight">{formatUsd(usd)}</span>
      {idr !== undefined && (
        <span className="text-sm text-muted-foreground">≈ {formatIdr(idr)}</span>
      )}
    </div>
  )
}
