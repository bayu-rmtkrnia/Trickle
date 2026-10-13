import { createPublicClient, erc20Abi, http, type Address } from 'viem'
import { tricklePayrollAbi } from '../../../../packages/shared/abi/TricklePayroll'
import { payrollChain, payrollConfig as config } from './config'
import { createPayrollReader, type ChainPort } from './payroll-reader'
import { ChainReadError } from './types'

export function createViemPort(signal?: AbortSignal): ChainPort {
  const client = createPublicClient({
    chain: payrollChain,
    transport: http(config.rpcUrl, { timeout: 10000, retryCount: 0, fetchOptions: { signal } }),
  })
  const payroll = { address: config.payrollAddress, abi: tricklePayrollAbi } as const
  const token = { address: config.tokenAddress, abi: erc20Abi } as const
  return {
    chainId: () => client.getChainId(),
    bytecode: (address, blockNumber) => client.getBytecode({ address, blockNumber }),
    block: async (number) => {
      const block = await client.getBlock(
        number === undefined ? { blockTag: 'latest' } : { blockNumber: number },
      )
      if (block.number === null || block.hash === null) throw new ChainReadError('CHAIN_CHANGED')
      return { number: block.number, timestamp: block.timestamp, hash: block.hash }
    },
    token: (blockNumber) => client.readContract({ ...payroll, functionName: 'token', blockNumber }),
    nextStreamId: (blockNumber) =>
      client.readContract({ ...payroll, functionName: 'nextStreamId', blockNumber }),
    decimals: (blockNumber) =>
      client.readContract({ ...token, functionName: 'decimals', blockNumber }),
    symbol: (blockNumber) => client.readContract({ ...token, functionName: 'symbol', blockNumber }),
    logs: async (worker, fromBlock, toBlock) => {
      const logs = await client.getContractEvents({
        ...payroll,
        eventName: 'StreamCreated',
        args: { worker },
        strict: true,
        fromBlock,
        toBlock,
      })
      return logs
        .filter(
          (log) =>
            !log.removed &&
            log.blockNumber !== null &&
            log.blockHash !== null &&
            log.transactionHash !== null &&
            log.logIndex !== null,
        )
        .map((log) => ({
          streamId: log.args.streamId,
          worker: log.args.worker,
          blockNumber: log.blockNumber!,
          blockHash: log.blockHash!,
          transactionHash: log.transactionHash!,
          logIndex: log.logIndex!,
        }))
    },
    stream: async (id, blockNumber) => {
      const stream = await client.readContract({
        ...payroll,
        functionName: 'getStream',
        args: [id],
        blockNumber,
      })
      return { ...stream, id, start: BigInt(stream.start), end: BigInt(stream.end) }
    },
    withdrawable: (id, blockNumber) =>
      client.readContract({ ...payroll, functionName: 'withdrawable', args: [id], blockNumber }),
    splits: async (worker, blockNumber) =>
      (
        await client.readContract({
          ...payroll,
          functionName: 'splitsOf',
          args: [worker],
          blockNumber,
        })
      ).map(({ recipient, bps }) => ({ recipient, bps })),
    balance: (address: Address, blockNumber) =>
      client.readContract({ ...token, functionName: 'balanceOf', args: [address], blockNumber }),
  }
}
export const payrollReader = createPayrollReader(createViemPort)
