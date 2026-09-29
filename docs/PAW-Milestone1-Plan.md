# Rencana PAW Milestone 1 (Backend)

> **Deadline:** Rabu, 30 Sep 2026, 09:29 WIB
> **Target internal:** Selasa, 29 Sep 2026, 23:00 WIB. Rabu pagi hanya buffer.
> **Dibuat:** Minggu, 27 Sep 2026 · pemilik dokumen: BE

## Output yang diminta

**Laporan PDF**
- Nama anggota
- Analisis kebutuhan: daftar kebutuhan user berdasarkan user story
- Analisis fitur: daftar fitur yang perlu dibuat berdasarkan hasil analisis kebutuhan
- Daftar API yang dibuat + hasil pemanggilan API via Postman
- Diunggah ke GDrive, URL memiliki izin akses

**README.md di repository**
- Deskripsi aplikasi
- Nama kelompok dan daftar anggota
- Struktur folder dan file proyek
- Teknologi yang digunakan
- URL GDrive laporan

## Prinsip

- Kerja BE untuk milestone ini **sama dengan** kerja BE di rencana hackathon untuk F0 dan F1 (lihat `AgaPersonalNotes.md` §7). Bedanya hanya jadwal yang dimajukan 1–2 hari, jadi tidak ada kerja yang terbuang.
- Tidak ada endpoint stub atau data palsu (§3.2). Endpoint yang belum dibangun ditulis sebagai "Direncanakan" di laporan.

## Scope API

| Method | Endpoint | Fungsi | Target Rabu |
|---|---|---|---|
| GET | `/health` | Cek status API + koneksi DB | ✅ |
| POST | `/auth/challenge` | Nonce untuk ditandatangani | ✅ |
| POST | `/auth/verify` | Verifikasi tanda tangan → sesi (JWT) | ✅ |
| GET | `/auth/me` | Data user dari sesi | ✅ |
| POST | `/employers` | Buat profil perusahaan | ✅ |
| GET | `/employers/me` | Lihat profil perusahaan | ✅ |
| POST | `/invites` | Buat undangan pekerja/keluarga | ✅ |
| GET | `/invites/:code` | Lihat detail undangan | ✅ |
| POST | `/invites/:code/accept` | Terima undangan | ✅ |
| GET | `/fx/usd-idr` | Kurs USD→IDR, cache 10 menit + fallback | ✅ |
| POST | `/gas/drip` | Isi MON ke alamat baru; idempoten; batas harian | ✅ (dipotong pertama kalau mepet) |
| POST, GET | `/payouts`, `/payouts/:id` | Pencairan keluarga (sandbox) | 📝 Direncanakan (butuh kontrak + Xendit/Flip) |
| POST | `/webhooks/payout` | Status dari provider | 📝 Direncanakan |
| POST | `/demo/try-as-worker` | Judge mode | 📝 Direncanakan (butuh kontrak live) |

**Aturan:** semua input divalidasi (Zod), dan semua error memakai format `{ code, message }` sejak endpoint pertama.

## Stack

| Bagian | Pilihan | Alasan |
|---|---|---|
| Runtime | Node.js + TypeScript | Sesuai §4.1 |
| Framework | Fastify + Zod | OpenAPI dibuat otomatis → di-import ke Postman |
| ORM & migrasi | Prisma | Setup dan migrasi paling cepat |
| Database | Postgres (Neon) | Gratis, tanpa setup server |
| Chain | viem | Verifikasi tanda tangan, gas drip |
| Hosting API | Railway / Render | Supaya URL Postman publik |

**Catatan Postman:** Postman tidak bisa menandatangani pesan dengan private key. Sediakan script `pnpm sign <nonce>` yang memakai private key testnet dummy (dibaca dari `.env`, tidak di-commit) untuk menghasilkan signature. Hasilnya ditempel ke request `/auth/verify`.

## Timeline

### Minggu 27 Sep → target 22:00 (bersamaan dengan G0)

**BE**
- [x] Monorepo pnpm + skeleton `apps/api`
- [x] Koneksi Postgres (lokal via Docker; Neon saat deploy) + skema Prisma (users, employers, employer_workers, invites, family_links, gas_drips, payouts) + migrasi
- [x] `.env.example`, `LICENSE` (MIT)
- [x] `GET /health` jalan lokal
- [ ] Daftar akun sandbox Xendit **dan** Flip

**Teman**
- [ ] Template laporan di Google Docs
- [ ] Draft user story untuk 3 peran (employer, pekerja, keluarga) dari §3.1

### Senin 28 Sep → OpenAPI freeze 22:00

**BE**
- [x] Auth: challenge, verify, JWT, middleware, `GET /auth/me`
- [x] Script `pnpm sign`
- [x] Employers
- [x] Invites (buat, lihat, terima)
- [x] Error handler seragam + validasi Zod

**Teman**
- [ ] Analisis kebutuhan selesai
- [ ] Analisis fitur selesai (dipetakan ke MoSCoW §3.3)
- [ ] Malam: import OpenAPI ke Postman, siapkan environment (`baseUrl`, `token`)

### Selasa 29 Sep → semua selesai 23:00

**BE (pagi–siang)**
- [x] `GET /fx/usd-idr` + cache + fallback
- [x] `POST /gas/drip` + rate limit
- [ ] Deploy API ke Railway/Render

**Teman (sore)**
- [ ] Jalankan semua request Postman terhadap URL deploy
- [ ] Screenshot kasus sukses **dan** error (401 tanpa token, 400 validasi, 404 undangan tidak ada)
- [ ] Masukkan ke laporan

**Semua (malam)**
- [ ] README: struktur folder + teknologi (BE), deskripsi + anggota (teman)
- [ ] Ekspor laporan ke PDF → upload ke GDrive → set "Anyone with the link"
- [ ] Tempel link GDrive di README → push

### Rabu 30 Sep, 00:00–09:29 → buffer

- [ ] Cek link GDrive dan repo dari jendela incognito
- [ ] Submit **paling lambat 08:00**
- [ ] Tidak ada kerja fitur

## Pembagian tugas

| Orang | Tugas |
|---|---|
| BE | Kode API, DB, deploy, bagian teknis README |
| FE-A | User story + analisis kebutuhan (paling paham alur pekerja & keluarga) |
| FE-B | Analisis fitur, layout PDF, bagian non-teknis README |
| SC | Postman + screenshot hari Senin malam. Selasa sibuk deploy kontrak, jadi kalau tidak sempat, pindah ke FE-B |

## Struktur laporan PDF

1. Nama kelompok & anggota
2. Deskripsi singkat aplikasi
3. User story (per peran)
4. Analisis kebutuhan
5. Analisis fitur (Must / Should / Could / Won't)
6. Daftar API (tabel scope di atas)
7. Hasil pemanggilan API via Postman (screenshot request + response per endpoint, termasuk kasus error)
8. Endpoint yang direncanakan untuk milestone berikutnya

## Dampak ke rencana hackathon

- Listener event (tugas BE F1) mundur ke Rabu–Kamis. Masih aman untuk G1 (Kamis 1 Okt, 22:00).
- D4 (domain final) tidak menghambat milestone ini, tapi tetap diputuskan Minggu malam untuk G0.
- Kalau jadwal kuliah Senin/Selasa padat, `/gas/drip` dipindah ke "Direncanakan" dan dikerjakan Rabu setelah submit.
