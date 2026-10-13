import { isApiError } from '@/lib/api'
import { authCopy } from '@/lib/copy/auth'
import type { Locale } from '@/lib/i18n/config'

/** Kode backend/klien yang artinya "layanan belum siap", bukan kesalahan pengguna. */
const NOT_READY_CODES = new Set(['PRIVY_NOT_CONFIGURED', 'API_NOT_CONFIGURED'])

/**
 * Judul + pesan ramah untuk error API apa pun. Tidak pernah memuat `code` mentah.
 * Memakai kode dan status HTTP asli (bukan hanya `kind`), karena klien API bersama
 * memetakan sebagian status ke `kind` yang terlalu umum (mis. 503 → `server`).
 */
export function apiErrorMessage(err: unknown, locale: Locale): { title: string; message: string } {
  const t = authCopy[locale].apiError
  if (!isApiError(err)) return t.generic
  if (err.code === 'WALLET_NOT_READY' || err.kind === 'wallet-not-ready') return t.walletNotReady
  if (
    (err.code && NOT_READY_CODES.has(err.code)) ||
    err.status === 503 ||
    err.kind === 'configuration' ||
    err.kind === 'unavailable'
  ) {
    return t.unavailable
  }
  if (err.status === 401 || err.kind === 'unauthorized') return t.unauthorized
  if (err.status === 403 || err.kind === 'forbidden') return t.forbidden
  if (err.status === 429 || err.kind === 'rate-limited') return t.rateLimited
  if (err.status === null && err.kind === 'network') return t.network
  return t.generic
}
