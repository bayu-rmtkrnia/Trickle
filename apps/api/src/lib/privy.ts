import { createRemoteJWKSet, importSPKI, jwtVerify, type JWTVerifyGetKey } from 'jose'
import { AppError, unauthorized } from './errors.js'

const PRIVY_API = 'https://auth.privy.io/api/v1'

/** Privy as seen by the API. Tests swap in a fake through `buildApp({ privy })`. */
export interface Privy {
  /** Verifies a Privy access token and returns the Privy user id (did:privy:...). Throws 401. */
  verifyAccessToken(token: string): Promise<{ privyId: string }>
  /** Address of the user's Privy embedded Ethereum wallet, or null if it was not created yet. */
  getWalletAddress(privyId: string): Promise<`0x${string}` | null>
}

interface Options {
  appId?: string
  appSecret?: string
  /** PEM (SPKI) key from the Privy dashboard. Falls back to the app's JWKS URL. */
  verificationKey?: string
  fetch?: typeof fetch
}

interface LinkedAccount {
  type?: string
  address?: string
  chain_type?: string
  wallet_client_type?: string
}

const notConfigured = () =>
  new AppError(503, 'PRIVY_NOT_CONFIGURED', 'Sign-in is not configured on this server')

export function createPrivy(opts: Options): Privy {
  const doFetch = opts.fetch ?? fetch
  let keys: JWTVerifyGetKey | undefined

  function getKeys() {
    if (!opts.appId) throw notConfigured()
    if (!keys) {
      if (opts.verificationKey) {
        // .env files usually hold the PEM on one line with literal \n.
        const pem = importSPKI(opts.verificationKey.replace(/\\n/g, '\n'), 'ES256')
        keys = () => pem
      } else {
        keys = createRemoteJWKSet(new URL(`${PRIVY_API}/apps/${opts.appId}/jwks.json`))
      }
    }
    return keys
  }

  return {
    async verifyAccessToken(token) {
      const keys = getKeys()
      try {
        const { payload } = await jwtVerify(token, keys, {
          issuer: 'privy.io',
          audience: opts.appId,
          algorithms: ['ES256'],
        })
        if (!payload.sub) throw new Error('missing sub')
        return { privyId: payload.sub }
      } catch {
        throw unauthorized('Privy access token is invalid or expired')
      }
    },

    async getWalletAddress(privyId) {
      if (!opts.appId || !opts.appSecret) throw notConfigured()
      const res = await doFetch(`${PRIVY_API}/users/${encodeURIComponent(privyId)}`, {
        headers: {
          authorization: `Basic ${btoa(`${opts.appId}:${opts.appSecret}`)}`,
          'privy-app-id': opts.appId,
        },
        signal: AbortSignal.timeout(5000),
      }).catch(() => undefined)
      if (!res?.ok) {
        throw new AppError(502, 'PRIVY_UNAVAILABLE', 'Could not reach Privy, try again shortly')
      }
      const user = (await res.json()) as { linked_accounts?: LinkedAccount[] }
      const wallet = user.linked_accounts?.find(
        (a) =>
          a.type === 'wallet' &&
          a.chain_type === 'ethereum' &&
          a.wallet_client_type === 'privy' &&
          /^0x[0-9a-fA-F]{40}$/.test(a.address ?? ''),
      )
      return wallet ? (wallet.address!.toLowerCase() as `0x${string}`) : null
    },
  }
}
