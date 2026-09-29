/**
 * Dev helper for testing auth from Postman, which cannot sign messages.
 *
 *   pnpm sign <account>            request a challenge, sign it, print the /auth/verify body
 *   pnpm sign <account> --login    also call /auth/verify and print the session token
 *   pnpm sign <account> --message "<siwe message>"   only sign the given message
 *
 * <account> is any name (employer, worker, family, ...). Each name maps to a
 * fixed throwaway key derived from the name, so the same name is always the
 * same address. Set DEV_SIGNER_PRIVATE_KEY to use a specific key instead.
 * Never use these keys for anything holding real funds.
 */
import { keccak256, toHex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const args = process.argv.slice(2)
const name = args.find((a) => !a.startsWith('--')) ?? 'employer'
const flag = (f: string) => {
  const i = args.indexOf(f)
  return i === -1 ? undefined : (args[i + 1] ?? '')
}
const api = flag('--api') ?? process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 4000}`
const login = args.includes('--login')
const givenMessage = flag('--message')

const key =
  (process.env.DEV_SIGNER_PRIVATE_KEY as `0x${string}` | undefined) ||
  keccak256(toHex(`trickle-dev:${name}`))
const account = privateKeyToAccount(key)

async function post(path: string, body: unknown) {
  const res = await fetch(`${api}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${JSON.stringify(json)}`)
  return json
}

async function main() {
  console.error(`account: ${name}  address: ${account.address}`)

  if (givenMessage !== undefined) {
    const signature = await account.signMessage({ message: givenMessage })
    console.log(JSON.stringify({ message: givenMessage, signature }, null, 2))
    return
  }

  const { message } = (await post('/auth/challenge', { address: account.address })) as {
    message: string
  }
  const signature = await account.signMessage({ message })
  const verifyBody = { message, signature }

  if (!login) {
    console.error('Paste this as the raw JSON body of POST /auth/verify:\n')
    console.log(JSON.stringify(verifyBody, null, 2))
    return
  }

  const { token } = (await post('/auth/verify', verifyBody)) as { token: string }
  console.error('Session token (use as Bearer token):\n')
  console.log(token)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
