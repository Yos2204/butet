// Not angka (number notation) hymnals: Buku Ende, Buku Nyanyian HKBP and Kidung Jemaat (YB 2026-11-01).
// Each song is one picture cut from the book (notasi/<book>/<n>.png), so the notes, dots, lines and lyrics look exactly
// as printed. notasi/<book>/index.json lists the songs: [number, title, image height, [slide cut rows]].
// Doc view scrolls the whole song; Slides view shows one or two music lines (or verses) at a time, full screen,
// for the projector. Open to everyone, also to people who are not signed in.
// Loaded before app.js; app.js calls window.SADA_NOTASI({...}) with its helpers once they exist.
window.SADA_NOTASI = ({ R, A, L3, shell, tile, skel, empty, ic, LS, norm, esc, isGuest }) => {
const NT_BOOKS = {
  BE: { name: "Buku Ende", sub: ["Not angka · Bahasa Batak", "Not angka · Hata Batak", "Number notation · Batak"], icon: "🎶" },
  BN: { name: "Buku Nyanyian HKBP", sub: ["Not angka · Bahasa Indonesia", "Not angka · Hata Indonesia", "Number notation · Indonesian"], icon: "🎼" },
  KJ: { name: "Kidung Jemaat", sub: ["Not angka · Bahasa Indonesia", "Not angka · Hata Indonesia", "Number notation · Indonesian"], icon: "🎵" },
};
const NT = { idx: {}, show: null };
async function ntIndex(book) {
  if (NT.idx[book]) return NT.idx[book];
  const r = await fetch(`notasi/${book.toLowerCase()}/index.json?v=1`); if (!r.ok) throw new Error("index " + r.status);
  const j = await r.json(); j.songs = j.songs.map(([n, t, h, cuts]) => ({ n, t, h, cuts })); NT.idx[book] = j; return j;
}
const ntImg = (book, n) => `notasi/${book.toLowerCase()}/${encodeURIComponent(n)}.png?v=1`;
const ntNum = (n) => { const m = String(n).match(/^(\d+)([a-z]?)$/); return m ? +m[1] + (m[2] ? (m[2].charCodeAt(0) - 96) / 10 : 0) : 1e9; };

try { document.head.insertAdjacentHTML("beforeend", `<style>
  .nt-books .doc-tile b { font-size: 15px; }
  .nt-list .li { min-height: 52px; }
  .nt-no { min-width: 48px; font-weight: 800; color: var(--brand); font-variant-numeric: tabular-nums; }
  .nt-tools { display: flex; gap: 8px; align-items: center; margin: 6px 0 12px; flex-wrap: wrap; }
  .nt-tools .seg { flex: 1 1 100%; margin: 0; }
  .nt-tools .btn { flex: 1; }
  #ntFind { width: 100%; box-sizing: border-box; font-size: 16px; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--line, #e5e7eb); background: var(--surface, #fff); color: inherit; }
  .nt-doc { overflow-x: auto; -webkit-overflow-scrolling: touch; background: #fff; border-radius: 12px; border: 1px solid var(--line, #e5e7eb); }
  .nt-doc img { display: block; width: calc(100% * var(--z, 1)); max-width: none; height: auto; }
  .nt-doc.inv img, .nt-show.inv .nt-slide img { filter: invert(1); }
  .nt-doc.inv { background: #000; }
  .nt-nav { display: flex; gap: 8px; margin-top: 12px; } .nt-nav .btn { flex: 1; }
  .nt-show { position: fixed; inset: 0; z-index: 9999; background: #fff; display: flex; flex-direction: column; user-select: none; -webkit-user-select: none; touch-action: none; overscroll-behavior: contain; }
  .nt-show.inv { background: #000; color: #fff; }
  .nt-stage { flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 1.5vh 1.5vw; }
  .nt-slide { position: relative; overflow: hidden; width: min(97vw, calc(var(--ar) * 86vh)); aspect-ratio: var(--ar); }
  .nt-slide img { position: absolute; left: 0; width: 100%; height: auto; max-width: none; }
  .nt-bar { display: flex; align-items: center; gap: 6px; padding: 6px 10px calc(6px + env(safe-area-inset-bottom)); font-size: 14px; opacity: .85; }
  .nt-bar b { flex: 1; text-align: center; font-weight: 600; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .nt-bar button { background: none; border: 1px solid currentColor; color: inherit; border-radius: 10px; padding: 6px 12px; font: inherit; cursor: pointer; }
  .nt-show.idle .nt-bar { opacity: 0; transition: opacity .6s; }
  .nt-x { position: absolute; top: calc(10px + env(safe-area-inset-top)); right: calc(10px + env(safe-area-inset-right)); z-index: 3; width: 48px; height: 48px; border-radius: 50%; border: 0; background: rgba(0,0,0,.55); color: #fff; font-size: 22px; line-height: 48px; padding: 0; cursor: pointer; }
  .nt-show.inv .nt-x { background: rgba(255,255,255,.25); }
  .nt-tap { position: absolute; top: 0; bottom: 48px; width: 35%; z-index: 1; } .nt-tap.l { left: 0; } .nt-tap.r { right: 0; }
</style>`); } catch (e) {}

// #/notasi                → the three books
// #/notasi/BE             → song list with search
// #/notasi/BE/23          → one song (Doc view; the Slides button opens the projector view)
R.notasi = (arg) => {
  const parts = location.hash.replace(/^#\/?/, "").split("?")[0].split("/").slice(1).map(decodeURIComponent);
  const book = (parts[0] || "").toUpperCase(), n = parts[1];
  if (!NT_BOOKS[book]) return ntHome();
  if (n) return ntSong(book, n);
  return ntBook(book);
};
function ntHome() {
  return shell("#/library", `<h2 class="page-h">🎼 ${esc(L3("Not Angka", "Not Angka", "Number notation"))}</h2>
    <p class="lead">${esc(L3("Buku lagu dengan not angka, persis seperti di buku. Buka tiap lagu sebagai dokumen atau sebagai slide untuk proyektor.", "Buku ende dohot not angka, songon na di buku. Bungka ganup ende songon dokumen manang slide.", "Hymnals with number notation, exactly as printed. Open each song as a document or as slides for the projector."))}</p>
    <div class="doc-grid nt-books">${Object.entries(NT_BOOKS).map(([k, b]) => tile("#/notasi/" + k, b.icon, b.name, L3(...b.sub))).join("")}</div>`,
    { back: isGuest() ? "#/home" : "#/library", title: L3("Not Angka", "Not Angka", "Number notation") });
}
function ntBook(book) {
  const b = NT_BOOKS[book];
  setTimeout(async () => { try { await ntIndex(book); ntListPaint(book); } catch (e) { const el = document.getElementById("ntList"); if (el) el.innerHTML = empty(L3("Tidak bisa memuat daftar lagu. Periksa internet.", "Ndang tarbungka.", "Couldn't load the song list. Check the internet."), "book"); } }, 0);
  return shell("#/library", `<input type="search" id="ntFind" data-book="${book}" placeholder="${esc(L3("Nomor atau judul lagu…", "Nomor manang goar ni ende…", "Song number or title…"))}" inputmode="search" autocomplete="off" value="${esc(LS.get("ntq:" + book, "") || "")}">
    <div id="ntList" style="margin-top:10px">${skel(6)}</div>`, { back: "#/notasi", title: b.name, sub: L3(...b.sub) });
}
function ntListPaint(book) {
  const box = document.getElementById("ntList"), ix = NT.idx[book]; if (!box || !ix) return;
  const raw = ((document.getElementById("ntFind") || {}).value || "").trim(); LS.set("ntq:" + book, raw);
  const q = norm(raw), qn = raw.toLowerCase().replace(/\s+/g, "");
  let list = ix.songs;
  if (q) list = /^\d+[a-z]?$/.test(qn) ? list.filter((s) => s.n === qn || s.n.replace(/[a-z]$/, "") === qn || s.n.startsWith(qn)) : list.filter((s) => norm(s.n + " " + s.t).includes(q));
  const more = list.length > 200 && !q; if (more) list = list.slice(0, 200);
  box.innerHTML = list.length ? `<div class="card nt-list">${list.map((s) => `<a class="li" href="#/notasi/${book}/${encodeURIComponent(s.n)}"><span class="nt-no">${esc(s.n)}</span><span class="grow"><b>${esc(s.t)}</b></span>${ic("chev", "chev")}</a>`).join("")}</div>
    ${more ? `<p class="small muted center">${esc(L3(`Menampilkan 200 dari ${ix.songs.length} lagu. Ketik nomor atau judul untuk mencari.`, `200 sian ${ix.songs.length} ende.`, `Showing 200 of ${ix.songs.length} songs. Type a number or title to find one.`))}</p>` : `<p class="small muted center">${esc(L3(`${ix.songs.length} lagu`, `${ix.songs.length} ende`, `${ix.songs.length} songs`))}</p>`}`
    : empty(L3("Tidak ditemukan.", "Ndang dapot.", "Nothing found."), "search");
}
document.addEventListener("input", (e) => { if (e.target && e.target.id === "ntFind") ntListPaint(e.target.dataset.book); });
function ntSong(book, n) {
  const b = NT_BOOKS[book]; const z = LS.get("ntZoom", 1), inv = !!LS.get("ntInv", false);
  setTimeout(async () => {
    const box = document.getElementById("ntBox"); if (!box) return;
    let ix; try { ix = await ntIndex(book); } catch (e) { box.innerHTML = empty(L3("Tidak bisa memuat lagu. Periksa internet.", "Ndang tarbungka.", "Couldn't load the song. Check the internet."), "book"); return; }
    let i = ix.songs.findIndex((s) => s.n === n); if (i < 0) i = ix.songs.findIndex((s) => s.n === n + "a"); const s = ix.songs[i];
    if (!s) { box.innerHTML = empty(L3(`${b.name} ${n} tidak ada.`, `${b.name} ${n} ndang adong.`, `${b.name} ${n} isn't in this book.`), "book"); return; }
    const prev = ix.songs[i - 1], next = ix.songs[i + 1];
    const hd = document.querySelector(".brand b"); if (hd) hd.textContent = `${b.name} ${s.n}`;
    box.innerHTML = `<h2 class="page-h" style="margin-bottom:4px">${esc(s.n)}. ${esc(s.t)}</h2>
      <div class="nt-tools">
        <div class="seg" role="tablist" style="--gc:var(--brand)"><a role="tab" aria-selected="true">📄 ${esc(L3("Dokumen", "Dokumen", "Doc"))}</a><a role="tab" aria-selected="false" href="#" data-act="ntShow" data-book="${book}" data-n="${esc(s.n)}">🖥️ ${esc(L3("Slide", "Slide", "Slides"))}</a></div>
        <button class="btn sm" data-act="ntZoom" data-d="-0.25" aria-label="${esc(L3("Perkecil", "Perkecil", "Smaller"))}">A−</button>
        <button class="btn sm" data-act="ntZoom" data-d="0.25" aria-label="${esc(L3("Perbesar", "Perbesar", "Bigger"))}">A+</button>
        <button class="btn sm" data-act="ntInv" aria-label="${esc(L3("Warna gelap", "Warna gelap", "Dark colours"))}">🌓</button>
      </div>
      <div class="nt-doc${inv ? " inv" : ""}" style="--z:${z}"><img src="${ntImg(book, s.n)}" alt="${esc(b.name + " " + s.n + ". " + s.t)}" width="${ix.w}" height="${s.h}" loading="eager" decoding="async"></div>
      <div class="nt-nav">${prev ? `<a class="btn" href="#/notasi/${book}/${encodeURIComponent(prev.n)}">‹ ${esc(prev.n)}</a>` : ""}${next ? `<a class="btn" href="#/notasi/${book}/${encodeURIComponent(next.n)}">${esc(next.n)} ›</a>` : ""}</div>
      <p class="small muted" style="margin-top:12px">${esc(L3("Dari buku cetak", "Sian buku", "From the printed book"))}: ${esc(b.name)}. ${esc(L3("Tekan Slide untuk proyektor; geser atau tekan ← → untuk pindah.", "Slide tu proyektor.", "Tap Slides for the projector; swipe or press ← → to move."))}</p>`;
  }, 0);
  return shell("#/library", `<div id="ntBox">${skel(3)}</div>`, { back: "#/notasi/" + book, title: `${b.name} ${n}`, sub: L3(...b.sub) });
}
A.ntZoom = (d) => { const v = Math.max(1, Math.min(3, (LS.get("ntZoom", 1) || 1) + +d.d)); LS.set("ntZoom", v); const el = document.querySelector(".nt-doc"); if (el) el.style.setProperty("--z", v); };
A.ntInv = () => { const v = !LS.get("ntInv", false); LS.set("ntInv", v); document.querySelectorAll(".nt-doc, .nt-show").forEach((el) => el.classList.toggle("inv", v)); };

// ---------- Slides (projector) ----------
A.ntShow = async (d) => {
  const ix = await ntIndex(d.book); const s = ix.songs.find((x) => x.n === d.n); if (!s) return;
  const cuts = [0, ...(s.cuts || []), s.h];
  NT.show = { book: d.book, s, w: ix.w, cuts, i: Math.max(0, Math.min(cuts.length - 2, +(d.i || 0))) };
  let el = document.getElementById("ntShow"); if (el) el.remove();
  el = document.createElement("div"); el.id = "ntShow"; el.className = "nt-show" + (LS.get("ntInvShow", false) ? " inv" : "");
  el.setAttribute("role", "dialog"); el.setAttribute("aria-label", `${NT_BOOKS[d.book].name} ${s.n}`);
  el.innerHTML = `<div class="nt-stage"><div class="nt-slide"><img alt="" src="${ntImg(d.book, s.n)}"></div></div>
    <button class="nt-tap l" data-act="ntGo" data-d="-1" aria-label="${esc(L3("Sebelumnya", "Na parjolo", "Previous"))}" style="background:none;border:0"></button>
    <button class="nt-tap r" data-act="ntGo" data-d="1" aria-label="${esc(L3("Berikutnya", "Na mangihut", "Next"))}" style="background:none;border:0"></button>
    <button class="nt-x" data-act="ntClose" aria-label="${esc(L3("Tutup", "Tutup", "Close"))}">✕</button>
    <div class="nt-bar"><button data-act="ntGo" data-d="-1">‹</button><b></b><button data-act="ntGo" data-d="1">›</button><button data-act="ntInvShow" aria-label="${esc(L3("Warna gelap", "Warna gelap", "Dark colours"))}">🌓</button><button data-act="ntFull" aria-label="${esc(L3("Layar penuh", "Layar penuh", "Full screen"))}">⛶</button></div>`;
  document.body.appendChild(el); ntPaint(); ntIdle();
  try { if (el.requestFullscreen && !document.fullscreenElement && matchMedia("(min-width: 700px)").matches) await el.requestFullscreen(); } catch (e) {}
};
function ntPaint() {
  const sh = NT.show, el = document.getElementById("ntShow"); if (!sh || !el) return;
  const y0 = sh.cuts[sh.i], y1 = sh.cuts[sh.i + 1], hh = y1 - y0;
  const box = el.querySelector(".nt-slide"); box.style.setProperty("--ar", (sh.w / hh).toFixed(4));
  const img = box.querySelector("img"); img.style.top = `${(-y0 / hh * 100).toFixed(4)}%`;
  el.querySelector(".nt-bar b").textContent = `${NT_BOOKS[sh.book].name} ${sh.s.n}. ${sh.s.t} · ${sh.i + 1}/${sh.cuts.length - 1}`;
}
A.ntGo = (d) => { const sh = NT.show; if (!sh) return; sh.i = Math.max(0, Math.min(sh.cuts.length - 2, sh.i + +d.d)); ntPaint(); ntIdle(); };
A.ntClose = () => { const el = document.getElementById("ntShow"); if (el) el.remove(); NT.show = null; try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {} };
A.ntInvShow = () => { const v = !LS.get("ntInvShow", false); LS.set("ntInvShow", v); const el = document.getElementById("ntShow"); if (el) el.classList.toggle("inv", v); };
A.ntFull = async () => { const el = document.getElementById("ntShow"); try { if (document.fullscreenElement) await document.exitFullscreen(); else if (el && el.requestFullscreen) await el.requestFullscreen(); } catch (e) {} };
function ntIdle() { const el = document.getElementById("ntShow"); if (!el) return; el.classList.remove("idle"); clearTimeout(ntIdle.t); ntIdle.t = setTimeout(() => el.classList.add("idle"), 3000); }
document.addEventListener("keydown", (e) => {
  if (!NT.show) return;
  if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) { e.preventDefault(); A.ntGo({ d: 1 }); }
  else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) { e.preventDefault(); A.ntGo({ d: -1 }); }
  else if (e.key === "Home") { NT.show.i = 0; ntPaint(); } else if (e.key === "End") { NT.show.i = NT.show.cuts.length - 2; ntPaint(); }
  else if (e.key === "Escape" && !document.fullscreenElement) A.ntClose();
});
document.addEventListener("mousemove", () => { if (NT.show) ntIdle(); });
(() => { let x0 = null, y0 = null;
  document.addEventListener("touchstart", (e) => { if (!NT.show || !e.target.closest("#ntShow")) return; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; ntIdle(); }, { passive: true });
  document.addEventListener("touchend", (e) => { if (!NT.show || x0 == null) return; const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) A.ntGo({ d: dx < 0 ? 1 : -1 }); }, { passive: true });
})();
addEventListener("hashchange", () => { if (NT.show) A.ntClose(); });
};
