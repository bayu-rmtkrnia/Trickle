import type { ReactNode } from 'react'
import { Avatar } from './avatar'
import { Logo } from './logo'

export function DashboardHeader({
  name,
  avatarName,
  nameLabel,
  action,
}: {
  name?: string
  avatarName?: string
  nameLabel?: string
  action?: ReactNode
}) {
  return (
    <header className="sticky top-0 z-10 bg-bg pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex min-h-16 max-w-[1120px] items-center gap-3 px-4">
        <Logo height={24} priority />
        {name && (
          <p className="min-w-0 flex-1 truncate text-label text-muted">
            {nameLabel && <span className="sr-only">{nameLabel} </span>}
            {name}
          </p>
        )}
        <div className="ml-auto flex items-center gap-3">
          {action}
          {name && <Avatar name={avatarName ?? name} />}
        </div>
      </div>
    </header>
  )
}
