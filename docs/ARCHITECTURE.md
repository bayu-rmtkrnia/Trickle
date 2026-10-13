# Dokumentasi Arsitektur Trickle

Isinya keadaan aplikasi **saat ini**: apa saja yang sudah ada, di mana letaknya, dan kenapa dibuat begitu. Rencana dan jadwal ada di [`docs/PLAN.md`](PLAN.md), sedangkan progres BE per fitur ada di [`docs/backend/roadmap.md`](backend/roadmap.md).

> **Aturan:** setiap PR yang menambah atau mengubah fitur, endpoint, tabel, env var, atau keputusan desain **wajib memperbarui file ini** di PR yang sama. Kalau ada isi file ini yang tidak lagi sesuai dengan kode, berarti file ini yang salah, jadi perbaiki.

Terakhir diperbarui: 13 Okt 2026 (isi ulang gas drip).

---

## 1. Trickle secara singkat

Trickle adalah aplikasi gaji streaming untuk pekerja migran. Employer mengalirkan gaji on-chain (Monad testnet), pekerja bisa menarik kapan saja dan berbagi ke keluarga, lalu keluarga bisa mencairkan ke rekening bank (sandbox).

Ada tiga peran, dan perannya **kontekstual**: satu akun bisa sekaligus employer, pekerja, dan penerima (keluarga). Peran tidak disimpan sebagai kolom, tapi diturunkan dari relasi berikut (`src/lib/roles.ts`):

| Peran | Didapat dari |
| ----- | ------------ |
| Employer | Punya `Company` yang belum dihapus (`deletedAt` kosong) |
| Pekerja | Punya `Worker` aktif di perusahaan aktif, hasil undangan WORKER atau ditambahkan employer lewat alamat |
| Penerima (`recipient`) | Menjadi `Recipient` aktif milik seorang pekerja, hasil undangan RECIPIENT atau ditambahkan pekerja lewat alamat |

## 2. Peta repo

```
apps/api/        Backend (Fastify + Prisma + Postgres). Pemilik: BE
apps/web/        Frontend Next.js + Privy (rute /employer, /w, /f). Pemilik: FE. Memanggil API lewat lib/api/real.ts (mock.ts sebagai fallback)
contracts/       Smart contract TricklePayroll (Foundry), ter-deploy di Monad testnet. Pemilik: SC
packages/shared/ ABI + alamat kontrak (deployments/testnet.json) untuk FE/BE
docs/            PLAN.md (sumber kebenaran scope), ARCHITECTURE.md (file ini), erd.md (database), backend/api-changes-fe.md (panduan integrasi FE), roadmap BE, dokumen kuliah
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
  stream-indexer.ts (putaran sinkron)  stream-store.ts (cache tabel Stream)
  transfers.ts (TransferVerifier)  payout-provider.ts (PayoutProvider + mock)  demo.ts (DemoSigner)
  crypto.ts (AES-256-GCM)  errors.ts  pagination.ts  roles.ts  tokens.ts  money.ts  codes.ts  schemas.ts
  http.ts (Handler, idParam, deprecatedAlias)
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
| | `GET /users/me/employments` | ✓ | Perusahaan tempat saya bekerja (dashboard pekerja), paged, beserta data employer |
| streams | `GET /companies/:id/streams` | Pemilik perusahaan | Stream dari wallet pemilik, dari indexer; `worker` ditautkan ke baris `Worker` |
| | `GET /users/me/streams` | ✓ | Stream yang membayar wallet saya; `company` ditautkan lewat alamat employer, termasuk stream judge mode (`company: null`) |
| companies | `POST /companies` | ✓ | Satu perusahaan aktif per akun |
| | `GET/PATCH/DELETE /companies/:id` | Pemilik | Peran lain dan employer lain mendapat 403. DELETE = soft delete |
| workers | `POST/GET /companies/:id/workers` | Pemilik perusahaan | POST lewat alamat wallet; memulihkan pekerja yang pernah dihapus |
| | `GET /workers/:id` | Pemilik perusahaan atau pekerja itu sendiri | |
| | `PATCH/DELETE /workers/:id` | Pemilik perusahaan | DELETE = soft delete, 409 `STREAM_ACTIVE` kalau stream masih aktif |
| recipients | `POST/GET /recipients` | Pekerja | Selalu daftar milik sendiri. POST lewat alamat wallet; memulihkan penerima yang pernah dihapus |
| | `GET /recipients/:id` | Pekerja pemilik atau penerima itu sendiri | |
| | `PATCH/DELETE /recipients/:id` | Pekerja pemilik | DELETE = soft delete, 409 `SPLIT_ACTIVE` kalau split on-chain masih ke penerima ini |
| bank-accounts | `POST/GET /bank-accounts` | Penerima | Selalu milik sendiri. Nomor dienkripsi; respons hanya berisi 4 digit terakhir |
| | `GET/PATCH/DELETE /bank-accounts/:id` | Penerima pemilik | PATCH hanya nama dan label. DELETE = soft delete |
| payouts | `POST/GET /payouts` | Penerima | Cairkan transfer on-chain ke `PAYOUT_ADDRESS` menjadi IDR (sandbox) |
| | `GET /payouts/:id` | Penerima pemilik | Menanyakan status terbaru ke provider selama PROCESSING |
| webhooks | `POST /webhooks/payout-provider` | Signature HMAC | Status pencairan dari provider |
| invites | `POST /invites`, `GET /invites` | Employer atau pekerja | Employer mengundang pekerja, pekerja mengundang penerima |
| | `DELETE /invites/:id` | Pembuat undangan | PENDING → REVOKED; 409 kalau sudah diterima |
| | `GET /invites/:code` | – | Publik supaya link bisa dibuka sebelum login |
| | `POST /invites/:code/acceptance` | ✓ | Siapa pun yang login, kecuali pembuatnya |
| gas | `POST /gas-drips` | ✓ (tanpa peran) | Kirim MON testnet ke alamat sendiri, dan isi ulang saat saldonya hampir habis; dibatasi per alamat, per IP (akun baru), dan per hari. Rate limit 5/menit |
| | `GET /gas-drips/status` | – | Saldo treasury dan pemakaian harian |
| demo-streams | `POST /demo-streams` | ✓ (tanpa peran) | Judge mode: stream testnet sungguhan dari employer demo, sekali per akun |
| | `GET /demo-streams/status` | – | Gas employer demo dan pemakaian harian, untuk dipantau selama penjurian |
| fx | `GET /fx-rates/usd-idr` | ✓ (tanpa peran) | Kurs untuk tampilan saja, dengan waktu kurs |
| (lama) | `POST /gas/drip`, `GET /gas/status`, `GET /fx/usd-idr` | sama seperti sebelumnya | Deprecated, dipertahankan sampai FE pindah. Dihapus di Fitur 13 |

Kolom Auth: – publik, ✓ semua user yang login, *Pemilik* hanya pemilik resource tersebut.

Detail request dan response: `openapi.json` atau `http://localhost:4000/docs`.

