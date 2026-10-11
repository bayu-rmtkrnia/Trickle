# Dokumentasi Arsitektur Trickle

Isinya keadaan aplikasi **saat ini**: apa saja yang sudah ada, di mana letaknya, dan kenapa dibuat begitu. Rencana dan jadwal ada di [`docs/PLAN.md`](PLAN.md), sedangkan progres BE per fitur ada di [`docs/backend/roadmap.md`](backend/roadmap.md).

> **Aturan:** setiap PR yang menambah atau mengubah fitur, endpoint, tabel, env var, atau keputusan desain **wajib memperbarui file ini** di PR yang sama. Kalau ada isi file ini yang tidak lagi sesuai dengan kode, berarti file ini yang salah, jadi perbaiki.

Terakhir diperbarui: 11 Okt 2026 (Fitur 7: recipients).

---

## 1. Trickle secara singkat

Trickle adalah aplikasi gaji streaming untuk pekerja migran. Employer mengalirkan gaji on-chain (Monad testnet), pekerja bisa menarik kapan saja dan berbagi ke keluarga, lalu keluarga bisa mencairkan ke rekening bank (sandbox).

Ada tiga peran, dan perannya **kontekstual**: satu akun bisa sekaligus employer, pekerja, dan penerima (keluarga). Peran tidak disimpan sebagai kolom, tapi diturunkan dari relasi berikut (`src/lib/roles.ts`):

| Peran | Didapat dari |
| ----- | ------------ |
| Employer | Punya `Company` yang belum dihapus (`deletedAt` kosong) |
| Pekerja | Punya `Worker` aktif di perusahaan aktif, hasil undangan WORKER atau ditambahkan employer lewat alamat |
| Penerima (`recipient`) | Menjadi `Recipient` aktif milik seorang pekerja, hasil undangan FAMILY atau ditambahkan pekerja lewat alamat |

## 2. Peta repo

```
apps/api/        Backend (Fastify + Prisma + Postgres). Pemilik: BE
apps/web/        Frontend Next.js + Privy (rute /employer, /w, /f). Pemilik: FE. Belum memanggil API (masih data mock)
contracts/       Smart contract (belum ada). Pemilik: SC
packages/shared/ ABI + alamat kontrak untuk FE/BE (belum ada)
docs/            PLAN.md (sumber kebenaran scope), ARCHITECTURE.md (file ini), roadmap BE, dokumen kuliah
.github/         CI + template PR
docker-compose.yml   Postgres lokal (port 5433)
railway.json     Deploy API ke Railway
```

Struktur di dalam `apps/api/`:

```
prisma/schema.prisma     Skema database (+ prisma/migrations/)
src/index.ts             Entry point server
src/app.ts               buildApp(): plugin, Swagger, registrasi semua modul di /api/v1
src/env.ts               Validasi env var (Zod). Semua config masuk lewat sini
src/types.ts             Augmentasi tipe Fastify (app.db, app.privy, req.user, ...)
src/plugins/auth.ts      app.authenticate: bearer token → req.user
src/plugins/rbac.ts      app.requireRole, app.requireOwnership (403/404)
src/plugins/errors.ts    Format error seragam, 400 vs 422
src/lib/                 Klien infrastruktur dan helper bersama:
  prisma.ts  chain.ts (viem)  privy.ts  fx.ts  streams.ts (StreamReader: stream + split on-chain)
  errors.ts  pagination.ts  roles.ts  tokens.ts  money.ts  codes.ts  schemas.ts  http.ts
src/modules/<resource>/  Satu folder per resource (lihat §4)
src/generated/prisma/    Hasil `prisma generate`, jangan diedit
scripts/                 export-openapi, gen-postman, dev-session
test/                    Vitest: unit (fake repo) + integrasi (Postgres sungguhan); helpers.ts = expectForbidden
openapi.json             Spec hasil generate. CI gagal kalau tidak sinkron
postman/                 Koleksi Postman hasil generate
```

## 3. Yang sudah ada (API)

