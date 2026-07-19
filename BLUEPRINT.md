# Blueprint — FB Group Manager

## 1. Tujuan

Bantu satu penjual online yang aktif di banyak grup jual-beli Facebook untuk:
- Tahu produk mana sudah diposting ke grup mana, dan kapan (biar nggak dobel-posting
  ke grup yang sama dalam rentang waktu pendek)
- Mempercepat proses posting berurutan ke banyak grup (isi sekali, jalan ke banyak
  grup) tanpa harus copy-paste manual satu-satu
- Punya dashboard buat lihat performa tiap grup (grup mana yang responsif) dan
  histori posting dari device manapun

## 2. Non-Goals / Batasan Desain (WAJIB dibaca sebelum implementasi)

Ini bukan keterbatasan teknis — ini keputusan desain yang sengaja dipilih supaya akun
Facebook milik user tidak berisiko kena restrict/banned, dan supaya tool ini tidak
berubah jadi spam bot ke komunitas orang lain. Setiap fase implementasi harus taat ke
poin-poin ini:

1. **Tidak ada auto-login.** Extension tidak pernah meminta, menyimpan, atau
   memasukkan email/password Facebook. Extension hanya beroperasi di dalam tab
   Facebook yang sudah di-login manual oleh user di Chrome profile-nya sendiri.
   Kalau user belum login, extension cukup menampilkan pesan "silakan login dulu",
   tidak mencoba login-kan otomatis.
2. **Tidak ada automasi headless/background.** Tidak ada server, cron job, atau
   headless browser terpisah yang menjalankan aksi di Facebook. Semua aksi
   (navigasi ke grup, isi form, klik post) terjadi di tab Chrome yang sedang
   aktif dan terlihat oleh user.
3. **Setiap batch posting harus di-trigger manual** oleh user, dan berjalan selama
   dia standby (browser terbuka). Kalau tab/browser ditutup di tengah jalan, batch
   otomatis pause dan bisa dilanjut manual nanti — bukan otomatis lanjut sendiri di
   background.
4. **Klik "Post" final tetap aksi manual user**, bukan diklik otomatis oleh
   extension. Extension hanya membantu: navigasi ke grup berikutnya, isi caption &
   pilih foto ke composer Facebook, lalu tunggu user review dan klik Post sendiri.
5. **Tidak ada polling latar belakang ke Facebook** untuk cek like/comment terus-
   menerus. Data engagement hanya diambil dari DOM saat user *sedang* membuka
   halaman post tersebut (aksi yang sudah dia lakukan sendiri), lalu disimpan
   sebagai snapshot manual.
6. **Delay antar-grup adalah jeda minimum**, bukan jaminan — karena tetap butuh
   waktu user review sebelum klik Post. Default sarankan delay acak 45–120 detik,
   user bisa ubah, tapi UI harus tetap menampilkan estimasi & mendorong jeda yang
   wajar, bukan "tercepat mungkin".

## 3. Arsitektur

- **Chrome Extension (Manifest V3)** — komponen utama yang menyentuh Facebook.
  - Content scripts: jalan di `facebook.com/groups/joins*` (deteksi grup),
    `facebook.com/groups/*` (bantu isi composer & baca status post), dan
    `facebook.com/marketplace/*` (fitur Marketplace).
  - Side panel (`chrome.sidePanel` API) — UI kerja utama: pilih produk, pilih
    grup target, jalankan posting sequencer, lihat progress. Side panel bisa
    di-resize manual oleh user (drag tepi panel) dan tetap terbuka lintas tab —
    ini alasan dipilih dibanding popup untuk kerja utama.
  - Popup (`action.default_popup`) — sengaja dibuat ringan saja: quick stats
    ("3 produk siap post hari ini", "12 grup available") + tombol "Buka Side
    Panel". **Catatan teknis penting:** popup Chrome extension secara native
    *tidak bisa* di-resize bebas oleh extension maupun user (beda dari side
    panel) — jadi jangan coba paksakan popup jadi dashboard penuh, itu bukan
    keterbatasan implementasi, itu keterbatasan platform Chrome.
  - Background service worker — orkestrasi ringan (badge count, messaging
    antar content script & side panel), bukan tempat automasi berjalan sendiri.

- **Supabase** — backend data.
  - Postgres untuk semua data terstruktur (lihat `schema.sql`)
  - Storage bucket untuk foto produk
  - Auth untuk dashboard web (bukan untuk Facebook — ini akun terpisah, bikin
    login sendiri untuk dashboard, misal email/password atau magic link)

