import type { CSSProperties } from 'react'

/**
 * Lapisan blur bertingkat: paling kuat di tepi atas, memudar ke bawah.
 * Hanya 3 lapisan dengan blur kecil, supaya tetap ringan di HP low-end.
 * Taruh di dalam elemen `relative`; konten di atasnya perlu `relative`.
 */
const LAYERS: { blur: number; from: number; to: number }[] = [
  { blur: 1, from: 60, to: 100 },
  { blur: 3, from: 30, to: 75 },
  { blur: 8, from: 0, to: 50 },
]

function layerStyle({ blur, from, to }: (typeof LAYERS)[number]): CSSProperties {
  const mask = `linear-gradient(to bottom, black ${from}%, transparent ${to}%)`
  return {
    backdropFilter: `blur(${blur}px)`,
    WebkitBackdropFilter: `blur(${blur}px)`,
    maskImage: mask,
    WebkitMaskImage: mask,
  }
}

export function ProgressiveBlur({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${className}`}>
      {LAYERS.map((layer) => (
        <div key={layer.blur} className="absolute inset-0" style={layerStyle(layer)} />
      ))}
      {/*
        Gradien tipis dari token `bg` supaya isi header tetap terbaca di atas section
        berwarna; juga jadi cadangan kalau browser tidak mendukung backdrop-filter.
        Pengguna yang memilih "kurangi transparansi" mendapat latar `bg` penuh.
      */}
      <div className="absolute inset-0 bg-linear-to-b from-bg/85 via-bg/40 to-transparent [@media(prefers-reduced-transparency:reduce)]:bg-bg" />
    </div>
  )
}
