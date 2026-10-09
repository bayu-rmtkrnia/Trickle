import { z } from 'zod'

const hexKey = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, 'must be a 0x-prefixed 32-byte hex private key')

/** Empty strings from .env files count as unset. */
const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((s) => s || undefined)

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

  WEB_URL: z.string().url().default('http://localhost:3000'),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(7),

  // Sign-in goes through Privy. Without PRIVY_APP_ID, POST /sessions answers 503.
  PRIVY_APP_ID: optionalString,
  /** Server-side secret, used to look up a user's embedded wallet. Never ship it to the web app. */
  PRIVY_APP_SECRET: optionalString,
  /** PEM verification key from the Privy dashboard. When unset, keys come from Privy's JWKS URL. */
  PRIVY_VERIFICATION_KEY: optionalString,

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
