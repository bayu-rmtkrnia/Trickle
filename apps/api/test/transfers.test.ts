import {
  encodeAbiParameters,
  pad,
  TransactionReceiptNotFoundError,
  toEventSelector,
  type Address,
  type Hash,
} from 'viem'
import { describe, expect, it } from 'vitest'
import { createTransferVerifier } from '../src/lib/transfers.js'

const payroll = '0x00000000000000000000000000000000000000a1' as Address
const token = '0x00000000000000000000000000000000000000b2' as Address
const otherToken = '0x00000000000000000000000000000000000000c3' as Address
const payout = '0x00000000000000000000000000000000000000d4' as Address
const ibu = '0x00000000000000000000000000000000000000e5' as Address
const stranger = '0x00000000000000000000000000000000000000f6' as Address
const hash = `0x${'11'.repeat(32)}` as Hash

const TRANSFER = toEventSelector('Transfer(address,address,uint256)')

const transferLog = (address: Address, from: Address, to: Address, value: bigint) => ({
  address,
  topics: [TRANSFER, pad(from), pad(to)],
  data: encodeAbiParameters([{ type: 'uint256' }], [value]),
  blockHash: `0x${'22'.repeat(32)}`,
  blockNumber: 1n,
  logIndex: 0,
  transactionHash: hash,
  transactionIndex: 0,
  removed: false,
})

function verifier(receipt: () => Promise<unknown>) {
  return createTransferVerifier({
    payroll,
    payoutAddress: payout,
    client: {
      readContract: (async () => token) as never,
      getTransactionReceipt: receipt as never,
    },
  })
}

describe('transfer verifier', () => {
  it('sums the payroll token sent from the recipient to the payout address', async () => {
    const v = verifier(async () => ({
      status: 'success',
      logs: [
        transferLog(token, ibu, payout, 30_000_000n),
        transferLog(token, ibu, payout, 20_000_000n),
        // Ignored: another token, another sender, another destination.
        transferLog(otherToken, ibu, payout, 999n),
        transferLog(token, stranger, payout, 999n),
        transferLog(token, ibu, stranger, 999n),
      ],
    }))
    await expect(v.check(hash, ibu)).resolves.toEqual({ status: 'ok', amount: 50_000_000n })
  })

  it('answers 0 for a transaction without such a transfer', async () => {
    const v = verifier(async () => ({ status: 'success', logs: [] }))
    await expect(v.check(hash, ibu)).resolves.toEqual({ status: 'ok', amount: 0n })
  })

  it('reports reverted and not-yet-mined transactions', async () => {
    await expect(
      verifier(async () => ({ status: 'reverted', logs: [] })).check(hash, ibu),
    ).resolves.toEqual({ status: 'reverted' })
    await expect(
      verifier(async () => {
        throw new TransactionReceiptNotFoundError({ hash })
      }).check(hash, ibu),
    ).resolves.toEqual({ status: 'pending' })
  })

  it('is off without a payout address', () => {
    const v = createTransferVerifier({
      payroll,
      client: {
        readContract: (async () => token) as never,
        getTransactionReceipt: (async () => ({})) as never,
      },
    })
    expect(v.payoutAddress).toBeUndefined()
  })
})
