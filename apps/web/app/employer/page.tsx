import type { Metadata } from 'next'
import { EmployerDashboard } from '@/components/employer/employer-dashboard'
import { EMPLOYER_STATES, pickDevState } from '@/lib/dev-state'

export const metadata: Metadata = { title: 'Dashboard · Trickle' }

export default async function EmployerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { state } = await searchParams
  const devState = pickDevState(state, EMPLOYER_STATES)
  // key: ganti ?state = mulai dari awal (data dan tab tidak terbawa).
  return <EmployerDashboard key={devState ?? 'default'} devState={devState} />
}
