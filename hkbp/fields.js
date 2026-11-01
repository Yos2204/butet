// Sada text fields (YB 2026-11-01): every text field gets an ✕ that clears it, suggestions while typing
// (member names, group names, roster jobs, and what was typed before in the same field), and typed text
// does not come back after the app is closed. Free, offline, and it only uses data this member may already see.
// Loaded before app.js so the clean-up below runs before the first page is drawn; app.js then calls
// window.SADA_FIELDS({...}) with its helpers, which are only used later, inside event handlers.
(() => {
  let H = {}; window.SADA_FIELDS = (h) => { H = h || {}; };
  const PFX = "hkbp.";
  const lsGet = (k, d) => { try { const v = localStorage.getItem(PFX + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(PFX + k, JSON.stringify(v)); } catch (e) {} };
  const L = (id, bt, en) => (H.L3 ? H.L3(id, bt, en) : en);
  const nm = (s) => (H.norm ? H.norm(s) : String(s || "").toLowerCase().trim());
  const ex = (s) => (H.esc ? H.esc(s) : String(s == null ? "" : s).replace(/[&<>"']/g, (c) => "&#" + c.charCodeAt(0) + ";"));

  // ---------- 1. typed text does not survive closing the app ----------
  // Form drafts, the home search and the money amount are kept on the phone; drop them on every fresh start.
  // Warta drafts stay: they are a bulletin being written and are saved to the server.
  function dropTyped() {
    try {
      Object.keys(localStorage).forEach((k) => { if (k.startsWith(PFX + "draft:") && !k.startsWith(PFX + "draft:warta:")) localStorage.removeItem(k); });
      ["lastQ", "fxAmt"].forEach((k) => localStorage.removeItem(PFX + k));
    } catch (e) {}
  }
  dropTyped();
  const clearEl = (el) => { if (!el || !el.value) return; el.value = ""; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };
  const clearSearches = () => document.querySelectorAll('input[type="search"]').forEach(clearEl);
  // iPhone and Android often keep the app alive in the background instead of closing it. Back after 20 s or more:
  // searches start empty (as the song search does). Back after 30 minutes or more: treat it as a fresh start.
  function freshStart() {
    try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) {} // its auto-save runs now, not after the clean-up
    hide(); clearSearches();
    try { const sh = document.getElementById("sheet"); if (sh && sh.classList.contains("open") && H.closeSheet) H.closeSheet(); } catch (e) {}
    // Quietly, so the form auto-save does not store the empty boxes; the page is drawn again just below.
    document.querySelectorAll("#view input, #view textarea").forEach((el) => { if (textField(el) && el.type !== "search" && !el.closest("#warta-form")) el.value = ""; });
    dropTyped(); setTimeout(dropTyped, 400);
    try { if (dataOk() && !/^#\/login/.test(location.hash) && H.render) H.render(); } catch (e) {}
  }
  let away = 0;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { away = Date.now(); hide(); return; }
    if (!away) return; const gone = Date.now() - away; away = 0;
    if (gone >= 30 * 60e3) freshStart(); else if (gone >= 20e3) clearSearches();
  });
  addEventListener("pageshow", (e) => { if (e.persisted) freshStart(); });

  // ---------- which fields ----------
  const TEXTY = /^(|text|search|url|email|tel|password|number)$/;
  const OWN_CLEAR = "#ntFind, #searchIn"; // these already have their own ✕
  function textField(el) {
    if (!el || el.readOnly || el.disabled) return false;
    if (el.tagName === "TEXTAREA") return true;
    return el.tagName === "INPUT" && TEXTY.test((el.getAttribute("type") || "").toLowerCase());
  }
  const fieldName = (el) => el.name || el.dataset.k || el.id || "";
  const formName = (el) => (el.form && el.form.dataset.form) || (el.closest("[data-form]") || {}).dataset?.form || (el.closest("[id]") || {}).id || "";
  function labelText(el) { const l = el.closest("label"); return l ? (l.firstChild && l.firstChild.nodeType === 3 ? l.firstChild.textContent : l.textContent).trim() : el.getAttribute("aria-label") || ""; }
  // What kind of suggestions a field gets: person, group, job, hist (earlier entries), or none.
  function kindOf(el) {
    if (!el || el.tagName !== "INPUT" || !/^(|text)$/.test((el.getAttribute("type") || "").toLowerCase())) return null;
    if (el.hasAttribute("list") || el.dataset.tp || el.dataset.nosuggest != null || /numeric|decimal|tel|email|url/.test(el.inputMode || "")) return null;
    if (/^(name|username|tel|current-password|new-password)$/.test(el.getAttribute("autocomplete") || "")) return null; // signing in or registering: the phone's own autofill
    const n = fieldName(el), f = formName(el);
    if (/phone|pw|pass|amt|^num$|^yy$|^att\d|supabase|vapid|key|link|url|^q$|date|^t[abr]\d|^fx/i.test(n)) return null;
    if (/^name_(id|en|bt)$/.test(n)) return "group";
    if (n === "job") return "job";
    if (/^(who|speaker|deceased|holder|preacher)$/.test(n) || /^n_/.test(n) || (n === "name" && !/^(group|cat|section)$/.test(f))) return "person";
    if (/^(nama|name|goar)\s*:?$/i.test(labelText(el))) return "person";
    return "hist";
  }

  // ---------- earlier entries, kept on this phone only ----------
  const histKey = (el) => formName(el) + "|" + fieldName(el);
  function remember(el) {
    const v = String(el.value || "").trim(); if (v.length < 2 || v.length > 100 || /\n/.test(v)) return;
    const all = lsGet("sug", {}) || {}; const k = histKey(el); const h = all[k] || {};
    h[v] = [((h[v] || [0])[0] || 0) + 1, Date.now()];
    const keep = Object.entries(h).sort((a, b) => b[1][1] - a[1][1]).slice(0, 40); all[k] = Object.fromEntries(keep); lsSet("sug", all);
  }
  document.addEventListener("submit", (e) => { const f = e.target; if (!f || !f.elements) return; [...f.elements].forEach((el) => { if (kindOf(el)) remember(el); }); }, true);
  document.addEventListener("change", (e) => { const el = e.target; if (el && !el.form && kindOf(el)) remember(el); }, true);

  // ---------- where suggestions come from ----------
  const dataOk = () => (H.D ? H.D() : null);
  let cache = { at: null };
  function people() {
    const D = dataOk(); if (!D) return [];
    if (cache.p && cache.at === D) return cache.p;
    const out = new Map();
    (D.people || []).forEach((p) => { if (!p || !p.name) return; const o = { label: p.name, sub: p.alias || "", p, n: 50 }; out.set(nm(p.name), o);
      String(p.alias || "").split(/[,;/]/).map(nm).filter((a) => a.length >= 3).forEach((a) => { if (!out.has(a)) out.set(a, o); }); }); // "Kak Rina" in a roster counts for Rina
    // Names already written in rosters (guests, visiting preachers…), counted by how often they appear.
    (D.rosters || []).forEach((r) => (r.table_json || []).forEach((tb) => (tb.rows || []).slice(1).forEach((row) => row.slice(1).forEach((c) => String(c || "").split(/\s*(?:[,/&;+\n]|\bdan\b|\band\b)\s*/i).forEach((x) => {
      x = x.trim(); if (x.length < 3 || x.length > 40 || /\d/.test(x)) return; const k = nm(x); if (!k) return;
      const o = out.get(k); if (o) o.n++; else out.set(k, { label: x, sub: "", n: 1 });
    })))));
    cache = { ...cache, at: D, p: [...new Set(out.values())] }; return cache.p;
  }
  function groups(el) {
    const D = dataOk(); if (!D) return [];
    const k = fieldName(el); return (D.groups || []).map((g) => g && (g[k] || g.name_en || g.name_id)).filter(Boolean).map((label) => ({ label, sub: L("Sudah ada", "Nunga adong", "Already exists"), n: 1 }));
  }
  function jobs(el) {
    const D = dataOk(); if (!D) return [];
    const gid = (el.form && el.form.dataset.g) || ""; const c = new Map(); const add = (j, w) => { j = String(j || "").trim(); if (!j || j.length > 40) return; const k = nm(j); const o = c.get(k); if (o) o.n += w; else c.set(k, { label: j, sub: "", n: w }); };
    try { if (gid && H.rosterJobs) H.rosterJobs(gid).forEach((j) => add(j, 20)); } catch (e) {}
    (D.rosters || []).forEach((r) => (r.table_json || []).forEach((tb) => (((tb.rows || [])[0]) || []).slice(1).forEach((j) => add(j, r.group_id === gid ? 5 : 1))));
    try { Object.values(H.ROSTER_JOBS || {}).flat().forEach((j) => add(j, 1)); } catch (e) {}
    return [...c.values()];
  }
  function hist(el) {
    const h = (lsGet("sug", {}) || {})[histKey(el)] || {};
    const out = Object.entries(h).map(([label, [n, at]]) => ({ label, sub: "", n: n + at / 1e13 }));
    const D = dataOk(); if (fieldName(el) === "place" && D) (D.events || []).forEach((e) => { if (e && e.place && !h[e.place]) out.push({ label: e.place, sub: "", n: 0.5 }); });
    return out;
  }
  const source = (kind, el) => (kind === "person" ? people() : kind === "group" ? groups(el) : kind === "job" ? jobs(el).concat(hist(el)) : hist(el));

  // ---------- matching ----------
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 9; let p = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) { const c = [i]; for (let j = 1; j <= b.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; }
    return p[b.length];
  }
  function score(q, label) {
    const c = nm(label); if (!q) return 1; if (!c || c === q) return 0;
    if (c.startsWith(q)) return 100; const ws = c.split(" ");
    if (ws.some((w) => w.startsWith(q))) return 80; if (c.includes(q)) return 60;
    if (q.length >= 3) { const lim = q.length >= 6 ? 2 : 1; if (ws.some((w) => lev(q, w.slice(0, q.length)) <= lim || lev(q, w) <= lim)) return 20; } // "did you mean"
    return 0;
  }
  // In a roster "Name" box several people can be written ("Rina / Budi"); suggest for the last one.
  const SEP = /^(.*(?:[,/&;+]|\s(?:dan|and)\s)\s*)([^,/&;+]*)$/i;
  function query(el, kind) { const v = el.value || ""; if (kind === "person") { const m = v.match(SEP); if (m) return { head: m[1], q: m[2] }; } return { head: "", q: v }; }

  // ---------- the ✕ and the suggestion list (one of each, floating over the focused field) ----------
  const css = document.createElement("style");
  css.textContent = `
  #fx-clr { position: fixed; z-index: 58; width: 28px; height: 28px; border-radius: 50%; display: none; align-items: center; justify-content: center; font-size: 14px; line-height: 1; cursor: pointer;
    background: var(--line, #e5e7eb); color: var(--ink, #111); user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; }
  #fx-clr.on { display: flex; }
  .fx-pad { padding-right: 38px !important; }
  #fx-sug { position: fixed; z-index: 57; display: none; background: var(--surface, #fff); color: var(--ink, #111); border: 1px solid var(--line, #e5e7eb); border-radius: 12px;
    box-shadow: 0 10px 30px rgba(5,10,25,.18); overflow: hidden; max-width: calc(100vw - 16px); }
  #fx-sug.on { display: block; }
  #fx-sug .fx-h { font-size: 12px; padding: 6px 12px 2px; opacity: .7; }
  #fx-sug .fx-o { display: flex; align-items: center; gap: 10px; padding: 9px 12px; min-height: 44px; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  #fx-sug .fx-o + .fx-o { border-top: 1px solid var(--line, #eef0f3); }
  #fx-sug .fx-o.hi, #fx-sug .fx-o:hover { background: var(--brand-soft, #eef3ff); }
  #fx-sug .fx-o .avatar { width: 28px; height: 28px; font-size: 11px; flex: none; }
  #fx-sug .fx-o b { font-weight: 600; } #fx-sug .fx-o small { display: block; opacity: .65; font-size: 12px; }
  #fx-sug .fx-t { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`;
  document.head.appendChild(css);
  const clr = document.createElement("div"); clr.id = "fx-clr"; clr.setAttribute("role", "button"); clr.textContent = "✕";
  const sug = document.createElement("div"); sug.id = "fx-sug"; sug.setAttribute("role", "listbox");
  const mount = () => { document.body.appendChild(clr); document.body.appendChild(sug); };
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);

  let cur = null, curKind = null, items = [], hi = -1;
  // Taps on the ✕ and the list must not take the focus (and the keyboard) away from the field.
  function onTap(node, fn) {
    let sx = 0, sy = 0, moved = false;
    node.addEventListener("touchstart", (e) => { e.preventDefault(); sx = e.touches[0].clientX; sy = e.touches[0].clientY; moved = false; }, { passive: false });
    node.addEventListener("touchmove", (e) => { if (Math.hypot(e.touches[0].clientX - sx, e.touches[0].clientY - sy) > 10) moved = true; }, { passive: true });
    node.addEventListener("touchend", (e) => { e.preventDefault(); if (!moved) fn(e.target); }, { passive: false });
    node.addEventListener("mousedown", (e) => { e.preventDefault(); fn(e.target); });
  }
  onTap(clr, () => { if (!cur) return; const el = cur; clearEl(el); el.focus(); place(); suggest(); });
  onTap(sug, (t) => { const o = t.closest && t.closest(".fx-o"); if (o) pick(+o.dataset.i); });

  function pick(i) {
    const it = items[i]; if (!it || !cur) return; const el = cur; const { head } = query(el, curKind);
    el.value = head + it.label; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
    hideSug(); el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {} place();
  }
  const hideSug = () => { sug.classList.remove("on"); items = []; hi = -1; };
  function hide() { clr.classList.remove("on"); hideSug(); if (cur) cur.classList.remove("fx-pad"); }

  function suggest() {
    if (!cur || !curKind) return hideSug();
    const { q } = query(cur, curKind); const nq = nm(q);
    if (!nq && curKind !== "hist" && curKind !== "job") return hideSug();
    const all = source(curKind, cur); const seen = new Set();
    let list = all.map((x) => ({ ...x, s: score(nq, x.label) })).filter((x) => x.s > 0 && !seen.has(nm(x.label)) && seen.add(nm(x.label)))
      .sort((a, b) => b.s - a.s || b.n - a.n || a.label.localeCompare(b.label)).slice(0, 6);
    if (!nq) list = list.filter((x) => x.n >= 1).slice(0, 5);
    items = list; hi = -1;
    if (!list.length) return hideSug();
    const fuzzy = nq && list.every((x) => x.s === 20);
    const head = fuzzy ? `<div class="fx-h">${ex(L("Maksud Anda…?", "Ra on do…?", "Did you mean…?"))}</div>` : curKind === "group" ? `<div class="fx-h">${ex(L("Sudah ada:", "Nunga adong:", "Already there:"))}</div>` : "";
    sug.innerHTML = head + list.map((x, i) => {
      const av = curKind === "person" ? (H.avatarOf ? H.avatarOf(x.p || { name: x.label }) : "") : "";
      return `<div class="fx-o" role="option" data-i="${i}">${av}<span class="fx-t"><b>${ex(x.label)}</b>${x.sub && curKind !== "group" ? `<small>${ex(x.sub)}</small>` : ""}</span></div>`;
    }).join("");
    sug.classList.add("on"); place();
  }

  // Keep both pieces over the field while the page or the pop-up scrolls and the keyboard opens.
  let raf = 0;
  const place = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(doPlace); };
  function doPlace() {
    if (!cur || !cur.isConnected || document.activeElement !== cur) return hide();
    const r = cur.getBoundingClientRect(); const vv = window.visualViewport; const vTop = vv ? vv.offsetTop : 0; const vBot = vv ? vv.offsetTop + vv.height : innerHeight;
    if (!r.width || r.bottom < vTop || r.top > vBot) { clr.classList.remove("on"); hideSug(); return; }
    const showClr = !!cur.value && r.width >= 70 && !cur.matches(OWN_CLEAR);
    cur.classList.toggle("fx-pad", showClr);
    if (showClr) {
      const ta = cur.tagName === "TEXTAREA"; clr.style.left = (r.right - 34) + "px"; clr.style.top = (ta ? r.top + 6 : r.top + r.height / 2 - 14) + "px"; clr.classList.add("on");
      clr.setAttribute("aria-label", L("Hapus isi", "Apus", "Clear"));
    } else clr.classList.remove("on");
    if (sug.classList.contains("on")) {
      const w = Math.min(Math.max(r.width, 220), innerWidth - 16); const left = Math.max(8, Math.min(r.left, innerWidth - w - 8));
      sug.style.width = w + "px"; sug.style.left = left + "px";
      const h = sug.offsetHeight; const below = vBot - r.bottom - 8;
      sug.style.top = (below >= h || below >= r.top - vTop - 8 ? r.bottom + 4 : r.top - h - 4) + "px";
    }
  }

  document.addEventListener("focusin", (e) => {
    const el = e.target; if (!textField(el)) return;
    if (cur && cur !== el) cur.classList.remove("fx-pad");
    cur = el; curKind = kindOf(el); if (curKind) { try { if (el.getAttribute("autocomplete") !== "off") el.setAttribute("autocomplete", "off"); } catch (er) {} }
    hideSug(); place(); if (curKind && el.value === "" && (curKind === "hist" || curKind === "job")) suggest();
  });
  document.addEventListener("focusout", (e) => { if (e.target === cur) setTimeout(() => { if (document.activeElement !== cur) { hide(); cur = null; } }, 120); });
  document.addEventListener("input", (e) => { if (e.target === cur) { suggest(); place(); } });
  document.addEventListener("keydown", (e) => {
    if (e.target !== cur || !sug.classList.contains("on")) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); const n = items.length; hi = e.key === "ArrowDown" ? (hi + 1) % n : (hi - 1 + n) % n; sug.querySelectorAll(".fx-o").forEach((o, i) => o.classList.toggle("hi", i === hi)); }
    else if (e.key === "Enter" && hi >= 0) { e.preventDefault(); pick(hi); }
    else if (e.key === "Escape") { e.preventDefault(); hideSug(); }
  });
  addEventListener("scroll", place, { capture: true, passive: true }); addEventListener("resize", place);
  if (window.visualViewport) { visualViewport.addEventListener("resize", place); visualViewport.addEventListener("scroll", place); }
  addEventListener("hashchange", () => hide());
  window.SadaFields = { kindOf, score, people, freshStart };
})();
