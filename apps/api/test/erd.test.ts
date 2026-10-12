import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Keeps docs/erd.md (rubric K2) in step with the Prisma schema: every table,
 * every column and every migration must appear there. Relations and notes are
 * still written by hand.
 */
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const schema = read('../prisma/schema.prisma')
const erd = read('../../../docs/erd.md')

const SCALARS = new Set(['String', 'Int', 'BigInt', 'Float', 'Boolean', 'DateTime'])
const enums = new Set([...schema.matchAll(/^enum (\w+) \{/gm)].map((m) => m[1]))

/** Columns of each model; relation fields (other models) are skipped. */
const models = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)].map(([, name, body]) => ({
  name: name!,
  columns: [...body!.matchAll(/^\s+(\w+)\s+(\w+)[?[\]]*/gm)]
    .filter(([, , type]) => SCALARS.has(type!) || enums.has(type!))
    .map(([, column]) => column!),
}))

/** The attribute block of an entity in the mermaid diagram. */
const entity = (name: string) =>
  erd.match(new RegExp(`^ {4}${name} \\{([\\s\\S]*?)^ {4}\\}`, 'm'))?.[1]

describe('docs/erd.md', () => {
  it('reads the schema', () => {
    expect(models.length).toBeGreaterThan(5)
  })

  it.each(models)('shows table $name with all its columns', ({ name, columns }) => {
    const block = entity(name)
    expect(block, `${name} is missing from the diagram`).toBeDefined()
    for (const column of columns) {
      expect(block, `${name}.${column}`).toMatch(new RegExp(`\\s${column}\\b`))
    }
  })

  it('lists every migration', () => {
    const migrations = readdirSync(new URL('../prisma/migrations', import.meta.url)).filter((d) =>
      /^\d{14}_/.test(d),
    )
    for (const m of migrations) expect(erd, m).toContain(`\`${m}\``)
  })
})
