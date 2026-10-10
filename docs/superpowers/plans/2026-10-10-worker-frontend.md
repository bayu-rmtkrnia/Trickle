# Worker Frontend Implementation Plan

> **For agentic workers:** Use `executing-plans` to implement this plan task by task. Delegation requires explicit user authorization. Steps use checkboxes for tracking.

**Goal:** Worker dapat membuka undangan, masuk melalui Privy, bergabung dengan perusahaan, melihat gaji yang mengalir, menariknya ke embedded wallet, dan mengatur pembagian ke keluarga.

**Architecture:** Next.js menangani UI dan lifecycle akun. Fastify menyimpan identitas, sesi, undangan, serta relasi; kontrak menjadi sumber kebenaran nominal dan transaksi. Adapter API dan chain dipisahkan agar komponen tidak bergantung pada SDK Privy, mock Employer, atau endpoint yang belum tersedia.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind 4, Privy React SDK; Fastify, Prisma, Postgres; viem sebagai dependency langsung web saat integrasi chain; Foundry untuk kontrak.

## Global constraints

- Baseline audit: `feat/frontend-workerdashboard`, commit `035a5e3`, 10 Oktober 2026. Audit kode lokal, bukan verifikasi layanan production.
- Ini rencana pengembangan; endpoint berlabel USULAN belum tersedia dan harus disepakati dengan pemilik BE sebelum menjadi kontrak FE.
- Gunakan Node >=22 dan pnpm 10.13.1 melalui Corepack. Root `npm run dev` menjalankan API; web dijalankan terpisah.
- Pertahankan rute worker `/w` dan `/w/invite/[code]`; tidak membuat `/worker` sebagai rute paralel.
- Ikuti token, font, komponen, bahasa Indonesia, tema terang/gelap, dan pola sheet dari Employer UI.
- `docs/PLAN.md` melarang pause/resume, auto recurring payroll, multi-token, dan remit otomatis terjadwal. Jangan menambahkan kontrol tersebut.
- Uang dihitung dengan integer unit token (`bigint`), bukan float. API gaji referensi USD tidak dipakai menghitung saldo chain.
- Nama dan metadata berasal dari BE; saldo, split aktif, dan hasil penarikan berasal dari chain.
- Secret Privy hanya di BE. Jangan mencetak token sesi, access token, atau private key.
- Baca panduan Next lokal yang relevan di `apps/web/node_modules/next/dist/docs/` sebelum implementasi; `apps/web/AGENTS.md` mewajibkannya.
- WIP sebelum audit: `apps/web/next-env.d.ts`, `apps/web/AGENTS.md`, `apps/web/CLAUDE.md` dihasilkan sesi dev sebelumnya. Jangan dibersihkan atau ikut commit tanpa memeriksa diff.

## 1. Hasil audit dan sumber lokal

| Bagian | Keadaan aktual | Sumber |
| --- | --- | --- |
| Dashboard worker | Placeholder | `apps/web/app/w/page.tsx` |
| Undangan worker | Hanya menampilkan kode URL | `apps/web/app/w/invite/[code]/page.tsx` |
| Privy | Email/Google, pembuatan embedded Ethereum wallet, hook akun; belum sesi BE atau transaksi | `apps/web/providers/privy-provider.tsx`, `apps/web/lib/account.ts` |
| Data frontend | Semua fungsi di entry API sekarang mock untuk Employer | `apps/web/lib/api/index.ts`, `mock.ts`, `types.ts` |
| Design system | Warna ungu, Anton, Plus Jakarta Sans, button/sheet/field/avatar/skeleton/error | `apps/web/app/globals.css`, `app/layout.tsx`, `components/ui/` |
| Sesi | Tukar access token Privy menjadi token sesi opak Trickle; logout/revoke | `apps/api/src/modules/sessions/` |
| Profil/peran | Nama dan boolean employer/worker/family; tidak berisi detail pekerjaan | `apps/api/src/modules/users/` |
| Undangan | Public lookup, create/list milik pengundang, accept WORKER/FAMILY | `apps/api/src/modules/invites/` |
| Relasi | EmployerWorker dan FamilyLink ada; read API dari perspektif worker belum ada | `apps/api/prisma/schema.prisma` |
| Gas/kurs | Drip sekali per alamat dan kurs USD–IDR | `apps/api/src/modules/gas/`, `fx/` |
| Payroll | Contract + ABI tersedia, deployment manifest belum ditemukan | `contracts/src/TricklePayroll.sol`, `packages/shared/abi/` |
| Stream discovery/riwayat | Belum ada indexer atau API untuk worker | `apps/api/src/app.ts`, `contracts/src/ITricklePayroll.sol` |

