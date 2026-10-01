'use client'

import { createContext, useContext } from 'react'

export interface AccountUser {
  id: string
  email: string | null
}

export interface Account {
  configured: boolean
  ready: boolean
  authenticated: boolean
  user: AccountUser | null
  walletAddress: string | null
  login: () => void
  logout: () => Promise<void>
  getAccessToken: () => Promise<string | null>
}

// The provider owns authentication; consumers use useAccount instead of SDK hooks.
export const AccountContext = createContext<Account | null>(null)

export function useAccount(): Account {
  const account = useContext(AccountContext)
  if (!account) throw new Error('useAccount must be used within TricklePrivyProvider')
  return account
}
