import type { ReactNode } from 'react'

export type DetailItem = {
  label: string
  value: ReactNode
  /** Span both columns. Defaults to true for long text values. */
  wide?: boolean
}

const LONG_VALUE = 18

/**
 * Label/value pairs as bordered boxes, two per row. Long values (dates,
 * hashes, references) take a full row so nothing is squeezed.
 */
export function DetailGrid({ items }: { items: readonly DetailItem[] }) {
  return (
    <dl className="grid grid-cols-2 gap-3">
      {items.map(({ label, value, wide }) => {
        const spans = wide ?? (typeof value === 'string' ? value.length > LONG_VALUE : false)
        return (
          <div
            key={label}
            className={`min-w-0 rounded-xl border border-muted/30 p-3 ${spans ? 'col-span-2' : ''}`}
          >
            <dt className="text-label text-muted">{label}</dt>
            <dd className="mt-1 break-words font-semibold tabular-nums">{value}</dd>
          </div>
        )
      })}
    </dl>
  )
}
