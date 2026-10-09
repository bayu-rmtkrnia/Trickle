export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const letters = words.length > 1 ? [words[0]?.[0], words[1]?.[0]] : [words[0]?.[0]]
  return letters.join('').toUpperCase() || '?'
}

/** Inisial di lingkaran (DESIGN.md 5.9). Dekoratif: nama selalu tampil di sebelahnya. */
export function Avatar({ name, size = 40 }: { name: string; size?: 32 | 40 | 56 }) {
  const sizeClass =
    size === 32 ? 'size-8 text-xs' : size === 56 ? 'size-14 text-lg' : 'size-10 text-sm'
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full bg-brand-fill font-bold text-on-brand ${sizeClass}`}
    >
      {initials(name)}
    </span>
  )
}
