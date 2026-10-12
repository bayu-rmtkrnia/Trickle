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
| 2   | Struktur berlapis  | `refactor/api-layered-modules` | Pecah modul ke `modules/<resource>/{routes,controller,service,repository}`. Perilaku tidak berubah, test tetap hijau | Kam 1–Jum 2 | ✅     |
| 3   | Sesi & pengguna    | `feat/api-sessions`            | Tabel `Session` (token di-hash), `POST /sessions` (token Privy), `DELETE /sessions/current`, `GET/PATCH /users/me` | Jum 2       | ✅     |
| 4   | RBAC & kepemilikan | `feat/api-rbac`                | Middleware `requireRole` dan `requireOwnership`, peran diturunkan dari relasi DB, helper test 403                    | Jum 2       | ✅     |
| 5   | Companies CRUD     | `feat/api-companies`           | Rename Employer → Company, soft delete, test 403                                                                     | Sab 3       | ✅     |
| 6   | Workers CRUD       | `feat/api-workers`             | CRUD + 409 kalau stream masih aktif (cek on-chain lewat interface `StreamReader`)                                    | Sab 3       | ✅     |
| 7   | Recipients CRUD    | `feat/api-recipients`          | Dari `FamilyLink`, pemiliknya pekerja                                                                                | Min 4       | ✅     |
| 8   | Invites lengkap    | `feat/api-invites-v1`          | `POST /invites/:code/acceptance`, `DELETE /invites/:id`, undangan dari employer dan pekerja                          | Min 4       | ✅     |
| 9   | Bank accounts      | `feat/api-bank-accounts`       | AES-256-GCM, hanya 4 digit terakhir yang keluar dari API                                                             | Sen 5       | ✅     |
| 10  | Gas & kurs         | `refactor/api-gas-fx-v1`       | `/gas-drips` (rate limit per alamat + IP), `/fx-rates/usd-idr`                                                       | Sen 5       | 🔍     |
| 11  | Payouts sandbox    | `feat/api-payouts`             | Verifikasi tx → disbursement Xendit/Flip → webhook ber-signature                                                     | Sel 6       | ⬜     |
| 12  | Judge mode         | `feat/api-demo-streams`        | `POST /demo-streams`, signer demo, rate limit                                                                        | Sel 6–Rab 7 | ✅     |
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

## Rincian Fitur 4: RBAC & kepemilikan

| Bagian | Isi |
| ------ | --- |
| Peran | `src/lib/roles.ts`: `toRoles()` menurunkan `employer`/`worker`/`family` dari relasi (`Employer`, `EmployerWorker`, `FamilyLink`). Tidak ada kolom peran di DB. `/users/me` memakai fungsi yang sama |
| `app.requireRole(...peran)` | `src/plugins/rbac.ts`. Dipasang di `onRequest` setelah `app.authenticate`. 403 `FORBIDDEN` kalau tidak punya satu pun peran itu. Peran dimuat sekali per request (`req.roles`) |
| `app.requireOwnership(ownerOf, onMissing?)` | Dipasang di `preHandler` (params sudah tervalidasi). `ownerOf` mengembalikan id pemilik: null → 404, beda user → 403. Dipakai mulai Fitur 5 untuk endpoint `:id` |
| Diterapkan | `PATCH /employers/me` dan `GET /employers/me/workers` khusus employer. `POST /employers` dan `GET /employers/me` tetap untuk semua user (cara menjadi employer; 404 = tampilkan onboarding) |
| Tetap di service | Aturan yang bergantung pada body, misalnya jenis undangan (`WORKER` butuh perusahaan, `FAMILY` butuh status pekerja) |
| Test | `test/rbac.test.ts` (unit, tanpa DB), `expectForbidden()` di `test/helpers.ts` untuk test 403 di fitur berikutnya, plus test integrasi |

## Rincian Fitur 5: Companies CRUD

| Bagian | Isi |
| ------ | --- |
| Rename | Tabel `Employer` → `Company`, kolom `employerId` → `companyId` di `EmployerWorker` dan `Invite`. Migrasi `20261010090000_companies` memakai `RENAME`, jadi data lama tetap ada. Nama model `EmployerWorker` diganti di Fitur 6 |
| Endpoint | `POST /companies` (cukup login), `GET/PATCH/DELETE /companies/:id` dan `GET /companies/:id/workers` (`requireRole('employer')` + `requireOwnership`). Semua `/employers*` dihapus |
| Soft delete | Kolom `deletedAt`. `DELETE` → 204, mencabut undangan yang masih PENDING. Ditolak 409 `COMPANY_HAS_WORKERS` selama masih ada pekerja. Perusahaan terhapus = 404 dan tidak memberi peran employer |
| Satu perusahaan aktif | Unique `ownerId` diganti index biasa; aturan "satu aktif per user" dijaga di service (409 `COMPANY_EXISTS`). Setelah dihapus boleh membuat perusahaan baru |
| `GET /users/me` | Field baru `companyId` (null kalau bukan employer), supaya FE tahu id untuk `/companies/:id` |
| Test | Unit `test/companies.test.ts`; integrasi: CRUD pemilik, 403 untuk non-employer dan employer lain (`expectForbidden`), 404, soft delete, 409 |