Semua fitur di roadmap BE sudah ada. Yang tersisa ada di §9: menghapus path lama setelah FE pindah, dan provider Xendit/Flip setelah D5 diputuskan.

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

**Dependency injection lewat factory.** `buildApp({ env, db, chain, fx, privy, streams, demo, transfers, payoutProvider })` menerima semua klien eksternal, jadi test bisa mengganti chain, Privy, FX, pembaca stream, signer judge mode, verifikasi transfer, dan provider payout dengan versi palsu. Klien infrastruktur ada di `src/lib/`, bukan di dalam modul.

## 5. Keputusan desain

Setiap keputusan ditulis dengan **apa** dan **kenapa**. Kalau suatu saat diubah, perbarui entrinya, jangan hanya menambah entri baru di bawah.

### Data & uang
- **Uang hanya ada di chain.** Postgres tidak pernah menyimpan saldo atau jumlah yang sudah mengalir sebagai sumber kebenaran; data itu selalu dibaca dari kontrak atau indexer (PLAN §4.2). Kenapa: satu sumber kebenaran, jadi tidak ada risiko angka DB berbeda dengan angka on-chain. Tabel `Stream` hanya cache yang disalin indexer dari kontrak (lihat Indexer stream).
- **Gaji referensi disimpan dalam sen (`Int`)**, lalu dikonversi di `lib/money.ts`. Kenapa: menghindari pembulatan float.
- **Data sensitif dienkripsi at-rest.** Nomor rekening hanya disimpan dalam bentuk terenkripsi (lihat Fitur 9), dan token sesi hanya disimpan hash-nya.
- **Tidak ada private key pengguna di server.** Hanya ada dua key, keduanya untuk testnet: treasury gas (`GAS_TREASURY_PRIVATE_KEY`) dan employer demo untuk judge mode (`DEMO_EMPLOYER_PRIVATE_KEY`) (PLAN §4.2).

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
- **`StreamReader.hasActiveStream` dijawab indexer stream** (lihat Indexer stream). Tanpa `PAYROLL_ADDRESS` tidak ada yang bisa dicek: jawabannya "tidak aktif" dan penghapusan dicatat di log sebagai tidak terverifikasi.

