// Regenerates abi/*.ts (typed `as const` ABIs for viem) from the JSON ABIs that
// `forge inspect <Contract> abi --json` writes. Run after every ABI change:
//   pnpm --filter @trickle/shared abi
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const abiDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'abi')
const contracts = [
  ['TricklePayroll', 'tricklePayrollAbi'],
  ['MockAUSD', 'mockAusdAbi'],
]

for (const [contract, name] of contracts) {
  const abi = JSON.parse(readFileSync(join(abiDir, `${contract}.json`), 'utf8'))
  const source = [
    `// Generated from ${contract}.json by scripts/gen-abi.mjs. Do not edit by hand.`,
    `export const ${name} = ${JSON.stringify(abi, null, 2)} as const`,
    '',
  ].join('\n')
  writeFileSync(join(abiDir, `${contract}.ts`), source)
  console.log(`abi/${contract}.ts`)
}