Dokumen `ARCHITECTURE.md` dan `apps/web/README.md` sebagian tertinggal setelah penggabungan branch: kontrak/ABI dan Employer UI sekarang ada. Komentar menyebut `DESIGN.md`, tetapi file tersebut tidak ditemukan pada tree aktif. Dasar visual yang dapat diverifikasi adalah kode Employer dan CSS.

Kedua folder aplikasi saat audit hanya mempunyai `.env.example`; `.env` API dan `.env.local` web belum tersedia. Server frontend yang menyala sebelumnya belum membuktikan login atau BE sudah aktif.

## 2. Kontrak yang sudah dapat digunakan

Semua endpoint berikut memakai prefix `/api/v1`.

| Endpoint | Pemakaian worker | Catatan |
| --- | --- | --- |
| `POST /sessions` | Body `{accessToken}` dari Privy | 201 `{token, expiresAt, user}`; user di respons ini belum mempunyai roles |
| `DELETE /sessions/current` | Cabut sesi saat keluar | Auth Bearer token Trickle; 204 |
| `GET /users/me` | Identitas dan roles | Worker ditentukan dari jumlah relasi kerja, bukan pilihan di FE |
| `PATCH /users/me` | Ubah `displayName` | Tidak mengubah nama EmployerWorker/FamilyLink secara otomatis |
| `GET /invites/:code` | Preview sebelum login | Tipe, status, nama, gaji referensi, pengundang, kedaluwarsa |
| `POST /invites/:code/accept` | Bergabung sebagai worker | Membuat EmployerWorker, bukan stream; refresh `/users/me` setelah berhasil |
| `POST /invites` | Buat undangan keluarga | `{type:'FAMILY', inviteeName, relation?}`; wajib sudah punya relasi kerja |
| `GET /invites?type=FAMILY` | Daftar undangan yang dibuat worker | `{data,nextCursor}`; bukan daftar keluarga terhubung |
| `POST /gas/drip` | Danai biaya transaksi embedded wallet | Sekali per alamat; SENT tidak otomatis berarti receipt sukses |
| `GET /gas/status` | Informasi kesiapan treasury | Bukan endpoint status gas wallet worker |
| `GET /fx/usd-idr` | Estimasi Rupiah | Perhatikan `source: live/cache/fallback`; bukan jaminan kurs pencairan |

Gunakan `/accept` yang benar-benar terdaftar, bukan `/acceptance` dari roadmap. Endpoint `/recipients`, `/companies`, `/gas-drips`, `/fx-rates/usd-idr`, serta revoke invitation masih rencana. Jangan mengaktifkan fitur melalui URL tersebut sebelum implementasinya hadir.

`GET /employers/me/workers` adalah daftar pekerja perusahaan milik pemanggil. Endpoint ini tidak bisa dipakai worker untuk mengetahui perusahaan tempat ia bekerja.

Error undangan yang perlu dipetakan: `INVITE_NOT_FOUND`, `INVITE_ALREADY_ACCEPTED`, `INVITE_REVOKED`, `INVITE_EXPIRED`, `CANNOT_ACCEPT_OWN_INVITE`, `ALREADY_LINKED`, serta 401/422/429/network. GET undangan kedaluwarsa dapat tetap 200 dengan status EXPIRED; POST accept mengembalikan 410. Jangan memetakan semua 409 menjadi error yang sama.

## 3. UX worker yang akan dibangun

