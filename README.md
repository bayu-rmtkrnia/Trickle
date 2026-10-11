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
| Database | PostgreSQL 16, Prisma 7 ORM + migrations |
| Auth | [Privy](https://privy.io) embedded wallets; the API exchanges the Privy access token for its own revocable session token. Roles derived from DB relations (RBAC guards) |
| Chain access | [viem](https://viem.sh) on Monad testnet (chain id 10143) |
| Testing | Vitest (unit + integration against Postgres), Postman collection |
| Tooling | pnpm workspaces, ESLint, Prettier, GitHub Actions CI, gitleaks secret scanning, Docker Compose |
| Smart contract (planned) | Solidity + Foundry, `TricklePayroll.sol` |
| Web app (in progress) | Next.js + Privy (`apps/web`) |
| Integrations (planned) | AUSD, Xendit/Flip sandbox payouts |

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
│       │   ├── lib/                # chain (viem), fx, privy, prisma, errors, pagination, roles, tokens, shared schemas
│       │   ├── plugins/            # auth (session tokens), rbac (requireRole / requireOwnership), uniform error handling
│       │   └── modules/            # health, sessions, users, employers, invites, gas, fx; each one has:
│       │       └── <resource>/     #   routes → controller → service → repository, plus schemas (Zod)
│       ├── test/                   # Vitest unit + integration tests
│       ├── openapi.json            # Generated API spec (import into Postman / FE codegen)
│       └── .env.example
│   └── web/                        # Next.js web app (Privy login)
├── docs/                           # Plans, roadmap, ARCHITECTURE.md
├── docker-compose.yml              # Local Postgres
├── LICENSE                         # MIT
└── package.json / pnpm-workspace.yaml
```

## API (v1)

Interactive docs: `http://localhost:4000/docs`. All errors use `{ "error": { "code": "...", "message": "...", "details": ... } }`. Schema validation failures return 422 with one `details` entry per invalid field; unreadable bodies (e.g. broken JSON) return 400.

**Auth** column: – public, ✓ any signed-in user, *Employer* only accounts with a company profile (others get 403). Roles come from data, not a stored field: see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

Resource endpoints below are relative to the `/api/v1` prefix, e.g. `GET /api/v1/users/me`. Only `/health` and `/docs` live at the root. List endpoints (marked *paged*) take `?limit=` (1–100, default 20) and `?cursor=`, and return `{ "data": [...], "nextCursor": "..." }`; pass `nextCursor` back as `cursor` until it is `null`.

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/health` (root) | – | Service + database status |
| POST | `/sessions` | – | Exchange a Privy access token for a session token |
| DELETE | `/sessions/current` | ✓ | Sign out (revoke this session token) |
| GET | `/users/me` | ✓ | Current user and roles (employer / worker / family) |
| PATCH | `/users/me` | ✓ | Update my display name |
| POST | `/employers` | ✓ | Create company profile |
| GET | `/employers/me` | ✓ | Read my company profile (404 if none yet) |
| PATCH | `/employers/me` | Employer | Update company profile |
| GET | `/employers/me/workers` | Employer | Workers who joined via invite (paged) |
| POST | `/invites` | ✓ | Worker invite (employer) or family invite (worker) |
| GET | `/invites` | ✓ | Invites I created (paged) |
| GET | `/invites/:code` | – | Public invite details |
| POST | `/invites/:code/accept` | ✓ | Accept an invite |
| POST | `/gas/drip` | ✓ | Sponsor gas for a new account, once per address |
| GET | `/gas/status` | – | Treasury balance and daily usage |
| GET | `/fx/usd-idr` | – | USD→IDR rate with cache and fallback |

Planned for the next milestone: `/payouts`, `/webhooks/payout`, `/demo/try-as-worker` (they depend on the deployed contract and payout sandbox).

## Running locally

Requirements: Node.js 22+, pnpm 10, Docker.

```bash
pnpm install
pnpm db:up                                   # Postgres on localhost:5433
cp apps/api/.env.example apps/api/.env       # then set PRIVY_APP_ID and PRIVY_APP_SECRET
pnpm db:migrate
pnpm dev                                     # API on http://localhost:4000
```

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
3. Run the folders top to bottom. They follow the flow employer → worker invite → family invite, and end with sign-out.

`pnpm session <name>` always maps a name to the same throwaway address and refuses to run with `NODE_ENV=production`.

## Status

Hackathon prototype, built for Monad Metropolis. Not licensed financial infrastructure; nothing here is legal or financial advice.

## License

[MIT](LICENSE)
