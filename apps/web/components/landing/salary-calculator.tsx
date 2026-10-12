'use client'

import { useId, useState } from 'react'
import { ESTIMATE_RATE_IDR_PER_USD, landingCopy } from '@/lib/copy/landing'
import { formatIdr, formatIdrShort, formatUsd } from '@/lib/format'
import { useLocale } from '@/lib/i18n/client'
import { INTL_LOCALE, type Locale } from '@/lib/i18n/config'

/** Rupiah kecil (per detik) tetap terbaca: satu desimal di bawah Rp10. */
function formatSmallIdr(n: number, locale: Locale) {
  const digits = n < 10 ? 1 : 0
  return `Rp${new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits: digits }).format(n)}`
}

function Slider({
  id,
  label,
  display,
  valueText,
  ...input
}: {
  id: string
  label: string
  display: string
  valueText: string
  min: number
  max: number
  step: number
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-label text-muted">
          {label}
        </label>
        <output htmlFor={id} className="font-display text-[32px]/9">
          {display}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={input.min}
        max={input.max}
        step={input.step}
        value={input.value}
        onChange={(e) => input.onChange(Number(e.target.value))}
        aria-valuetext={valueText}
        className="mt-1 h-11 w-full cursor-pointer accent-brand-text"
      />
    </div>
  )
}

/**
 * Kalkulator gaji (estimasi lokal, tanpa API). Hasilnya berbentuk struk,
 * mengikuti konsep "kertas dicetak" di DESIGN.md 9.
 */
export function SalaryCalculator() {
  const { locale } = useLocale()
  const t = landingCopy[locale].worker.calculator
  const salaryId = useId()
  const familyId = useId()
  const [salaryUsd, setSalaryUsd] = useState(800)
  const [familyPct, setFamilyPct] = useState(30)

  const monthlyIdr = salaryUsd * ESTIMATE_RATE_IDR_PER_USD
  const familyIdr = (monthlyIdr * familyPct) / 100
  const rows = [
    { label: t.forYou, value: formatIdrShort(monthlyIdr - familyIdr, locale), strong: true },
    { label: t.forFamily, value: formatIdrShort(familyIdr, locale), strong: true },
    { label: t.perDay, value: formatIdr(monthlyIdr / 30, locale), strong: false },
    { label: t.perSecond, value: formatSmallIdr(monthlyIdr / 30 / 86_400, locale), strong: false },
  ]

  return (
    <div data-reveal className="mt-6 grid gap-8 md:grid-cols-2 md:gap-12">
      <div className="flex flex-col gap-5">
        <Slider
          id={salaryId}
          label={t.salaryLabel}
          display={formatUsd(salaryUsd, locale)}
          valueText={formatUsd(salaryUsd, locale)}
          min={200}
          max={3000}
          step={50}
          value={salaryUsd}
          onChange={setSalaryUsd}
        />
        <Slider
          id={familyId}
          label={t.familyLabel}
          display={`${familyPct}%`}
          valueText={t.familyValueText(familyPct)}
          min={0}
          max={100}
          step={5}
          value={familyPct}
          onChange={setFamilyPct}
        />
      </div>

      <div className="rounded-2xl bg-bg px-5 py-4">
        <p className="text-label text-muted">{t.receiptTitle}</p>
        <dl className="mt-2 divide-y divide-dashed divide-muted/40 tabular-nums">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3 py-2.5">
              <dt className={row.strong ? '' : 'text-muted'}>{row.label}</dt>
              <dd className={row.strong ? 'text-lg font-bold' : 'font-semibold'}>≈ {row.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-label text-muted">
          {t.rateNote(formatIdr(ESTIMATE_RATE_IDR_PER_USD, locale))}
        </p>
      </div>
    </div>
  )
}
