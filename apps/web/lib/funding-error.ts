import { isApiError } from '@/lib/api'
import { apiErrorMessage } from '@/lib/api-error-message'
import { WithdrawalError } from '@/lib/chain/payroll-writer'
import { employerCopy } from '@/lib/copy/employer'
import type { Locale } from '@/lib/i18n/config'

/** Pesan ramah untuk kegagalan "Danai gaji" / "Hentikan aliran". Tanpa kode mentah. */
export function fundingErrorMessage(error: unknown, locale: Locale): string {
  const t = employerCopy[locale].fundingErrors
  if (isApiError(error)) return apiErrorMessage(error, locale).message
  if (error instanceof WithdrawalError) {
    switch (error.code) {
      case 'GAS_INSUFFICIENT':
      case 'GAS_FAILED':
      case 'GAS_PENDING':
        return t.gas
      case 'INSUFFICIENT_FUNDS':
        return t.funds
      case 'WALLET_CHANGED':
      case 'WALLET_NOT_READY':
        return t.wallet
      case 'REVERTED':
        return t.rejected
      case 'DEPLOYMENT_MISMATCH':
        return t.service
    }
  }
  return t.generic
}
