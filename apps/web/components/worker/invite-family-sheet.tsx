'use client'

import { useId, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Field, describedBy, inputClass } from '@/components/ui/field'
import { CheckIcon, CopyIcon } from '@/components/ui/icons'
import { InlineError } from '@/components/ui/inline-error'
import { Sheet } from '@/components/ui/sheet'
import type { Invite } from '@/lib/api/types'
import { familyApiMessage, workerFamilyDictionary } from '@/lib/copy/worker-family'
import { useDict, useLocale } from '@/lib/i18n/client'
import { useCopy } from '@/lib/use-copy'

/** Creates a RECIPIENT invite and shows its link. Mount with a key per opening. */
export function InviteFamilySheet({
  open,
  onClose,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (input: { inviteeName: string; relation?: string }) => Promise<Invite>
}) {
  const strings = useDict(workerFamilyDictionary)
  const t = strings.inviteSheet
  const { locale } = useLocale()
  const formId = useId()
  const nameId = useId()
  const relationId = useId()
  const [name, setName] = useState('')
  const [relation, setRelation] = useState('')
  const [errors, setErrors] = useState<{ name?: string; relation?: string }>({})
  const [failure, setFailure] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<Invite | null>(null)
  const { copied, copy } = useCopy()

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const inviteeName = name.trim()
    const kin = relation.trim()
    const next: typeof errors = {}
    if (!inviteeName || inviteeName.length > 100) next.name = t.nameRequired
    if (kin.length > 40) next.relation = t.relationInvalid
    setErrors(next)
    setFailure(null)
    if (next.name || next.relation) return
    setBusy(true)
    try {
      setCreated(await onCreate(kin ? { inviteeName, relation: kin } : { inviteeName }))
    } catch (problem) {
      setFailure(problem)
    } finally {
      setBusy(false)
    }
  }
  function reset() {
    setName('')
    setRelation('')
    setErrors({})
    setFailure(null)
    setCreated(null)
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        if (busy) return
        reset()
        onClose()
      }}
      title={created ? t.successTitle : t.title}
      description={created ? undefined : t.description}
      footer={
        created ? (
          <>
            <Button block onClick={() => copy(created.url)}>
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? strings.copied : strings.copyLink}
            </Button>
            <Button variant="text" block onClick={reset}>
              {t.another}
            </Button>
          </>
        ) : (
          <Button type="submit" form={formId} block loading={busy} loadingLabel={t.submitting}>
            {t.submit}
          </Button>
        )
      }
    >
      {created ? (
        <div className="flex flex-col gap-3">
          <p role="status">{t.successBody(created.inviteeName)}</p>
          <p className="rounded-xl border-[1.5px] border-muted/50 bg-bg px-4 py-3 font-medium break-all select-all">
            {created.url}
          </p>
        </div>
      ) : (
        <form id={formId} noValidate onSubmit={submit} className="flex flex-col gap-4">
          <Field id={nameId} label={t.name} error={errors.name}>
            <input
              id={nameId}
              autoComplete="off"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={describedBy(nameId, errors.name)}
              className={inputClass(Boolean(errors.name))}
            />
          </Field>
          <Field id={relationId} label={t.relation} hint={t.relationHint} error={errors.relation}>
            <input
              id={relationId}
              autoComplete="off"
              maxLength={40}
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
              aria-invalid={Boolean(errors.relation)}
              aria-describedby={describedBy(relationId, errors.relation, true)}
              className={inputClass(Boolean(errors.relation))}
            />
          </Field>
          {failure !== null && <InlineError {...familyApiMessage(failure, locale)} />}
        </form>
      )}
    </Sheet>
  )
}
