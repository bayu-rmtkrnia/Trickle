import type { FastifyBaseLogger } from 'fastify'
import { formatEther, formatUnits, parseUnits, type Address } from 'viem'
import type { Env } from '../../env.js'
import type { DemoStream } from '../../generated/prisma/client.js'
import type { DemoSigner } from '../../lib/demo.js'
import { AppError } from '../../lib/errors.js'
import type { DemoStreamRepository } from './repository.js'
import type { DemoStreamDto } from './schemas.js'

const DAY_MS = 24 * 60 * 60 * 1000
/** Mock AUSD, like AUSD, has 6 decimals. */
const TOKEN_DECIMALS = 6

/** Passed per call so log lines keep the request id. */
type Log = Pick<FastifyBaseLogger, 'error' | 'warn'>

interface Deps {
  repo: DemoStreamRepository
  demo: DemoSigner
  env: Pick<
    Env,
    | 'DEMO_STREAM_AMOUNT_USD'
    | 'DEMO_STREAM_MINUTES'
    | 'DEMO_STREAM_DAILY_LIMIT'
    | 'DEMO_STREAM_IP_DAILY_LIMIT'
  >
}

const toDto = (d: DemoStream, alreadyStarted: boolean): DemoStreamDto => ({
  id: d.id,
  workerAddress: d.address,
  amountUsd: formatUnits(BigInt(d.amountUnits), TOKEN_DECIMALS),
  durationSeconds: d.durationSeconds,
  status: d.status,
  streamId: d.streamId,
  txHash: d.txHash,
  startsAt: d.startsAt?.toISOString() ?? null,
  endsAt: d.endsAt?.toISOString() ?? null,
  alreadyStarted,
  createdAt: d.createdAt.toISOString(),
})

const fromUnix = (seconds: number) => new Date(seconds * 1000)

export function createDemoStreamService({ repo, demo, env }: Deps) {
  const amount = parseUnits(env.DEMO_STREAM_AMOUNT_USD, TOKEN_DECIMALS)
  const durationSeconds = env.DEMO_STREAM_MINUTES * 60
  const dayAgo = () => new Date(Date.now() - DAY_MS)

  return {
    /** `created` is false when this account already has its demo stream (idempotent replay). */
    async start(user: { id: string; address: Address }, ip: string, log: Log) {
      const existing = await repo.findByUser(user.id)
      if (existing && existing.status !== 'FAILED') {
        return { created: false, stream: toDto(existing, true) }
      }

      if (!demo.employerAddress) {
        throw new AppError(503, 'DEMO_UNAVAILABLE', 'Judge mode is not configured')
      }
      if ((await repo.countActiveSince(dayAgo())) >= env.DEMO_STREAM_DAILY_LIMIT) {
        throw new AppError(429, 'DEMO_DAILY_LIMIT', 'Daily demo limit reached, try tomorrow')
      }
      if ((await repo.countActiveFromIpSince(ip, dayAgo())) >= env.DEMO_STREAM_IP_DAILY_LIMIT) {
        throw new AppError(429, 'DEMO_IP_LIMIT', 'Too many demo streams from this network today')
      }

      const claim = await repo.claim(existing, {
        userId: user.id,
        address: user.address,
        amountUnits: amount.toString(),
        durationSeconds,
        ip,
      })
      if (claim.status === 'taken') return { created: false, stream: toDto(claim.stream, true) }

      try {
        const tx = await demo.createStream(user.address, amount, durationSeconds)
        const sent = await repo.markSent(claim.stream.id, {
          streamId: tx.streamId.toString(),
          txHash: tx.txHash,
          startsAt: fromUnix(tx.start),
          endsAt: fromUnix(tx.end),
        })
        return { created: true, stream: toDto(sent, false) }
      } catch (err) {
        log.error({ err, address: user.address }, 'demo stream failed')
        await repo.markFailed(claim.stream.id, String((err as Error).message).slice(0, 500))
        throw new AppError(
          502,
          'DEMO_STREAM_FAILED',
          'Could not start the demo right now, try again',
        )
      }
    },

    async status(log: Log) {
      const streamsLast24h = await repo.countActiveSince(dayAgo())
      let gas: bigint | null = null
      if (demo.employerAddress) {
        gas = await demo.getGasBalance().catch((err) => {
          log.warn({ err }, 'could not read demo employer gas')
          return null
        })
      }
      return {
        configured: Boolean(demo.employerAddress),
        employerAddress: demo.employerAddress ?? null,
        employerGasMon: gas === null ? null : formatEther(gas),
        amountUsd: env.DEMO_STREAM_AMOUNT_USD,
        durationSeconds,
        streamsLast24h,
        dailyLimit: env.DEMO_STREAM_DAILY_LIMIT,
      }
    },
  }
}

export type DemoStreamService = ReturnType<typeof createDemoStreamService>
