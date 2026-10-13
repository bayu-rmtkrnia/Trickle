'use client'

import { Button } from '@/components/ui/button'
import { CheckCircleIcon } from '@/components/ui/icons'
import { InlineError } from '@/components/ui/inline-error'
import { Sheet } from '@/components/ui/sheet'
import type { useStreamFunding } from '@/hooks/use-stream-funding'
import { fundingErrorMessage } from '@/lib/funding-error'
import { useEmployerCopy } from './use-employer-copy'

type Funding = ReturnType<typeof useStreamFunding>

/**
 * Konfirmasi "Hentikan aliran" (PLAN §3.3 Should). Destruktif = merah; "Tidak jadi" =
 * sekunder (DESIGN.md 5.6). Bagian yang sudah mengalir tetap milik pekerja.
 */
export function StopStreamSheet({
  target,
  onClose,
  funding,
}: {
  target: { streamId: string; name: string } | null
  onClose: () => void
  funding: Funding
}) {
  const { copy, locale } = useEmployerCopy()
  const t = copy.stopSheet
  const { state } = funding
  const working = state.phase === 'working'
  const done = state.phase === 'success' && state.kind === 'cancel'

  function close() {
    onClose()
    if (!working) funding.reset()
  }

  return (
    <Sheet
      open={target !== null}
      onClose={close}
      title={done ? t.successTitle : t.title}
      description={done || !target ? undefined : t.body(target.name)}
      footer={
        done ? (
          <Button block onClick={close}>
            {t.done}
          </Button>
        ) : (
          <>
            <Button
              variant="danger"
              block
              loading={working}
              loadingLabel={t.confirming}
              onClick={() => target && void funding.cancel(target.streamId)}
            >
              {t.confirm}
            </Button>
            <Button variant="secondary" block onClick={close} disabled={working}>
              {t.cancel}
            </Button>
          </>
        )
      }
    >
      {done && <CheckCircleIcon className="size-8 text-success" />}
      {state.phase === 'failed' && (
        <InlineError
          title={copy.fundSheet.failedTitle}
          message={fundingErrorMessage(state.error, locale)}
        />
      )}
      {state.phase === 'unknown' && (
        <InlineError title={copy.fundSheet.unknownTitle} message={copy.fundSheet.unknownBody} />
      )}
    </Sheet>
  )
}
