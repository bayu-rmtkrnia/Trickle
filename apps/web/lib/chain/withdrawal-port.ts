import { createPublicClient, http, type Address, type Hex } from 'viem'
import { tricklePayrollAbi } from '../../../../packages/shared/abi/TricklePayroll'
import { payrollChain, payrollConfig as config } from './config'
import { createViemPort } from './viem-port'
import type { WithdrawalPort, WithdrawalReceipt } from './payroll-writer'
import type { GasDrip } from '@/lib/api/gas'
import { confirmGasFunding } from './gas-funding'
export function createWithdrawalPort(
  requestGas: (worker: Address, signal?: AbortSignal) => Promise<GasDrip>,
  signal?: AbortSignal,
): WithdrawalPort {
  const client = createPublicClient({
    chain: payrollChain,
    transport: http(config.rpcUrl, { timeout: 10000, retryCount: 0, fetchOptions: { signal } }),
  })
  const call = (worker: Address, id: bigint) =>
    ({
      address: config.payrollAddress,
      abi: tricklePayrollAbi,
      functionName: 'withdraw',
      args: [id],
      account: worker,
    }) as const
  return {
    ...createViemPort(signal),
    transactionCount: async (worker, tag) =>
      BigInt(await client.getTransactionCount({ address: worker, blockTag: tag })),
    nativeBalance: (address) => client.getBalance({ address }),
    simulate: async (worker, id) => {
      await client.simulateContract(call(worker, id))
    },
    gasCost: async (worker, id) => {
      const [gas, fees] = await Promise.all([
        client.estimateContractGas(call(worker, id)),
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
    receipt: async (hash: Hex) => {
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
      return {
        from: tx.from,
        to: tx.to,
        input: tx.input,
        value: tx.value,
        nonce: BigInt(tx.nonce),
      }
    },
  }
}
