# Aturan Kontribusi: Branch, Commit, dan Pull Request

Dokumen ini menjabarkan [§8.2 Git di `docs/PLAN.md`](docs/PLAN.md#82-git). Kalau ada yang bertentangan, `PLAN.md` yang berlaku.

## Ringkasnya

1. `main` dilindungi. Tidak ada push langsung, semua perubahan masuk lewat Pull Request (PR).
2. Satu fitur atau satu perbaikan = satu branch = satu PR.
3. Commit kecil dan sering, memakai format [Conventional Commits](https://www.conventionalcommits.org/).
4. CI harus hijau dan PR disetujui satu reviewer (pemilik area yang disentuh) sebelum merge.

## 1. Model branch

Kita memakai **GitHub Flow**: hanya ada satu branch jangka panjang, yaitu `main`. Branch lain berumur pendek dan dihapus setelah di-merge.

```
main ──●──────────●──────────────●──────▶   (selalu bisa di-deploy, otomatis ke production)
        \        / \            /
         ●──●──●    ●──●──●──●            feat/api-payouts, fix/api-session-expiry, ...
```

| Branch | Isi | Dibuat dari | Di-merge ke |
|---|---|---|---|
| `main` | Kode yang sudah direview dan lolos CI. Ter-deploy ke production. | — | — |
| `<tipe>/<area>-<deskripsi>` | Satu fitur atau satu perbaikan | `main` terbaru | `main` lewat PR |

Kita tidak memakai branch `development` jangka panjang. Untuk tim 4 orang dengan tenggat dua minggu, branch tambahan hanya menambah merge dan konflik. Preview per PR sudah berperan sebagai lingkungan uji.

### Penamaan branch

Format: `<tipe>/<area>-<deskripsi-singkat>`, huruf kecil, kata dipisah tanda hubung.

| Tipe | Kapan dipakai |
|---|---|
| `feat/` | Fitur atau endpoint baru |
| `fix/` | Perbaikan bug |
| `refactor/` | Mengubah struktur kode tanpa mengubah perilaku |
| `test/` | Hanya menambah atau memperbaiki test |
| `docs/` | Hanya dokumentasi |
| `chore/` | Konfigurasi, dependency, CI, deploy |

Area mengikuti kepemilikan di [§5 PLAN](docs/PLAN.md#5-peran--batas-kepemilikan): `api`, `web`, `contracts`, `shared`, `indexer`, `chain`, `ci`, `docs`.

Contoh:
- `feat/api-payouts`
- `feat/api-demo-try-as-worker`
- `fix/api-invite-expired-token`
- `chore/ci-railway-autodeploy`
- `docs/readme-architecture`

### Siklus kerja satu fitur

```bash
# 1. Mulai dari main terbaru
git switch main
git pull
git switch -c feat/api-payouts

# 2. Kerja, commit kecil-kecil
git add apps/api/src/...
git commit -m "feat(api): add payout repository"

# 3. Sebelum push, jalankan pemeriksaan yang sama dengan CI
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test

# 4. Push dan buka PR ke main
git push -u origin feat/api-payouts

# 5. Kalau main sudah maju dan ada konflik, ambil perubahan terbaru
git switch main && git pull
git switch feat/api-payouts
git merge main

# 6. Setelah PR di-merge, bersihkan
git switch main && git pull
git branch -d feat/api-payouts
```

Hindari `git push --force` di branch yang sudah dibuka PR-nya dan sedang direview. Kalau terpaksa, pakai `git push --force-with-lease`.

## 2. Aturan commit

### Format

```
<tipe>(<scope>): <ringkasan>

<badan opsional: kenapa perubahan ini perlu>

<footer opsional: Co-authored-by, Refs #12>
```

- **tipe**: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `perf`, `style`.
- **scope**: area yang disentuh (`api`, `web`, `contracts`, `shared`, `indexer`, `chain`, `ci`) atau modul yang lebih spesifik (`api/auth`, `api/payouts`). Boleh dikosongkan untuk perubahan lintas area.
- **ringkasan**: bahasa Inggris, kalimat perintah (*add*, bukan *added*), huruf kecil di awal, tanpa titik, maksimal 72 karakter.

Contoh baik:

```
feat(api): add POST /payouts endpoint
fix(api/auth): reject expired session cookies
test(api): cover payout ownership check
refactor(api): move bank account encryption to service layer
docs: add architecture section to README
chore(ci): run prisma generate before typecheck
```

Contoh buruk:

```
update                    -> tidak jelas apa yang berubah
fix bug                   -> bug yang mana?
feat: payouts, invites, refactor auth, fix tests   -> beberapa hal dalam satu commit
```

### Ukuran commit

- **Satu commit = satu perubahan logis** yang bisa dijelaskan dalam satu kalimat. Kalau ringkasannya butuh kata "dan", kemungkinan besar perlu dipecah.
- Setiap commit sebaiknya tetap bisa di-build dan lolos test, supaya riwayat mudah dilacak.
- Urutan yang disarankan untuk satu endpoint baru di `apps/api`:
  1. `feat(api): add <resource> schema and migration`
  2. `feat(api): add <resource> repository and service`
  3. `feat(api): add <METHOD> /<path> route and validation`
  4. `test(api): cover <resource> endpoints`
  5. `docs(api): update openapi spec for <resource>`
- Commit setiap hari kerja. Riwayat commit dinilai di rubrik C3 dan menjadi bukti kontribusi di C4.

### Identitas penulis

- Commit dengan akun GitHub dan email git milikmu sendiri (`git config user.name` dan `git config user.email`).
- Kerja berpasangan atau dibantu anggota lain: tambahkan trailer di baris terakhir pesan commit.

  ```
  Co-authored-by: Nama <email@contoh.com>
  ```

- Jangan pernah commit secret: `.env`, private key, API key. CI menjalankan gitleaks dan akan gagal.

## 3. Pull Request

### Sebelum membuka PR

- [ ] Branch dibuat dari `main` terbaru dan fokus pada satu fitur atau perbaikan.
- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, dan `pnpm test` lolos di lokal.
- [ ] Kalau endpoint berubah: `pnpm --filter @trickle/api openapi` sudah dijalankan dan `openapi.json` ikut di-commit.
- [ ] Kalau ada migrasi Prisma: migrasi ikut di-commit dan sudah dicoba di database lokal.

### Isi PR

Template PR otomatis muncul (`.github/pull_request_template.md`). Isi dengan **kata-katamu sendiri**: apa yang berubah, kenapa, dan alternatif yang ditolak. Reviewer boleh menahan PR kalau penulisnya tidak bisa menjelaskan isinya (§8.7 PLAN).

### Review dan merge

- Minimal **1 approval** dari pemilik area yang disentuh (lihat §5 PLAN). Untuk `apps/api/src/chain/`, reviewer-nya SC.
- Semua check CI harus hijau: *API (lint, typecheck, test)*, *Contracts (forge test)*, *Secret scan*.
- Semua komentar review diselesaikan (*resolve conversation*) sebelum merge.
- Merge memakai **Create a merge commit**, bukan *Squash*. Squash menggabungkan semua commit kecil menjadi satu, sehingga riwayat kerja harian hilang dari `main` padahal riwayat itu dinilai di C3.
- Branch dihapus otomatis setelah merge.

### Ukuran PR

Usahakan di bawah ±400 baris perubahan (di luar file hasil generate seperti `openapi.json` dan `pnpm-lock.yaml`). PR besar susah direview dan cenderung disetujui tanpa dibaca.

## 4. Tag rilis

Saat submit Metropolis, Koordinator membuat tag `metropolis-submission` di `main`. Kerja mata kuliah setelah 13 Okt berlanjut di `main` tanpa mengubah tag itu.

```bash
git switch main && git pull
git tag -a metropolis-submission -m "Metropolis hackathon submission"
git push origin metropolis-submission
```
