import type { ReactNode } from 'react'

export function PagePlaceholder({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="mb-3 text-sm font-medium text-slate-500">Trickle</p>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-4 text-slate-600">This page is a placeholder.</p>
      {children}
    </main>
  )
}
