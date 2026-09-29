import { z } from 'zod'

const hexKey = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, 'must be a 0x-prefixed 32-byte hex private key')

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((s) =>
      s
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    ),

  DATABASE_URL: z.string().url(),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  AUTH_DOMAIN: z.string().default('localhost:3000'),
  WEB_URL: z.string().url().default('http://localhost:3000'),
  AUTH_CHALLENGE_TTL_SECONDS: z.coerce.number().int().positive().default(300),

  CHAIN_ID: z.coerce.number().int().default(10143),
  RPC_URL: z.string().url().default('https://testnet-rpc.monad.xyz'),

  GAS_TREASURY_PRIVATE_KEY: hexKey.optional().or(z.literal('').transform(() => undefined)),
  GAS_DRIP_AMOUNT_MON: z.string().default('0.05'),
  GAS_DRIP_DAILY_LIMIT: z.coerce.number().int().positive().default(200),

  FX_API_URL: z.string().url().default('https://open.er-api.com/v6/latest/USD'),
  FX_CACHE_SECONDS: z.coerce.number().int().positive().default(600),
  FX_FALLBACK_USD_IDR: z.coerce.number().positive().default(16500),

  INVITE_TTL_DAYS: z.coerce.number().int().positive().default(14),
})

export type Env = z.infer<typeof EnvSchema>

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    throw new Error(`Invalid environment variables:\n${issues.join('\n')}`)
  }
  return parsed.data
}