Semua endpoint resource ada di bawah `/api/v1`, kecuali `/health` dan `/docs` (Swagger UI) yang tetap di root.

| Modul | Endpoint | Auth | Catatan |
| ----- | -------- | ---- | ------- |
| health | `GET /health` | – | Status DB, dipakai healthcheck Railway |
| sessions | `POST /sessions` | – | Tukar access token Privy → token sesi. Rate limit 20/menit |
| | `DELETE /sessions/current` | ✓ | Logout sesi ini saja |
| users | `GET /users/me`, `PATCH /users/me` | ✓ | Profil, peran, dan `companyId`; PATCH hanya `displayName` |
| companies | `POST /companies` | ✓ | Satu perusahaan aktif per akun |
| | `GET/PATCH/DELETE /companies/:id` | Pemilik | Peran lain dan employer lain mendapat 403. DELETE = soft delete |
| workers | `POST/GET /companies/:id/workers` | Pemilik perusahaan | POST lewat alamat wallet; memulihkan pekerja yang pernah dihapus |
| | `GET /workers/:id` | Pemilik perusahaan atau pekerja itu sendiri | |
| | `PATCH/DELETE /workers/:id` | Pemilik perusahaan | DELETE = soft delete, 409 `STREAM_ACTIVE` kalau stream masih aktif |
| recipients | `POST/GET /recipients` | Pekerja | Selalu daftar milik sendiri. POST lewat alamat wallet; memulihkan penerima yang pernah dihapus |
| | `GET /recipients/:id` | Pekerja pemilik atau penerima itu sendiri | |
| | `PATCH/DELETE /recipients/:id` | Pekerja pemilik | DELETE = soft delete, 409 `SPLIT_ACTIVE` kalau split on-chain masih ke penerima ini |
| invites | `POST /invites`, `GET /invites`, `GET /invites/:code`, `POST /invites/:code/accept` | ✓ / publik | Detail undangan publik supaya link bisa dibuka sebelum login |
| gas | `POST /gas/drip`, `GET /gas/status` | ✓ / – | Kirim MON testnet sekali per alamat. Rate limit 5/menit |
| fx | `GET /fx/usd-idr` | – | Kurs untuk tampilan saja |

Kolom Auth: – publik, ✓ semua user yang login, *Pemilik* hanya pemilik resource tersebut.

Detail request dan response: `openapi.json` atau `http://localhost:4000/docs`.

**Belum ada** (lihat roadmap): invites v1 (8), rekening bank terenkripsi (9), refactor gas/fx (10), payouts (11), judge mode (12), ERD (13).

## 4. Arsitektur API

### Alur request

```
request → helmet/cors/rate-limit
        → onRequest: [app.authenticate] → [app.requireRole(...)]      401 / 403
        → validasi Zod (schemas.ts)                                     422
        → preHandler: [app.requireOwnership(...)]                       404 / 403
        → controller → service → repository → Prisma → Postgres
error di mana pun → plugins/errors.ts → { error: { code, message, details? } }
```

### Lapisan per modul (`src/modules/<resource>/`)

| File | Tugas | Tidak boleh |
| ---- | ----- | ----------- |
| `routes.ts` | Daftarkan endpoint + middleware, rakit repository → service → controller | Logika bisnis |
| `schemas.ts` | Skema Zod untuk input, DTO, dan definisi OpenAPI | – |
| `controller.ts` | Ambil data dari `req`, panggil service, tentukan status code | Akses DB |
| `service.ts` | Aturan bisnis, melempar `AppError` | Mengenal `req`/`reply` atau Prisma |
| `repository.ts` | Satu-satunya tempat memanggil Prisma; method-nya `async` | Aturan bisnis |

**Kenapa:** service bisa diuji tanpa database dengan memberinya repository palsu (lihat `test/sessions.test.ts`). Prisma juga tidak bocor ke mana-mana, dan setiap lapisan mudah dijelaskan saat tanya jawab kuliah. Modul tanpa DB (fx) tidak punya repository.

