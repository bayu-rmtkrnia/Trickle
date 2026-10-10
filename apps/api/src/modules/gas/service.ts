import type { FastifyBaseLogger } from 'fastify'
import { formatEther, parseEther } from 'viem'
import type { Env } from '../../env.js'
import type { GasDrip } from '../../generated/prisma/client.js'
import type { Chain } from '../../lib/chain.js'
import { AppError } from '../../lib/errors.js'
import type { GasRepository } from './repository.js'
import type { DripDto } from './schemas.js'

const DAY_MS = 24 * 60 * 60 * 1000

/** Passed per call so log lines keep the request id. */
type Log = Pick<FastifyBaseLogger, 'error' | 'warn'>

interface Deps {
  repo: GasRepository
  chain: Chain
  env: Pick<Env, 'GAS_DRIP_AMOUNT_MON' | 'GAS_DRIP_DAILY_LIMIT'>
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
  const last24h = () => repo.countActiveSince(new Date(Date.now() - DAY_MS))

  return {
    /** `created` is false when the address was already funded (idempotent replay). */
    async drip(address: `0x${string}`, ip: string, log: Log) {
      const existing = await repo.findByAddress(address)
      if (existing && existing.status !== 'FAILED') {
        return { created: false, drip: toDto(existing, true) }
      }

      if (!chain.treasuryAddress) {
        throw new AppError(503, 'DRIP_UNAVAILABLE', 'Gas sponsorship is not configured')
      }
      if ((await last24h()) >= env.GAS_DRIP_DAILY_LIMIT) {
        throw new AppError(429, 'DRIP_DAILY_LIMIT', 'Daily sponsorship limit reached, try tomorrow')
      }

      const claim = await repo.claim(existing, { address, amountWei: amountWei.toString(), ip })
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
