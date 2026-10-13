import type { Locale } from '@/lib/i18n/config'

/** Ribuan dan desimal mengikuti bahasa: `1.234,5` (id) atau `1,234.5` (en). */
export function formatToken(amount: bigint, decimals: number, locale: Locale = 'id') {
  if (amount < BigInt(0) || !Number.isInteger(decimals) || decimals < 0 || decimals > 36)
    throw new RangeError('Invalid token amount')
  const [group, point] = locale === 'en' ? [',', '.'] : ['.', ',']
  const scale = BigInt(10) ** BigInt(decimals)
  const whole = (amount / scale).toString().replace(/\B(?=(\d{3})+(?!\d))/g, group)
  const fraction = (amount % scale).toString().padStart(decimals, '0').replace(/0+$/, '')
  return fraction ? `${whole}${point}${fraction}` : whole
}
