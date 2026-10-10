'use client'

import {
  PrivyProvider,
  getEmbeddedConnectedWallet,
  usePrivy,
  useWallets,
} from '@privy-io/react-auth'
import type { ReactNode } from 'react'
import { AccountContext, type Account } from '@/lib/account'

const unconfiguredAccount: Account = {
  configured: false,
  ready: false,
  authenticated: false,
  user: null,
  walletAddress: null,
  login: () => {
    throw new Error('Privy not configured')
  },
  logout: async () => {},
  getAccessToken: async () => null,
}

function PrivyAccountAdapter({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy()
  const { ready: walletsReady, wallets } = useWallets()
  const accountReady = ready && (!authenticated || walletsReady)
  const embeddedWallet = getEmbeddedConnectedWallet(wallets)

  const account: Account = {
    configured: true,
    ready: accountReady,
    authenticated: ready && authenticated,
    user:
      ready && authenticated && user
        ? { id: user.id, email: user.email?.address ?? user.google?.email ?? null }
        : null,
    walletAddress: accountReady && authenticated ? (embeddedWallet?.address ?? null) : null,
    login: () => {
      if (!accountReady) throw new Error('Authentication is still loading')
      login()
    },
    logout: async () => {
      await logout()
    },
    getAccessToken: async () => {
      if (!accountReady || !authenticated) return null
      return getAccessToken()
    },
  }

  return <AccountContext.Provider value={account}>{children}</AccountContext.Provider>
}

export function TricklePrivyProvider({ children }: { children: ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim()

  if (!appId) {
    return <AccountContext.Provider value={unconfiguredAccount}>{children}</AccountContext.Provider>
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['email', 'google'],
        embeddedWallets: {
          ethereum: { createOnLogin: 'all-users' },
        },
      }}
    >
      <PrivyAccountAdapter>{children}</PrivyAccountAdapter>
    </PrivyProvider>
  )
}
