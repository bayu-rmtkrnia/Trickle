# TricklePayroll: Contract Spec

Source of truth for scope: [`PLAN.md` §6.2](PLAN.md#62-spec-kontrak-draft-difinalkan-sc-di-f0). This file pins down the details PLAN leaves open. Owner: SC.

Status: v2 (12 Oct 2026): split supports up to 3 recipients. v1 (9 Oct, single recipient) is retired; see §8. Network: Monad testnet (chain id `10143`).

## 1. Model

- One ERC-20 token per deployment, passed to the constructor (never hardcoded). On testnet this is `MockAUSD` (see §6).
- An employer creates a **prefunded** stream for one worker: the full `amount` is pulled at creation. No top-ups, no rate changes, no pause (PLAN §3.3 Won't).
- Wages unlock linearly between `start` and `end`:

  ```
  streamed = amount * (min(now, end) - start) / (end - start)   // 0 before start, amount after end
  ```

  Using `amount * elapsed / duration` instead of `rate * elapsed` means the worker always ends up with exactly `amount`, with no rounding dust left behind.
- An employer may create any number of streams, including several for the same worker.
- Each worker has **one split list** of up to `MAX_RECIPIENTS = 3` entries (`recipient`, `bps`) that applies to every stream they withdraw from. Each recipient gets its share directly in the withdraw tx (push, not claim), so family members never need gas or an extra step.

## 2. Functions

| Function | Caller | Behavior |
| --- | --- | --- |
| `createStream(worker, amount, start, end) → streamId` | anyone (becomes the stream's employer) | Pulls `amount` with `transferFrom` (employer must `approve` first). `start = 0` means "start now" (`block.timestamp`). Stream ids start at 1. |
| `withdraw(streamId)` | stream's worker only | Sends everything currently withdrawable. For each split entry, `available * bps / 10_000` (rounded down) goes to that recipient in the same tx; the rest, including rounding dust, goes to the worker. |
| `setSplits(Split[] splits)` | any worker (keyed by `msg.sender`) | Replaces the whole list. 0 to 3 entries, no zero address, no duplicates, each `bps > 0`, total `bps <= 10_000`. An empty array turns the split off. If validation fails, the old list stays. |
| `cancel(streamId)` | stream's employer only | Freezes the stream at what has streamed so far and refunds the rest to the employer immediately. The worker can still withdraw the frozen amount. |
| `getStream(id)` | view | Full `Stream` struct. |
| `streamedAmount(id)` | view | Unlocked so far (frozen after cancel). |
| `withdrawable(id)` | view | `streamedAmount - withdrawn`. |
| `splitsOf(worker)` | view | `Split[]` (`{recipient, bps}`), in the order they were set. Empty when off. |
| `splitBpsOf(worker, recipient)` | view | That recipient's `bps` in the worker's list, `0` if not in it. Use this for "is this family member still receiving a split?" checks. |
| `MAX_RECIPIENTS()` | view | `3`. |
| `token()`, `nextStreamId()` | view | Token address, next id to be assigned. |

### Validation (custom errors)

| Error | When |
| --- | --- |
| `ZeroAddress()` | `worker == 0` in `createStream`; zero token in constructor |
| `ZeroAmount()` | `amount == 0` |
| `InvalidTimeRange()` | `end <= effectiveStart`, or `start` given but in the past |
| `StreamNotFound(id)` | id never created |
| `NotWorker(id)` / `NotEmployer(id)` | wrong caller for `withdraw` / `cancel` |
| `NothingToWithdraw(id)` | withdrawable is 0 (before start, or already withdrawn) |
| `StreamAlreadyCanceled(id)` | `cancel` twice |
| `StreamAlreadyEnded(id)` | `cancel` after `end` (nothing left to refund) |
| `InvalidSplit()` | an entry with `recipient == 0` or `bps == 0`, or total `bps > 10_000` |
| `TooManyRecipients()` | more than 3 entries |
| `DuplicateRecipient(recipient)` | the same recipient twice |

## 3. Events (for the listener / indexer)

All amounts are raw token units (6 decimals for mAUSD). Timestamps are unix seconds.

```solidity
event StreamCreated(uint256 indexed streamId, address indexed employer, address indexed worker,
                    uint128 amount, uint40 start, uint40 end);
event Withdrawn(uint256 indexed streamId, address indexed worker, uint128 toWorker,
                uint128 toRecipients);
event SplitPaid(uint256 indexed streamId, address indexed worker, address indexed recipient,
                uint128 amount);
event SplitUpdated(address indexed worker, Split[] splits);
event StreamCanceled(uint256 indexed streamId, uint128 streamedAtCancel, uint128 refunded);
```

| Event | Emitted by | Listener notes |
| --- | --- | --- |
| `StreamCreated` | `createStream` | `start` is the effective start (already resolved from `0`). Map `worker` → `User.address` (lowercase). |
| `Withdrawn` | `withdraw` | `toRecipients = 0` when no split. Total withdrawn = `toWorker + toRecipients`. |
| `SplitPaid` | `withdraw` | One per recipient whose share is non-zero, emitted right after `Withdrawn` in the same tx. `sum(amount) == toRecipients`. Filter by `recipient` to get what a family member received. |
| `SplitUpdated` | `setSplits` | Carries the full new list (empty = off). The latest event per worker is the current split. |
| `StreamCanceled` | `cancel` | Employer and worker are not in the event; read them from `StreamCreated` (same `streamId`) or `getStream`. `refunded` went to the employer in the same tx. |

Stream status, derived off-chain or via `getStream`:
- **scheduled**: `now < start`
- **streaming**: `start <= now < end` and not canceled
- **canceled**: `canceled == true`
- **ended**: `now >= end` and not canceled
- **settled**: `withdrawn == streamedAmount` and (ended or canceled); nothing more will move

For the API's "delete worker → 409 while a stream is active" rule (PLAN §4.2), "active" = not settled.

## 4. Storage and Monad

```solidity
struct Stream {
  address employer; uint40 start; uint40 end; bool canceled; // slot 0
  address worker;                                            // slot 1
  uint128 amount; uint128 withdrawn;                         // slot 2
  uint128 refunded;                                          // slot 3
}
mapping(uint256 => Stream) streams;
mapping(address => Split[]) splits; // Split { address recipient; uint16 bps; }, max 3 entries
uint256 nextStreamId;               // written only by createStream
```

`withdraw` writes only to its own `streams[id]`; it reads `splits[worker]` and never writes a contract-wide counter or total. Withdrawals by different workers therefore do not conflict inside `TricklePayroll`, so Monad can run them in parallel.

To be honest about the limits: every withdrawal still changes the token's `balanceOf(TricklePayroll)` slot inside the ERC-20 contract, and that slot is shared. Monad handles this through optimistic execution plus re-execution, so it costs some re-execution but stays correct. Our contract adds no shared writes of its own.

## 5. Security

- `nonReentrant` on `createStream`, `withdraw`, `cancel`; checks-effects-interactions; `SafeERC20`.
- Employers can never take back wages that have already streamed. `cancel` refunds only `amount - streamedAtCancel`.
- No admin, owner or upgradeability. Nobody can move a stream's funds except its worker (streamed part) and its employer (unstreamed part, through `cancel`).
- Invariants (tested later, PLAN F2): for every stream `withdrawn + refunded <= amount`, and the contract's token balance = Σ(`amount - withdrawn - refunded`).
- Known limits: fee-on-transfer and rebasing tokens are not supported (AUSD and mAUSD are neither). If any split recipient's address cannot receive the token (for example, blacklisted by a real stablecoin), `withdraw` reverts until the worker removes that recipient with `setSplits`.
- Gas (Foundry gas report, cold recipients): `withdraw` costs about 73k with no split, 99k with 1 recipient, and 162k with 3 recipients. The cap of 3 keeps it bounded.

## 6. MockAUSD (testnet only)

**MOCK TOKEN, not real money.** Name `Mock AUSD`, symbol `mAUSD`, 6 decimals, `mint(to, amount)` open to anyone (demo funding, no faucet). It extends OpenZeppelin `ERC20Permit`, but `TricklePayroll` does not use permit; funding is `approve` + `createStream` (Privy embedded wallets have no confirmation popup).

Before switching to real AUSD: check its decimals and whether it supports permit, then deploy a new `TricklePayroll` with the AUSD address.

## 7. Hand-off

Published in `packages/shared/`:
- `deployments/testnet.json`: chain id, addresses, deploy block, deploy tx hash
- `abi/TricklePayroll.json`, `abi/MockAUSD.json`

FE: run the per-second balance locally from `start`, `end`, `amount` and `withdrawn` using the formula in §1; re-sync on `Withdrawn`/`StreamCanceled` or after the user's own tx (PLAN F1). Do not poll the RPC every second.

## 8. Changelog

### v2 (12 Oct 2026): multiple split recipients

The original product plan let a worker send to more than one family member; v1 shipped with a single recipient. v2 restores that. **Breaking ABI change, new contract address.** The v1 deployment (`0xE7292E79…652e`) is retired; streams on it are not migrated (testnet data). The mAUSD token is unchanged, so existing balances stay.

| v1 | v2 |
| --- | --- |
| `setSplit(address recipient, uint16 bps)` | `setSplits(Split[] splits)` (max 3) |
| `splitOf(worker) → (recipient, bps)` | `splitsOf(worker) → Split[]`, plus `splitBpsOf(worker, recipient) → uint16` |
| `Withdrawn(streamId, worker, toWorker, recipient, toRecipient)` | `Withdrawn(streamId, worker, toWorker, toRecipients)` + one `SplitPaid(streamId, worker, recipient, amount)` per recipient |
| `SplitUpdated(worker, recipient, bps)` | `SplitUpdated(worker, Split[] splits)` |
| | New errors: `TooManyRecipients()`, `DuplicateRecipient(address)` |

### Migrating to v2 with viem

Checked against the v2 deployment with viem 2.56: the selectors and event topics below match `packages/shared/abi/TricklePayroll.json`. The shared JSON ABI works at runtime but is untyped once imported; this human-readable ABI gives typed `args`.

```ts
import { parseAbi, parseEventLogs, type Address } from 'viem'

export const payrollAbi = parseAbi([
  'struct Split { address recipient; uint16 bps; }',
  'function splitsOf(address worker) view returns (Split[])',
  'function splitBpsOf(address worker, address recipient) view returns (uint16)',
  'function setSplits(Split[] splits)',
  'function withdraw(uint256 streamId)',
  'event Withdrawn(uint256 indexed streamId, address indexed worker, uint128 toWorker, uint128 toRecipients)',
  'event SplitPaid(uint256 indexed streamId, address indexed worker, address indexed recipient, uint128 amount)',
])
```

**Read the split list** (worker dashboard). Returns `readonly { recipient: Address; bps: number }[]`; empty when the split is off.

```ts
const splits = await publicClient.readContract({
  address: payroll,
  abi: payrollAbi,
  functionName: 'splitsOf',
  args: [worker],
})
```

**API: is this recipient still in the split?** Replaces the v1 `splitOf` comparison for `409 SPLIT_ACTIVE`.

```ts
const bps = await publicClient.readContract({
  address: payroll,
  abi: payrollAbi,
  functionName: 'splitBpsOf',
  args: [worker, recipient],
})
if (bps > 0) throw conflict('SPLIT_ACTIVE', '...')
```

**Set or clear the split.** The list is replaced as a whole, so send every recipient the worker wants to keep.

```ts
await walletClient.writeContract({
  address: payroll,
  abi: payrollAbi,
  functionName: 'setSplits',
  args: [[{ recipient: siti, bps: 2_000 }, { recipient: budi, bps: 1_000 }]], // 20% + 10%
})
// Turn off: args: [[]]
```

**Preview before withdrawing.** Same math as the contract, so the numbers match to the unit.

```ts
function previewSplit(gross: bigint, splits: readonly { recipient: Address; bps: number }[]) {
  const shares = splits.map((s) => ({ recipient: s.recipient, amount: (gross * BigInt(s.bps)) / 10_000n }))
  const toRecipients = shares.reduce((sum, s) => sum + s.amount, 0n)
  return { toWorker: gross - toRecipients, shares }
}
```

**Read the result from the withdraw receipt.** Recipients whose share rounded to 0 have no `SplitPaid` log.

```ts
const receipt = await publicClient.waitForTransactionReceipt({ hash })
const logs = parseEventLogs({ abi: payrollAbi, logs: receipt.logs, eventName: ['Withdrawn', 'SplitPaid'] })
const withdrawn = logs.find((l) => l.eventName === 'Withdrawn')?.args // { streamId, worker, toWorker, toRecipients }
const paid = logs.flatMap((l) => (l.eventName === 'SplitPaid' ? [l.args] : [])) // [{ recipient, amount }, ...]
```
