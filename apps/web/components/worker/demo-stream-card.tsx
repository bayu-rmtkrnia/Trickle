'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { InlineError } from '@/components/ui/inline-error'
import { ApiError } from '@/lib/api/errors'
import { startDemoStream } from '@/lib/api/demo'
import { demoStreamError, workerDashboardCopy } from '@/lib/copy/worker-dashboard'
import { useLocale } from '@/lib/i18n/client'
import type { SessionContextValue } from '@/providers/session-provider'

/**
 * Lets a visitor with no employer start the demo employer's testnet stream
 * (`POST /demo-streams`), so the worker flow can be tried without an invite.
 */
export function DemoStreamCard({
  session,
  walletAddress,
  onStarted,
}: {
  session: Pick<SessionContextValue, 'ensureSession'>
  walletAddress: string
  onStarted(): void
}) {
  const { locale } = useLocale()
  const t = workerDashboardCopy[locale].demo
  const [phase, setPhase] = useState<'idle' | 'starting' | 'started'>('idle')
  const [error, setError] = useState<unknown>(null)

  async function start() {
    if (phase !== 'idle') return
    setPhase('starting')
    setError(null)
    try {
      const token = await session.ensureSession()
      if (!token) throw new ApiError('unauthorized', 'Sesi tidak tersedia', { status: 401 })
      const demo = await startDemoStream(token, walletAddress)
      if (demo.status === 'FAILED') throw new ApiError('server', 'Demo gagal', { status: 502 })
      setPhase('started')
      onStarted()
    } catch (problem) {
      setError(problem)
      setPhase('idle')
    }
  }

  return (
    <div className="rounded-xl border-[1.5px] border-brand-text bg-surface p-4">
      <h3 className="font-bold">{t.title}</h3>
      <p className="mt-2 text-label text-muted">{t.body}</p>
      {phase === 'started' ? (
        <p role="status" className="mt-3 text-label font-semibold">
          {t.started}
        </p>
      ) : (
        <Button
          className="mt-3"
          block
          onClick={start}
          loading={phase === 'starting'}
          loadingLabel={t.starting}
        >
          {t.start}
        </Button>
      )}
      {error !== null && (
        <div className="mt-3">
          <InlineError {...demoStreamError(error, locale)} />
        </div>
      )}
    </div>
  )
}
