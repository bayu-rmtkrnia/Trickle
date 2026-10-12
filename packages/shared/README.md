# @trickle/shared

Contract artifacts for `apps/api` and `apps/web`. Owner: SC. Spec: [`docs/contract-spec.md`](../../docs/contract-spec.md).

| Path | What |
| --- | --- |
| `deployments/testnet.json` | Chain id, addresses, deploy blocks, tx hashes (TricklePayroll v2 + MockAUSD) |
| `abi/*.json` | ABIs exported by `forge inspect` |
| `abi/*.ts` | The same ABIs as `as const`, so viem infers argument, return and event types. Generated, do not edit |
| `split.ts` | `validateSplits`, `previewSplit`, `percentToBps`, `bpsToPercent`, `MAX_RECIPIENTS`: the contract's split rules, client side |

## Usage (apps/web)

No `transpilePackages` or path alias needed; import by relative path, like the JSON files today. Checked with `tsc` and `next build` in `apps/web` (Next 16, viem 2.56).

```ts
import { tricklePayrollAbi } from '../../../../packages/shared/abi/TricklePayroll'
import { percentToBps, previewSplit, validateSplits } from '../../../../packages/shared/split'

// Typed: readonly { recipient: `0x${string}`; bps: number }[]
const splits = await client.readContract({
  address: payroll,
  abi: tricklePayrollAbi,
  functionName: 'splitsOf',
  args: [worker],
})

// Before sending setSplits: same rules as the contract, so no gas is wasted on a revert.
const error = validateSplits(draft) // null | { code: 'TOO_MANY_RECIPIENTS' | 'DUPLICATE_RECIPIENT' | ... }

// Before withdrawing: same rounding as withdraw, so it matches the receipt exactly.
const { toWorker, toRecipients, shares } = previewSplit(withdrawable, splits)
```

Use `percentToBps("12.5")` for percentage inputs: `0.07 * 10000` in floating point is `700.0000000000001`, which the contract would reject.

## After an ABI change

```bash
cd contracts && forge inspect TricklePayroll abi --json > ../packages/shared/abi/TricklePayroll.json
pnpm --filter @trickle/shared abi    # regenerate abi/*.ts
pnpm --filter @trickle/shared test   # fails if .ts and .json drift apart
```
