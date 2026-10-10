'use client'

import { useId, useState, type FormEvent } from 'react'
import { Button, buttonClass } from '@/components/ui/button'
import { Field, describedBy, inputClass } from '@/components/ui/field'
import { ChatIcon, CheckCircleIcon, CheckIcon, CopyIcon } from '@/components/ui/icons'
import { InlineError } from '@/components/ui/inline-error'
import { Sheet } from '@/components/ui/sheet'
import { createInvite, type Invite } from '@/lib/api'
import { inviteSheetCopy as t } from '@/lib/copy/employer'
import { dailyFromMonthly } from '@/lib/format'
import { useCopy } from '@/lib/use-copy'

/** Angka USD dengan maksimal 2 desimal; koma juga diterima ("800,50"). */
function parseSalary(raw: string): number | 'empty' | 'invalid' | 'too-high' {
  const value = raw.trim().replace(/\s/g, '')
  if (!value) return 'empty'
  if (!/^\d+([.,]\d{1,2})?$/.test(value)) return 'invalid'
  const n = Number(value.replace(',', '.'))
  if (!(n > 0)) return 'invalid'
  if (n > 1_000_000) return 'too-high'
  return n
}

/** Sheet "Undang pekerja" (DESIGN.md 6.7). */
export function InviteWorkerSheet({
  open,
  onClose,
  companyName,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  companyName: string
  onCreated: (invite: Invite) => void
}) {
  const nameId = useId()
  const salaryId = useId()
  const [name, setName] = useState('')
  const [salary, setSalary] = useState('')
  const [errors, setErrors] = useState<{ name?: string; salary?: string }>({})
  const [submitting, setSubmitting] = useState(false)
  const [failed, setFailed] = useState(false)
  const [created, setCreated] = useState<Invite | null>(null)
  const { copied, copy } = useCopy()

  const parsed = parseSalary(salary)
  const perDay = typeof parsed === 'number' ? dailyFromMonthly(parsed) : null

  function reset() {
    setName('')
    setSalary('')
    setErrors({})
    setFailed(false)
    setCreated(null)
  }

  function close() {
    onClose()
    reset()
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    if (!name.trim()) next.name = t.nameRequired
    if (parsed === 'empty') next.salary = t.salaryRequired
    else if (parsed === 'invalid') next.salary = t.salaryInvalid
    else if (parsed === 'too-high') next.salary = t.salaryTooHigh
    setErrors(next)
    setFailed(false)
    if (next.name || next.salary || typeof parsed !== 'number') {
      document.getElementById(next.name ? nameId : salaryId)?.focus()
      return
    }

    setSubmitting(true)
    try {
      const invite = await createInvite({
        type: 'WORKER',
        inviteeName: name.trim(),
        monthlySalaryUsd: parsed,
      })
      setCreated(invite)
      onCreated(invite)
    } catch {
      setFailed(true)
    } finally {
      setSubmitting(false)
    }
  }

  const formId = useId()

  const waHref = created
    ? `https://wa.me/?text=${encodeURIComponent(t.whatsappText(created.inviteeName, companyName, created.url))}`
    : ''

  return (
    <Sheet
      open={open}
      onClose={close}
      title={created ? t.successTitle : t.title}
      description={created ? undefined : t.description}
      footer={
        created ? (
          <>
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass('primary', true)}
            >
              <ChatIcon />
              {t.shareWhatsApp}
            </a>
            <Button variant="secondary" block onClick={() => copy(created.url)}>
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? t.copied : t.copyLink}
            </Button>
            <Button variant="text" block onClick={reset}>
              {t.inviteAnother}
            </Button>
          </>
        ) : (
          <Button
            type="submit"
            form={formId}
            block
            loading={submitting}
            loadingLabel={t.submitting}
          >
            {t.submit}
          </Button>
        )
      }
    >
      {created ? (
        <div className="flex flex-col gap-4">
          <p className="flex items-start gap-2" role="status">
            <CheckCircleIcon className="mt-0.5 shrink-0 text-success" />
            <span>{t.successBody(created.inviteeName)}</span>
          </p>
          <div>
            <p className="text-label text-muted">{t.linkLabel}</p>
            <p className="mt-1 rounded-xl border-[1.5px] border-muted/50 bg-bg px-4 py-3 font-medium break-all select-all">
              {created.url}
            </p>
          </div>
          <p className="sr-only" aria-live="polite">
            {copied ? t.copied : ''}
          </p>
        </div>
      ) : (
        <form id={formId} noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field id={nameId} label={t.nameLabel} error={errors.name}>
            <input
              id={nameId}
              name="inviteeName"
              autoComplete="off"
              maxLength={100}
              placeholder={t.namePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={describedBy(nameId, errors.name)}
              className={inputClass(Boolean(errors.name))}
            />
          </Field>

          <Field
            id={salaryId}
            label={t.salaryLabel}
            error={errors.salary}
            hint={
              perDay !== null ? (
                <>
                  <span className="font-bold text-ink">{t.perDay(perDay)}</span> · {t.perDayHint}
                </>
              ) : (
                t.perDayHint
              )
            }
          >
            <div className="relative">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted"
              >
                $
              </span>
              <input
                id={salaryId}
                name="monthlySalaryUsd"
                inputMode="decimal"
                autoComplete="off"
                placeholder="800"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                aria-invalid={Boolean(errors.salary)}
                aria-describedby={describedBy(salaryId, errors.salary, true)}
                className={`${inputClass(Boolean(errors.salary))} pl-8 tabular-nums`}
              />
            </div>
          </Field>

          {failed && <InlineError title={t.failed} />}
        </form>
      )}
    </Sheet>
  )
}
