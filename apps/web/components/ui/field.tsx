import type { ReactNode } from 'react'
import { AlertIcon } from './icons'

/** Kelas input bersama: font 16px supaya iOS tidak auto-zoom (DESIGN.md 10, 11.3). */
export function inputClass(invalid = false) {
  return [
    'h-12 w-full rounded-xl border-[1.5px] bg-surface px-4 text-base text-ink placeholder:text-muted',
    invalid ? 'border-danger' : 'border-muted',
  ].join(' ')
}

/** Label terlihat + hint + error yang terhubung lewat aria-describedby. */
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: ReactNode
  error?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="flex items-center gap-1 text-label text-danger">
          <AlertIcon className="size-4 shrink-0" />
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-label text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

export function describedBy(id: string, error?: string, hasHint = false) {
  if (error) return `${id}-error`
  return hasHint ? `${id}-hint` : undefined
}