**Dependency injection lewat factory.** `buildApp({ env, db, chain, fx, privy, streams })` menerima semua klien eksternal, jadi test bisa mengganti chain, Privy, FX, dan pembaca stream dengan versi palsu. Klien infrastruktur ada di `src/lib/`, bukan di dalam modul.

## 5. Keputusan desain

Setiap keputusan ditulis dengan **apa** dan **kenapa**. Kalau suatu saat diubah, perbarui entrinya, jangan hanya menambah entri baru di bawah.

### Data & uang
- **Uang hanya ada di chain.** Postgres tidak pernah menyimpan saldo atau jumlah yang sudah mengalir; data itu selalu dibaca dari kontrak atau indexer (PLAN §4.2). Kenapa: satu sumber kebenaran, jadi tidak ada risiko angka DB berbeda dengan angka on-chain.
- **Gaji referensi disimpan dalam sen (`Int`)**, lalu dikonversi di `lib/money.ts`. Kenapa: menghindari pembulatan float.
- **Tidak ada private key pengguna di server.** Satu-satunya key adalah treasury gas di testnet (`GAS_TREASURY_PRIVATE_KEY`).

### Auth & sesi (Fitur 3)
- **Login lewat Privy (D1 = Privy), bukan SIWE/Mera.** FE memakai `@privy-io/react-auth` dengan embedded wallet, sehingga `/sessions/challenges` tidak dibuat.
- **API menerbitkan token sesinya sendiri**, tidak memakai token Privy langsung di setiap request. Kenapa: logout bisa benar-benar mencabut akses (`revokedAt`), endpoint lain tidak bergantung pada Privy, dan masa berlakunya diatur oleh kita (`SESSION_TTL_DAYS`).
- **Token sesi opak (32 byte acak), dan DB hanya menyimpan SHA-256-nya.** Kenapa: kalau database bocor, isinya tidak bisa dipakai untuk login. Dibanding JWT, token opak mudah dicabut dan tidak butuh secret penandatangan.
- **Access token Privy diverifikasi lokal dengan `jose`** (ES256, `iss=privy.io`, `aud=PRIVY_APP_ID`). Kuncinya dari `PRIVY_VERIFICATION_KEY` atau dari JWKS Privy.
- **Alamat wallet diambil dari API Privy (butuh `PRIVY_APP_SECRET`), hanya saat login pertama.** Kenapa: access token Privy tidak memuat alamat wallet, sedangkan alamat yang dikirim klien tidak bisa dipercaya. Kalau wallet belum dibuat, API menjawab 409 `WALLET_NOT_READY` dan FE cukup mencoba lagi. Hanya embedded wallet (`wallet_client_type=privy`) yang dipakai, wallet eksternal diabaikan.
- **User lama ditautkan lewat alamat**: `User.privyId` nullable, dan user lama dengan alamat yang sama otomatis mendapat `privyId` saat login Privy pertama.
- **Postman memakai `pnpm session <role>`**, yang membuat sesi langsung di DB lokal karena Postman tidak bisa login ke Privy. Script ini menolak jalan dengan `NODE_ENV=production`.

