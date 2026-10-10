/** Blok placeholder ber-shimmer; shimmer mati saat reduced-motion (globals.css). */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-shimmer rounded-xl bg-[linear-gradient(90deg,color-mix(in_oklab,var(--muted)_14%,transparent)_25%,color-mix(in_oklab,var(--muted)_26%,transparent)_50%,color-mix(in_oklab,var(--muted)_14%,transparent)_75%)] bg-size-[200%_100%] ${className}`}
    />
  )
}
