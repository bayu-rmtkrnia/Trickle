// Format angka dan waktu sesuai DESIGN.md 8.2: Rp1.000.000, $800, ≈ Rp13 jt.

const idNumber = (n: number, fractionDigits = 0) =>
  new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n)

/** `$800`, `$1.800`, `$26,67` (desimal hanya kalau ada). */
export function formatUsd(n: number) {
  const cents = Math.round(n * 100)
  return `$${idNumber(cents / 100, cents % 100 === 0 ? 0 : 2)}`
}

/** `Rp1.000.000`, dibulatkan ke bawah ke rupiah penuh. */
export function formatIdr(n: number) {
  return `Rp${idNumber(Math.floor(n))}`
}

/** `Rp13 jt`, `Rp13,2 jt`, `Rp600 rb`. */
export function formatIdrShort(n: number) {
  const short = (v: number, unit: string) => {
    const rounded = Math.round(v * 10) / 10
    return `Rp${idNumber(rounded, Number.isInteger(rounded) ? 0 : 1)} ${unit}`
  }
  if (n >= 1_000_000_000) return short(n / 1_000_000_000, 'M')
  if (n >= 1_000_000) return short(n / 1_000_000, 'jt')
  if (n >= 1_000) return short(n / 1_000, 'rb')
  return formatIdr(n)
}

/** `3 Okt` */
export function formatDateShort(iso: string) {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(iso))
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Sisa hari (dibulatkan ke atas) sampai `iso`; 0 kalau sudah lewat. */
export function daysUntil(iso: string, now = Date.now()) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / DAY_MS))
}

/** Gaji bulanan dihitung per 30 hari (DESIGN.md 6.7: "= $X/hari"). */
export const dailyFromMonthly = (monthly: number) => monthly / 30