1. **Undangan:** nama perusahaan, nama worker, gaji referensi, status undangan; CTA masuk dan terima. Pertahankan URL undangan saat login. Validasi type WORKER sebelum menawarkan accept.
2. **Dashboard `/w`:** nama worker/perusahaan; kartu utama “Tersedia untuk ditarik”; estimasi Rupiah; stream/periode gaji dan status; aksi tarik; ringkasan pembagian keluarga; riwayat terbaru.
3. **Konfirmasi tarik:** pilih satu stream, total tersedia, estimasi bagian worker dan keluarga, aksi konfirmasi. Tidak ada input nominal bebas karena contract menarik semua yang tersedia pada stream terpilih.
4. **Keluarga:** buat/salin undangan, daftar relasi yang sudah diterima setelah API tersedia, pilih satu penerima aktif, atur persentase atau matikan pembagian.
5. **Riwayat:** hasil transaksi dari event chain, tautan explorer, detail bagian worker/keluarga. Hash yang baru disiarkan berstatus diproses sampai receipt sukses.
6. **Profil:** nama dan keluar; peran lain tetap boleh dimiliki akun yang sama.

State dashboard harus membedakan: belum login; konfigurasi belum tersedia; akun tanpa relasi kerja; sudah bergabung tetapi belum ada stream; stream belum mulai; aktif; berakhir tetapi masih bisa ditarik; dibatalkan tetapi masih ada hak tarik; saldo habis; data gagal/stale. Kegagalan pembacaan chain tidak boleh ditampilkan sebagai saldo nol.

Saldo “tersedia” adalah gross yang bisa ditarik sebelum split. Saldo token wallet adalah angka berbeda. Tampilkan estimasi bersih untuk worker pada konfirmasi. Bila 100% ke keluarga, tampilkan worker menerima nol secara eksplisit.

## 4. Integrasi Privy dan sesi Trickle

```text
Privy login email/Google
  -> embedded wallet siap
  -> getAccessToken()
  -> POST /api/v1/sessions {accessToken}
  -> simpan token Trickle + expiresAt dalam memori provider
  -> GET /api/v1/users/me dengan Authorization: Bearer <token Trickle>
  -> accept undangan bila user menekan Terima
  -> refresh profil dan data worker
```

Rekomendasi tahap awal: sesi Trickle berada dalam memori React provider. Refresh halaman mengambil ulang token Privy melalui SDK dan membuat sesi Trickle baru. Ini cocok dengan bearer API sekarang tetapi menghasilkan sesi tambahan pada refresh; dokumentasikan dan ukur sebelum production. Untuk sesi persisten tanpa penyimpanan token di JavaScript, pekerjaan berikutnya adalah BFF/cookie HttpOnly dengan proteksi CSRF; jangan menganggap BE sekarang telah mendukung cookie.

- Tunggu `configured`, `ready`, `authenticated`, dan embedded wallet. `ready=true` sendiri tidak menjamin `walletAddress` tersedia.
- Gunakan satu promise pembuatan sesi yang dipakai bersama per identitas; cegah request ganda akibat banyak komponen atau Strict Mode.
- `WALLET_NOT_READY`: retry terbatas 1, 2, 4, 8 detik; kemudian tombol coba lagi. 429 menghormati Retry-After. 401 tidak diulang tanpa batas; 502/503 tampilkan gangguan layanan.
- Bedakan Privy DID dari ID User BE. Cache dibersihkan pada logout/pergantian identitas. Abaikan respons akun lama yang datang terlambat.
- Cocokkan alamat sesi BE dengan embedded wallet sebelum transaksi. Ketidakcocokan memblokir write dan memicu pemulihan sesi.
- Pada 401 API, invalidasi sesi dan lakukan pemulihan satu kali. GET boleh diulang setelah sesi pulih; mutation tidak diulang otomatis jika hasil request sebelumnya tidak pasti.
- Logout berusaha revoke sesi BE, lalu selalu hapus state lokal dan logout Privy. Laporkan kegagalan revoke sebagai status terpisah, jangan mengaku sesi server sudah dicabut jika request gagal.
- Pisahkan readiness sesi BE dari readiness chain; gangguan RPC tidak boleh menghalangi preview atau penerimaan undangan.
- Tambahkan konfigurasi Monad ke provider dan adapter transaksi akun. Gunakan embedded wallet yang dipilih secara eksplisit; jangan memilih wallet pertama secara sembarang.

