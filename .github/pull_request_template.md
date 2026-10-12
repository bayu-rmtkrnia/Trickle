## Apa yang berubah

<!-- Jelaskan dengan kata-katamu sendiri. Satu PR = satu fitur atau satu perbaikan. -->

## Kenapa

<!-- Masalah atau kebutuhan apa yang diselesaikan? Tautkan bagian PLAN.md atau issue kalau ada. -->

## Alternatif yang ditolak

<!-- Pendekatan lain yang dipertimbangkan, dan kenapa tidak dipilih. -->

## Cara menguji

<!-- Langkah untuk reviewer, misalnya request curl, akun demo, atau test yang relevan. -->

## Checklist

- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` lolos di lokal
- [ ] `openapi.json` diperbarui (kalau endpoint berubah)
- [ ] Migrasi Prisma ikut di-commit (kalau skema berubah)
- [ ] Endpoint sensitif punya test 403 untuk peran lain (`expectForbidden` di `apps/api/test/helpers.ts`)
- [ ] `docs/ARCHITECTURE.md` diperbarui (kalau fitur, endpoint, tabel, env var, atau keputusan desain berubah)
- [ ] Tidak ada secret, `.env`, atau private key
- [ ] Aku bisa menjelaskan semua kode di PR ini tanpa bantuan
