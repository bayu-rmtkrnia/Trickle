import type { Metadata } from 'next'
import { FamilyDashboard } from '@/components/family/family-dashboard'
import { familyDashboardCopy } from '@/lib/copy/family'
import { getLocale } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${familyDashboardCopy[await getLocale()].title} | Trickle` }
}

export default function FamilyPage() {
  return <FamilyDashboard />
}
