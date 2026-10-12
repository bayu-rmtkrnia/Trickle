import type { Metadata } from 'next'
import { AuthGate } from '@/components/auth/auth-gate'
import { EmployerSetupForm } from '@/components/employer/setup-form'
import { Logo } from '@/components/ui/logo'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata: Metadata = { title: 'Profil perusahaan · Trickle' }

function SetupSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">Memuat…</span>
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-12" />
      <Skeleton className="h-12" />
    </div>
  )
}

export default function EmployerSetupPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-4 pt-[calc(16px+env(safe-area-inset-top))] pb-[calc(16px+env(safe-area-inset-bottom))]">
      <header className="py-2">
        <Logo priority />
      </header>
      <main className="flex flex-1 flex-col pt-6">
        <AuthGate loading={<SetupSkeleton />}>
          <EmployerSetupForm />
        </AuthGate>
      </main>
    </div>
  )
}