## 5. Integrasi kontrak

ABI lokal mendukung `getStream`, `streamedAmount`, `withdrawable`, `splitOf`, `withdraw`, `setSplit`. Tidak ada fungsi untuk daftar stream berdasarkan wallet. Karena itu perlu discovery dari event `StreamCreated(worker)` atau indexer.

**Jalur MVP yang diusulkan:** adapter viem membaca log terfilter alamat worker mulai deployment block, secara bertahap dalam rentang block terbatas, lalu membaca `getStream` per ID. Cache berdasarkan chain + alamat kontrak + wallet; deduplikasi event dengan txHash/logIndex; checkpoint hanya maju setelah rentang berhasil. Refresh head dengan overlap untuk menangani reorg dan resync ketika tab aktif. Jika RPC tidak mendukung log historis atau dataset membesar, SC menyediakan indexer/listener dengan interface sama. Jangan memindai seluruh ID dari 1 ke `nextStreamId` setiap render.

Deployment manifest dari SC perlu memuat `chainId`, `payrollAddress`, `tokenAddress`, `deploymentBlock`, `tokenSymbol`, `tokenDecimals`, `isMock`, dan explorer base URL terverifikasi. Cocokkan `token()` dengan manifest. Kode lokal memakai chain 10143; alamat deployment aktual belum diketahui. MockAUSD lokal 6 desimal dan bisa di-mint siapa pun: UI harus menyebut aset demo ketika digunakan.

Perhitungan ticker sama dengan Solidity, memakai snapshot waktu block dan waktu monoton lokal untuk animasi. Sinkron RPC berkala (awal 15 detik saat tab aktif), setelah receipt/event, dan saat tab kembali aktif; bukan polling per detik. Jika snapshot lebih dari 30 detik tanpa pembaruan, hentikan estimasi bergerak dan tandai data tertunda.

```ts
export type StreamSnapshot = {
  amount: bigint; withdrawn: bigint; refunded: bigint;
  start: bigint; end: bigint; canceled: boolean;
};
export function availableAt(s: StreamSnapshot, now: bigint): bigint {
  const zero = BigInt(0);
  const vested = s.canceled ? s.amount - s.refunded
    : now <= s.start ? zero
    : now >= s.end ? s.amount
    : s.amount * (now - s.start) / (s.end - s.start);
  return vested > s.withdrawn ? vested - s.withdrawn : zero;
}
export function splitAmounts(gross: bigint, bps: number) {
  const family = gross * BigInt(bps) / BigInt(10000);
  return { worker: gross - family, family };
}
```

Gunakan `BigInt(...)` bila mempertahankan target TS ES2017 saat ini; bigint literal membutuhkan penyesuaian target. Definisikan format unit token sendiri untuk angka besar; helper `formatUsd(number)` saat ini hanya cocok sebagai format display nominal terbatas.

**Withdraw:** baca nilai terkini dan gas -> simulate -> konfirmasi Privy -> siarkan -> tunggu receipt -> baca event Withdrawn untuk angka aktual -> refresh saldo wallet, withdrawable, split, riwayat. Jumlah bisa bertambah antara preview dan block eksekusi. Tangani user rejection, NothingToWithdraw, NotWorker, RPC timeout, revert, replacement/cancel, dan koneksi putus setelah broadcast. Timeout receipt berarti hasil belum diketahui; cek hash sebelum menawarkan transaksi ulang. Satu transaksi per stream; batch “tarik semua stream” di luar MVP.

**Split:** `setSplit(recipient,bps)` berlaku untuk seluruh stream worker, termasuk nominal yang sudah mengalir tetapi belum ditarik. Satu penerima aktif, bps 0–10000, 1% = 100 bps. Matikan dengan zero address dan bps 0. Keluarga menerima token saat withdraw; tidak setiap detik. Daftar relasi bisa banyak, tetapi UI hanya mengizinkan satu penerima split aktif.

