import Link from 'next/link'
import { PagePlaceholder } from '@/components/page-placeholder'

export default function HomePage() {
  return (
    <PagePlaceholder title="Trickle Home">
      <nav aria-label="Dashboards" className="mt-8 flex flex-wrap gap-6">
        <Link className="underline underline-offset-4" href="/employer">
          Employer Dashboard
        </Link>
        <Link className="underline underline-offset-4" href="/w">
          Worker Dashboard
        </Link>
        <Link className="underline underline-offset-4" href="/f">
          Family Dashboard
        </Link>
      </nav>
    </PagePlaceholder>
  )
}
