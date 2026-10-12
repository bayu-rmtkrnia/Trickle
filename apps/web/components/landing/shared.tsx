import Image from 'next/image'
import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { ButtonLink, type ButtonVariant } from '@/components/ui/button'
import { ChevronDownIcon } from '@/components/ui/icons'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { Logo } from '@/components/ui/logo'
import { ProgressiveBlur } from '@/components/ui/progressive-blur'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { WAVE_SRC } from '@/lib/brand'
import type { LandingCopy } from '@/lib/copy/landing'
import heroMotion from './hero-motion.module.css'
import { LandingMotion } from './landing-motion'
import { SIDE_PARAM, WORKER_PARAM_VALUE, type Side } from '@/lib/side'
import { Section, SectionTitle } from './section'

export type { Side }

/**
 * Rute tiap sisi landing, dan ke mana "Masuk" mengarah dari sisi itu. Landing pekerja
 * lewat `?sisi=pekerja` supaya tidak ditanya lagi di layar pilihan.
 */
export const SIDE_HREF: Record<Side, string> = {
  worker: `/?${SIDE_PARAM}=${WORKER_PARAM_VALUE}`,
  company: '/perusahaan',
}
export const SIGN_IN_HREF: Record<Side, string> = { worker: '/w', company: '/employer' }

/**
 * Mask kiri ke kanan: opacity 0 di kiri, 1 di kanan. Penuh di 85% karena gambar menjorok
 * ±15% keluar kartu di sisi kanan, jadi tepat di tepi kanan kartu opacity-nya 1.
 */
const WAVE_FADE: CSSProperties = {
  maskImage: 'linear-gradient(to right, transparent, black 85%)',
  WebkitMaskImage: 'linear-gradient(to right, transparent, black 85%)',
}

/** Kerangka landing: header, tab sisi, isi, footer, dan animasi. Mobile-first. */
export function LandingShell({
  t,
  side,
  children,
}: {
  t: LandingCopy
  side: Side
  children: ReactNode
}) {
  return (
    <div id="landing-root" className="selection:bg-brand-fill selection:text-on-brand">
      <Header t={t} side={side} />
      <main className="mx-auto flex w-full max-w-[1120px] flex-col gap-3 px-3 pb-4 md:gap-4 md:px-6">
        {children}
      </main>
      <Footer t={t} side={side} />
      <LandingMotion />
    </div>
  )
}

function Header({ t, side }: { t: LandingCopy; side: Side }) {
  return (
    <header className="sticky top-0 z-20 pt-[env(safe-area-inset-top)]">
      {/* Blur sedikit melewati tepi bawah header supaya transisinya halus, bukan garis. */}
      <ProgressiveBlur className="-bottom-6" />
      <div className="relative mx-auto flex min-h-16 max-w-[1120px] items-center justify-between gap-3 px-4 md:px-6">
        <Link href="/" className="rounded-lg">
          <Logo height={22} priority />
        </Link>
        <div className="flex items-center gap-1.5">
          <LanguageSwitcher />
          <ThemeToggle />
          <ButtonLink href={SIGN_IN_HREF[side]} variant="secondary" className="min-h-11 px-4">
            {t.nav.signIn}
          </ButtonLink>
        </div>
      </div>
    </header>
  )
}

export interface HeroAction {
  href: string
  label: string
  variant: ButtonVariant
}

/** Hero ungu: teks dan aksi di kiri, bukti visual (kartu) di kanan/bawah. */
export function Hero({
  title,
  subtitle,
  body,
  actions,
  hint,
  visual,
}: {
  title: string
  subtitle: string
  body: string
  actions: HeroAction[]
  hint?: string
  visual: ReactNode
}) {
  const order = (i: number) => ({ '--hero-i': i }) as CSSProperties
  return (
    <Section
      tone="brand"
      labelledBy="hero-title"
      className="pt-9 pb-5 md:grid md:grid-cols-[1.1fr_1fr] md:items-center md:gap-12 md:py-14"
    >
      <Image
        src={WAVE_SRC}
        alt=""
        width={382}
        height={199}
        unoptimized
        priority
        // Ombak memudar dari kiri (tak terlihat) ke kanan (penuh), supaya tidak menabrak teks di kiri.
        style={WAVE_FADE}
        className="pointer-events-none absolute right-[-20%] bottom-0 -z-10 h-auto w-[120%] max-w-none select-none md:right-[-10%] md:w-[70%]"
      />
      <div>
        <h1
          id="hero-title"
          style={order(0)}
          className={`${heroMotion.item} font-display text-[clamp(52px,16vw,92px)] leading-[0.92] uppercase`}
        >
          {title}
        </h1>
        <p style={order(1)} className={`${heroMotion.item} mt-3 text-xl/7 font-bold md:text-2xl/8`}>
          {subtitle}
        </p>
        <p style={order(2)} className={`${heroMotion.item} mt-3 max-w-md`}>
          {body}
        </p>
        <div style={order(3)} className={`${heroMotion.item} mt-7`}>
          <div className="flex flex-col gap-3 sm:flex-row">
            {actions.map((action) => (
              <ButtonLink
                key={action.href}
                href={action.href}
                variant={action.variant}
                block
                className="sm:w-auto"
              >
                {action.label}
              </ButtonLink>
            ))}
          </div>
          {hint && <p className="mt-3 text-label">{hint}</p>}
        </div>
      </div>
      <div style={order(4)} className={`${heroMotion.item} ${heroMotion.card} mt-9 md:mt-0`}>
        {visual}
      </div>
    </Section>
  )
}

