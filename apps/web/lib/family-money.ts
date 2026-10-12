// Money helpers for the family dashboard. Token amounts stay bigint; the IDR
// figure is a display estimate only (the payout amount comes from the backend).

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
export function formatIdrUnits(rupiah: bigint) {
  if (rupiah < BigInt(0)) throw new RangeError('Invalid rupiah amount')
  return `Rp${rupiah.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
}

/** `16.250,5` style rate for the detail sheet. */
export function formatRate(rate: number) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(rate)
}
