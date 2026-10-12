# Trickle

Real-time payroll streaming + instant cross-border remittance for migrant workers, built on Monad.

## Problem

Migrant workers get paid monthly, but emergencies don't wait for payday. Traditional remittance also eats ~6.5% in fees and takes days to settle.

## What it does

Wages stream continuously (per-second accrual) inside a smart contract on Monad instead of paying out once a month. Workers claim whenever they need to, and can auto-forward a % straight to their family back home in local currency — no crypto knowledge needed on either end.

## Why Monad

Near-zero fees + sub-second finality make frequent small claims economically viable, and parallel execution handles the bursty claim volume that clusters around pay periods.

## How it works

Employer tops up payroll (fiat → AUSD via Agora) → contract streams wages per second → worker claims → auto-remit redeems AUSD back to fiat → family receives IDR via Xendit/Flip.

## Team

**Group:** Trickle

| Name | Student ID | Role |
| ---- | ---------- | ---- |
| Muhammad Affandi Argya Bagaskara | 24/538984/TK/59778 | Backend |
| Razaqi Alkautsar | 24/544958/TK/60570 | Smart contract |
| Bayu Rahmat Kurnia | 24/533736/TK/59139 | Frontend: worker & family |
| Raka Bagus Samudra | 24/543213/TK/60349 | Frontend: employer & design |

**Milestone 1 report (PDF):** https://drive.google.com/file/d/1QpE0x27FLanq6SFl48sUJyDhbVktgnzW/view?usp=sharing

## Tech stack