**Gas:** `POST /gas/drip` adalah pendanaan awal sekali per alamat, bukan paymaster untuk setiap transaksi. `SENT` di BE ditetapkan setelah broadcast; tunggu receipt dan periksa balance native sebelum write. Akun yang pernah diberi drip lalu kehabisan gas membutuhkan penanganan BE/SC tambahan; tampilkan transaksi belum tersedia, jangan membuat loop drip. Jangan mengaktifkan fitur sponsor Privy tanpa konfigurasi dan verifikasi tersendiri.

## 6. Permintaan integrasi ke BE dan SC

### BE — prioritas minimum

1. URL API yang berjalan, Postgres + migrasi, konfigurasi Privy pada app yang sama dengan FE, CORS dan WEB_URL.
2. Read relasi pekerjaan dari perspektif user: **USULAN** `GET /api/v1/users/me/employments?limit=&cursor=`. Respons `{data,nextCursor}`, setiap baris `{id,displayName,monthlySalaryUsd,joinedAt,employer:{id,name,country,ownerAddress}}`. Query dibatasi `workerId=req.user.sub`; tidak menerima arbitrary userId dari FE. Mendukung lebih dari satu employer. Ini melengkapi Workers CRUD pada roadmap.
3. Read penerima terhubung: **USULAN sesuai roadmap** `GET /api/v1/recipients?limit=&cursor=` -> `{data,nextCursor}`, setiap baris `{id,displayName,relation,relativeUserId,address,createdAt}` dari FamilyLink milik worker. Address berasal dari User yang telah menerima undangan. InviteDto tidak menyediakan address penerima dan tidak boleh digunakan sebagai pengganti endpoint ini.
4. Revoke undangan dan CRUD penerima menyusul sesuai roadmap. Sebelum aktif, sepakati konsistensi delete penerima dengan split chain; tidak boleh menampilkan relasi terhapus sementara split masih mengirim ke alamat tersebut.

### SC — prioritas minimum

1. Deployment manifest dan RPC yang dapat dipakai FE, ABI yang cocok, token yang dipakai, deployment block, explorer.
2. Stream yang benar-benar didanai ke embedded wallet worker untuk uji.
3. Log read/indexer untuk stream dan riwayat; konfirmasi batas rentang request log.
4. Treasury testnet terdanai untuk drip; jalur pemulihan bila gas worker habis.

Employer UI sekarang mock: link yang dibuatnya tidak tercatat di BE. Untuk uji pertama, buat Employer + WORKER invite melalui API menggunakan akun employer sungguhan/alat dev resmi, lalu danai stream melalui contract. Uji lintas UI employer menunggu integrasi real pada sisi tersebut.

## 7. Rencana implementasi bertahap

### Task 1 — API nyata dan lifecycle sesi

**Files:** create `apps/web/lib/api/client.ts`, `session.ts`, `worker-types.ts`, `apps/web/providers/session-provider.tsx`, `apps/web/test/session.test.ts`; modify `apps/web/app/layout.tsx`, `apps/web/lib/api/errors.ts`, `apps/web/.env.example`, `apps/web/package.json`; create `apps/web/vitest.config.ts`.

**Interfaces:** `createSession(accessToken): Promise<{token,expiresAt,user}>`; `getMe(token): Promise<Me>`; `revokeSession(token): Promise<void>`; `useSession()` exposes `status`, `user`, `ensureSession`, `refreshMe`, `logout`. Me adds `{roles:{employer,worker,family}}` to UserDto. HTTP client takes explicit token, path, method, body, AbortSignal; preserves HTTP status/code/details.

- [ ] Add web test script `vitest run`, Vitest direct dev dependency, and alias configuration matching `@/`. Keep unit tests independent from real Privy/DB.
- [ ] Specify tests: concurrent session requests share one exchange; WALLET_NOT_READY has bounded retries; 401 recovers once; logout/account change discards late response; failed revoke still clears local state; 204 body is not parsed as JSON.
- [ ] Implement state transition `unconfigured -> loading -> signed-out | exchanging -> ready | error`, with identity-scoped pending promise and generation counter.
- [ ] Set `NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1` in example; pass Trickle bearer only to protected API calls. Keep Employer mock entry point working while worker imports named real adapters.
- [ ] Run `corepack pnpm --filter @trickle/web test` and typecheck; deliver login + `/users/me` working against configured BE. Commit `feat(web): connect privy login to trickle sessions` after checks.

