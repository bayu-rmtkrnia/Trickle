'use client'

import { useEffect, useRef, useState } from 'react'

/** Salin teks ke clipboard; `copied` bernilai key terakhir selama 2 detik. */
export function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  async function copy(text: string, key = text) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      return false
    }
    setCopied(key)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(null), 2000)
    return true
  }

  return { copied, copy }
}
