import { Button } from '@/components/ui/button'
import { workerDashboardCopy as t } from '@/lib/copy/worker-dashboard'

export function SalaryCard() {
  return (
    <section
      aria-labelledby="worker-salary-heading"
      className="flex flex-col gap-4 rounded-xl bg-brand-fill p-5 text-on-brand sm:p-6"
    >
      <h2 id="worker-salary-heading" className="text-label">
        {t.salaryLabel}
      </h2>
      <p className="text-2xl/8 font-bold">{t.salaryUnavailable}</p>
      <p className="max-w-prose text-sm/6">{t.salaryBody}</p>
      <div className="mt-2">
        <Button variant="on-brand" block disabled aria-describedby="worker-withdraw-hint">
          {t.withdraw}
        </Button>
        <p id="worker-withdraw-hint" className="mt-2 text-label">
          {t.withdrawHint}
        </p>
      </div>
    </section>
  )
}