| Layer | Technology |
| ----- | ---------- |
| Backend API | Node.js 22, TypeScript, [Fastify 5](https://fastify.dev) |
| Validation & API docs | Zod 4, `fastify-type-provider-zod`, OpenAPI 3 via `@fastify/swagger` (served at `/docs`) |
| Database | PostgreSQL 16, Prisma 7 ORM + migrations. ERD: [`docs/erd.md`](docs/erd.md) |
| Auth | [Privy](https://privy.io) embedded wallets; the API exchanges the Privy access token for its own revocable session token. Roles derived from DB relations (RBAC guards) |
| Chain access | [viem](https://viem.sh) on Monad testnet (chain id 10143) |
| Testing | Vitest (unit + integration against Postgres), Postman collection |
| Tooling | pnpm workspaces, ESLint, Prettier, GitHub Actions CI, gitleaks secret scanning, Docker Compose |
| Smart contract | Solidity + Foundry, `TricklePayroll` on Monad testnet (`0xE7292E797009E9D53102ec132Ef4Ae549cDD652e`) |
| Web app (in progress) | Next.js + Privy (`apps/web`) |
| Integrations | Mock AUSD (testnet token, 6 decimals); payouts through a mock sandbox provider behind a `PayoutProvider` interface (Xendit/Flip pluggable) |

## Project structure

```
Trickle/
├── .github/workflows/ci.yml        # Lint, typecheck, tests, OpenAPI drift check, secret scan
├── apps/
│   ├── api/                        # Backend API
│       ├── prisma/
│       │   ├── schema.prisma       # Database schema (metadata only; money lives on-chain)
│       │   └── migrations/         # SQL migrations
│       ├── postman/
│       │   └── Trickle.postman_collection.json
│       ├── scripts/
│       │   ├── dev-session.ts      # Dev helper: mint a session token for Postman
│       │   ├── export-openapi.ts   # Writes openapi.json
│       │   └── gen-postman.ts      # Writes the Postman collection
│       ├── src/
│       │   ├── index.ts            # Server entry point
│       │   ├── app.ts              # Fastify app: plugins, Swagger, routes
│       │   ├── env.ts              # Environment variable validation
│       │   ├── types.ts            # Fastify type augmentation
│       │   ├── lib/                # chain (viem), streams, transfers, demo signer, payout provider, crypto (AES-256-GCM), fx, privy, prisma, errors, pagination, roles, tokens
│       │   ├── plugins/            # auth (session tokens), rbac (requireRole / requireOwnership), uniform error handling
│       │   └── modules/            # health, sessions, users, companies, workers, recipients, bank-accounts, payouts, invites, gas, demo-streams, fx; each one has:
│       │       └── <resource>/     #   routes → controller → service → repository, plus schemas (Zod)
│       ├── test/                   # Vitest unit + integration tests
│       ├── openapi.json            # Generated API spec (import into Postman / FE codegen)
│       └── .env.example
│   └── web/                        # Next.js web app (Privy login)
├── contracts/                      # TricklePayroll (Foundry): streams, withdraw + split, cancel
├── packages/shared/                # Contract ABIs + deployed addresses for the web app and API
├── docs/                           # PLAN, ARCHITECTURE.md, erd.md (database), backend roadmap
├── docker-compose.yml              # Local Postgres
├── LICENSE                         # MIT
└── package.json / pnpm-workspace.yaml
```

## API (v1)

Interactive docs: `http://localhost:4000/docs`. All errors use `{ "error": { "code": "...", "message": "...", "details": ... } }`. Schema validation failures return 422 with one `details` entry per invalid field; unreadable bodies (e.g. broken JSON) return 400.

**Auth** column: – public; ✓ any signed-in account, no role needed; *Employer*, *Worker*, *Recipient* that role; *Owner* only the account that owns that resource; *Signed* an HMAC signature instead of a session. Other roles and other owners get 403, which the integration tests check for every sensitive endpoint. Roles come from data, not a stored field: see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). The database schema is in [`docs/erd.md`](docs/erd.md).

Resource endpoints below are relative to the `/api/v1` prefix, e.g. `GET /api/v1/users/me`. Only `/health` and `/docs` live at the root. List endpoints (marked *paged*) take `?limit=` (1–100, default 20) and `?cursor=`, and return `{ "data": [...], "nextCursor": "..." }`; pass `nextCursor` back as `cursor` until it is `null`.

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/health` (root) | – | Service + database status |
| POST | `/sessions` | – | Exchange a Privy access token for a session token |
| DELETE | `/sessions/current` | ✓ | Sign out (revoke this session token) |
| GET | `/users/me` | ✓ | Current user, roles (employer / worker / recipient) and `companyId` |
| PATCH | `/users/me` | ✓ | Update my display name |
| POST | `/companies` | ✓ | Create a company (one active per account); makes you an employer |
| GET, PATCH | `/companies/:id` | Owner | Read / update a company |
| DELETE | `/companies/:id` | Owner | Soft delete; 409 while workers are linked |
| POST | `/companies/:id/workers` | Owner | Add a worker by wallet address (restores a removed one) |
| GET | `/companies/:id/workers` | Owner | Active workers (paged) |
| GET | `/workers/:id` | Owner or the worker | Read a worker |
| PATCH | `/workers/:id` | Owner | Update name, position, reference salary |
| DELETE | `/workers/:id` | Owner | Soft delete; 409 while their salary stream is active |
| POST | `/recipients` | Worker | Add a family recipient by wallet address (restores a removed one) |
| GET | `/recipients` | Worker | My active recipients (paged) |
| GET | `/recipients/:id` | Owner or the recipient | Read a recipient |
| PATCH | `/recipients/:id` | Owner | Update name and relation |
| DELETE | `/recipients/:id` | Owner | Soft delete; 409 while the on-chain split still pays them |
| POST | `/bank-accounts` | Recipient | Add a payout bank account; the number is encrypted (AES-256-GCM) |
| GET | `/bank-accounts` | Recipient | My bank accounts (paged), last 4 digits only |
| GET | `/bank-accounts/:id` | Owner | Read one, last 4 digits only |
| PATCH | `/bank-accounts/:id` | Owner | Update name and label |
| DELETE | `/bank-accounts/:id` | Owner | Soft delete |
| POST | `/payouts` | Recipient | Cash out an on-chain transfer to `PAYOUT_ADDRESS` into one of my bank accounts (sandbox) |
| GET | `/payouts` | Recipient | My payouts (paged) |
| GET | `/payouts/:id` | Owner | One payout, with its latest status |
| POST | `/webhooks/payout-provider` | Signed | Disbursement status from the provider (HMAC signature) |
| POST | `/invites` | Employer or worker | Worker invite (employer) or recipient invite (worker) |
| GET | `/invites` | Employer or worker | Invites I created (paged) |
| DELETE | `/invites/:id` | Creator | Cancel a pending invite; 409 once accepted |
| GET | `/invites/:code` | – | Public invite details |
| POST | `/invites/:code/acceptance` | ✓ | Accept an invite |
| POST | `/gas-drips` | ✓ | Sponsor gas for an account, once per address; capped per IP and per day |
| GET | `/gas-drips/status` | – | Treasury balance and daily usage |
| POST | `/demo-streams` | ✓ | Judge mode: real testnet stream from the demo employer to me, once per account |
| GET | `/demo-streams/status` | – | Demo employer gas and daily usage |
| GET | `/fx-rates/usd-idr` | ✓ | USD→IDR rate with cache, fallback and rate time |

Deprecated, kept until the web app moves over: `POST /gas/drip`, `GET /gas/status`, `GET /fx/usd-idr` (public). They answer like their successors, with `Deprecation` and `Link` headers.

## Running locally

Requirements: Node.js 22+, pnpm 10, Docker.

```bash
pnpm install
pnpm db:up                                   # Postgres on localhost:5433
cp apps/api/.env.example apps/api/.env       # then set PRIVY_APP_ID and PRIVY_APP_SECRET
pnpm db:migrate
pnpm dev                                     # API on http://localhost:4000
```

Optional features answer 503 until their settings are filled in `apps/api/.env` (all testnet; never commit real keys):

| Feature | Settings |
| ------- | -------- |
| Bank accounts, payouts | `BANK_ENCRYPTION_KEY` (`openssl rand -hex 32`) |
| Payouts | `PAYROLL_ADDRESS`, `PAYOUT_ADDRESS`, `PAYOUT_WEBHOOK_SECRET` |
| Gas sponsorship | `GAS_TREASURY_PRIVATE_KEY`, funded with testnet MON |
| Judge mode | `DEMO_EMPLOYER_PRIVATE_KEY` (funded with testnet MON), `PAYROLL_ADDRESS` |

Tests (integration tests need a separate database):

```bash
docker compose exec db psql -U trickle -c "CREATE DATABASE trickle_test"
TEST_DATABASE_URL=postgresql://trickle:trickle@localhost:5433/trickle_test pnpm test
```

### Testing with Postman

1. Import `apps/api/postman/Trickle.postman_collection.json` and set `baseUrl`.
2. Postman cannot log in to Privy, so mint session tokens from the CLI (needs the local database):
   ```bash
   cd apps/api
   pnpm session employer   # also: worker, family
   ```
   Paste each printed token into the `employerToken`, `workerToken` and `familyToken` collection variables.
   To try the real sign-in, put an access token from the web app (`getAccessToken()`) into `privyAccessToken`.
3. Run the folders top to bottom. They follow the flow employer → worker invite → recipient invite → bank account → payout, and end with sign-out.
   The payout folder needs a real transfer of mock AUSD to `PAYOUT_ADDRESS` (put its hash in `payoutTxHash`), and the signed webhook needs `payoutWebhookSecret`.

`pnpm session <name>` always maps a name to the same throwaway address and refuses to run with `NODE_ENV=production`.

## Status

Hackathon prototype, built for Monad Metropolis. Not licensed financial infrastructure; nothing here is legal or financial advice.

## License

[MIT](LICENSE)