### Task 2 — Undangan worker sampai resmi bergabung

**Files:** modify `apps/web/app/w/invite/[code]/page.tsx`; create `apps/web/components/worker/worker-invitation.tsx`, `apps/web/lib/api/invitations.ts`, `apps/web/lib/copy/worker.ts`, `apps/web/test/worker-invitation.test.ts`.

**Interfaces:** `getInvitation(code,signal): Promise<Invite>`; `acceptInvitation(code,token): Promise<Invite>`; `createFamilyInvitation(input,token): Promise<Invite>`; `listFamilyInvitations(token,cursor?): Promise<Page<Invite>>`. Reuse verified Invite shape, not mock functions.

- [ ] Write tests for PENDING WORKER, FAMILY on wrong route, expired GET 200, accept 410, used/revoked/self/already-linked, login cancellation, double click, and reload after acceptance.
- [ ] Server page awaits params and renders client invitation; load public details first. Preserve code in URL through login. Require explicit accept action; disable while submitting.
- [ ] On success refresh Me then navigate `/w`. If already accepted, never assume it belongs to current user: DTO omits acceptedBy, so offer dashboard and verify available relationship rather than falsely claiming acceptance.
- [ ] Test with real BE-created invitation and two distinct users. Commit `feat(web): add worker invitation onboarding` after checks.

### Task 3 — Read model worker di BE dan dashboard awal

**Files, BE proposal:** modify `apps/api/src/modules/users/{routes,schemas,controller,service,repository}.ts`; create `apps/api/test/employments.test.ts`; update `apps/api/openapi.json`, `apps/api/postman/Trickle.postman_collection.json`, `docs/ARCHITECTURE.md`.

**Files, FE:** modify `apps/web/app/w/page.tsx`; create `apps/web/components/worker/worker-dashboard.tsx`, `worker-shell.tsx`, `salary-card.tsx`, `apps/web/lib/api/worker.ts`, `apps/web/test/worker-dashboard.test.ts`.

**Interfaces:** agreed EmploymentDto from section 6; `listMyEmployments(token,cursor?): Promise<Page<EmploymentDto>>`. Backend source is EmployerWorker filtered by authenticated worker. No balance field.

- [ ] Confirm proposed route/DTO with BE owner before production integration; implement as its own change if assigned locally.
- [ ] Test user A cannot read user B employment rows, pagination works, user with no relations gets empty data, unauthenticated request returns 401.
- [ ] Compose mobile dashboard with existing tokens/components; render no-employment, waiting-for-stream, loading/error states independently. Do not synthesize a moving salary from monthlySalaryUsd.
- [ ] Match employer address to stream employer only when metadata exists; unknown sender remains explicitly unknown. Existence of a chain stream and role metadata are distinct facts.
- [ ] Run BE unit/integration tests with test database; regenerate OpenAPI/Postman; web lint/typecheck. Deliver authenticated dashboard with real profile/company metadata. Commit metadata API and UI separately.

### Task 4 — Chain reader, stream discovery, dan ticker

**Files:** create `apps/web/lib/chain/config.ts`, `payroll-reader.ts`, `stream-math.ts`, `format-token.ts`, `types.ts`, `apps/web/hooks/use-worker-streams.ts`, `apps/web/test/stream-math.test.ts`, `payroll-reader.test.ts`; modify salary card; add direct `viem` dependency to web. SC supplies `packages/shared/deployments/testnet.json` with actual verified values.

**Interfaces:** `listWorkerStreamIds(address,signal): Promise<bigint[]>`; `readWorkerSnapshot(address,signal): Promise<{streams,split,walletBalance,blockNumber,blockTimestamp}>`; `availableAt` and `splitAmounts` from section 5. Snapshot monetary fields remain bigint.

