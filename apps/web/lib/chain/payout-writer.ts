import {
  createPublicClient,
  decodeEventLog,
  encodeFunctionData,
  erc20Abi,
  http,
  isAddress,
  type Address,
  type Hex,
} from 'viem'
import type { GasDrip } from '@/lib/api/gas'
import { payrollChain, payrollConfig, type PayrollConfig } from './config'
import { confirmGasFunding } from './gas-funding'
import type { ChainPort } from './payroll-reader'
import type { WithdrawalRequest } from './payroll-writer'
import { createViemPort } from './viem-port'

export class PayoutError extends Error {
  constructor(public readonly code: string) {
    super(code)
    this.name = 'PayoutError'
  }
}

export interface PayoutReceipt {
  transactionHash: Hex
  blockNumber: bigint
  replacement?: 'repriced' | 'replaced' | 'cancelled'
  status: 'success' | 'reverted'
  logs: { address: Address; data: Hex; topics: readonly Hex[] }[]
}
export interface PayoutPort extends Pick<
  ChainPort,
  'chainId' | 'bytecode' | 'block' | 'token' | 'decimals' | 'balance'
> {
  transactionCount(wallet: Address, tag: 'latest' | 'pending'): Promise<bigint>
  nativeBalance(wallet: Address): Promise<bigint>
  simulateTransfer(wallet: Address, to: Address, amount: bigint): Promise<void>
  transferGasCost(wallet: Address, to: Address, amount: bigint): Promise<bigint>
  fundGas(wallet: Address, signal?: AbortSignal): Promise<void>
  receipt(hash: Hex): Promise<PayoutReceipt>
  transaction(hash: Hex): Promise<{ from: Address; to: Address | null; input: Hex; value: bigint }>
}
export interface PayoutTransfer {
  hash: Hex
  amount: bigint
  blockNumber: bigint
}

const equal = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
const checkAbort = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
}
export const transferData = (to: Address, amount: bigint) =>
  encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [to, amount] })

function insufficientGas(error: unknown) {
  let value = error as { name?: string; shortMessage?: string; cause?: unknown } | null
  for (let n = 0; value && n < 10; n++, value = value.cause as typeof value)
    if (
      value.name === 'InsufficientFundsError' ||
      /insufficient funds for gas/i.test(value.shortMessage ?? '')
    )
      return true
  return false
}

/**
 * Builds and verifies a mock AUSD `transfer(payoutAddress, amount)` from the
 * family wallet. The transaction goes to the token contract; the destination
 * is only an argument. Never retries a send.
 */
