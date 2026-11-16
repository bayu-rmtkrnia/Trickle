import type { Metadata } from 'next'
import { WorkerDashboard } from '@/components/worker/worker-dashboard'
import { workerDashboardCopy } from '@/lib/copy/worker-dashboard'
import { getLocale } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${workerDashboardCopy[await getLocale()].title} | Trickle` }
}

export default function WorkerPage() {
  return <WorkerDashboard />
}
