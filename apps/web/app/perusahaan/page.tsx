import type { Metadata } from 'next'
import { CompanyLanding } from '@/components/landing/company-landing'
import { landingCopy } from '@/lib/copy/landing'
import { getLocale } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const { meta } = landingCopy[await getLocale()].company
  return { title: meta.title, description: meta.description }
}

/** Landing sisi perusahaan. Sisi pekerja ada di `/`. */
export default async function CompanyPage() {
  return <CompanyLanding locale={await getLocale()} />
}