### Otorisasi (Fitur 4)
- **Peran diturunkan dari relasi, tidak disimpan.** Punya `Company` aktif = employer, punya `Worker` aktif (di perusahaan aktif) = pekerja, menjadi `Recipient` aktif seorang pekerja = penerima (`toRoles()` di `lib/roles.ts`). Kenapa: tidak bisa tidak sinkron dengan data. Contohnya, begitu perusahaan dibuat, user langsung jadi employer tanpa perlu update kolom atau login ulang.
- **Peran dicek per request, tidak dimasukkan ke token sesi.** Kenapa: token opak tidak membawa klaim, dan perubahan peran langsung berlaku. Biayanya satu query per request yang memakai `requireRole`, dan hasilnya disimpan di `req.roles` supaya tidak diulang.
- **Guard berupa middleware deklaratif di `routes.ts`** (`requireRole` di `onRequest`, `requireOwnership` di `preHandler`). Kenapa: siapa boleh mengakses apa terlihat di satu tempat saat membaca daftar route, dan service tidak perlu mengulang pengecekan yang sama. Aturan yang bergantung pada isi body (misalnya jenis undangan) tetap di service, karena middleware `onRequest` belum bisa membaca body.
- **403 untuk peran atau pemilik yang salah, 404 kalau resource tidak ada**, keduanya dalam format error seragam (`FORBIDDEN`). Kenapa: rubrik K5 meminta 403 untuk peran lain. `requireOwnership` berjalan di `preHandler` supaya `req.params` sudah divalidasi Zod.
- **`POST /companies` tidak dibatasi peran**, karena membuat perusahaan adalah cara menjadi employer. FE tahu id perusahaannya dari `companyId` di `GET /users/me` (null = tampilkan onboarding).
- **Endpoint `:id` memakai role check lalu ownership check** (urutan PLAN §6.3). Akibatnya, user yang perusahaannya sudah dihapus mendapat 403 (bukan employer lagi), sedangkan employer yang meminta id tidak dikenal mendapat 404.
- **Setiap endpoint sensitif wajib punya test 403** untuk peran lain, memakai `expectForbidden()` di `test/helpers.ts`.

### Perusahaan & soft delete (Fitur 5)
- **`Employer` di-rename jadi `Company`** dengan `RENAME TABLE/COLUMN`, bukan drop + create, supaya data yang sudah ada tidak hilang. Kenapa nama berubah: PLAN §6.3 memakai resource `companies`, dan "employer" adalah peran, bukan datanya.
- **Hapus = soft delete (`deletedAt`)** (PLAN §4.2). Kenapa: pekerja, undangan, dan riwayat tetap merujuk ke perusahaan yang benar. Semua query baca memfilter `deletedAt: null`, jadi bagi API perusahaan itu sudah tidak ada.
- **Hapus ditolak 409 selama masih ada pekerja.** Kenapa: gaji mengalir on-chain per pekerja; employer harus melepas pekerjanya dulu, dan melepas pekerja dicek terhadap stream aktif (lihat Pekerja). Undangan PENDING ikut dicabut supaya link lama tidak bisa dipakai bergabung ke perusahaan yang sudah dihapus.
- **Satu perusahaan aktif per akun, dijaga di service.** Unique index `ownerId` dilepas supaya perusahaan lama yang dihapus tidak menghalangi membuat yang baru. Partial unique index (`WHERE "deletedAt" IS NULL`) tidak dipakai karena tidak bisa dideklarasikan di skema Prisma, sehingga migrasi berikutnya akan mencoba menghapusnya.

### Pekerja (Fitur 6)
- **`EmployerWorker` di-rename jadi `Worker`** (resource `workers` di PLAN §6.3), kolom `workerId` jadi `userId` karena isinya id user. Id `Worker` adalah id resource `/workers/:id`, yaitu satu hubungan kerja, bukan id user.
- **Pekerja bisa ditambahkan lewat alamat wallet** selain lewat undangan. Akun untuk alamat itu dibuat kalau belum ada, lalu tertaut saat pemiliknya login Privy (penautan lewat alamat dari Fitur 3). Kenapa: PLAN meminta CRUD penuh, dan kadang employer sudah tahu alamatnya.
- **Hapus = soft delete, dan pekerja yang sama dipulihkan kalau ditambah atau diundang lagi.** Kenapa: unique `(companyId, userId)` menjaga satu baris per hubungan kerja, jadi riwayatnya tetap satu.
- **Hapus ditolak 409 `STREAM_ACTIVE` kalau gaji masih mengalir on-chain** (PLAN §4.2). Pengecekan lewat interface `StreamReader` (`lib/streams.ts`), jadi service tidak tahu apakah jawabannya dari indexer, RPC, atau test.
- **`StreamReader` default belum memverifikasi apa pun** (selalu "tidak aktif", dan setiap penghapusan dicatat di log sebagai tidak terverifikasi). Kenapa: kontrak `TricklePayroll` tidak punya fungsi "stream per pekerja", dan RPC publik Monad membatasi `eth_getLogs` ke 100 blok, sehingga mencari event `StreamCreated` sejak blok deploy butuh ratusan request per pengecekan. Jawaban yang benar akan datang dari indexer milik SC.
- **`GET /workers/:id` boleh diakses pekerja itu sendiri**, tapi `PATCH`/`DELETE` hanya employer (PLAN §6.3: "W hanya GET dirinya sendiri"). `requireOwnership` menerima beberapa pemilik untuk kasus seperti ini.

