import { describe, expect, it } from 'vitest'
import type { CompanyStream, Worker } from '@/lib/api'
import {
  fundingUnits,
  lockedUnits,
  nextStartSeconds,
  streamedUnits,
  streamedToWorker,
  summarizeFunds,
  workerPayState,
} from '@/lib/company-streams'

const b = BigInt
const DAY = 86_400
const NOW = 1_800_000_000
const iso = (seconds: number) => new Date(seconds * 1000).toISOString()

const worker = (id: string, address: string, monthlySalaryUsd = 800): Worker => ({
  id,
  address,
  displayName: id,
  monthlySalaryUsd,
  joinedAt: iso(NOW - 30 * DAY),
})
const siti = worker('siti', '0x00000000000000000000000000000000000000a1')
const dewi = worker('dewi', '0x00000000000000000000000000000000000000a2')

function stream(
  to: Worker,
  startOffset: number,
  endOffset: number,
  amount = b(30_000_000),
  extra: Partial<CompanyStream> = {},
): CompanyStream {
  return {
    id: String(Math.abs(startOffset * 7 + endOffset)),
    workerAddress: to.address,
    amountUnits: amount.toString(),
    withdrawnUnits: '0',
    refundedUnits: '0',
    startsAt: iso(NOW + startOffset),
    endsAt: iso(NOW + endOffset),
    status: 'ACTIVE',
    worker: { id: to.id, displayName: to.displayName },
    ...extra,
  }
}

describe('streamed and locked amounts (same formula as the contract)', () => {
  it('streams linearly between start and end', () => {
    const s = stream(siti, -10 * DAY, 20 * DAY)
    expect(streamedUnits(s, NOW)).toBe(b(10_000_000))
    expect(lockedUnits(s, NOW)).toBe(b(20_000_000))
  })

  it('streams nothing before start and everything after end', () => {
    expect(streamedUnits(stream(siti, DAY, 31 * DAY), NOW)).toBe(b(0))
    expect(streamedUnits(stream(siti, -31 * DAY, -DAY), NOW)).toBe(b(30_000_000))
    expect(lockedUnits(stream(siti, -31 * DAY, -DAY), NOW)).toBe(b(0))
  })

  it('freezes a canceled stream at what was streamed and locks nothing', () => {
    const canceled = stream(siti, -10 * DAY, 20 * DAY, b(30_000_000), {
      status: 'CANCELED',
      refundedUnits: '20000000',
    })
    expect(streamedUnits(canceled, NOW + 5 * DAY)).toBe(b(10_000_000))
    expect(lockedUnits(canceled, NOW)).toBe(b(0))
  })

  it('adds up what flowed to one worker across streams', () => {
    const streams = [
      stream(siti, -31 * DAY, -DAY),
      stream(siti, -DAY, 29 * DAY),
      stream(dewi, -31 * DAY, -DAY),
    ]
    expect(streamedToWorker(siti, streams, NOW)).toBe(b(31_000_000))
  })
})

describe('worker pay state', () => {
  it('is unfunded without streams', () => {
    expect(workerPayState(siti, [], NOW)).toEqual({ kind: 'unfunded' })
  })

  it('is active and reports the next period when one is already scheduled', () => {
    const current = stream(siti, -10 * DAY, 20 * DAY)
    const next = stream(siti, 20 * DAY, 50 * DAY)
    expect(workerPayState(siti, [current, next], NOW)).toEqual({
      kind: 'active',
      endsAt: current.endsAt,
      streamId: current.id,
      scheduledUntil: next.endsAt,
    })
  })

  it('is scheduled when only a future stream exists', () => {
    const later = stream(siti, 2 * DAY, 32 * DAY)
    expect(workerPayState(siti, [later], NOW)).toMatchObject({
      kind: 'scheduled',
      startsAt: later.startsAt,
    })
  })

  it('is ended when every stream is over, ignoring canceled ones', () => {
    const old = stream(siti, -40 * DAY, -10 * DAY)
    const canceled = stream(siti, -9 * DAY, 21 * DAY, b(1), { status: 'CANCELED' })
    expect(workerPayState(siti, [old, canceled], NOW)).toEqual({
      kind: 'ended',
      endedAt: old.endsAt,
    })
  })
})

describe('funds summary for the company card', () => {
  it.each([
    [22, 'healthy'],
    [5, 'low'],
    [2, 'critical'],
  ] as const)('a stream ending in %i days is %s', (days, level) => {
    const summary = summarizeFunds([siti], [stream(siti, -DAY, days * DAY)], NOW)
    expect(summary.level).toBe(level)
    expect(summary.days).toBe(days)
  })

  it('flags ended pay and counts the workers without a live stream', () => {
    const summary = summarizeFunds([siti, dewi], [stream(siti, -31 * DAY, -DAY)], NOW)
    expect(summary).toMatchObject({
      level: 'ended',
      days: null,
      unfundedWorkers: 2,
      lockedUnits: b(0),
    })
  })

  it('separates "no workers" from "nothing funded yet"', () => {
    expect(summarizeFunds([], [], NOW).level).toBe('no-workers')
    expect(summarizeFunds([siti], [], NOW).level).toBe('unfunded')
  })

  it('sums locked funds across workers', () => {
    const summary = summarizeFunds(
      [siti, dewi],
      [stream(siti, -10 * DAY, 20 * DAY), stream(dewi, DAY, 31 * DAY)],
      NOW,
    )
    expect(summary.lockedUnits).toBe(b(50_000_000))
  })
})

describe('funding amount and start', () => {
  it('converts monthly USD pay to token units for the period', () => {
    expect(fundingUnits(800, 30)).toBe(b(800_000_000))
    expect(fundingUnits(750, 7)).toBe(b(175_000_000))
    expect(fundingUnits(26.67, 30)).toBe(b(26_670_000))
  })

  it('starts after the current stream so pay keeps flowing without a gap', () => {
    const current = stream(siti, -10 * DAY, 20 * DAY)
    expect(nextStartSeconds(siti, [current], NOW)).toBe(NOW + 20 * DAY)
    expect(nextStartSeconds(dewi, [current], NOW)).toBe(0)
  })

  it('starts now when the current stream ends within two minutes', () => {
    expect(nextStartSeconds(siti, [stream(siti, -DAY, 60)], NOW)).toBe(0)
  })
})
