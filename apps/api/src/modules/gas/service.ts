import type { FastifyBaseLogger } from 'fastify'
import { formatEther, parseEther } from 'viem'
import type { Env } from '../../env.js'
import type { GasDrip } from '../../generated/prisma/client.js'
import type { Chain } from '../../lib/chain.js'
import { AppError } from '../../lib/errors.js'
import type { GasRepository } from './repository.js'
import type { DripDto } from './schemas.js'

const DAY_MS = 24 * 60 * 60 * 1000
/** A refill waits this long after the last drip, so its MON can land before the balance is judged. */
export const REFILL_GAP_MS = 30 * 1000

/** Passed per call so log lines keep the request id. */
type Log = Pick<FastifyBaseLogger, 'error' | 'warn'>

interface Deps {
  repo: GasRepository
  chain: Chain
  env: Pick<
    Env,
    | 'GAS_DRIP_AMOUNT_MON'
    | 'GAS_DRIP_DAILY_LIMIT'
    | 'GAS_DRIP_IP_DAILY_LIMIT'
    | 'GAS_DRIP_REFILL_BELOW_MON'
    | 'GAS_DRIP_ADDRESS_DAILY_LIMIT'
  >
}

const toDto = (d: GasDrip, alreadyDripped: boolean): DripDto => ({
  address: d.address,
  status: d.status,
  amountMon: formatEther(BigInt(d.amountWei)),
  txHash: d.txHash,
  alreadyDripped,
  createdAt: d.createdAt.toISOString(),
})

export function createGasService({ repo, chain, env }: Deps) {
  const amountWei = parseEther(env.GAS_DRIP_AMOUNT_MON)
  const refillBelowWei = parseEther(env.GAS_DRIP_REFILL_BELOW_MON)
  const dayAgo = () => new Date(Date.now() - DAY_MS)
  const last24h = () => repo.countActiveSince(dayAgo())

  /**
   * A funded address gets another drip only once it has spent most of the last
   * one. In-flight or very recent drips, and unreadable balances, never refill.
   */
  async function runningLow(address: `0x${string}`, latest: GasDrip) {
    if (latest.status === 'PENDING') return false
    if (Date.now() - latest.updatedAt.getTime() < REFILL_GAP_MS) return false
    const balance = await chain.getBalance(address).catch(() => null)
    return balance !== null && balance < refillBelowWei
  }

  return {
    /**
     * `created` is false when the address is still funded by an earlier drip
     * (idempotent replay). An address that ran low gets a refill.
     */
    async drip(address: `0x${string}`, ip: string, log: Log) {
      const latest = await repo.findLatest(address)
      if (latest && latest.status !== 'FAILED' && !(await runningLow(address, latest))) {
        return { created: false, drip: toDto(latest, true) }
      }
      // A first drip, or a retry of a failed first drip; anything else is a refill.
      const first = latest === null || (latest.seq === 0 && latest.status === 'FAILED')

      if (!chain.treasuryAddress) {
        throw new AppError(503, 'DRIP_UNAVAILABLE', 'Gas sponsorship is not configured')
      }
      if ((await last24h()) >= env.GAS_DRIP_DAILY_LIMIT) {
        throw new AppError(429, 'DRIP_DAILY_LIMIT', 'Daily sponsorship limit reached, try tomorrow')
      }
      if (first) {
        if ((await repo.countFirstFromIpSince(ip, dayAgo())) >= env.GAS_DRIP_IP_DAILY_LIMIT) {
          throw new AppError(429, 'DRIP_IP_LIMIT', 'Too many new accounts from this network today')
        }
      } else if (
        (await repo.countActiveForAddressSince(address, dayAgo())) >=
        env.GAS_DRIP_ADDRESS_DAILY_LIMIT
      ) {
        throw new AppError(
          429,
          'DRIP_ADDRESS_LIMIT',
          'This account had enough gas today, try tomorrow',
        )
      }
      // Answer an empty treasury up front instead of failing a transfer. If the
      // balance cannot be read, try anyway: the send reports its own error.
      const balance = await chain.getBalance(chain.treasuryAddress).catch(() => null)
      if (balance !== null && balance < amountWei) {
        log.error({ treasury: chain.treasuryAddress }, 'gas treasury is empty')
        throw new AppError(503, 'DRIP_TREASURY_EMPTY', 'Gas sponsorship is paused, try again later')
      }

      const claim = await repo.claim(latest, { address, amountWei: amountWei.toString(), ip })
      if (claim.status === 'taken') return { created: false, drip: toDto(claim.drip, true) }

      try {
        const txHash = await chain.sendNative(address, amountWei)
        const sent = await repo.markSent(claim.drip.id, txHash)
        return { created: true, drip: toDto(sent, false) }
      } catch (err) {
        log.error({ err, address }, 'gas drip failed')
        await repo.markFailed(claim.drip.id, String((err as Error).message).slice(0, 500))
        throw new AppError(502, 'DRIP_FAILED', 'Could not set up the account right now, try again')
      }
    },

    async status(log: Log) {
      const dripsLast24h = await last24h()
      let balance: bigint | null = null
      if (chain.treasuryAddress) {
        balance = await chain.getBalance(chain.treasuryAddress).catch((err) => {
          log.warn({ err }, 'could not read treasury balance')
          return null
        })
      }
      return {
        configured: Boolean(chain.treasuryAddress),
        treasuryAddress: chain.treasuryAddress ?? null,
        treasuryBalanceMon: balance === null ? null : formatEther(balance),
        dripAmountMon: env.GAS_DRIP_AMOUNT_MON,
        dripsLast24h,
        dailyLimit: env.GAS_DRIP_DAILY_LIMIT,
        dripsRemainingOnBalance: balance === null ? null : Number(balance / amountWei),
      }
    },
  }
}

export type GasService = ReturnType<typeof createGasService>