### Indexer stream
- **Membaca state kontrak per id, bukan memindai event.** Id stream berurutan (`nextStreamId`), jadi satu putaran = satu `eth_call` untuk counter + satu multicall (Multicall3) per 100 stream lewat `getStream`. Kenapa bukan `eth_getLogs`: RPC publik Monad membatasinya ke 100 blok, sehingga memindai `StreamCreated` sejak blok deploy butuh ratusan request dan terus bertambah. Membaca state juga tidak butuh checkpoint blok dan tidak terpengaruh reorg.
- **Tabel `Stream` adalah cache, bukan sumber kebenaran.** Setiap putaran mengambil id baru (di atas id terbesar di DB), lalu membaca ulang semua stream yang belum `settled` (`withdrawn + refunded == amount`), supaya `canceled` dan `withdrawn` ikut ter-update. Stream yang sudah settled tidak dibaca lagi karena tidak bisa berubah.
- **Pengecekan yang memblokir aksi membaca ulang dari chain.** `hasActiveStream` menyinkronkan stream baru dulu, mengambil kandidat (belum dibatalkan, belum berakhir) dari DB, lalu membaca ulang kandidat itu on-chain. Kenapa: stream yang baru dibuat atau baru dibatalkan tidak boleh menunggu putaran berikutnya. Stream yang belum mulai (`start` di masa depan) dihitung aktif, karena dananya sudah terkunci.
- **Loop jalan di proses API** (`startStreamSync`, tiap `STREAM_SYNC_SECONDS`, default 15). Putaran tidak pernah tumpang tindih; error dicatat dan dicoba lagi di putaran berikutnya. Kenapa tidak worker terpisah: Railway menjalankan satu instance, dan upsert-nya idempoten, jadi tetap aman kalau nanti ada beberapa instance.
- **`id` bertipe `BIGINT`**, bukan teks seperti `DemoStream.streamId`, supaya "id terbesar" dihitung numerik (teks mengurutkan `"10"` sebelum `"2"`).
- **Daftar stream menyinkronkan stream baru dulu** (`StreamReader.syncNew`, satu `eth_call` + multicall kalau ada stream baru), jadi stream yang baru dibuat employer langsung muncul. Kalau RPC gagal, daftar tetap dijawab dari cache dan kegagalannya dicatat di log.
- **Stream milik alamat, bukan perusahaan.** Kontrak hanya tahu wallet employer, jadi `/companies/:id/streams` berisi stream dari wallet pemilik perusahaan, dan `worker` diisi kalau alamat penerimanya pekerja di perusahaan itu (`null` kalau bukan). Sebaliknya `/users/me/streams` mencari perusahaan aktif milik alamat employer; employer demo judge mode tidak punya perusahaan, jadi `company: null`.
- **`status` dihitung saat dibaca** (`CANCELED`, `SCHEDULED`, `ACTIVE`, `ENDED`), sama seperti `EXPIRED` di undangan. Jumlah yang sudah mengalir tidak dikirim karena berubah tiap detik: FE menghitungnya dari `startsAt`/`endsAt` atau membaca `withdrawable` on-chain. `withdrawnUnits` bisa tertinggal sampai satu putaran (`syncedAt`).
- **Cursor daftar stream adalah id on-chain** (`id < cursor`, urut terbaru dulu), bukan id baris seperti list lain, karena PK-nya memang id stream. Cursor yang bukan angka ditolak 422.
- **`/users/me/streams` tanpa cek peran**, seperti `/users/me/employments`: akun juri menerima stream demo tanpa baris `Worker`.
- **Pekerja melihat pekerjaannya lewat `GET /users/me/employments`**, bukan `GET /workers?userId=`. Kenapa: datanya selalu milik pemanggil, jadi tidak perlu cek kepemilikan, dan FE tidak perlu tahu id pekerjanya dulu. Tanpa cek peran: akun yang bukan pekerja mendapat `data: []`, bukan 403, supaya dashboard cukup satu panggilan. `employer` memakai bentuk `Company` yang sama (termasuk `ownerAddress`, alamat pengirim stream).
- **`GET /workers/:id` boleh diakses pekerja itu sendiri**, tapi `PATCH`/`DELETE` hanya employer (PLAN §6.3: "W hanya GET dirinya sendiri"). `requireOwnership` menerima beberapa pemilik untuk kasus seperti ini.