### Penerima (Fitur 7)
- **`FamilyLink` di-rename jadi `Recipient`** (resource `recipients` di PLAN §6.3), kolom `workerId` jadi `ownerId` (pekerja pemilik) dan `relativeId` jadi `userId` (akun penerima). Pola sama dengan `Worker`: unik per (pemilik, user), soft delete, dan dipulihkan kalau ditambah atau diundang lagi.
- **Peran `family` di-rename jadi `recipient`** di `/users/me` dan `requireRole`, mengikuti PLAN K5. Aman karena FE belum memanggil API. Jenis undangan `FAMILY` sengaja belum diubah; diputuskan di Fitur 8.
- **`/recipients` (koleksi) tidak punya `:id` pemilik**: daftar dan tambah selalu memakai pekerja yang login, jadi cukup `requireRole('worker')` tanpa cek kepemilikan. Kenapa: pekerja hanya boleh mengelola penerimanya sendiri, dan ini menghindari id pekerja di URL.
- **Penerima boleh `GET` dirinya sendiri**, tapi hanya pekerja pemilik yang boleh mengubah atau menghapus (sama seperti `/workers/:id`).
- **Hapus ditolak 409 `SPLIT_ACTIVE` kalau split on-chain masih mengarah ke penerima ini** (PLAN §4.2). Kenapa berbeda dengan pekerja: kontrak punya view `splitOf(worker)`, jadi cukup satu `eth_call` ke `PAYROLL_ADDRESS` tanpa indexer. ABI-nya cukup satu fragmen di `lib/streams.ts`, supaya tidak menunggu `packages/shared` di-merge.
- **Tanpa `PAYROLL_ADDRESS`, hapus tetap jalan dan dicatat di log.** Kenapa: development lokal dan test tidak perlu RPC; di deploy env ini wajib diisi.

### Bentuk API
- **Prefix `/api/v1` dan nama resource berupa kata benda jamak** (rubrik K1).
- **Format error seragam** `{ error: { code, message, details? } }`. `code` stabil supaya FE bisa memetakannya ke teks yang ramah pengguna.
- **422 untuk validasi skema** (`details` per field), **400 untuk body yang tidak bisa dibaca** (misalnya JSON rusak).
- **Pagination berbasis cursor** (`?limit=&cursor=` → `{ data, nextCursor }`), urut terbaru dulu. Kenapa: halaman tetap stabil saat ada data baru, dan tidak perlu query COUNT (ambil `limit + 1` baris).
- **Kode undangan 10 karakter tanpa 0/O/1/I/L**, supaya aman dibacakan atau diketik ulang dari screenshot.
- **Status `EXPIRED` undangan dihitung saat dibaca**, tidak disimpan. Kenapa: tidak perlu cron job.

### Operasional
- **Gas drip idempoten per alamat** lewat unique constraint `GasDrip.address`. Drip yang gagal bisa dicoba ulang, dan ada batas harian (`GAS_DRIP_DAILY_LIMIT`).
- **Kurs FX di-cache di memori.** Kalau provider mati, API memakai kurs terakhir lalu kurs fallback statis, dan respons selalu menyebut `source`-nya.
- **Rate limit global 120/menit per IP**, dengan batas lebih ketat di sign-in dan gas drip.
- **Semua config divalidasi saat start** (`src/env.ts`). String kosong di `.env` dianggap tidak diisi. Fitur yang config-nya kosong menjawab 503, bukan crash (contoh: Privy, gas treasury).

