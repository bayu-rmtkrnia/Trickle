'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { LOGO_HEIGHT, LOGO_INTRO_SRC, LOGO_WIDTH } from '@/lib/brand'
import { splashCopy as t } from '@/lib/copy/common'

const MIN_VISIBLE_MS = 2700
const FADE_MS = 200

/**
 * Splash cold start (DESIGN.md 12.2): layar penuh `bg`, logo animasi di tengah.
 * App tetap dimuat di belakangnya; splash minimal ±2,7 detik sejak halaman
 * mulai dimuat, lalu fade-out 200 ms. Reduced-motion: langsung hilang begitu siap.
 */
export function SplashScreen() {
  const [phase, setPhase] = useState<'show' | 'leaving' | 'gone'>('show')

  useEffect(() => {
    if (document.documentElement.dataset.splash === 'off') return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const wait = reduce ? 0 : Math.max(0, MIN_VISIBLE_MS - performance.now())
    const leave = setTimeout(() => setPhase('leaving'), wait)
    const gone = setTimeout(() => {
      setPhase('gone')
      // Melepas konten .enter yang ditahan selama splash (globals.css).
      document.documentElement.dataset.splash = 'done'
    }, wait + FADE_MS)
    return () => {
      clearTimeout(leave)
      clearTimeout(gone)
    }
  }, [])

  if (phase === 'gone') return null

  return (
    <div
      data-splash-screen
      role="status"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-bg px-4 transition-opacity duration-200 ease-trickle ${
        phase === 'leaving' ? 'pointer-events-none opacity-0' : ''
      }`}
    >
      <span className="sr-only">{t.loading}</span>
      <Image
        src={LOGO_INTRO_SRC}
        alt=""
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        priority
        unoptimized
        className="h-auto w-[min(60vw,240px)]"
      />
      <p className="splash-slow text-label text-muted">{t.slow}</p>
    </div>
  )
}