### Penerima (Fitur 7)
- **`FamilyLink` di-rename jadi `Recipient`** (resource `recipients` di PLAN §6.3), kolom `workerId` jadi `ownerId` (pekerja pemilik) dan `relativeId` jadi `userId` (akun penerima). Pola sama dengan `Worker`: unik per (pemilik, user), soft delete, dan dipulihkan kalau ditambah atau diundang lagi.
- **Peran `family` di-rename jadi `recipient`** di `/users/me` dan `requireRole`, mengikuti PLAN K5. Aman karena FE belum memanggil API. Jenis undangan ikut di-rename jadi `RECIPIENT` di Fitur 8.
- **`/recipients` (koleksi) tidak punya `:id` pemilik**: daftar dan tambah selalu memakai pekerja yang login, jadi cukup `requireRole('worker')` tanpa cek kepemilikan. Kenapa: pekerja hanya boleh mengelola penerimanya sendiri, dan ini menghindari id pekerja di URL.
- **Penerima boleh `GET` dirinya sendiri**, tapi hanya pekerja pemilik yang boleh mengubah atau menghapus (sama seperti `/workers/:id`).
- **Hapus ditolak 409 `SPLIT_ACTIVE` kalau split on-chain masih mengarah ke penerima ini** (PLAN §4.2). Kenapa berbeda dengan pekerja: kontrak punya view `splitBpsOf(worker, recipient)`, jadi cukup satu `eth_call` ke `PAYROLL_ADDRESS` tanpa indexer. Sejak TricklePayroll v2 (maks. 3 penerima per pekerja) `splitOf` sudah tidak ada; API menanyakan bps untuk penerima yang mau dihapus saja, bukan seluruh daftar `splitsOf`. ABI-nya cukup satu fragmen di `lib/streams.ts`, supaya tidak menunggu `packages/shared` di-merge.
- **Tanpa `PAYROLL_ADDRESS`, hapus tetap jalan dan dicatat di log.** Kenapa: development lokal dan test tidak perlu RPC; di deploy env ini wajib diisi.

### Undangan (Fitur 8)
- **Jenis `FAMILY` di-rename jadi `RECIPIENT`** dengan `ALTER TYPE ... RENAME VALUE`, supaya satu konsep punya satu nama di peran, resource, dan undangan. Link FE tetap `/f/invite/:code`.
- **Menerima undangan = `POST /invites/:code/acceptance` (201)**, mengikuti PLAN §6.3: yang dibuat adalah "penerimaan", bukan aksi berupa kata kerja di URL (K1).
- **Membatalkan = `DELETE /invites/:id`, bukan hapus baris.** Statusnya jadi `REVOKED` supaya link lama menjawab 409 `INVITE_REVOKED` (bukan 404 yang membingungkan) dan riwayat tetap ada. Membatalkan dua kali tetap 204 (idempoten); yang sudah diterima 409.
- **Pembatalan dan penerimaan sama-sama memakai update bersyarat `WHERE status = 'PENDING'`**, jadi kalau keduanya terjadi bersamaan hanya satu yang menang.
- **Id dipakai untuk membatalkan, kode untuk menerima.** Kode adalah rahasia yang dibagikan ke penerima, sedangkan pembuat mengelola undangannya lewat id seperti resource lain.
- **`requireRole('employer', 'worker')` di route, aturan per jenis di service.** Route tidak bisa tahu jenis undangan sebelum body divalidasi, jadi service yang menolak employer membuat `RECIPIENT` tanpa jadi pekerja, dan sebaliknya.

### Rekening bank (Fitur 9)
- **Nomor rekening dienkripsi AES-256-GCM di API sebelum masuk Postgres** (`lib/crypto.ts`, PLAN K4). Kenapa: kalau database atau backup bocor, nomor rekening tetap tidak terbaca. GCM sekaligus mendeteksi data yang diubah.
- **IV acak 12 byte untuk setiap nilai**, jadi nomor yang sama menghasilkan ciphertext berbeda dan tidak bisa dibandingkan.
- **User id pemilik dipakai sebagai AAD.** Ciphertext yang dipindahkan ke baris milik user lain gagal didekripsi.
- **Duplikat dideteksi lewat fingerprint HMAC** (bank + nomor) yang unik per user, bukan dengan mendekripsi semua baris. Nomor asli tetap tidak bisa ditebak dari fingerprint tanpa kunci.
- **Satu kunci di env (`BANK_ENCRYPTION_KEY`), dua subkey turunan HKDF** untuk enkripsi dan fingerprint, supaya satu kunci tidak dipakai untuk dua tujuan. Token diberi versi (`v1.`) supaya rotasi kunci bisa ditambahkan nanti.
- **API tidak pernah mengembalikan nomor lengkap**, hanya `accountNumberLast4`. Detail error 422 juga hanya berisi nama field, bukan nilai yang dikirim. Dekripsi baru dibutuhkan saat payout (Fitur 11).
- **Hanya peran `recipient`** (PLAN §6.3 "R pemilik"): penerima yang mencairkan ke bank, sedangkan pekerja menarik gaji on-chain.
- **PATCH hanya nama dan label.** Mengganti nomor sama dengan rekening baru, jadi caranya tambah rekening baru lalu hapus yang lama. Ini juga menjaga riwayat payout tetap menunjuk ke rekening yang benar.
- **Maksimal 5 rekening aktif per user** (409 `BANK_ACCOUNT_LIMIT`), supaya satu akun tidak bisa memenuhi tabel.

