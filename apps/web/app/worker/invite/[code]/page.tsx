import type { Metadata } from 'next'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { Logo } from '@/components/ui/logo'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { WorkerInvitation } from '@/components/worker/worker-invitation'

import { invitationCopy } from '@/lib/copy/worker'
import { getLocale } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${invitationCopy[await getLocale()].title} · Trickle` }
}

export default async function WorkerInvitationPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-4 pt-[calc(16px+env(safe-area-inset-top))] pb-[calc(16px+env(safe-area-inset-bottom))]">
      <header className="flex items-center justify-between gap-3 py-2">
        <Logo priority />
        <div className="flex items-center gap-1.5">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>
      <main className="flex flex-1 flex-col pt-6">
        <WorkerInvitation key={code} code={code} />
      </main>
    </div>
  )
}
