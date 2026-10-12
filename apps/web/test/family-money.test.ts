import { describe, expect, it } from 'vitest'
import { estimateIdr, formatIdrUnits } from '@/lib/family-money'

const b = BigInt

describe('family money helpers', () => {
  it('estimates rupiah from token base units without floating point on the amount', () => {
    // 12.5 mAUSD (6 decimals) at Rp16.250 = Rp203.125
    expect(estimateIdr(b(12_500_000), 6, 16250)).toBe(b(203_125))
  })

  it('rounds the estimate down to whole rupiah', () => {
    // 0.000001 token * 16250.75 = 0.01625075 rupiah -> 0
    expect(estimateIdr(b(1), 6, 16250.75)).toBe(b(0))
    // 1.000001 token * 16250.5 = 16250.5162... -> 16250
    expect(estimateIdr(b(1_000_001), 6, 16250.5)).toBe(b(16250))
  })

  it('keeps precision for balances far beyond Number.MAX_SAFE_INTEGER', () => {
    const units = b('123456789012345678901234') // 1.23e17 tokens at 6 decimals
    expect(estimateIdr(units, 6, 16000)).toBe(b('1975308624197530862419744') / b(1000))
  })

  it('returns zero for a verified zero balance', () => {
    expect(estimateIdr(b(0), 6, 16000)).toBe(b(0))
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid rate %s', (rate) => {
    expect(() => estimateIdr(b(1), 6, rate)).toThrow(RangeError)
  })

  it('rejects negative amounts and invalid decimals', () => {
    expect(() => estimateIdr(b(-1), 6, 16000)).toThrow(RangeError)
    expect(() => estimateIdr(b(1), 1.5, 16000)).toThrow(RangeError)
  })

  it('formats whole rupiah with Indonesian grouping from bigint', () => {
    expect(formatIdrUnits(b(0))).toBe('Rp0')
    expect(formatIdrUnits(b(203125))).toBe('Rp203.125')
    expect(formatIdrUnits(b('12345678901234567890'))).toBe('Rp12.345.678.901.234.567.890')
    expect(() => formatIdrUnits(b(-1))).toThrow(RangeError)
  })
})
