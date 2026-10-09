import { api, type ApiClient } from '../lib/api'
import type { CursorPage, PageQuery, Worker } from '../types/api'

// Protected metadata only; live testing awaits backend Privy verification.
// No worker CRUD or stream endpoints exist in the current backend.
export function listWorkers(
  query: PageQuery = {},
  client: ApiClient = api,
): Promise<CursorPage<Worker>> {
  return client.request('/employers/me/workers', { query: { ...query }, auth: true })
}
