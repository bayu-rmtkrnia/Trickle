import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { formatEther, parseEther } from 'viem'
import { z } from 'zod'
import { Prisma, type GasDrip } from '../generated/prisma/client.js'
import { AppError } from '../lib/errors.js'
import { errors } from '../lib/schemas.js'

const DripDto = z
  .object({
    address: z.string(),
    status: z.enum(['PENDING', 'SENT', 'FAILED']),
    amountMon: z.string(),
    txHash: z.string().nullable(),
    alreadyDripped: z.boolean().describe('true when this address was funded by an earlier call'),
    createdAt: z.string(),
  })
  .meta({ id: 'GasDrip' })

const DAY_MS = 24 * 60 * 60 * 1000

const gas: FastifyPluginAsyncZod = async (app) => {
  const { db, env, chain } = app
  const amountWei = parseEther(env.GAS_DRIP_AMOUNT_MON)

  const toDto = (d: GasDrip, alreadyDripped: boolean): z.infer<typeof DripDto> => ({
    address: d.address,
    status: d.status,
    amountMon: formatEther(BigInt(d.amountWei)),
    txHash: d.txHash,
    alreadyDripped,
    createdAt: d.createdAt.toISOString(),
  })

  app.post(
    '/gas/drip',
    {
      onRequest: [app.authenticate],
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      schema: {
        tags: ['Gas'],
        summary: "Fund the signed-in account's gas, once per address",
        description:
          'Called by the web app right after an account is created, so users never hold or see MON. Idempotent: calling again returns the original drip. Capped per day across all users.',
        security: [{ bearerAuth: [] }],
        response: { 200: DripDto, 201: DripDto, ...errors(401, 429, 502, 503) },
      },
    },
    async (req, reply) => {
      const address = req.user.address

      const existing = await db.gasDrip.findUnique({ where: { address } })
      if (existing && existing.status !== 'FAILED') return toDto(existing, true)

      if (!chain.treasuryAddress) {
        throw new AppError(503, 'DRIP_UNAVAILABLE', 'Gas sponsorship is not configured')
      }
      const recent = await db.gasDrip.count({
        where: { createdAt: { gte: new Date(Date.now() - DAY_MS) }, status: { not: 'FAILED' } },
      })
      if (recent >= env.GAS_DRIP_DAILY_LIMIT) {
        throw new AppError(429, 'DRIP_DAILY_LIMIT', 'Daily sponsorship limit reached, try tomorrow')
      }

      // Claim the address first; the unique constraint makes concurrent calls safe.
      let drip: GasDrip
      try {
        drip = existing
          ? await db.gasDrip.update({
              where: { id: existing.id },
              data: { status: 'PENDING', error: null, amountWei: amountWei.toString(), ip: req.ip },
            })
          : await db.gasDrip.create({
              data: { address, amountWei: amountWei.toString(), ip: req.ip },
            })
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          return toDto(await db.gasDrip.findUniqueOrThrow({ where: { address } }), true)
        }
        throw err
      }

      try {
        const txHash = await chain.sendNative(address, amountWei)
        drip = await db.gasDrip.update({
          where: { id: drip.id },
          data: { status: 'SENT', txHash },
        })
      } catch (err) {
        req.log.error({ err, address }, 'gas drip failed')
        await db.gasDrip.update({
          where: { id: drip.id },
          data: { status: 'FAILED', error: String((err as Error).message).slice(0, 500) },
        })
        throw new AppError(502, 'DRIP_FAILED', 'Could not set up the account right now, try again')
      }
      return reply.code(201).send(toDto(drip, false))
    },
  )

  app.get(
    '/gas/status',
    {
      schema: {
        tags: ['Gas'],
        summary: 'Treasury balance and drip usage, for monitoring',
        response: {
          200: z.object({
            configured: z.boolean(),
            treasuryAddress: z.string().nullable(),
            treasuryBalanceMon: z.string().nullable(),
            dripAmountMon: z.string(),
            dripsLast24h: z.number(),
            dailyLimit: z.number(),
            dripsRemainingOnBalance: z.number().nullable(),
          }),
        },
      },
    },
    async (req) => {
      const dripsLast24h = await db.gasDrip.count({
        where: { createdAt: { gte: new Date(Date.now() - DAY_MS) }, status: { not: 'FAILED' } },
      })
      let balance: bigint | null = null
      if (chain.treasuryAddress) {
        balance = await chain.getBalance(chain.treasuryAddress).catch((err) => {
          req.log.warn({ err }, 'could not read treasury balance')
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
  )
}

export default gas
