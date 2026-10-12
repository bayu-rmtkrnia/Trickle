import { isApiError } from '@/lib/api'
import { authCopy } from '@/lib/copy/auth'
import type { Locale } from '@/lib/i18n/config'

/** Judul + pesan ramah untuk error API apa pun. Tidak pernah memuat `code` mentah. */
export function apiErrorMessage(err: unknown, locale: Locale): { title: string; message: string } {
  const t = authCopy[locale].apiError
  if (!isApiError(err)) return t.generic
  if (err.code === 'WALLET_NOT_READY') return t.walletNotReady
  switch (err.kind) {
    case 'network':
      return t.network
    case 'unauthorized':
      return t.unauthorized
    case 'rate-limited':
      return t.rateLimited
    case 'unavailable':
      return t.unavailable
    default:
      return t.generic
  }
}