## Rincian Fitur 6: Workers CRUD

| Bagian | Isi |
| ------ | --- |
| Rename | `EmployerWorker` → `Worker`, kolom `workerId` → `userId`, tambah `position`, `updatedAt`, `deletedAt`. Migrasi `20261011090000_workers` memakai `RENAME` |
| Endpoint | Modul baru `workers`: `POST/GET /companies/:id/workers` (pemilik perusahaan), `GET /workers/:id` (pemilik perusahaan atau pekerja itu sendiri), `PATCH/DELETE /workers/:id` (pemilik perusahaan). List pindah dari modul `companies` |
| Tambah lewat alamat | `POST` membuat akun untuk alamat wallet kalau belum ada; akun tertaut saat pemilik wallet login Privy (mekanisme Fitur 3). Pekerja yang pernah dihapus dipulihkan, baik lewat `POST` maupun undangan |
| Stream aktif | `DELETE` bertanya ke `StreamReader` (`src/lib/streams.ts`): stream aktif → 409 `STREAM_ACTIVE`, kalau tidak soft delete. Implementasi default belum memverifikasi (selalu "tidak aktif", dicatat di log) sampai indexer SC ada; RPC publik Monad membatasi `eth_getLogs` ke 100 blok |
| Peran | `worker` hanya dihitung dari `Worker` aktif di perusahaan aktif. `requireOwnership` sekarang menerima beberapa pemilik |
| Test | Unit `test/workers.test.ts`, kasus multi-pemilik di `test/rbac.test.ts`, integrasi: tambah lewat alamat + tautan login, 403 untuk employer lain/pekerja lain/keluarga/outsider, pekerja hanya bisa GET dirinya, 409 stream aktif, pemulihan lewat undangan |

## Rincian Fitur 7: Recipients CRUD

| Bagian | Isi |
| ------ | --- |
| Rename | `FamilyLink` → `Recipient`, kolom `workerId` → `ownerId`, `relativeId` → `userId`, tambah `updatedAt`, `deletedAt`. Migrasi `20261012090000_recipients` memakai `RENAME` |
| Endpoint | Modul baru `recipients`: `POST/GET /recipients` (pekerja, selalu miliknya sendiri), `GET /recipients/:id` (pekerja pemilik atau penerima itu sendiri), `PATCH/DELETE /recipients/:id` (pekerja pemilik) |
| Tambah lewat alamat | Sama seperti pekerja: akun dibuat kalau belum ada dan tertaut saat login Privy. Penerima yang pernah dihapus dipulihkan, baik lewat `POST` maupun undangan FAMILY |
| Split aktif | `DELETE` membaca `splitOf(pekerja)` langsung dari kontrak `TricklePayroll` (satu `eth_call`, `PAYROLL_ADDRESS`). Kalau split masih mengarah ke penerima ini dengan `bps > 0` → 409 `SPLIT_ACTIVE`. Tanpa `PAYROLL_ADDRESS`, hapus tetap jalan dan dicatat di log |
| Peran | Peran `family` di-rename jadi `recipient` (PLAN K5). Dihitung dari `Recipient` aktif. Jenis undangan `FAMILY` belum diubah (Fitur 8) |
| Test | Unit `test/recipients.test.ts` dan `test/streams.test.ts`; integrasi: CRUD + tautan login, 403 untuk employer/pekerja lain/outsider/penerima (tulis), 409 split aktif, pemulihan lewat undangan |

## Rincian Fitur 8: Invites v1

| Bagian | Isi |
| ------ | --- |
| Rename | Jenis undangan `FAMILY` → `RECIPIENT` (migrasi `20261012100000_invites_v1`, `ALTER TYPE ... RENAME VALUE`), seragam dengan peran `recipient` dan resource `recipients` |
| Terima | `POST /invites/:code/accept` → `POST /invites/:code/acceptance`, sekarang menjawab 201 |
| Batalkan | Baru: `DELETE /invites/:id`, hanya pembuatnya. PENDING → REVOKED (204, boleh diulang); yang sudah diterima → 409 `INVITE_ALREADY_ACCEPTED`. DTO dapat field `id` |
| Guard | `POST/GET /invites` dan `DELETE` memakai `requireRole('employer', 'worker')`. Jenis mana yang boleh dibuat tetap dicek service (tergantung body) |
| Test | Unit revoke di `test/invites.test.ts`; integrasi: batalkan + link mati, batalkan dua kali, 409 setelah diterima, pekerja membatalkan undangan penerimanya, 403 untuk employer lain/pekerja/outsider |

