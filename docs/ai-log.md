# AI Usage Log

Format (PLAN §8.5): date · area · tool · what AI helped with · what a human decided or reviewed.

## 2026-10-09 · contracts (SC: Jaki) · Claude Code (Claude Opus 5.5)

**What the AI did**
- Read PLAN.md, ARCHITECTURE.md and the API code, and pointed out where my brief (root `CLAUDE.md`) contradicted PLAN §6.2 (rate/top-up/pause model, SIWE + JWT auth that no longer exists).
- Set up the Foundry project in `contracts/` (OpenZeppelin v5.4.0, forge-std v1.10.0 as submodules) and added the Foundry folders to `.prettierignore`.
- Drafted `docs/contract-spec.md` from PLAN §6.2.
- Wrote `ITricklePayroll.sol`, `TricklePayroll.sol`, `MockAUSD.sol`, the deploy script, and the tests (33 unit, 4 fuzz, 5 invariant).
- Ran Slither and drafted `docs/security.md`, including the reasoning behind each finding's verdict.
- Exported the ABIs to `packages/shared/abi/` and simulated the deploy against Monad testnet (no broadcast).

**Decided by me (human)**
- PLAN §6.2 is the source of truth; the conflicting design in my brief is dropped.
- D3: MockAUSD (6 decimals, open mint, labeled mock, ERC20Permit allowed), token address as a constructor parameter, no `createStreamWithPermit` because the team uses Privy embedded wallets.
- Scope: contract only for now. The listener in `apps/api/src/chain/` and the Envio indexer wait until the contract is live and ownership is agreed with Aga.
- Priority order (core functions + tests first, invariant + Slither after), commit split, draft PR that must not be merged before deployment.
- The deployer key stays with me (keystore via `cast wallet import`); the AI never sees it.

**Proposed by the AI, approved by me**
- `start = 0` means "start now", and a start in the past reverts.
- `cancel` after `end` reverts (`StreamAlreadyEnded`).
- `setSplit(address(0), bps > 0)` reverts. (v2: `setSplits` rejects a zero address or zero bps.)
- Split rounding favors the worker.
- Slither verdicts: `incorrect-equality` is a false positive, `timestamp` is accepted by design.
- The honest note that the token's `balanceOf` slot is still shared across parallel withdrawals on Monad.

**Corrected along the way**
- The AI's first `forge install` put the libraries in the repo-root `lib/` instead of `contracts/lib/`. It removed them and reinstalled after adding `contracts/foundry.toml`.
- The first draft of `docs/security.md` counted the reentrancy test twice (once in "Unit" and once on its own); the wording was fixed.

**Reviewed manually**
- Before any code was written, I checked myself that there is no official AUSD on Monad testnet; that is why we use MockAUSD.
- I rewrote my brief (`CLAUDE.md`) after the AI pointed out the conflicts with PLAN, and gave the decisions above (source of truth, D3, scope, priorities) in writing.
- I set the commit rule: only my GitHub identity on commits and PRs, AI use disclosed here instead.

## 2026-10-10 · contracts (SC: Jaki) · Claude Code (Claude Opus 5.5)

**What the AI did**
- Fixed `foundry.toml` so the deploy uses the public Monad RPC instead of a missing `MONAD_RPC_URL` variable.
- Prepared the deploy command; after the deploy, checked both contracts on-chain and on Sourcify and filled `packages/shared/deployments/testnet.json`.

**Decided by me (human)**
- I ran the deploy myself with my keystore (`--account trickle-deployer`) and typed the password myself.

**Reviewed manually**
- I read the deploy output and passed the addresses on; the AI then confirmed them on-chain and on Sourcify.

## 2026-10-12 · contracts (SC: Jaki) · Claude Code (Claude Opus 5.5)

**What the AI did**
- Laid out the trade-offs of supporting several split recipients (gas, a blocked recipient blocking `withdraw`, push vs pull, ABI break, redeploy) and checked which API and web code already depended on the single-recipient ABI.
- Implemented v2: `setSplits(Split[])` with at most 3 recipients, `splitsOf`, `splitBpsOf`, the `SplitPaid` event. Updated the unit, fuzz and invariant tests (50 total), re-ran Slither, and updated `docs/contract-spec.md` (including a v1 → v2 changelog and viem migration snippets checked against the deployment) and `docs/security.md`.
- Wrote `script/Smoke.s.sol`, tested it on a local anvil node, then checked the testnet run on-chain (balances, events, split cleared).
- Drafted the hand-off message for the API and web owners and the description for PR #28.

**Decided by me (human)**
- Multiple recipients, because that was our original plan; max 3; new function names (`setSplits`/`splitsOf`) so old code fails loudly instead of silently; reuse the existing MockAUSD so balances stay.
- I deployed v2 and ran both smoke test steps myself with my keystore.
- PR #28 waits until the API and worker dashboard are migrated, so they merge together.

**Corrected along the way**
- The first deploy command was written for Git Bash; I ran it in PowerShell and it failed. The AI rewrote it for PowerShell.
- Slither flagged two locals that relied on default zero values (`uninitialized-local`); they are now initialized explicitly.
- The AI assumed the submission deadline was 12 Oct 21:00 and pushed for a rushed plan; the real deadline is 14 Oct, and I corrected it.

**Reviewed manually**
- I questioned the single-recipient design myself: I read PLAN §6.2 and saw it does not say one recipient only, and I asked for the trade-offs before deciding.
- I approved the v2 design point by point (max 3, new function names, reuse MockAUSD) before the AI changed any code.
- I ran the v2 deploy and both smoke test steps, and read the output: `Token` was the existing mAUSD, and the withdraw paid 70 / 20 / 10 mAUSD.
- I sent the hand-off message to the API and web owners myself.