- [ ] Test math before start, at start/end, elapsed rounding, prior withdrawals, canceled stream using refunded, split 0/30/100%, amounts beyond Number.MAX_SAFE_INTEGER.
- [ ] Reader tests: bounded log ranges, ownership filtering, duplicate events, partial range failures, checkpoint restart, account-scoped caches. Verify contract bytecode/token and chain against manifest.
- [ ] Implement reader and timer from section 5; separate initial failure from stale last-known value. Sum across streams for overview; show per-stream actions and period.
- [ ] Example exact assertion: with amount=1000000, start=100, end=200, withdrawn=100000, refunded=0 and now=150, `availableAt` equals `BigInt(400000)`; cancellation refunded=600000 freezes available at `BigInt(300000)`.
- [ ] Verify against contract view at same block snapshot; run web tests/typecheck. Deliver live balance on a funded testnet/local stream. Commit `feat(web): read worker payroll streams and live balances`.

### Task 5 — Penarikan dengan embedded wallet

**Files:** modify `apps/web/lib/account.ts`, `apps/web/providers/privy-provider.tsx`; create `apps/web/lib/chain/payroll-writer.ts`, `apps/web/lib/api/gas.ts`, `apps/web/components/worker/withdraw-sheet.tsx`, `transaction-status.tsx`, `apps/web/test/withdraw.test.ts`.

**Interfaces:** add `sendTransaction({to,data,chainId,value?}): Promise<{hash}>` to Account with explicit unconfigured fallback; writer `withdrawStream(streamId): Promise<TransactionResult>`. Privy SDK hooks remain inside provider adapter. Gas API exposes its actual PENDING/SENT/FAILED DTO.

- [ ] Configure target chain in Privy provider; select embedded wallet; verify wallet address equals BE account address; simulate withdrawal with correct caller.
- [ ] Add tests for correct encoded stream ID and signer, duplicate submit, gas failure, rejected signature, broadcast pending, receipt revert/replacement, NothingToWithdraw, late receipt after account switch.
- [ ] Implement explicit state machine `idle -> confirming -> signing -> pending -> success | failed | unknown`. Persist only pending tx hashes scoped to chain/contract/account if recovery after refresh is needed.
- [ ] In success sheet show event-derived actual amounts; refetch authoritative state. Do not subtract an estimated amount optimistically as final settlement.
- [ ] Complete one real testnet withdrawal and verify receipt + worker token balance. Commit `feat(web): withdraw worker salary with privy wallet`.

### Task 6 — Undangan keluarga dan split aktif

**Files:** create `apps/web/components/worker/family-section.tsx`, `invite-family-sheet.tsx`, `split-sheet.tsx`, `apps/web/lib/api/recipients.ts`, `apps/web/test/family-split.test.ts`; extend payroll writer with `setWorkerSplit(address,bps)`. Proposed BE read endpoint uses new `apps/api/src/modules/recipients/{routes,schemas,controller,service,repository}.ts`, registration in app, `apps/api/test/recipients.test.ts` and generated docs.

**Interfaces:** `listMyRecipients(token,cursor?): Promise<Page<RecipientDto>>`; RecipientDto per section 6. Existing invite API handles FAMILY create/list. Chain `splitOf` is authoritative for active selection.

- [ ] First deliver create/list/copy FAMILY invitations via existing endpoint. Full acceptance journey in `/f/invite/[code]` is a coordinated family task; the current route is also placeholder. Test acceptance through API until that page is implemented.
- [ ] Add BE ownership tests and read API before enabling selection. Accepted invitation alone supplies no recipient address; never fabricate or infer it from display name.
- [ ] Test waiting/accepted invite vs linked family distinction, unknown current split recipient, one active recipient, 3000 bps, disable with zero address/0, 100% allocation, canceled transaction retaining prior split.
- [ ] Show explanation that split applies across streams and transfers on withdrawal. Confirm/save through wallet and refresh split only after successful receipt.
- [ ] Verify worker/family balances after a split withdrawal using two accounts. Commit invitation, recipients API, and split UI as separate reviewable changes.

### Task 7 — Riwayat, ketahanan, dan handoff

**Files:** create `apps/web/lib/chain/history-reader.ts`, `apps/web/components/worker/worker-history.tsx`, `apps/web/test/history-reader.test.ts`; update web README, env examples, and architecture documentation.

