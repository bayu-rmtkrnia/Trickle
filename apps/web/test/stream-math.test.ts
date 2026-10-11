import { describe, expect, it } from 'vitest'
import { availableAt, splitAmounts, estimateTimestamp, streamStatus } from '@/lib/chain/stream-math'
import { formatToken } from '@/lib/chain/format-token'
const b = BigInt
const stream = {
  amount: b(1000000),
  withdrawn: b(100000),
  refunded: b(0),
  start: b(100),
  end: b(200),
  canceled: false,
}
describe('Solidity-compatible stream math', () => {
  it.each([
    [99, 0],
    [100, 0],
    [150, 400000],
    [200, 900000],
    [250, 900000],
  ])('available at %i is %i', (now, value) => {
    expect(availableAt(stream, b(now))).toBe(b(value))
  })
  it('rounds elapsed vesting down exactly and clamps withdrawn amounts', () => {
    expect(availableAt({ ...stream, amount: b(10), withdrawn: b(0), end: b(103) }, b(101))).toBe(
      b(3),
    )
    expect(availableAt(stream, b(105))).toBe(b(0))
  })
  it('freezes canceled vesting at amount minus refunded regardless of time', () => {
    const canceled = { ...stream, canceled: true, refunded: b(600000) }
    expect(availableAt(canceled, b(150))).toBe(b(300000))
    expect(availableAt(canceled, b(9999))).toBe(b(300000))
  })
  it('preserves amounts beyond Number.MAX_SAFE_INTEGER', () => {
    const amount = b('100000000000000000000000000000')
    expect(availableAt({ ...stream, amount, withdrawn: b(0) }, b(150))).toBe(amount / b(2))
  })
  it.each([
    [0, 10001, 0],
    [3000, 7001, 3000],
    [10000, 0, 10001],
  ])('split %i bps rounds dust to worker', (bps, worker, family) => {
    expect(splitAmounts(b(10001), bps)).toEqual({ worker: b(worker), family: b(family) })
  })
  it('rejects invalid period, negative values and invalid split', () => {
    expect(() => availableAt({ ...stream, end: b(100) }, b(150))).toThrow()
    expect(() => availableAt({ ...stream, amount: b(-1) }, b(150))).toThrow()
    expect(() => splitAmounts(b(10), 10001)).toThrow()
    expect(() => splitAmounts(b(10), 0.5)).toThrow()
  })
  it('stops timestamp estimation at the stale threshold', () => {
    expect(estimateTimestamp(b(100), 1500)).toBe(b(101))
    expect(estimateTimestamp(b(100), 90000)).toBe(b(130))
  })
  it('distinguishes waiting, active, ended, canceled and depleted streams', () => {
    expect(streamStatus(stream, b(99))).toBe('scheduled')
    expect(streamStatus(stream, b(150))).toBe('active')
    expect(streamStatus(stream, b(201))).toBe('ended')
    expect(streamStatus({ ...stream, canceled: true, refunded: b(600000) }, b(150))).toBe(
      'canceled',
    )
    expect(streamStatus({ ...stream, withdrawn: b(1000000) }, b(201))).toBe('depleted')
  })
})
describe('integer token formatting', () => {
  it.each([
    ['1000000', '1'],
    ['1234567', '1,234567'],
    ['1', '0,000001'],
    ['0', '0'],
    ['1000000000000000000000000', '1.000.000.000.000.000.000'],
  ])('formats %s without floating point loss', (value, expected) => {
    expect(formatToken(b(value), 6)).toBe(expected)
  })
})
