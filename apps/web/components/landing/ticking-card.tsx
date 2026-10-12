'use client'

import { useEffect, useRef, useState } from 'react'
import { ESTIMATE_RATE_IDR_PER_USD, EXAMPLE_FAMILY_PCT, landingCopy } from '@/lib/copy/landing'
import { formatIdr } from '@/lib/format'
import { useLocale } from '@/lib/i18n/client'

/** Contoh: gaji $800/bulan, dimulai dari angka tetap supaya render server dan browser sama. */
const START = 1_234_567
const PER_SECOND = (800 * ESTIMATE_RATE_IDR_PER_USD) / 30 / 86_400
const TICK_MS = 250

/**
 * Bukti produk di hero: gaji yang berdetak (DESIGN.md 3.3: 4x/detik, dibulatkan
 * ke bawah, digit lebar tetap) dan pembagian otomatis ke keluarga saat ditarik.
 * Berhenti saat tidak terlihat atau tab disembunyikan, supaya hemat baterai.
 */
export function TickingCard() {
  const { locale } = useLocale()
  const t = landingCopy[locale].worker.hero
  const [amount, setAmount] = useState(START)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let timer: number | undefined
    let visible = true

    const start = () => {
      if (timer !== undefined || !visible || document.hidden) return
      timer = window.setInterval(() => setAmount((a) => a + PER_SECOND / (1000 / TICK_MS)), TICK_MS)
    }
    const stop = () => {
      window.clearInterval(timer)
      timer = undefined
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting)
      if (visible) start()
      else stop()
    })
    const onVisibility = () => (document.hidden ? stop() : start())

    observer.observe(el)
    document.addEventListener('visibilitychange', onVisibility)
    start()
    return () => {
      stop()
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const family = Math.floor((amount * EXAMPLE_FAMILY_PCT) / 100)
  const forYou = Math.floor(amount) - family

  return (
    <div ref={ref} className="rounded-2xl bg-surface p-5 text-ink md:p-6">
      <span className="sr-only">{t.cardSrSummary}</span>
      <div aria-hidden="true">
        <div className="flex items-center justify-between gap-3">
          <p className="text-label text-muted">{t.cardLabel}</p>
          <span className="rounded-full border border-muted px-2.5 py-0.5 text-label text-muted">
            {t.cardExample}
          </span>
        </div>
        <p className="mt-1 font-display text-num-hero text-brand-text">
          {[...formatIdr(amount, locale)].map((char, i) => (
            <span
              key={i}
              className={/\d/.test(char) ? 'inline-block w-[0.56em] text-center' : 'inline-block'}
            >
              {char}
            </span>
          ))}
        </p>
        <p className="mt-1 flex items-center gap-2 text-label font-semibold text-success">
          <span className="relative flex size-2.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-60" />
            <span className="relative size-2.5 rounded-full bg-success" />
          </span>
          {t.cardRate(`Rp${Math.round(PER_SECOND)}`)}
        </p>

        <div className="mt-5 border-t border-dashed border-muted/50 pt-4">
          <p className="text-label text-muted">{t.cardSplitTitle}</p>
          <dl className="mt-2 flex flex-col gap-1.5 tabular-nums">
            <div className="flex items-baseline justify-between gap-3">
              <dt>{t.cardForYou}</dt>
              <dd className="font-bold">{formatIdr(forYou, locale)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt>{t.cardForFamily(EXAMPLE_FAMILY_PCT)}</dt>
              <dd className="font-bold text-brand-text">{formatIdr(family, locale)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  )
}