### Gas & kurs (Fitur 10)
- **Path mengikuti K1**: `/gas-drips` dan `/fx-rates/usd-idr`. **Path lama tetap jalan sebagai alias** karena FE sudah memakainya. Alias ditandai `deprecated` di OpenAPI dan mengirim header `Deprecation: true` dan `Link: <path baru>; rel="successor-version"`, jadi FE bisa pindah kapan saja tanpa rusak. Alias dihapus di Fitur 13.
- **Gas drip tetap dipakai walaupun login sekarang lewat Privy.** Wallet embedded Privy juga butuh MON untuk transaksi pertama (misalnya menarik gaji), dan FE sudah memakainya. Keputusan D6 (sponsor gas) tidak berubah.
- **Gas drip dan kurs butuh login, tapi tanpa syarat peran.** Akun juri dari judge mode belum punya peran, padahal butuh gas untuk menarik saldo dan kurs untuk menampilkan rupiah. Penyalahgunaan gas dibatasi oleh: sekali per alamat, `GAS_DRIP_IP_DAILY_LIMIT` per IP per hari, `GAS_DRIP_DAILY_LIMIT` total, dan rate limit 5/menit.
- **Batas per IP disimpan di DB** (kolom `GasDrip.ip`), sama seperti judge mode, supaya tetap berlaku setelah restart.
- **Alamat yang saldonya hampir habis diisi ulang.** Awalnya drip hanya sekali per alamat, tapi employer butuh gas setiap kali mendanai stream (mint, approve, `createStream`), sehingga 0,05 MON habis setelah satu stream. Sekarang alamat yang sudah pernah dapat drip mendapat drip lagi kalau saldo on-chain-nya di bawah `GAS_DRIP_REFILL_BELOW_MON` (default 0,03, sedikit di atas gas satu `createStream`). Kenapa berdasarkan saldo, bukan peran: kebutuhan gas tidak ditentukan peran (pekerja juga bisa banyak bertransaksi), dan saldo on-chain langsung menunjukkan akun itu benar-benar kehabisan. Akun yang saldonya masih cukup tetap dijawab 200 `alreadyDripped`.
- **Isi ulang dibatasi tiga lapis.** (1) Maksimal `GAS_DRIP_ADDRESS_DAILY_LIMIT` drip per alamat per hari (429 `DRIP_ADDRESS_LIMIT`), jadi satu akun paling banyak menghabiskan 0,25 MON per hari dengan default. (2) Isi ulang menunggu 30 detik setelah drip sebelumnya dan tidak jalan selama drip masih PENDING, supaya saldo yang belum ter-update tidak memicu dua kiriman. (3) Kalau saldo akun gagal dibaca, tidak ada isi ulang. Batas per IP hanya menghitung drip pertama (`seq` 0), karena tujuannya membatasi akun baru dari satu jaringan; kalau isi ulang ikut dihitung, satu employer bisa memblokir teman setim di wifi yang sama.
- **Treasury kosong dijawab 503 `DRIP_TREASURY_EMPTY` sebelum mengirim**, bukan 502 setelah transfer gagal. FE bisa menampilkan "sponsor gas sedang berhenti" dan tim tahu harus mengisi treasury (tercatat sebagai error di log). Kalau saldo gagal dibaca, transfer tetap dicoba.
- **Kurs di path baru memakai `cache-control: private`** karena sekarang ada di balik sesi. Path lama yang publik tetap `public`.

