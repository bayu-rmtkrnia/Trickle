'use client'

import { useState } from 'react'
import { useAccount } from '@/lib/account'
import { useSession } from '@/providers/session-provider'

export function AuthStatus() {
  const { configured, ready, authenticated, walletAddress, login } = useAccount()
  const session = useSession()
  const [error, setError] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  if (!configured) return <p className="mt-6">Privy not configured</p>
  if (!ready)
    return (
      <p className="mt-6" role="status">
        Loading authentication…
      </p>
    )

  function handleLogin() {
    setError(null)
    try {
      login()
    } catch {
      setError('Could not open login. Please try again.')
    }
  }

  async function handleLogout() {
    setError(null)
    setLoggingOut(true)
    try {
      await session.logout()
    } catch {
      setError('Logout was incomplete. Please try again.')
    } finally {
      setLoggingOut(false)
    }
  }

  const buttonClass =
    'rounded border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-50'

  return (
    <section aria-label="Authentication status" className="mt-6 space-y-4">
      <p role="status">{authenticated ? 'Logged in' : 'Not logged in'}</p>
      {authenticated && <p>Trickle API: {session.status}</p>}
      {authenticated ? (
        <>
          <p className="break-all">Wallet: {walletAddress ?? 'No embedded wallet yet'}</p>
          <button
            type="button"
            className={buttonClass}
            disabled={loggingOut}
            onClick={handleLogout}
          >
            {loggingOut ? 'Logging out…' : 'Logout'}
          </button>
        </>
      ) : (
        <button type="button" className={buttonClass} onClick={handleLogin}>
          Login
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
