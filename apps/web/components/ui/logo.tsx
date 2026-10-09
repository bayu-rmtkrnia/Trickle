import Image from 'next/image'
import { LOGO_HEIGHT, LOGO_SRC, LOGO_WIDTH } from '@/lib/brand'

/** Logo Trickle (mark + tulisan). Warna logo tetap di kedua tema (DESIGN.md 12.2). */
export function Logo({ height = 28, priority = false }: { height?: number; priority?: boolean }) {
  return (
    <Image
      src={LOGO_SRC}
      alt="Trickle"
      width={Math.round((LOGO_WIDTH / LOGO_HEIGHT) * height)}
      height={height}
      priority={priority}
      unoptimized
    />
  )
}
