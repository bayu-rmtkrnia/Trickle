// Client-side mirror of TricklePayroll's split rules (docs/contract-spec.md §2).
// Validate before sending `setSplits` so a bad list never costs gas, and preview
// with the same rounding as `withdraw` so the numbers match the receipt to the unit.
// No imports on purpose: usable from apps/web, apps/api and `node --test` alike.

type Address = `0x${string}`

/** Same as `MAX_RECIPIENTS()` on the contract. */
export const MAX_RECIPIENTS = 3
/** 10_000 bps = 100%. */
export const MAX_BPS = 10_000

export interface Split {
  recipient: Address
  bps: number
}

export type SplitError =
  | { code: 'TOO_MANY_RECIPIENTS' }
  | { code: 'INVALID_ADDRESS'; index: number }
  | { code: 'ZERO_ADDRESS'; index: number }
  | { code: 'INVALID_BPS'; index: number }
  | { code: 'DUPLICATE_RECIPIENT'; index: number }
  | { code: 'TOTAL_OVER_100'; totalBps: number }

const ADDRESS = /^0x[0-9a-fA-F]{40}$/
const ZERO = /^0x0{40}$/
// BigInt(0), not 0n: apps/web targets ES2017, which has no bigint literals.
const ZERO_BIGINT = BigInt(0)

/**
 * Returns the first rule `setSplits` would reject, or `null` when the list is valid.
 * An empty list is valid and turns the split off.
 *
 * Contract errors: TOO_MANY_RECIPIENTS → `TooManyRecipients`, DUPLICATE_RECIPIENT →
 * `DuplicateRecipient`, ZERO_ADDRESS / INVALID_BPS / TOTAL_OVER_100 → `InvalidSplit`.
 * INVALID_ADDRESS cannot reach the contract (the ABI encoder rejects it first).
 */
export function validateSplits(splits: readonly Split[]): SplitError | null {
  if (splits.length > MAX_RECIPIENTS) return { code: 'TOO_MANY_RECIPIENTS' }

  let totalBps = 0
  const seen = new Set<string>()
  for (const [index, { recipient, bps }] of splits.entries()) {
    if (!ADDRESS.test(recipient)) return { code: 'INVALID_ADDRESS', index }
    if (ZERO.test(recipient)) return { code: 'ZERO_ADDRESS', index }
    if (!Number.isInteger(bps) || bps <= 0 || bps > MAX_BPS) return { code: 'INVALID_BPS', index }
    // Addresses compare case-insensitively: checksummed and lowercase are the same account.
    const key = recipient.toLowerCase()
    if (seen.has(key)) return { code: 'DUPLICATE_RECIPIENT', index }
    seen.add(key)
    totalBps += bps
  }
  if (totalBps > MAX_BPS) return { code: 'TOTAL_OVER_100', totalBps }
  return null
}

export interface SplitPreview {
  toWorker: bigint
  toRecipients: bigint
  shares: { recipient: Address; bps: number; amount: bigint }[]
}

/**
 * How `withdraw` divides `gross` (raw token units): each recipient gets
 * `gross * bps / 10_000` rounded down, and the worker gets the rest, including dust.
 * A share of 0 is listed here but has no `SplitPaid` event on chain.
 */
export function previewSplit(gross: bigint, splits: readonly Split[]): SplitPreview {
  if (gross < ZERO_BIGINT) throw new RangeError('gross must not be negative')
  const shares = splits.map(({ recipient, bps }) => {
    if (!Number.isInteger(bps) || bps < 0 || bps > MAX_BPS) throw new RangeError('invalid bps')
    return { recipient, bps, amount: (gross * BigInt(bps)) / BigInt(MAX_BPS) }
  })
  const toRecipients = shares.reduce((sum, share) => sum + share.amount, ZERO_BIGINT)
  if (toRecipients > gross) throw new RangeError('total bps over 100%')
  return { toWorker: gross - toRecipients, toRecipients, shares }
}

/**
 * Parses a percentage typed by the user ("12.5", "7", "0,25") into bps without
 * floating-point error. At most 2 decimals, because 1 bps = 0.01%. Returns `null`
 * for anything else. Range checks are left to `validateSplits`.
 */
export function percentToBps(input: string): number | null {
  const match = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(input.trim())
  if (!match) return null
  const whole = Number(match[1])
  const fraction = Number((match[2] ?? '').padEnd(2, '0'))
  return whole * 100 + fraction
}

/** 1250 → "12.5". For display next to an input that `percentToBps` parses. */
export function bpsToPercent(bps: number): string {
  return (bps / 100).toString()
}
