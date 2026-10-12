import { getAddress, isAddress, type Address, type Hex } from 'viem'
import { payrollConfig, type PayrollConfig } from './config'
import type { ChainPort } from './payroll-reader'
import { ChainReadError } from './types'
import { createViemPort } from './viem-port'

/** The subset of the payroll chain port needed to read a received balance. */
export type FamilyBalancePort = Pick<
  ChainPort,
  'chainId' | 'bytecode' | 'block' | 'token' | 'decimals' | 'symbol' | 'balance'
>

export interface FamilyBalanceSnapshot {
  /** `balanceOf(wallet)` in token base units. Only tokens already received. */
  balance: bigint
  blockNumber: bigint
  blockHash: Hex
  blockTimestamp: bigint
  tokenSymbol: string
}

function abort(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
}
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/**
 * Reads the family wallet token balance at one block, after verifying that the
 * chain, payroll contract and token match the deployment manifest. A worker's
 * stream or split estimate is never used: only received tokens count.
 */
export function createFamilyBalanceReader(
  factory: (signal?: AbortSignal) => FamilyBalancePort,
  config: PayrollConfig = payrollConfig,
) {
  return async function readFamilyBalance(
    wallet: string,
    signal?: AbortSignal,
  ): Promise<FamilyBalanceSnapshot> {
    abort(signal)
    if (!isAddress(wallet)) throw new ChainReadError('INVALID_WALLET')
    const address: Address = getAddress(wallet)
    const port = factory(signal)
    const head = await port.block()
    abort(signal)
    const chain = await port.chainId()
    abort(signal)
    if (chain !== config.chainId || head.number < config.deploymentBlock)
      throw new ChainReadError('DEPLOYMENT_MISMATCH')
    const [payrollCode, tokenCode, token, decimals, symbol, balance] = await Promise.all([
      port.bytecode(config.payrollAddress, head.number),
      port.bytecode(config.tokenAddress, head.number),
      port.token(head.number),
      port.decimals(head.number),
      port.symbol(head.number),
      port.balance(address, head.number),
    ])
    abort(signal)
    if (
      !payrollCode ||
      payrollCode === '0x' ||
      !tokenCode ||
      tokenCode === '0x' ||
      !same(token, config.tokenAddress) ||
      decimals !== config.tokenDecimals ||
      !symbol.trim()
    )
      throw new ChainReadError('DEPLOYMENT_MISMATCH')
    if (typeof balance !== 'bigint' || balance < BigInt(0))
      throw new ChainReadError('SNAPSHOT_MISMATCH')
    // Every read used head.number; confirm that block is still canonical.
    const current = await port.block(head.number)
    abort(signal)
    if (current.hash !== head.hash) throw new ChainReadError('CHAIN_CHANGED')
    return {
      balance,
      blockNumber: head.number,
      blockHash: head.hash as Hex,
      blockTimestamp: head.timestamp,
      tokenSymbol: symbol.trim(),
    }
  }
}

export const readFamilyBalance = createFamilyBalanceReader(createViemPort)
