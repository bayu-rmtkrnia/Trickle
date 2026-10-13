import type { ReactNode } from 'react'
import { SignOutButton } from '@/components/auth/sign-out-button'
import { DashboardHeader } from '@/components/ui/dashboard-header'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { familyDashboardDictionary } from '@/lib/copy/family'
import { useDict } from '@/lib/i18n/client'

export function FamilyShell({ name, children }: { name?: string; children: ReactNode }) {
  const t = useDict(familyDashboardDictionary)
  return (
    <div className="min-h-dvh pb-[calc(96px+env(safe-area-inset-bottom))] md:pb-10">
      <DashboardHeader
        name={name ? t.greeting(name) : undefined}
        avatarName={name}
        action={
          name ? (
            <>
              <LanguageSwitcher />
              <ThemeToggle />
              <SignOutButton />
            </>
          ) : undefined
        }
      />
      <main className="mx-auto max-w-[1120px] px-4 pt-2">
        <h1 className="mb-6 text-2xl/8 font-bold">{t.title}</h1>
        {children}
      </main>
    </div>
  )
}
