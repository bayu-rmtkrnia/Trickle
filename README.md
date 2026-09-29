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
| Auth | Sign-In with Ethereum (EIP-4361) over the user's passkey account, JWT sessions |
| Chain access | [viem](https://viem.sh) on Monad testnet (chain id 10143) |
| Testing | Vitest (unit + integration against Postgres), Postman collection |
| Tooling | pnpm workspaces, ESLint, Prettier, GitHub Actions CI, gitleaks secret scanning, Docker Compose |
| Smart contract (planned) | Solidity + Foundry, `TricklePayroll.sol` |
| Web app (planned) | Next.js PWA |
| Integrations (planned) | Mera passkey accounts, AUSD, Xendit/Flip sandbox payouts |

## Project structure

```
Trickle/
├── .github/workflows/ci.yml        # Lint, typecheck, tests, OpenAPI drift check, secret scan
├── apps/
│   └── api/                        # Backend API (this milestone)
│       ├── prisma/
│       │   ├── schema.prisma       # Database schema (metadata only; money lives on-chain)
│       │   └── migrations/         # SQL migrations
│       ├── postman/
│       │   └── Trickle.postman_collection.json
│       ├── scripts/
│       │   ├── sign.ts             # Dev helper: sign a login challenge for Postman
│       │   ├── export-openapi.ts   # Writes openapi.json
│       │   └── gen-postman.ts      # Writes the Postman collection
│       ├── src/
│       │   ├── index.ts            # Server entry point
│       │   ├── app.ts              # Fastify app: plugins, Swagger, routes
│       │   ├── env.ts              # Environment variable validation
│       │   ├── types.ts            # Fastify / JWT type augmentation
│       │   ├── lib/                # chain (viem), fx, prisma, errors, shared schemas
│       │   ├── plugins/            # auth (JWT), uniform error handling
│       │   └── routes/             # health, auth, employers, invites, gas, fx
│       ├── test/                   # Vitest unit + integration tests
│       ├── openapi.json            # Generated API spec (import into Postman / FE codegen)
│       └── .env.example
├── docs/                           # Plans and project docs
├── docker-compose.yml              # Local Postgres
├── LICENSE                         # MIT
└── package.json / pnpm-workspace.yaml
```

## API (Milestone 1)

Interactive docs: `http://localhost:4000/docs`. All errors use `{ "code": "...", "message": "..." }`.

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/health` | – | Service + database status |
| POST | `/auth/challenge` | – | Sign-in message (EIP-4361) with a single-use nonce |
| POST | `/auth/verify` | – | Verify the signed message → session token |
| GET | `/auth/me` | ✓ | Current user and roles (employer / worker / family) |
| POST | `/employers` | ✓ | Create company profile |
| GET, PATCH | `/employers/me` | ✓ | Read / update company profile |
| GET | `/employers/me/workers` | ✓ | Workers who joined via invite |
| POST | `/invites` | ✓ | Worker invite (employer) or family invite (worker) |
| GET | `/invites` | ✓ | Invites I created |
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
cp apps/api/.env.example apps/api/.env       # then set JWT_SECRET
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
2. Postman cannot sign messages, so get a login body from the CLI:
   ```bash
   cd apps/api
   pnpm sign employer      # also: worker, family
   ```
   Paste the printed JSON into **Verify (employer)** etc. The token is saved automatically.
3. Run the folders top to bottom. They follow the flow employer → worker invite → family invite.

`pnpm sign <name>` uses a throwaway key derived from the name. Never use it for real funds.

## Status

Hackathon prototype, built for Monad Metropolis. Not licensed financial infrastructure; nothing here is legal or financial advice.

## License

[MIT](LICENSE)
