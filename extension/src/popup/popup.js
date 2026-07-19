// Popup sengaja tetap ringan (quick glance saja) — Chrome tidak mengizinkan
// popup di-resize bebas, jadi kerja utama tetap di side panel.

import { supabase, isSupabaseConfigured } from "../lib/supabase.js";

document.getElementById("open-sidepanel").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.windowId != null) {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  }
  window.close();
});

async function loadStats() {
  if (!isSupabaseConfigured) return;

  const [{ count: productCount }, { count: groupCount }] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("groups").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);

  document.getElementById("stat-products").textContent = productCount ?? "0";
  document.getElementById("stat-groups").textContent = groupCount ?? "0";
}

loadStats();
