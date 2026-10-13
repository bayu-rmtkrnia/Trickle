import {
  createPublicClient,
  decodeEventLog,
  encodeFunctionData,
  http,
  isAddress,
  type Address,
  type Hex,
} from 'viem'
import { mockAusdAbi } from '../../../../packages/shared/abi/MockAUSD'
import { tricklePayrollAbi } from '../../../../packages/shared/abi/TricklePayroll'
import type { GasDrip } from '@/lib/api/gas'
import { payrollChain, payrollConfig as config } from './config'
import { confirmGasFunding } from './gas-funding'
import type { ChainPort } from './payroll-reader'
import { WithdrawalError, type WithdrawalReceipt, type WithdrawalRequest } from './payroll-writer'
import { createViemPort } from './viem-port'

/**
 * Transaksi perusahaan ke TricklePayroll (PLAN §3.1 "danai gaji satu periode"):
 * mint mAUSD uji bila saldo kurang, `approve`, lalu `createStream`; dan `cancel`.
 * Mengikuti pola split-writer: tiap transaksi disimulasikan dan diperiksa biaya gasnya
 * (gas drip bila perlu), lalu hasilnya diverifikasi dari receipt.
 */

export type FundingCall =
  | { kind: 'mint'; employer: Address; units: bigint }
  | { kind: 'approve'; employer: Address; units: bigint }
  | {
      kind: 'create'
      employer: Address
      worker: Address
      units: bigint
      start: number
      end: number
    }
  | { kind: 'cancel'; employer: Address; streamId: bigint }

export interface FundingPort extends Pick<ChainPort, 'chainId' | 'bytecode' | 'block' | 'token'> {
  nativeBalance(account: Address): Promise<bigint>
  tokenBalance(account: Address): Promise<bigint>
  allowance(owner: Address): Promise<bigint>
  simulate(call: FundingCall): Promise<void>
  gasCost(call: FundingCall): Promise<bigint>
  fundGas(account: Address, signal?: AbortSignal): Promise<void>
  receipt(hash: Hex): Promise<WithdrawalReceipt>
  transaction(hash: Hex): Promise<{ from: Address; to: Address | null; input: Hex; value: bigint }>
}

const ZERO = BigInt(0)
const equal = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
const checkAbort = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
}

/** Alamat tujuan dan calldata untuk satu panggilan kontrak. */
export function encodeCall(call: FundingCall): { to: Address; data: Hex } {
  switch (call.kind) {
    case 'mint':
      return {
        to: config.tokenAddress,
        data: encodeFunctionData({
          abi: mockAusdAbi,
          functionName: 'mint',
          args: [call.employer, call.units],
        }),
      }
    case 'approve':
      return {
        to: config.tokenAddress,
        data: encodeFunctionData({
          abi: mockAusdAbi,
          functionName: 'approve',
          args: [config.payrollAddress, call.units],
        }),
      }
    case 'create':
      return {
        to: config.payrollAddress,
        data: encodeFunctionData({
          abi: tricklePayrollAbi,
          functionName: 'createStream',
          args: [call.worker, call.units, call.start, call.end],
        }),
      }
    case 'cancel':
      return {
        to: config.payrollAddress,
        data: encodeFunctionData({
          abi: tricklePayrollAbi,
          functionName: 'cancel',
          args: [call.streamId],
        }),
      }
  }
}

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