- **Web Dashboard (Next.js, repo terpisah dari extension)** — UI leluasa untuk:
  - Matrix produk × grup × status
  - Analitik performa grup dari histori engagement yang sudah dicatat
  - Kelola katalog produk & template caption
  - Bisa diakses dari HP/laptop lain karena datanya di Supabase, bukan cuma
    lokal di satu Chrome profile

## 4. Data Model (ringkasan — detail lengkap di `supabase/schema.sql`)

- `groups` — daftar grup FB yang terdeteksi, dengan tag kategori & cooldown days
- `products` — katalog produk
- `product_photos` — foto per produk (path ke Supabase Storage)
- `caption_templates` — beberapa variasi caption per produk (bukan cuma satu teks
  identik terus — bikin posting terlihat lebih natural, bukan copy-paste sama
  persis di 20 grup)
- `post_batches` — satu "sesi posting" untuk satu produk, ke beberapa grup
- `post_batch_items` — status per grup dalam satu batch (pending/posted/skipped)
- `engagement_snapshots` — catatan like/comment yang diambil manual saat user
  membuka halaman post
- `marketplace_listings` — listing Marketplace terpisah dari grup (formatnya beda)

## 5. Fitur MVP (fase awal)

1. Deteksi & sinkron daftar grup otomatis saat user buka halaman grup miliknya
2. CRUD produk + upload foto + tulis 1-3 variasi caption
3. Pilih produk → sistem saring grup yang "eligible" (belum lewat cooldown,
   kategori cocok) → user pilih grup mana saja dari daftar itu
4. Posting sequencer: side panel memandu satu-satu — buka grup, isi composer,
   user review & klik Post, extension deteksi post berhasil (perubahan DOM),
   auto-lanjut ke grup berikutnya setelah delay yang di-set
5. Dashboard matrix status per produk per grup

## 6. Fitur tambahan (hasil riset — worth dipertimbangkan setelah MVP jalan)

- **Group tagging & niche** — kategori grup (misal: grup lokal Solo, grup
  nasional, grup niche tertentu) biar filter grup per produk lebih relevan,
  bukan cuma soal cooldown waktu
- **Group performance score** — dihitung dari histori `engagement_snapshots`
  yang sudah dicatat manual, buat highlight grup mana yang historically paling
  responsif untuk kategori produk tertentu
- **Smart suggestion** — saat pilih produk, sistem urutkan grup dari yang
  paling relevan + performa terbaik + cooldown sudah lewat, bukan cuma daftar
  polos
- **Rotasi caption otomatis** — sequencer otomatis gilir 2-3 variasi caption
  antar grup dari `caption_templates`, biar teks nggak identik 100% di semua
  post (lebih natural buat pembaca grup, bukan cuma soal "hindari deteksi")
- **Reminder cooldown selesai** — badge notifikasi di icon extension kalau ada
  grup yang cooldown-nya sudah habis dan siap ditawari produk lagi
- **Kalender/heatmap histori posting** — visualisasi kapan hari-hari paling
  aktif posting, buat evaluasi ritme sendiri
- **Export/import CSV** — backup data grup & produk, atau migrasi
- **Catatan per grup** — field notes bebas (misal: "admin strict soal watermark",
  "grup ini butuh approval manual", dll) biar nggak lupa aturan tiap grup
- **Marketplace fields** — kategori, harga, lokasi spesifik yang beda dari
  format post grup biasa
- **Auth dashboard via Supabase Auth** — magic link email paling simpel buat
  single-user, bisa upgrade ke multi-user kalau nanti perlu

## 7. Stack

- Extension: Manifest V3, vanilla JS atau React ringan (Vite) untuk side panel/popup
- Backend: Supabase (Postgres + Storage + Auth)
- Dashboard: Next.js + `@supabase/supabase-js` + Tailwind
- State sync: extension nulis langsung ke Supabase via REST/JS client (tidak perlu
  backend custom terpisah)

## 8. Keputusan terbuka (didiskusikan lagi kalau perlu, bukan diputuskan sepihak oleh Claude Code)

- Delay default: disarankan mulai dari rentang acak 45–120 detik, user bisa ubah
  di settings — jangan default ke "1 menit pas" biar polanya nggak terlalu rapi/robotic
- Berapa lama cooldown default per grup sebelum boleh ditawari produk yang sama
  lagi (disarankan mulai dari 7 hari, bisa di-override per grup)
