import type { Metadata } from 'next'
import { Logo } from '@/components/ui/logo'
import { FamilyInvitation } from '@/components/family/family-invitation'

export const metadata: Metadata = { title: 'Undangan keluarga · Trickle' }

export default async function FamilyInvitationPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-4 pt-[calc(16px+env(safe-area-inset-top))] pb-[calc(16px+env(safe-area-inset-bottom))]">
      <header className="py-2">
        <Logo priority />
      </header>
      <main className="flex flex-1 flex-col pt-6">
        <FamilyInvitation key={code} code={code} />
      </main>
    </div>
  )
}
