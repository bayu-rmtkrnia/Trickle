'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { InlineError } from '@/components/ui/inline-error'
import { Sheet } from '@/components/ui/sheet'
import { revokeInvite, type Invite } from '@/lib/api'
import { useEmployerCopy } from './use-employer-copy'

/** Konfirmasi pembatalan undangan. Destruktif = merah; "Tidak jadi" = sekunder (DESIGN.md 5.6). */
export function RevokeInviteSheet({
  invite,
  onClose,
  onRevoked,
}: {
  invite: Invite | null
  onClose: () => void
  onRevoked: () => void
}) {
  const t = useEmployerCopy().copy.revoke
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  function close() {
    setFailed(false)
    onClose()
  }

  async function confirm() {
    if (!invite) return
    setBusy(true)
    setFailed(false)
    try {
      await revokeInvite(invite.id)
      onRevoked()
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={invite !== null}
      onClose={close}
      title={t.title}
      description={invite ? t.body(invite.inviteeName) : undefined}
      footer={
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
      }
    >
      {failed && <InlineError title={t.failed} />}
    </Sheet>
  )
}
