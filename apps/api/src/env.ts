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

  /** TricklePayroll contract. When unset, on-chain split checks are skipped (and logged). */
  PAYROLL_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, 'must be a 0x-prefixed 20-byte address')
    .optional()
    .or(z.literal('').transform(() => undefined)),

  /** Seconds between stream indexer rounds (needs PAYROLL_ADDRESS). 0 turns the loop off. */
  STREAM_SYNC_SECONDS: z.coerce.number().int().min(0).default(15),

  GAS_TREASURY_PRIVATE_KEY: hexKey.optional().or(z.literal('').transform(() => undefined)),
  GAS_DRIP_AMOUNT_MON: z.string().default('0.05'),
  GAS_DRIP_DAILY_LIMIT: z.coerce.number().int().positive().default(200),
  /** Drips one IP may trigger per day, so one person cannot farm MON with many accounts. */
  GAS_DRIP_IP_DAILY_LIMIT: z.coerce.number().int().positive().default(5),

  /**
   * 32 random bytes as hex (`openssl rand -hex 32`). Encrypts bank account
   * numbers at rest. Without it, adding a bank account answers 503. Changing it
   * makes existing numbers unreadable, so keep it with the other secrets.
   */
  BANK_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'must be 32 bytes of hex (openssl rand -hex 32)')
    .optional()
    .or(z.literal('').transform(() => undefined)),

  // Payouts (POST /payouts). Recipients send tokens here, then the sandbox provider pays IDR.
  // Without it (or without PAYROLL_ADDRESS / BANK_ENCRYPTION_KEY), POST /payouts answers 503.
  PAYOUT_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, 'must be a 0x-prefixed 20-byte address')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  /** Signs `POST /webhooks/payout-provider`. Without it, the webhook answers 503. */
  PAYOUT_WEBHOOK_SECRET: z
    .string()
    .min(32, 'use at least 32 characters (openssl rand -hex 32)')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  /** The mock provider completes a disbursement this many seconds after it starts. */
  MOCK_PAYOUT_SECONDS: z.coerce.number().int().min(0).default(15),

  // Judge mode (POST /demo-streams). Testnet only. Without the key, the endpoint answers 503.
  DEMO_EMPLOYER_PRIVATE_KEY: hexKey.optional().or(z.literal('').transform(() => undefined)),
  DEMO_STREAM_AMOUNT_USD: z
    .string()
    .regex(/^\d+(\.\d{1,6})?$/, 'must be a USD amount')
    .default('50'),
  DEMO_STREAM_MINUTES: z.coerce.number().int().positive().default(60),
  DEMO_STREAM_DAILY_LIMIT: z.coerce.number().int().positive().default(100),
  /** Demo streams one IP may start per day, so one visitor cannot drain the demo employer. */
  DEMO_STREAM_IP_DAILY_LIMIT: z.coerce.number().int().positive().default(5),

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
