import { api, type ApiClient } from '../lib/api'
import type { CreateInviteInput, CursorPage, Invite, ListInvitesQuery } from '../types/api'

/** Public: backend validates and normalizes the code. No token is sent. */
export function getInvite(code: string, client: ApiClient = api): Promise<Invite> {
  return client.request(`/invites/${encodeURIComponent(code)}`)
}

// Everything below is protected; live testing awaits backend Privy verification.
export function listInvites(
  query: ListInvitesQuery = {},
  client: ApiClient = api,
): Promise<CursorPage<Invite>> {
  return client.request('/invites', { query: { ...query }, auth: true })
}

/** WORKER requires company ownership; FAMILY requires an employer-worker relation. */
export function createInvite(input: CreateInviteInput, client: ApiClient = api): Promise<Invite> {
  return client.request('/invites', { method: 'POST', body: input, auth: true })
}

export function acceptInvite(code: string, client: ApiClient = api): Promise<Invite> {
  return client.request(`/invites/${encodeURIComponent(code)}/accept`, {
    method: 'POST',
    auth: true,
  })
}