/** Daftar berbaris (judul di kiri, isi di kanan pada layar lebar). Dipakai untuk manfaat. */
export function RowList({
  id,
  title,
  rows,
}: {
  id: string
  title: string
  rows: { title: string; body: string }[]
}) {
  return (
    <Section labelledBy={id}>
      <SectionTitle id={id}>{title}</SectionTitle>
      <div className="mt-6">
        {rows.map((row) => (
          <div
            key={row.title}
            data-reveal
            className="grid gap-x-10 gap-y-1.5 border-t border-muted/30 py-5 md:grid-cols-[0.9fr_1.6fr]"
          >
            <h3 className="text-title text-brand-text">{row.title}</h3>
            <p className="text-muted">{row.body}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

/** Alur langkah dengan garis ombak yang tergambar saat discroll (landing-motion.tsx). */
export function HowItWorks({
  title,
  steps,
}: {
  title: string
  steps: { title: string; body: string }[]
}) {
  return (
    <Section id="cara-kerja" tone="brand" labelledBy="how-title">
      <SectionTitle id="how-title" tone="brand">
        {title}
      </SectionTitle>
      <ol data-flow className="relative mt-8 flex max-w-2xl flex-col gap-9 pl-14">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 300"
          preserveAspectRatio="none"
          className="absolute top-5 bottom-5 left-2 h-[calc(100%-2.5rem)] w-6"
        >
          <path
            data-flow-line
            d="M12 0C22 25 2 50 12 75s10 50 0 75-10 50 0 75 10 50 0 75"
            pathLength={1}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.55}
            strokeWidth={3}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {steps.map((step, i) => (
          <li key={step.title} className="relative">
            <span
              aria-hidden="true"
              data-flow-node
              className="absolute top-0 -left-14 grid size-10 place-items-center rounded-full bg-surface font-display text-lg text-brand-text"
            >
              {i + 1}
            </span>
            <h3 className="pt-1.5 text-xl/7 font-bold">{step.title}</h3>
            <p className="mt-1.5">{step.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  )
}

export function Faq({ title, items }: { title: string; items: { q: string; a: string }[] }) {
  return (
    <Section labelledBy="faq-title">
      <SectionTitle id="faq-title">{title}</SectionTitle>
      <div className="mt-4 divide-y divide-muted/30">
        {items.map((item) => (
          <details key={item.q} data-reveal className="group">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-bold [&::-webkit-details-marker]:hidden">
              {item.q}
              <ChevronDownIcon className="shrink-0 text-brand-text transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <p className="max-w-prose pb-5 text-muted">{item.a}</p>
          </details>
        ))}
      </div>
    </Section>
  )
}

export function Closing({
  title,
  body,
  action,
  hint,
  testNote,
}: {
  title: string
  body: string
  action: { href: string; label: string }
  hint?: string
  testNote: string
}) {
  return (
    <Section tone="brand" labelledBy="closing-title" className="md:text-center">
      <SectionTitle id="closing-title" tone="brand">
        {title}
      </SectionTitle>
      <p data-reveal className="mt-3 max-w-md md:mx-auto">
        {body}
      </p>
      <div data-reveal className="mt-6 md:mx-auto md:max-w-sm">
        <ButtonLink href={action.href} variant="inverse" block>
          {action.label}
        </ButtonLink>
        {hint && <p className="mt-3 text-label">{hint}</p>}
      </div>
      <p data-reveal className="mt-5 max-w-md text-label md:mx-auto">
        {testNote}
      </p>
    </Section>
  )
}

/** Footer, dengan link ke sisi lain untuk yang salah pilih di layar pilihan. */
function Footer({ t, side }: { t: LandingCopy; side: Side }) {
  const other: Side = side === 'worker' ? 'company' : 'worker'
  return (
    <footer className="mx-auto flex w-full max-w-[1120px] flex-col items-center gap-3 px-6 pt-6 pb-[calc(24px+env(safe-area-inset-bottom))] text-center md:flex-row md:justify-between md:text-left">
      <Logo height={22} />
      <div className="flex flex-col items-center gap-1 md:items-end">
        <Link
          href={SIDE_HREF[other]}
          className="inline-flex min-h-11 items-center font-semibold text-brand-text underline underline-offset-4"
        >
          {t.footer.switchTo[other]}
        </Link>
        <p className="text-label text-muted">{t.footer.disclaimer}</p>
      </div>
    </footer>
  )
}