### Payouts (Fitur 11)
- **Alurnya: transfer on-chain dulu, baru pencairan IDR.** Penerima mengirim mAUSD ke `PAYOUT_ADDRESS` dari wallet-nya, lalu mengirim hash transaksinya ke `POST /payouts`. Transfer token-nya sungguhan; hanya bagian bank yang sandbox (PLAN §3.2). Respons punya `testMode: true` supaya UI menampilkan "Mode uji".
- **Transfer diverifikasi dari receipt**, bukan dipercaya dari body: token harus token payroll, pengirim harus akun yang login, tujuan harus `PAYOUT_ADDRESS`, dan jumlahnya diambil dari log `Transfer`. Hanya membaca satu receipt, jadi tidak terkena batas `eth_getLogs` RPC publik.
- **Satu payout per transaksi** lewat unique `sourceTxHash`. Hash yang sama dari user yang sama mengembalikan payout pertama (200); dari user lain 409 `PAYOUT_EXISTS`. Baris dibuat dulu sebelum provider dipanggil, jadi dua request bersamaan tidak mencairkan dua kali.
- **Data rekening tidak disalin ke `Payout`.** Payout menunjuk ke `BankAccount`, dan nomor rekening hanya didekripsi tepat saat memanggil provider. Kolom teks biasa dari skema awal dihapus.
- **Kurs yang dipakai disimpan bersama sumbernya** (`fxRate`, `fxSource`), karena kurs hanya untuk tampilan (bisa `fallback`), dan angka di struk harus bisa dijelaskan.
- **Provider di belakang interface `PayoutProvider`.** D5 (Xendit atau Flip) belum diputuskan, jadi yang ada baru provider mock. Mock tidak menyimpan state: jadwal dan hasilnya dikodekan di reference, jadi tetap konsisten setelah restart. Menambah Xendit/Flip berarti menambah satu implementasi tanpa mengubah service.
- **Status diperbarui dari dua arah**: webhook dari provider, dan `GET /payouts/:id` yang bertanya ke provider selama PROCESSING (mock tidak mengirim webhook). Keduanya memakai update bersyarat `WHERE status IN (PENDING, PROCESSING)`, jadi status akhir tidak bisa ditimpa oleh webhook yang terlambat atau terkirim dua kali.
- **Webhook ditandatangani HMAC-SHA256** atas `<timestamp>.<raw body>` dengan `PAYOUT_WEBHOOK_SECRET`, dibandingkan dengan `timingSafeEqual`, dan ditolak kalau lebih dari 5 menit (mencegah replay). Signature dicek di `preValidation`, sebelum body divalidasi, dan raw body hanya disimpan di scope route webhook.
- **Kalau provider gagal memulai, payout tetap disimpan sebagai FAILED** (201 dengan `failureReason`). Token sudah diterima di `PAYOUT_ADDRESS`, jadi tim yang menyelesaikannya secara manual; ini dicatat sebagai error di log.

### Judge mode (Fitur 12)
- **Stream-nya sungguhan, bukan simulasi.** Employer demo memanggil `createStream` di `TricklePayroll` (Monad testnet), jadi saldo yang dilihat juri berasal dari kontrak, sama seperti pekerja asli (PLAN §3.1 langkah 5; §3.2: tidak ada data palsu). Token-nya mAUSD (mock), dan hal itu disebut di API docs.
- **Butuh login, tapi tanpa peran.** Yang diminta adalah stream "ke alamat pemanggil" (PLAN §6.3), dan itu hanya bisa dibuktikan lewat sesi. Kalau alamat dikirim lewat body, siapa pun bisa menghabiskan kuota untuk alamat orang lain. Akun juri masih baru, jadi tidak ada `requireRole`.
- **Satu stream per akun, idempoten**, lewat unique `DemoStream.userId`. Polanya sama seperti gas drip: baris PENDING dibuat dulu sebelum transaksi dikirim, jadi dua request bersamaan tidak membuat dua stream. Yang gagal ditandai FAILED dan boleh dicoba ulang.
- **Batas per IP dan per hari disimpan di DB**, bukan hanya di rate limiter memori, supaya tetap berlaku setelah server restart atau deploy. Rate limit 5/menit tetap ada untuk meredam lonjakan request.
- **Employer demo mengisi saldonya sendiri** lewat `mint` terbuka milik MockAUSD, dan `approve` hanya dipanggil sekali (`maxUint256`). Jadi selama penjurian (14–27 Okt) yang perlu dipantau hanya MON untuk gas, lewat `GET /demo-streams/status`. Kalau token diganti AUSD asli, mint akan gagal dan endpoint menjawab 502.
- **Transaksi signer diantrekan satu per satu** di dalam proses, karena semuanya memakai nonce yang sama. Ini cukup untuk satu instance Railway. Kalau di-scale ke beberapa instance, perlu antrean bersama.
- **Signer ada di belakang interface `DemoSigner`** (`lib/demo.ts`) dan di-inject lewat `buildApp({ demo })`. Test memakai versi palsu, jadi tidak ada yang dikirim ke chain. Tanpa key, endpoint menjawab 503 `DEMO_UNAVAILABLE`.

### Bentuk API
- **Prefix `/api/v1` dan nama resource berupa kata benda jamak** (rubrik K1).
- **Format error seragam** `{ error: { code, message, details? } }`. `code` stabil supaya FE bisa memetakannya ke teks yang ramah pengguna.
- **422 untuk validasi skema** (`details` per field), **400 untuk body yang tidak bisa dibaca** (misalnya JSON rusak).
- **Pagination berbasis cursor** (`?limit=&cursor=` → `{ data, nextCursor }`), urut terbaru dulu. Kenapa: halaman tetap stabil saat ada data baru, dan tidak perlu query COUNT (ambil `limit + 1` baris).
- **Kode undangan 10 karakter tanpa 0/O/1/I/L**, supaya aman dibacakan atau diketik ulang dari screenshot.
- **Status `EXPIRED` undangan dihitung saat dibaca**, tidak disimpan. Kenapa: tidak perlu cron job.

