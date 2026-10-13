'use client'

import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, inputClass } from '@/components/ui/field'
import { CheckCircleIcon, CheckIcon, ChevronDownIcon } from '@/components/ui/icons'
import { InlineError } from '@/components/ui/inline-error'
import { Sheet } from '@/components/ui/sheet'
import type { useStreamFunding, FundingStep } from '@/hooks/use-stream-funding'
import type { CompanyStream, Worker } from '@/lib/api'
import { payrollConfig } from '@/lib/chain/config'
import {
  DAY_IN_SECONDS,
  DEFAULT_FUNDING_PERIOD,
  FUNDING_PERIODS,
  fundingUnits,
  nextStartSeconds,
  unitsToUsd,
  type FundingPeriod,
} from '@/lib/company-streams'
import { formatDateShort, formatUsd } from '@/lib/format'
import { fundingErrorMessage } from '@/lib/funding-error'
import { useEmployerCopy } from './use-employer-copy'

type Funding = ReturnType<typeof useStreamFunding>

const FUND_STEPS: FundingStep[] = ['preparing', 'minting', 'approving', 'creating']

/** Sheet "Danai gaji": satu pekerja, satu periode, dikunci di kontrak lalu mengalir tiap detik. */
export function FundSheet({
  open,
  onClose,
  workers,
  streams,
  initialWorkerId,
  nowSeconds,
  funding,
}: {
  open: boolean
  onClose: () => void
  workers: Worker[]
  streams: CompanyStream[]
  initialWorkerId: string | null
  /** Waktu muat dashboard, untuk tampilan. Saat dikirim, waktu dihitung ulang. */
  nowSeconds: number
  funding: Funding
}) {
  const { copy, locale } = useEmployerCopy()
  const t = copy.fundSheet
  const workerId = useId()
  const [selected, setSelected] = useState<string | null>(initialWorkerId)
  const [period, setPeriod] = useState<FundingPeriod>(DEFAULT_FUNDING_PERIOD)
  // Disimpan saat dikirim, supaya pesan sukses memakai pekerja dan tanggal yang didanai.
  const [submitted, setSubmitted] = useState<{ name: string; end: number } | null>(null)

  const worker = workers.find((w) => w.id === (selected ?? initialWorkerId)) ?? workers[0] ?? null
  const plan = (now: number) => {
    const start = worker ? nextStartSeconds(worker, streams, now) : 0
    return { start, end: (start || now) + period * DAY_IN_SECONDS }
  }
  const { start, end } = plan(nowSeconds)
  const units = worker ? fundingUnits(worker.monthlySalaryUsd, period) : BigInt(0)
  const amount = formatUsd(unitsToUsd(units), locale)
  const date = (seconds: number) => formatDateShort(new Date(seconds * 1000).toISOString(), locale)

  function close() {
    onClose()
    if (funding.state.phase !== 'working') {
      funding.reset()
      setSubmitted(null)
      setSelected(null)
      setPeriod(DEFAULT_FUNDING_PERIOD)
    }
  }

  function submit() {
    if (!worker) return
    // Hitung ulang dari waktu sekarang supaya periode yang dikunci tetap utuh.
    const fresh = plan(Math.floor(Date.now() / 1000))
    setSubmitted({ name: worker.displayName, end: fresh.end })
    void funding.fund({ worker, units, start: fresh.start, end: fresh.end })
  }

  const { state } = funding
  const working = state.phase === 'working'

  let body: React.ReactNode
  let footer: React.ReactNode

  if (state.phase === 'success' && state.kind === 'fund' && submitted) {
    body = (
      <p role="status" className="flex items-start gap-2">
        <CheckCircleIcon className="mt-0.5 shrink-0 text-success" />
        <span>
          <span className="block font-bold">{t.successTitle}</span>
          {t.successBody(submitted.name, date(submitted.end))}
        </span>
      </p>
    )
    footer = (
      <Button block onClick={close}>
        {t.done}
      </Button>
    )
  } else if (working) {
    const currentIndex = FUND_STEPS.indexOf(state.step)
    body = (
      <div role="status" aria-live="polite">
        <ol className="flex flex-col gap-3">
          {FUND_STEPS.map((step, i) => {
            const done = i < currentIndex
            const now = i === currentIndex
            return (
              <li
                key={step}
                className={`flex items-center gap-3 ${now ? 'font-bold text-ink' : done ? 'text-ink' : 'text-muted'}`}
              >
                <span
                  aria-hidden="true"
                  className={`grid size-7 shrink-0 place-items-center rounded-full border-[1.5px] ${
                    done || now ? 'border-brand-text text-brand-text' : 'border-muted/50'
                  }`}
                >
                  {done ? (
                    <CheckIcon className="size-4" />
                  ) : now ? (
                    <span className="size-3 animate-spin rounded-full border-2 border-current border-r-transparent" />
                  ) : null}
                </span>
                {t.steps[step]}
              </li>
            )
          })}
        </ol>
        <p className="mt-4 text-label text-muted">{t.stepsNote}</p>
      </div>
    )
  } else if (state.phase === 'unknown') {
    body = <InlineError title={t.unknownTitle} message={t.unknownBody} />
    footer = (
      <Button variant="secondary" block onClick={close}>
        {t.done}
      </Button>
    )
  } else {
    const failed = state.phase === 'failed'
    body = (
      <div className="flex flex-col gap-4">
        <Field id={workerId} label={t.workerLabel}>
          <div className="relative">
            <select
              id={workerId}
              value={worker?.id ?? ''}
              onChange={(e) => setSelected(e.target.value)}
              className={`${inputClass()} appearance-none pr-11`}
            >
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.displayName} · {formatUsd(w.monthlySalaryUsd, locale)}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-muted" />
          </div>
        </Field>

        <fieldset>
          <legend className="text-label">{t.periodLabel}</legend>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {FUNDING_PERIODS.map((days) => (
              <label
                key={days}
                className={`grid min-h-11 cursor-pointer place-items-center rounded-xl border-[1.5px] px-2 text-center font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-text ${
                  period === days
                    ? 'border-brand-text bg-brand-text text-on-brand'
                    : 'border-muted text-ink'
                }`}
              >
                <input
                  type="radio"
                  name="funding-period"
                  value={days}
                  checked={period === days}
                  onChange={() => setPeriod(days)}
                  className="sr-only"
                />
                {t.period(days)}
              </label>
            ))}
          </div>
        </fieldset>

        {worker && (
          <div className="rounded-xl bg-bg px-4 py-3">
            <p className="text-label text-muted">{t.amountLabel}</p>
            <p className="font-display text-[32px]/9 text-ink">{amount}</p>
            <p className="text-label text-muted">
              {t.perDay(formatUsd(worker.monthlySalaryUsd / 30, locale))}
            </p>
            <p className="mt-2 text-label">
              {start ? t.startAfter(date(start), date(end)) : t.startNow(date(end))}
            </p>
          </div>
        )}

        {payrollConfig.isMock && <p className="text-label text-muted">{t.testNote}</p>}

        {failed && (
          <InlineError title={t.failedTitle} message={fundingErrorMessage(state.error, locale)} />
        )}
      </div>
    )
    footer = (
      <Button block onClick={submit} disabled={!worker || !funding.ready}>
        {failed ? t.retry : t.submit(amount)}
      </Button>
    )
  }

  return (
    <Sheet open={open} onClose={close} title={t.title} description={t.description} footer={footer}>
      {body}
    </Sheet>
  )
}
