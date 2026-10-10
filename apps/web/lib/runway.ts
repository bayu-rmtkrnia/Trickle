import type { Worker } from '@/lib/api'
import { dailyFromMonthly } from '@/lib/format'

export type RunwayLevel = 'no-workers' | 'healthy' | 'low' | 'critical' | 'empty'

/**
 * Berapa hari dana payroll cukup (DESIGN.md 7.3). Ambang 7 dan 3 hari
 * adalah judgment, bukan standar.
 */
export function computeRunway(balanceUsd: number, workers: Worker[]) {
  const monthlyUsd = workers.reduce((sum, w) => sum + w.monthlySalaryUsd, 0)
  const dailyUsd = dailyFromMonthly(monthlyUsd)
  if (balanceUsd <= 0 && workers.length > 0) return { level: 'empty' as const, days: 0, monthlyUsd }
  if (dailyUsd === 0) return { level: 'no-workers' as const, days: null, monthlyUsd }
  const days = Math.floor(balanceUsd / dailyUsd)
  const level: RunwayLevel = days < 3 ? 'critical' : days < 7 ? 'low' : 'healthy'
  return { level, days, monthlyUsd }
}

/** Gaji yang sudah mengalir sejak bergabung (hitungan lokal sampai kontrak bisa dibaca). */
export function streamedSince(worker: Worker, now = Date.now()) {
  const seconds = Math.max(0, (now - new Date(worker.joinedAt).getTime()) / 1000)
  return (dailyFromMonthly(worker.monthlySalaryUsd) / 86_400) * seconds
}