export function createPayoutWriter(port: PayoutPort, config: PayrollConfig = payrollConfig) {
  async function verified(signal?: AbortSignal) {
    const head = await port.block()
    const [chain, payrollCode, tokenCode, token, decimals] = await Promise.all([
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
      !payrollCode ||
      payrollCode === '0x' ||
      !tokenCode ||
      tokenCode === '0x' ||
      !equal(token, config.tokenAddress) ||
      decimals !== config.tokenDecimals
    )
      throw new PayoutError('DEPLOYMENT_MISMATCH')
    return head
  }
  function validate(wallet: Address, destination: Address, amount: bigint) {
    if (
      !isAddress(wallet) ||
      !isAddress(destination) ||
      equal(wallet, destination) ||
      amount <= BigInt(0)
    )
      throw new PayoutError('INVALID_REQUEST')
  }
  return {
    submissionBlock: async () => (await port.block()).number,
    async submissionNonce(wallet: Address) {
      await verified()
      return port.transactionCount(wallet, 'pending')
    },
    /** True only when no transaction with `nonce` was mined or is pending. */
    async canAbandon(wallet: Address, nonce: bigint, afterBlock: bigint) {
      const head = await verified()
      if (head.number < afterBlock + BigInt(2)) return false
      const [latest, pending] = await Promise.all([
        port.transactionCount(wallet, 'latest'),
        port.transactionCount(wallet, 'pending'),
      ])
      return latest === nonce && pending === nonce
    },
    async prepare(
      wallet: Address,
      destination: Address,
      amount: bigint,
      signal?: AbortSignal,
    ): Promise<WithdrawalRequest> {
      checkAbort(signal)
      validate(wallet, destination, amount)
      const head = await verified(signal)
      const balance = await port.balance(wallet, head.number)
      checkAbort(signal)
      if (balance < amount) throw new PayoutError('INSUFFICIENT_BALANCE')
      let funded = false
      let gas = await port.nativeBalance(wallet)
      const fund = async () => {
        checkAbort(signal)
        await port.fundGas(wallet, signal)
        funded = true
        checkAbort(signal)
        gas = await port.nativeBalance(wallet)
      }
      if (gas === BigInt(0)) await fund()
      if (gas === BigInt(0)) throw new PayoutError('GAS_INSUFFICIENT')
      const estimate = async () => {
        await port.simulateTransfer(wallet, destination, amount)
        checkAbort(signal)
        return port.transferGasCost(wallet, destination, amount)
      }
      let cost: bigint
      try {
        cost = await estimate()
      } catch (error) {
        if (!insufficientGas(error) || funded) throw error
        await fund()
        cost = await estimate()
      }
      if (gas < cost && !funded) {
        await fund()
        cost = await estimate()
      }
      checkAbort(signal)
      if (gas < cost) throw new PayoutError('GAS_INSUFFICIENT')
      return {
        from: wallet,
        to: config.tokenAddress,
        data: transferData(destination, amount),
        chainId: config.chainId,
        value: BigInt(0),
      }
    },
    /** Waits for the receipt and proves it is exactly the requested transfer. */
    async settle(
      wallet: Address,
      destination: Address,
      amount: bigint,
      hash: Hex,
      afterBlock?: bigint,
    ): Promise<PayoutTransfer> {
      await verified()
      const receipt = await port.receipt(hash)
      if (afterBlock !== undefined && receipt.blockNumber <= afterBlock)
        throw new PayoutError('TRANSACTION_MISMATCH')
      const tx = await port.transaction(receipt.transactionHash)
      if (
        !equal(tx.from, wallet) ||
        !tx.to ||
        !equal(tx.to, config.tokenAddress) ||
        !equal(tx.input, transferData(destination, amount)) ||
        tx.value !== BigInt(0)
      )
        throw new PayoutError(receipt.replacement ? 'REPLACED' : 'TRANSACTION_MISMATCH')
      if (receipt.status === 'reverted') throw new PayoutError('REVERTED')
      let matches = 0
      for (const log of receipt.logs) {
        if (!equal(log.address, config.tokenAddress)) continue
        try {
          const event = decodeEventLog({
            abi: erc20Abi,
            eventName: 'Transfer',
            data: log.data,
            topics: log.topics as [Hex, ...Hex[]],
            strict: true,
          })
          if (
            equal(event.args.from, wallet) &&
            equal(event.args.to, destination) &&
            event.args.value === amount
          )
            matches += 1
        } catch {
          /* Other token events (Approval, etc.) are not the transfer. */
        }
      }
      if (matches !== 1) throw new PayoutError('RECEIPT_UNVERIFIED')
      return { hash: receipt.transactionHash, amount, blockNumber: receipt.blockNumber }
    },
  }
}
export type PayoutWriter = ReturnType<typeof createPayoutWriter>

export function createPayoutPort(
  requestGas: (wallet: Address, signal?: AbortSignal) => Promise<GasDrip>,
  signal?: AbortSignal,
): PayoutPort {
  const client = createPublicClient({
    chain: payrollChain,
    transport: http(payrollConfig.rpcUrl, {
      timeout: 10000,
      retryCount: 0,
      fetchOptions: { signal },
    }),
  })
  const call = (wallet: Address, to: Address, amount: bigint) => ({
    address: payrollConfig.tokenAddress,
    abi: erc20Abi,
    functionName: 'transfer' as const,
    args: [to, amount] as const,
    account: wallet,
  })
  const reader = createViemPort(signal)
  return {
    chainId: reader.chainId,
    bytecode: reader.bytecode,
    block: reader.block,
    token: reader.token,
    decimals: reader.decimals,
    balance: reader.balance,
    transactionCount: async (wallet, tag) =>
      BigInt(await client.getTransactionCount({ address: wallet, blockTag: tag })),
    nativeBalance: (wallet) => client.getBalance({ address: wallet }),
    simulateTransfer: async (wallet, to, amount) => {
      await client.simulateContract(call(wallet, to, amount))
    },
    transferGasCost: async (wallet, to, amount) => {
      const [gas, fees] = await Promise.all([
        client.estimateContractGas(call(wallet, to, amount)),
        client.estimateFeesPerGas(),
      ])
      const price = fees.maxFeePerGas ?? (await client.getGasPrice())
      return (gas * price * BigInt(120) + BigInt(99)) / BigInt(100)
    },
    fundGas: async (wallet, abortSignal) => {
      await confirmGasFunding(
        () => requestGas(wallet, abortSignal),
        async (hash) =>
          (await client.waitForTransactionReceipt({ hash, confirmations: 2, timeout: 60000 }))
            .status,
        { signal: abortSignal },
      )
    },
    receipt: async (hash) => {
      let replacement: PayoutReceipt['replacement']
      const receipt = await client.waitForTransactionReceipt({
        hash,
        confirmations: 2,
        timeout: 120000,
        pollingInterval: 2000,
        onReplaced: ({ reason }) => {
          replacement = reason
        },
      })
      return {
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        replacement,
        status: receipt.status,
        logs: receipt.logs.map((log) => ({
          address: log.address,
          data: log.data,
          topics: log.topics,
        })),
      }
    },
    transaction: async (hash) => {
      const tx = await client.getTransaction({ hash })
      return { from: tx.from, to: tx.to, input: tx.input, value: tx.value }
    },
  }
}
