# TricklePayroll: Security Notes

Scope: `contracts/src/TricklePayroll.sol` and `contracts/src/mocks/MockAUSD.sol`. Hackathon prototype on Monad testnet. **Not audited.** Design: [`contract-spec.md`](contract-spec.md).

Last updated: 12 Oct 2026 (v2: up to 3 split recipients).

## 1. Design properties

| Property | How it is enforced |
| --- | --- |
| Employers cannot claw back streamed wages | `cancel` refunds only `amount - streamedAtCancel` and freezes the stream at that point |
| Only the worker can withdraw | `withdraw` checks `msg.sender == stream.worker` |
| Only the employer can cancel | `cancel` checks `msg.sender == stream.employer` |
| No admin keys | No owner, no pause, no upgrade, no rescue function. Funds move only through `withdraw` and `cancel` |
| Reentrancy | `nonReentrant` on every function that moves tokens, plus checks-effects-interactions (state is updated and the event is emitted before any transfer) |
| Token transfers | OpenZeppelin `SafeERC20` |
| Split bounds | At most 3 recipients, no zero address, no duplicates, each `bps > 0`, total `bps <= 10_000`, so the shares can never exceed what is withdrawn. Bounded loop keeps `withdraw` gas capped (~162k with 3 recipients) |
| No rounding dust | `streamed = amount * elapsed / duration`, so the stream pays exactly `amount` at `end`; split rounding favors the worker |

## 2. Tests

Run with `cd contracts && forge test`.

| Kind | What it covers |
| --- | --- |
| Unit (41, incl. the reentrancy test below) | Every function's success path and every custom-error revert, cancel before start / mid-stream / after partial withdraw, split with 1 and 3 recipients, off, 100%, zero shares, list replacement, duplicate / too many / total over 100% |
| Fuzz (4 × 1000 runs) | `streamed` is monotonic and bounded and equals `amount` at end; a 3-recipient split conserves funds and pays each recipient exactly its share; many withdrawals total exactly `amount`; cancel at any time conserves funds |
| Reentrancy | A malicious token re-enters `withdraw` from its transfer hook; reverts with `ReentrancyGuardReentrantCall` |
| Invariant (5 × 256 runs × 64 calls) | Random create / withdraw / cancel / setSplits (0-3 recipients) / warp sequences. Checked: `withdrawn + refunded <= amount` per stream; contract balance = Σ(`amount - withdrawn - refunded`); `withdrawn <= streamed`; deposited = paid out + held; stream ids are sequential |

## 3. Slither

Command (Slither 0.11.6, from `contracts/`):

```bash
slither . --filter-paths "lib/|test/|script/"
```

Result: 6 findings in 3 detectors, no High or Medium issues.

| Detector | Location | Verdict |
| --- | --- | --- |
| `incorrect-equality` | `withdraw`: `available == 0` | **False positive.** The detector warns about strict equality against balances an attacker can change (for example, by sending tokens directly). `available` comes from the stream's own accounting (`streamed - withdrawn`), not from `balanceOf`, so it cannot be manipulated from outside. |
| `timestamp` (4) | `createStream`, `withdraw`, `cancel`, `_streamedAmount` | **Accepted by design.** Salary that unlocks per second has to depend on `block.timestamp`. A validator can shift the timestamp by only a few seconds, which moves at most a few seconds of salary. The same lint is disabled in `foundry.toml` with this reason. |
| `naming-convention` | `MAX_RECIPIENTS()` in the interface | **Informational, kept.** It is the getter of the `public constant MAX_RECIPIENTS`, and UPPER_CASE is the Solidity style for constants. |

v2 also triggered `uninitialized-local` for `toRecipients` and `totalBps`. Both were already 0 by default; they are now initialized explicitly, so the detector is clean.

## 4. Known limits (accepted for the prototype)

- **Token assumptions.** Fee-on-transfer and rebasing tokens are not supported. MockAUSD and AUSD are neither. Before switching to real AUSD, check its decimals, permit support, and whether it can pause or blacklist.
- **Blocked split recipient.** If any split recipient cannot receive the token (for example, a real stablecoin blacklists it), `withdraw` reverts until the worker removes that recipient with `setSplits`. With up to 3 recipients the chance is higher than with 1. We kept push payments (family gets paid in the same tx, no gas or claim step) over a pull/claim pattern, which would avoid this but needs the family to send their own tx. MockAUSD has no blacklist, so this cannot happen on testnet. The worker's funds stay safe in the meantime.
- **Shared token balance slot.** `TricklePayroll` writes no contract-wide state in `withdraw`, but every withdrawal still updates the token's `balanceOf(TricklePayroll)`. On Monad this can cause re-execution of parallel withdrawals; the results stay correct (see contract-spec §4).
- **Open mint on MockAUSD.** Anyone can mint mAUSD. This is intended for demos, and mAUSD has no value.
- **No emergency stop.** We chose not to add an admin pause. That keeps the "nobody can freeze your wages" guarantee simple, but it also means a bug cannot be stopped; the fix would be to deploy a new contract.
