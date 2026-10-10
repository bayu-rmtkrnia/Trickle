import type { Metadata } from 'next'
import { EmployerSetupForm } from '@/components/employer/setup-form'
import { Logo } from '@/components/ui/logo'

export const metadata: Metadata = { title: 'Profil perusahaan · Trickle' }

export default function EmployerSetupPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-4 pt-[calc(16px+env(safe-area-inset-top))] pb-[calc(16px+env(safe-area-inset-bottom))]">
      <header className="py-2">
        <Logo priority />
      </header>
      <main className="flex flex-1 flex-col pt-6">
        <EmployerSetupForm />
      </main>
    </div>
  )
}
