-- FB Group Manager — Supabase schema
-- Jalankan di Supabase SQL editor. Single-user oriented, tapi disiapkan
-- dengan user_id supaya gampang di-upgrade ke multi-user kalau perlu nanti.

create extension if not exists "uuid-ossp";

-- ============================================================
-- GROUPS
-- ============================================================
create table if not exists groups (
  id uuid primary key default uuid_generate_v4(),
  fb_group_id text not null,           -- ID grup dari URL facebook.com/groups/<id>
  name text not null,
  url text not null,
  category text,                       -- tag niche/kategori bebas
  member_count int,
  cooldown_days int not null default 7,-- minimum jarak hari sebelum boleh ditawari produk sama lagi
  is_active boolean not null default true,
  notes text,                          -- catatan bebas (aturan grup, admin, dll)
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (fb_group_id)
);

-- ============================================================
-- PRODUCTS
-- ============================================================
create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists product_photos (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id) on delete cascade,
  storage_path text not null,          -- path di Supabase Storage bucket
  sort_order int not null default 0
);

create table if not exists caption_templates (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id) on delete cascade,
  label text,                          -- misal "versi santai", "versi formal"
  body text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- POSTING BATCHES (satu sesi posting untuk satu produk ke beberapa grup)
-- ============================================================
create table if not exists post_batches (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id),
  status text not null default 'draft'
    check (status in ('draft', 'in_progress', 'paused', 'completed')),
  delay_seconds_min int not null default 45,
  delay_seconds_max int not null default 120,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists post_batch_items (
  id uuid primary key default uuid_generate_v4(),
  batch_id uuid not null references post_batches(id) on delete cascade,
  group_id uuid not null references groups(id),
  caption_template_id uuid references caption_templates(id),
  status text not null default 'pending'
    check (status in ('pending', 'posted', 'skipped', 'failed')),
  posted_at timestamptz,
  fb_post_url text,                    -- diisi manual/dideteksi kalau memungkinkan
  unique (batch_id, group_id)
);

-- ============================================================
-- ENGAGEMENT SNAPSHOTS (dicatat manual saat user membuka halaman post)
-- ============================================================
create table if not exists engagement_snapshots (
  id uuid primary key default uuid_generate_v4(),
  post_batch_item_id uuid not null references post_batch_items(id) on delete cascade,
  checked_at timestamptz not null default now(),
  likes_count int,
  comments_count int,
  notes text
);

-- ============================================================
-- MARKETPLACE (format beda dari post grup biasa)
-- ============================================================
create table if not exists marketplace_listings (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id),
  fb_listing_url text,
  price numeric,
  location text,
  category text,
  status text not null default 'draft'
    check (status in ('draft', 'posted', 'sold', 'removed')),
  posted_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Helper view: grup mana yang "eligible" untuk produk tertentu hari ini
-- (belum lewat cooldown berdasarkan post_batch_items terakhir yang statusnya 'posted')
-- ============================================================
create or replace view eligible_groups_view as
select
  g.id as group_id,
  g.name,
  g.category,
  g.cooldown_days,
  max(pbi.posted_at) as last_posted_at,
  case
    when max(pbi.posted_at) is null then true
    else (now() - max(pbi.posted_at)) > (g.cooldown_days || ' days')::interval
  end as is_eligible_now
from groups g
left join post_batch_items pbi
  on pbi.group_id = g.id and pbi.status = 'posted'
where g.is_active = true
group by g.id;

-- ============================================================
-- Row Level Security — aktifkan kalau dashboard akan diakses via Supabase Auth
-- (single-user: bisa dilonggarkan, tapi disiapkan strukturnya)
-- ============================================================
alter table groups enable row level security;
alter table products enable row level security;
alter table post_batches enable row level security;
alter table post_batch_items enable row level security;

-- Contoh policy dasar (sesuaikan setelah Auth diimplementasikan):
-- create policy "allow all for authenticated" on groups
--   for all using (auth.role() = 'authenticated');
