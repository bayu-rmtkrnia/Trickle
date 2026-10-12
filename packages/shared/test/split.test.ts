import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  MAX_RECIPIENTS,
  bpsToPercent,
  percentToBps,
  previewSplit,
  validateSplits,
  type Split,
} from '../split.ts'

const siti = '0x13ac0fdb45BAfE9FF830AE900F9cb921dD4de677'
const budi = '0x4DC4510A24df661AE3Dde4587d29034c3A8aC3F9'
const ani = '0x00000000000000000000000000000000000000a1'
const dedi = '0x00000000000000000000000000000000000000b2'
const split = (recipient: `0x${string}`, bps: number): Split => ({ recipient, bps })

describe('validateSplits', () => {
  it('accepts an empty list (split off) and up to 3 recipients totalling 100%', () => {
    assert.equal(validateSplits([]), null)
    assert.equal(validateSplits([split(siti, 5_000), split(budi, 4_000), split(ani, 1_000)]), null)
    assert.equal(MAX_RECIPIENTS, 3)
  })

  it('rejects more than 3 recipients (TooManyRecipients)', () => {
    const four = [split(siti, 1), split(budi, 1), split(ani, 1), split(dedi, 1)]
    assert.deepEqual(validateSplits(four), { code: 'TOO_MANY_RECIPIENTS' })
  })

  it('rejects the zero address and malformed addresses', () => {
    const zero = '0x0000000000000000000000000000000000000000'
    assert.deepEqual(validateSplits([split(siti, 100), split(zero, 100)]), {
      code: 'ZERO_ADDRESS',
      index: 1,
    })
    assert.deepEqual(validateSplits([split('0x1234', 100)]), { code: 'INVALID_ADDRESS', index: 0 })
  })

  it('rejects zero, fractional and out-of-range bps', () => {
    for (const bps of [0, -1, 12.5, 10_001]) {
      assert.deepEqual(validateSplits([split(siti, bps)]), { code: 'INVALID_BPS', index: 0 })
    }
  })

  it('rejects duplicates regardless of address case (DuplicateRecipient)', () => {
    const lower = siti.toLowerCase() as `0x${string}`
    assert.deepEqual(validateSplits([split(siti, 100), split(budi, 100), split(lower, 100)]), {
      code: 'DUPLICATE_RECIPIENT',
      index: 2,
    })
  })

  it('rejects a total over 100%', () => {
    assert.deepEqual(validateSplits([split(siti, 5_000), split(budi, 4_000), split(ani, 1_001)]), {
      code: 'TOTAL_OVER_100',
      totalBps: 10_001,
    })
  })
})

describe('previewSplit matches the contract', () => {
  it('3 recipients, 20% + 10% + 5% of 3,000 (test_withdraw_appliesThreeSplits)', () => {
    const p = previewSplit(3_000_000_000n, [
      split(siti, 2_000),
      split(budi, 1_000),
      split(ani, 500),
    ])
    assert.deepEqual(
      p.shares.map((s) => s.amount),
      [600_000_000n, 300_000_000n, 150_000_000n],
    )
    assert.equal(p.toRecipients, 1_050_000_000n)
    assert.equal(p.toWorker, 1_950_000_000n)
  })

  it('testnet smoke run: 100 mAUSD, 20% + 10% paid 70 / 20 / 10', () => {
    const p = previewSplit(100_000_000n, [split(siti, 2_000), split(budi, 1_000)])
    assert.deepEqual(
      [p.toWorker, ...p.shares.map((s) => s.amount)],
      [70_000_000n, 20_000_000n, 10_000_000n],
    )
  })

  it('rounds each share down and gives the dust to the worker', () => {
    assert.equal(previewSplit(3n, [split(siti, 5_000)]).toWorker, 2n) // test_withdraw_splitRoundsInWorkersFavor
    const p = previewSplit(10n, [split(siti, 5_000), split(budi, 500), split(ani, 500)]) // test_withdraw_skipsZeroShares
    assert.deepEqual(
      p.shares.map((s) => s.amount),
      [5n, 0n, 0n],
    )
    assert.equal(p.toWorker, 5n)
  })

  it('no split sends everything to the worker', () => {
    assert.deepEqual(previewSplit(123n, []), { toWorker: 123n, toRecipients: 0n, shares: [] })
  })

  it('always conserves the amount', () => {
    for (let i = 0; i < 1_000; i++) {
      const gross = BigInt(Math.floor(Math.random() * 1e12))
      const a = 1 + Math.floor(Math.random() * 9_000)
      const b = 1 + Math.floor(Math.random() * (9_999 - a))
      const c = 1 + Math.floor(Math.random() * (10_000 - a - b))
      const p = previewSplit(gross, [split(siti, a), split(budi, b), split(ani, c)])
      assert.equal(p.toWorker + p.toRecipients, gross)
      assert.ok(p.toWorker >= 0n)
    }
  })

  it('throws on input the contract could never produce', () => {
    assert.throws(() => previewSplit(-1n, []), RangeError)
    assert.throws(() => previewSplit(10n, [split(siti, 6_000), split(budi, 6_000)]), RangeError)
  })
})

describe('percent <-> bps', () => {
  it('parses without floating-point error', () => {
    assert.equal(percentToBps('12.5'), 1_250)
    assert.equal(percentToBps('0,07'), 7) // 0.07 * 10_000 is 700.0000000000001 in floats
    assert.equal(percentToBps(' 7 '), 700)
    assert.equal(percentToBps('100'), 10_000)
  })

  it('returns null for anything that is not a plain percentage', () => {
    for (const input of ['', 'abc', '1.234', '-5', '1e2', '1000']) {
      assert.equal(percentToBps(input), null, input)
    }
  })

  it('formats bps back to a percentage', () => {
    assert.equal(bpsToPercent(1_250), '12.5')
    assert.equal(bpsToPercent(7), '0.07')
    assert.equal(percentToBps(bpsToPercent(1_999)), 1_999)
  })
})
