import {
  createPublicClient,
  createWalletClient,
  http,
  maxUint256,
  parseAbi,
  parseEventLogs,
  type Address,
  type Hash,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import type { Env } from '../env.js'
import { toViemChain } from './chain.js'

/** A stream the demo employer just created on-chain. */
export interface DemoStreamTx {
  streamId: bigint
  txHash: Hash
  /** Unix seconds, as stored by the contract */
  start: number
  end: number
}

/**
 * The demo employer used by judge mode (PLAN §3.1 step 5). Its key is the
 * only other server key besides the gas treasury, testnet only (PLAN §4.2).
 * Tests swap in a fake through `buildApp({ demo })`.
 */
export interface DemoSigner {
  /** `undefined` when judge mode is not configured. */
  employerAddress: Address | undefined
  /** MON left to pay gas, for monitoring. */
  getGasBalance(): Promise<bigint>
  createStream(worker: Address, amount: bigint, durationSeconds: number): Promise<DemoStreamTx>
}

const payrollAbi = parseAbi([
  'function token() view returns (address)',
  'function createStream(address worker, uint128 amount, uint40 start, uint40 end) returns (uint256 streamId)',
  'event StreamCreated(uint256 indexed streamId, address indexed employer, address indexed worker, uint128 amount, uint40 start, uint40 end)',
])

const tokenAbi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  // MockAUSD only: open mint, no value (packages/shared/deployments/testnet.json).
  'function mint(address to, uint256 amount)',
])

/** How many demo streams one top-up mint covers. */
const TOP_UP_STREAMS = 100n

/**
 * Real signer on the configured chain. Every call runs one at a time, because
 * the transactions share the employer's nonce. The employer tops itself up
 * from the mock token's open mint when it runs low, so judge mode keeps
 * working during judging without manual funding; only MON for gas needs watching.
 */
export function createDemoSigner(env: Env): DemoSigner {
  const key = env.DEMO_EMPLOYER_PRIVATE_KEY
  const payroll = env.PAYROLL_ADDRESS as Address | undefined
  if (!key || !payroll) {
    return {
      employerAddress: undefined,
      getGasBalance: async () => 0n,
      createStream: async () => {
        throw new Error('Judge mode is not configured')
      },
    }
  }

  const chain = toViemChain(env)
  const transport = http(env.RPC_URL)
  const account = privateKeyToAccount(key as `0x${string}`)
  const client = createPublicClient({ chain, transport })
  const wallet = createWalletClient({ account, chain, transport })
  const me = account.address

  async function send(request: Parameters<typeof wallet.writeContract>[0]) {
    const hash = await wallet.writeContract(request)
    const receipt = await client.waitForTransactionReceipt({ hash })
    if (receipt.status !== 'success') throw new Error(`Transaction ${hash} reverted`)
    return receipt
  }

  let token: Address | undefined
  async function fund(amount: bigint) {
    token ??= await client.readContract({
      address: payroll!,
      abi: payrollAbi,
      functionName: 'token',
    })
    const t = token
    const balance = await client.readContract({
      address: t,
      abi: tokenAbi,
      functionName: 'balanceOf',
      args: [me],
    })
    if (balance < amount) {
      await send({
        address: t,
        abi: tokenAbi,
        functionName: 'mint',
        args: [me, amount * TOP_UP_STREAMS],
        account,
        chain,
      })
    }
    const allowance = await client.readContract({
      address: t,
      abi: tokenAbi,
      functionName: 'allowance',
      args: [me, payroll!],
    })
    if (allowance < amount) {
      await send({
        address: t,
        abi: tokenAbi,
        functionName: 'approve',
        args: [payroll!, maxUint256],
        account,
        chain,
      })
    }
  }

  let queue: Promise<unknown> = Promise.resolve()
  const oneAtATime = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task)
    queue = run.catch(() => undefined)
    return run
  }

  return {
    employerAddress: me,
    getGasBalance: () => client.getBalance({ address: me }),
    createStream: (worker, amount, durationSeconds) =>
      oneAtATime(async () => {
        await fund(amount)
        const end = BigInt(Math.floor(Date.now() / 1000) + durationSeconds)
        // start = 0 means "now" in the contract.
        const receipt = await send({
          address: payroll,
          abi: payrollAbi,
          functionName: 'createStream',
          args: [worker, amount, 0, Number(end)],
          account,
          chain,
        })
        const [created] = parseEventLogs({
          abi: payrollAbi,
          eventName: 'StreamCreated',
          logs: receipt.logs,
        })
        if (!created) throw new Error(`No StreamCreated event in ${receipt.transactionHash}`)
        return {
          streamId: created.args.streamId,
          txHash: receipt.transactionHash,
          start: created.args.start,
          end: created.args.end,
        }
      }),
  }
}
