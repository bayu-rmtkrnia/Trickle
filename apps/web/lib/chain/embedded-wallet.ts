import { WithdrawalError, type WithdrawalRequest } from './payroll-writer'
import type { Hex } from 'viem'
export async function sendEmbeddedTransaction(
  request: WithdrawalRequest,
  getWallet: () => { address: string; switchChain(chain: number): Promise<void> } | null,
  send: (input: WithdrawalRequest, options: { address: string }) => Promise<{ hash: Hex }>,
): Promise<{ hash: Hex }> {
  const wallet = getWallet()
  if (!wallet || wallet.address.toLowerCase() !== request.from.toLowerCase())
    throw new WithdrawalError('WALLET_CHANGED')
  try {
    await wallet.switchChain(request.chainId)
  } catch {
    throw new WithdrawalError('WALLET_NOT_READY')
  }
  if (getWallet()?.address.toLowerCase() !== request.from.toLowerCase())
    throw new WithdrawalError('WALLET_CHANGED')
  return send(request, { address: wallet.address })
}
