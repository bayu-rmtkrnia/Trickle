'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { LogOutIcon } from '@/components/ui/icons'
import { authCopy } from '@/lib/copy/auth'
import { useDict } from '@/lib/i18n/client'
import { useApiSession } from '@/lib/use-api-session'

/**
 * Keluar dari akun: cabut sesi di server, keluar dari Privy, lalu kembali ke
 * beranda. Tombol ikon 44px dengan label untuk screen reader.
 */
export function SignOutButton() {
  const router = useRouter()
  const { logout } = useApiSession()
  const t = useDict(authCopy).auth
  const [busy, setBusy] = useState(false)

  async function signOut() {
    setBusy(true)
    try {
      await logout()
    } catch {
      // Sesi lokal sudah dibersihkan meski server atau Privy gagal dihubungi.
    }
    router.push('/')
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      aria-label={t.signOut}
      title={t.signOut}
      className="grid size-11 shrink-0 place-items-center rounded-xl border-[1.5px] border-brand-text text-brand-text active:scale-95 disabled:opacity-50"
    >
      <LogOutIcon />
    </button>
  )
}
