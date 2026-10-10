import { PagePlaceholder } from '@/components/page-placeholder'

export default async function WorkerInvitationPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params

  return (
    <PagePlaceholder title="Worker Invitation">
      <p className="mt-4 break-all text-sm text-slate-600">Invitation code: {code}</p>
    </PagePlaceholder>
  )
}
