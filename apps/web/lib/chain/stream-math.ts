type Stream = {
  amount: bigint
  withdrawn: bigint
  refunded: bigint
  start: bigint
  end: bigint
  canceled: boolean
}
const zero = BigInt(0)
export const STALE_AFTER_MS = 30000
export function availableAt(s: Stream, now: bigint): bigint {
  if (
    s.end <= s.start ||
    [s.amount, s.withdrawn, s.refunded].some((value) => value < zero) ||
    s.refunded > s.amount ||
    s.withdrawn > s.amount - s.refunded
  )
    throw new RangeError('Invalid stream')
  const vested = s.canceled
    ? s.amount - s.refunded
    : now <= s.start
      ? zero
      : now >= s.end
        ? s.amount
        : (s.amount * (now - s.start)) / (s.end - s.start)
  return vested > s.withdrawn ? vested - s.withdrawn : zero
}
export function estimateTimestamp(timestamp: bigint, elapsedMs: number) {
  return timestamp + BigInt(Math.floor(Math.max(0, Math.min(elapsedMs, STALE_AFTER_MS)) / 1000))
}
export function streamStatus(s: Stream, now: bigint) {
  if (s.canceled) return 'canceled'
  if (now < s.start) return 'scheduled'
  if (now >= s.end) return availableAt(s, now) > zero ? 'ended' : 'depleted'
  return 'active'
}
