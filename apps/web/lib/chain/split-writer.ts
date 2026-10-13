import {
  createPublicClient,
  decodeEventLog,
  encodeFunctionData,
  http,
  isAddress,
  type Address,
  type Hex,
} from 'viem'
import { tricklePayrollAbi } from '../../../../packages/shared/abi/TricklePayroll'
import type { GasDrip } from '@/lib/api/gas'
import { payrollChain, payrollConfig as config } from './config'
import { confirmGasFunding } from './gas-funding'
import type { ChainPort } from './payroll-reader'
import { WithdrawalError, type WithdrawalReceipt, type WithdrawalRequest } from './payroll-writer'
import { validateSplits, type Split } from './split'
import { createViemPort } from './viem-port'

export interface SplitPort extends Pick<
  ChainPort,
  'chainId' | 'bytecode' | 'block' | 'token' | 'decimals'
> {
  nativeBalance(worker: Address): Promise<bigint>
  simulateSetSplits(worker: Address, splits: readonly Split[]): Promise<void>
  setSplitsGasCost(worker: Address, splits: readonly Split[]): Promise<bigint>
  fundGas(worker: Address, signal?: AbortSignal): Promise<void>
  receipt(hash: Hex): Promise<WithdrawalReceipt>
  transaction(hash: Hex): Promise<{ from: Address; to: Address | null; input: Hex; value: bigint }>
}

const equal = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
const checkAbort = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
}
const args = (splits: readonly Split[]) =>
  [splits.map(({ recipient, bps }) => ({ recipient, bps }))] as const
export const setSplitsData = (splits: readonly Split[]) =>
  encodeFunctionData({ abi: tricklePayrollAbi, functionName: 'setSplits', args: args(splits) })

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

/** `setSplits` for the signed-in worker. An empty list turns the split off. */
export function createSplitWriter(port: SplitPort) {
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
  }
  return {
    async prepare(
      worker: Address,
      splits: readonly Split[],
      signal?: AbortSignal,
    ): Promise<WithdrawalRequest> {
      checkAbort(signal)
      if (!isAddress(worker)) throw new WithdrawalError('INVALID_REQUEST')
      if (validateSplits(splits) !== null) throw new WithdrawalError('INVALID_SPLIT')
      if (splits.some(({ recipient }) => equal(recipient, worker)))
        throw new WithdrawalError('INVALID_SPLIT')
      await verified(signal)
      let funded = false
      let balance = await port.nativeBalance(worker)
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
        await port.simulateSetSplits(worker, splits)
        checkAbort(signal)
        return port.setSplitsGasCost(worker, splits)
      }
      let cost: bigint
      try {
        cost = await estimate()
      } catch (error) {
        if (!insufficientGas(error) || funded) throw error
        await fund()
        cost = await estimate()
      }
      if (balance < cost && !funded) {
        await fund()
        cost = await estimate()
      }
      checkAbort(signal)
      if (balance < cost) throw new WithdrawalError('GAS_INSUFFICIENT')
      return {
        from: worker,
        to: config.payrollAddress,
        data: setSplitsData(splits),
        chainId: config.chainId,
        value: BigInt(0),
      }
    },
    /** Proves the receipt set exactly `splits` for `worker`. */
    async settle(worker: Address, splits: readonly Split[], hash: Hex) {
      await verified()
      const receipt = await port.receipt(hash)
      const tx = await port.transaction(receipt.transactionHash)
      if (
        !equal(tx.from, worker) ||
        !tx.to ||
        !equal(tx.to, config.payrollAddress) ||
        !equal(tx.input, setSplitsData(splits)) ||
        tx.value !== BigInt(0)
      )
        throw new WithdrawalError(receipt.replacement ? 'REPLACED' : 'TRANSACTION_MISMATCH')
      if (receipt.status === 'reverted') throw new WithdrawalError('REVERTED')
      const updated = receipt.logs.filter((log) => {
        if (!equal(log.address, config.payrollAddress)) return false
        try {
          const event = decodeEventLog({
            abi: tricklePayrollAbi,
            data: log.data,
            topics: log.topics as [Hex, ...Hex[]],
            strict: true,
          })
          return (
            event.eventName === 'SplitUpdated' &&
            equal(event.args.worker, worker) &&
            event.args.splits.length === splits.length &&
            event.args.splits.every(
              (item, index) =>
                equal(item.recipient, splits[index]!.recipient) && item.bps === splits[index]!.bps,
            )
          )
        } catch {
          return false
        }
      })
      if (updated.length !== 1) throw new WithdrawalError('RECEIPT_UNVERIFIED')
      return { hash: receipt.transactionHash, splits }
    },
  }
}
export type SplitWriter = ReturnType<typeof createSplitWriter>

export function createSplitPort(
  requestGas: (worker: Address, signal?: AbortSignal) => Promise<GasDrip>,
  signal?: AbortSignal,
): SplitPort {
  const client = createPublicClient({
    chain: payrollChain,
    transport: http(config.rpcUrl, { timeout: 10000, retryCount: 0, fetchOptions: { signal } }),
  })
  const call = (worker: Address, splits: readonly Split[]) =>
    ({
      address: config.payrollAddress,
      abi: tricklePayrollAbi,
      functionName: 'setSplits',
      args: args(splits),
      account: worker,
    }) as const
  const reader = createViemPort(signal)
  return {
    chainId: reader.chainId,
    bytecode: reader.bytecode,
    block: reader.block,
    token: reader.token,
    decimals: reader.decimals,
    nativeBalance: (worker) => client.getBalance({ address: worker }),
    simulateSetSplits: async (worker, splits) => {
      await client.simulateContract(call(worker, splits))
    },
    setSplitsGasCost: async (worker, splits) => {
      const [gas, fees] = await Promise.all([
        client.estimateContractGas(call(worker, splits)),
        client.estimateFeesPerGas(),
      ])
      const price = fees.maxFeePerGas ?? (await client.getGasPrice())
      return (gas * price * BigInt(120) + BigInt(99)) / BigInt(100)
    },
    fundGas: async (worker, abortSignal) => {
      await confirmGasFunding(
        () => requestGas(worker, abortSignal),
        async (hash) =>
          (await client.waitForTransactionReceipt({ hash, confirmations: 2, timeout: 60000 }))
            .status,
        { signal: abortSignal },
      )
    },
    receipt: async (hash) => {
      let replacement: WithdrawalReceipt['replacement']
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
