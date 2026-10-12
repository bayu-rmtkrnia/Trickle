import { createPublicClient, erc20Abi, http, parseAbiItem, type Abi, type Address } from 'viem'
import abi from '../../../../packages/shared/abi/TricklePayroll.json'
import { payrollChain, payrollConfig as config } from './config'
import { createPayrollReader, type ChainPort } from './payroll-reader'
import { ChainReadError } from './types'

const payrollAbi = abi as Abi
const creationEvent = parseAbiItem(
  'event StreamCreated(uint256 indexed streamId, address indexed employer, address indexed worker, uint128 amount, uint40 start, uint40 end)',
)
export function createViemPort(signal?: AbortSignal): ChainPort {
  const client = createPublicClient({
    chain: payrollChain,
    transport: http(config.rpcUrl, { timeout: 10000, retryCount: 0, fetchOptions: { signal } }),
  })
  const payroll = <T>(functionName: string, args: readonly unknown[], blockNumber: bigint) =>
    client.readContract({
      address: config.payrollAddress,
      abi: payrollAbi,
      functionName,
      args,
      blockNumber,
    }) as Promise<T>
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
    token: (block) => payroll<Address>('token', [], block),
    nextStreamId: (block) => payroll<bigint>('nextStreamId', [], block),
    decimals: (blockNumber) =>
      client.readContract({
        address: config.tokenAddress,
        abi: erc20Abi,
        functionName: 'decimals',
        blockNumber,
      }),
    symbol: (blockNumber) =>
      client.readContract({
        address: config.tokenAddress,
        abi: erc20Abi,
        functionName: 'symbol',
        blockNumber,
      }),
    logs: async (worker, fromBlock, toBlock) => {
      const logs = await client.getLogs({
        address: config.payrollAddress,
        event: creationEvent,
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
    stream: async (id, block) => {
      const stream = await payroll<{
        employer: Address
        worker: Address
        start: number
        end: number
        canceled: boolean
        amount: bigint
        withdrawn: bigint
        refunded: bigint
      }>('getStream', [id], block)
      return { ...stream, id, start: BigInt(stream.start), end: BigInt(stream.end) }
    },
    withdrawable: (id, block) => payroll<bigint>('withdrawable', [id], block),
    split: async (worker, block) => {
      const [recipient, bps] = await payroll<readonly [Address, number]>('splitOf', [worker], block)
      return { recipient, bps }
    },
    balance: (address, blockNumber) =>
      client.readContract({
        address: config.tokenAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
        blockNumber,
      }),
  }
}
export const payrollReader = createPayrollReader(createViemPort)
