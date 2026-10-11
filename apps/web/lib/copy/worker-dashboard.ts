import { isApiError } from '@/lib/api/errors'

export const workerDashboardCopy = {
  title: 'Dashboard worker',
  greeting: (name: string) => `Halo, ${name}`,
  fallbackName: 'Worker',
  loginTitle: 'Lihat pekerjaan dan payroll kamu',
  loginBody: 'Masuk dengan akun yang kamu gunakan untuk menerima undangan perusahaan.',
  login: 'Masuk',
  configuration: 'Login belum tersedia',
  configurationBody: 'Login belum dapat digunakan saat ini. Silakan coba kembali nanti.',
  loading: 'Memuat dashboard',
  sessionError: 'Sesi perlu diperbarui',
  sessionErrorBody: 'Perbarui sesi untuk memuat pekerjaan kamu kembali.',
  recover: 'Perbarui sesi',
  recovering: 'Memperbarui sesi...',
  loginError: 'Belum dapat membuka login',
  loginErrorBody: 'Silakan coba masuk kembali.',
  retry: 'Coba lagi',
  more: 'Muat pekerjaan lainnya',
  loadingMore: 'Memuat pekerjaan...',
  salaryLabel: 'Tersedia untuk ditarik',
  salaryUnavailable: 'Saldo belum tersedia',
  salaryBody: 'Saldo dan periode payroll akan ditampilkan setelah data payroll tersedia.',
  withdraw: 'Tarik gaji',
  withdrawHint: 'Penarikan belum tersedia saat ini.',
  employerTitle: 'Employer',
  employerBody: 'Perusahaan yang terhubung dengan akunmu.',
  employmentName: (name: string) => `Nama pekerja: ${name}`,
  joined: 'Bergabung',
  salaryReference: 'Gaji referensi',
  perMonth: (value: string) => `${value} / bulan`,
  salaryHint: 'Gaji referensi bulanan bukan saldo yang dapat ditarik.',
  payrollUnknown: 'Status payroll belum tersedia',
  emptyTitle: 'Belum ada pekerjaan terhubung',
  emptyBody:
    'Buka link undangan dari perusahaan dan terima undangannya untuk menghubungkan pekerjaanmu.',
  familyTitle: 'Family',
  familyUnavailable: 'Data keluarga belum tersedia',
  familyBody:
    'Daftar keluarga dan pengaturan pembagian gaji akan tersedia setelah fitur keluarga terhubung.',
  errors: {
    load: {
      title: 'Belum dapat memuat pekerjaan',
      message: 'Informasi pekerjaan belum dapat dimuat. Silakan coba lagi.',
    },
    page: {
      title: 'Pekerjaan berikutnya belum dapat dimuat',
      message: 'Pekerjaan yang sudah dimuat tetap ditampilkan. Silakan coba lagi.',
    },
    limit: {
      title: 'Terlalu banyak permintaan',
      message: 'Tunggu sebentar sebelum mencoba kembali.',
    },
    invalid: {
      title: 'Informasi pekerjaan belum dapat ditampilkan',
      message: 'Data yang diterima belum sesuai. Silakan coba lagi nanti.',
    },
  },
}

export function workerDashboardError(error: unknown, pagination = false) {
  const t = workerDashboardCopy
  if (isApiError(error) && error.status === 401)
    return { title: t.sessionError, message: t.sessionErrorBody }
  if (isApiError(error) && error.status === 429) return t.errors.limit
  if (isApiError(error) && error.code === 'INVALID_RESPONSE') return t.errors.invalid
  return pagination ? t.errors.page : t.errors.load
}
