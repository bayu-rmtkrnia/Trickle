'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, isApiError } from '@/lib/api/errors'
import {
  cancelInvitation,
  createFamilyInvitation,
  listFamilyInvitations,
  type CreateFamilyInvitationInput,
} from '@/lib/api/invitations'
import { deleteRecipient, listRecipients, type RecipientDto } from '@/lib/api/recipients'
import type { Invite } from '@/lib/api/types'
import type { SessionContextValue } from '@/providers/session-provider'

const unauthorized = () => new ApiError('unauthorized', 'Sesi tidak tersedia', { status: 401 })

/** Loads every page, bounded so a broken cursor cannot loop forever. */
async function all<T extends { id: string }>(
  load: (cursor?: string) => Promise<{ data: T[]; nextCursor: string | null }>,
) {
  const rows = new Map<string, T>()
  let cursor: string | undefined
  for (let page = 0; page < 20; page++) {
    const result = await load(cursor)
    for (const row of result.data) rows.set(row.id, row)
    if (!result.nextCursor || result.nextCursor === cursor) return [...rows.values()]
    cursor = result.nextCursor
  }
  return [...rows.values()]
}

/**
 * The worker's family recipients and RECIPIENT invites. Mount per account.
 * Reads recover a 401 once; mutations are never replayed automatically.
 */
export function useWorkerFamily(session: SessionContextValue) {
  const currentSession = useRef(session)
  const active = useRef(true)
  const [recipients, setRecipients] = useState<RecipientDto[] | null>(null)
  const [invites, setInvites] = useState<Invite[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    currentSession.current = session
  }, [session])

  const token = useCallback(async () => {
    const value = await currentSession.current.ensureSession()
    if (!value) throw unauthorized()
    return value
  }, [])

  useEffect(() => {
    active.current = true
    const controller = new AbortController()
    const signal = controller.signal
    async function read<T>(fn: (token: string) => Promise<T>) {
      try {
        return await fn(await token())
      } catch (problem) {
        if (signal.aborted || !isApiError(problem) || problem.status !== 401) throw problem
        await currentSession.current.refreshMe()
        return fn(await token())
      }
    }
    queueMicrotask(async () => {
      if (signal.aborted) return
      setLoading(true)
      setError(null)
      try {
        const [people, sent] = await Promise.all([
          read((t) => all((cursor) => listRecipients(t, cursor, { signal }))),
          read((t) => all((cursor) => listFamilyInvitations(t, cursor, { signal }))),
        ])
        if (signal.aborted) return
        setRecipients(people)
        setInvites(sent)
      } catch (problem) {
        if (!signal.aborted) setError(problem)
      } finally {
        if (!signal.aborted) setLoading(false)
      }
    })
    return () => {
      active.current = false
      controller.abort()
    }
  }, [reload, token])

  return {
    recipients,
    invites,
    loading,
    error,
    reload: () => setReload((value) => value + 1),
    async invite(input: CreateFamilyInvitationInput) {
      const created = await createFamilyInvitation(input, await token())
      if (active.current)
        setInvites((rows) => [created, ...(rows ?? []).filter((row) => row.id !== created.id)])
      return created
    },
    async cancel(id: string) {
      await cancelInvitation(id, await token())
      if (active.current)
        setInvites((rows) =>
          (rows ?? []).map((row) => (row.id === id ? { ...row, status: 'REVOKED' as const } : row)),
        )
    },
    /** Throws the API error, e.g. 409 `SPLIT_ACTIVE`, for the caller to explain. */
    async remove(id: string) {
      await deleteRecipient(id, await token())
      if (active.current) setRecipients((rows) => (rows ?? []).filter((row) => row.id !== id))
    },
  }
}

export type WorkerFamily = ReturnType<typeof useWorkerFamily>
