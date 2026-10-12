// Format angka dan waktu sesuai DESIGN.md 8.2: Rp1.000.000, $800, ≈ Rp13 jt.
// `locale` mengikuti bahasa UI; default `id` (pemisah ribuan titik).

import { INTL_LOCALE, type Locale } from '@/lib/i18n/config'

const number = (n: number, locale: Locale, fractionDigits = 0) =>
  new Intl.NumberFormat(INTL_LOCALE[locale], {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n)

/** `$800`, `$1.800` / `$1,800`, `$26,67` / `$26.67` (desimal hanya kalau ada). */
export function formatUsd(n: number, locale: Locale = 'id') {
  const cents = Math.round(n * 100)
  return `$${number(cents / 100, locale, cents % 100 === 0 ? 0 : 2)}`
}

/** `Rp1.000.000` / `Rp1,000,000`, dibulatkan ke bawah ke rupiah penuh. */
export function formatIdr(n: number, locale: Locale = 'id') {
  return `Rp${number(Math.floor(n), locale)}`
}

const SHORT_UNITS: Record<Locale, [billion: string, million: string, thousand: string]> = {
  id: [' M', ' jt', ' rb'],
  en: ['B', 'M', 'K'],
}

/** `Rp13 jt` / `Rp13M`, `Rp13,2 jt` / `Rp13.2M`, `Rp600 rb` / `Rp600K`. */
export function formatIdrShort(n: number, locale: Locale = 'id') {
  const [billion, million, thousand] = SHORT_UNITS[locale]
  const short = (v: number, unit: string) => {
    const rounded = Math.round(v * 10) / 10
    return `Rp${number(rounded, locale, Number.isInteger(rounded) ? 0 : 1)}${unit}`
  }
  if (n >= 1_000_000_000) return short(n / 1_000_000_000, billion)
  if (n >= 1_000_000) return short(n / 1_000_000, million)
  if (n >= 1_000) return short(n / 1_000, thousand)
  return formatIdr(n, locale)
}

/** `3 Okt` / `Oct 3` */
export function formatDateShort(iso: string, locale: Locale = 'id') {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: 'numeric', month: 'short' }).format(
    new Date(iso),
  )
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Sisa hari (dibulatkan ke atas) sampai `iso`; 0 kalau sudah lewat. */
export function daysUntil(iso: string, now = Date.now()) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / DAY_MS))
}

/** Gaji bulanan dihitung per 30 hari (DESIGN.md 6.7: "= $X/hari"). */
export const dailyFromMonthly = (monthly: number) => monthly / 30
