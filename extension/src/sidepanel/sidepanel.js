import { supabase, isSupabaseConfigured } from "../lib/supabase.js";

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll("section").forEach((s) => s.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
  });
});

const statusEl = document.getElementById("status");

async function checkConnection() {
  if (!isSupabaseConfigured) {
    statusEl.textContent =
      "Supabase: belum dikonfigurasi. Salin extension/.env.example ke extension/.env dan isi VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.";
    return;
  }

  const { data, error } = await supabase.from("groups").select("id").limit(1);

  if (error) {
    statusEl.textContent = `Supabase: error koneksi — ${error.message}`;
    return;
  }

  statusEl.textContent = `Supabase: terkoneksi. (${data.length} grup contoh diterima)`;
}

async function loadGroupsTab() {
  const syncInfoEl = document.getElementById("groups-sync-info");
  const listEl = document.getElementById("groups-list");

  const { lastGroupSync } = await chrome.storage.local.get("lastGroupSync");
  if (lastGroupSync) {
    const when = new Date(lastGroupSync.at).toLocaleString("id-ID");
    syncInfoEl.textContent = `Terakhir sync: ${lastGroupSync.count} grup pada ${when}.`;
  }

  if (!isSupabaseConfigured) return;

  const { data, error } = await supabase
    .from("groups")
    .select("name, category, is_active")
    .eq("is_active", true)
    .order("name");

  if (error || !data) return;

  listEl.replaceChildren(
    ...data.map((g) => {
      const row = document.createElement("div");
      row.className = "stat";

      const nameEl = document.createElement("span");
      nameEl.textContent = g.name;

      const categoryEl = document.createElement("span");
      categoryEl.textContent = g.category ?? "-";

      row.append(nameEl, categoryEl);
      return row;
    })
  );
}

const MAX_CAPTIONS = 3;

document.getElementById("add-caption").addEventListener("click", () => {
  const container = document.getElementById("caption-inputs");
  const count = container.querySelectorAll(".caption-input").length;
  if (count >= MAX_CAPTIONS) return;

  const textarea = document.createElement("textarea");
  textarea.className = "caption-input";
  textarea.rows = 2;
  textarea.placeholder = `Caption versi ${count + 1}`;
  textarea.style.cssText = "width:100%; box-sizing:border-box; margin-top:6px;";
  container.appendChild(textarea);
});

async function uploadProductPhotos(productId, files) {
  const rows = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const path = `${productId}/${Date.now()}-${i}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("product-photos")
      .upload(path, file);

    if (uploadError) throw uploadError;

    rows.push({ product_id: productId, storage_path: path, sort_order: i });
  }

  if (rows.length > 0) {
    const { error } = await supabase.from("product_photos").insert(rows);
    if (error) throw error;
  }
}

async function insertCaptions(productId) {
  const captions = Array.from(document.querySelectorAll(".caption-input"))
    .map((el, i) => ({ label: `Versi ${i + 1}`, body: el.value.trim() }))
    .filter((c) => c.body.length > 0);

  if (captions.length === 0) return;

  const rows = captions.map((c) => ({ product_id: productId, label: c.label, body: c.body }));
  const { error } = await supabase.from("caption_templates").insert(rows);
  if (error) throw error;
}

document.getElementById("product-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const formStatus = document.getElementById("product-form-status");

  if (!isSupabaseConfigured) {
    formStatus.textContent = "Supabase belum dikonfigurasi.";
    return;
  }

  const name = document.getElementById("product-name").value.trim();
  const description = document.getElementById("product-description").value.trim();
  const files = document.getElementById("product-photos").files;

  if (!name) return;

  formStatus.textContent = "Menyimpan...";

  try {
    const { data: product, error: productError } = await supabase
      .from("products")
      .insert({ name, description: description || null })
      .select()
      .single();

    if (productError) throw productError;

    await uploadProductPhotos(product.id, files);
    await insertCaptions(product.id);

    formStatus.textContent = "Produk tersimpan.";
    e.target.reset();
    document.getElementById("caption-inputs").innerHTML =
      '<textarea class="caption-input" rows="2" placeholder="Caption versi 1" style="width:100%; box-sizing:border-box; margin-top:6px;"></textarea>';
    loadProductsTab();
  } catch (err) {
    formStatus.textContent = `Gagal menyimpan: ${err.message}`;
  }
});

async function loadProductsTab() {
  const listEl = document.getElementById("products-list");
  if (!isSupabaseConfigured) return;

  const { data, error } = await supabase
    .from("products")
    .select("id, name, description, product_photos(storage_path, sort_order), caption_templates(label, body)")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error || !data) return;

  listEl.replaceChildren(
    ...data.map((p) => {
      const card = document.createElement("div");
      card.style.cssText = "border:1px solid #eee; border-radius:8px; padding:10px; margin-bottom:8px;";

      const title = document.createElement("strong");
      title.textContent = p.name;
      card.appendChild(title);

      if (p.description) {
        const desc = document.createElement("p");
        desc.style.cssText = "margin:4px 0; color:#65676b;";
        desc.textContent = p.description;
        card.appendChild(desc);
      }

      const photos = (p.product_photos || []).sort((a, b) => a.sort_order - b.sort_order);
      if (photos.length > 0) {
        const photoRow = document.createElement("div");
        photoRow.style.cssText = "display:flex; gap:4px; margin:6px 0;";
        for (const photo of photos) {
          const { data: publicUrl } = supabase.storage
            .from("product-photos")
            .getPublicUrl(photo.storage_path);
          const img = document.createElement("img");
          img.src = publicUrl.publicUrl;
          img.style.cssText = "width:48px; height:48px; object-fit:cover; border-radius:4px;";
          photoRow.appendChild(img);
        }
        card.appendChild(photoRow);
      }

      const captionCount = document.createElement("p");
      captionCount.style.cssText = "margin:4px 0; font-size:12px; color:#65676b;";
      captionCount.textContent = `${(p.caption_templates || []).length} variasi caption`;
      card.appendChild(captionCount);

      return card;
    })
  );
}

checkConnection();
loadGroupsTab();
loadProductsTab();
