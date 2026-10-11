'use client'

import { useState } from 'react'
import { useAccount } from '@/lib/account'
import { useSession } from '@/providers/session-provider'
import { isApiError } from '@/lib/api/errors'

function sessionErrorMessage(error: Error): string {
  if (isApiError(error)) {
    if (error.code === 'WALLET_NOT_READY')
      return 'Wallet belum siap. Tunggu sebentar, lalu coba lagi.'
    if (error.status === 429)
      return 'Terlalu banyak permintaan. Coba lagi; aplikasi akan menunggu batas waktu server.'
    if (error.status === 401) return 'Sesi tidak dapat dipulihkan. Keluar lalu masuk kembali.'
    if (error.kind === 'network')
      return 'Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.'
    if (error.kind === 'configuration')
      return 'Konfigurasi login belum tersedia. Hubungi pengelola aplikasi.'
  }
  return 'Sesi Trickle belum siap. Coba lagi dalam beberapa saat.'
}

export function AuthStatus() {
  const { configured, ready, authenticated, walletAddress, login } = useAccount()
  const session = useSession()
  const [error, setError] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  if (!configured) return <p className="mt-6">Konfigurasi Privy belum tersedia.</p>
  if (!ready)
    return (
      <p className="mt-6" role="status">
        Memuat akun…
      </p>
    )

  function handleLogin() {
    setError(null)
    try {
      login()
    } catch {
      setError('Login tidak dapat dibuka. Coba lagi.')
    }
  }

  async function handleLogout() {
    setError(null)
    setLoggingOut(true)
    try {
      await session.logout()
    } catch {
      // Coordinator reports whether server revocation or Privy logout failed.
    } finally {
      setLoggingOut(false)
    }
  }

  async function handleRetry() {
    setError(null)
    await session.ensureSession().catch(() => undefined)
  }

  const buttonClass =
    'rounded border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-50'

  return (
    <section aria-label="Authentication status" className="mt-6 space-y-4">
      <p role="status">{authenticated ? 'Sudah masuk' : 'Belum masuk'}</p>
      {authenticated && <p>Trickle API: {session.status}</p>}
      {authenticated ? (
        <>
          <p className="break-all">Wallet: {walletAddress ?? 'Sedang menyiapkan wallet'}</p>
          {session.error && (
            <div className="space-y-3">
              <p role="alert">{sessionErrorMessage(session.error)}</p>
              <button
                type="button"
                className={buttonClass}
                disabled={loggingOut}
                onClick={handleRetry}
              >
                Coba lagi
              </button>
            </div>
          )}
          {session.status === 'exchanging' && <p role="status">Menyiapkan sesi Trickle…</p>}
          <button
            type="button"
            className={buttonClass}
            disabled={loggingOut}
            onClick={handleLogout}
          >
            {loggingOut ? 'Sedang keluar…' : 'Keluar'}
          </button>
        </>
      ) : (
        <button type="button" className={buttonClass} onClick={handleLogin}>
          Masuk
        </button>
      )}
      {error && <p role="alert">{error}</p>}
      {session.logoutFailure && (
        <p role="alert">
          {session.logoutFailure === 'server'
            ? 'Akun sudah keluar dari perangkat ini. Pencabutan sesi server belum terkonfirmasi.'
            : 'Sesi lokal Trickle sudah dihapus, tetapi logout Privy gagal. Tekan Keluar untuk mencoba lagi.'}
        </p>
      )}
    </section>
  )
}
