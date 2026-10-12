import type { Metadata } from 'next'
import { FamilyDashboard } from '@/components/family/family-dashboard'

export const metadata: Metadata = { title: 'Dashboard keluarga | Trickle' }

export default function FamilyPage() {
  return <FamilyDashboard />
}