## 6. Data model (Postgres via Prisma)

| Tabel | Isi |
| ----- | --- |
| `User` | `address` (lowercase, unik), `privyId` (unik, nullable), `displayName` |
| `Session` | `tokenHash` (unik), `expiresAt`, `revokedAt`; ikut terhapus saat user dihapus |
| `Company` | Profil perusahaan; `deletedAt` untuk soft delete; maksimal satu aktif per owner |
| `Worker` | Hubungan kerja: `companyId`, `userId`, `displayName`, `position`, gaji referensi (sen), `deletedAt`. Unik per (perusahaan, user) |
| `Recipient` | Penerima milik pekerja: `ownerId` (pekerja), `userId` (penerima), `displayName`, `relation`, `deletedAt`. Unik per (pemilik, user) |
| `Invite` | Undangan WORKER (dengan `companyId`) / FAMILY, status PENDING/ACCEPTED/REVOKED |
| `GasDrip` | Log drip, satu per alamat |
| `Payout` | Disiapkan untuk Fitur 11, belum dipakai |

Skema lengkap ada di `apps/api/prisma/schema.prisma`. Setiap perubahan skema harus disertai migrasi baru (`pnpm db:migrate`).

## 7. Konfigurasi

Semua env var didefinisikan di `apps/api/src/env.ts`, dan contohnya ada di `apps/api/.env.example`. Yang penting:

| Env | Untuk |
| --- | ----- |
| `DATABASE_URL` | Wajib |
| `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `PRIVY_VERIFICATION_KEY` | Login. Tanpa `PRIVY_APP_ID`, `/sessions` menjawab 503 |
| `SESSION_TTL_DAYS` | Masa berlaku sesi (default 7) |
| `WEB_URL`, `CORS_ORIGINS` | Link undangan dan origin web yang diizinkan |
| `CHAIN_ID`, `RPC_URL`, `GAS_TREASURY_PRIVATE_KEY`, `GAS_DRIP_*` | Gas drip |
| `PAYROLL_ADDRESS` | Kontrak `TricklePayroll`, untuk cek split saat menghapus penerima. Kosong = cek dilewati (dicatat di log) |
| `FX_*` | Kurs |

## 8. Test, CI, deploy

- **Unit test**: service dengan repository palsu, tanpa DB.
- **Integrasi**: `test/api.test.ts` dengan Postgres sungguhan. Hanya jalan kalau `TEST_DATABASE_URL` diisi (`docker compose up -d db`). Privy dan chain diganti versi palsu.
- **CI** (`.github/workflows/ci.yml`): format, lint, typecheck, test dengan Postgres, cek bahwa `openapi.json` sinkron, dan secret scan (gitleaks).
- **Deploy**: Railway (`railway.json`), build `prisma generate && tsc`, healthcheck `/health`. Setiap merge ke `main` otomatis masuk production.

## 9. Masalah yang diketahui / utang

- `test/api.test.ts` memanggil `loadEnv` di dalam `describe.skipIf`, sehingga `pnpm test` tanpa `TEST_DATABASE_URL` gagal di file itu.
- Gas drip mengasumsikan akun baru butuh MON (asumsi era Mera). Dengan Privy perlu ditinjau ulang di Fitur 10.
- **Cek stream aktif saat menghapus pekerja belum terverifikasi.** `StreamReader` default selalu menjawab "tidak aktif" sampai indexer SC tersedia. Kontrak sudah ter-deploy (`0xE7292E79…652e` di Monad testnet, branch `feat/contracts-payroll`, belum di-merge).
- `apps/web` belum memanggil API (masih data mock). Saat integrasi, FE perlu memakai `POST /sessions` + `Authorization: Bearer`, dan `/users/me` untuk peran.
- Jenis undangan masih `FAMILY`, sedangkan peran dan resource sudah `recipient`. Diputuskan di Fitur 8 (invites v1).
- D10 (login tanpa kata sandi untuk rubrik K4) masih Open di koordinator.
