# Perubahan API v1.1 untuk Frontend

Dokumen ini merangkum apa saja yang berubah di API dibanding versi lama (production 0.1.0 dan mock di `apps/web/lib/api`), dan cara memakai endpoint baru dari sisi FE. Detail lengkap setiap field ada di Swagger.

Terakhir diperbarui: 12 Okt 2026 (API 1.1.0).

| | |
| --- | --- |
| Base URL production | `https://trickle-production-ff1f.up.railway.app` |
| Swagger UI | `<base>/docs` (spec JSON: `<base>/docs/json`, atau `apps/api/openapi.json`) |
| Postman | `apps/api/postman/Trickle.postman_collection.json` |
| Skema database | [`docs/erd.md`](../erd.md) |

## 1. Ringkasan perubahan besar

1. **Semua endpoint resource pindah ke prefix `/api/v1`.** Hanya `/health` dan `/docs` yang tetap di root.
2. **Login lewat Privy**, bukan SIWE lagi. `/auth/challenge`, `/auth/verify`, `/auth/me` dihapus; gantinya `POST /sessions` dan `GET /users/me`.
3. **Employer → Company.** `/employers/*` dihapus; gantinya `/companies` dan `/companies/:id/workers`.
4. **Family → Recipient** di semua tempat: peran `recipient`, resource `/recipients`, jenis undangan `RECIPIENT`.
5. **Format error seragam** `{ error: { code, message, details? } }` untuk semua endpoint.
6. **Resource baru:** rekening bank, pencairan (payout), judge mode.
7. **Gas dan kurs ganti nama** (`/gas-drips`, `/fx-rates/usd-idr`); path lama masih jalan sementara.

## 2. Konvensi umum

### Login dan sesi

```
1. Login di web dengan Privy, lalu ambil access token: getAccessToken()
2. POST /api/v1/sessions  { "accessToken": "<privy token>" }
   → 201 { token, expiresAt, user }
3. Kirim di setiap request: Authorization: Bearer <token>
4. Logout: DELETE /api/v1/sessions/current → 204
```

- Token sesi berlaku 7 hari. Kalau kedaluwarsa atau dicabut, API menjawab 401 `UNAUTHORIZED`; arahkan pengguna login ulang.
- `409 WALLET_NOT_READY` di `POST /sessions`: Privy belum selesai membuat embedded wallet. Coba lagi sebentar.
- `503 PRIVY_NOT_CONFIGURED`: server belum diisi kredensial Privy (masalah konfigurasi BE, bukan FE).

### Peran

`GET /users/me` mengembalikan `roles: { employer, worker, recipient }` dan `companyId`. Peran **tidak disimpan**, tapi dihitung dari data setiap kali:

| Peran | Jadi `true` kalau |
| ----- | ----------------- |
| `employer` | Akun punya perusahaan aktif (setelah `POST /companies`) |
| `worker` | Akun terdaftar sebagai pekerja di perusahaan aktif (terima undangan WORKER, atau ditambahkan employer lewat alamat) |
| `recipient` | Akun ditambahkan sebagai penerima oleh seorang pekerja (terima undangan RECIPIENT, atau ditambahkan lewat alamat) |

Satu akun bisa punya lebih dari satu peran. Akun baru semua `false`. Setelah aksi yang mengubah peran (buat perusahaan, terima undangan), panggil ulang `/users/me`.

### Error

```json
{ "error": { "code": "INVITE_EXPIRED", "message": "This invite has expired. Ask for a new one." } }
```

| Status | Arti |
| ------ | ---- |
| 400 | Request tidak bisa dibaca (JSON rusak) atau ditolak karena isinya (mis. `TX_NOT_A_PAYOUT`) |
| 401 | Belum login atau sesi habis |
| 403 `FORBIDDEN` | Peran salah, atau resource milik orang lain |
| 404 | Tidak ditemukan (atau sudah dihapus) |
| 409 | Konflik dengan keadaan sekarang (duplikat, masih dipakai, belum siap) |
| 410 | Undangan kedaluwarsa |
| 422 `VALIDATION_ERROR` | Body/query/param tidak sesuai skema. `details` berisi `{ field, message }` per field, mis. `body.accountNumber` |
| 429 | Terlalu sering atau batas harian tercapai |
| 502 | Layanan luar (RPC chain, Privy, provider) gagal; aman dicoba lagi |
| 503 | Fitur belum dikonfigurasi di server |

