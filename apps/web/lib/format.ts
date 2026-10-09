const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const idrFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

function finiteAmount(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError('Amount must be a finite number')
  return value
}

export function formatUsd(value: number): string {
  return usdFormatter.format(finiteAmount(value))
}

export function formatIdr(value: number): string {
  return idrFormatter.format(finiteAmount(value))
}