## Rincian Fitur 12: Judge mode

| Bagian | Isi |
| ------ | --- |
| Endpoint | `POST /demo-streams`: stream testnet sungguhan dari employer demo ke akun yang login, $50 selama 60 menit (bisa diatur lewat env). 201 untuk panggilan pertama, 200 untuk panggilan berikutnya. `GET /demo-streams/status` untuk memantau gas employer demo |
| Signer | `lib/demo.ts` (`DemoSigner`): key dari `DEMO_EMPLOYER_PRIVATE_KEY`, alamat token dibaca dari `TricklePayroll.token()`. Signer mint mAUSD sendiri kalau saldonya kurang, `approve` sekali, lalu `createStream`. Transaksi diantrekan satu per satu karena memakai nonce yang sama. Test memakai signer palsu |
| Data | Tabel `DemoStream`, unik per `userId` (migrasi `20261012110000_demo_streams`). Yang gagal boleh dicoba ulang |
| Batas | Satu per akun, `DEMO_STREAM_IP_DAILY_LIMIT` per IP per hari, `DEMO_STREAM_DAILY_LIMIT` total per hari, ditambah rate limit 5/menit |
| Test | Unit di `test/demo-streams.test.ts`. Integrasi: tanpa peran, idempoten, coba ulang setelah gagal, batas per IP, status |

## Rincian Fitur 9: Rekening bank

| Bagian | Isi |
| ------ | --- |
| Endpoint | `POST/GET /bank-accounts`, `GET/PATCH/DELETE /bank-accounts/:id`. Hanya peran `recipient`, dan `:id` hanya pemiliknya |
| Enkripsi | `lib/crypto.ts`: AES-256-GCM dengan IV acak per nilai, user id sebagai AAD. Kunci dari `BANK_ENCRYPTION_KEY` (32 byte hex), subkey diturunkan lewat HKDF. Fingerprint HMAC untuk mendeteksi duplikat tanpa dekripsi |
| Data | Tabel `BankAccount` (migrasi `20261012120000_bank_accounts`): `numberEncrypted`, `numberLast4`, `numberFingerprint` unik per user, soft delete |
| Aturan | Respons hanya berisi 4 digit terakhir. 409 `BANK_ACCOUNT_EXISTS`, 409 `BANK_ACCOUNT_LIMIT` (maks 5), 503 tanpa kunci. PATCH hanya nama dan label. Menambah ulang rekening yang dihapus akan memulihkannya |
| Test | `test/crypto.test.ts` (round trip, IV acak, AAD, tamper, kunci lain), unit service, integrasi: DB tidak berisi nomor asli, duplikat, pulihkan, validasi 422, 403 untuk employer/pekerja/outsider/penerima lain |

## Rincian Fitur 10: Gas & kurs

| Bagian | Isi |
| ------ | --- |
| Gas | `POST /gas/drip` → `POST /gas-drips`, `GET /gas/status` → `GET /gas-drips/status` (K1). Batas baru per IP per hari (`GAS_DRIP_IP_DAILY_LIMIT`, 429 `DRIP_IP_LIMIT`), disimpan di DB. Treasury kosong dijawab 503 `DRIP_TREASURY_EMPTY` sebelum mengirim |
| Kurs | `GET /fx/usd-idr` → `GET /fx-rates/usd-idr`, sekarang butuh login (PLAN §6.3: E, W, R) tanpa syarat peran. `cache-control: private` |
| Path lama | Tetap jalan karena FE masih memakainya, ditandai deprecated di OpenAPI dan diberi header `Deprecation` + `Link`. Dihapus di Fitur 13 setelah FE pindah |
| Test | Unit: batas IP, treasury kosong, saldo gagal dibaca. Integrasi: batas harian dari IP berbeda, batas IP, path lama + header, kurs 401/200 |

## Ketergantungan yang belum terjawab

| Kebutuhan                       | Dipakai di  | Dari                    | Status |
| ------------------------------- | ----------- | ----------------------- | ------ |
| D1: Privy atau Mera             | Fitur 3, 10 | Koordinator + FE-A      | Privy  |
| Alamat kontrak + ABI            | Fitur 6, 12 | SC (`packages/shared`)  | Ada di `feat/contracts-payroll` (belum merge) |
| Indexer stream                  | Fitur 6     | SC                      | Belum (Fitur 7 tidak butuh: `splitOf` dibaca langsung) |
| D5: sandbox Xendit atau Flip    | Fitur 11    | BE                      | Open   |
| D10: login tanpa kata sandi di K4 | Fitur 3, 4  | Koordinator (pengampu)  | Open   |
