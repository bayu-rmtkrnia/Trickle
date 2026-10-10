import type { ReactNode } from 'react'
import { CheckCircleIcon, ClockIcon, XCircleIcon } from './icons'

export type BadgeTone = 'success' | 'warn' | 'danger' | 'neutral' | 'brand'

// `warn-fill` di atas `bg` light cuma 1,86:1, jadi badge kuning selalu pakai
// border + teks + ikon (DESIGN.md 2.2). Di dark, `warn-ink` menyatu dengan bg.
const tones: Record<BadgeTone, string> = {
  success: 'border-success text-success bg-surface',
  warn: 'border-warn-ink bg-warn-fill text-warn-ink',
  danger: 'border-danger text-danger bg-surface',
  neutral: 'border-muted text-muted bg-surface',
  brand: 'border-transparent bg-brand-fill text-on-brand',
}

export function StatusBadge({
  tone,
  icon,
  children,
}: {
  tone: BadgeTone
  icon?: ReactNode
  children: ReactNode
}) {
  return (
    <span
      className={`inline-flex min-h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 text-label ${tones[tone]}`}
    >
      {icon}
      {children}
    </span>
  )
}

const iconClass = 'size-4'

export const badgeIcons = {
  success: <CheckCircleIcon className={iconClass} />,
  clock: <ClockIcon className={iconClass} />,
  cancel: <XCircleIcon className={iconClass} />,
  approx: (
    <span aria-hidden="true" className="font-bold">
      ≈
    </span>
  ),
}
