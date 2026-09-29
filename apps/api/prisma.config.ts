import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Not env('DATABASE_URL'): that throws when unset, which breaks `prisma generate`
  // in build steps that don't have the database URL.
  datasource: { url: process.env.DATABASE_URL ?? '' },
})