**Interfaces:** `listWorkerWithdrawals(address,cursor?): Promise<{data,nextCursor}>`; item `{streamId,txHash,logIndex,blockNumber,blockTimestamp,toWorker,recipient,toRecipient}`. Monetary values bigint internally; stringify decimal units at JSON boundaries.

- [ ] Read Withdrawn logs from verified contract and worker filter; bounded pagination, descending block/transaction/log order, dedup and reorg overlap. Use event values for receipts.
- [ ] Test empty/history-failed separately, stale balance, tab sleep/resume, account switch, reconnect after broadcast, session expiry, 422 per-field errors, and fallback FX label.
- [ ] Browser acceptance at 360px and desktop, dark/light, keyboard/focus in sheets, reduced motion, long names; moving balance must not be aria-live every second. Preserve touch targets and avoid horizontal overflow.
- [ ] Update docs to reflect actual branch integration and real token flow. Record supported configuration and which integrations are still pending external readiness.
- [ ] Run required checks below and commit `feat(web): add worker withdrawal history and recovery states` once passing.

## 8. Verification gates and startup

At implementation time, add Vitest to web before using its test command. Existing repository has no web test runner/script. Unit auth and chain tests use fakes; integration confirmation requires real configured services.

```powershell
corepack pnpm --filter @trickle/web test
corepack pnpm --filter @trickle/web lint
corepack pnpm --filter @trickle/web typecheck
corepack pnpm --filter @trickle/web build
```

Expected: worker behavior tests pass; lint/typecheck exit 0; production build includes `/w` and `/w/invite/[code]`. For BE modifications, run affected Vitest tests plus integration tests with a dedicated TEST_DATABASE_URL; regenerate `openapi` and `postman`. Existing API test suite has known environment setup limitations without a test DB; failures must be reported, not silently treated as passing.

Local prerequisites: copy respective example env files, fill actual Privy config privately, start Postgres from docker compose, apply existing migrations with `corepack pnpm --filter @trickle/api db:deploy`, generate client, start API and web in separate terminals:

```powershell
corepack pnpm --filter @trickle/api db:generate
corepack pnpm --filter @trickle/api dev
# Separate terminal:
corepack pnpm --filter @trickle/web dev
```

Minimum final real flow: employer creates BE invitation -> worker previews -> Privy login -> BE session -> accept -> metadata visible -> funded stream discovered -> balance grows -> withdraw confirmed -> family invite accepted -> split confirmed -> withdraw sends correct shares -> history survives refresh -> logout revokes current API session. A green build alone does not establish this flow.

## 9. Milestones and dependencies

| Milestone | Tasks | Prerequisite | Reviewable result |
| --- | --- | --- | --- |
| M1 | 1–2 | Privy config + working BE/DB + real invitation | Worker joins through actual login/invite flow |
| M2 | 3–4 | Employment read API + deployment + stream discovery + funded stream | Dashboard with real metadata and growing balance |
| M3 | 5 | Gas + embedded signer on correct chain | Actual withdrawal and receipt |
| M4 | 6 | Linked recipient read API + family acceptance | One active family split and successful shared withdrawal |
| M5 | 7 | Historical logs/indexer | History, recovery, responsive verification |

Start with M1. UI layout and deterministic fixtures can proceed while BE/SC dependencies are prepared, but fixture mode must be explicitly labeled and must never activate real financial write actions. No calendar ETA is promised before environment and contract deployment readiness are known.

## 10. External references checked

- [Privy access tokens](https://docs.privy.io/authentication/user-authentication/access-tokens): use SDK token getter; Trickle adds its own exchange per local BE implementation.
- [Privy switch chains](https://docs.privy.io/wallets/using-wallets/ethereum/switch-chain): configure supported chain, switch the selected embedded wallet.
- [Privy send Ethereum transaction](https://docs.privy.io/wallets/using-wallets/ethereum/send-a-transaction): SDK returns broadcast hash; application waits for receipt before settlement UI.

SDK signature also checked against installed `apps/web/node_modules/@privy-io/react-auth/dist/dts/index.d.ts`. Planning audit did not perform live Privy login, deploy contracts, or send transactions.
