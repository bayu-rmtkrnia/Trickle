# Roadmap Backend (`apps/api`)

Rencana kerja BE untuk menyelesaikan [§6.3 Spec API v1.1](../PLAN.md#63-spec-api-v11-direvisi-untuk-rubrik-kuliah-k1-k3-k4-k5) dan tugas BE di fase F2 sebelum **G2 (Rab 7 Okt, 23:59 WIB)**. Kalau ada yang bertentangan, `PLAN.md` yang berlaku.

Aturan main:

- Satu fitur = satu branch = satu PR, berisi beberapa commit kecil (lihat [`CONTRIBUTING.md`](../../CONTRIBUTING.md)).
- Setiap PR memperbarui `openapi.json` dan menambah test. Endpoint sensitif wajib punya test 403 untuk peran lain (K5).
- Status: ⬜ belum · 🟨 dikerjakan · 🔍 menunggu review PR · ✅ selesai (sudah di-merge ke `main`)

## Daftar fitur

| #   | Fitur              | Branch                         | Isi                                                                                                                  | Target      | Status |
| --- | ------------------ | ------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ----------- | ------ |
| 1   | Fondasi API        | `refactor/api-v1-foundation`   | Prefix `/api/v1`, format error seragam, 400 vs 422, helper pagination                                                | Kam 1 Okt   | ✅     |
| 2   | Struktur berlapis  | `refactor/api-layered-modules` | Pecah modul ke `modules/<resource>/{routes,controller,service,repository}`. Perilaku tidak berubah, test tetap hijau | Kam 1–Jum 2 | 🔍     |
| 3   | Sesi & pengguna    | `feat/api-sessions`            | Tabel `Session` (token di-hash), `POST /sessions` (token Privy), `DELETE /sessions/current`, `GET/PATCH /users/me` | Jum 2       | 🔍     |
| 4   | RBAC & kepemilikan | `feat/api-rbac`                | Middleware `requireRole` dan `requireOwnership`, peran diturunkan dari relasi DB, helper test 403                    | Jum 2       | ⬜     |
| 5   | Companies CRUD     | `feat/api-companies`           | Rename Employer → Company, soft delete, test 403                                                                     | Sab 3       | ⬜     |
| 6   | Workers CRUD       | `feat/api-workers`             | CRUD + 409 kalau stream masih aktif (cek on-chain lewat interface `StreamReader`)                                    | Sab 3       | ⬜     |
| 7   | Recipients CRUD    | `feat/api-recipients`          | Dari `FamilyLink`, pemiliknya pekerja                                                                                | Min 4       | ⬜     |
| 8   | Invites lengkap    | `feat/api-invites-v1`          | `POST /invites/:code/acceptance`, `DELETE /invites/:id`, undangan dari employer dan pekerja                          | Min 4       | ⬜     |
| 9   | Bank accounts      | `feat/api-bank-accounts`       | AES-256-GCM, hanya 4 digit terakhir yang keluar dari API                                                             | Sen 5       | ⬜     |
| 10  | Gas & kurs         | `refactor/api-gas-fx-v1`       | `/gas-drips` (rate limit per alamat + IP), `/fx-rates/usd-idr`                                                       | Sen 5       | ⬜     |
| 11  | Payouts sandbox    | `feat/api-payouts`             | Verifikasi tx → disbursement Xendit/Flip → webhook ber-signature                                                     | Sel 6       | ⬜     |
| 12  | Judge mode         | `feat/api-demo-streams`        | `POST /demo-streams`, signer demo, rate limit                                                                        | Sel 6–Rab 7 | ⬜     |
| 13  | ERD & dokumen      | `docs/api-erd`                 | `docs/erd.md`, Postman, README API                                                                                   | Rab 7       | ⬜     |

Kalau waktu mepet, nomor 12 tetap Must dan tidak boleh dipotong (PLAN §10.2). Yang paling aman dipotong adalah pagination di endpoint yang datanya sedikit.

## Rincian Fitur 1: Fondasi API

| Langkah | Isi                                                                                       | Status |
| ------- | ----------------------------------------------------------------------------------------- | ------ |
| 1       | Format error `{ error: { code, message, details } }`, 422 untuk validasi, 400 untuk request rusak | ✅     |
| 2       | Semua endpoint pindah ke prefix `/api/v1`; `/health` dan `/docs` tetap di root            | ✅     |
| 3       | Helper pagination `?limit=&cursor=` dan respons `{ data, nextCursor }` untuk endpoint list | ✅     |
| 4       | Dokumentasi: OpenAPI, Postman, README                                                     | ✅     |

## Rincian Fitur 2: Struktur berlapis

Setiap resource pindah dari `src/routes/<resource>.ts` ke `src/modules/<resource>/`:

| Berkas          | Tanggung jawab                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------ |
| `routes.ts`     | Mendaftarkan endpoint dan middleware (`onRequest`), lalu merakit repository → service → controller |
| `schemas.ts`    | Skema Zod untuk input, DTO, dan definisi OpenAPI tiap endpoint. Validasi terjadi di lapisan ini  |
| `controller.ts` | Urusan HTTP saja: ambil data dari `req`, panggil service, tentukan status code dan header        |
| `service.ts`    | Logika bisnis dan aturan. Melempar `AppError`, tidak mengenal `req`/`reply`                      |
| `repository.ts` | Satu-satunya lapisan yang memanggil Prisma. Method-nya `async` agar tipe Prisma tidak bocor                                                       |

Modul yang tidak menyentuh database tidak punya `repository.ts`. Klien infrastruktur (Prisma, chain, penyedia kurs) tetap di `src/lib/`. Karena service menerima repository lewat parameter, service bisa diuji tanpa database.

| Langkah | Isi                                                                               | Status |
| ------- | --------------------------------------------------------------------------------- | ------ |
| 1       | Konvensi + tipe `Handler` (`lib/http.ts`), modul `health` dan `fx` sebagai contoh | ✅     |
| 2       | Modul `auth`                                                                      | ✅     |
| 3       | Modul `employers`                                                                 | ✅     |
| 4       | Modul `invites`                                                                   | ✅     |
| 5       | Modul `gas`                                                                       | ✅     |
| 6       | Hapus `src/routes/`, regenerasi OpenAPI/Postman, perbarui README                  | ✅     |

## Rincian Fitur 3: Sesi & pengguna

D1 sudah terjawab: web app memakai **Privy** (embedded wallet), jadi tidak ada `/sessions/challenges` (SIWE). Endpoint `/auth/*` diganti.

| Bagian | Isi |
| ------ | --- |
| `POST /sessions` | Body `{ accessToken }` dari `getAccessToken()` Privy. Token diverifikasi (ES256, `iss=privy.io`, `aud=PRIVY_APP_ID`) dengan `jose`, kuncinya dari `PRIVY_VERIFICATION_KEY` atau JWKS Privy. Login pertama mengambil alamat embedded wallet lewat API Privy (`PRIVY_APP_SECRET`); belum ada wallet → 409 `WALLET_NOT_READY` |
| Token sesi | 32 byte acak (base64url). Database hanya menyimpan SHA-256-nya di tabel `Session`, berlaku `SESSION_TTL_DAYS` (default 7). `@fastify/jwt` dan `JWT_SECRET` dihapus |
| `DELETE /sessions/current` | Mengisi `revokedAt` sesi yang dipakai request ini → 204. Sesi di perangkat lain tetap aktif |
| `GET/PATCH /users/me` | Profil + peran (dulu `/auth/me`); PATCH mengubah `displayName` |
| Data lama | `User.privyId` baru (nullable). User lama dengan alamat yang sama otomatis ditautkan saat login Privy pertama. Tabel `AuthChallenge` dihapus |
| Postman | `pnpm session <role>` membuat token sesi langsung di database lokal (menggantikan `pnpm sign`) |

## Ketergantungan yang belum terjawab

| Kebutuhan                       | Dipakai di  | Dari                    | Status |
| ------------------------------- | ----------- | ----------------------- | ------ |
| D1: Privy atau Mera             | Fitur 3, 10 | Koordinator + FE-A      | Privy  |
| Alamat kontrak + ABI            | Fitur 6, 12 | SC (`packages/shared`)  | Belum  |
| D5: sandbox Xendit atau Flip    | Fitur 11    | BE                      | Open   |
| D10: login tanpa kata sandi di K4 | Fitur 3, 4  | Koordinator (pengampu)  | Open   |
