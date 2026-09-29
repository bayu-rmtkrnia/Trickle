import { buildApp } from './app.js'
import { loadEnv } from './env.js'

const env = loadEnv()
const app = await buildApp({ env })

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    app.log.info({ signal }, 'shutting down')
    app.close().then(() => process.exit(0))
  })
}

try {
  await app.listen({ port: env.PORT, host: env.HOST })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
