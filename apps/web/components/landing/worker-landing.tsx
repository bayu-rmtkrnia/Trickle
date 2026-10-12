import { landingCopy, type LandingCopy } from '@/lib/copy/landing'
import type { Locale } from '@/lib/i18n/config'
import { SalaryCalculator } from './salary-calculator'
import { RoleChooser } from './role-chooser'
import { Section, SectionTitle } from './section'
import { Closing, Faq, Hero, HowItWorks, LandingShell, SIGN_IN_HREF } from './shared'
import { TickingCard } from './ticking-card'

/**
 * Landing sisi pekerja (`/`). `showChooser`: kunjungan pertama tanpa pilihan tersimpan,
 * tampilkan layar pilihan pekerja/perusahaan di atasnya (di luar #landing-root).
 */
export function WorkerLanding({ locale, showChooser }: { locale: Locale; showChooser: boolean }) {
  const t = landingCopy[locale]
  const w = t.worker
  return (
    <>
      <LandingShell t={t} side="worker">
        <Hero
          title={w.hero.title}
          subtitle={w.hero.subtitle}
          body={w.hero.body}
          actions={[
            { href: SIGN_IN_HREF.worker, label: w.hero.primary, variant: 'inverse' },
            { href: '#cara-kerja', label: w.hero.secondary, variant: 'on-brand' },
          ]}
          hint={w.hero.hint}
          visual={<TickingCard />}
        />
        <Compare c={w.compare} />
        <HowItWorks title={w.how.title} steps={w.how.steps} />
        <Section labelledBy="calc-title">
          <SectionTitle id="calc-title">{w.calculator.title}</SectionTitle>
          <SalaryCalculator />
        </Section>
        <Faq title={w.faq.title} items={w.faq.items} />
        <Closing
          title={w.closing.title}
          body={w.closing.body}
          action={{ href: SIGN_IN_HREF.worker, label: w.closing.action }}
          hint={w.closing.hint}
          testNote={t.testNote}
        />
      </LandingShell>
      {showChooser && <RoleChooser />}
    </>
  )
}

/** Tabel "Biasanya vs Dengan Trickle": baris bertumpuk di HP, tiga kolom di layar lebar. */
function Compare({ c }: { c: LandingCopy['worker']['compare'] }) {
  return (
    <Section labelledBy="compare-title">
      <SectionTitle id="compare-title">{c.title}</SectionTitle>
      <div className="mt-6">
        <div
          aria-hidden="true"
          className="hidden gap-x-10 pb-3 text-label text-muted md:grid md:grid-cols-[0.8fr_1.2fr_1.2fr]"
        >
          <span />
          <span>{c.usually}</span>
          <span className="text-brand-text">{c.withTrickle}</span>
        </div>
        {c.rows.map((row) => (
          <div
            key={row.topic}
            data-reveal
            className="grid gap-x-10 gap-y-2 border-t border-muted/30 py-5 md:grid-cols-[0.8fr_1.2fr_1.2fr]"
          >
            <h3 className="text-title">{row.topic}</h3>
            <p className="text-muted">
              <span className="font-semibold md:sr-only">{c.usually}: </span>
              {row.usually}
            </p>
            <p className="font-semibold text-brand-text">
              <span className="md:sr-only">{c.withTrickle}: </span>
              {row.withTrickle}
            </p>
          </div>
        ))}
        <p data-reveal className="border-t border-muted/30 pt-4 text-label text-muted">
          {c.source}
        </p>
      </div>
    </Section>
  )
}