export function createStreamFunder(port: FundingPort) {
  let gasFunded = false

  /** Pastikan kontrak dan token yang dipakai sesuai deployment di packages/shared. */
  async function verify(signal?: AbortSignal) {
    const head = await port.block()
    const [chain, code, tokenCode, token] = await Promise.all([
      port.chainId(),
      port.bytecode(config.payrollAddress, head.number),
      port.bytecode(config.tokenAddress, head.number),
      port.token(head.number),
    ])
    checkAbort(signal)
    if (
      chain !== config.chainId ||
      !code ||
      code === '0x' ||
      !tokenCode ||
      tokenCode === '0x' ||
      !equal(token, config.tokenAddress)
    )
      throw new WithdrawalError('DEPLOYMENT_MISMATCH')
  }

  /** Simulasi + cek gas (minta gas drip sekali bila kurang), lalu susun request transaksi. */
  async function prepare(call: FundingCall, signal?: AbortSignal): Promise<WithdrawalRequest> {
    checkAbort(signal)
    let balance = await port.nativeBalance(call.employer)
    const fund = async () => {
      checkAbort(signal)
      await port.fundGas(call.employer, signal)
      gasFunded = true
      checkAbort(signal)
      balance = await port.nativeBalance(call.employer)
    }
    if (balance === ZERO && !gasFunded) await fund()
    if (balance === ZERO) throw new WithdrawalError('GAS_INSUFFICIENT')
    const estimate = async () => {
      await port.simulate(call)
      checkAbort(signal)
      return port.gasCost(call)
    }
    let cost: bigint
    try {
      cost = await estimate()
    } catch (error) {
      if (!insufficientGas(error) || gasFunded) throw error
      await fund()
      cost = await estimate()
    }
    if (balance < cost && !gasFunded) {
      await fund()
      cost = await estimate()
    }
    if (balance < cost) throw new WithdrawalError('GAS_INSUFFICIENT')
    const { to, data } = encodeCall(call)
    return { from: call.employer, to, data, chainId: config.chainId, value: ZERO }
  }

  /** Receipt harus milik transaksi yang kita susun, dan berhasil. */
  async function confirm(call: FundingCall, hash: Hex): Promise<WithdrawalReceipt> {
    const receipt = await port.receipt(hash)
    const tx = await port.transaction(receipt.transactionHash)
    const { to, data } = encodeCall(call)
    if (
      !equal(tx.from, call.employer) ||
      !tx.to ||
      !equal(tx.to, to) ||
      !equal(tx.input, data) ||
      tx.value !== ZERO
    )
      throw new WithdrawalError(receipt.replacement ? 'REPLACED' : 'TRANSACTION_MISMATCH')
    if (receipt.status === 'reverted') throw new WithdrawalError('REVERTED')
    return receipt
  }

  function payrollEvent(receipt: WithdrawalReceipt, name: 'StreamCreated' | 'StreamCanceled') {
    for (const log of receipt.logs) {
      if (!equal(log.address, config.payrollAddress)) continue
      try {
        const event = decodeEventLog({
          abi: tricklePayrollAbi,
          data: log.data,
          topics: log.topics as [Hex, ...Hex[]],
          strict: true,
        })
        if (event.eventName === name) return event
      } catch {
        // Log lain di transaksi yang sama.
      }
    }
    return null
  }

  return {
    verify,
    prepare,
    tokenBalance: (account: Address) => port.tokenBalance(account),
    allowance: (owner: Address) => port.allowance(owner),
    /** Mint dan approve cukup berhasil. */
    confirm,
    /** `createStream` berhasil: kembalikan id stream dari event `StreamCreated`. */
    async confirmCreate(call: Extract<FundingCall, { kind: 'create' }>, hash: Hex) {
      const receipt = await confirm(call, hash)
      const event = payrollEvent(receipt, 'StreamCreated')
      if (
        !event ||
        event.eventName !== 'StreamCreated' ||
        !equal(event.args.employer, call.employer) ||
        !equal(event.args.worker, call.worker) ||
        event.args.amount !== call.units
      )
        throw new WithdrawalError('RECEIPT_UNVERIFIED')
      return { hash: receipt.transactionHash, streamId: event.args.streamId }
    },
    /** `cancel` berhasil: kembalikan jumlah yang dikembalikan ke perusahaan. */
    async confirmCancel(call: Extract<FundingCall, { kind: 'cancel' }>, hash: Hex) {
      const receipt = await confirm(call, hash)
      const event = payrollEvent(receipt, 'StreamCanceled')
      if (!event || event.eventName !== 'StreamCanceled' || event.args.streamId !== call.streamId)
        throw new WithdrawalError('RECEIPT_UNVERIFIED')
      return { hash: receipt.transactionHash, refunded: event.args.refunded }
    },
  }
}
export type StreamFunder = ReturnType<typeof createStreamFunder>

/** Port sungguhan ke Monad testnet lewat viem. Gas drip lewat backend (`POST /gas-drips`). */
export function createFundingPort(
  requestGas: (account: Address, signal?: AbortSignal) => Promise<GasDrip>,
  signal?: AbortSignal,
): FundingPort {
  const client = createPublicClient({
    chain: payrollChain,
    transport: http(config.rpcUrl, { timeout: 10000, retryCount: 0, fetchOptions: { signal } }),
  })
  const reader = createViemPort(signal)
  const contractCall = (call: FundingCall) => {
    switch (call.kind) {
      case 'mint':
        return {
          address: config.tokenAddress,
          abi: mockAusdAbi,
          functionName: 'mint',
          args: [call.employer, call.units],
          account: call.employer,
        } as const
      case 'approve':
        return {
          address: config.tokenAddress,
          abi: mockAusdAbi,
          functionName: 'approve',
          args: [config.payrollAddress, call.units],
          account: call.employer,
        } as const
      case 'create':
        return {
          address: config.payrollAddress,
          abi: tricklePayrollAbi,
          functionName: 'createStream',
          args: [call.worker, call.units, call.start, call.end],
          account: call.employer,
        } as const
      case 'cancel':
        return {
          address: config.payrollAddress,
          abi: tricklePayrollAbi,
          functionName: 'cancel',
          args: [call.streamId],
          account: call.employer,
        } as const
    }
  }
  return {
    chainId: reader.chainId,
    bytecode: reader.bytecode,
    block: reader.block,
    token: reader.token,
    nativeBalance: (account) => client.getBalance({ address: account }),
    tokenBalance: (account) =>
      client.readContract({
        address: config.tokenAddress,
        abi: mockAusdAbi,
        functionName: 'balanceOf',
        args: [account],
      }),
    allowance: (owner) =>
      client.readContract({
        address: config.tokenAddress,
        abi: mockAusdAbi,
        functionName: 'allowance',
        args: [owner, config.payrollAddress],
      }),
    simulate: async (call) => {
      await client.simulateContract(
        contractCall(call) as Parameters<typeof client.simulateContract>[0],
      )
    },
    gasCost: async (call) => {
      const [gas, fees] = await Promise.all([
        client.estimateContractGas(
          contractCall(call) as Parameters<typeof client.estimateContractGas>[0],
        ),
        client.estimateFeesPerGas(),
      ])
      const price = fees.maxFeePerGas ?? (await client.getGasPrice())
      return (gas * price * BigInt(120) + BigInt(99)) / BigInt(100)
    },
    fundGas: async (account, abortSignal) => {
      await confirmGasFunding(
        () => requestGas(account, abortSignal),
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

export const isValidAddress = (value: string): value is Address => isAddress(value)
