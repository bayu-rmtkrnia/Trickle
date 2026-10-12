'use client'

import { useEffect } from 'react'
import { isSplashShowing, onSplashDone } from '@/lib/splash'

/**
 * Animasi landing dengan GSAP, dibuat ringan untuk HP low-end:
 * - GSAP dimuat setelah halaman tampil (dynamic import), jadi tidak menahan render.
 * - Isi section fade-up saat discroll, dan garis "cara kerja"
 *   tergambar sekali saat discroll.
 * - Hanya `opacity`, `transform`, dan `stroke-dashoffset`; tanpa scrub, pin, atau parallax.
 * - Semua elemen sudah terlihat tanpa JavaScript; animasi hanya menambah, tidak menyembunyikan
 *   konten yang sudah ada di layar (kecuali di balik splash).
 * - `prefers-reduced-motion`: tidak ada animasi sama sekali.
 *
 * Hero punya animasi CSS sendiri (hero-motion.module.css). Target di sini: `data-reveal`, `data-flow`, `data-flow-line`, `data-flow-node`.
 */
export function LandingMotion() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let cancelled = false
    let revert: (() => void) | undefined
    let stopWaiting: (() => void) | undefined

    void Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(
      ([{ gsap }, { ScrollTrigger }]) => {
        if (cancelled) return
        gsap.registerPlugin(ScrollTrigger)

        const splash = isSplashShowing()
        const belowFold = (el: Element) => el.getBoundingClientRect().top > window.innerHeight * 0.8

        const ctx = gsap.context(() => {
          const reveal = gsap.utils.toArray<HTMLElement>('[data-reveal]')

          // 1. Fade-up saat discroll, sekali per elemen. Yang sudah terlihat saat
          //    halaman dibuka tidak disembunyikan (supaya tidak berkedip).
          const later = reveal.filter(belowFold)
          gsap.set(later, { autoAlpha: 0, y: 24 })
          ScrollTrigger.batch(later, {
            start: 'top 90%',
            once: true,
            onEnter: (batch) =>
              gsap.to(batch, {
                autoAlpha: 1,
                y: 0,
                duration: 0.7,
                ease: 'power3.out',
                stagger: 0.08,
                overwrite: true,
              }),
          })

          // 2. Hero diurus CSS (hero-motion.module.css), supaya beranimasi tanpa menunggu
          //    GSAP. Di sini hanya elemen lain yang sudah terlihat di balik splash:
          //    masuk setelah hero, begitu splash selesai.
          const behindSplash = splash ? reveal.filter((el) => !belowFold(el)) : []
          if (behindSplash.length) {
            gsap.set(behindSplash, { autoAlpha: 0, y: 24 })
            stopWaiting = onSplashDone(() =>
              gsap.to(behindSplash, {
                autoAlpha: 1,
                y: 0,
                duration: 0.8,
                ease: 'expo.out',
                stagger: 0.09,
                delay: 0.5,
              }),
            )
          }

          // 3. Cara kerja: garis ombak tergambar dari perusahaan ke keluarga, sekali saja.
          const flow = document.querySelector('[data-flow]')
          const line = flow?.querySelector('[data-flow-line]')
          const nodes = flow ? gsap.utils.toArray<HTMLElement>('[data-flow-node]', flow) : []
          if (flow && line && (splash || belowFold(flow))) {
            gsap.set(line, { strokeDasharray: 1, strokeDashoffset: 1 })
            gsap.set(nodes, { scale: 0.6, autoAlpha: 0 })
            const draw = gsap
              .timeline({ paused: true })
              .to(line, { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut' })
              .to(
                nodes,
                { scale: 1, autoAlpha: 1, duration: 0.45, ease: 'back.out(2)', stagger: 0.55 },
                0,
              )
            ScrollTrigger.create({
              trigger: flow,
              start: 'top 75%',
              once: true,
              onEnter: () => {
                if (isSplashShowing()) onSplashDone(() => draw.play())
                else draw.play()
              },
            })
          }
        })
        revert = () => ctx.revert()
      },
    )

    return () => {
      cancelled = true
      stopWaiting?.()
      revert?.()
    }
  }, [])

  return null
}
