import type { Metadata } from 'next'
import { WorkerLanding } from '@/components/landing/worker-landing'
import { landingCopy } from '@/lib/copy/landing'
import { getLocale } from '@/lib/i18n/server'
import { SIDE_PARAM, WORKER_PARAM_VALUE } from '@/lib/side'

export async function generateMetadata(): Promise<Metadata> {
  const { meta } = landingCopy[await getLocale()].worker
  return { title: meta.title, description: meta.description }
}

/**
 * Landing sisi pekerja. Selalu diawali layar pilihan pekerja/perusahaan, kecuali
 * dibuka lewat `/?sisi=pekerja` (mis. link "Lihat halaman untuk pekerja" di footer).
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const showChooser = (await searchParams)[SIDE_PARAM] !== WORKER_PARAM_VALUE
  return <WorkerLanding locale={await getLocale()} showChooser={showChooser} />
}
