import type { Locale } from '@/lib/i18n/config'

export function formatToken(amount: bigint, decimals: number, locale: Locale = 'id') {
  if (amount < BigInt(0) || !Number.isInteger(decimals) || decimals < 0 || decimals > 36)
    throw new RangeError('Invalid token amount')
  const scale = BigInt(10) ** BigInt(decimals)
  const whole = (amount / scale)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, locale === 'id' ? '.' : ',')
  const fraction = (amount % scale).toString().padStart(decimals, '0').replace(/0+$/, '')
  return fraction ? `${whole}${locale === 'id' ? ',' : '.'}${fraction}` : whole
}
