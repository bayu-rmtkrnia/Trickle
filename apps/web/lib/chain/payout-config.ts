import { getAddress, isAddress, zeroAddress, type Address } from 'viem'
import { payrollConfig, type PayrollConfig } from './config'

/**
 * Public payout address agreed with the backend (`PAYOUT_ADDRESS`). Returns
 * `null` when it is missing, invalid, the zero address, or one of the payroll
 * contracts, which keeps the transfer button disabled instead of guessing.
 */
export function resolvePayoutAddress(
  raw: string | undefined,
  config: PayrollConfig = payrollConfig,
): Address | null {
  const value = raw?.trim()
  if (!value || !isAddress(value)) return null
  const address = getAddress(value)
  if (
    address === zeroAddress ||
    address === getAddress(config.payrollAddress) ||
    address === getAddress(config.tokenAddress)
  )
    return null
  return address
}

// Referenced literally so Next.js inlines it into the client bundle.
export const payoutAddress = resolvePayoutAddress(process.env.NEXT_PUBLIC_PAYOUT_ADDRESS)
