# Step-by-Step Implementation Plan

Ditulis supaya Claude Code bisa jalan fase demi fase. Selesaikan satu fase, test
manual (load unpacked extension di `chrome://extensions`), baru lanjut. Jangan
gabung beberapa fase sekaligus dalam satu sesi kerja — state & schema saling
bergantung, lebih gampang debug kalau bertahap.

Sebelum mulai, baca `BLUEPRINT.md` bagian 2 (Non-Goals) — itu batasan keras,
bukan saran opsional.

## Phase 0 — Project setup
- Buat project Supabase baru, jalankan `supabase/schema.sql` di SQL editor
- Simpan `SUPABASE_URL` dan `SUPABASE_ANON_KEY` di tempat aman (env file,
  jangan hardcode di source yang di-commit)
- Buat Storage bucket `product-photos` (public read cukup untuk kasus ini)
- Setup folder `extension/src/{background.js, popup/, sidepanel/, content/}`

**Acceptance:** schema ke-apply tanpa error, bucket ada, folder siap.

## Phase 1 — Extension skeleton
- Isi `manifest.json` (sudah ada di repo ini) sesuai kebutuhan icon/path final
- Buat `popup.html` + `popup.js` minimal (tampilkan teks statis dulu)
- Buat `sidepanel.html` + `sidepanel.js` minimal
- Buat `background.js` kosong dengan listener `chrome.action.onClicked` basic

**Acceptance:** extension bisa di-load unpacked, popup & side panel kebuka
tanpa error di console.

## Phase 2 — Koneksi Supabase dari extension
- Install `@supabase/supabase-js` (via bundler — MV3 butuh build step, sarankan
  Vite dengan `@crxjs/vite-plugin` atau esbuild manual)
- Buat client Supabase di satu module, dipakai bareng oleh popup/sidepanel/
  background
- Test: side panel bisa `select` dari tabel `groups` (kosong dulu, tidak apa)

**Acceptance:** tidak ada error koneksi, query kosong return `[]` bukan error.

## Phase 3 — Deteksi grup otomatis
- Content script `detect-groups.js` jalan di `facebook.com/groups/joins*`
- Parse DOM untuk ambil nama grup + link (`fb_group_id` dari URL)
- Kirim via `chrome.runtime.sendMessage` ke background, background upsert ke
  Supabase (`groups` table, `onConflict: fb_group_id`)
- Side panel tampilkan jumlah grup yang berhasil ke-sync

**Acceptance:** buka halaman "grup yang diikuti" di FB → grup baru muncul di
tabel Supabase dalam beberapa detik, tanpa duplikat saat halaman dibuka ulang.

**Catatan:** DOM Facebook sering berubah class name — jangan hardcode selector
CSS spesifik yang rapuh, cari struktur berbasis role/aria/text-pattern yang
lebih stabil, dan siapkan fallback kalau parsing gagal (tampilkan pesan
error jelas, jangan silent fail).

## Phase 4 — Manajemen produk & caption
- UI di side panel (atau tab options terpisah kalau ruang side panel sempit):
  CRUD produk, upload foto ke Supabase Storage, tulis 1-3 variasi caption
- Tampilkan daftar produk aktif

**Acceptance:** bisa tambah produk lengkap dengan foto & caption, muncul di
Supabase Storage + tabel terkait.

## Phase 5 — Posting sequencer (bagian paling sensitif — ikuti Non-Goals ketat)
- User pilih produk → sistem query `eligible_groups_view` → user pilih grup
  mana saja dari hasil itu (checkbox, bukan otomatis semua)
- User klik "Mulai" → buat row baru di `post_batches` + `post_batch_items`
  (status semua `pending`)
- Side panel: tampilkan grup pertama, tombol "Buka & Isi" → buka tab baru ke
  grup itu, content script `composer-assist.js` isi caption + attach foto ke
  composer Facebook (paste ke field, bukan submit)
- **User review manual, user klik Post sendiri di Facebook.**
- Content script deteksi perubahan DOM yang menandakan post berhasil (atau
  sediakan tombol manual "Tandai sudah post" sebagai fallback kalau deteksi
  otomatis tidak reliable)
- Side panel update status jadi `posted`, mulai countdown delay (random dari
  range yang di-set user), baru tombol "Grup berikutnya" aktif
- Kalau user tutup browser di tengah jalan → batch tetap tersimpan status
  `paused` di Supabase, bisa dilanjut kapan saja dari side panel

**Acceptance:** satu batch ke 3-5 grup uji coba berjalan dengan setiap langkah
butuh interaksi user (tidak ada aksi yang jalan sendiri tanpa user present).

## Phase 6 — Engagement logging manual
- Content script `engagement-reader.js` jalan saat user buka halaman post
  yang sudah tercatat di `post_batch_items` (cocokkan via `fb_post_url`)
- Baca like/comment count yang tampil di DOM saat itu
- Tampilkan tombol kecil "Simpan snapshot" → insert ke `engagement_snapshots`

**Acceptance:** buka post lama yang sudah ditrack → angka like/comment
kebaca otomatis dari halaman yang sedang dibuka, tersimpan setelah user klik
simpan (bukan otomatis tersimpan tanpa aksi).

## Phase 7 — Web dashboard (Next.js, repo/folder terpisah)
- `npx create-next-app@latest dashboard`
- Install `@supabase/supabase-js`, Tailwind
- Setup Supabase Auth (magic link tercepat untuk single-user)
- Halaman: matrix produk × grup, detail performa grup (dari
  `engagement_snapshots`), kelola katalog produk (opsional duplikasi dari
  side panel biar bisa dikerjakan dari device lain)

**Acceptance:** login via magic link, data yang sama dengan yang dilihat di
side panel muncul juga di dashboard.

## Phase 8 — Marketplace
- Content script `marketplace-assist.js` — pola serupa Phase 5 tapi untuk
  form listing Marketplace (field harga, lokasi, kategori beda dari post grup)
- Simpan ke `marketplace_listings`

## Phase 9 — Polish (opsional, setelah semua di atas stabil)
- Group tagging/kategori, performance score, smart suggestion urutan grup
- Rotasi caption otomatis antar grup dalam satu batch
- Reminder cooldown selesai (badge di icon extension)
- Export/import CSV
- Heatmap histori posting di dashboard
