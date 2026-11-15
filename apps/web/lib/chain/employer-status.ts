import { streamStatus } from './stream-math'
import type { StreamSnapshot } from './types'

export type EmployerPayrollStatus = ReturnType<typeof streamStatus> | 'none'

// One employer can pay through several streams; show the most relevant one.
const PRIORITY = ['active', 'scheduled', 'ended', 'depleted', 'canceled'] as const

/**
 * Payroll status of one employer for the worker's streams, or `null` while it
 * cannot be told (no chain snapshot yet, or an unreadable stream).
 */
export function employerPayrollStatus(
  snapshot: { streams: readonly StreamSnapshot[] } | null,
  timestamp: bigint | null,
  employer: string,
): EmployerPayrollStatus | null {
  if (!snapshot || timestamp === null) return null
  const own = snapshot.streams.filter((s) => s.employer.toLowerCase() === employer.toLowerCase())
  if (own.length === 0) return 'none'
  try {
    const found = new Set(own.map((s) => streamStatus(s, timestamp)))
    return PRIORITY.find((status) => found.has(status)) ?? null
  } catch {
    return null
  }
}
