# TricklePayroll: Contract Spec

Source of truth for scope: [`PLAN.md` §6.2](PLAN.md#62-spec-kontrak-draft-difinalkan-sc-di-f0). This file pins down the details PLAN leaves open. Owner: SC.

Status: v1 (9 Oct 2026). Network: Monad testnet (chain id `10143`).

## 1. Model

- One ERC-20 token per deployment, passed to the constructor (never hardcoded). On testnet this is `MockAUSD` (see §6).
- An employer creates a **prefunded** stream for one worker: the full `amount` is pulled at creation. No top-ups, no rate changes, no pause (PLAN §3.3 Won't).
- Wages unlock linearly between `start` and `end`:

  ```
  streamed = amount * (min(now, end) - start) / (end - start)   // 0 before start, amount after end
  ```

  Using `amount * elapsed / duration` instead of `rate * elapsed` means the worker always ends up with exactly `amount`, with no rounding dust left behind.
- An employer may create any number of streams, including several for the same worker.
- Each worker has **one split setting** (`recipient`, `bps`) that applies to every stream they withdraw from.

## 2. Functions

| Function | Caller | Behavior |
| --- | --- | --- |
| `createStream(worker, amount, start, end) → streamId` | anyone (becomes the stream's employer) | Pulls `amount` with `transferFrom` (employer must `approve` first). `start = 0` means "start now" (`block.timestamp`). Stream ids start at 1. |
| `withdraw(streamId)` | stream's worker only | Sends everything currently withdrawable. If the worker has a split, `available * bps / 10_000` goes to the recipient in the same tx and the rest to the worker. |
| `setSplit(recipient, bps)` | any worker (keyed by `msg.sender`) | `bps` in `0..10_000`. `recipient = address(0)` turns the split off (then `bps` must be 0). |
| `cancel(streamId)` | stream's employer only | Freezes the stream at what has streamed so far and refunds the rest to the employer immediately. The worker can still withdraw the frozen amount. |
| `getStream(id)` | view | Full `Stream` struct. |
| `streamedAmount(id)` | view | Unlocked so far (frozen after cancel). |
| `withdrawable(id)` | view | `streamedAmount - withdrawn`. |
| `splitOf(worker)` | view | `(recipient, bps)`. |
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
| `InvalidSplit()` | `bps > 10_000`, or `recipient == 0` with `bps != 0` |

## 3. Events (for the listener / indexer)

All amounts are raw token units (6 decimals for mAUSD). Timestamps are unix seconds.

```solidity
event StreamCreated(uint256 indexed streamId, address indexed employer, address indexed worker,
                    uint128 amount, uint40 start, uint40 end);
event Withdrawn(uint256 indexed streamId, address indexed worker, uint128 toWorker,
                address indexed recipient, uint128 toRecipient);
event SplitUpdated(address indexed worker, address indexed recipient, uint16 bps);
event StreamCanceled(uint256 indexed streamId, uint128 streamedAtCancel, uint128 refunded);
```

| Event | Emitted by | Listener notes |
| --- | --- | --- |
| `StreamCreated` | `createStream` | `start` is the effective start (already resolved from `0`). Map `worker` → `User.address` (lowercase). |
| `Withdrawn` | `withdraw` | `recipient = 0x0` and `toRecipient = 0` when no split. Total withdrawn = `toWorker + toRecipient`. |
| `SplitUpdated` | `setSplit` | Latest event per worker is the current split. |
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
mapping(address => Split) splits;   // Split { address recipient; uint16 bps; }
uint256 nextStreamId;               // written only by createStream
```

`withdraw` writes only to its own `streams[id]`; it reads `splits[worker]` and never writes a contract-wide counter or total. Withdrawals by different workers therefore do not conflict inside `TricklePayroll`, so Monad can run them in parallel.

To be honest about the limits: every withdrawal still changes the token's `balanceOf(TricklePayroll)` slot inside the ERC-20 contract, and that slot is shared. Monad handles this through optimistic execution plus re-execution, so it costs some re-execution but stays correct. Our contract adds no shared writes of its own.

## 5. Security

- `nonReentrant` on `createStream`, `withdraw`, `cancel`; checks-effects-interactions; `SafeERC20`.
- Employers can never take back wages that have already streamed. `cancel` refunds only `amount - streamedAtCancel`.
- No admin, owner or upgradeability. Nobody can move a stream's funds except its worker (streamed part) and its employer (unstreamed part, through `cancel`).
- Invariants (tested later, PLAN F2): for every stream `withdrawn + refunded <= amount`, and the contract's token balance = Σ(`amount - withdrawn - refunded`).
- Known limits: fee-on-transfer and rebasing tokens are not supported (AUSD and mAUSD are neither). If the split recipient's address cannot receive the token (for example, blacklisted by a real stablecoin), `withdraw` reverts until the worker changes or clears the split.

## 6. MockAUSD (testnet only)

**MOCK TOKEN, not real money.** Name `Mock AUSD`, symbol `mAUSD`, 6 decimals, `mint(to, amount)` open to anyone (demo funding, no faucet). It extends OpenZeppelin `ERC20Permit`, but `TricklePayroll` does not use permit; funding is `approve` + `createStream` (Privy embedded wallets have no confirmation popup).

Before switching to real AUSD: check its decimals and whether it supports permit, then deploy a new `TricklePayroll` with the AUSD address.

## 7. Hand-off

Published in `packages/shared/`:
- `deployments/testnet.json`: chain id, addresses, deploy block, deploy tx hash
- `abi/TricklePayroll.json`, `abi/MockAUSD.json`

FE: run the per-second balance locally from `start`, `end`, `amount` and `withdrawn` using the formula in §1; re-sync on `Withdrawn`/`StreamCanceled` or after the user's own tx (PLAN F1). Do not poll the RPC every second.
