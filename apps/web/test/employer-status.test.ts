import { describe, expect, it } from 'vitest'
import { employerPayrollStatus } from '@/lib/chain/employer-status'

const b = BigInt
const employer = '0x1111111111111111111111111111111111111111' as const
const other = '0x3333333333333333333333333333333333333333' as const
const base = {
  worker: '0x2222222222222222222222222222222222222222' as const,
  amount: b(1000),
  withdrawn: b(0),
  refunded: b(0),
  start: b(100),
  end: b(200),
  canceled: false,
}
const stream = (id: number, patch: Partial<typeof base> & { employer?: `0x${string}` } = {}) => ({
  id: b(id),
  employer,
  ...base,
  ...patch,
})

describe('employerPayrollStatus', () => {
  it('is unknown until the chain snapshot and time are available', () => {
    expect(employerPayrollStatus(null, b(150), employer)).toBeNull()
    expect(employerPayrollStatus({ streams: [stream(1)] }, null, employer)).toBeNull()
  })
  it('says there is no stream when this employer has none', () => {
    expect(
      employerPayrollStatus({ streams: [stream(1, { employer: other })] }, b(150), employer),
    ).toBe('none')
    expect(employerPayrollStatus({ streams: [] }, b(150), employer)).toBe('none')
  })
  it('matches the employer address case-insensitively', () => {
    const upper = `0x${employer.slice(2).toUpperCase()}` as `0x${string}`
    expect(
      employerPayrollStatus({ streams: [stream(1, { employer: upper })] }, b(150), employer),
    ).toBe('active')
  })
  it('reports each lifecycle status', () => {
    const at = (patch: Parameters<typeof stream>[1], now = 150) =>
      employerPayrollStatus({ streams: [stream(1, patch)] }, b(now), employer)
    expect(at({}, 50)).toBe('scheduled')
    expect(at({})).toBe('active')
    expect(at({}, 250)).toBe('ended')
    expect(at({ withdrawn: b(1000) }, 250)).toBe('depleted')
    expect(at({ canceled: true, refunded: b(500) })).toBe('canceled')
  })
  it('prefers the most relevant stream when an employer has several', () => {
    const streams = [
      stream(1, { canceled: true, refunded: b(500) }),
      stream(2),
      stream(3, { start: b(300), end: b(400) }),
    ]
    expect(employerPayrollStatus({ streams }, b(150), employer)).toBe('active')
    expect(
      employerPayrollStatus({ streams: streams.filter((s) => s.id !== b(2)) }, b(150), employer),
    ).toBe('scheduled')
  })
  it('falls back to unknown for an unreadable stream', () => {
    // Withdrawn more than the stream holds: the stream math rejects it.
    const broken = stream(1, { withdrawn: b(5000) })
    expect(employerPayrollStatus({ streams: [broken] }, b(250), employer)).toBeNull()
  })
})
