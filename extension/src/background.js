// Background service worker — orkestrasi ringan (badge, messaging).
// TIDAK menjalankan automasi background apapun (lihat BLUEPRINT.md Non-Goals).
// Satu-satunya tulisan ke Supabase di sini adalah upsert grup yang dipicu
// oleh content script SAAT user membuka halaman grupnya sendiri — bukan
// polling atau jadwal berkala.

import { supabase, isSupabaseConfigured } from "./lib/supabase.js";

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.windowId) return;
  await chrome.sidePanel.open({ windowId: tab.windowId });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
});

async function syncGroups(groups) {
  if (!isSupabaseConfigured) {
    return { ok: false, error: "Supabase belum dikonfigurasi (isi extension/.env)." };
  }

  const { error, count } = await supabase
    .from("groups")
    .upsert(groups, { onConflict: "fb_group_id", ignoreDuplicates: false, count: "exact" });

  if (error) {
    return { ok: false, error: error.message };
  }

  await chrome.storage.local.set({
    lastGroupSync: { at: new Date().toISOString(), count: count ?? groups.length },
  });

  return { ok: true, synced: count ?? groups.length };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "PING") {
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "SYNC_GROUPS") {
    syncGroups(message.groups).then(sendResponse);
    return true; // async response
  }

  return false;
});
