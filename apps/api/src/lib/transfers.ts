import {
  parseAbi,
  parseEventLogs,
  TransactionReceiptNotFoundError,
  type Address,
  type Hash,
  type PublicClient,
} from 'viem'

/** What a transaction moved from a recipient to the payout address. */
export type TransferCheck =
  | { status: 'pending' }
  | { status: 'reverted' }
  /** `amount` is 0n when the transaction holds no such transfer. */
  | { status: 'ok'; amount: bigint }

/**
 * Proves a payout was paid for on-chain before any IDR goes out (PLAN §3.2:
 * the transfer is real, only the bank leg is sandbox). Tests swap in a fake
 * through `buildApp({ transfers })`.
 */
export interface TransferVerifier {
  /** Where recipients send tokens to cash out. `undefined`: payouts are off. */
  payoutAddress: Address | undefined
  /** Sums the payroll token's `Transfer`s from `from` to the payout address in `txHash`. */
  check(txHash: Hash, from: Address): Promise<TransferCheck>
}

const payrollAbi = parseAbi(['function token() view returns (address)'])
const erc20Abi = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
])

interface Options {
  client: Pick<PublicClient, 'readContract' | 'getTransactionReceipt'>
  payroll?: Address
  payoutAddress?: Address
}

/** Reads the receipt only, so it works with the public RPC (no `eth_getLogs` ranges). */
export function createTransferVerifier({
  client,
  payroll,
  payoutAddress,
}: Options): TransferVerifier {
  const to = payoutAddress?.toLowerCase()
  let token: string | undefined

  return {
    payoutAddress: payroll && payoutAddress ? payoutAddress : undefined,

    async check(txHash, from) {
      if (!payroll || !to) throw new Error('Payouts are not configured')
      token ??= (
        await client.readContract({ address: payroll, abi: payrollAbi, functionName: 'token' })
      ).toLowerCase()

      let receipt
      try {
        receipt = await client.getTransactionReceipt({ hash: txHash })
      } catch (err) {
        if (err instanceof TransactionReceiptNotFoundError) return { status: 'pending' }
        throw err
      }
      if (receipt.status !== 'success') return { status: 'reverted' }

      const sender = from.toLowerCase()
      const amount = parseEventLogs({ abi: erc20Abi, eventName: 'Transfer', logs: receipt.logs })
        .filter(
          (log) =>
            log.address.toLowerCase() === token &&
            log.args.from.toLowerCase() === sender &&
            log.args.to.toLowerCase() === to,
        )
        .reduce((sum, log) => sum + log.args.value, 0n)
      return { status: 'ok', amount }
    },
  }
}
