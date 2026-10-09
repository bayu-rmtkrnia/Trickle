import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { TricklePrivyProvider } from '@/providers/privy-provider'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

export const metadata: Metadata = {
  title: 'Trickle',
  description: 'Trickle frontend foundation.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <TricklePrivyProvider>{children}</TricklePrivyProvider>
        <Toaster />
      </body>
    </html>
  )
}
