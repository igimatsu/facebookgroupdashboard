# FB Group Manager — Project Handoff

Ini adalah blueprint + scaffold untuk tool internal (bukan produk yang dijual ulang)
buat bantu satu pengguna mengelola posting produk ke banyak grup jual-beli Facebook
miliknya sendiri, tanpa posting ulang ke grup yang sama berulang-ulang, plus dashboard
buat mantau histori & performa grup.

**Baca urutan ini:**
1. `BLUEPRINT.md` — arsitektur, data model, fitur lengkap, dan batasan desain (wajib dibaca dulu)
2. `supabase/schema.sql` — skema database siap jalan di Supabase SQL editor
3. `extension/manifest.json` — skeleton Manifest V3 buat Chrome extension
4. `STEP_BY_STEP.md` — urutan implementasi per fase, ini yang dipakai buat kerja di Claude Code

## TL;DR Arsitektur

```
┌─────────────────────────┐        ┌──────────────────┐        ┌─────────────────────┐
│ Chrome Extension (MV3)   │ ──────▶│    Supabase       │◀──────▶│  Web Dashboard        │
│ - content scripts di     │ writes │ - Postgres DB     │ reads  │  (Next.js, terpisah)  │
│   facebook.com           │        │ - Storage (foto)  │        │  - bisa diakses dari   │
│ - side panel (kerja utama)│       │ - Auth             │        │    device lain         │
│ - popup (quick glance)   │        └──────────────────┘        └─────────────────────┘
└─────────────────────────┘
        ▲
        │ jalan DI DALAM sesi Chrome yang sudah login manual —
        │ extension TIDAK PERNAH pegang email/password Facebook
        ▼
   facebook.com (tab aktif milik user)
```

## Batasan desain yang WAJIB dipatuhi (baca BLUEPRINT.md bagian "Non-Goals")

Tool ini sengaja **tidak** dibuat auto-login dan **tidak** dibuat jalan otomatis
tanpa pengawasan (headless / background scheduler). Ini keputusan sadar, bukan
keterbatasan teknis yang lupa dikerjakan — jangan ditambahkan di iterasi berikutnya
tanpa diskusi ulang sama user.

## Cara pakai dengan Claude Code

Jalankan Claude Code di root folder ini, lalu minta dia mulai dari `STEP_BY_STEP.md`
Phase 0. Setiap phase punya acceptance criteria — selesaikan satu phase, test, baru
lanjut ke phase berikutnya. Jangan loncat ke fitur posting sequencer (Phase 5) sebelum
Phase 1-4 (skeleton, group detection, product management) beres, karena schema dan
state management-nya saling bergantung.
