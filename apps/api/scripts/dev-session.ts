/**
 * Dev helper for Postman, which cannot log in to Privy.
 *
 *   pnpm session <account>     print a session token for <account> (employer, worker, family, ...)
 *
 * Writes straight to DATABASE_URL: creates the user if needed (address derived
 * from the name, so the same name is always the same account) and a session,
 * exactly as POST /api/v1/sessions would. Refuses to run with NODE_ENV=production.
 * To test the real flow, copy a Privy access token from the web app instead.
 */
import { keccak256, toHex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { loadEnv } from '../src/env.js'
import { createPrisma } from '../src/lib/prisma.js'
import { hashToken, newSessionToken } from '../src/lib/tokens.js'

const env = loadEnv()
if (env.NODE_ENV === 'production') {
  console.error('Refusing to mint sessions in production')
  process.exit(1)
}

const name = process.argv[2] ?? 'employer'
const address = privateKeyToAccount(keccak256(toHex(`trickle-dev:${name}`))).address.toLowerCase()
const db = createPrisma(env.DATABASE_URL)

try {
  const user = await db.user.upsert({ where: { address }, create: { address }, update: {} })
  const token = newSessionToken()
  await db.session.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
  })
  console.error(`account: ${name}  address: ${address}\nSession token (use as Bearer token):\n`)
  console.log(token)
} finally {
  await db.$disconnect()
}
