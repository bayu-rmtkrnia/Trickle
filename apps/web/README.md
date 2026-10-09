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
pnpm --filter @trickle/web test
pnpm --filter @trickle/web build
pnpm --filter @trickle/web start
```

The root `dev` and `start` scripts still start the API. Use the filtered commands
above to start the frontend independently.

## Structure

- `app/`: shared layout, global CSS, and routes.
- `components/`: shared placeholder page component.
- `components/ui/`: official shadcn primitives (new-york/Radix).
- `components/trickle/`: Trickle domain components, currently `Amount` only.
- `providers/`: client-side authentication provider and SDK adapter.
- `lib/account.ts`: application account context and `useAccount()` hook.
- `lib/api.ts`: shared JSON client, HTTP errors, queries, and future token injection.
- `services/`: typed employer, worker, invite, and FX endpoint functions.
- `types/api.ts`: transport types matching the current backend API v1.
- `test/`: API client/service and amount formatting tests.
- `public/`: static assets.

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
is implemented in these pages. Standalone API services are ready for later page integration.

## Privy setup

The authentication SDK dependency is `@privy-io/react-auth`. Its dependency graph
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

## API layer

Flow: **Component/Page → service → `lib/api.ts` → backend `/api/v1`**.
No page calls these services yet. The shared client uses native `fetch`; `tsx` is
added only as a development dependency to run the Node test suite.

Set `NEXT_PUBLIC_API_URL` in `apps/web/.env.local` to the backend base URL, without
`/api/v1`, `/health`, or `/docs`. Missing/empty values default to
`http://localhost:4000`. The client adds `/api/v1`; `/health` and `/docs` are
infrastructure routes and are not wrapped by these business services. Public env
values are embedded at build time: restart/rebuild after changing them. For browser
requests, the API must allow the frontend origin through its CORS configuration.

### Public services

```ts
import { getInvite } from '@/services/invites'
import { getUsdIdrRate } from '@/services/fx'

const invite = await getInvite(code) // GET /api/v1/invites/:code
const quote = await getUsdIdrRate() // GET /api/v1/fx/usd-idr
```

These work without authentication when a backend is running. An invalid invite code
can return 422; a missing invite returns 404. An expired invite can return 200 with
`status: 'EXPIRED'`. Invite DTOs expose `code`, not a database invite ID. FX quotes
include `source: 'live' | 'cache' | 'fallback'`; a fallback is not a live quote.
Public calls never read or send an access token, even with an authenticated client.

### Protected services — runtime blocked by backend Privy migration

| Service | Method and path (after `/api/v1`) |
| --- | --- |
| `createEmployer(input)` | `POST /employers` |
| `getEmployer()` | `GET /employers/me` |
| `updateEmployer(input)` | `PATCH /employers/me` |
| `listWorkers(query?)` | `GET /employers/me/workers` |
| `listInvites(query?)` | `GET /invites` |
| `createInvite(input)` | `POST /invites` |
| `acceptInvite(code)` | `POST /invites/:code/accept` |

The default client has no token getter. These services reject locally with
`ApiError { status: null, code: 'AUTH_NOT_CONFIGURED' }` **before any HTTP request**.
There is no automatic connection to `useAccount`, legacy JWT generation,
challenge/signature calls, or gas drip. The backend still accepts its old JWT;
**do not send a Privy token to that verifier**.

After the backend supports Privy access-token verification, an authenticated client
can be created inside a component/hook with the existing account abstraction:

```ts
// FUTURE WIRING ONLY: do not enable against the current backend.
const { getAccessToken } = useAccount()
const authenticatedApi = createApiClient({ getAccessToken })
const employer = await getEmployer(authenticatedApi)
const workers = await listWorkers({ limit: 20 }, authenticatedApi)
```

Import `createApiClient` from `@/lib/api` and the services from their modules.
Every service accepts an optional client as its last argument. The client awaits
the getter on each protected request, sends `Authorization: Bearer <token>`, and
throws local `AUTH_REQUIRED` if the token is null/empty. SDK getter failures
propagate unchanged. Tokens are never stored or logged. Cookies are omitted;
401/403 are returned to the caller without triggering login, logout, or retries.
This mechanism is tested only against a temporary test server, not the legacy
backend. Backend auth/session migration is outside this frontend change.

### Error handling and pagination

