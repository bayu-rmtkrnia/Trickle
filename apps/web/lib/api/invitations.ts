import { apiRequest, type ApiRequestOptions } from './client'
import type { Invite } from './types'

type ClientOptions = Pick<ApiRequestOptions, 'baseUrl' | 'fetcher' | 'signal'>

export interface CreateFamilyInvitationInput {
  inviteeName: string
  relation?: string
}

export interface InvitationPage {
  data: Invite[]
  nextCursor: string | null
}

export function getInvitation(code: string, signal?: AbortSignal, options: ClientOptions = {}) {
  return apiRequest<Invite>(`invites/${encodeURIComponent(code)}`, { ...options, signal })
}

export function acceptInvitation(code: string, token: string, options: ClientOptions = {}) {
  return apiRequest<Invite>(`invites/${encodeURIComponent(code)}/acceptance`, {
    ...options,
    method: 'POST',
    token,
  })
}

export function createFamilyInvitation(
  input: CreateFamilyInvitationInput,
  token: string,
  options: ClientOptions = {},
) {
  return apiRequest<Invite>('invites', {
    ...options,
    method: 'POST',
    token,
    body: { ...input, type: 'RECIPIENT' },
  })
}

export function listFamilyInvitations(token: string, cursor?: string, options: ClientOptions = {}) {
  const query = new URLSearchParams({ type: 'RECIPIENT' })
  if (cursor) query.set('cursor', cursor)
  return apiRequest<InvitationPage>(`invites?${query}`, { ...options, token })
}

/** Cancels a pending invite I created (`DELETE /invites/{id}`); 409 once accepted. */
export function cancelInvitation(id: string, token: string, options: ClientOptions = {}) {
  return apiRequest<void>(`invites/${encodeURIComponent(id)}`, {
    ...options,
    method: 'DELETE',
    token,
  })
}