### Operasional
- **Gas drip aman dari request bersamaan** lewat unique `(address, seq)`: drip berikutnya untuk satu alamat hanya bisa dibuat sekali, dan request yang kalah dijawab dengan drip yang menang. Drip yang gagal dicoba ulang lewat update bersyarat (`status = FAILED`), dan ada batas harian total (`GAS_DRIP_DAILY_LIMIT`).
- **Kurs FX di-cache di memori.** Kalau provider mati, API memakai kurs terakhir lalu kurs fallback statis, dan respons selalu menyebut `source`-nya.
- **Rate limit global 120/menit per IP**, dengan batas lebih ketat di sign-in, gas drip, dan demo stream. Batas harian per IP untuk gas drip dan demo stream disimpan di DB.
- **CORS menyebut `methods` secara eksplisit** (`GET, HEAD, POST, PATCH, DELETE`). Kenapa: sejak v10, default `@fastify/cors` hanya `GET,HEAD,POST`, sehingga preflight `PATCH`/`DELETE` dari browser ditolak. Kalau menambah route dengan method lain (misalnya `PUT`), daftarnya juga harus ditambah.
- **Semua config divalidasi saat start** (`src/env.ts`). String kosong di `.env` dianggap tidak diisi. Fitur yang config-nya kosong menjawab 503, bukan crash (contoh: Privy, gas treasury, employer demo).

## 6. Data model (Postgres via Prisma)

| Tabel | Isi |
| ----- | --- |
| `User` | `address` (lowercase, unik), `privyId` (unik, nullable), `displayName` |
| `Session` | `tokenHash` (unik), `expiresAt`, `revokedAt`; ikut terhapus saat user dihapus |
| `Company` | Profil perusahaan; `deletedAt` untuk soft delete; maksimal satu aktif per owner |
| `Worker` | Hubungan kerja: `companyId`, `userId`, `displayName`, `position`, gaji referensi (sen), `deletedAt`. Unik per (perusahaan, user) |
| `Recipient` | Penerima milik pekerja: `ownerId` (pekerja), `userId` (penerima), `displayName`, `relation`, `deletedAt`. Unik per (pemilik, user) |
| `Invite` | Undangan WORKER (dengan `companyId`) / RECIPIENT, status PENDING/ACCEPTED/REVOKED (EXPIRED dihitung saat dibaca) |
| `BankAccount` | Rekening penerima: `bankCode`, `accountName`, `label`, `numberEncrypted` (AES-256-GCM), `numberLast4`, `numberFingerprint` (HMAC, unik per user), `deletedAt` |
| `GasDrip` | Log drip per alamat: `seq` 0 drip pertama, 1+ isi ulang; unik `(address, seq)` |
| `DemoStream` | Stream judge mode, satu per akun: alamat, jumlah (unit token), durasi, status PENDING/SENT/FAILED, `streamId` on-chain, `txHash`, IP |
| `Payout` | Pencairan: `bankAccountId`, `sourceTxHash` (unik), jumlah (unit token dan IDR), `fxRate`/`fxSource`, `provider`/`providerRef` (unik), status PENDING/PROCESSING/COMPLETED/FAILED, `failureReason` |

ERD lengkap (diagram, relasi, constraint, data sensitif, riwayat migrasi) ada di [`docs/erd.md`](erd.md), dan skemanya di `apps/api/prisma/schema.prisma`. Setiap perubahan skema harus disertai migrasi baru (`pnpm db:migrate`) dan pembaruan `docs/erd.md`; `test/erd.test.ts` gagal kalau ada tabel, kolom, atau migrasi yang belum dicantumkan.

## 7. Konfigurasi

Semua env var didefinisikan di `apps/api/src/env.ts`, dan contohnya ada di `apps/api/.env.example`. Yang penting:

