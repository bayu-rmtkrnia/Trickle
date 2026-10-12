import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { it } from 'node:test'
import { mockAusdAbi } from '../abi/MockAUSD.ts'
import { tricklePayrollAbi } from '../abi/TricklePayroll.ts'

const json = (name: string) =>
  JSON.parse(readFileSync(new URL(`../abi/${name}.json`, import.meta.url), 'utf8'))

it('typed ABIs match the JSON that forge exported (run `pnpm --filter @trickle/shared abi`)', () => {
  assert.deepEqual(tricklePayrollAbi, json('TricklePayroll'))
  assert.deepEqual(mockAusdAbi, json('MockAUSD'))
})

it('the payroll ABI is v2 (multi-recipient split)', () => {
  const names = new Set(tricklePayrollAbi.map((item) => ('name' in item ? item.name : item.type)))
  for (const name of ['setSplits', 'splitsOf', 'splitBpsOf', 'MAX_RECIPIENTS', 'SplitPaid']) {
    assert.ok(names.has(name), name)
  }
  assert.ok(!names.has('splitOf') && !names.has('setSplit'), 'v1 functions are gone')
})
