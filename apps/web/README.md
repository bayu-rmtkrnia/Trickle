# Trickle web

Minimal Next.js App Router frontend with TypeScript, Tailwind CSS, and ESLint.
Requires Node.js 22+ and the repository's pnpm 10.13.1.

From the repository root:

```sh
pnpm install
pnpm --filter @trickle/web dev
```

Open http://localhost:3000. On Windows PowerShell with script execution restricted,
use `pnpm.cmd` instead of `pnpm`.

```sh
pnpm --filter @trickle/web lint
pnpm --filter @trickle/web typecheck
pnpm --filter @trickle/web build
pnpm --filter @trickle/web start
```

The root `dev` and `start` scripts still start the API. Use the filtered commands
above to start the frontend independently.

## Structure

- `app/`: shared layout, global CSS, and routes.
- `components/`: shared placeholder page component.
- `providers/`: client-side authentication provider and SDK adapter.
- `lib/account.ts`: application account context and `useAccount()` hook.
- `public/`: static assets.

Add `services/` and `types/` when integrations or shared types need their own folders.

## Routes

| Route | Page |
| --- | --- |
| `/` | Trickle Home |
| `/employer` | Employer Dashboard |
| `/w` | Worker Dashboard |
| `/w/invite/[code]` | Worker Invitation |
| `/f` | Family Dashboard |
| `/f/invite/[code]` | Family Invitation |
| `/auth-test` | Authentication Test |

Dashboard and invitation routes remain public placeholders. Invitation pages only
display the URL code. No API integration, business data, or contract integration
is implemented.

## Privy setup

The only added direct dependency is `@privy-io/react-auth`. Its dependency graph
includes wallet libraries such as viem and Wagmi (through `x402`); the application
does not import or configure them.

Copy `.env.example` to `.env.local` inside `apps/web`, and set
`NEXT_PUBLIC_PRIVY_APP_ID` to your real Privy App ID. Restart development or rebuild
production after changing it; Next.js embeds public environment variables at build
time. Enable email and Google login, embedded Ethereum wallets, and the appropriate
app origins in the Privy dashboard. Then visit http://localhost:3000/auth-test.

When the App ID is missing, empty, or whitespace, the provider does not mount Privy
or its hooks. The authentication test page displays `Privy not configured`; all
other scaffold routes remain usable. No dummy credentials are used. A nonempty
App ID must be valid and configured in Privy before live login can work.

Never put a Privy App Secret in this frontend, especially in a `NEXT_PUBLIC_`
variable. Server secrets belong only in server/backend configuration.

Client components consume `useAccount()` from `@/lib/account`:

```ts
{
  configured: boolean
  ready: boolean
  authenticated: boolean
  user: { id: string; email: string | null } | null
  walletAddress: string | null
  login: () => void
  logout: () => Promise<void>
  getAccessToken: () => Promise<string | null>
}
```

`ready` waits for authentication and, for signed-in users, wallet loading.
`walletAddress` is the Privy embedded Ethereum wallet address, never an external
wallet or an invented address. It is null until available. The SDK is configured
to create an embedded Ethereum wallet on login for all users who need one.

Without configuration, `ready` and `authenticated` are false, user and wallet are
null, login throws `Privy not configured`, logout is a no-op, and token retrieval
returns null. Unauthenticated/loading token retrieval also returns null. For a
ready authenticated account, `getAccessToken()` delegates to Privy's refresh-aware
token getter; SDK errors propagate to the caller. Tokens are not rendered, logged,
or copied into custom storage.

Later, the token can be sent as `Authorization: Bearer <privy-access-token>` after
the backend supports Privy verification. This frontend currently sends no token
to the API and implements no backend session flow.
