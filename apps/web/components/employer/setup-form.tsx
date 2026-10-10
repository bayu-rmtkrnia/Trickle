'use client'

import { useRouter } from 'next/navigation'
import { useId, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Field, describedBy, inputClass } from '@/components/ui/field'
import { ChevronDownIcon } from '@/components/ui/icons'
import { InlineError } from '@/components/ui/inline-error'
import { createEmployer, isApiError } from '@/lib/api'
import { COUNTRIES, setupCopy as t } from '@/lib/copy/employer'

/** Onboarding employer (DESIGN.md 6.3). */
export function EmployerSetupForm() {
  const router = useRouter()
  const nameId = useId()
  const countryId = useId()
  const [name, setName] = useState('')
  const [country, setCountry] = useState<string>(COUNTRIES[0].code)
  const [nameError, setNameError] = useState<string>()
  const [submitError, setSubmitError] = useState<'failed' | 'conflict'>()
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    const error = !trimmed ? t.nameRequired : trimmed.length < 2 ? t.nameTooShort : undefined
    setNameError(error)
    setSubmitError(undefined)
    if (error) {
      document.getElementById(nameId)?.focus()
      return
    }
    setSubmitting(true)
    try {
      await createEmployer({ name: trimmed, country })
      router.push('/employer')
    } catch (err) {
      setSubmitError(isApiError(err) && err.kind === 'conflict' ? 'conflict' : 'failed')
      setSubmitting(false)
    }
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-1 flex-col gap-6">
      <div>
        <p className="text-label text-muted">{t.step}</p>
        <h1 className="mt-1 text-2xl/8 font-bold">{t.title}</h1>
        <p className="mt-2 text-muted">{t.intro}</p>
      </div>

      <div className="flex flex-col gap-4">
        <Field id={nameId} label={t.nameLabel} error={nameError}>
          <input
            id={nameId}
            name="name"
            autoComplete="organization"
            maxLength={100}
            placeholder={t.namePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={Boolean(nameError)}
            aria-describedby={describedBy(nameId, nameError)}
            className={inputClass(Boolean(nameError))}
          />
        </Field>

        <Field id={countryId} label={t.countryLabel}>
          <div className="relative">
            <select
              id={countryId}
              name="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className={`${inputClass()} appearance-none pr-11`}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-muted" />
          </div>
        </Field>
      </div>

      {submitError === 'failed' && <InlineError title={t.failedTitle} message={t.failedMessage} />}
      {submitError === 'conflict' && (
        <InlineError title={t.conflictTitle} action={{ label: t.toDashboard, href: '/employer' }} />
      )}

      <div className="mt-auto pt-4">
        <Button type="submit" block loading={submitting} loadingLabel={t.submitting}>
          {t.submit}
        </Button>
      </div>
    </form>
  )
}