Pakai `code` untuk menentukan pesan di UI, bukan `message`. Daftar kode lengkap ada di [§6](#6-daftar-kode-error).

### Pagination

Endpoint list memakai `?limit=` (1–100, default 20) dan `?cursor=`, lalu menjawab `{ data: [...], nextCursor }`. Untuk halaman berikutnya, kirim `nextCursor` sebagai `cursor`; selesai kalau `nextCursor` = `null`. Urutan: terbaru dulu.

### Hal kecil yang perlu diingat

- Alamat wallet di respons selalu **lowercase**.
- Jumlah USD gaji berupa `number` (2 desimal). Jumlah token (stream, payout) berupa **string** desimal, mis. `"50"` atau `"12.5"`, supaya tidak kehilangan presisi.
- Tanggal berupa string ISO 8601 (UTC).
- `DELETE` yang berhasil menjawab **204 tanpa body**.

## 3. Pemetaan endpoint lama → baru

### Dari production lama (0.1.0)

| Lama | Baru | Catatan |
| ---- | ---- | ------- |
| `POST /auth/challenge`, `POST /auth/verify` | `POST /api/v1/sessions` | Body sekarang `{ accessToken }` dari Privy |
| `GET /auth/me` | `GET /api/v1/users/me` | Ditambah `roles` dan `companyId` |
| `POST /employers` | `POST /api/v1/companies` | Body `{ name, country? }` |
| `GET /employers/me` | `GET /api/v1/users/me` → `companyId`, lalu `GET /api/v1/companies/:id` | |
| `PATCH /employers/me` | `PATCH /api/v1/companies/:id` | |
| `GET /employers/me/workers` | `GET /api/v1/companies/:id/workers` | Paged |
| `POST /invites/:code/accept` | `POST /api/v1/invites/:code/acceptance` | Sekarang 201 |
| `GET /invites`, `POST /invites`, `GET /invites/:code` | Sama, di bawah `/api/v1` | Jenis `FAMILY` → `RECIPIENT`; DTO ada `id` |
| `POST /gas/drip`, `GET /gas/status` | `POST /api/v1/gas-drips`, `GET /api/v1/gas-drips/status` | Path lama masih ada (deprecated), lihat [§7](#7-endpoint-deprecated) |
| `GET /fx/usd-idr` | `GET /api/v1/fx-rates/usd-idr` | **Sekarang wajib login** |

### Dari mock di `apps/web/lib/api`

| Fungsi mock | Endpoint asli | Yang berubah |
| ----------- | ------------- | ------------ |
| `getEmployer()` | `GET /users/me` → `companyId` → `GET /companies/:id` | `null` kalau `companyId` kosong |
| `createEmployer(input)` | `POST /companies` | 409 `COMPANY_EXISTS` kalau sudah punya |
| `listWorkers()` | `GET /companies/:id/workers` | Paged: ambil `data` |
| `listInvites()` | `GET /invites?type=WORKER` | Paged: ambil `data` |
| `createInvite(input)` | `POST /invites` | Lihat body di [§4](#undangan) |
| `revokeInvite(code)` | `DELETE /invites/:id` | **Pakai `id`, bukan `code`.** Jawabannya 204 tanpa body, jadi perbarui daftar di FE sendiri |
| `getPayrollFund()` | – | Tidak ada di API. Saldo dan dana ada di kontrak (`packages/shared`), dibaca langsung dari chain |
| `InviteType 'FAMILY'` | `'RECIPIENT'` | |

## 4. Endpoint per resource

Kolom **Akses**: – publik; ✓ login tanpa syarat peran; *Employer/Worker/Recipient* butuh peran itu; *Pemilik* hanya pemilik resource. Semua path relatif ke `/api/v1`.

### Sesi dan pengguna

| Method | Path | Akses | Body → respons |
| ------ | ---- | ----- | -------------- |
| POST | `/sessions` | – | `{ accessToken }` → 201 `{ token, expiresAt, user }` |
| DELETE | `/sessions/current` | ✓ | → 204 |
| GET | `/users/me` | ✓ | → `{ id, address, displayName, createdAt, companyId, roles }` |
| PATCH | `/users/me` | ✓ | `{ displayName }` → sama seperti GET |

### Perusahaan dan pekerja (employer)

| Method | Path | Akses | Body → respons | Error khusus |
| ------ | ---- | ----- | -------------- | ------------ |
| POST | `/companies` | ✓ | `{ name, country? }` → 201 `Company` | 409 `COMPANY_EXISTS` (maks 1 aktif) |
| GET / PATCH | `/companies/:id` | Pemilik | `{ name?, country? }` → `Company` | |
| DELETE | `/companies/:id` | Pemilik | → 204 | 409 `COMPANY_HAS_WORKERS` |
| POST | `/companies/:id/workers` | Pemilik | `{ address, displayName, position?, monthlySalaryUsd }` → 201 `Worker` | 409 `WORKER_EXISTS`, 400 `CANNOT_EMPLOY_SELF` |
| GET | `/companies/:id/workers` | Pemilik | → paged `Worker` | |
| GET | `/workers/:id` | Pemilik perusahaan atau pekerja itu | → `Worker` | |
| PATCH | `/workers/:id` | Pemilik perusahaan | `{ displayName?, position?, monthlySalaryUsd? }` → `Worker` | |
| DELETE | `/workers/:id` | Pemilik perusahaan | → 204 | 409 `STREAM_ACTIVE` |

`Company = { id, name, country, ownerAddress, createdAt }`
`Worker = { id, companyId, userId, address, displayName, position, monthlySalaryUsd, joinedAt }`

`monthlySalaryUsd` hanya gaji referensi untuk tampilan. Uangnya tetap mengalir lewat `createStream` di kontrak.

### Penerima (worker)

| Method | Path | Akses | Body → respons | Error khusus |
| ------ | ---- | ----- | -------------- | ------------ |
| POST | `/recipients` | Worker | `{ address, displayName, relation? }` → 201 `Recipient` | 409 `RECIPIENT_EXISTS`, 400 `CANNOT_ADD_SELF` |
| GET | `/recipients` | Worker | → paged, selalu milik sendiri | |
| GET | `/recipients/:id` | Pekerja pemilik atau penerima itu | → `Recipient` | |
| PATCH | `/recipients/:id` | Pekerja pemilik | `{ displayName?, relation? }` | |
| DELETE | `/recipients/:id` | Pekerja pemilik | → 204 | 409 `SPLIT_ACTIVE` |

`Recipient = { id, ownerId, userId, address, displayName, relation, addedAt }`

`address` adalah yang dipakai sebagai `recipient` di `setSplit(recipient, bps)`. Persentase split **tidak** disimpan di API; baca dari kontrak (`splitOf`). Penerima yang masih dipakai split ditolak dihapus (409 `SPLIT_ACTIVE`): matikan atau ganti split dulu.

### Undangan

| Method | Path | Akses | Body → respons | Error khusus |
| ------ | ---- | ----- | -------------- | ------------ |
| POST | `/invites` | Employer (WORKER) atau worker (RECIPIENT) | lihat di bawah → 201 `Invite` | 403 kalau jenisnya tidak cocok dengan peran |
| GET | `/invites` | Employer atau worker | `?type=WORKER\|RECIPIENT` → paged, buatan sendiri | |
| DELETE | `/invites/:id` | Pembuat | → 204 (dua kali tetap 204) | 409 `INVITE_ALREADY_ACCEPTED` |
| GET | `/invites/:code` | – | → `Invite` (untuk halaman link sebelum login) | 404 `INVITE_NOT_FOUND` |
| POST | `/invites/:code/acceptance` | ✓ | → 201 `Invite` | 409 `INVITE_REVOKED`, `INVITE_ALREADY_ACCEPTED`, `ALREADY_LINKED`; 410 `INVITE_EXPIRED`; 400 `CANNOT_ACCEPT_OWN_INVITE` |

Body `POST /invites`:

```json
{ "type": "WORKER", "inviteeName": "Siti", "monthlySalaryUsd": 1200 }
{ "type": "RECIPIENT", "inviteeName": "Ibu Aminah", "relation": "Ibu" }
```

`Invite = { id, code, type, status, inviteeName, monthlySalaryUsd, relation, invitedBy: { name, address }, url, expiresAt, acceptedAt, createdAt }`

- `status`: `PENDING`, `ACCEPTED`, `REVOKED`, `EXPIRED`.
- `url` adalah link siap dibagikan (`<WEB_URL>/w/invite/:code` atau `/f/invite/:code`).
- Undangan RECIPIENT hanya bisa dibuat pekerja yang sudah punya employer.

### Rekening bank (recipient)

| Method | Path | Akses | Body → respons | Error khusus |
| ------ | ---- | ----- | -------------- | ------------ |
| POST | `/bank-accounts` | Recipient | `{ bankCode, accountNumber, accountName, label? }` → 201 `BankAccount` | 409 `BANK_ACCOUNT_EXISTS`, `BANK_ACCOUNT_LIMIT` (maks 5); 503 `BANK_ACCOUNTS_UNAVAILABLE` |
| GET | `/bank-accounts` | Recipient | → paged, milik sendiri | |
| GET | `/bank-accounts/:id` | Pemilik | → `BankAccount` | |
| PATCH | `/bank-accounts/:id` | Pemilik | `{ accountName?, label? }` | |
| DELETE | `/bank-accounts/:id` | Pemilik | → 204 | |

`BankAccount = { id, bankCode, accountName, label, accountNumberLast4, createdAt, updatedAt }`

- `bankCode`: `BCA`, `BNI`, `BRI`, `MANDIRI`, `BSI`, `CIMB`, `PERMATA`, `DANAMON`, `BTN`, `OCBC`.
- `accountNumber`: 6–20 digit; spasi dan tanda strip boleh dan diabaikan.
- **Nomor lengkap tidak pernah dikirim balik.** Tampilkan sebagai `•••• {accountNumberLast4}`.
- Nomor tidak bisa diubah lewat PATCH. Untuk ganti nomor: tambah rekening baru, lalu hapus yang lama.

### Pencairan (recipient)

| Method | Path | Akses | Body → respons | Error khusus |
| ------ | ---- | ----- | -------------- | ------------ |
| POST | `/payouts` | Recipient | `{ txHash, bankAccountId }` → 201 `Payout` (200 kalau hash sama dikirim ulang) | lihat alur di bawah |
| GET | `/payouts` | Recipient | → paged, milik sendiri | |
| GET | `/payouts/:id` | Pemilik | → `Payout`, dengan status terbaru | |

`Payout = { id, status, amountUsd, amountIdr, fxRate, fxSource, sourceTxHash, bankAccount: { id, bankCode, accountNumberLast4 }, provider, providerRef, testMode, failureReason, createdAt, updatedAt }`

Alurnya:

1. Dari wallet penerima, transfer mAUSD (token payroll) ke **`PAYOUT_ADDRESS`** di chain. Tunggu receipt-nya.
2. `POST /payouts { txHash, bankAccountId }`. API membaca receipt dan memeriksa token, pengirim (harus akun yang login), tujuan, dan jumlahnya. Jumlah diambil dari chain, bukan dari FE.
3. Respons 201 dengan `status: "PROCESSING"`, `amountIdr`, dan kurs yang dipakai (`fxRate`, `fxSource`).
4. Polling `GET /payouts/:id` (mis. tiap 3–5 detik) sampai `COMPLETED` atau `FAILED`.

| Kasus | Respons | Yang dilakukan FE |
| ----- | ------- | ----------------- |
| Tx belum masuk blok | 409 `TX_PENDING` | Coba lagi beberapa detik kemudian |
| Tx gagal (reverted) | 400 `TX_FAILED` | Tampilkan gagal transfer |
| Tx bukan transfer ke `PAYOUT_ADDRESS` dari akun ini | 400 `TX_NOT_A_PAYOUT` | Periksa alamat tujuan |
| Rekening bukan milik akun ini / sudah dihapus | 404 `BANK_ACCOUNT_NOT_FOUND` | |
| Hash sudah dipakai akun lain | 409 `PAYOUT_EXISTS` | |
| RPC chain gagal | 502 `CHAIN_UNAVAILABLE` | Coba lagi (aman, satu tx hanya bisa jadi satu payout) |
| Fitur belum dikonfigurasi | 503 `PAYOUTS_UNAVAILABLE` | |

- **`testMode: true`: wajib tampilkan label "Mode uji"** (transfer token-nya sungguhan, tapi transfer bank-nya sandbox).
- Saat ini provider-nya mock: selesai sekitar 15 detik. Rekening berakhiran `0000` selalu `FAILED`, berguna untuk mencoba tampilan gagal.
- Kalau `status: "FAILED"`, tampilkan `failureReason`. Token yang sudah terkirim diselesaikan manual oleh tim.

### Judge mode

| Method | Path | Akses | Respons | Error khusus |
| ------ | ---- | ----- | ------- | ------------ |
| POST | `/demo-streams` | ✓ (tanpa peran) | 201 `DemoStream` (200 + `alreadyStarted: true` kalau sudah pernah) | 429 `DEMO_IP_LIMIT`, `DEMO_DAILY_LIMIT`; 502 `DEMO_STREAM_FAILED` (boleh retry); 503 `DEMO_UNAVAILABLE` |
| GET | `/demo-streams/status` | – | Status employer demo (untuk pemantauan) | |

`DemoStream = { id, workerAddress, amountUsd, durationSeconds, status, streamId, txHash, startsAt, endsAt, alreadyStarted, createdAt }`

- Employer demo membuat **stream sungguhan** di kontrak: $50 mAUSD selama 60 menit ke akun yang login.
- Pakai `streamId` untuk membaca saldo dari kontrak (`streamedAmount`, `withdrawable`) dan untuk `withdraw`.
- **Akun juri tidak punya peran `worker`** di `/users/me` (tidak ada data perusahaan). Layar pekerja untuk juri harus berdasarkan respons ini, bukan `roles`.
- Panggilan pertama bisa makan beberapa detik (menunggu transaksi masuk blok). Tampilkan loading.

### Gas

| Method | Path | Akses | Respons | Error khusus |
| ------ | ---- | ----- | ------- | ------------ |
| POST | `/gas-drips` | ✓ (tanpa peran) | 201 `GasDrip` (200 + `alreadyDripped: true` kalau sudah pernah) | 429 `DRIP_IP_LIMIT`, `DRIP_DAILY_LIMIT`, `RATE_LIMITED`; 502 `DRIP_FAILED` (boleh retry); 503 `DRIP_UNAVAILABLE`, `DRIP_TREASURY_EMPTY` |
| GET | `/gas-drips/status` | – | Saldo treasury dan pemakaian harian | |

`GasDrip = { address, status, amountMon, txHash, alreadyDripped, createdAt }`

- Panggil sebelum transaksi pertama akun (mis. withdraw, `setSplit`, transfer untuk payout). Sekali per alamat.
- `SENT` artinya transaksi gas sudah dikirim, **belum tentu terkonfirmasi**. Tunggu receipt `txHash` sebelum mengirim transaksi pengguna.
- `PENDING` dengan `txHash: null`: drip sebelumnya masih diproses. Coba lagi sebentar.

### Kurs

| Method | Path | Akses | Respons |
| ------ | ---- | ----- | ------- |
| GET | `/fx-rates/usd-idr` | ✓ (tanpa peran) | `{ base, quote, rate, source, rateTime, fetchedAt }` |

- Hanya untuk tampilan dan estimasi. `source`: `live`, `cache`, atau `fallback` (provider kurs mati; tampilkan sebagai perkiraan).
- `rateTime` = kapan kurs diperbarui provider. Tampilkan, mis. "Kurs per 12 Okt 07:02".

## 5. Alur per layar

**Employer (`/employer`)**
1. Login Privy → `POST /sessions` → `GET /users/me`.
2. `companyId` kosong → form `POST /companies`.
3. Tambah pekerja: `POST /invites` (WORKER, bagikan `url`) atau `POST /companies/:id/workers` (kalau sudah tahu alamatnya).
4. Daftar pekerja: `GET /companies/:id/workers`. Undangan: `GET /invites?type=WORKER`, batalkan dengan `DELETE /invites/:id`.
5. Danai dan buat stream lewat kontrak (`createStream`), bukan lewat API.

**Pekerja (`/w`)**
1. Buka link → `GET /invites/:code` (tanpa login) → login → `POST /invites/:code/acceptance`.
2. `POST /gas-drips` sebelum transaksi pertama.
3. Saldo dan withdraw dari kontrak. Kurs: `GET /fx-rates/usd-idr`.
4. Keluarga: `POST /invites` (RECIPIENT) atau `POST /recipients`, lalu `setSplit` di kontrak dengan `address` penerima.

**Penerima (`/f`)**
1. Buka link → login → `POST /invites/:code/acceptance`.
2. Tambah rekening: `POST /bank-accounts`.
3. Cairkan: `POST /gas-drips` (sekali), transfer mAUSD ke `PAYOUT_ADDRESS`, lalu `POST /payouts` dan polling `GET /payouts/:id`. Label "Mode uji".

**Juri (landing → "Coba sebagai pekerja")**
1. Login Privy → `POST /sessions`.
2. `POST /demo-streams` → simpan `streamId`.
3. Buka layar pekerja berdasarkan `streamId`. `POST /gas-drips` kalau juri mau withdraw.

## 6. Daftar kode error

| Kode | Status | Endpoint |
| ---- | ------ | -------- |
| `UNAUTHORIZED` | 401 | Semua yang butuh login; webhook tanpa signature |
| `FORBIDDEN` | 403 | Peran atau kepemilikan salah |
| `VALIDATION_ERROR` | 422 | Semua (input tidak sesuai skema) |
| `MALFORMED_REQUEST` | 400 | JSON rusak |
| `RATE_LIMITED` | 429 | Terlalu banyak request |
| `NOT_FOUND`, `ROUTE_NOT_FOUND` | 404 | Path tidak ada |
| `INTERNAL_ERROR` | 500 | Bug server; laporkan ke BE |
| `PRIVY_NOT_CONFIGURED`, `PRIVY_UNAVAILABLE`, `WALLET_NOT_READY` | 503, 502, 409 | `POST /sessions` |
| `COMPANY_EXISTS`, `COMPANY_HAS_WORKERS`, `COMPANY_NOT_FOUND` | 409, 409, 404 | `/companies` |
| `WORKER_EXISTS`, `CANNOT_EMPLOY_SELF`, `STREAM_ACTIVE`, `WORKER_NOT_FOUND` | 409, 400, 409, 404 | `/workers`, `/companies/:id/workers` |
| `RECIPIENT_EXISTS`, `CANNOT_ADD_SELF`, `SPLIT_ACTIVE`, `RECIPIENT_NOT_FOUND` | 409, 400, 409, 404 | `/recipients` |
| `INVITE_NOT_FOUND`, `INVITE_EXPIRED`, `INVITE_REVOKED`, `INVITE_ALREADY_ACCEPTED`, `ALREADY_LINKED`, `CANNOT_ACCEPT_OWN_INVITE` | 404, 410, 409, 409, 409, 400 | `/invites` |
| `BANK_ACCOUNT_EXISTS`, `BANK_ACCOUNT_LIMIT`, `BANK_ACCOUNT_NOT_FOUND`, `BANK_ACCOUNTS_UNAVAILABLE` | 409, 409, 404, 503 | `/bank-accounts`, `/payouts` |
| `TX_PENDING`, `TX_FAILED`, `TX_NOT_A_PAYOUT`, `PAYOUT_EXISTS`, `PAYOUT_NOT_FOUND`, `CHAIN_UNAVAILABLE`, `PAYOUTS_UNAVAILABLE` | 409, 400, 400, 409, 404, 502, 503 | `/payouts` |
| `DEMO_IP_LIMIT`, `DEMO_DAILY_LIMIT`, `DEMO_STREAM_FAILED`, `DEMO_UNAVAILABLE` | 429, 429, 502, 503 | `/demo-streams` |
| `DRIP_IP_LIMIT`, `DRIP_DAILY_LIMIT`, `DRIP_FAILED`, `DRIP_UNAVAILABLE`, `DRIP_TREASURY_EMPTY` | 429, 429, 502, 503, 503 | `/gas-drips` |

## 7. Endpoint deprecated

Path lama berikut masih jalan dengan perilaku yang sama, supaya FE tidak langsung rusak. Responsnya membawa header `Deprecation: true` dan `Link: <path baru>; rel="successor-version"`.

| Path lama | Ganti dengan | Catatan |
| --------- | ------------ | ------- |
| `POST /api/v1/gas/drip` | `POST /api/v1/gas-drips` | Sama persis |
| `GET /api/v1/gas/status` | `GET /api/v1/gas-drips/status` | Sama persis |
| `GET /api/v1/fx/usd-idr` | `GET /api/v1/fx-rates/usd-idr` | Path baru **wajib login** |

Path lama akan dihapus setelah FE pindah. Kabari BE kalau sudah, atau kalau kurs perlu tampil sebelum login (mis. di landing page).
