import type { Hex } from 'viem'
import type { GasDrip } from '@/lib/api/gas'
import { WithdrawalError } from './payroll-writer'

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(done, ms)
    signal?.addEventListener('abort', aborted, { once: true })
    function done() {
      signal?.removeEventListener('abort', aborted)
      resolve()
    }
    function aborted() {
      clearTimeout(timer)
      signal?.removeEventListener('abort', aborted)
      reject(new DOMException('Aborted', 'AbortError'))
    }
  })
}

export async function confirmGasFunding(
  request: () => Promise<GasDrip>,
  receipt: (hash: Hex) => Promise<'success' | 'reverted'>,
  options: { attempts?: number; delay?: () => Promise<void>; signal?: AbortSignal } = {},
): Promise<void> {
  // The backend permits five drip calls per minute; leave room for a manual retry.
  const attempts = options.attempts ?? 3
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const drip = await request()
    if (drip.status === 'FAILED') throw new WithdrawalError('GAS_FAILED')
    if (drip.status === 'SENT') {
      if (!drip.txHash) throw new WithdrawalError('GAS_FAILED')
      const status = await receipt(drip.txHash)
      if (status !== 'success') throw new WithdrawalError('GAS_FAILED')
      return
    }
    if (attempt < attempts - 1) await (options.delay?.() ?? delay(2000, options.signal))
  }
  throw new WithdrawalError('GAS_PENDING')
}
