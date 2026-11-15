# Trickle

Trickle is a payroll and remittance web app for Indonesian migrant workers and their families. Employers pay wages through a smart contract on Monad, so a worker's pay builds up every second and can be withdrawn at any time instead of once a month. Part of each withdrawal can go straight to family members in Indonesia, who cash it out to a local bank account.

## Team

Final project for the Web Application Development (Pengembangan Aplikasi Web) course at Universitas Gadjah Mada.

| Name | Student ID | Role |
| ---- | ---------- | ---- |
| Muhammad Affandi Argya Bagaskara | 24/538984/TK/59778 | Backend |
| Razaqi Alkautsar | 24/544958/TK/60570 | Smart contract |
| Bayu Rahmat Kurnia | 24/533736/TK/59139 | Frontend for workers and families |
| Raka Bagus Samudra | 24/543213/TK/60349 | Frontend for employers, UI design |

## Links

| Resource | Link |
| --- | --- |
| Web app | https://trickle-one.vercel.app |
| Demo video | _To be added_ |
| API | https://trickle-production-ff1f.up.railway.app (interactive docs at [`/docs`](https://trickle-production-ff1f.up.railway.app/docs)) |
| Milestone 1 report (initial plan) | [Google Drive (PDF)](https://drive.google.com/file/d/1QpE0x27FLanq6SFl48sUJyDhbVktgnzW/view?usp=sharing) |

## About the app

### Problem

Migrant workers are usually paid once a month. When something urgent comes up in the middle of the month, they cannot use the money they have already earned. Sending part of their salary home also means going through remittance services that charge fees and can take days to arrive.

### How Trickle works

Trickle has three roles. Everyone signs in with an email or Google account, and a wallet is created for them in the background. The app also pays the gas fees for new accounts, so nobody needs to own crypto or understand blockchain to use it.

1. **Employer** creates a company profile, invites workers with a link, and funds each worker's pay for a period. Funding starts a salary stream in the `TricklePayroll` contract, and the employer can stop a stream early.
2. **Worker** accepts the invite and sees their earned balance grow in real time. They can withdraw whenever they need to, invite family members, and choose what percentage of every withdrawal goes to each family member automatically.
3. **Family** accepts the worker's invite, sees each transfer they have received and their balance with an estimate in rupiah, saves a bank account, and requests a cash-out. The backend checks the transfer on-chain before paying out in rupiah, and the family can follow the payout status in the app.

To try the worker side without an invite, sign in on the worker dashboard and press **Coba gaji demo** (Try a demo salary). A demo company then starts a short test salary stream to your account, which you can withdraw and share with family like a real one.

Amounts are shown in US dollars with a rupiah estimate, and the interface is available in Indonesian and English.

### Pages

| Page | Path |
| --- | --- |
| Landing page for workers, with a worker or company chooser | [`/`](https://trickle-one.vercel.app/) |
| Landing page for companies | [`/perusahaan`](https://trickle-one.vercel.app/perusahaan) |
| Company setup | `/employer/setup` |
| Employer dashboard | `/employer` |
| Worker dashboard | `/w` |
| Worker invitation | `/w/invite/<code>` |
| Family dashboard | `/f` |
| Family invitation | `/f/invite/<code>` |

Dashboards need a signed-in account. Invitation pages open from the link the employer or worker shares.

### Current scope

Trickle runs on Monad testnet with a test stablecoin (mock AUSD), so no real money moves. Bank payouts go through a simulated provider. The backend keeps the provider behind an interface, so a real one such as Xendit or Flip can be added later.

### Why Monad

Low fees and fast finality make it practical for workers to withdraw small amounts often, which is what being paid in real time depends on.

## Tech stack

| Part | Technology |
| ---- | ---------- |
| Frontend | Next.js 16, React 19, Tailwind CSS 4 |
| Sign-in and wallets | [Privy](https://privy.io) |
| Backend | Node.js 22, TypeScript, Fastify 5, Zod 4 |
| Database | PostgreSQL with Prisma 7 ([ERD](docs/erd.md)) |
| Smart contract | Solidity and Foundry, `TricklePayroll` on Monad testnet (`0xE7292E797009E9D53102ec132Ef4Ae549cDD652e`) |
| Blockchain access | viem |
| API documentation | OpenAPI with Swagger UI, Postman collection |
| Testing and CI | Vitest, Foundry tests, GitHub Actions |
| Hosting | Vercel for the web app, Railway for the API and database |

## Project structure

```
Trickle/
├── .github/workflows/      CI pipeline
├── apps/
│   ├── api/                Backend API
│   │   ├── prisma/         Database schema and migrations
│   │   ├── src/            Source code
│   │   ├── test/           Tests
│   │   ├── postman/        Postman collection
│   │   ├── openapi.json    API spec
│   │   └── .env.example    Environment variables
│   └── web/                Web app
│       ├── app/            Pages
│       ├── components/     Components for each role
│       ├── lib/            API calls, contract calls, UI text
│       └── providers/      Sign-in and session
├── contracts/              Smart contract
│   ├── src/                Contract source
│   ├── test/               Contract tests
│   └── script/             Deploy scripts
├── packages/shared/        Contract ABI and deployed addresses
└── docs/                   Architecture notes and database diagram
```

Important files deeper in the tree:

| What | Where |
| --- | --- |
| Endpoints, one folder per resource | [`apps/api/src/modules/`](apps/api/src/modules) |
| Server setup | [`apps/api/src/app.ts`](apps/api/src/app.ts) |
| Database schema | [`apps/api/prisma/schema.prisma`](apps/api/prisma/schema.prisma) |
| API calls from the web app | [`apps/web/lib/api/`](apps/web/lib/api) |
| Contract calls from the web app | [`apps/web/lib/chain/`](apps/web/lib/chain) |
| Indonesian and English text | [`apps/web/lib/copy/`](apps/web/lib/copy) |
| Payroll contract | [`contracts/src/TricklePayroll.sol`](contracts/src/TricklePayroll.sol) |
| Deployed contract addresses | [`packages/shared/deployments/testnet.json`](packages/shared/deployments/testnet.json) |
| Architecture notes | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Database diagram | [`docs/erd.md`](docs/erd.md) |

## API

All endpoints start with this base URL:

```
https://trickle-production-ff1f.up.railway.app/api/v1
```

Every endpoint, with its request and response format, can be tried in the interactive docs at [`/docs`](https://trickle-production-ff1f.up.railway.app/docs).

### Signing in

1. The web app signs the user in with Privy and gets a Privy access token.
2. The web app sends that token to `POST /sessions`.
3. The API answers with its own session token, valid for 7 days.
4. Every request that needs a signed-in user sends the session token in a header:

```
Authorization: Bearer <session token>
```

### Errors

Every error has the same shape, so the web app can show a clear message for each `code`:

```json
{ "error": { "code": "COMPANY_NOT_FOUND", "message": "Company not found" } }
```

| Status | Meaning |
| --- | --- |
| 401 | Not signed in, or the session has expired |
| 403 | Signed in, but not allowed to do this |
| 404 | The item does not exist |
| 409 | Conflicts with existing data, for example a company that already exists |
| 422 | Invalid input. `details` lists each invalid field |
| 429 | Too many requests, try again shortly |

### Lists

Endpoints that return a list send 20 items at a time. To get the next page, pass the `nextCursor` value back as `?cursor=` until it becomes `null`.

```json
{ "data": [], "nextCursor": "..." }
```

### Endpoints

In the **Access** column, _Owner_ means only the account that owns that item.

#### Account

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| POST | `/sessions` | Public | Sign in with a Privy access token |
| DELETE | `/sessions/current` | Signed in | Sign out |
| GET | `/users/me` | Signed in | My profile and roles |
| PATCH | `/users/me` | Signed in | Change my display name |
| GET | `/users/me/employments` | Signed in | Companies I work for |
| GET | `/users/me/streams` | Signed in | Salary streams paying me |

#### Companies and workers

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| POST | `/companies` | Signed in | Create a company and become an employer |
| GET, PATCH | `/companies/:id` | Owner | View or edit a company |
| DELETE | `/companies/:id` | Owner | Delete a company (not allowed while it has workers) |
| POST | `/companies/:id/workers` | Owner | Add a worker by wallet address |
| GET | `/companies/:id/workers` | Owner | List workers |
| GET | `/companies/:id/streams` | Owner | List salary streams the company funds |
| GET | `/workers/:id` | Owner or the worker | View a worker |
| PATCH | `/workers/:id` | Owner | Edit a worker |
| DELETE | `/workers/:id` | Owner | Remove a worker (not allowed while their stream is active) |

#### Family, bank accounts, and payouts

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| POST | `/recipients` | Worker | Add a family member by wallet address |
| GET | `/recipients` | Worker | List my family members |
| GET | `/recipients/:id` | Owner or the family member | View a family member |
| PATCH | `/recipients/:id` | Owner | Edit a family member |
| DELETE | `/recipients/:id` | Owner | Remove a family member (not allowed while they still get a share) |
| GET | `/users/me/incoming-transfers` | Signed in | Money my family members sent me from their salary |
| POST | `/bank-accounts` | Family | Add a bank account (the number is stored encrypted) |
| GET | `/bank-accounts` | Family | List my bank accounts |
| GET, PATCH, DELETE | `/bank-accounts/:id` | Owner | View, edit, or remove a bank account |
| POST | `/payouts` | Family | Cash out to a bank account |
| GET | `/payouts` | Family | List my payouts |
| GET | `/payouts/:id` | Owner | View a payout and its latest status |
| POST | `/webhooks/payout-provider` | Provider signature | Payout status updates from the provider |

#### Invites

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| POST | `/invites` | Employer or worker | Invite a worker (employer) or a family member (worker) |
| GET | `/invites` | Employer or worker | List invites I created |
| DELETE | `/invites/:id` | Owner | Cancel an invite that has not been accepted |
| GET | `/invites/:code` | Public | View an invite before signing in |
| POST | `/invites/:code/acceptance` | Signed in | Accept an invite |

#### Gas, exchange rate, and system

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| POST | `/gas-drips` | Signed in | Send gas to my wallet when it runs low |
| GET | `/gas-drips/status` | Public | Gas treasury balance and daily usage |
| POST | `/demo-streams` | Signed in | Start a test salary stream from a demo employer |
| GET | `/demo-streams/status` | Public | Demo employer balance and daily usage |
| GET | `/fx-rates/usd-idr` | Signed in | USD to IDR rate for display |
| GET | `/health` | Public | Server and database status (at the root, without `/api/v1`) |


## Running locally

You need Node.js 22 or newer, pnpm 10, and Docker.

### API

```bash
pnpm install
pnpm db:up                                # start Postgres in Docker
cp apps/api/.env.example apps/api/.env    # fill in PRIVY_APP_ID and PRIVY_APP_SECRET
pnpm db:migrate                           # create the tables
pnpm dev                                  # API at http://localhost:4000
```

Gas sponsorship, bank accounts, and payouts stay switched off until their settings are filled in. Each setting is explained in [`apps/api/.env.example`](apps/api/.env.example).

### Web app

```bash
cp apps/web/.env.example apps/web/.env.local   # fill in NEXT_PUBLIC_PRIVY_APP_ID
pnpm --filter @trickle/web dev                 # web app at http://localhost:3000
```

`NEXT_PUBLIC_API_URL` already points to the local API.

### Tests

The integration tests use a separate database:

```bash
docker compose exec db psql -U trickle -c "CREATE DATABASE trickle_test"
TEST_DATABASE_URL=postgresql://trickle:trickle@localhost:5433/trickle_test pnpm test
```

### Testing with Postman

1. Import [`apps/api/postman/Trickle.postman_collection.json`](apps/api/postman/Trickle.postman_collection.json) and set `baseUrl`.
2. Postman cannot sign in through Privy, so create test sessions from the local database with `pnpm --filter @trickle/api session employer` (also `worker` and `family`). Paste each token into `employerToken`, `workerToken`, and `familyToken`.
3. Run the folders from top to bottom. They follow the app flow from employer to worker to family, and end by signing out.

## Status

Built as the final project for the Web Application Development course and for the Monad Metropolis hackathon. Trickle is a prototype on Monad testnet. It is not a licensed financial service, and nothing here is financial or legal advice.

## License

[MIT](LICENSE)
