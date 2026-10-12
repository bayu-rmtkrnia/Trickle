import {
  decodeEventLog,
  encodeFunctionData,
  isAddress,
  parseAbiItem,
  type Address,
  type Abi,
  type Hex,
} from 'viem'
import abi from '../../../../packages/shared/abi/TricklePayroll.json'
import { payrollConfig as config } from './config'
import type { ChainPort } from './payroll-reader'
export interface WithdrawalRequest {
  from: Address
  to: Address
  data: Hex
  chainId: number
  value: bigint
}
export interface WithdrawalResult {
  hash: Hex
  streamId: bigint
  toWorker: bigint
  recipient: Address
  toRecipient: bigint
}
export interface WithdrawalReceipt {
  transactionHash: Hex
  blockNumber: bigint
  replacement?: 'repriced' | 'replaced' | 'cancelled'
  status: 'success' | 'reverted'
  logs: { address: Address; data: Hex; topics: readonly Hex[] }[]
}
export interface WithdrawalPort extends ChainPort {
  transactionCount?(worker: Address, tag: 'latest' | 'pending'): Promise<bigint>
  nativeBalance(worker: Address): Promise<bigint>
  gasCost(worker: Address, id: bigint): Promise<bigint>
  simulate(worker: Address, id: bigint): Promise<void>
  fundGas(worker: Address, signal?: AbortSignal): Promise<void>
  receipt(hash: Hex): Promise<WithdrawalReceipt>
  transaction(hash: Hex): Promise<{ from: Address; to: Address | null; input: Hex; value: bigint }>
}
export class WithdrawalError extends Error {
  constructor(public readonly code: string) {
    super(code)
  }
}
const equal = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
const checkAbort = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
}
export const withdrawalData = (id: bigint) =>
  encodeFunctionData({ abi: abi as Abi, functionName: 'withdraw', args: [id] })
const withdrawnEvent = parseAbiItem(
  'event Withdrawn(uint256 indexed streamId, address indexed worker, uint128 toWorker, address indexed recipient, uint128 toRecipient)',
)
export function createPayrollWriter(port: WithdrawalPort) {
  async function verified(signal?: AbortSignal) {
    const head = await port.block()
    const [chain, code, tokenCode, token, decimals] = await Promise.all([
      port.chainId(),
      port.bytecode(config.payrollAddress, head.number),
      port.bytecode(config.tokenAddress, head.number),
      port.token(head.number),
      port.decimals(head.number),
    ])
    checkAbort(signal)
    if (
      chain !== config.chainId ||
      head.number < config.deploymentBlock ||
      !code ||
      code === '0x' ||
      !tokenCode ||
      tokenCode === '0x' ||
      !equal(token, config.tokenAddress) ||
      decimals !== config.tokenDecimals
    )
      throw new WithdrawalError('DEPLOYMENT_MISMATCH')
    return head
  }
  return {
    submissionBlock: async () => (await port.block()).number,
    async submissionNonce(worker: Address) {
      await verified()
      if (!port.transactionCount) throw new WithdrawalError('RECOVERY_UNVERIFIED')
      return port.transactionCount(worker, 'pending')
    },
    async canAbandon(worker: Address, nonce: bigint, afterBlock: bigint) {
      const head = await verified()
      if (!port.transactionCount || head.number < afterBlock + BigInt(2)) return false
      const [latest, pending] = await Promise.all([
        port.transactionCount(worker, 'latest'),
        port.transactionCount(worker, 'pending'),
      ])
      return latest === nonce && pending === nonce
    },
    async prepare(worker: Address, id: bigint, signal?: AbortSignal): Promise<WithdrawalRequest> {
      checkAbort(signal)
      if (!isAddress(worker) || id < BigInt(1)) throw new WithdrawalError('INVALID_REQUEST')
      const head = await verified(signal)
      const [stream, available] = await Promise.all([
        port.stream(id, head.number),
        port.withdrawable(id, head.number),
      ])
      checkAbort(signal)
      if (!equal(stream.worker, worker)) throw new WithdrawalError('NOT_WORKER')
      if (available <= BigInt(0)) throw new WithdrawalError('NOTHING_TO_WITHDRAW')
      let funded = false,
        balance = await port.nativeBalance(worker)
      const fund = async () => {
        checkAbort(signal)
        await port.fundGas(worker, signal)
        funded = true
        checkAbort(signal)
        balance = await port.nativeBalance(worker)
      }
      if (balance === BigInt(0)) await fund()
      if (balance === BigInt(0)) throw new WithdrawalError('GAS_INSUFFICIENT')
      const estimate = async () => {
        await port.simulate(worker, id)
        checkAbort(signal)
        return port.gasCost(worker, id)
      }
      let cost: bigint
      try {
        cost = await estimate()
      } catch (error) {
        let value = error as { name?: string; shortMessage?: string; cause?: unknown } | null
        let insufficient = false
        for (let n = 0; value && n < 10; n++, value = value.cause as typeof value)
          if (
            value.name === 'InsufficientFundsError' ||
            /insufficient funds for gas/i.test(value.shortMessage ?? '')
          )
            insufficient = true
        if (!insufficient || funded) throw error
        await fund()
        cost = await estimate()
      }
      if (balance < cost && !funded) {
        await fund()
        await port.simulate(worker, id)
        cost = await port.gasCost(worker, id)
      }
      checkAbort(signal)
      if (balance < cost) throw new WithdrawalError('GAS_INSUFFICIENT')
      return {
        from: worker,
        to: config.payrollAddress,
        data: withdrawalData(id),
        chainId: config.chainId,
        value: BigInt(0),
      }
    },
    async settle(
      worker: Address,
      id: bigint,
      hash: Hex,
      afterBlock?: bigint,
    ): Promise<WithdrawalResult> {
      await verified()
      const receipt = await port.receipt(hash)
      if (afterBlock !== undefined && receipt.blockNumber <= afterBlock)
        throw new WithdrawalError('TRANSACTION_MISMATCH')
      const tx = await port.transaction(receipt.transactionHash)
      if (
        !equal(tx.from, worker) ||
        !tx.to ||
        !equal(tx.to, config.payrollAddress) ||
        !equal(tx.input, withdrawalData(id)) ||
        tx.value !== BigInt(0)
      )
        throw new WithdrawalError(receipt.replacement ? 'REPLACED' : 'TRANSACTION_MISMATCH')
      if (receipt.status === 'reverted') throw new WithdrawalError('REVERTED')
      const events = []
      for (const log of receipt.logs) {
        if (!equal(log.address, config.payrollAddress)) continue
        try {
          const decoded = decodeEventLog({
            abi: [withdrawnEvent],
            data: log.data,
            topics: log.topics as [Hex, ...Hex[]],
            strict: true,
          })
          if (decoded.args.streamId === id && equal(decoded.args.worker, worker))
            events.push(decoded.args)
        } catch {
          /* Other events are not withdrawal settlement. */
        }
      }
      const settlement = events[0]
      if (
        events.length !== 1 ||
        !settlement ||
        settlement.toWorker + settlement.toRecipient <= BigInt(0)
      )
        throw new WithdrawalError('RECEIPT_UNVERIFIED')
      return {
        hash: receipt.transactionHash,
        streamId: id,
        toWorker: settlement.toWorker,
        recipient: settlement.recipient,
        toRecipient: settlement.toRecipient,
      }
    },
  }
}
