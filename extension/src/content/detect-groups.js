// Phase 3: deteksi grup dari facebook.com/groups/joins*
//
// Catatan (STEP_BY_STEP.md Phase 3): DOM Facebook sering berubah class name,
// jadi sengaja TIDAK hardcode selector CSS spesifik. Deteksi berbasis pola
// href (/groups/<id-atau-slug>) yang jauh lebih stabil daripada class name
// yang di-obfuscate.
//
// Dua penyesuaian atas permintaan user:
// 1. Filter kata kunci — cuma grup jual-beli yang disinkron, bukan semua
//    grup yang diikuti (banyak grup non-jualan yang tidak relevan buat tool ini).
// 2. Proses bertahap mengikuti MutationObserver — grup baru diproses saat
//    memang baru muncul di DOM (misal saat user scroll & FB lazy-load
//    konten), bukan satu pass instan menyisir seluruh halaman.

const KEYWORD_FILTER = [
  "jual beli",
  "jual-beli",
  "jualbeli",
  "jb ",
  "fjb",
  "barkas",
  "lapak",
  "marketplace",
  "olshop",
  "online shop",
];

// Slug reserved yang muncul sebagai /groups/<slug> tapi bukan grup sungguhan.
const RESERVED_SLUGS = new Set([
  "joins",
  "discover",
  "feed",
  "create",
  "browse",
  "notifications",
  "insights",
  "requests",
  "your_groups",
  "profile",
]);

function matchesKeyword(name) {
  const lower = name.toLowerCase();
  return KEYWORD_FILTER.some((kw) => lower.includes(kw));
}

function parseAnchor(a) {
  const href = a.getAttribute("href") || "";
  const match = href.match(/\/groups\/([^/?#]+)/);
  if (!match) return null;

  const slugOrId = match[1];
  if (RESERVED_SLUGS.has(slugOrId)) return null;

  const name = (a.textContent || "").trim();
  if (!name) return null;
  if (!matchesKeyword(name)) return null;

  return {
    fb_group_id: slugOrId,
    name,
    url: `https://www.facebook.com/groups/${slugOrId}`,
  };
}

const seen = new Set();
let pending = [];
let flushTimer = null;

function reportStatus(text) {
  console.log(`[FB Group Manager] ${text}`);
}

function flushPending() {
  flushTimer = null;
  if (pending.length === 0) return;

  const batch = pending;
  pending = [];

  chrome.runtime.sendMessage({ type: "SYNC_GROUPS", groups: batch }, (response) => {
    if (chrome.runtime.lastError) {
      reportStatus(`Gagal kirim ke background: ${chrome.runtime.lastError.message}`);
      return;
    }
    if (response?.ok) {
      reportStatus(`+${batch.length} grup jual-beli ter-sinkron (total sesi ini: ${seen.size}).`);
    } else {
      reportStatus(`Sync gagal: ${response?.error ?? "unknown error"}`);
    }
  });
}

function scheduleFlush() {
  if (flushTimer) return;
  // Delay kecil supaya batch beberapa anchor yang muncul berdekatan saat
  // scroll jadi satu request, bukan satu request per anchor.
  flushTimer = setTimeout(flushPending, 800);
}

function processAnchors(anchors) {
  for (const a of anchors) {
    const group = parseAnchor(a);
    if (!group) continue;
    if (seen.has(group.fb_group_id)) continue;

    seen.add(group.fb_group_id);
    pending.push(group);
  }
  if (pending.length > 0) scheduleFlush();
}

// Pass awal untuk konten yang sudah ter-render saat script jalan.
function initialScan() {
  processAnchors(document.querySelectorAll('a[href*="/groups/"]'));
  if (seen.size === 0) {
    reportStatus(
      "Belum ada grup jual-beli terdeteksi di viewport saat ini. Scroll " +
        "halaman 'Grup yang diikuti' pelan-pelan untuk memuat lebih banyak " +
        "grup — deteksi berjalan otomatis mengikuti scroll kamu."
    );
  }
}

// Amati penambahan DOM (lazy-load saat scroll) dan proses grup baru saja,
// bukan menyisir ulang seluruh halaman tiap kali ada perubahan kecil.
const observer = new MutationObserver((mutations) => {
  const newAnchors = [];
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.matches?.('a[href*="/groups/"]')) newAnchors.push(node);
      newAnchors.push(...node.querySelectorAll?.('a[href*="/groups/"]') ?? []);
    }
  }
  if (newAnchors.length > 0) processAnchors(newAnchors);
});

setTimeout(() => {
  initialScan();
  observer.observe(document.body, { childList: true, subtree: true });
}, 1500);

window.addEventListener("beforeunload", () => observer.disconnect());
