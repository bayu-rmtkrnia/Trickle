import type { ReactNode } from 'react'
import { Logo } from '@/components/ui/logo'
import { workerDashboardCopy as t } from '@/lib/copy/worker-dashboard'

export function WorkerShell({ name, children }: { name?: string; children: ReactNode }) {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-5xl px-4 pb-10 pt-6 sm:px-6 md:pt-10">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Logo priority />
        {name && <p className="max-w-full break-words text-label text-muted">{t.greeting(name)}</p>}
      </header>
      <h1 className="mb-6 text-2xl/8 font-bold">{t.title}</h1>
      {children}
    </main>
  )
}
