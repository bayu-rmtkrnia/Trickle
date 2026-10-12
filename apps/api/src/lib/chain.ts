import {
  createPublicClient,
  createWalletClient,
  defineChain,
  formatEther,
  http,
  type Address,
  type Hash,
  type PublicClient,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { monadTestnet } from 'viem/chains'
import type { Env } from '../env.js'

/** Server-side chain access. Only the gas treasury key lives here (PLAN §4.2). */
export interface Chain {
  /** `undefined` when no treasury key is configured. */
  treasuryAddress: Address | undefined
  getBalance(address: Address): Promise<bigint>
  sendNative(to: Address, value: bigint): Promise<Hash>
}

export const toViemChain = (env: Pick<Env, 'CHAIN_ID' | 'RPC_URL'>) =>
  env.CHAIN_ID === monadTestnet.id
    ? monadTestnet
    : defineChain({
        ...monadTestnet,
        id: env.CHAIN_ID,
        name: `Chain ${env.CHAIN_ID}`,
        rpcUrls: { default: { http: [env.RPC_URL] } },
      })

/** Read-only RPC client, e.g. for contract view calls. */
export function createReadClient(env: Pick<Env, 'CHAIN_ID' | 'RPC_URL'>): PublicClient {
  return createPublicClient({ chain: toViemChain(env), transport: http(env.RPC_URL) })
}

export function createChain(env: Env): Chain {
  const chain = toViemChain(env)
  const transport = http(env.RPC_URL)
  const publicClient = createPublicClient({ chain, transport })
  const account = env.GAS_TREASURY_PRIVATE_KEY
    ? privateKeyToAccount(env.GAS_TREASURY_PRIVATE_KEY as `0x${string}`)
    : undefined
  const wallet = account ? createWalletClient({ account, chain, transport }) : undefined

  return {
    treasuryAddress: account?.address,
    getBalance: (address) => publicClient.getBalance({ address }),
    sendNative: async (to, value) => {
      if (!wallet) throw new Error('Gas treasury is not configured')
      return wallet.sendTransaction({ to, value })
    },
  }
}

export { formatEther }
