/**
 * Writes the OpenAPI spec to apps/api/openapi.json (importable into Postman).
 * Does not need a database: routes are registered but never called.
 */
import { writeFileSync } from 'node:fs'
import { buildApp } from '../src/app.js'
import { loadEnv } from '../src/env.js'

const env = loadEnv({
  DATABASE_URL: 'postgresql://unused:unused@localhost:5432/unused',
  JWT_SECRET: 'x'.repeat(32),
  ...process.env,
  NODE_ENV: 'test',
})
const app = await buildApp({ env })
await app.ready()
const spec = app.swagger()
const out = new URL('../openapi.json', import.meta.url)
writeFileSync(out, JSON.stringify(spec, null, 2) + '\n')
console.log(`wrote ${out.pathname}`)
await app.close()
