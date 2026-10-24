// HKBP Singapore: one app for the categorial groups (sermonic), service sections with monthly rosters,
// daily bread, birthdays, elders' updates and church events. Data layer in store.js, file readers in parse.js.
(() => {
"use strict";
const S = window.HKBP_STORE, P = window.HKBP_PARSE, I18N = window.HKBP_I18N;
const LS = S.LS;
let api = S.pick();
let D = null;               // everything the signed-in member may see
let lang = LS.get("lang", "id");
const $ = (s, el = document) => el.querySelector(s);
const view = () => $("#view");
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const t = (k, ...a) => { const v = (I18N[lang] && I18N[lang][k] != null ? I18N[lang][k] : I18N.en[k]); return typeof v === "function" ? v(...a) : v == null ? k : v; };
const TZ = "Asia/Singapore";
const LOC = { id: "id-ID", bt: "id-ID", en: "en-SG" };
const today = () => S.sgToday();
const addDays = (iso, n) => { const d = new Date(iso + "T12:00:00+08:00"); d.setDate(d.getDate() + n); return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d); };
const fmt = (iso, o) => { if (!iso) return ""; const d = iso.length <= 10 ? new Date(iso + "T12:00:00+08:00") : new Date(iso); return new Intl.DateTimeFormat(LOC[lang], { timeZone: TZ, ...o }).format(d); };
const fmtDay = (iso) => fmt(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const fmtShort = (iso) => fmt(iso, { day: "numeric", month: "short" });
const fmtTime = (iso) => fmt(iso, { hour: "2-digit", minute: "2-digit", hour12: false });
const monthKey = (iso) => iso.slice(0, 7);
const monthName = (ym) => fmt(ym + "-15", { month: "long", year: "numeric" });
const shiftMonth = (ym, n) => { let [y, m] = ym.split("-").map(Number); m += n; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; } return `${y}-${String(m).padStart(2, "0")}`; };
const sgParts = (iso) => { const d = new Date(iso); const f = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d); const g = (k) => f.find((p) => p.type === k).value; return { date: `${g("year")}-${g("month")}-${g("day")}`, time: `${g("hour") === "24" ? "00" : g("hour")}:${g("minute")}` }; };
const fmtPhone = (p) => (p && p.length === 8 ? `+65 ${p.slice(0, 4)} ${p.slice(4)}` : p || "");
const validPhone = (p) => /^[3689]\d{7}$/.test(S.phone8(p));
const appUrl = () => location.href.split("#")[0].split("?")[0];
const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

