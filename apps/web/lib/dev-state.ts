/**
 * `?state=` / `?as=` untuk melihat state UI tanpa backend. Hanya aktif saat
 * development; di build production selalu diabaikan.
 */
export const devStatesEnabled = process.env.NODE_ENV !== 'production'

export function pickDevState<T extends string>(
  value: string | string[] | undefined,
  allowed: readonly T[],
): T | undefined {
  if (!devStatesEnabled || typeof value !== 'string') return undefined
  return (allowed as readonly string[]).includes(value) ? (value as T) : undefined
}

export const EMPLOYER_STATES = [
  'loading',
  'belum-ada-profil',
  'belum-ada-pekerja',
  'ada-undangan',
  'runway-sehat',
  'runway-rendah',
  'runway-kritis',
  'dana-habis',
  'network-error',
] as const

export type EmployerState = (typeof EMPLOYER_STATES)[number]
