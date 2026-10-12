import type { Metadata, Viewport } from 'next'
import { Anton, Plus_Jakarta_Sans } from 'next/font/google'
import type { ReactNode } from 'react'
import { SplashScreen } from '@/components/splash-screen'
import { LocaleProvider } from '@/lib/i18n/client'
import { getLocale } from '@/lib/i18n/server'
import { splashScript } from '@/lib/splash'
import { themeScript } from '@/lib/theme'
import { TricklePrivyProvider } from '@/providers/privy-provider'
import { TrickleSessionProvider } from '@/providers/session-provider'
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

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Bahasa dari pilihan tersimpan atau preferensi browser (lib/i18n/config.ts).
  const locale = await getLocale()
  return (
    // suppressHydrationWarning: skrip di <head> menambah data-splash dan data-theme ke <html> sebelum React hidrasi.
    <html
      lang={locale}
      className={`${anton.variable} ${jakarta.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: splashScript }} />
      </head>
      <body className="min-h-dvh bg-bg font-sans text-ink antialiased">
        <LocaleProvider initial={locale}>
          <SplashScreen />
          <TricklePrivyProvider>
            <TrickleSessionProvider>{children}</TrickleSessionProvider>
          </TricklePrivyProvider>
        </LocaleProvider>
      </body>
    </html>
  )
}
