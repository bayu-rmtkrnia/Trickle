import type { Metadata } from 'next'
import { WorkerDashboard } from '@/components/worker/worker-dashboard'

export const metadata: Metadata = { title: 'Dashboard worker | Trickle' }

export default function WorkerPage() {
  return <WorkerDashboard />
}
