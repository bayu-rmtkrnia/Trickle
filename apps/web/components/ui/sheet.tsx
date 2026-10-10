'use client'

import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react'
import { XIcon } from './icons'

type SheetProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children?: ReactNode
  /** Tombol aksi; ditempel di bawah dan selalu terlihat tanpa scroll. */
  footer?: ReactNode
  closeLabel?: string
}

const HISTORY_KEY = 'trickleSheet'

/**
 * Bottom sheet di mobile, drawer kanan di layar >= 768px (DESIGN.md 5.8, 6.7).
 * Pakai <dialog> modal: fokus masuk dan terkunci di dalam, Esc menutup, dan
 * fokus kembali ke pemicu. Tombol Back Android menutup sheet lewat history (11.4).
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  closeLabel = 'Tutup',
}: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const onCloseRef = useRef(onClose)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    const marked = Boolean(window.history.state?.[HISTORY_KEY])
    if (!open) {
      // Ditutup oleh kode (bukan Back): buang entri history milik sheet.
      if (marked) window.history.back()
      return
    }
    if (!marked) window.history.pushState({ [HISTORY_KEY]: true }, '')
    const onPop = () => onCloseRef.current()
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [open])

  // Semua jalur tutup (tombol, Esc, scrim) lewat sini supaya entri history ikut dibuang.
  const requestClose = useCallback(() => {
    if (window.history.state?.[HISTORY_KEY]) window.history.back()
    else onCloseRef.current()
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault()
        requestClose()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose()
      }}
      className={[
        'fixed m-0 max-h-none max-w-none border-0 bg-transparent p-0 text-ink backdrop:bg-black/40',
        'inset-x-0 top-auto bottom-0 mx-auto w-full max-w-[480px]',
        'md:inset-y-0 md:right-0 md:left-auto md:mx-0 md:h-dvh md:max-w-[420px]',
        'open:animate-sheet-in',
      ].join(' ')}
    >
      <div className="flex max-h-[92dvh] flex-col rounded-t-[20px] bg-surface md:h-full md:max-h-none md:rounded-none md:rounded-l-[20px]">
        <div className="flex justify-center pt-2 md:hidden" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-muted/40" />
        </div>
        <header className="flex items-start gap-3 px-4 pt-3 md:pt-6">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-xl/7 font-bold">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-muted">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="-mt-1 -mr-2 grid size-11 shrink-0 place-items-center rounded-xl text-muted active:scale-95"
          >
            <XIcon />
            <span className="sr-only">{closeLabel}</span>
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-4">
          {children}
        </div>
        {footer && (
          <div className="flex flex-col gap-3 border-t border-muted/20 px-4 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </dialog>
  )
}
