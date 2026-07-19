-- Extension memakai anon key langsung (tidak login via Supabase Auth),
-- jadi tabel yang RLS-nya sudah di-enable di 0001_init.sql butuh policy
-- eksplisit untuk role anon, atau semua insert/select akan ditolak.
--
-- Ini tool internal single-user (lihat BLUEPRINT.md §2 & schema.sql
-- komentar "single-user: bisa dilonggarkan") — jadi policy di bawah
-- sengaja permisif untuk role anon. Kalau nanti Phase 7 (dashboard)
-- pakai Supabase Auth sungguhan, policy ini sebaiknya diperketat jadi
-- auth.role() = 'authenticated' saja.

drop policy if exists "anon full access" on groups;
create policy "anon full access" on groups
  for all using (true) with check (true);

drop policy if exists "anon full access" on products;
create policy "anon full access" on products
  for all using (true) with check (true);

drop policy if exists "anon full access" on post_batches;
create policy "anon full access" on post_batches
  for all using (true) with check (true);

drop policy if exists "anon full access" on post_batch_items;
create policy "anon full access" on post_batch_items
  for all using (true) with check (true);

-- Tabel anak (product_photos, caption_templates, engagement_snapshots,
-- marketplace_listings) belum di-enable RLS-nya di 0001_init.sql, jadi
-- sudah otomatis bisa diakses anon tanpa policy tambahan.
