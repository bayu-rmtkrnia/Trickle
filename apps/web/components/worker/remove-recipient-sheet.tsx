'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { InlineError } from '@/components/ui/inline-error'
import { Sheet } from '@/components/ui/sheet'
import { isApiError } from '@/lib/api/errors'
import type { RecipientDto } from '@/lib/api/recipients'
import { familyApiMessage, workerFamilyCopy } from '@/lib/copy/worker-family'

const t = workerFamilyCopy.removeSheet

export function RemoveRecipientSheet({
  recipient,
  onClose,
  onRemove,
  onEditSplit,
}: {
  recipient: RecipientDto | null
  onClose: () => void
  onRemove: (id: string) => Promise<void>
  onEditSplit: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<unknown>(null)
  const splitActive = isApiError(failure) && failure.code === 'SPLIT_ACTIVE'

  function close() {
    if (busy) return
    setFailure(null)
    onClose()
  }
  async function confirm() {
    if (!recipient || busy) return
    setBusy(true)
    setFailure(null)
    try {
      await onRemove(recipient.id)
      setBusy(false)
      onClose()
    } catch (problem) {
      setBusy(false)
      setFailure(problem)
    }
  }

  return (
    <Sheet
      open={recipient !== null}
      onClose={close}
      title={t.title}
      description={recipient ? t.body(recipient.displayName) : undefined}
      footer={
        splitActive ? (
          <>
            <Button
              block
              onClick={() => {
                setFailure(null)
                onEditSplit()
              }}
            >
              {t.openSplit}
            </Button>
            <Button variant="secondary" block onClick={close}>
              {t.cancel}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="danger"
              block
              loading={busy}
              loadingLabel={t.confirming}
              onClick={confirm}
            >
              {t.confirm}
            </Button>
            <Button variant="secondary" block onClick={close} disabled={busy}>
              {t.cancel}
            </Button>
          </>
        )
      }
    >
      {failure !== null && <InlineError {...familyApiMessage(failure)} />}
    </Sheet>
  )
}
