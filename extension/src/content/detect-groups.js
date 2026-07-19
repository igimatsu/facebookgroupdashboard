// Phase 3: deteksi grup dari facebook.com/groups/joins*
//
// Catatan (STEP_BY_STEP.md Phase 3): DOM Facebook sering berubah class name,
// jadi sengaja TIDAK hardcode selector CSS spesifik. Deteksi berbasis pola
// href (/groups/<id>) yang jauh lebih stabil daripada class name yang
// di-obfuscate. Kalau parsing gagal total, tampilkan error jelas — jangan
// silent fail.

function extractGroupsFromDom() {
  const anchors = Array.from(document.querySelectorAll('a[href*="/groups/"]'));
  const seen = new Map();

  for (const a of anchors) {
    const href = a.getAttribute("href") || "";
    const match = href.match(/\/groups\/([0-9]+)/);
    if (!match) continue;

    const fbGroupId = match[1];
    if (seen.has(fbGroupId)) continue;

    const name = (a.textContent || "").trim();
    if (!name) continue; // link tanpa teks biasanya thumbnail/icon, bukan judul grup

    seen.set(fbGroupId, {
      fb_group_id: fbGroupId,
      name,
      url: `https://www.facebook.com/groups/${fbGroupId}`,
    });
  }

  return Array.from(seen.values());
}

function reportStatus(text) {
  console.log(`[FB Group Manager] ${text}`);
}

async function runDetection() {
  const groups = extractGroupsFromDom();

  if (groups.length === 0) {
    reportStatus(
      "Tidak ada grup terdeteksi di halaman ini. Pastikan kamu sudah scroll " +
        "halaman 'Grup yang diikuti' supaya kontennya ter-render, atau struktur " +
        "DOM Facebook mungkin berubah — parsing perlu disesuaikan."
    );
    return;
  }

  chrome.runtime.sendMessage(
    { type: "SYNC_GROUPS", groups },
    (response) => {
      if (chrome.runtime.lastError) {
        reportStatus(`Gagal kirim ke background: ${chrome.runtime.lastError.message}`);
        return;
      }
      if (response?.ok) {
        reportStatus(`${response.synced} grup ter-sinkron ke Supabase.`);
      } else {
        reportStatus(`Sync gagal: ${response?.error ?? "unknown error"}`);
      }
    }
  );
}

// Halaman "grup yang diikuti" pakai infinite scroll & render async, jadi
// tunggu render awal selesai lalu jalankan sekali. User bisa scroll dan
// re-trigger manual lewat side panel kalau mau sync ulang (belum di-wire,
// untuk sekarang jalan sekali saat document_idle).
setTimeout(runDetection, 1500);
