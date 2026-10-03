# Pembagian Tugas Milestone 1 PAW (Backend)

Halo guys 👋 ini pembagian tugas buat **Milestone 1 PAW (Backend)**.

> **Deadline:** Rabu, 30 Sep 2026, 09.29 WIB
> **Target kita:** malam ini (Selasa, 29 Sep) jam **23.00** semua udah beres. Besok pagi tinggal submit.

**Kabar baiknya:** kode backend + API-nya udah jadi dan udah masuk ke repo. Sisanya tinggal **laporan PDF** sama **lengkapin README**. Kalau kita bagi rata, ini bisa selesai paralel kok.

## Yang diminta dosen

📄 **Laporan PDF**
- Nama anggota
- User story → analisis kebutuhan → analisis fitur
- Daftar API + screenshot hasil tes di Postman
- Upload ke GDrive, link-nya harus bisa dibuka siapa aja

📘 **README di repo**
- Nama kelompok & anggota
- Link GDrive laporan
- (Deskripsi, struktur folder, dan teknologi udah diisi)

---

## 🧑‍💻 Aga (Backend)

- Deploy API ke server online biar bisa dites dari mana aja. **Link-nya dikirim ke grup maks jam 15.00.**
- Nulis bagian **Daftar API** di laporan + bagian "yang dikerjain di milestone berikutnya"
- Malamnya cek ulang laporan biar nama endpoint & kode error-nya pas

## 🔗 Jaki (Smart Contract): tes API pakai Postman

**Sekarang (nggak perlu nunggu server):**
- `git pull`, `pnpm install`, terus import `apps/api/postman/Trickle.postman_collection.json` ke Postman
- Coba jalanin dulu di lokal biar kebayang alurnya (cara lengkapnya ada di README bagian *Running locally*)

**Setelah link server dikirim:**
- Ganti variabel `baseUrl` ke link server
- Jalanin folder 1 sampai 6 berurutan
- Buat request **Verify**, jalanin perintah ini, terus tempel hasilnya ke body request:
  ```bash
  cd apps/api
  pnpm sign employer --api <link-server>    # juga: worker, family
  ```
  ⚠️ Kodenya cuma berlaku **5 menit**, jadi jalanin pas mau klik Send aja.

**Aturan screenshot:**
- Tiap request 1 screenshot. URL, body, status, sama response-nya harus kelihatan
- Ambil yang **berhasil dan yang error juga** (400, 401, 403, 404, 409)
- Kasih nama berurutan, misal `04-02-accept-invite-200.png`
- Bonus: 1 screenshot **Run collection** yang semua test-nya hijau ✅

**Upload semua ke folder GDrive bareng maks jam 17.30.**

## 📱 Bayu (FE Pekerja & Keluarga): user story + analisis kebutuhan

**User story (maks jam 14.00)**
- Formatnya: _"Sebagai [peran], saya ingin [...], agar [...]"_
- Kasih kode biar gampang dirujuk: `US-E01` (employer), `US-W01` (pekerja), `US-F01` (keluarga)
- Kira-kira 4–6 per peran, ambil dari alur utama aplikasi kita

**Analisis kebutuhan (maks jam 16.00)**, diturunin dari user story:
- **Kebutuhan fungsional** (`KF-01`, `KF-02`, …). Tiap baris sebutin asal user story-nya, misal _"KF-03: Sistem bisa bikin undangan pekerja (US-E02)"_
- **Kebutuhan non-fungsional** (`KNF-01`, …): keamanan login, validasi input, pembatasan request, format error yang seragam

Kalau udah, kabarin [nama FE-B].

## 🎨 Raka (FE Employer & Design): analisis fitur + rapihin laporan

**Jam 13.00**
- Bikin template laporan di Google Docs, share ke semua (akses edit). Urutan babnya:
  1. Anggota
  2. Deskripsi aplikasi
  3. User story
  4. Analisis kebutuhan
  5. Analisis fitur
  6. Daftar API
  7. Hasil pemanggilan API (Postman)
  8. Rencana milestone berikutnya
- Minta **nama lengkap + NIM** semua anggota di grup

**Jam 16.00–18.00: analisis fitur.** Kolom tabelnya:

| Kode | Nama fitur | Penjelasan | Kebutuhan yang dipenuhi | Prioritas | Status |
|---|---|---|---|---|---|
| F-01 | … | … | KF-xx | Must / Should / Could / Won't | API selesai / Milestone berikutnya / Smart contract |

**Jam 17.30–20.00**
- Masukin screenshot Postman, 1 subbab per endpoint

**Jam 22.30**
- Export PDF → upload ke GDrive → Share → **"Anyone with the link"** → kirim link ke grup
- Isi link GDrive + nama anggota di README, terus cek link-nya dari mode incognito

---

## ⏰ Checkpoint (kabarin di grup ya)

| Jam | Yang udah harus beres |
|---|---|
| 13.00 | Template laporan + data anggota |
| 14.00 | User story |
| 15.00 | Link server online |
| 16.00 | Analisis kebutuhan |
| 17.30 | Screenshot Postman + daftar API |
| 20.00 | Semua isi laporan masuk |
| 22.30 | PDF di GDrive |
| 23.00 | README beres, **selesai** 🎉 |
| Rabu, sebelum 08.00 | Submit |

## Kalau ada masalah

- Mentok lebih dari 30 menit? Langsung bilang di grup, jangan dipendem.
- Server telat online? Screenshot bisa pakai `localhost` dulu, tetap sah kok.

Makasih guys, gas! 🔥
