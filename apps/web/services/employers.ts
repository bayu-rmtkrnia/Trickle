import { api, type ApiClient } from '../lib/api'
import type { CreateEmployerInput, Employer, UpdateEmployerInput } from '../types/api'

// Protected services: live Privy testing is blocked by backend auth migration.
// The default client rejects these calls before making a network request.
export function createEmployer(
  input: CreateEmployerInput,
  client: ApiClient = api,
): Promise<Employer> {
  return client.request('/employers', { method: 'POST', body: input, auth: true })
}

export function getEmployer(client: ApiClient = api): Promise<Employer> {
  return client.request('/employers/me', { auth: true })
}

export function updateEmployer(
  input: UpdateEmployerInput,
  client: ApiClient = api,
): Promise<Employer> {
  return client.request('/employers/me', { method: 'PATCH', body: input, auth: true })
}
