import type { ReactNode } from 'react'
import { DashboardHeader } from '@/components/ui/dashboard-header'
import { familyDashboardCopy as t } from '@/lib/copy/family'

export function FamilyShell({ name, children }: { name?: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh pb-[calc(96px+env(safe-area-inset-bottom))] md:pb-10">
      <DashboardHeader name={name ? t.greeting(name) : undefined} avatarName={name} />
      <main className="mx-auto max-w-[1120px] px-4 pt-2">
        <h1 className="mb-6 text-2xl/8 font-bold">{t.title}</h1>
        {children}
      </main>
    </div>
  )
}
