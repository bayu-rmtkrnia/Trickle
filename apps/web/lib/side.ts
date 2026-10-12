// Dua sisi landing. Tidak ada pilihan yang disimpan: `/` selalu menanyakan dulu
// (layar pilihan), kecuali dibuka lewat link yang sudah menyebut sisinya.

export type Side = 'worker' | 'company'

/** Query `/?sisi=pekerja`: buka landing pekerja langsung tanpa layar pilihan. */
export const SIDE_PARAM = 'sisi'
export const WORKER_PARAM_VALUE = 'pekerja'
