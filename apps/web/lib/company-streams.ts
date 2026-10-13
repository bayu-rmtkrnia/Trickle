// Hitungan aliran gaji untuk dashboard perusahaan, dari data indexer (CompanyStream).
// Rumusnya sama dengan kontrak TricklePayroll (`_streamedAmount`): linear per detik,
// dibekukan saat dibatalkan. Uang selalu bigint dalam unit token (6 desimal).

import type { CompanyStream, Worker } from '@/lib/api'

/** 1 USD = 1 mAUSD = 1.000.000 unit (6 desimal), sama seperti hitungan payout backend. */
export const UNITS_PER_USD = BigInt(1_000_000)
const ZERO = BigInt(0)
const DAY_SECONDS = 24 * 60 * 60

/** Periode pendanaan yang bisa dipilih perusahaan (hari). Default 30 = satu bulan gaji. */
export const FUNDING_PERIODS = [7, 14, 30] as const
export type FundingPeriod = (typeof FUNDING_PERIODS)[number]
export const DEFAULT_FUNDING_PERIOD: FundingPeriod = 30

const seconds = (iso: string) => Math.floor(Date.parse(iso) / 1000)

export const unitsToUsd = (units: bigint) => Number(units) / Number(UNITS_PER_USD)

/** Bagian yang sudah mengalir ke pekerja sampai `nowSeconds`. */
export function streamedUnits(stream: CompanyStream, nowSeconds: number): bigint {
  const amount = BigInt(stream.amountUnits)
  if (stream.status === 'CANCELED') return amount - BigInt(stream.refundedUnits)
  const start = seconds(stream.startsAt)
  const end = seconds(stream.endsAt)
  if (nowSeconds <= start) return ZERO
  if (nowSeconds >= end || end <= start) return amount
  return (amount * BigInt(nowSeconds - start)) / BigInt(end - start)
}

/** Dana perusahaan yang masih terkunci dan belum mengalir (bisa dikembalikan lewat `cancel`). */
export function lockedUnits(stream: CompanyStream, nowSeconds: number): bigint {
  if (stream.status === 'CANCELED') return ZERO
  const left = BigInt(stream.amountUnits) - streamedUnits(stream, nowSeconds)
  return left > ZERO ? left : ZERO
}

const isLive = (s: CompanyStream, nowSeconds: number) =>
  s.status !== 'CANCELED' && seconds(s.endsAt) > nowSeconds

export type WorkerPayState =
  | { kind: 'unfunded' }
  | { kind: 'active'; endsAt: string; streamId: string; scheduledUntil: string | null }
  | { kind: 'scheduled'; startsAt: string; endsAt: string; streamId: string }
  | { kind: 'ended'; endedAt: string }

/** Status gaji satu pekerja dari semua aliran ke alamatnya. */
export function workerPayState(
  worker: Worker,
  streams: CompanyStream[],
  nowSeconds: number,
): WorkerPayState {
  const mine = streams.filter((s) => s.workerAddress.toLowerCase() === worker.address.toLowerCase())
  const live = mine.filter((s) => isLive(s, nowSeconds))
  const running = live
    .filter((s) => seconds(s.startsAt) <= nowSeconds)
    .sort((a, b) => seconds(a.endsAt) - seconds(b.endsAt))[0]
  const lastEnd = (list: CompanyStream[]) =>
    list.reduce<string | null>(
      (max, s) => (max === null || seconds(s.endsAt) > seconds(max) ? s.endsAt : max),
      null,
    )
  if (running) {
    const until = lastEnd(live)
    return {
      kind: 'active',
      endsAt: running.endsAt,
      streamId: running.id,
      scheduledUntil: until && until !== running.endsAt ? until : null,
    }
  }
  const next = live.sort((a, b) => seconds(a.startsAt) - seconds(b.startsAt))[0]
  if (next)
    return { kind: 'scheduled', startsAt: next.startsAt, endsAt: next.endsAt, streamId: next.id }
  const ended = lastEnd(mine.filter((s) => s.status !== 'CANCELED'))
  return ended ? { kind: 'ended', endedAt: ended } : { kind: 'unfunded' }
}

/** Total yang sudah mengalir ke satu pekerja, dari semua alirannya. */
export function streamedToWorker(worker: Worker, streams: CompanyStream[], nowSeconds: number) {
  return streams
    .filter((s) => s.workerAddress.toLowerCase() === worker.address.toLowerCase())
    .reduce((sum, s) => sum + streamedUnits(s, nowSeconds), ZERO)
}

export type FundsLevel = 'no-workers' | 'unfunded' | 'healthy' | 'low' | 'critical' | 'ended'

/**
 * Ringkasan untuk kartu dana: dana terkunci, aliran aktif terdekat berakhir dalam N hari,
 * dan level peringatan (DESIGN.md 7.3; ambang 7 dan 3 hari adalah judgment).
 */
export function summarizeFunds(workers: Worker[], streams: CompanyStream[], nowSeconds: number) {
  const locked = streams.reduce((sum, s) => sum + lockedUnits(s, nowSeconds), ZERO)
  const states = workers.map((w) => workerPayState(w, streams, nowSeconds))
  const runningEnds = states.flatMap((s) =>
    s.kind === 'active' ? [seconds(s.scheduledUntil ?? s.endsAt)] : [],
  )
  const nearestEnd = runningEnds.length ? Math.min(...runningEnds) : null
  const days =
    nearestEnd === null ? null : Math.max(0, Math.ceil((nearestEnd - nowSeconds) / DAY_SECONDS))
  const unfundedWorkers = states.filter((s) => s.kind === 'unfunded' || s.kind === 'ended').length

  let level: FundsLevel
  if (workers.length === 0) level = 'no-workers'
  else if (days === null)
    level = states.some((s) => s.kind === 'ended')
      ? 'ended'
      : states.some((s) => s.kind === 'scheduled')
        ? 'healthy'
        : 'unfunded'
  else level = days < 3 ? 'critical' : days < 7 ? 'low' : 'healthy'

  return { lockedUnits: locked, days, level, unfundedWorkers }
}

/** Jumlah pendanaan: gaji bulanan × hari / 30, dalam unit token (dibulatkan ke bawah). */
export function fundingUnits(monthlySalaryUsd: number, days: number): bigint {
  const cents = BigInt(Math.round(monthlySalaryUsd * 100))
  return (cents * BigInt(10_000) * BigInt(days)) / BigInt(30)
}

/**
 * Kapan aliran baru dimulai: tepat saat aliran yang sedang berjalan/terjadwal berakhir
 * (gaji tetap mengalir tanpa jeda), atau `0` = mulai sekarang (aturan kontrak).
 */
export function nextStartSeconds(
  worker: Worker,
  streams: CompanyStream[],
  nowSeconds: number,
): number {
  const ends = streams
    .filter(
      (s) =>
        s.workerAddress.toLowerCase() === worker.address.toLowerCase() && isLive(s, nowSeconds),
    )
    .map((s) => seconds(s.endsAt))
  const latest = ends.length ? Math.max(...ends) : 0
  // Beri ruang ±2 menit supaya transaksi tidak ditolak karena waktu mulai sudah lewat.
  return latest > nowSeconds + 120 ? latest : 0
}

export const DAY_IN_SECONDS = DAY_SECONDS
