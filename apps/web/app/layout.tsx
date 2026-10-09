import type { Metadata, Viewport } from 'next'
import { Anton, Plus_Jakarta_Sans } from 'next/font/google'
import type { ReactNode } from 'react'
import { SplashScreen } from '@/components/splash-screen'
import { splashScript } from '@/lib/splash'
import { TricklePrivyProvider } from '@/providers/privy-provider'
import './globals.css'

const anton = Anton({ weight: '400', subsets: ['latin'], variable: '--font-anton' })
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' })

export const metadata: Metadata = {
  title: 'Trickle',
  description: 'Gaji mengalir tiap detik. Tarik kapan saja.',
}

// Warna bar status per tema (DESIGN.md 11.2). Nilainya sama dengan token `bg`.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F5F3FF' },
    { media: '(prefers-color-scheme: dark)', color: '#0E0B1A' },
  ],
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: splashScript menambah data-splash ke <html> sebelum React hidrasi.
    <html lang="id" className={`${anton.variable} ${jakarta.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: splashScript }} />
      </head>
      <body className="min-h-dvh bg-bg font-sans text-ink antialiased">
        <SplashScreen />
        <TricklePrivyProvider>{children}</TricklePrivyProvider>
      </body>
    </html>
  )
}