// ---------- icons (24px line icons) ----------
const IC = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  groups: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M15 14.5c3 0 6 1.8 6 5.5"/>',
  roster: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4M7 13h4M7 17h7"/>',
  calendar: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4"/><circle cx="12" cy="15" r="1.6"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  child: '<circle cx="12" cy="6" r="3"/><path d="M8 21v-5l-2-3 6-3 6 3-2 3v5"/>',
  spark: '<path d="M12 2l2.2 6.3L21 10l-6.8 1.7L12 18l-2.2-6.3L3 10l6.8-1.7z"/><path d="M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z"/>',
  heart: '<path d="M12 20s-7-4.4-9-9c-1.3-3 .7-6.5 4-6.5 2 0 3.5 1.2 5 3 1.5-1.8 3-3 5-3 3.3 0 5.3 3.5 4 6.5-2 4.6-9 9-9 9z"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M12 8v8M8.5 11h7"/>',
  anchor: '<circle cx="12" cy="5" r="2.2"/><path d="M12 7v14M8 10h8"/><path d="M4 13c0 4.4 3.6 8 8 8s8-3.6 8-8"/>',
  screen: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M10 8.5v5l4-2.5z"/>',
  people: '<circle cx="12" cy="7" r="3"/><circle cx="5" cy="10" r="2"/><circle cx="19" cy="10" r="2"/><path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6M1.5 18c0-2 1.6-3.6 3.5-3.6M22.5 18c0-2-1.6-3.6-3.5-3.6"/>',
  book: '<path d="M12 6c-2-1.5-5-2-8-1.5v14c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-14c-3-.5-6 0-8 1.5z"/><path d="M12 6v14"/>',
  drum: '<ellipse cx="12" cy="8" rx="8" ry="3"/><path d="M4 8v8c0 1.7 3.6 3 8 3s8-1.3 8-3V8"/><path d="M15 2l-5 7M20 4l-6 5"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v4M8 22h8"/>',
  note: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  bell: '<path d="M6 16V11a6 6 0 0112 0v5l2 2H4z"/><path d="M10 21h4"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
  wa: '<path d="M4 20l1.3-4A8 8 0 1112 20a8 8 0 01-4-1z"/><path d="M9 9c0 3 3 6 6 6l1-1.5-2-1-1 .8c-1-.4-2-1.4-2.4-2.4l.8-1-1-2z"/>',
  cake: '<path d="M4 21h16v-8H4zM4 16c2 1.5 4 1.5 6 0s4-1.5 6 0 3 1 4 .5"/><path d="M12 13V9M12 6.5c-.8 0-1.3-.6-1.3-1.3S12 3 12 3s1.3 1.5 1.3 2.2-.5 1.3-1.3 1.3z"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 21h16"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  file: '<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  logout: '<path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
  ai: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2"/><circle cx="12" cy="12" r="3"/>',
  bread: '<path d="M5 11c-1.7 0-3-1.3-3-3s2-4 10-4 10 2.3 10 4-1.3 3-3 3v9H5z"/><path d="M9 11v5M15 11v5"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0119 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M14 9l2 2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  cross: '<path d="M12 3v18M7 8h10"/>',
};
const ic = (n, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n] || IC.star}</svg>`;

// ---------- roles ----------
const me = () => D.me;
const isAdmin = () => !!(D && D.me.is_admin);
const isElder = () => isAdmin() || "parhalado" in (D.me.groups || {});
const roleIn = (gid) => (D.me.groups || {})[gid] || null;
const canEdit = (gid) => isAdmin() || roleIn(gid) === "chair";
const canSee = (g) => g.kind === "service" || isElder() || !!roleIn(g.id);
const G = (id) => D.groups.find((g) => g.id === id);
const gname = (g) => (g ? g["name_" + lang] || g.name_en || g.id : t("wholeChurch"));
const firstName = (n) => String(n || "").replace(/^(Pdt|St|Sintua|Bapak|Ibu|Kak|Bang|Ev|Dr)\.?\s+/i, "").split(/\s+/)[0];

// ---------- toast / sheets ----------
function toast(msg, bad) { const el = $("#toast"); el.textContent = msg; el.className = "toast show" + (bad ? " bad" : ""); clearTimeout(toast.h); toast.h = setTimeout(() => (el.className = "toast"), 2600); }
function errMsg(e) { const c = (e && e.code) || (e && e.message) || "server"; return t("err_" + c) !== "err_" + c ? t("err_" + c) : t("err_server"); }
function sheet(title, body, onMount) {
  const el = $("#sheet");
  el.innerHTML = `<div class="sheet-card" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="sheet-head"><h3>${esc(title)}</h3><button class="icon-btn" data-act="closeSheet" aria-label="${esc(t("close"))}">${ic("x")}</button></div><div class="sheet-body">${body}</div></div>`;
  el.hidden = false; document.body.classList.add("noscroll");
  requestAnimationFrame(() => el.classList.add("open"));
  if (onMount) onMount(el);
}
function closeSheet() { const el = $("#sheet"); el.classList.remove("open"); document.body.classList.remove("noscroll"); setTimeout(() => { el.hidden = true; el.innerHTML = ""; }, 180); }
async function busy(btn, fn) { if (btn) { btn.disabled = true; btn.dataset.label = btn.innerHTML; btn.innerHTML = `<span class="spin"></span>${esc(t("working"))}`; } try { return await fn(); } finally { if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = btn.dataset.label; } } }

// ---------- sharing / calendar ----------
const wa = (text, phone) => `https://wa.me/${phone ? "65" + S.phone8(phone) : ""}?text=${encodeURIComponent(text)}`;
function breadText(b) { return `📖 *${t("breadTitle")} · HKBP Singapore*\n${fmtDay(b.day)}\n\n*${b.title || ""}*\n${b.verse || ""}\n\n${b.body || ""}\n\n${appUrl()}#/bread/${b.day}`; }
function ics(events) {
  const z = (d) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const c = (s) => String(s || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//HKBP Singapore//App//EN", "CALSCALE:GREGORIAN"];
  events.forEach((e) => {
    const end = e.ends_at || new Date(new Date(e.starts_at).getTime() + 2 * 3600e3).toISOString();
    lines.push("BEGIN:VEVENT", `UID:${e.id}@hkbp-singapore`, `DTSTAMP:${z(Date.now())}`, `DTSTART:${z(e.starts_at)}`, `DTEND:${z(end)}`, `SUMMARY:${c(e.title)}`);
    if (e.place) lines.push(`LOCATION:${c(e.place)}`);
    lines.push(`DESCRIPTION:${c([gname(e.group_id ? G(e.group_id) : null), e.notes].filter(Boolean).join("\n"))}`);
    if (e.remind_min > 0) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${c(e.title)}`, `TRIGGER:-PT${e.remind_min}M`, "END:VALARM");
    lines.push("END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
function download(name, data, type) { const a = document.createElement("a"); a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
const gcal = (e) => { const z = (d) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); const end = e.ends_at || new Date(new Date(e.starts_at).getTime() + 2 * 3600e3).toISOString(); return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(e.title)}&dates=${z(e.starts_at)}/${z(end)}&location=${encodeURIComponent(e.place || "")}&details=${encodeURIComponent(e.notes || "")}`; };

// ---------- rosters: find my duties ----------
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
function myNames(person = D.me) {
  const out = new Set(); const full = norm(person.name); if (full) out.add(full);
  const toks = full.split(" ").filter((x) => !/^(pdt|st|sintua|bapak|ibu|kak|bang|ev|dr|br)$/.test(x));
  if (toks.length >= 2) out.add(toks.slice(0, 2).join(" "));
  // First name alone only when nobody else in the church shares it.
  if (toks[0] && toks[0].length >= 3 && D.people.filter((p) => norm(p.name).split(" ").includes(toks[0])).length <= 1) out.add(toks[0]);
  String(person.alias || "").split(/[,;\/]/).map(norm).filter((x) => x.length >= 3).forEach((a) => out.add(a));
  return [...out];
}
const hit = (cell, names) => { const c = " " + norm(cell) + " "; return names.some((n) => c.includes(" " + n + " ")); };
const DATE_RE = /\b(\d{1,2})[\s\/.-]+(\d{1,2}|jan\w*|feb\w*|mar\w*|apr\w*|mei|may|jun\w*|jul\w*|agu\w*|aug\w*|sep\w*|okt\w*|oct\w*|nov\w*|des\w*|dec\w*)(?:[\s\/.-]+(\d{2,4}))?/i;
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12 };
function rowDate(row, ym) {
  for (const c of row) {
    const iso = String(c).match(/\b(20\d{2})-(\d{2})-(\d{2})\b/); if (iso) return iso[0];
    const m = String(c).match(DATE_RE); if (!m) continue;
    const day = +m[1]; let mon = /^\d+$/.test(m[2]) ? +m[2] : MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (!mon || day < 1 || day > 31 || mon > 12) continue;
    let y = m[3] ? +m[3] : +ym.slice(0, 4); if (y < 100) y += 2000;
    return `${y}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
}
function duties(person = D.me) {
  const names = myNames(person); const out = [];
  if (!names.length) return out;
  D.rosters.forEach((r) => {
    (r.table_json || []).forEach((tb) => {
      // The header is the first row with two or more filled cells (a title line above the table is skipped).
      const hi = Math.max(0, tb.rows.findIndex((r) => r.filter(Boolean).length >= 2));
      const header = tb.rows[hi] || [];
      tb.rows.forEach((row, i) => {
        if (i <= hi && tb.rows.length > 1) return;
        const cols = row.map((c, j) => (hit(c, names) ? j : -1)).filter((j) => j >= 0);
        if (!cols.length) return;
        const roles = cols.map((j) => header[j] && header[j] !== row[j] ? header[j] : "").filter(Boolean);
        out.push({ roster: r, group: G(r.group_id), date: rowDate(row, r.month), roles, row: row.filter(Boolean).join(" · ") });
      });
    });
  });
  return out.sort((a, b) => (a.date || a.roster.month + "-99").localeCompare(b.date || b.roster.month + "-99"));
}

// ---------- birthdays ----------
function birthdaysBetween(fromIso, days) {
  const out = [];
  for (let i = 0; i <= days; i++) { const d = addDays(fromIso, i); const md = d.slice(5); D.people.filter((p) => p.bday === md).forEach((p) => out.push({ p, day: d, inDays: i })); }
  return out;
}

// ---------- notifications ----------
async function swReg() { if (!("serviceWorker" in navigator)) return null; try { return await navigator.serviceWorker.ready; } catch { return null; } }
function b64urlToU8(s) { const p = "=".repeat((4 - (s.length % 4)) % 4); const b = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(b, (c) => c.charCodeAt(0)); }
const vapid = () => (api.cfg && api.cfg.vapidPublicKey) || "";
async function enableNotifications(btn) {
  if (!("Notification" in window)) { toast(/iP(hone|ad)/.test(navigator.userAgent) && !standalone() ? t("iosInstallFirst") : t("noNotify"), true); return; }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") { toast(t("notifyDenied"), true); return; }
  const reg = await swReg();
  if (api.mode === "remote" && vapid() && reg && reg.pushManager) {
    try {
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlToU8(vapid()) });
      await api.pushSave(sub.toJSON()); LS.set("pushOn", true);
    } catch (e) { console.warn(e); toast(t("pushFailed"), true); }
  }
  LS.set("notifyOn", true);
  if (reg) reg.showNotification("HKBP Singapore", { body: t("notifyOk"), icon: "icon-192.png", badge: "icon-192.png", tag: "hkbp-test" });
  render();
}
// Without the server job (demo mode, or before push is set up) the app shows today's reminders when it is opened.
async function localReminders() {
  if (!D || !LS.get("notifyOn") || !("Notification" in window) || Notification.permission !== "granted") return;
  if (api.mode === "remote" && LS.get("pushOn") && vapid()) return; // the server sends these
  const reg = await swReg(); if (!reg) return;
  const shown = LS.get("shown", {}); const day = today(); const once = (k) => { if (shown[k]) return false; shown[k] = day; return true; };
  const b = D.bread.find((x) => x.day === day);
  if (b && once("bread:" + day)) reg.showNotification(`📖 ${t("breadTitle")}: ${b.title || ""}`, { body: `${b.verse || ""}\n${(b.body || "").slice(0, 140)}`, icon: "icon-192.png", tag: "bread", data: { url: "#/bread" } });
  if (me().dob && me().dob.slice(5) === day.slice(5) && once("bday:" + day)) reg.showNotification(t("hbdTitle", firstName(me().name)), { body: t("hbdBody"), icon: "icon-192.png", tag: "bday" });
  const now = Date.now();
  D.events.forEach((e) => { const st = new Date(e.starts_at).getTime(); if (st > now && st - e.remind_min * 60e3 <= now && once("ev:" + e.id)) reg.showNotification(`🗓 ${e.title}`, { body: `${fmtDay(sgParts(e.starts_at).date)} · ${fmtTime(e.starts_at)}${e.place ? " · " + e.place : ""}`, icon: "icon-192.png", tag: "ev-" + e.id, data: { url: "#/calendar" } }); });
  Object.keys(shown).forEach((k) => { if (shown[k] < addDays(day, -40)) delete shown[k]; });
  LS.set("shown", shown);
}

// ---------- Claude (daily bread writer) ----------
async function claudeBread(day, langCode, recent) {
  const key = LS.get("claudeKey", "");
  if (!key) throw new Error(t("needClaudeKey"));
  const L = { id: "Bahasa Indonesia", bt: "Bahasa Batak Toba", en: "English" }[langCode];
  const prompt = `You write the "Daily Bread" (Renungan Harian) for HKBP Singapore, a Batak Lutheran congregation in Singapore (members include families, youth, sailors and migrant workers).
Write the devotion for ${day} in ${L}.
- Pick one Bible passage that fits the church year around this date. Do not reuse these recent passages: ${recent.join("; ") || "none"}.
- Give the reference in ${L} book names (for example "Mazmur 23:1-3").
- Title: short and warm. Body: 120 to 170 words: quote or paraphrase the key verse briefly, one clear thought, one practical step for today, and a one-line prayer.
- Lutheran, Christ-centred, simple words, no politics.
Reply with JSON only: {"verse": "...", "title": "...", "body": "..."}`;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({ model: "claude-opus-5-5", max_tokens: 1200, messages: [{ role: "user", content: prompt }] }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error((j.error && j.error.message) || "Claude error");
  const txt = (j.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
  const m = txt.match(/\{[\s\S]*\}/); if (!m) throw new Error("Claude reply was not readable");
  return JSON.parse(m[0]);
}

// ---------- data refresh ----------
async function refresh() {
  try { D = await api.data(); }
  catch (e) { if (e.code === "not_signed_in") { D = null; location.hash = "#/login"; } else throw e; }
}

// ---------- layout ----------
const TABS = [["home", "#/home", "tab_home"], ["groups", "#/groups", "tab_groups"], ["roster", "#/serve", "tab_serve"], ["calendar", "#/calendar", "tab_calendar"], ["more", "#/more", "tab_more"]];
function shell(active, inner, opts = {}) {
  const nav = TABS.map(([i, h, k]) => `<a href="${h}" class="${active === h ? "on" : ""}" ${active === h ? 'aria-current="page"' : ""}>${ic(i)}<span>${esc(t(k))}</span></a>`).join("");
  return `
  <header class="top">
    ${opts.back ? `<a class="icon-btn" href="${opts.back}" aria-label="${esc(t("back"))}">${ic("back")}</a>` : `<img class="logo-sm" src="logo.png" alt="">`}
    <div class="brand"><b>${esc(opts.title || "HKBP Singapore")}</b>${opts.sub ? `<small>${esc(opts.sub)}</small>` : `<small>${esc(t("tagline"))}</small>`}</div>
    ${langSwitch()}
  </header>
  ${D && D.offline ? `<div class="banner">${esc(t("offline"))}</div>` : ""}
  ${api.mode === "local" ? `<div class="banner soft">${ic("phone")} ${esc(t("demoBanner"))}</div>` : ""}
  <main>${inner}</main>
  <nav class="tabs"><div class="in">${nav}</div></nav>`;
}
const langSwitch = () => `<div class="langs" role="group" aria-label="Language">${["id", "bt", "en"].map((l) => `<button data-act="lang" data-l="${l}" aria-pressed="${lang === l}">${l.toUpperCase()}</button>`).join("")}</div>`;
const empty = (msg, icon = "star") => `<div class="empty">${ic(icon)}<p>${esc(msg)}</p></div>`;
const roleBadge = (gid) => { const r = isAdmin() && !roleIn(gid) ? "admin" : roleIn(gid); return r ? `<span class="badge ${r}">${esc(t("role_" + r))}</span>` : ""; };
const groupTile = (g, extra = "") => `<a class="gtile" href="#/${g.kind === "sermon" ? "g" : "s"}/${g.id}" style="--gc:${g.color}">
    <span class="gicon">${ic(g.icon)}</span><span class="gname"><b>${esc(gname(g))}</b><small>${extra}</small></span>${roleBadge(g.id)}${ic("chev", "chev")}</a>`;

// ---------- screens ----------
const R = {};

R.login = async () => {
  const setup = await api.needsSetup();
  const demo = api.mode === "local";
  view().innerHTML = `<div class="login">
    <div class="login-top">${langSwitch()}</div>
    <img class="logo-xl" src="logo.png" alt="HKBP">
    <h1>HKBP Singapore</h1>
    <p class="muted">${esc(t("loginLead"))}</p>
    ${setup ? `
      <form class="card form" data-form="setup">
        <h3>${esc(t("setupTitle"))}</h3>
        <p class="small muted">${esc(t("setupLead"))}</p>
        <label>${esc(t("f_name"))}<input name="name" required autocomplete="name"></label>
        <label>${esc(t("f_phone"))}<div class="phone-in"><span>+65</span><input name="phone" inputmode="numeric" required placeholder="8123 4567"></div></label>
        <label>${esc(t("f_password"))}<input name="pw" type="password" required minlength="4" autocomplete="new-password"></label>
        <button class="btn primary block">${esc(t("setupBtn"))}</button>
      </form>
      <button class="btn block ghost" data-act="seedDemo">${ic("spark")} ${esc(t("demoBtn"))}</button>` : `
      <form class="card form" data-form="login">
        <label>${esc(t("f_phone"))}<div class="phone-in"><span>+65</span><input name="phone" inputmode="numeric" required placeholder="8123 4567" autocomplete="username"></div></label>
        <label>${esc(t("f_password"))}<input name="pw" type="password" required autocomplete="current-password"></label>
        <button class="btn primary block">${ic("lock")} ${esc(t("signIn"))}</button>
        <p class="small muted center">${esc(t("forgot"))}</p>
      </form>
      ${demo ? `<p class="small muted center">${esc(t("demoLogins"))}</p>` : ""}`}
    ${demo ? `<p class="small muted center">${ic("phone")} ${esc(t("demoBanner"))}</p>` : ""}
    <p class="small muted center">${esc(t("installHint"))}</p>
  </div>`;
};

R.home = () => {
  const day = today(); const m = me();
  const b = D.bread.find((x) => x.day === day);
  const bdays = birthdaysBetween(day, 7);
  const mine = m.dob && m.dob.slice(5) === day.slice(5);
  const myDuties = duties().filter((d) => !d.date || d.date >= day).slice(0, 4);
  const evs = D.events.filter((e) => new Date(e.starts_at) > Date.now() - 3 * 3600e3).slice(0, 3);
  const ups = D.updates.slice(0, 2);
  const myGroups = D.groups.filter((g) => roleIn(g.id));
  const hour = +new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "numeric", hour12: false }).format(new Date());
  const notifyAsk = "Notification" in window ? Notification.permission === "default" || !LS.get("notifyOn") : /iP(hone|ad)/.test(navigator.userAgent) && !standalone();
  return shell("#/home", `
    <section class="hello">
      <p class="muted small">${esc(fmtDay(day))}</p>
      <h1>${esc(t(hour < 11 ? "morning" : hour < 15 ? "afternoon" : hour < 18 ? "evening1" : "evening2"))}, ${esc(firstName(m.name))}</h1>
    </section>
    ${mine ? `<div class="card hbd">${ic("cake")}<div><h2>${esc(t("hbdTitle", firstName(m.name)))}</h2><p>${esc(t("hbdBody"))}</p></div></div>` : ""}
    ${notifyAsk ? `<button class="card notify-ask" data-act="notify">${ic("bell")}<span><b>${esc(t("notifyAskTitle"))}</b><small>${esc(standalone() || !/iP(hone|ad)/.test(navigator.userAgent) ? t("notifyAskBody") : t("iosInstallFirst"))}</small></span>${ic("chev", "chev")}</button>` : ""}

    <article class="card bread-card">
      <div class="kicker">${ic("bread")} ${esc(t("breadTitle"))}</div>
      ${b ? `
        <p class="verse-ref">${esc(b.verse || "")}</p>
        <h2>${esc(b.title || "")}</h2>
        <p class="clamp">${esc(b.body || "")}</p>
        <div class="row"><a class="btn primary" href="#/bread/${b.day}">${esc(t("readMore"))}</a><a class="btn wa" href="${wa(breadText(b))}" target="_blank" rel="noopener">${ic("wa")} WhatsApp</a></div>` : `
        <p class="muted">${esc(t("noBread"))}</p>
        ${isElder() ? `<a class="btn primary" href="#/bread/new">${ic("edit")} ${esc(t("writeBread"))}</a>` : `<a class="btn" href="#/bread">${esc(t("breadArchive"))}</a>`}`}
    </article>

    ${bdays.length ? `<article class="card">
      <div class="card-h"><h3>${ic("cake")} ${esc(t("birthdays"))}</h3><a class="small" href="#/people">${esc(t("seeAll"))}</a></div>
      ${bdays.slice(0, 6).map(({ p, day: d, inDays }) => `<div class="li"><span class="avatar">${esc(initials(p.name))}</span><span class="grow"><b>${esc(p.name)}</b><small>${esc(inDays === 0 ? t("today") : inDays === 1 ? t("tomorrow") : fmt(d, { weekday: "long", day: "numeric", month: "short" }))}</small></span>
        ${inDays === 0 && p.phone && p.id !== m.id ? `<a class="icon-btn wa" href="${wa(t("hbdWish", firstName(p.name)), p.phone)}" target="_blank" rel="noopener" aria-label="WhatsApp">${ic("wa")}</a>` : inDays === 0 ? `<span class="party">🎉</span>` : ""}</div>`).join("")}
    </article>` : ""}

    <article class="card">
      <div class="card-h"><h3>${ic("roster")} ${esc(t("myDuties"))}</h3><a class="small" href="#/serve">${esc(t("rosters"))}</a></div>
      ${myDuties.length ? myDuties.map(dutyRow).join("") : `<p class="muted small">${esc(t("noDuties"))}</p>`}
    </article>

    <article class="card">
      <div class="card-h"><h3>${ic("calendar")} ${esc(t("upcoming"))}</h3><a class="small" href="#/calendar">${esc(t("seeAll"))}</a></div>
      ${evs.length ? evs.map(eventRow).join("") : `<p class="muted small">${esc(t("noEvents"))}</p>`}
    </article>

    <article class="card">
      <div class="card-h"><h3>${ic("book")} ${esc(t("eldersUpdates"))}</h3><a class="small" href="#/elders">${esc(t("seeAll"))}</a></div>
      ${ups.length ? ups.map((u) => updateCard(u, true)).join("") : `<p class="muted small">${esc(t("noUpdates"))}</p>`}
    </article>

    ${myGroups.length ? `<h3 class="sec-h">${esc(t("myGroups"))}</h3><div class="glist">${myGroups.map((g) => groupTile(g, esc(t(g.kind === "sermon" ? "kindSermon" : "kindService")))).join("")}</div>` : ""}
    ${!standalone() ? `<p class="small muted center pad">${esc(t("installHint"))}</p>` : ""}
  `);
};
const initials = (n) => String(n || "?").replace(/^(Pdt|St|Bapak|Ibu|Kak|Bang|Ev|Dr)\.?\s+/i, "").split(/\s+/).slice(0, 2).map((x) => x[0] || "").join("").toUpperCase();
function dutyRow(d) {
  return `<a class="li" href="#/s/${d.roster.group_id}?m=${d.roster.month}" style="--gc:${d.group ? d.group.color : "#64748b"}">
    <span class="date-chip">${d.date ? `<b>${esc(fmt(d.date, { day: "numeric" }))}</b><small>${esc(fmt(d.date, { month: "short" }))}</small>` : `<small>${esc(fmt(d.roster.month + "-15", { month: "short" }))}</small>`}</span>
    <span class="grow"><b>${esc(gname(d.group))}${d.roles.length ? " · " + esc(d.roles.join(", ")) : ""}</b><small>${esc(d.row.slice(0, 120))}</small></span></a>`;
}
function eventRow(e) {
  const p = sgParts(e.starts_at); const g = e.group_id ? G(e.group_id) : null; const past = new Date(e.starts_at) < Date.now();
  return `<div class="li ev ${past ? "past" : ""}" style="--gc:${g ? g.color : "var(--brand)"}">
    <span class="date-chip"><b>${esc(fmt(p.date, { day: "numeric" }))}</b><small>${esc(fmt(p.date, { month: "short" }))}</small></span>
    <span class="grow"><b>${esc(e.title)}</b><small>${esc(fmt(p.date, { weekday: "short" }))} ${esc(fmtTime(e.starts_at))}${e.place ? " · " + esc(e.place) : ""} · ${esc(gname(g))}</small></span>
    <button class="icon-btn" data-act="evMenu" data-id="${e.id}" aria-label="${esc(t("addCal"))}">${ic("calendar")}</button></div>`;
}
function updateCard(u, compact) {
  return `<div class="update ${u.pinned ? "pinned" : ""}">
    <div class="meta">${u.pinned ? `${ic("pin")} ` : ""}${esc(fmt(u.created_at, { day: "numeric", month: "short" }))} · ${esc(u.author_name || "")}${u.audience === "elders" ? ` · <span class="badge chair">${esc(t("eldersOnly"))}</span>` : ""}</div>
    <b>${esc(u.title)}</b>
    <p class="${compact ? "clamp2" : "pre"}">${esc(u.body)}</p>
    ${!compact && isElder() ? `<div class="row end"><button class="btn sm" data-act="editUpdate" data-id="${u.id}">${ic("edit")} ${esc(t("edit"))}</button><button class="btn sm danger" data-act="del" data-kind="update" data-id="${u.id}">${ic("trash")}</button></div>` : ""}
  </div>`;
}

// Categories (sermonic): same format, each with its own colour, icon and verse.
R.groups = () => {
  const list = D.groups.filter((g) => g.kind === "sermon");
  return shell("#/groups", `
    <h2 class="page-h">${esc(t("groupsTitle"))}</h2>
    <p class="lead">${esc(t("groupsLead"))}</p>
    <div class="gcards">${list.map((g) => {
      const n = D.people.filter((p) => g.id in (p.groups || {})).length; const posts = D.posts.filter((p) => p.group_id === g.id).length; const ok = canSee(g);
      return `<a class="gcard ${ok ? "" : "locked"}" href="#/g/${g.id}" style="--gc:${g.color}">
        <span class="gcard-bg"></span><span class="gicon lg">${ic(g.icon)}</span>
        <span class="gcard-t"><b>${esc(gname(g))}</b><small>${esc(t("motto_" + g.id) !== "motto_" + g.id ? t("motto_" + g.id) : "")}</small></span>
        <span class="gcard-f">${roleBadge(g.id) || (ok ? "" : `<span class="badge">${ic("lock")} ${esc(t("membersOnly"))}</span>`)}<span class="small">${n} ${esc(t("members"))}${ok ? ` · ${posts} ${esc(t("posts"))}` : ""}</span></span>
      </a>`; }).join("")}</div>`);
};

R.group = (gid) => {
  const g = G(gid); if (!g) return R.notFound();
  const tab = new URLSearchParams(location.hash.split("?")[1] || "").get("tab") || "sermon";
  const ok = canSee(g); const edit = canEdit(gid);
  const posts = D.posts.filter((p) => p.group_id === gid);
  const sermons = posts.filter((p) => p.kind === "sermon").sort((a, b) => (b.day || b.created_at).localeCompare(a.day || a.created_at));
  const news = posts.filter((p) => p.kind !== "sermon");
  const evs = D.events.filter((e) => e.group_id === gid);
  const people = D.people.filter((p) => gid in (p.groups || {}));
  const tabs = [["sermon", "t_sermon", sermons.length], ["news", "t_news", news.length], ["events", "t_events", evs.length], ["members", "t_members", people.length]];
  let body = "";
  if (!ok) body = empty(t("membersOnlyLong"), "lock");
  else if (tab === "sermon") body = (edit ? `<button class="btn primary block" data-act="newPost" data-g="${gid}" data-kind="sermon">${ic("plus")} ${esc(t("newSermon"))}</button>` : "") + (sermons.length ? sermons.map((p) => postCard(p, edit)).join("") : empty(t("noSermon"), "book"));
  else if (tab === "news") body = (edit ? `<button class="btn primary block" data-act="newPost" data-g="${gid}" data-kind="news">${ic("plus")} ${esc(t("newNews"))}</button>` : "") + (news.length ? news.map((p) => postCard(p, edit)).join("") : empty(t("noNews"), "bell"));
  else if (tab === "events") body = (edit ? `<button class="btn primary block" data-act="newEvent" data-g="${gid}">${ic("plus")} ${esc(t("newEvent"))}</button>` : "") + `<div class="card">${evs.length ? evs.map(eventRow).join("") : `<p class="muted small">${esc(t("noEvents"))}</p>`}</div>`;
  else body = peopleList(people, gid);
  return shell("#/groups", `
    <section class="ghero" style="--gc:${g.color}">
      <span class="gicon xl">${ic(g.icon)}</span>
      <div><h2>${esc(gname(g))}</h2><p>${esc(t("motto_" + g.id) !== "motto_" + g.id ? t("motto_" + g.id) : t("kindSermon"))}</p>${roleBadge(gid) ? `<div class="hero-role">${roleBadge(gid)} <small>${esc(edit ? t("canUpdate") : t("readOnly"))}</small></div>` : ""}</div>
    </section>
    ${ok ? `<div class="seg" role="tablist" style="--gc:${g.color}">${tabs.map(([k, l, n]) => `<a role="tab" aria-selected="${tab === k}" href="#/g/${gid}?tab=${k}">${esc(t(l))}${n ? ` <i>${n}</i>` : ""}</a>`).join("")}</div>` : ""}
    <div style="--gc:${g.color}">${body}</div>`, { back: "#/groups", title: gname(g), sub: t("kindSermon") });
};
function postCard(p, edit) {
  return `<article class="card post" style="--gc:${(G(p.group_id) || {}).color}">
    <div class="meta">${esc(p.day ? fmtDay(p.day) : fmt(p.created_at, { day: "numeric", month: "long", year: "numeric" }))} · ${esc(p.author_name || "")}</div>
    <h3>${esc(p.title)}</h3>
    ${p.verse ? `<p class="verse-ref">${esc(p.verse)}</p>` : ""}
    <details><summary>${esc(t("readMore"))}</summary><p class="pre">${esc(p.body)}</p></details>
    <div class="row end">
      <a class="btn sm wa" href="${wa(`*${p.title}*\n${p.verse || ""}\n\n${p.body || ""}\n\n– ${gname(G(p.group_id))}, HKBP Singapore`)}" target="_blank" rel="noopener">${ic("wa")}</a>
      ${edit ? `<button class="btn sm" data-act="editPost" data-id="${p.id}">${ic("edit")} ${esc(t("edit"))}</button><button class="btn sm danger" data-act="del" data-kind="post" data-id="${p.id}" aria-label="${esc(t("delete"))}">${ic("trash")}</button>` : ""}
    </div></article>`;
}
function peopleList(people, gid) {
  if (!people.length) return empty(t("noMembers"), "people");
  return `<div class="card">${people.map((p) => `<div class="li"><span class="avatar">${esc(initials(p.name))}</span><span class="grow"><b>${esc(p.name)}</b><small>${gid && p.groups[gid] === "chair" ? esc(t("role_chair")) : ""}${p.phone ? (gid && p.groups[gid] === "chair" ? " · " : "") + esc(fmtPhone(p.phone)) : ""}</small></span>
    ${p.phone ? `<a class="icon-btn wa" href="https://wa.me/65${p.phone}" target="_blank" rel="noopener" aria-label="WhatsApp">${ic("wa")}</a>` : ""}</div>`).join("")}</div>`;
}

// Service sections (non-sermonic) with monthly rosters.
R.serve = () => {
  const list = D.groups.filter((g) => g.kind === "service");
  const ym = monthKey(today());
  return shell("#/serve", `
    <h2 class="page-h">${esc(t("serveTitle"))}</h2>
    <p class="lead">${esc(t("serveLead"))}</p>
    <div class="glist">${list.map((g) => { const has = D.rosters.some((r) => r.group_id === g.id && r.month === ym); const nx = D.rosters.some((r) => r.group_id === g.id && r.month === shiftMonth(ym, 1));
      return groupTile(g, `${has ? "✓ " : ""}${esc(t(has ? "rosterReady" : "rosterMissing", monthName(ym)))}${nx ? " · " + esc(t("nextReady")) : ""}`); }).join("")}</div>
    ${isAdmin() ? `<button class="btn block ghost" data-act="newSection">${ic("plus")} ${esc(t("addSection"))}</button>` : ""}`);
};

R.section = (gid) => {
  const g = G(gid); if (!g) return R.notFound();
  const q = new URLSearchParams(location.hash.split("?")[1] || "");
  const ym = q.get("m") || LS.get("ym." + gid, monthKey(today()));
  const edit = canEdit(gid);
  const rs = D.rosters.filter((r) => r.group_id === gid && r.month === ym);
  const mine = duties().filter((d) => d.roster.group_id === gid && d.roster.month === ym);
  const people = D.people.filter((p) => gid in (p.groups || {}));
  return shell("#/serve", `
    <section class="ghero slim" style="--gc:${g.color}">
      <span class="gicon xl">${ic(g.icon)}</span>
      <div><h2>${esc(gname(g))}</h2><p>${esc(t("kindService"))}</p>${roleBadge(gid) ? `<div class="hero-role">${roleBadge(gid)} <small>${esc(edit ? t("canUpdate") : t("readOnly"))}</small></div>` : ""}</div>
    </section>
    ${gid === "parhalado" ? `<div class="row two"><a class="btn" href="#/elders">${ic("book")} ${esc(t("eldersUpdates"))}</a><a class="btn" href="#/bread">${ic("bread")} ${esc(t("breadTitle"))}</a></div>` : ""}
    <div class="monthbar" style="--gc:${g.color}">
      <a class="icon-btn" href="#/s/${gid}?m=${shiftMonth(ym, -1)}" aria-label="${esc(t("prevMonth"))}">${ic("back")}</a>
      <b>${esc(monthName(ym))}</b>
      <a class="icon-btn" href="#/s/${gid}?m=${shiftMonth(ym, 1)}" aria-label="${esc(t("nextMonth"))}">${ic("chev")}</a>
    </div>
    ${mine.length ? `<div class="card mine" style="--gc:${g.color}"><h3>${ic("check")} ${esc(t("youServe"))}</h3>${mine.map(dutyRow).join("")}</div>` : ""}
    ${edit ? `<button class="btn primary block" data-act="uploadRoster" data-g="${gid}" data-m="${ym}" style="--gc:${g.color}">${ic("upload")} ${esc(t("uploadRoster"))}</button>` : ""}
    ${rs.length ? rs.map((r) => rosterCard(r, edit)).join("") : empty(t("noRoster", monthName(ym)), "roster")}
    <h3 class="sec-h">${esc(t("t_members"))}</h3>
    ${peopleList(people, gid)}`, { back: "#/serve", title: gname(g), sub: t("kindService") });
};
const fileKind = (r) => r.link && !r.file_name ? "link" : /\.(xlsx|xls|csv|ods)$/i.test(r.file_name || "") ? "xls" : /\.pdf$/i.test(r.file_name || "") ? "pdf" : /\.docx?$/i.test(r.file_name || "") ? "doc" : /^image/.test(r.mime || "") ? "img" : "file";
function rosterCard(r, edit) {
  const names = myNames();
  const tables = (r.table_json || []).filter((tb) => tb.rows.length);
  return `<article class="card roster" style="--gc:${(G(r.group_id) || {}).color}">
    <div class="roster-h"><span class="ftype ${fileKind(r)}">${esc(fileKind(r).toUpperCase())}</span><div class="grow"><b>${esc(r.title || r.file_name || "Roster")}</b><small>${esc(r.file_name || r.link || "")} · ${esc(r.author_name || "")}</small></div></div>
    ${tables.length ? tables.map((tb) => `<div class="tbl-wrap"><table class="tbl">${tb.rows.map((row, i) => `<tr class="${row.some((c) => hit(c, names)) ? "me" : ""}">${row.map((c) => `<${i === 0 ? "th" : "td"} class="${hit(c, names) ? "me" : ""}">${esc(c)}</${i === 0 ? "th" : "td"}>`).join("")}</tr>`).join("")}</table></div>${tables.length > 1 ? `<p class="small muted">${esc(tb.name)}</p>` : ""}`).join("") : r.mime && /^image/.test(r.mime) ? `<div class="img-slot" data-img="${r.id}"></div>` : `<p class="small muted">${esc(t("noPreview"))}</p>`}
    <div class="row end">
      ${r.has_file ? `<button class="btn sm" data-act="openFile" data-id="${r.id}">${ic("file")} ${esc(t("openOriginal"))}</button>` : ""}
      ${r.link ? `<a class="btn sm" href="${esc(r.link)}" target="_blank" rel="noopener">${ic("link")} ${esc(t("openLink"))}</a>` : ""}
      ${edit ? `<button class="btn sm danger" data-act="del" data-kind="roster" data-id="${r.id}" aria-label="${esc(t("delete"))}">${ic("trash")}</button>` : ""}
    </div></article>`;
}

R.calendar = () => {
  const now = Date.now();
  const show = LS.get("calPast", false);
  const evs = D.events.filter((e) => show || new Date(e.starts_at) > now - 3 * 3600e3);
  const canAdd = isElder() || D.groups.some((g) => canEdit(g.id));
  const byMonth = {}; evs.forEach((e) => { const k = monthKey(sgParts(e.starts_at).date); (byMonth[k] = byMonth[k] || []).push(e); });
  return shell("#/calendar", `
    <h2 class="page-h">${esc(t("calendarTitle"))}</h2>
    <p class="lead">${esc(t("calendarLead"))}</p>
    <div class="row two">${canAdd ? `<button class="btn primary" data-act="newEvent">${ic("plus")} ${esc(t("newEvent"))}</button>` : ""}<button class="btn" data-act="icsAll" ${evs.length ? "" : "disabled"}>${ic("download")} ${esc(t("addAllCal"))}</button></div>
    ${Object.keys(byMonth).length ? Object.entries(byMonth).map(([k, list]) => `<h3 class="sec-h">${esc(monthName(k))}</h3><div class="card">${list.map(eventRow).join("")}</div>`).join("") : empty(t("noEvents"), "calendar")}
    <p class="center"><button class="btn sm ghost" data-act="calPast">${esc(t(show ? "hidePast" : "showPast"))}</button></p>`);
};

R.bread = (arg) => {
  const day = today();
  if (arg === "new" || (arg && arg.startsWith("edit-"))) return breadEditor(arg === "new" ? day : arg.slice(5));
  const list = D.bread.filter((b) => isElder() || b.day <= day);
  const b = list.find((x) => x.day === (arg || day)) || (!arg ? list.find((x) => x.day <= day) : null);
  const future = isElder() ? D.bread.filter((x) => x.day > day).sort((a, c) => a.day.localeCompare(c.day)) : [];
  return shell("#/home", `
    ${b ? `<article class="bread-full">
      <div class="kicker">${ic("bread")} ${esc(t("breadTitle"))} · ${esc(fmtDay(b.day))}</div>
      <h1>${esc(b.title || "")}</h1>
      <p class="verse-ref big">${esc(b.verse || "")}</p>
      <div class="pre body">${esc(b.body || "")}</div>
      <p class="small muted">${esc(b.author_name || "")}</p>
      <div class="row two"><a class="btn wa" href="${wa(breadText(b))}" target="_blank" rel="noopener">${ic("wa")} ${esc(t("shareWa"))}</a><button class="btn" data-act="copyBread" data-day="${b.day}">${ic("share")} ${esc(t("copy"))}</button></div>
      ${isElder() ? `<div class="row two"><a class="btn" href="#/bread/edit-${b.day}">${ic("edit")} ${esc(t("edit"))}</a><button class="btn danger" data-act="del" data-kind="bread" data-id="${b.day}">${ic("trash")} ${esc(t("delete"))}</button></div>` : ""}
    </article>` : empty(t("noBread"), "bread")}
    ${isElder() ? `<div class="card"><h3>${ic("edit")} ${esc(t("breadPlan"))}</h3><p class="small muted">${esc(t("breadPlanLead"))}</p>
      <div class="row two"><a class="btn primary" href="#/bread/new">${ic("plus")} ${esc(t("writeBread"))}</a><button class="btn" data-act="genWeek">${ic("ai")} ${esc(t("genWeek"))}</button></div>
      ${future.length ? `<div class="chips">${future.map((x) => `<a class="chip" href="#/bread/${x.day}">${esc(fmtShort(x.day))}</a>`).join("")}</div>` : ""}</div>` : ""}
    <h3 class="sec-h">${esc(t("breadArchive"))}</h3>
    <div class="card">${list.filter((x) => x.day <= day).slice(0, 40).map((x) => `<a class="li" href="#/bread/${x.day}"><span class="date-chip"><b>${esc(fmt(x.day, { day: "numeric" }))}</b><small>${esc(fmt(x.day, { month: "short" }))}</small></span><span class="grow"><b>${esc(x.title || "")}</b><small>${esc(x.verse || "")}</small></span></a>`).join("") || `<p class="muted small">${esc(t("noBread"))}</p>`}</div>`,
    { back: "#/home", title: t("breadTitle"), sub: "HKBP Singapore" });
};
function breadEditor(day) {
  const b = D.bread.find((x) => x.day === day) || { day };
  return shell("#/home", `
    <form class="card form" data-form="bread">
      <h3>${esc(t("writeBread"))}</h3>
      <label>${esc(t("f_date"))}<input type="date" name="day" value="${esc(b.day)}" required></label>
      <div class="ai-box"><span>${ic("ai")} ${esc(t("genWith"))}</span>
        <select name="glang">${["id", "bt", "en"].map((l) => `<option value="${l}" ${l === lang ? "selected" : ""}>${esc(t("lang_" + l))}</option>`).join("")}</select>
        <button type="button" class="btn sm" data-act="genOne">${esc(t("generate"))}</button></div>
      <label>${esc(t("f_verse"))}<input name="verse" value="${esc(b.verse || "")}" placeholder="Mazmur 23:1-3"></label>
      <label>${esc(t("f_title"))}<input name="title" value="${esc(b.title || "")}" required></label>
      <label>${esc(t("f_body"))}<textarea name="body" rows="10" required>${esc(b.body || "")}</textarea></label>
      <button class="btn primary block">${esc(t("save"))}</button>
      <p class="small muted">${esc(t("breadSendNote"))}</p>
    </form>`, { back: "#/bread", title: t("breadTitle"), sub: t("writeBread") });
}

R.elders = () => shell("#/more", `
  <p class="lead">${esc(t("eldersLead"))}</p>
  ${isElder() ? `<button class="btn primary block" data-act="newUpdate">${ic("plus")} ${esc(t("newUpdate"))}</button>` : ""}
  ${D.updates.length ? D.updates.map((u) => `<article class="card">${updateCard(u, false)}</article>`).join("") : empty(t("noUpdates"), "book")}`,
  { back: "#/home", title: t("eldersUpdates"), sub: "Parhalado HKBP Singapore" });

R.people = () => {
  const day = today();
  const soon = birthdaysBetween(day, 30);
  const month = D.people.filter((p) => p.bday && p.bday.slice(0, 2) === day.slice(5, 7)).sort((a, b) => a.bday.localeCompare(b.bday));
  return shell("#/more", `
    ${isAdmin() ? `<div class="card admin-card"><h3>${ic("upload")} ${esc(t("memberUpload"))}</h3><p class="small muted">${esc(t("memberUploadLead"))}</p>
      <div class="row two"><button class="btn primary" data-act="uploadMembers">${ic("upload")} ${esc(t("chooseFile"))}</button><button class="btn" data-act="template">${ic("download")} ${esc(t("template"))}</button></div>
      <button class="btn block ghost" data-act="editMember">${ic("plus")} ${esc(t("addMember"))}</button></div>` : ""}
    <h3 class="sec-h">${ic("cake")} ${esc(t("bdaySoon"))}</h3>
    <div class="card">${soon.length ? soon.map(({ p, day: d, inDays }) => `<div class="li"><span class="date-chip"><b>${esc(fmt(d, { day: "numeric" }))}</b><small>${esc(fmt(d, { month: "short" }))}</small></span><span class="grow"><b>${esc(p.name)}</b><small>${esc(inDays === 0 ? t("today") : t("inDays", inDays))}</small></span>${p.phone && p.id !== me().id ? `<a class="icon-btn wa" href="${wa(t("hbdWish", firstName(p.name)), p.phone)}" target="_blank" rel="noopener" aria-label="WhatsApp">${ic("wa")}</a>` : ""}</div>`).join("") : `<p class="muted small">${esc(t("noBdays"))}</p>`}</div>
    <h3 class="sec-h">${esc(t("bdayMonth", monthName(monthKey(day))))}</h3>
    <div class="chips">${month.map((p) => `<span class="chip">${esc(p.bday.slice(3))} · ${esc(p.name)}</span>`).join("") || `<span class="muted small">${esc(t("noBdays"))}</span>`}</div>
    ${isAdmin() ? `<h3 class="sec-h">${esc(t("allMembers"))} (${D.people.length})</h3>
      <input class="search" type="search" placeholder="${esc(t("search"))}" data-filter=".mrow">
      <div class="card">${D.people.map((p) => `<button class="li mrow" data-act="editMember" data-id="${p.id}" data-q="${esc(norm(p.name + " " + (p.phone || "")))}"><span class="avatar">${esc(initials(p.name))}</span><span class="grow"><b>${esc(p.name)}${p.is_admin ? ` <span class="badge admin">${esc(t("role_admin"))}</span>` : ""}</b><small>${esc(fmtPhone(p.phone))} · ${esc(Object.entries(p.groups || {}).map(([g, r]) => gname(G(g)) + (r === "chair" ? " ★" : "")).join(", ") || "—")}${p.has_password === false ? " · " + esc(t("noPassword")) : ""}</small></span>${ic("chev", "chev")}</button>`).join("")}</div>` : ""}`,
    { back: "#/more", title: t("people"), sub: t("peopleSub") });
};

R.more = () => {
  const m = me(); const roles = Object.entries(m.groups || {});
  const perm = "Notification" in window ? Notification.permission : "unsupported";
  return shell("#/more", `
    <section class="profile card">
      <span class="avatar lg">${esc(initials(m.name))}</span>
      <div class="grow"><h3>${esc(m.name)}</h3><p class="small muted">${esc(fmtPhone(m.phone))}${m.dob ? " · " + esc(fmt(m.dob, { day: "numeric", month: "long" })) : ""}</p>
        <div class="chips">${m.is_admin ? `<span class="badge admin">${esc(t("role_admin"))}</span>` : ""}${roles.map(([g, r]) => `<span class="chip" style="--gc:${(G(g) || {}).color}">${esc(gname(G(g)))}${r === "chair" ? " · " + esc(t("role_chair")) : ""}</span>`).join("")}</div></div>
    </section>
    <div class="menu card">
      <a class="li" href="#/elders">${ic("book")}<span class="grow"><b>${esc(t("eldersUpdates"))}</b></span>${ic("chev", "chev")}</a>
      <a class="li" href="#/bread">${ic("bread")}<span class="grow"><b>${esc(t("breadTitle"))}</b></span>${ic("chev", "chev")}</a>
      <a class="li" href="#/people">${ic("cake")}<span class="grow"><b>${esc(t("people"))}</b><small>${esc(isAdmin() ? t("peopleAdmin") : t("peopleSub"))}</small></span>${ic("chev", "chev")}</a>
      <button class="li" data-act="notify">${ic("bell")}<span class="grow"><b>${esc(t("notifications"))}</b><small>${esc(perm === "granted" ? t("notifyOnTxt") : perm === "denied" ? t("notifyDenied") : t("notifyAskBody"))}</small></span>${ic("chev", "chev")}</button>
      <button class="li" data-act="password">${ic("key")}<span class="grow"><b>${esc(t("changePw"))}</b></span>${ic("chev", "chev")}</button>
      <button class="li" data-act="install">${ic("phone")}<span class="grow"><b>${esc(t("installTitle"))}</b><small>${esc(standalone() ? t("installed") : t("installHint"))}</small></span>${ic("chev", "chev")}</button>
      ${isElder() ? `<button class="li" data-act="settings">${ic("gear")}<span class="grow"><b>${esc(t("settings"))}</b><small>${esc(api.mode === "remote" ? t("modeRemote") : t("modeLocal"))}</small></span>${ic("chev", "chev")}</button>` : ""}
      <button class="li" data-act="logout">${ic("logout")}<span class="grow"><b>${esc(t("signOut"))}</b></span></button>
    </div>
    <p class="small muted center pad">HKBP Singapore · ${esc(t("logoNote"))}</p>`, { title: t("tab_more"), sub: "HKBP Singapore" });
};
R.notFound = () => shell("#/home", empty(t("notFound")), { back: "#/home" });

// ---------- router ----------
let rendering = false;
async function render() {
  if (rendering) return; rendering = true;
  try {
    const h = location.hash.replace(/^#\/?/, "").split("?")[0];
    const [r, arg] = h.split("/");
    if (!api.hasSession()) { if (r !== "login") { location.replace("#/login"); } await R.login(); return; }
    if (!D) await refresh();
    if (!D) { await R.login(); return; }
    if (r === "login" || !r) { location.replace("#/home"); return; }
    const map = { home: R.home, groups: R.groups, g: R.group, serve: R.serve, s: R.section, calendar: R.calendar, bread: R.bread, elders: R.elders, people: R.people, more: R.more };
    const html = (map[r] || R.notFound)(arg);
    if (typeof html === "string") view().innerHTML = html;
    document.title = r === "home" ? "HKBP Singapore" : `${$(".brand b") ? $(".brand b").textContent : ""} · HKBP Singapore`;
    hydrate();
  } catch (e) { console.error(e); view().innerHTML = `<div class="login">${empty(errMsg(e))}<button class="btn primary" data-act="retry">${esc(t("retry"))}</button></div>`; }
  finally { rendering = false; }
}
function hydrate() {
  document.documentElement.lang = lang === "en" ? "en" : lang === "bt" ? "bbc" : "id";
  document.querySelectorAll("[data-img]").forEach(async (el) => { try { const f = await api.rosterFile(el.dataset.img); if (f && f.file_b64) el.innerHTML = `<img src="data:${esc(f.mime)};base64,${f.file_b64}" alt="Roster">`; } catch {} });
}
window.addEventListener("hashchange", () => { window.scrollTo(0, 0); render(); });

// ---------- actions ----------
const A = {};
A.lang = (d) => { lang = d.l; LS.set("lang", lang); render(); };
A.closeSheet = closeSheet;
A.retry = () => { D = null; render(); };
A.seedDemo = async (d, btn) => { await busy(btn, () => seedDemo()); toast(t("demoReady")); render(); };
A.notify = (d, btn) => enableNotifications(btn);
A.logout = async () => { await api.logout(); D = null; location.hash = "#/login"; render(); };
A.calPast = () => { LS.set("calPast", !LS.get("calPast", false)); render(); };
A.icsAll = () => download("hkbp-singapore.ics", ics(D.events.filter((e) => new Date(e.starts_at) > Date.now())), "text/calendar");
A.evMenu = (d) => {
  const e = D.events.find((x) => x.id === d.id); if (!e) return; const p = sgParts(e.starts_at); const g = e.group_id ? G(e.group_id) : null;
  const edit = isElder() || (e.group_id && canEdit(e.group_id));
  sheet(e.title, `<p class="muted">${esc(fmtDay(p.date))} · ${esc(fmtTime(e.starts_at))}${e.ends_at ? "–" + esc(fmtTime(e.ends_at)) : ""}</p>
    ${e.place ? `<p>${ic("pin")} ${esc(e.place)}</p>` : ""}<p class="small muted">${esc(gname(g))} · ${esc(t("remindTxt", remindLabel(e.remind_min)))}</p>${e.notes ? `<p class="pre">${esc(e.notes)}</p>` : ""}
    <div class="stack"><button class="btn primary block" data-act="icsOne" data-id="${e.id}">${ic("calendar")} ${esc(t("addPhoneCal"))}</button>
    <a class="btn block" href="${gcal(e)}" target="_blank" rel="noopener">${ic("globe")} Google Calendar</a>
    <a class="btn block wa" href="${wa(`🗓 *${e.title}*\n${fmtDay(p.date)} · ${fmtTime(e.starts_at)}${e.place ? "\n📍 " + e.place : ""}${e.notes ? "\n\n" + e.notes : ""}\n\n– HKBP Singapore`)}" target="_blank" rel="noopener">${ic("wa")} WhatsApp</a>
    ${edit ? `<div class="row two"><button class="btn" data-act="newEvent" data-id="${e.id}">${ic("edit")} ${esc(t("edit"))}</button><button class="btn danger" data-act="del" data-kind="event" data-id="${e.id}">${ic("trash")} ${esc(t("delete"))}</button></div>` : ""}</div>`);
};
A.icsOne = (d) => { const e = D.events.find((x) => x.id === d.id); download(`${e.title.replace(/[^\w]+/g, "-").slice(0, 40)}.ics`, ics([e]), "text/calendar"); };
const REMINDS = [0, 60, 180, 1440, 2880, 10080];
const remindLabel = (m) => t("rem_" + m) !== "rem_" + m ? t("rem_" + m) : `${m} min`;
A.newEvent = (d) => {
  const e = d.id ? D.events.find((x) => x.id === d.id) : null; const p = e ? sgParts(e.starts_at) : { date: addDays(today(), 7), time: "10:00" };
  const opts = [...(isElder() ? [["", t("wholeChurch")]] : []), ...D.groups.filter((g) => canEdit(g.id) || isElder()).map((g) => [g.id, gname(g)])];
  const gsel = e ? e.group_id || "" : d.g || (isElder() ? "" : opts[0][0]);
  sheet(t(e ? "editEvent" : "newEvent"), `<form class="form" data-form="event" data-id="${e ? e.id : ""}">
    <label>${esc(t("f_title"))}<input name="title" required value="${esc(e ? e.title : "")}"></label>
    <label>${esc(t("f_for"))}<select name="group_id">${opts.map(([v, l]) => `<option value="${v}" ${v === gsel ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
    <div class="row two"><label>${esc(t("f_date"))}<input type="date" name="date" required value="${p.date}"></label><label>${esc(t("f_time"))}<input type="time" name="time" required value="${p.time}"></label></div>
    <label>${esc(t("f_end"))}<input type="time" name="end" value="${e && e.ends_at ? sgParts(e.ends_at).time : ""}"></label>
    <label>${esc(t("f_place"))}<input name="place" value="${esc(e ? e.place || "" : "")}"></label>
    <label>${esc(t("f_remind"))}<select name="remind_min">${REMINDS.map((m) => `<option value="${m}" ${(e ? e.remind_min : 1440) === m ? "selected" : ""}>${esc(remindLabel(m))}</option>`).join("")}</select></label>
    <label>${esc(t("f_notes"))}<textarea name="notes" rows="3">${esc(e ? e.notes || "" : "")}</textarea></label>
    <button class="btn primary block">${esc(t("save"))}</button></form>`);
};
A.newPost = (d) => postForm({ group_id: d.g, kind: d.kind });
A.editPost = (d) => postForm(D.posts.find((p) => p.id === d.id));
function postForm(p) {
  const sermon = p.kind === "sermon";
  sheet(t(p.id ? "edit" : sermon ? "newSermon" : "newNews"), `<form class="form" data-form="post" data-id="${p.id || ""}" data-g="${p.group_id}" data-kind="${p.kind}">
    ${sermon ? `<label>${esc(t("f_date"))}<input type="date" name="day" value="${esc(p.day || nextSunday())}"></label>` : ""}
    <label>${esc(t("f_title"))}<input name="title" required value="${esc(p.title || "")}"></label>
    ${sermon ? `<label>${esc(t("f_verse"))}<input name="verse" value="${esc(p.verse || "")}" placeholder="Lukas 2:8-14"></label>` : ""}
    <label>${esc(t(sermon ? "f_material" : "f_body"))}<textarea name="body" rows="9" required>${esc(p.body || "")}</textarea></label>
    <label class="check"><input type="checkbox" name="notify" ${p.id ? "" : "checked"}> ${esc(t("notifyGroup"))}</label>
    <button class="btn primary block">${esc(t("save"))}</button></form>`);
}
const nextSunday = () => { const d = today(); const wd = new Date(d + "T12:00:00+08:00").getDay(); return addDays(d, (7 - wd) % 7); };
A.newUpdate = () => updateForm({});
A.editUpdate = (d) => updateForm(D.updates.find((u) => u.id === d.id));
function updateForm(u) {
  sheet(t(u.id ? "edit" : "newUpdate"), `<form class="form" data-form="update" data-id="${u.id || ""}">
    <label>${esc(t("f_title"))}<input name="title" required value="${esc(u.title || "")}"></label>
    <label>${esc(t("f_body"))}<textarea name="body" rows="8" required>${esc(u.body || "")}</textarea></label>
    <label>${esc(t("f_audience"))}<select name="audience"><option value="all">${esc(t("aud_all"))}</option><option value="elders" ${u.audience === "elders" ? "selected" : ""}>${esc(t("aud_elders"))}</option></select></label>
    <label class="check"><input type="checkbox" name="pinned" ${u.pinned ? "checked" : ""}> ${esc(t("pinTop"))}</label>
    <label class="check"><input type="checkbox" name="notify" ${u.id ? "" : "checked"}> ${esc(t("notifyNow"))}</label>
    <button class="btn primary block">${esc(t("save"))}</button></form>`);
}
A.del = async (d, btn) => {
  if (btn.dataset.sure !== "1") { btn.dataset.sure = "1"; btn.classList.add("sure"); const old = btn.innerHTML; btn.innerHTML = `${ic("trash")} ${esc(t("tapAgain"))}`; setTimeout(() => { if (btn.isConnected) { btn.dataset.sure = ""; btn.classList.remove("sure"); btn.innerHTML = old; } }, 3000); return; }
  try { await api.del(d.kind, d.id); closeSheet(); await refresh(); toast(t("deleted")); if (d.kind === "bread") location.hash = "#/bread"; render(); } catch (e) { toast(errMsg(e), true); }
};
A.openFile = async (d, btn) => {
  await busy(btn, async () => {
    const f = await api.rosterFile(d.id); if (!f || !f.file_b64) return toast(t("err_server"), true);
    const bin = atob(f.file_b64); const u8 = Uint8Array.from(bin, (c) => c.charCodeAt(0)); const blob = new Blob([u8], { type: f.mime || "application/octet-stream" });
    if (/pdf|image/.test(f.mime || "")) window.open(URL.createObjectURL(blob), "_blank"); else download(f.file_name || "roster", blob);
  });
};
A.copyBread = async (d) => { const b = D.bread.find((x) => x.day === d.day); try { await navigator.clipboard.writeText(breadText(b)); toast(t("copied")); } catch { toast(t("err_server"), true); } };
A.genOne = async (d, btn) => {
  const f = btn.closest("form");
  await busy(btn, async () => {
    try { const r = await claudeBread(f.day.value, f.glang.value, D.bread.slice(0, 30).map((b) => b.verse).filter(Boolean)); f.verse.value = r.verse || ""; f.title.value = r.title || ""; f.body.value = r.body || ""; toast(t("genDone")); }
    catch (e) { toast(e.message, true); if (!LS.get("claudeKey")) A.settings(); }
  });
};
A.genWeek = async (d, btn) => {
  if (!LS.get("claudeKey")) { toast(t("needClaudeKey"), true); return A.settings(); }
  await busy(btn, async () => {
    let n = 0; const recent = D.bread.slice(0, 30).map((b) => b.verse).filter(Boolean);
    for (let i = 0; i < 7; i++) {
      const day = addDays(today(), i); if (D.bread.some((b) => b.day === day)) continue;
      try { const r = await claudeBread(day, lang, recent); await api.save("bread", { day, ...r }); recent.unshift(r.verse); n++; } catch (e) { toast(e.message, true); break; }
    }
    await refresh(); toast(t("genWeekDone", n)); render();
  });
};
A.uploadRoster = (d) => {
  const g = G(d.g);
  sheet(t("uploadRoster"), `<form class="form" data-form="roster" data-g="${d.g}">
    <label>${esc(t("f_month"))}<input type="month" name="month" value="${d.m}" required></label>
    <label>${esc(t("f_title"))}<input name="title" value="${esc(`${t("roster")} ${gname(g)} ${monthName(d.m)}`)}"></label>
    <div class="drop"><input type="file" name="file" id="rfile" accept=".docx,.doc,.pdf,.xlsx,.xls,.csv,.ods,image/*"><label for="rfile">${ic("upload")}<b>${esc(t("pickFile"))}</b><small>.docx · .doc · .pdf · .xlsx · .xls · ${esc(t("photo"))}</small></label></div>
    <p class="or"><span>${esc(t("or"))}</span></p>
    <label>${esc(t("f_link"))}<input type="url" name="link" placeholder="https://docs.google.com/spreadsheets/… / https://1drv.ms/…"></label>
    <div id="rprev"></div>
    <label class="check"><input type="checkbox" name="notify" checked> ${esc(t("notifyGroup"))}</label>
    <button class="btn primary block" disabled id="rsave">${esc(t("save"))}</button></form>`, (el) => {
    const f = $("form", el); let parsed = null;
    const show = (res, label) => {
      parsed = res; const tb = (res.tables || [])[0];
      $("#rprev", el).innerHTML = `<div class="card soft"><b>${esc(label)}</b>${res.note ? `<p class="small warn">${esc(t("note_" + res.note))}</p>` : ""}${tb ? `<div class="tbl-wrap"><table class="tbl">${tb.rows.slice(0, 8).map((r, i) => `<tr>${r.slice(0, 8).map((c) => `<${i ? "td" : "th"}>${esc(c)}</${i ? "td" : "th"}>`).join("")}</tr>`).join("")}</table></div><p class="small muted">${esc(t("rowsFound", res.tables.reduce((s, x) => s + x.rows.length, 0)))}</p>` : ""}</div>`;
      $("#rsave", el).disabled = false;
    };
    f.file.addEventListener("change", async () => {
      const file = f.file.files[0]; if (!file) return;
      if (file.size > 4.2e6) { toast(t("err_file_too_big"), true); f.file.value = ""; return; }
      $("#rprev", el).innerHTML = `<p class="small muted"><span class="spin"></span>${esc(t("reading"))}</p>`;
      try { const res = await P.file(file); res.fileObj = file; show(res, file.name); } catch (e) { $("#rprev", el).innerHTML = `<p class="small warn">${esc(t(e.message === "unsupported" ? "err_unsupported" : "err_read"))}</p>`; }
    });
    f.link.addEventListener("change", async () => {
      const u = f.link.value.trim(); if (!/^https:\/\//.test(u)) return;
      $("#rprev", el).innerHTML = `<p class="small muted"><span class="spin"></span>${esc(t("reading"))}</p>`;
      const res = await P.link(u); show(res, u);
    });
    f._parsed = () => parsed;
  });
};
A.newSection = () => sheet(t("addSection"), `<form class="form" data-form="group">
  <label>${esc(t("lang_id"))}<input name="name_id" required placeholder="Paduan Suara"></label>
  <label>${esc(t("lang_bt"))}<input name="name_bt" placeholder="Koor"></label>
  <label>${esc(t("lang_en"))}<input name="name_en" placeholder="Choir"></label>
  <label>${esc(t("f_kind"))}<select name="kind"><option value="service">${esc(t("kindService"))}</option><option value="sermon">${esc(t("kindSermon"))}</option></select></label>
  <label>${esc(t("f_color"))}<input type="color" name="color" value="#475569"></label>
  <label>${esc(t("f_icon"))}<select name="icon">${["star", "note", "mic", "people", "book", "screen", "heart", "spark", "anchor", "shield", "drum", "child"].map((i) => `<option>${i}</option>`).join("")}</select></label>
  <button class="btn primary block">${esc(t("save"))}</button></form>`);
A.password = () => sheet(t("changePw"), `<form class="form" data-form="password">
  <label>${esc(t("f_oldPw"))}<input type="password" name="old" required autocomplete="current-password"></label>
  <label>${esc(t("f_newPw"))}<input type="password" name="pw" required minlength="4" autocomplete="new-password"></label>
  <button class="btn primary block">${esc(t("save"))}</button></form>`);
A.install = () => sheet(t("installTitle"), `<div class="steps"><h4>iPhone</h4><p>${esc(t("installIos"))}</p><h4>Android</h4><p>${esc(t("installAndroid"))}</p><p class="small muted">${esc(t("installWhy"))}</p></div>`);
A.settings = () => {
  const o = LS.get("cfg.override", {}) || {};
  sheet(t("settings"), `<form class="form" data-form="settings">
    <h4>${ic("ai")} Claude</h4><p class="small muted">${esc(t("claudeKeyLead"))}</p>
    <label>${esc(t("f_claudeKey"))}<input type="password" name="claudeKey" value="${esc(LS.get("claudeKey", ""))}" placeholder="sk-ant-…" autocomplete="off"></label>
    ${isAdmin() ? `<h4>${ic("globe")} ${esc(t("connection"))}</h4><p class="small muted">${esc(api.mode === "remote" ? t("modeRemote") : t("modeLocal"))}. ${esc(t("connLead"))}</p>
    <label>Supabase URL<input name="supabaseUrl" value="${esc(o.supabaseUrl || "")}" placeholder="${esc((window.HKBP_CONFIG || {}).supabaseUrl || "https://xxxx.supabase.co")}"></label>
    <label>Supabase anon key<input name="supabaseKey" value="${esc(o.supabaseKey || "")}" placeholder="eyJ…"></label>
    <label>VAPID public key<input name="vapidPublicKey" value="${esc(o.vapidPublicKey || "")}" placeholder="B…"></label>` : ""}
    <button class="btn primary block">${esc(t("save"))}</button></form>`);
};
A.template = () => download("hkbp-members-template.csv", "﻿Name,Nickname,Date of Birth,Phone,Password,Groups,Chair of,Admin,WhatsApp\r\nRina Simanjuntak,Rina,17/05/1998,9123 4567,rina2026,Youth; Band,Youth,No,Yes\r\nSt. Bonar Hutapea,Amang Bonar,02/11/1968,8765 4321,bonar68,Fathers; Elders & Pastor,Fathers,No,Yes\r\n", "text/csv");
A.uploadMembers = () => {
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".xlsx,.xls,.csv,.ods,.docx,.pdf";
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    toast(t("reading"));
    try { const res = await P.file(f); const rows = memberRows(res.tables); membersPreview(rows, f.name); } catch (e) { toast(t("err_read"), true); }
  };
  inp.click();
};
A.editMember = (d) => {
  const p = d.id ? D.people.find((x) => x.id === d.id) : { groups: {} };
  sheet(t(d.id ? "editMember" : "addMember"), `<form class="form" data-form="member" data-id="${p.id || ""}">
    <label>${esc(t("f_name"))}<input name="name" required value="${esc(p.name || "")}"></label>
    <label>${esc(t("f_alias"))}<input name="alias" value="${esc(p.alias || "")}" placeholder="Rina, Kak Rina"></label>
    <label>${esc(t("f_phone"))}<div class="phone-in"><span>+65</span><input name="phone" inputmode="numeric" required value="${esc(p.phone || "")}"></div></label>
    <label>${esc(t("f_dob"))}<input type="date" name="dob" value="${esc(p.dob || "")}"></label>
    <label>${esc(t(d.id ? "f_pwKeep" : "f_password"))}<input name="password" ${d.id ? "" : "required"} autocomplete="off"></label>
    <h4>${esc(t("groupsRoles"))}</h4>
    <div class="roles">${D.groups.map((g) => `<label class="role-row" style="--gc:${g.color}"><span>${ic(g.icon)} ${esc(gname(g))}</span><select name="g_${g.id}"><option value="">—</option><option value="member" ${p.groups[g.id] === "member" ? "selected" : ""}>${esc(t("role_member"))}</option><option value="chair" ${p.groups[g.id] === "chair" ? "selected" : ""}>${esc(t("role_chair"))}</option></select></label>`).join("")}</div>
    <label class="check"><input type="checkbox" name="is_admin" ${p.is_admin ? "checked" : ""}> ${esc(t("isAdmin"))}</label>
    <label class="check"><input type="checkbox" name="wa_optin" ${p.wa_optin ? "checked" : ""}> ${esc(t("waOptin"))}</label>
    <button class="btn primary block">${esc(t("save"))}</button>
    ${d.id && d.id !== me().id ? `<button type="button" class="btn block danger" data-act="del" data-kind="member" data-id="${p.id}">${ic("trash")} ${esc(t("deleteMember"))}</button>` : ""}
  </form>`);
};

// Member list file → rows. Column names are matched loosely (English, Indonesian or Batak headers).
const COLS = [
  ["alias", /nick|panggil|alias|call ?name/i], ["wa_optin", /^(whats ?app|wa)( ?opt.?in| daily ?bread| ?ya\/tidak)?$/i],
  ["phone", /phone|hp|telp|telepon|mobile|handphone|nomor|no\.? ?wa|contact|kontak/i], ["dob", /birth|lahir|dob|tgl|tanggal|ulang/i],
  ["password", /pass|sandi|pin/i], ["chair", /chair|ketua|pangulu|leader/i], ["groups", /group|kategor|seksi|section|pelayanan|ministry|kelompok/i],
  ["is_admin", /admin|maker|pengelola/i], ["name", /name|nama|goar/i],
];
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, mei: 5, jun: 6, jul: 7, aug: 8, agu: 8, agt: 8, sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, des: 12 };
function parseDob(s) {
  s = String(s || "").trim(); if (!s) return null; let y, m, d, x;
  if ((x = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/))) [y, m, d] = [+x[1], +x[2], +x[3]];
  else if ((x = s.match(/^(\d{1,2})[-\/.\s](\d{1,2})[-\/.\s](\d{2,4})$/))) [d, m, y] = [+x[1], +x[2], +x[3]];
  else if ((x = s.match(/^(\d{1,2})[\s-]+([a-z]+)\.?[\s-]+(\d{2,4})$/i)) && MON[x[2].slice(0, 3).toLowerCase()]) [d, m, y] = [+x[1], MON[x[2].slice(0, 3).toLowerCase()], +x[3]];
  else if ((x = s.match(/^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/i)) && MON[x[1].slice(0, 3).toLowerCase()]) [m, d, y] = [MON[x[1].slice(0, 3).toLowerCase()], +x[2], +x[3]];
  else if (/^\d{5}$/.test(s)) { const dt = new Date(Date.UTC(1899, 11, 30) + +s * 864e5); return dt.toISOString().slice(0, 10); }
  else return null;
  if (y < 100) y += y > 30 ? 1900 : 2000;
  if (m > 12 && d <= 12) [m, d] = [d, m];
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
const yes = (v) => /^(y|yes|ya|iya|olo|1|true|x|✓|v)$/i.test(String(v || "").trim());
function matchGroup(tok) {
  const n = norm(tok).replace(/\b(chair|ketua|member|anggota)\b/g, "").trim(); if (!n) return null;
  return D.groups.find((g) => [g.id, g.name_id, g.name_bt, g.name_en].some((x) => { const v = norm(x); return v && (v === n || v.startsWith(n) || n.startsWith(v) || v.split(" ").includes(n) || v.replace(/[()]/g, "").includes(n)); })) || null;
}
function memberRows(tables) {
  for (const tb of tables) {
    const hi = tb.rows.findIndex((r) => r.some((c) => /name|nama|goar/i.test(c)) && r.some((c) => COLS[2][1].test(c)));
    if (hi < 0) continue;
    const head = tb.rows[hi]; const idx = {};
    head.forEach((h, j) => { const c = COLS.find(([k, re]) => !(k in idx) && re.test(String(h).trim())); if (c) idx[c[0]] = j; });
    return tb.rows.slice(hi + 1).map((r) => {
      const get = (k) => (k in idx ? String(r[idx[k]] || "").trim() : "");
      const groups = {}; const unknown = [];
      get("groups").split(/[;,\/\n]+/).forEach((tok) => { if (!tok.trim()) return; const g = matchGroup(tok); if (g) groups[g.id] = /chair|ketua/i.test(tok) ? "chair" : groups[g.id] || "member"; else unknown.push(tok.trim()); });
      get("chair").split(/[;,\/\n]+/).forEach((tok) => { if (!tok.trim() || /^(no|tidak|-)$/i.test(tok.trim())) return; const g = matchGroup(tok); if (g) groups[g.id] = "chair"; else unknown.push(tok.trim()); });
      const rawDob = get("dob"); const dob = parseDob(rawDob);
      const row = { name: get("name"), alias: get("alias"), phone: S.phone8(get("phone")), dob, password: get("password"), groups, is_admin: yes(get("is_admin")), wa_optin: yes(get("wa_optin")) };
      row.problems = [!row.name && t("p_name"), !validPhone(row.phone) && t("p_phone"), rawDob && !dob && t("p_dob"), unknown.length && t("p_group", unknown.join(", "))].filter(Boolean);
      return row;
    }).filter((r) => r.name || r.phone);
  }
  return [];
}
function membersPreview(rows, fname) {
  if (!rows.length) { toast(t("noMemberCols"), true); return; }
  const good = rows.filter((r) => r.name && validPhone(r.phone));
  sheet(t("memberUpload"), `<p class="small muted">${esc(fname)} · ${esc(t("rowsFound", rows.length))}</p>
    <div class="tbl-wrap"><table class="tbl"><tr><th>${esc(t("f_name"))}</th><th>${esc(t("f_phone"))}</th><th>${esc(t("f_dob"))}</th><th>${esc(t("f_password"))}</th><th>${esc(t("groupsRoles"))}</th><th></th></tr>
    ${rows.map((r) => `<tr class="${r.problems.length ? "bad" : ""}"><td>${esc(r.name)}${r.alias ? `<br><small>${esc(r.alias)}</small>` : ""}${r.is_admin ? ` <span class="badge admin">${esc(t("role_admin"))}</span>` : ""}</td><td>${esc(fmtPhone(r.phone))}</td><td>${esc(r.dob || "")}</td><td>${r.password ? "••••" : `<small>${esc(t("keep"))}</small>`}</td><td>${esc(Object.entries(r.groups).map(([g, x]) => gname(G(g)) + (x === "chair" ? " ★" : "")).join(", "))}</td><td><small class="warn">${esc(r.problems.join("; "))}</small></td></tr>`).join("")}</table></div>
    <p class="small muted">${esc(t("uploadNote"))}</p>
    <button class="btn primary block" data-act="saveMembers" ${good.length ? "" : "disabled"}>${esc(t("saveMembers", good.length))}</button>`, () => { A.saveMembers._rows = good; });
}
A.saveMembers = async (d, btn) => {
  await busy(btn, async () => {
    try { const n = await api.membersUpsert(A.saveMembers._rows.map(({ problems, ...r }) => r)); closeSheet(); await refresh(); toast(t("membersSaved", n)); render(); } catch (e) { toast(errMsg(e), true); }
  });
};

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]"); if (!b) { if (e.target.id === "sheet") closeSheet(); return; }
  const fn = A[b.dataset.act]; if (!fn) return;
  e.preventDefault(); Promise.resolve(fn(b.dataset, b)).catch((err) => toast(errMsg(err), true));
});
document.addEventListener("input", (e) => {
  const f = e.target.closest("[data-filter]"); if (!f) return;
  const q = norm(f.value); document.querySelectorAll(f.dataset.filter).forEach((el) => (el.hidden = q && !el.dataset.q.includes(q)));
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#sheet").hidden) closeSheet(); });

// ---------- forms ----------
const F = {};
F.login = async (f) => { await api.login(f.phone.value, f.pw.value); D = null; await refresh(); location.hash = "#/home"; localReminders(); };
F.setup = async (f) => { if (!validPhone(f.phone.value)) throw new S.AppError("bad_phone"); await api.setupAdmin(f.name.value.trim(), f.phone.value, f.pw.value); await api.login(f.phone.value, f.pw.value); D = null; await refresh(); location.hash = "#/people"; };
F.bread = async (f) => { await api.save("bread", { day: f.day.value, verse: f.verse.value.trim(), title: f.title.value.trim(), body: f.body.value.trim() }); await refresh(); toast(t("saved")); location.hash = "#/bread/" + f.day.value; };
F.post = async (f) => {
  const d = f.dataset;
  await api.save("post", { id: d.id || undefined, group_id: d.g, kind: d.kind, title: f.title.value.trim(), body: f.body.value.trim(), verse: f.verse ? f.verse.value.trim() : null, day: f.day ? f.day.value : null, notify: f.notify.checked });
  closeSheet(); await refresh(); toast(t(f.notify.checked && api.mode === "remote" ? "savedSent" : "saved"));
};
F.update = async (f) => { await api.save("update", { id: f.dataset.id || undefined, title: f.title.value.trim(), body: f.body.value.trim(), audience: f.audience.value, pinned: f.pinned.checked, notify: f.notify.checked }); closeSheet(); await refresh(); toast(t(f.notify.checked && api.mode === "remote" ? "savedSent" : "saved")); };
F.event = async (f) => {
  const st = new Date(`${f.date.value}T${f.time.value}:00+08:00`).toISOString();
  const en = f.end.value ? new Date(`${f.date.value}T${f.end.value}:00+08:00`).toISOString() : null;
  await api.save("event", { id: f.dataset.id || undefined, group_id: f.group_id.value || null, title: f.title.value.trim(), starts_at: st, ends_at: en, place: f.place.value.trim(), notes: f.notes.value.trim(), remind_min: +f.remind_min.value });
  closeSheet(); await refresh(); toast(t("saved"));
};
F.roster = async (f) => {
  const res = f._parsed && f._parsed(); if (!res) return;
  const file = res.fileObj;
  const row = { group_id: f.dataset.g, month: f.month.value, title: f.title.value.trim(), link: f.link.value.trim() || null, table_json: res.tables || [], text_content: (res.text || "").slice(0, 60000), notify: f.notify.checked };
  if (file) Object.assign(row, { file_name: file.name, mime: file.type || "application/octet-stream", file_b64: await P.toB64(file) });
  await api.save("roster", row); closeSheet(); LS.set("ym." + f.dataset.g, f.month.value); await refresh(); toast(t("saved"));
  location.hash = `#/s/${f.dataset.g}?m=${f.month.value}`;
};
F.group = async (f) => {
  const id = norm(f.name_en.value || f.name_id.value).replace(/ /g, "-").slice(0, 30) || "group-" + Date.now();
  await api.save("group", { id, kind: f.kind.value, name_id: f.name_id.value.trim(), name_bt: f.name_bt.value.trim() || f.name_id.value.trim(), name_en: f.name_en.value.trim() || f.name_id.value.trim(), color: f.color.value, icon: f.icon.value, sort: 50 });
  closeSheet(); await refresh(); toast(t("saved"));
};
F.password = async (f) => { await api.setPassword(f.old.value, f.pw.value); closeSheet(); toast(t("saved")); };
F.settings = async (f) => {
  LS.set("claudeKey", f.claudeKey.value.trim());
  if (f.supabaseUrl) {
    const o = { supabaseUrl: f.supabaseUrl.value.trim(), supabaseKey: f.supabaseKey.value.trim(), vapidPublicKey: f.vapidPublicKey.value.trim() };
    const before = api.mode; LS.set("cfg.override", o); api = S.pick();
    if (api.mode !== before) { D = null; closeSheet(); toast(t("saved")); location.hash = "#/login"; return; }
  }
  closeSheet(); toast(t("saved"));
};
F.member = async (f) => {
  if (!validPhone(f.phone.value)) throw new S.AppError("bad_phone");
  const groups = {}; D.groups.forEach((g) => { const v = f["g_" + g.id].value; if (v) groups[g.id] = v; });
  await api.membersUpsert([{ name: f.name.value.trim(), alias: f.alias.value.trim(), phone: f.phone.value, dob: f.dob.value || null, password: f.password.value, groups, is_admin: f.is_admin.checked, wa_optin: f.wa_optin.checked }]);
  closeSheet(); await refresh(); toast(t("saved"));
};
document.addEventListener("submit", async (e) => {
  const f = e.target.closest("[data-form]"); if (!f) return; e.preventDefault();
  const btn = f.querySelector("button:not([type=button])");
  await busy(btn, async () => { try { await F[f.dataset.form](f); render(); } catch (err) { console.error(err); toast(errMsg(err), true); } });
});

// ---------- demo data (this phone only) ----------
async function seedDemo() {
  const day = today(); const ym = monthKey(day); const md = (n) => addDays(day, n).slice(5);
  await api.setupAdmin("Demo Admin", "80000001", "demo");
  await api.login("80000001", "demo");
  const people = [
    { name: "Pdt. Jonathan Sitompul", alias: "Amang Pandita", phone: "80000002", dob: "1975-" + md(3), password: "demo", groups: { parhalado: "chair", ama: "member" } },
    { name: "St. Bonar Hutapea", alias: "Amang Bonar", phone: "80000003", dob: "1968-" + md(0), password: "demo", groups: { parhalado: "member", ama: "chair", "song-leader": "member" } },
    { name: "Ruth Sinaga", alias: "Inang Ruth", phone: "80000004", dob: "1980-" + md(12), password: "demo", groups: { ina: "chair", "song-leader": "chair" } },
    { name: "Rina Simanjuntak", alias: "Rina", phone: "80000005", dob: "1999-" + md(5), password: "demo", groups: { naposo: "chair", band: "member", multimedia: "member" } },
    { name: "Josua Pardede", alias: "Josua", phone: "80000006", dob: "2001-" + md(20), password: "demo", groups: { naposo: "member", multimedia: "chair", band: "chair" } },
    { name: "Grace Tobing", alias: "Grace", phone: "80000007", dob: "1995-" + md(40), password: "demo", groups: { "sekolah-minggu": "chair", musik: "member" } },
    { name: "Daniel Lumbantoruan", alias: "Daniel", phone: "80000008", dob: "1988-" + md(9), password: "demo", groups: { pelaut: "chair", musik: "chair", jemaat: "member" } },
    { name: "Maria Nainggolan", alias: "Maria", phone: "80000009", dob: "1990-" + md(1), password: "demo", groups: { jemaat: "chair", ina: "member" } },
  ];
  await api.membersUpsert([{ name: "Demo Admin", phone: "80000001", dob: "1985-" + md(15), groups: { parhalado: "chair", ama: "member" }, is_admin: true }, ...people]);
  const sun = nextSunday();
  const posts = [
    ["sekolah-minggu", "sermon", "Yesus Sahabat Anak-anak", "Markus 10:13-16", "Pembukaan: lagu \"Yesus Sayang Semua\".\nCerita: anak-anak dibawa kepada Yesus.\nKegiatan: menggambar tangan Yesus dan menulis nama sendiri di dalamnya.\nDoa penutup bersama."],
    ["naposo", "sermon", "Muda dan Berani", "1 Timotius 4:12", "Ice breaker 10 menit, PA kelompok kecil:\n1. Apa artinya menjadi teladan?\n2. Di mana kamu sulit menjadi teladan minggu ini?\nAksi: satu pesan semangat untuk teman."],
    ["naposo", "news", "Latihan koor Natal", null, "Latihan koor Naposo setiap Sabtu jam 16:00 mulai bulan depan. Ajak teman!"],
    ["ina", "sermon", "Perempuan yang Takut akan Tuhan", "Amsal 31:25-31", "Bahan PA Ina: kekuatan dan kemuliaan adalah pakaiannya. Diskusi: bagaimana iman tampak di rumah kita?"],
    ["ama", "sermon", "Aku dan Seisi Rumahku", "Yosua 24:14-15", "Partangiangan Ama: memimpin keluarga dengan doa. Tugas minggu ini: doa makan malam dipimpin Bapak."],
    ["pelaut", "sermon", "Tuhan Meredakan Badai", "Markus 4:35-41", "Renungan untuk saudara pelaut dan pekerja: Yesus ada di perahu yang sama. Kontak doa: grup WhatsApp Pelaut."],
  ];
  for (const [g, kind, title, verse, body] of posts) await api.save("post", { group_id: g, kind, title, verse, body, day: kind === "sermon" ? sun : null });
  await api.save("bread", { day, verse: "Mazmur 46:2", title: "Tempat Perlindungan", body: "Allah itu bagi kita tempat perlindungan dan kekuatan, sebagai penolong dalam kesesakan sangat terbukti.\n\nDi tengah kesibukan Singapura, kita mudah merasa sendirian. Tetapi Tuhan tidak jauh. Hari ini, sebelum membuka HP di pagi hari, ambil satu menit untuk diam dan berkata: \"Tuhan, Engkau perlindunganku.\"\n\nDoa: Tuhan Yesus, jadilah kekuatanku hari ini. Amin." });
  await api.save("bread", { day: addDays(day, -1), verse: "Yohanes 15:5", title: "Tinggal di dalam Dia", body: "Akulah pokok anggur dan kamulah ranting-rantingnya...\n\nRanting tidak berbuah karena berusaha keras, tetapi karena tetap melekat. Hari ini, tetaplah melekat pada Yesus lewat doa singkat di sela pekerjaan.\n\nDoa: Tuhan, biarlah aku tinggal di dalam-Mu. Amin." });
  await api.save("update", { title: "Rapat Parhalado bulan ini", body: "Rapat Parhalado diadakan Sabtu depan jam 19:00 di gereja. Agenda: persiapan Natal dan Tahun Baru, laporan keuangan, jadwal perjamuan kudus.", audience: "elders", pinned: true });
  await api.save("update", { title: "Ibadah Perjamuan Kudus", body: "Jemaat yang terkasih, Perjamuan Kudus akan dilayankan pada ibadah Minggu pertama bulan depan. Mohon mempersiapkan diri.", audience: "all" });
  const ev = (n, h, title, g, place, rem) => api.save("event", { title, group_id: g, starts_at: new Date(`${addDays(day, n)}T${h}:00+08:00`).toISOString(), place, remind_min: rem, notes: "" });
  await ev((7 - new Date(day + "T12:00:00+08:00").getDay()) % 7 || 7, "10:00", "Ibadah Minggu", null, "HKBP Singapore", 1440);
  await ev(3, "19:30", "Latihan Band", "band", "Ruang musik", 180);
  await ev(10, "16:00", "Partangiangan Naposo", "naposo", "Rumah keluarga Pardede", 1440);
  await ev(18, "09:00", "Retreat Sekolah Minggu", "sekolah-minggu", "Pasir Ris", 2880);
  const sundays = []; for (let i = 0; i < 40 && sundays.length < 5; i++) { const d = `${ym}-${String(i + 1).padStart(2, "0")}`; if (d.slice(0, 7) !== ym) break; if (new Date(d + "T12:00:00+08:00").getDay() === 0) sundays.push(d); }
  const nm = (d) => fmt(d, { day: "numeric", month: "short" });
  await api.save("roster", { group_id: "multimedia", month: ym, title: `Roster Multimedia ${monthName(ym)}`, file_name: "roster-multimedia.xlsx", mime: "", table_json: [{ name: "Sheet1", rows: [["Tanggal", "Operator Slide", "Live Stream", "Sound"], ...sundays.map((d, i) => [nm(d), ["Rina", "Josua", "Rina", "Josua", "Rina"][i], ["Josua", "Daniel", "Josua", "Rina", "Daniel"][i], ["Daniel", "Rina", "Daniel", "Daniel", "Josua"][i]])] }] });
  await api.save("roster", { group_id: "song-leader", month: ym, title: `Song Leader ${monthName(ym)}`, file_name: "song-leader.docx", mime: "", table_json: [{ name: "Table 1", rows: [["Minggu", "Song Leader", "Pemandu Koor"], ...sundays.map((d, i) => [nm(d), ["Inang Ruth", "Amang Bonar", "Inang Ruth", "Amang Bonar", "Inang Ruth"][i], ["Grace", "Maria", "Grace", "Maria", "Grace"][i]])] }] });
  D = null; await refresh();
}

// ---------- start ----------
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
navigator.serviceWorker && navigator.serviceWorker.addEventListener("message", (e) => { if (e.data && e.data.url) location.hash = e.data.url; });
const qs = new URLSearchParams(location.search);
(async () => {
  if (qs.get("demo") === "1" && api.mode === "local" && await api.needsSetup()) { await seedDemo(); }
  await render(); localReminders();
})();
document.addEventListener("visibilitychange", async () => { if (document.visibilityState === "visible" && D && api.hasSession()) { try { await refresh(); if (!$("#sheet").classList.contains("open")) render(); localReminders(); } catch {} } });
})();
