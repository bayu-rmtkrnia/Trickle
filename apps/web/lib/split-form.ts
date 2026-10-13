import { isAddress, type Address } from 'viem'
import { MAX_RECIPIENTS, percentToBps, validateSplits, type Split } from './chain/split'

export interface SplitRow {
  recipient: Address | ''
  percent: string
}
export type SplitRowError = 'recipient' | 'percent' | string
export type SplitDraft =
  | { ok: true; splits: Split[]; totalBps: number }
  | { ok: false; rows: (SplitRowError | null)[]; general: string | null; totalBps: number }

/**
 * Turns form rows into the exact `setSplits` list, using the contract's own
 * rules (`validateSplits`). `[]` (no rows) is valid and turns the split off.
 */
export function buildSplitDraft(rows: readonly SplitRow[], worker?: string): SplitDraft {
  const errors: (SplitRowError | null)[] = rows.map(() => null)
  const splits: Split[] = []
  let totalBps = 0
  rows.forEach((row, index) => {
    const bps = percentToBps(row.percent)
    if (!row.recipient || !isAddress(row.recipient)) errors[index] = 'recipient'
    else if (worker && row.recipient.toLowerCase() === worker.toLowerCase())
      errors[index] = 'recipient'
    else if (bps === null || bps <= 0 || bps > 10_000) errors[index] = 'percent'
    if (bps !== null) totalBps += bps
    if (!errors[index]) splits.push({ recipient: row.recipient as Address, bps: bps! })
  })
  if (errors.some(Boolean)) return { ok: false, rows: errors, general: null, totalBps }
  if (rows.length > MAX_RECIPIENTS)
    return { ok: false, rows: errors, general: 'TOO_MANY_RECIPIENTS', totalBps }
  const problem = validateSplits(splits)
  if (problem) {
    if ('index' in problem) errors[problem.index] = problem.code
    return {
      ok: false,
      rows: errors,
      general: 'index' in problem ? null : problem.code,
      totalBps,
    }
  }
  return { ok: true, splits, totalBps }
}