| Env | Untuk |
| --- | ----- |
| `DATABASE_URL` | Wajib |
| `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `PRIVY_VERIFICATION_KEY` | Login. Tanpa `PRIVY_APP_ID`, `/sessions` menjawab 503 `PRIVY_NOT_CONFIGURED`; tanpa `PRIVY_APP_SECRET`, login pertama (mengambil alamat wallet) juga 503 |
| `SESSION_TTL_DAYS` | Masa berlaku sesi (default 7) |
| `WEB_URL`, `CORS_ORIGINS` | Link undangan dan origin web yang diizinkan (dipisah koma). Keduanya origin persis, tanpa `/` di akhir. Di production diisi domain FE (Vercel) |
| `INVITE_TTL_DAYS` | Masa berlaku undangan (default 14) |
| `CHAIN_ID`, `RPC_URL`, `GAS_TREASURY_PRIVATE_KEY`, `GAS_DRIP_*` | Gas drip: key treasury (testnet), jumlah per drip, batas harian total (`GAS_DRIP_DAILY_LIMIT`), per IP untuk akun baru (`GAS_DRIP_IP_DAILY_LIMIT`), ambang isi ulang (`GAS_DRIP_REFILL_BELOW_MON`, default 0,03) dan batas per alamat (`GAS_DRIP_ADDRESS_DAILY_LIMIT`, default 5) |
| `PAYROLL_ADDRESS` | Kontrak `TricklePayroll` v2, untuk cek split saat menghapus penerima, indexer stream, dan judge mode. Kosong = cek split dan cek stream dilewati (dicatat di log), indexer mati, judge mode menjawab 503 |
| `STREAM_SYNC_SECONDS` | Jeda antar-putaran indexer stream (default 15). `0` mematikan loop; pengecekan `STREAM_ACTIVE` tetap menyinkronkan sendiri |
| `PAYOUT_ADDRESS`, `PAYOUT_WEBHOOK_SECRET`, `MOCK_PAYOUT_SECONDS` | Payouts: alamat tujuan transfer penerima, secret signature webhook, dan lama provider mock memproses. Tanpa `PAYOUT_ADDRESS` (atau `PAYROLL_ADDRESS`/`BANK_ENCRYPTION_KEY`), `POST /payouts` menjawab 503; tanpa secret, webhook 503 |
| `BANK_ENCRYPTION_KEY` | Kunci enkripsi nomor rekening (`openssl rand -hex 32`). Kosong = tambah rekening menjawab 503. Jangan diganti setelah ada data: nomor lama tidak bisa dibaca lagi |
| `DEMO_EMPLOYER_PRIVATE_KEY`, `DEMO_STREAM_*` | Judge mode: key employer demo (butuh MON untuk gas), jumlah, durasi, batas harian total dan per IP |
| `FX_*` | Kurs |
| `TEST_DATABASE_URL` | Hanya untuk integration test, tidak dibaca server |

## 8. Test, CI, deploy

- **Unit test**: service dengan repository palsu, tanpa DB.
- **Integrasi**: `test/api.test.ts` dengan Postgres sungguhan. Hanya jalan kalau `TEST_DATABASE_URL` diisi (`docker compose up -d db`). Privy dan chain diganti versi palsu.
- **CI** (`.github/workflows/ci.yml`): format, lint, typecheck, test dengan Postgres, cek bahwa `openapi.json` sinkron, dan secret scan (gitleaks).
- **Deploy**: Railway (`railway.json`), build `prisma generate && tsc`, start menjalankan migrasi (`db:deploy`) lalu server, healthcheck `/health`. Setiap merge ke `main` otomatis masuk production. Env production diisi di dashboard Railway, bukan dari `.env` lokal.

## 9. Masalah yang diketahui / utang

- **FE pekerja masih memindai log `StreamCreated` sendiri di browser** (`apps/web/lib/chain/viem-port.ts`, dipakai `payroll-reader.ts`), sehingga terkena batas 100 blok. Bisa diganti `GET /users/me/streams`.
- **Indexer membaca ulang semua stream yang belum settled di setiap putaran.** Murah selama jumlahnya ratusan (satu multicall per 100). Kalau sudah ribuan, perlu dibatasi, misalnya hanya stream yang berubah menurut event `Withdrawn`/`StreamCanceled` terbaru.
- **Akun juri tidak punya peran `worker` di DB.** Stream demo ada di chain dan di cache indexer, tapi tidak ada baris `Worker` atau perusahaan demo. Layar pekerja sebaiknya memakai `GET /users/me/streams` (stream demo muncul dengan `company: null`), bukan `roles` dari `/users/me`.
- **Isi ulang gas mempercepat pemakaian treasury.** Satu akun bisa memakai sampai 5 × 0,05 MON per hari. Pantau `GET /gas-drips/status` lebih sering selama penjurian, dan turunkan `GAS_DRIP_ADDRESS_DAILY_LIMIT` di Railway kalau treasury menipis.
- **Payout yang gagal setelah token diterima diselesaikan manual.** Belum ada endpoint refund atau retry; token tetap di `PAYOUT_ADDRESS`.
- **Baru provider mock** (D5 belum diputuskan). Xendit/Flip tinggal menambah implementasi `PayoutProvider`.
- **Belum ada rotasi kunci enkripsi.** Token sudah diberi versi (`v1.`), tapi re-enkripsi ke kunci baru belum dibuat.
- **Path lama `POST /gas/drip`, `GET /gas/status`, `GET /fx/usd-idr` masih ada** sebagai alias deprecated. `apps/web` di `main` sudah memakai `/fx-rates/usd-idr` dan `/gas-drips`, jadi alias ini siap dihapus (Fitur 13) setelah FE production dipastikan memakai versi itu.
- D10 (login tanpa kata sandi untuk rubrik K4) masih Open di koordinator.
