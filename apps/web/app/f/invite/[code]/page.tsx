import { PagePlaceholder } from '@/components/page-placeholder'

export default async function FamilyInvitationPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params

  return (
    <PagePlaceholder title="Family Invitation">
      <p className="mt-4 break-all text-sm text-slate-600">Invitation code: {code}</p>
    </PagePlaceholder>
  )
}
