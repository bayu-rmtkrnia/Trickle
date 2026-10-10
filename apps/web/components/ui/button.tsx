import Link from 'next/link'
import type { ComponentProps } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'danger' | 'on-brand'

// DESIGN.md 5.6. `on-brand` sudah putih di light dan near-black di dark,
// jadi satu kelas cukup untuk dua tema.
const variants: Record<ButtonVariant, string> = {
  primary: 'bg-brand-text text-on-brand',
  secondary: 'border-[1.5px] border-brand-text text-brand-text',
  text: 'text-brand-text',
  danger: 'bg-danger text-on-brand',
  /** Sekunder di atas kartu `brand-fill` (hero). */
  'on-brand': 'border-[1.5px] border-on-brand text-on-brand',
}

export function buttonClass(variant: ButtonVariant = 'primary', block = false, className = '') {
  return [
    'inline-flex min-h-12 select-none items-center justify-center gap-2 rounded-xl px-5 text-base/6 font-bold',
    'transition-transform duration-120 ease-trickle active:scale-[0.98]',
    'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
    variant === 'text' ? 'min-h-11 px-3' : '',
    block ? 'w-full' : '',
    variants[variant],
    className,
  ]
    .filter(Boolean)
    .join(' ')
}

type ButtonProps = ComponentProps<'button'> & {
  variant?: ButtonVariant
  block?: boolean
  /** Teks pengganti saat memproses, mis. "Membuat link…" */
  loadingLabel?: string
  loading?: boolean
}

export function Button({
  variant = 'primary',
  block = false,
  loading = false,
  loadingLabel,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, block, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
          />
          {loadingLabel ?? children}
        </>
      ) : (
        children
      )}
    </button>
  )
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: ButtonVariant; block?: boolean }

export function ButtonLink({
  variant = 'primary',
  block = false,
  className,
  ...props
}: ButtonLinkProps) {
  return <Link className={buttonClass(variant, block, className)} {...props} />
}