`ApiError` extends `Error` and exposes `status` (HTTP number, or null for local/network
failures), `code`, `message`, `details?: unknown`, and `validationErrors`.
Backend `{ error: { code, message, details? } }` is preserved for HTTP errors.
For HTTP 422, valid `{ field, message }` entries in `details` are available through
`validationErrors`; unknown details remain intact and do not crash parsing.

```ts
import { ApiError } from '@/lib/api'

try {
  await getInvite(code)
} catch (error) {
  if (error instanceof ApiError) {
    // e.g. status 422, code VALIDATION_ERROR, field params.code
    const fields = error.validationErrors
    // Use error.message or map error.code to product copy in a future UI.
  }
}
```

Non-JSON HTTP errors (such as proxy HTML) become `HTTP_ERROR` with the original
status. Malformed successful JSON becomes `INVALID_RESPONSE`; connection failures
become `NETWORK_ERROR` with null status. Abort signals can cancel requests;
cancellation errors propagate. Requests disable implicit fetch caching. Type
parameters provide compile-time typing, **not runtime validation of success schemas**.

`listWorkers` and `listInvites` return `CursorPage<T> { data, nextCursor }` without
renaming or flattening it. Send a non-null `nextCursor` back as `cursor`; null means
there is no next page. Treat cursors as opaque strings. Query parameters are URL
encoded. Omit `limit` for the backend default of 20; it accepts 1–100 and returns
422 for invalid limits. Invites also accept `type: 'WORKER' | 'FAMILY'`. No automatic
page loading or caching is implemented.

There are no frontend services for worker CRUD, streams, withdrawal, splits,
bank accounts, payouts, judge mode, or smart contracts. Worker salary fields are
backend metadata, not on-chain balances.

## UI foundation

shadcn is configured in `components.json` for the existing App Router, `@/*` alias,
and Tailwind v4 (`config` is empty; tokens live in `app/globals.css`). Components were
added individually from the official registry: Button, Input, Field, Card, Badge,
Dialog, AlertDialog, Popover, Sheet, Skeleton, Empty, Sonner, and Spinner. Field also
requires the generated Label and Separator components. No full catalog was installed.
The current registry imports `cn` directly from the `cn` package and primitives from
the unified `radix-ui` package. Do not replace focus management with manual handlers.

Tokens use neutral light surfaces, foreground/muted text, border/input/focus ring,
primary/secondary/accent, success/warning/destructive and their foreground colors,
and a 0.625rem radius. Semantic status colors are not a final brand palette.
`type-page-title`, `type-section-title`, and `type-body` provide a small typography
hierarchy with the existing Arial/Helvetica font family. Tailwind utilities handle
spacing. No dark theme or theme switcher exists. Motion respects reduced-motion.

The shadcn Sonner `Toaster` is mounted once in the root layout with a light default.
Its unused `next-themes` hook/dependency was removed. Call `toast` from `sonner` in
future client components. No business toast logic is implemented.

### Amount

```tsx
import { Amount } from '@/components/trickle/amount'

<Amount usd={240.52} idr={3897000} />
<Amount usd={240.52} /> // omit the optional estimate
```

Props: `usd: number`, `idr?: number`, `className?: string`. USD uses `en-US`, currency
USD, with exactly two decimals. IDR uses `id-ID`, currency IDR, grouped thousands and
zero decimals (rounded for display). The IDR line is prefixed by `≈`. Zero is a valid
value. Non-finite numbers throw a RangeError. Reusable `formatUsd` and `formatIdr`
helpers live in `lib/format.ts`. Amount does not fetch rates, derive balances or
convert USD to IDR: the caller supplies both values.

### Component patterns

- Pending Button: compose `<Button disabled aria-busy="true"><Spinner aria-hidden="true" />Loading…</Button>`.
- Field: associate `FieldLabel` with the Input ID, connect helper/error IDs through
  `aria-describedby`, and set `aria-invalid` plus `data-invalid` for an error.
- Badge: use visible status text; success/warning utility colors are additional cues.
- Dialog: a regular modal, such as a short form or detail view.
- AlertDialog: explicit confirmation for an important or irreversible action.
- Popover: a small popup anchored to its trigger, such as a filter option.
- Sheet: a side/bottom panel for mobile controls or longer details.

Use the corresponding Title/Description and Trigger/Close parts to preserve
accessible naming, keyboard interaction, focus containment and focus restoration.
There is no generic Popup component. This foundation does not implement business
dashboards, auth/API integration, role guards, salary streams, withdraw/splits,
smart contracts, RPC, sponsorship, payouts, judge mode or PWA features.
