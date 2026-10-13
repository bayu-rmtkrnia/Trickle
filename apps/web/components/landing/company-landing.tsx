import { landingCopy } from '@/lib/copy/landing'
import type { Locale } from '@/lib/i18n/config'
import { CompanyPreview } from './company-preview'
import { Closing, Faq, Hero, HowItWorks, LandingShell, RowList, SIGN_IN_HREF } from './shared'

/** Landing sisi perusahaan (`/perusahaan`). */
export function CompanyLanding({ locale }: { locale: Locale }) {
  const t = landingCopy[locale]
  const c = t.company
  return (
    <LandingShell t={t} side="company">
      <Hero
        title={c.hero.title}
        subtitle={c.hero.subtitle}
        body={c.hero.body}
        actions={[
          { href: SIGN_IN_HREF.company, label: c.hero.primary, variant: 'inverse' },
          { href: '#cara-kerja', label: c.hero.secondary, variant: 'on-brand' },
        ]}
        visual={<CompanyPreview p={c.hero.preview} locale={locale} />}
      />
      <RowList id="benefits-title" title={c.benefits.title} rows={c.benefits.rows} />
      <HowItWorks title={c.how.title} steps={c.how.steps} />
      <Faq title={c.faq.title} items={c.faq.items} />
      <Closing
        title={c.closing.title}
        body={c.closing.body}
        action={{ href: SIGN_IN_HREF.company, label: c.closing.action }}
        testNote={t.testNote}
      />
    </LandingShell>
  )
}
