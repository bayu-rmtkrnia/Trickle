import { AuthStatus } from '@/components/auth-status'
import { PagePlaceholder } from '@/components/page-placeholder'

export default function AuthenticationTestPage() {
  return (
    <PagePlaceholder title="Authentication Test">
      <AuthStatus />
    </PagePlaceholder>
  )
}
