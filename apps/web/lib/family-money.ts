// Money helpers for the family dashboard. Token amounts stay bigint; the IDR
// figure is a display estimate only (the payout amount comes from the backend).
import { parseUnits } from 'viem'
import { INTL_LOCALE, type Locale } from '@/lib/i18n/config'

const RATE_SCALE = BigInt(1_000_000)

/**
 * Estimated rupiah for `units` of a USD-pegged token, rounded down to whole
 * rupiah. The rate is scaled to 6 decimals so no floating point touches the
 * token amount.
 */
export function estimateIdr(units: bigint, decimals: number, rate: number): bigint {
  if (units < BigInt(0) || !Number.isInteger(decimals) || decimals < 0 || decimals > 36)
    throw new RangeError('Invalid token amount')
  if (!Number.isFinite(rate) || rate <= 0) throw new RangeError('Invalid rate')
  const scaled = Math.round(rate * 1_000_000)
  if (!Number.isSafeInteger(scaled) || scaled <= 0) throw new RangeError('Invalid rate')
  return (units * BigInt(scaled)) / (BigInt(10) ** BigInt(decimals) * RATE_SCALE)
}

/** `Rp1.234.567` from whole rupiah as bigint, without converting to Number. */
export function formatIdrUnits(rupiah: bigint, locale: Locale = 'id') {
  if (rupiah < BigInt(0)) throw new RangeError('Invalid rupiah amount')
  return `Rp${rupiah.toString().replace(/\B(?=(\d{3})+(?!\d))/g, locale === 'id' ? '.' : ',')}`
}

/** `16.250,5` style rate for the detail sheet. */
export function formatRate(rate: number, locale: Locale = 'id') {
  return new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits: 2 }).format(rate)
}

export type TokenAmountParse =
  { ok: true; units: bigint } | { ok: false; reason: 'empty' | 'invalid' | 'precision' | 'zero' }

/**
 * Parses a user-typed token amount ("12,5" or "12.5") into base units with
 * bigint math. Exponents, signs, thousands separators and more decimals than
 * the token supports are rejected rather than rounded.
 */
export function parseTokenAmount(raw: string, decimals: number): TokenAmountParse {
  const value = raw.trim()
  if (!value) return { ok: false, reason: 'empty' }
  const match = /^(\d+)(?:[.,](\d+))?$/.exec(value)
  if (!match) return { ok: false, reason: 'invalid' }
  const fraction = match[2] ?? ''
  if (fraction.length > decimals) return { ok: false, reason: 'precision' }
  const units = parseUnits(fraction ? `${match[1]}.${fraction}` : match[1]!, decimals)
  if (units === BigInt(0)) return { ok: false, reason: 'zero' }
  return { ok: true, units }
}
