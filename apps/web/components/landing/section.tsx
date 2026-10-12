import type { ReactNode } from 'react'

type Tone = 'surface' | 'brand'

const tones: Record<Tone, string> = {
  surface: 'bg-surface text-ink',
  brand: 'bg-brand-fill text-on-brand',
}

/** Blok landing bersudut membulat besar, supaya terasa ringan dan playful. */
export function Section({
  id,
  tone = 'surface',
  labelledBy,
  className = '',
  children,
}: {
  id?: string
  tone?: Tone
  labelledBy: string
  className?: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={`relative isolate scroll-mt-20 overflow-hidden rounded-[28px] px-5 py-10 md:rounded-[40px] md:px-12 md:py-16 ${tones[tone]} ${className}`}
    >
      {children}
    </section>
  )
}

/** Judul section: Anton, maksimal 2-3 kata (DESIGN.md 3.2). */
export function SectionTitle({
  id,
  tone = 'surface',
  children,
}: {
  id: string
  tone?: Tone
  children: ReactNode
}) {
  return (
    <h2
      id={id}
      data-reveal
      className={`font-display text-[34px]/[38px] uppercase md:text-[48px]/[52px] ${
        tone === 'surface' ? 'text-brand-text' : ''
      }`}
    >
      {children}
    </h2>
  )
}
