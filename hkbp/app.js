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
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  coins: '<ellipse cx="9" cy="6" rx="6" ry="2.5"/><path d="M3 6v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V6"/><path d="M3 10v4c0 1.4 2.7 2.5 6 2.5"/><ellipse cx="15" cy="14" rx="6" ry="2.5"/><path d="M9 14v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4"/>',
  gavel: '<path d="M14 4l6 6M11 7l6 6M12.5 5.5l-5 5 4 4 5-5zM9.5 12.5L3 19l2 2 6.5-6.5M13 21h8"/>',
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
// Two layouts: "admin" (chairs, elders and admins maintain content) and "member" (congregation sees the results).
// The choice only hides or shows tools; what a person may change is still decided by their real role on the server.
const viewMode = () => LS.get("view", null);
const hasRights = () => !!(D && (D.me.is_admin || "parhalado" in (D.me.groups || {}) || Object.values(D.me.groups || {}).some((r) => ["chair", "maker", "tmaker", "teacher"].includes(r))));
// Multimedia: only people on the maker list (or its chair) may open the Tata Ibadah workbench; checkers and everyone else read.
const isMMMaker = () => !!(D && ["maker", "chair"].includes((D.me.groups || {}).multimedia));
const mmRole = () => { try { return sessionStorage.getItem("hkbp.mm") || ""; } catch { return ""; } };
const setMMRole = (v) => { try { v ? sessionStorage.setItem("hkbp.mm", v) : sessionStorage.removeItem("hkbp.mm"); } catch {} };
const manage = () => viewMode() === "admin" && hasRights();
const isAdmin = () => !!(D && D.me.is_admin) && manage();
const isElder = () => manage() && (D.me.is_admin || "parhalado" in (D.me.groups || {}));
const roleIn = (gid) => (D.me.groups || {})[gid] || null;
// Youth and Sunday School are run by teachers: only a Teacher Maker (phone checked once per session) posts materials, news, events and polls.
// A Teacher reads everything and starts or ends polls in class. Other categories: the chair (and the admin) post.
const TEACH = S.TEACH || ["naposo", "sekolah-minggu"];
const isTeachG = (gid) => TEACH.includes(gid);
const isTMaker = (gid) => !!D && (D.me.is_admin || roleIn(gid) === "tmaker");
const isTeacherIn = (gid) => !!D && (D.me.is_admin || ["tmaker", "teacher"].includes(roleIn(gid)));
// Teacher Makers confirm their phone number every time they open Youth or Sunday School; leaving the class forgets it.
let tmPass = null;
const tmOk = (gid) => !!D && !!tmPass && tmPass.phone === D.me.phone && (!gid || tmPass.g === gid);
const setTmOk = (g) => { tmPass = g ? { g, phone: D.me.phone } : null; };
window.addEventListener("hashchange", () => { try { wAutoFlush(false); draftFlush(); } catch (e) { console.warn(e); } });
window.addEventListener("hashchange", () => { const g = (location.hash.match(/^#\/g\/([\w-]+)/) || [])[1]; if (tmPass && g !== tmPass.g) tmPass = null; if (g !== hydrate.tmAsked) hydrate.tmAsked = null; });
const canEdit = (gid) => manage() && (isTeachG(gid) ? isTMaker(gid) && tmOk(gid) : D.me.is_admin || roleIn(gid) === "chair");
const canRunPoll = (gid) => manage() && isTeacherIn(gid);
const canSee = (g) => (g.kind === "office" ? isOffice() : g.kind === "service" || isElder() || !!roleIn(g.id));
// First-login profile (YB 2026-10-24): four questions pick which categories the member sees.
// Everyone gets it except YB (super admin, sees everything). Categories a member leads (chair, teacher...) always show.
const PROFILE_SKIP = ["85334780"];
const profileOn = () => !!D && !isGuest() && !!me() && !PROFILE_SKIP.includes(S.phone8(me().phone));
function profileCats(p) {
  if (!p) return null;
  if (p.confirmed === false) return ["remaja"];
  const c = [p.married ? (p.male ? "ama" : "ina") : "naposo"];
  if (p.pelaut) c.push("pelaut");
  if (p.married) c.push("sekolah-minggu"); // parents see Sunday School too (YB)
  return c;
}
// Second pop-up (YB 2026-10-24): pick the service sections you serve in; Jadwal then shows only those. Pilot: YB only.
const SERVE_PILOT = ["85334780"];
const serveOn = () => !!D && !isGuest() && !!me() && SERVE_PILOT.includes(S.phone8(me().phone));
const serveShown = (g) => { if (g.kind !== "service" || !serveOn() || LS.get("allServe")) return true; const sv = (me().profile || {}).serve; return !sv || !sv.length || sv.includes(g.id); };
const catShown = (g) => { if (g.kind !== "sermon" || !profileOn() || isAdmin() && LS.get("allCats")) return true; const r = roleIn(g.id); if (r && r !== "member") return true; const c = profileCats(me().profile); return !c || c.includes(g.id); };
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
  if (typeof draftRestore === "function") draftRestore(el);
}
// First sign-in: the member has no password yet, so a pop-up asks them to create one.
function firstPwSheet(phone) {
  sheet(t("firstPwTitle"), `<form class="form" data-form="firstpw" data-phone="${esc(S.phone8(phone))}">
    <p class="muted">${esc(t("firstPwLead"))}</p>
    <label>${esc(t("f_newPw"))}<input type="password" name="pw" required minlength="6" autocomplete="new-password"></label>
    <label>${esc(t("f_pw2"))}<input type="password" name="pw2" required minlength="6" autocomplete="new-password"></label>
    <button class="btn primary block">${ic("lock")} ${esc(t("firstPwBtn"))}</button></form>`, (el) => el.querySelector("input").focus());
}
function closeSheet() { const el = $("#sheet"); el.classList.remove("open"); document.body.classList.remove("noscroll"); setTimeout(() => { el.hidden = true; el.innerHTML = ""; }, 180); }
async function busy(btn, fn) { if (btn) { btn.disabled = true; btn.dataset.label = btn.innerHTML; btn.innerHTML = `<span class="spin"></span>${esc(t("working"))}`; } try { return await fn(); } finally { if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = btn.dataset.label; } } }

// ---------- sharing / calendar ----------
const wa = (text, phone) => `https://wa.me/${phone ? "65" + S.phone8(phone) : ""}?text=${encodeURIComponent(text)}`;
function breadText(b) { return `📖 *${t("breadTitle")} · HKBP Singapore*\n${fmtDay(b.day)}\n\n*${b.title || ""}*\n${b.verse || ""}\n\n${b.body || ""}\n\n${appUrl()}#/bread/${b.day}`; }
function ics(events) {
  const z = (d) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const c = (s) => String(s || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Sada HKBPS//App//EN", "CALSCALE:GREGORIAN"];
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
function icsBirthdays(list) {
  const c = (s) => String(s || "").replace(/([,;\\])/g, "\\$1"); const y = +today().slice(0, 4); const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Sada HKBPS//App//EN", "CALSCALE:GREGORIAN"];
  list.forEach((b) => {
    const md = b.bday === "02-29" ? "02-28" : b.bday; const d = `${y}${md.replace("-", "")}`;
    lines.push("BEGIN:VEVENT", `UID:bday-${norm(b.name).replace(/ /g, "-")}-${b.bday}@hkbp-singapore`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d}`, "RRULE:FREQ=YEARLY", `SUMMARY:${c("🎂 " + b.name)}`, "TRANSP:TRANSPARENT", "END:VEVENT");
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
// Members' birthdays plus the imported birthday list (people not in the member list), without doubles.
function allBdays() {
  const seen = new Set(); const out = [];
  D.people.filter((p) => p.bday).forEach((p) => { seen.add(norm(p.name) + p.bday); out.push({ ...p, kind: "member" }); });
  (D.birthdays || []).forEach((b) => { if (!seen.has(norm(b.name) + b.bday)) out.push({ ...b, kind: "list" }); });
  return out;
}
function birthdaysBetween(fromIso, days) {
  const out = []; const all = allBdays();
  for (let i = 0; i <= days; i++) { const d = addDays(fromIso, i); const md = d.slice(5); all.filter((p) => p.bday === md).forEach((p) => out.push({ p, day: d, inDays: i })); }
  return out;
}

// ---------- notifications ----------
async function swReg() { if (!("serviceWorker" in navigator)) return null; try { return await navigator.serviceWorker.ready; } catch { return null; } }
function b64urlToU8(s) { const p = "=".repeat((4 - (s.length % 4)) % 4); const b = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(b, (c) => c.charCodeAt(0)); }
const vapid = () => (D && D.settings && D.settings.vapid_public) || (api.cfg && api.cfg.vapidPublicKey) || "";
async function enableNotifications(btn) {
  if (!("Notification" in window)) { toast(/iP(hone|ad)/.test(navigator.userAgent) && !standalone() ? t("iosInstallFirst") : t("noNotify"), true); return; }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") { toast(t("notifyDenied"), true); return; }
  const reg = await swReg();
  if (!(await ensurePush(reg)) && api.mode === "remote" && !isGuest()) toast(t("pushFailed"), true);
  LS.set("notifyOn", true);
  if (reg) reg.showNotification("Sada HKBPS", { body: t("notifyOk"), icon: "icon-192.png", badge: "icon-192.png", tag: "hkbp-test" });
  render();
}
// Notifications stay on: once the phone has allowed them, every open and every sign-in quietly renews this phone's
// push sign-up for the signed-in member (new sign-in, new server key, or a sign-up the phone dropped).
async function ensurePush(reg) {
  if (!("Notification" in window) || Notification.permission !== "granted") return false;
  LS.set("notifyOn", true);
  reg = reg || await swReg();
  if (!(api.mode === "remote" && vapid() && reg && reg.pushManager && !isGuest())) return true;
  try {
    let sub = await reg.pushManager.getSubscription();
    // Re-subscribe if the phone is still registered with an older server key.
    if (sub && sub.options && sub.options.applicationServerKey && btoa(String.fromCharCode(...new Uint8Array(sub.options.applicationServerKey))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") !== vapid()) { await sub.unsubscribe(); sub = null; }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlToU8(vapid()) });
    const key = D.me.id + "|" + sub.endpoint;
    if (LS.get("pushKey") !== key || !LS.get("pushOn")) { await api.pushSave(sub.toJSON()); LS.set("pushKey", key); LS.set("pushOn", true); }
    return true;
  } catch (e) { console.warn(e); return false; }
}
// Without the server job (demo mode, or before push is set up) the app shows today's reminders when it is opened.
async function localReminders() {
  if (D && !isGuest()) await ensurePush();
  if (!D || !LS.get("notifyOn") || !("Notification" in window) || Notification.permission !== "granted") return;
  if (api.mode === "remote" && LS.get("pushOn") && vapid()) return; // the server sends these
  const reg = await swReg(); if (!reg) return;
  const shown = LS.get("shown", {}); const day = today(); const once = (k) => { if (shown[k]) return false; shown[k] = day; return true; };
  const b = D.bread.find((x) => x.day === day);
  if (b && once("bread:" + day)) reg.showNotification(`📖 ${t("breadTitle")}: ${b.title || ""}`, { body: `${b.verse || ""}\n${(b.body || "").slice(0, 140)}`, icon: "icon-192.png", tag: "bread", data: { url: "#/bread" } });
  if (me().dob && me().dob.slice(5) === day.slice(5) && once("bday:" + day)) reg.showNotification(t("hbdTitle", firstName(me().name)), { body: t("hbdBody"), icon: "icon-192.png", tag: "bday" });
  if (me().wed && me().wed.slice(5) === day.slice(5) && once("anniv:" + day)) reg.showNotification(t("annivTitle", firstName(me().name)), { body: t("annivBody"), icon: "icon-192.png", tag: "anniv" });
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
// Without a sign-in the app shows the public parts (daily bread, church updates and events, Tata Ibadah, service rosters).
// Categories and the office ask for phone number and password when opened.
const GUEST = () => ({ id: null, name: "", alias: null, phone: null, dob: null, is_admin: false, groups: {}, wa_optin: false });
async function refresh() {
  D = await api.data();
  if (D && !D.me) { D.me = GUEST(); D.guest = true; }
}
const isGuest = () => !D || !!D.guest;
// Go to sign-in, and come back to the same page afterwards.
let A_signIn = () => { LS.set("afterLogin", location.hash && !/^#\/login/.test(location.hash) ? location.hash : "#/home"); closeSheet(); location.hash = "#/login"; };
const backAfterLogin = () => { const h = LS.get("afterLogin", "#/home") || "#/home"; LS.set("afterLogin", null); location.hash = h; };
const signInCard = (msg) => `<div class="card center pad sign-in-card">${ic("lock")}<p>${esc(msg)}</p><button class="btn primary" data-act="signIn">${ic("lock")} ${esc(t("signIn"))}</button></div>`;

// ---------- layout ----------
const TABS = [["home", "#/home", "tab_home"], ["groups", "#/groups", "tab_groups"], ["roster", "#/serve", "tab_serve"], ["calendar", "#/calendar", "tab_calendar"], ["more", "#/more", "tab_more"]];
function shell(active, inner, opts = {}) {
  const nav = TABS.map(([i, h, k]) => `<a href="${h}" class="${active === h ? "on" : ""}" ${active === h ? 'aria-current="page"' : ""}>${ic(i)}<span>${esc(t(k))}</span></a>`).join("");
  return `
  <header class="top">
    ${opts.back ? `<a class="icon-btn" href="${opts.back}" aria-label="${esc(t("back"))}">${ic("back")}</a>` : `<img class="logo-sm" src="logo.png" alt="">`}
    <div class="brand"><b>${esc(opts.title || "Sada HKBPS")}</b>${opts.sub ? `<small>${esc(opts.sub)}</small>` : `<small>${esc(t("tagline"))}</small>`}</div>
    ${langSwitch()}
  </header>
  ${D && D.offline ? `<div class="banner">${esc(t("offline"))}</div>` : ""}
  ${api.mode === "local" ? `<div class="banner soft">${ic("phone")} ${esc(t("demoBanner"))}</div>` : ""}
  <main${opts.cols ? ' class="cols"' : ""}>${inner}</main>
  <nav class="tabs"><div class="in">${nav}</div></nav>`;
}
const langSwitch = () => `<div class="langs" role="group" aria-label="${esc(t("language"))}">${["id", "bt", "en"].map((l) => `<button data-act="lang" data-l="${l}" aria-pressed="${lang === l}">${l.toUpperCase()}</button>`).join("")}</div>`;
const empty = (msg, icon = "star") => `<div class="empty">${ic(icon)}<p>${esc(msg)}</p></div>`;
const roleBadge = (gid) => { const r = isAdmin() && !roleIn(gid) ? "admin" : roleIn(gid); return r ? `<span class="badge ${r === "tmaker" ? "chair" : r === "teacher" ? "member" : r}">${esc(t("role_" + r))}</span>` : ""; };
const groupTile = (g, extra = "") => `<a class="gtile" href="#/${({ sermon: "g", office: "o" })[g.kind] || "s"}/${g.id}" style="--gc:${g.color}">
    <span class="gicon">${ic(g.icon)}</span><span class="gname"><b>${esc(gname(g))}</b><small>${extra}</small></span>${roleBadge(g.id)}${ic("chev", "chev")}</a>`;

// ---------- screens ----------
const R = {};

R.login = async () => {
  const setup = await api.needsSetup();
  const demo = api.mode === "local";
  view().innerHTML = `<div class="login">
    <div class="login-top">${!setup ? `<a class="btn sm ghost" href="${esc(LS.get("afterLogin", "#/home") || "#/home")}">${ic("back")} ${esc(t("back"))}</a>` : ""}${langSwitch()}</div>
    <img class="logo-xl" src="logo.png" alt="HKBP">
    <h1>Sada HKBPS</h1>
    <p class="muted">${esc(t(setup ? "loginLead" : "loginLeadCat"))}</p>
    ${setup ? `
      <form class="card form" data-form="setup">
        <h3>${esc(t("setupTitle"))}</h3>
        <p class="small muted">${esc(t("setupLead"))}</p>
        <label>${esc(t("f_name"))}<input name="name" required autocomplete="name"></label>
        <label>${esc(t("f_phone"))}<div class="phone-in"><span>+65</span><input name="phone" inputmode="numeric" required placeholder="8123 4567"></div></label>
        <label>${esc(t("f_password"))}<input name="pw" type="password" required minlength="6" autocomplete="new-password"></label>
        <button class="btn primary block">${esc(t("setupBtn"))}</button>
      </form>
      <button class="btn block ghost" data-act="seedDemo">${ic("spark")} ${esc(t("demoBtn"))}</button>` : `
      <form class="card form" data-form="login">
        <label>${esc(t("f_phone"))}<div class="phone-in"><span>+65</span><input name="phone" inputmode="numeric" required placeholder="8123 4567" autocomplete="username"></div></label>
        <label>${esc(t("f_password"))}<input name="pw" type="password" autocomplete="current-password"></label>
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
  const bn = beritaLatest();
  const myGroups = D.groups.filter((g) => roleIn(g.id) && g.kind !== "office" && catShown(g));
  const hour = +new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "numeric", hour12: false }).format(new Date());
  const annivToday = isGuest() ? [] : D.people.filter((p) => p.anniv && p.anniv === day.slice(5));
  const notifyAsk = "Notification" in window ? Notification.permission === "default" || !LS.get("notifyOn") : /iP(hone|ad)/.test(navigator.userAgent) && !standalone();
  return shell("#/home", `
    <section class="hello">
      <p class="muted small">${esc(fmtDay(day))}</p>
      <h1>${esc(t(hour < 11 ? "morning" : hour < 15 ? "afternoon" : hour < 18 ? "evening1" : "evening2"))}${m.name ? ", " + esc(firstName(m.name)) : ""}</h1>
    </section>
    ${isGuest() ? `<button class="card notify-ask" data-act="signIn">${ic("lock")}<span><b>${esc(t("guestTitle"))}</b><small>${esc(t("guestBody"))}</small></span>${ic("chev", "chev")}</button>` : ""}
    ${mine ? `<div class="card hbd">${ic("cake")}<div><h2>${esc(t("hbdTitle", firstName(m.name)))}</h2><p>${esc(t("hbdBody"))}</p></div></div>` : ""}
    ${m.wed && m.wed.slice(5) === day.slice(5) ? `<div class="card hbd">💍<div><h2>${esc(t("annivTitle", firstName(m.name)))}</h2><p>${esc(t("annivBody"))}</p></div></div>` : ""}
    ${annivToday.length ? `<article class="card"><div class="card-h"><h3>💍 ${esc(t("annivs"))}</h3></div>${annivToday.map((p) => `<div class="li"><span class="avatar">${esc(initials(p.name))}</span><span class="grow"><b>${esc(p.name)}</b><small>${esc(t("today"))}</small></span>${p.phone && p.id !== m.id ? `<a class="icon-btn wa" href="${wa(t("annivWish", firstName(p.name)), p.phone)}" target="_blank" rel="noopener" aria-label="WhatsApp">${ic("wa")}</a>` : `<span class="party">🎉</span>`}</div>`).join("")}</article>` : ""}
    ${notifyAsk ? `<button class="card notify-ask" data-act="notify">${ic("bell")}<span><b>${esc(t("notifyAskTitle"))}</b><small>${esc(standalone() || !/iP(hone|ad)/.test(navigator.userAgent) ? t("notifyAskBody") : t("iosInstallFirst"))}</small></span>${ic("chev", "chev")}</button>` : ""}

    ${(D.services || []).length ? `<a class="card li tata-home" href="#/tata/${D.services[0].id}">${ic("book")}<span class="grow"><b>${esc(t("tataTitle"))}</b><small>${esc(D.services[0].title || "")}${D.services[0].service_date ? " · " + esc(fmtDay(D.services[0].service_date)) : ""}</small></span>${ic("chev", "chev")}</a>` : ""}
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

    ${isGuest() ? "" : `<article class="card">
      <div class="card-h"><h3>${ic("roster")} ${esc(t("myDuties"))}</h3><a class="small" href="#/serve">${esc(t("rosters"))}</a></div>
      ${myDuties.length ? myDuties.map(dutyRow).join("") : `<p class="muted small">${esc(t("noDuties"))}</p>`}
    </article>`}

    <article class="card">
      <div class="card-h"><h3>${ic("calendar")} ${esc(t("upcoming"))}</h3><a class="small" href="#/calendar">${esc(t("seeAll"))}</a></div>
      ${evs.length ? evs.map(eventRow).join("") : `<p class="muted small">${esc(t("noEvents"))}</p>`}
    </article>

    <article class="card">
      <div class="card-h"><h3>${ic("book")} ${esc(t("beritaTitle"))}</h3><a class="small" href="#/berita">${esc(t("seeAll"))}</a></div>
      ${bn ? beritaBody(bn, true) : `<p class="muted small">${esc(t("beritaNone"))}</p>`}
    </article>

    ${myGroups.length ? `<h3 class="sec-h">${esc(t("myGroups"))}</h3><div class="glist">${myGroups.map((g) => groupTile(g, esc(t(g.kind === "sermon" ? "kindSermon" : "kindService")))).join("")}</div>` : ""}
    ${officeHome()}
    ${!standalone() ? `<p class="small muted center pad">${esc(t("installHint"))}</p>` : ""}
  `, { cols: true });
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
  const all = D.groups.filter((g) => g.kind === "sermon"); const list = all.filter(catShown);
  const pf = profileOn() && me().profile;
  return shell("#/groups", `
    <h2 class="page-h">${esc(t("groupsTitle"))}</h2>
    <p class="lead">${esc(t("groupsLead"))}</p>
    ${pf ? `<div class="card row between pf-note"><span class="small muted">${esc(t(isAdmin() && LS.get("allCats") ? "pfAllShown" : "pfFiltered"))}</span><span class="row"><button class="btn sm ghost" data-act="profile">${esc(t("pfChange"))}</button>${isAdmin() ? `<button class="btn sm" data-act="allCats">${esc(t(LS.get("allCats") ? "pfMine" : "pfAll"))}</button>` : ""}</span></div>` : ""}
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
  const teach = isTeachG(gid); const polls = (D.polls || []).filter((p) => p.group_id === gid);
  const teachers = people.filter((p) => ["tmaker", "teacher"].includes(p.groups[gid]));
  const tabs = [["sermon", "t_sermon", sermons.length], ...(teach ? [["polls", "t_polls", polls.filter((p) => p.status === "open").length]] : []), ["news", "t_news", news.length], ["events", "t_events", evs.length], ...(teach ? [["teachers", "t_teachers", teachers.length]] : []), ["members", "t_members", people.length]];
  let body = "";
  if (!ok) body = isGuest() ? signInCard(t("signInCat")) : empty(t("membersOnlyLong"), "lock");
  else if (tab === "polls" && teach) body = pollsTab(gid, polls);
  else if (tab === "teachers" && teach) body = teachersTab(gid, teachers);
  else if (tab === "sermon") body = (edit ? `<button class="btn primary block" data-act="newPost" data-g="${gid}" data-kind="sermon">${ic("plus")} ${esc(t("newSermon"))}</button>` : "") + (sermons.length ? sermons.map((p) => postCard(p, edit)).join("") : empty(t("noSermon"), "book"));
  else if (tab === "news") body = (edit ? `<button class="btn primary block" data-act="newPost" data-g="${gid}" data-kind="news">${ic("plus")} ${esc(t("newNews"))}</button>` : "") + (news.length ? news.map((p) => postCard(p, edit)).join("") : empty(t("noNews"), "bell"));
  else if (tab === "events") body = (edit ? `<button class="btn primary block" data-act="newEvent" data-g="${gid}">${ic("plus")} ${esc(t("newEvent"))}</button>` : "") + `<div class="card">${evs.length ? evs.map(eventRow).join("") : `<p class="muted small">${esc(t("noEvents"))}</p>`}</div>`;
  else body = peopleList(people, gid);
  return shell("#/groups", `
    <section class="ghero" style="--gc:${g.color}">
      <span class="gicon xl">${ic(g.icon)}</span>
      <div><h2>${esc(gname(g))}</h2><p>${esc(t("motto_" + g.id) !== "motto_" + g.id ? t("motto_" + g.id) : t("kindSermon"))}</p>${roleBadge(gid) ? `<div class="hero-role">${roleBadge(gid)} <small>${esc(edit ? t("canUpdate") : teach && canRunPoll(gid) ? t("teacherSub") : t("readOnly"))}</small></div>` : ""}</div>
    </section>
    ${ok ? wishCard(g, people) : ""}
    ${gid === "naposo" ? natalBlock(gid) : ""}
    ${ok && teach && manage() && isTMaker(gid) && !tmOk(gid) ? `<button class="card notify-ask" data-act="tmVerify" data-g="${gid}">${ic("lock")}<span><b>${esc(t("tmVerify"))}</b><small>${esc(t("tmNeedVerify"))}</small></span>${ic("chev", "chev")}</button>` : ""}
    ${ok ? `<div class="seg" role="tablist" style="--gc:${g.color}">${tabs.map(([k, l, n]) => `<a role="tab" aria-selected="${tab === k}" href="#/g/${gid}?tab=${k}">${esc(t(l))}${n ? ` <i>${n}</i>` : ""}</a>`).join("")}</div>` : ""}
    <div style="--gc:${g.color}">${body}</div>`, { back: "#/groups", title: gname(g), sub: t("kindSermon") });
};
// Birthday and wedding anniversary wishes for a category. The leader saves the category's WhatsApp group link once;
// after that one tap copies the ready-made wishes and opens that group, and the leader pastes and sends.
const isGLead = (gid) => !!D && !isGuest() && (D.me.is_admin || ["chair", "tmaker"].includes(roleIn(gid)));
const wishDay = () => { const q = new URLSearchParams(location.hash.split("?")[1] || "").get("wish"); return /^\d{4}-\d{2}-\d{2}$/.test(q || "") ? q : today(); };
function celebrants(people, day) {
  const md = day.slice(5);
  return { bday: people.filter((p) => p.bday === md), anniv: people.filter((p) => p.anniv === md) };
}
function wishText(g, c) {
  const nm = (l) => l.map((p) => p.alias || p.name).join(", ");
  return [c.bday.length ? `🎂 ${t("wishBday", nm(c.bday))}` : "", c.anniv.length ? `💍 ${t("wishAnniv", nm(c.anniv))}` : "", t("wishBless"), `– ${gname(g)}, HKBP Singapore`].filter(Boolean).join("\n\n");
}
function wishCard(g, people) {
  const day = wishDay(); const c = celebrants(people, day); const lead = isGLead(g.id);
  if (!c.bday.length && !c.anniv.length) return lead && !g.wa_link && g.kind === "sermon" ? `<button class="card notify-ask" data-act="waLink" data-g="${g.id}">${ic("wa")}<span><b>${esc(t("waLinkSet"))}</b><small>${esc(t("waLinkWhy"))}</small></span>${ic("chev", "chev")}</button>` : "";
  const list = [...c.bday.map((p) => `🎂 ${esc(p.name)}`), ...c.anniv.map((p) => `💍 ${esc(p.name)}`)].join("<br>");
  return `<div class="card wish"><div class="kicker">🎉 ${esc(day === today() ? t("wishToday") : fmtDay(day))}</div><p>${list}</p>
    ${lead ? `<button class="btn wa block" data-act="sendWish" data-g="${g.id}" data-day="${day}">${ic("wa")} ${esc(t(g.wa_link ? "wishSendGroup" : "wishSendPick"))}</button>
      <p class="small muted">${esc(t(g.wa_link ? "wishHowGroup" : "wishHowPick"))}</p>
      <button class="btn sm ghost" data-act="waLink" data-g="${g.id}">${ic("edit")} ${esc(t(g.wa_link ? "waLinkChange" : "waLinkSet"))}</button>`
    : `<a class="btn wa block" href="${wa(wishText(g, c))}" target="_blank" rel="noopener">${ic("wa")} ${esc(t("wishShare"))}</a>`}</div>`;
}

// Natal Naposo: the youth Christmas app (../natal/) opens inside the Youth page.
const NATAL_TABS = [["advent", "star"], ["schedule", "calendar"], ["program", "screen"], ["kado", "heart"], ["quiz", "check"], ["batak", "book"]];
function natalBlock(gid) {
  const lead = canEdit(gid) || canRunPoll(gid);
  return `<div class="card natal"><div class="kicker">🎄 ${esc(t("natalTitle"))}</div><p class="small muted">${esc(t("natalLead"))}</p>
    <div class="natal-tiles">${NATAL_TABS.map(([k, i]) => `<button class="btn" data-act="openNatal" data-tab="${k}">${ic(i)} ${esc(t("natal_" + k))}</button>`).join("")}</div>
    <button class="btn primary block" data-act="openNatal" data-tab="home">${ic("chev")} ${esc(t("natalOpen"))}</button>
    ${lead ? `<button class="btn block" data-act="openNatal" data-live="1" style="margin-top:8px">${ic("screen")} ${esc(t("natalLive"))}</button>` : ""}</div>`;
}
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
  return `<div class="card">${people.map((p) => `<div class="li"><span class="avatar">${esc(initials(p.name))}</span><span class="grow"><b>${esc(p.name)}</b><small>${gid && ["chair", "tmaker", "teacher"].includes(p.groups[gid]) ? esc(t("role_" + p.groups[gid])) : ""}${p.phone ? (gid && ["chair", "tmaker", "teacher"].includes(p.groups[gid]) ? " · " : "") + esc(fmtPhone(p.phone)) : ""}</small></span>
    ${p.phone ? `<a class="icon-btn wa" href="https://wa.me/65${p.phone}" target="_blank" rel="noopener" aria-label="WhatsApp">${ic("wa")}</a>` : ""}</div>`).join("")}</div>`;
}

// Service sections (non-sermonic) with monthly rosters.
R.serve = () => {
  const list = D.groups.filter((g) => g.kind === "service" && serveShown(g));
  const ym = monthKey(today()); const sv = serveOn() && (me().profile || {}).serve;
  return shell("#/serve", `
    <h2 class="page-h">${esc(t("serveTitle"))}</h2>
    <p class="lead">${esc(t("serveLead"))}</p>
    ${sv ? `<div class="card row between pf-note"><span class="small muted">${esc(t(LS.get("allServe") ? "svAllShown" : "svFiltered"))}</span><span class="row"><button class="btn sm ghost" data-act="servePick">${esc(t("pfChange"))}</button><button class="btn sm" data-act="allServe">${esc(t(LS.get("allServe") ? "pfMine" : "pfAll"))}</button></span></div>` : ""}
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
    ${gid === "multimedia" ? tataBlock() : ""}
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
  const now = Date.now(); const day = today();
  const show = LS.get("calPast", false);
  const evs = D.events.filter((e) => show || new Date(e.starts_at) > now - 3 * 3600e3);
  const canAdd = isElder() || D.groups.some((g) => canEdit(g.id));
  const byMonth = {}; const add = (k, item) => (byMonth[k] = byMonth[k] || []).push(item);
  evs.forEach((e) => { const p = sgParts(e.starts_at); add(monthKey(p.date), { k: p.date + " " + p.time, html: eventRow(e) }); });
  // Birthdays fill this month and the next two.
  const all = allBdays(); let [y, mo] = day.split("-").map(Number);
  for (let i = 0; i < 3; i++) {
    const ym = `${y}-${String(mo).padStart(2, "0")}`;
    all.filter((b) => b.bday.slice(0, 2) === ym.slice(5)).forEach((b) => { const d = `${ym}-${b.bday.slice(3)}`; if (show || d >= day) add(ym, { k: d + " 00:00", html: bdayRow(b, d) }); });
    if (++mo > 12) { mo = 1; y++; }
  }
  const months = Object.keys(byMonth).sort();
  return shell("#/calendar", `
    <h2 class="page-h">${esc(t("calendarTitle"))}</h2>
    <p class="lead">${esc(t("calendarLead"))}</p>
    <div class="row two">${canAdd ? `<button class="btn primary" data-act="newEvent">${ic("plus")} ${esc(t("newEvent"))}</button>` : ""}<button class="btn" data-act="icsAll" ${evs.length ? "" : "disabled"}>${ic("download")} ${esc(t("addAllCal"))}</button></div>
    <button class="card li" data-act="calSub">${ic("calendar")}<span class="grow"><b>${esc(t("calSub"))}</b><small>${esc(t("calSubSub"))}</small></span>${ic("chev", "chev")}</button>
    <div class="row two">${isElder() ? `<button class="btn" data-act="addBday">${ic("cake")} ${esc(t("addBday"))}</button><button class="btn" data-act="importBdays">${ic("upload")} ${esc(t("importBdays"))}</button>` : ""}<button class="btn ghost" data-act="icsBdays" ${all.length ? "" : "disabled"}>${ic("cake")} ${esc(t("bdaysToCal"))}</button></div>
    ${months.length ? months.map((k) => `<h3 class="sec-h">${esc(monthName(k))}</h3><div class="card">${byMonth[k].sort((a, c) => a.k.localeCompare(c.k)).map((x) => x.html).join("")}</div>`).join("") : empty(t("noEvents"), "calendar")}
    <p class="center"><button class="btn sm ghost" data-act="calPast">${esc(t(show ? "hidePast" : "showPast"))}</button></p>`);
};
function bdayRow(b, d) {
  const age = b.year ? +d.slice(0, 4) - b.year : null; const inner = `<span class="date-chip bday"><b>${esc(fmt(d, { day: "numeric" }))}</b><small>${esc(fmt(d, { month: "short" }))}</small></span>
    <span class="grow"><b>🎂 ${esc(b.name)}</b><small>${esc(t("bdayOf"))}${age && age > 0 && age < 120 ? " · " + esc(t("turns", age)) : ""}</small></span>`;
  return isElder() ? `<button class="li" data-act="bdayMenu" data-kind="${b.kind}" data-id="${b.id}" data-name="${esc(b.name)}" data-bday="${b.bday}">${inner}${ic("chev", "chev")}</button>` : `<div class="li">${inner}</div>`;
}

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
      ${/[?&]wa=1/.test(location.hash) ? `<div class="card wa-send"><b>${ic("wa")} ${esc(t("waSendTitle"))}</b><p class="small">${esc(t("waSendSteps"))}</p><a class="btn wa block" href="${wa(breadText(b))}" target="_blank" rel="noopener">${ic("wa")} ${esc(t("waSendBtn"))}</a></div>` : ""}
      <div class="row two"><a class="btn wa" href="${wa(breadText(b))}" target="_blank" rel="noopener">${ic("wa")} ${esc(t("shareWa"))}</a><button class="btn" data-act="copyBread" data-day="${b.day}">${ic("share")} ${esc(t("copy"))}</button></div>
      ${isElder() ? `<div class="row two"><a class="btn" href="#/bread/edit-${b.day}">${ic("edit")} ${esc(t("edit"))}</a><button class="btn danger" data-act="del" data-kind="bread" data-id="${b.day}">${ic("trash")} ${esc(t("delete"))}</button></div>` : ""}
    </article>` : empty(t("noBread"), "bread")}
    ${(D.settings || {}).wa_group_link ? `<a class="btn wa block" href="${esc(D.settings.wa_group_link)}" target="_blank" rel="noopener">${ic("wa")} ${esc(t("joinWaGroup"))}</a>` : ""}
    ${isAdmin() ? `<button class="card li" data-act="breadSetup">${ic("gear")}<span class="grow"><b>${esc(t("bs_title"))}</b><small>${esc(t("src_" + ((D.settings || {}).bread_source || "elders")))} · ${String((D.settings || {}).bread_hour ?? 6).padStart(2, "0")}:00</small></span>${ic("chev", "chev")}</button>` : ""}
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

// ---------- Berita Pelayanan: the Secretary uploads it from a file; everyone reads it ----------
const beritaAll = () => (D.updates || []).filter((u) => u.kind === "berita").sort((a, b) => (b.day || b.created_at).localeCompare(a.day || a.created_at) || b.created_at.localeCompare(a.created_at));
const beritaLatest = () => beritaAll()[0] || null;
const canBerita = () => manage() && (D.me.is_admin || roleIn("secretary") === "chair");
function beritaItems(body) {
  const items = []; let cur = null;
  String(body || "").split(/\n/).forEach((line) => {
    const l = line.trim(); const m = l.match(/^(\d{1,2})[.)]\s+(.*)$/);
    if (m) { cur = { title: m[2], body: [] }; items.push(cur); }
    else if (cur) cur.body.push(line); else if (l) { cur = { title: "", body: [line] }; items.push(cur); }
  });
  return items.map((x) => ({ title: x.title, body: x.body.join("\n").replace(/^\n+|\s+$/g, "") }));
}
function beritaBody(u, compact) {
  const items = beritaItems(u.body); const list = compact ? items.slice(0, 3) : items;
  return `<div class="berita">${u.day ? `<div class="meta">${esc(t("beritaFor", fmtDay(u.day)))}</div>` : ""}
    ${list.map((x, i) => `<div class="bi"><b>${x.title ? `${i + 1}. ${esc(x.title)}` : ""}</b>${x.body ? `<p class="${compact ? "clamp2" : "pre"}">${esc(x.body)}</p>` : ""}</div>`).join("")}
    ${compact && items.length > list.length ? `<p class="small muted">+${items.length - list.length}</p>` : ""}</div>`;
}
R.berita = () => {
  const all = beritaAll(); const can = canBerita();
  return shell("#/home", `
    ${can ? `<div class="card admin-card"><h3>${ic("upload")} ${esc(t("beritaUpload"))}</h3><p class="small muted">${esc(t("beritaUpLead"))}</p>
      <button class="btn primary block" data-act="beritaFile">${ic("upload")} ${esc(t("chooseFile"))}</button>
      <p class="small muted" style="text-align:center;margin:8px 0">.docx · .doc · .pdf · .xlsx · .xls</p>
      <form class="form" data-form="beritalink"><label>${esc(t("w_upLink"))}<input name="link" type="url" inputmode="url" placeholder="https://docs.google.com/…" required></label><button class="btn block">${esc(t("readLink"))}</button></form></div>` : ""}
    ${all.length ? all.map((u, i) => `<article class="card">${i ? `<details><summary><b>${esc(u.day ? fmtDay(u.day) : fmt(u.created_at, { day: "numeric", month: "long" }))}</b></summary>${beritaBody(u, false)}</details>` : beritaBody(u, false)}
      <div class="row end"><span class="small muted grow">${esc(u.author_name || "")}</span>${can ? `<button class="btn sm danger" data-act="del" data-kind="update" data-id="${u.id}" aria-label="${esc(t("delete"))}">${ic("trash")}</button>` : ""}</div></article>`).join("") : empty(t("beritaNone"), "book")}`,
    { back: "#/home", title: t("beritaTitle"), sub: "HKBP Singapore" });
};
// Read the Berita Pelayanan part of a file (or the whole text when the file has only that), then let the Secretary check it before saving.
function beritaFromRes(res) {
  let txt = ""; try { txt = (wartaFromFile(res, nextSunday(), [], "berita") || {}).berita || ""; } catch (e) { console.warn(e); }
  if (!txt) txt = linesOfRes(res).join("\n").replace(/^\s*berita pelayanan\s*\n/i, "").replace(/\n{3,}/g, "\n\n").trim();
  return txt;
}
function beritaReview(res) {
  const body = beritaFromRes(res); if (!body) { toast(t("w_noMatch"), true); return; }
  sheet(t("beritaTitle"), `<form class="form" data-form="berita">
    <label>${esc(t("f_date"))}<input type="date" name="day" value="${esc(nextSunday())}" required></label>
    <label>${esc(t("beritaCheck"))}<textarea name="body" rows="14" required>${esc(body)}</textarea></label>
    <label class="check"><input type="checkbox" name="notify" checked> ${esc(t("f_notify"))}</label>
    <button class="btn primary block">${ic("check")} ${esc(t("save"))}</button></form>`);
}
R.elders = () => shell("#/more", `
  <p class="lead">${esc(t("eldersLead"))}</p>
  ${isElder() ? `<button class="btn primary block" data-act="newUpdate">${ic("plus")} ${esc(t("newUpdate"))}</button>` : ""}
  ${D.updates.filter((u) => u.kind !== "berita").length ? D.updates.filter((u) => u.kind !== "berita").map((u) => `<article class="card">${updateCard(u, false)}</article>`).join("") : empty(t("noUpdates"), "book")}`,
  { back: "#/home", title: t("eldersUpdates"), sub: "Parhalado HKBP Singapore" });

R.people = () => {
  if (isGuest()) return shell("#/more", signInCard(t("signInCat")), { back: "#/more", title: t("people") });
  const day = today();
  const soon = birthdaysBetween(day, 30);
  const month = allBdays().filter((p) => p.bday.slice(0, 2) === day.slice(5, 7)).sort((a, b) => a.bday.localeCompare(b.bday));
  return shell("#/more", `
    ${isAdmin() ? `<div class="card admin-card"><h3>${ic("upload")} ${esc(t("memberUpload"))}</h3><p class="small muted">${esc(t("memberUploadLead"))}</p>
      <div class="row two"><button class="btn primary" data-act="uploadMembers">${ic("upload")} ${esc(t("chooseFile"))}</button><button class="btn" data-act="template">${ic("download")} ${esc(t("template"))}</button></div>
      <button class="btn block ghost" data-act="editMember">${ic("plus")} ${esc(t("addMember"))}</button></div>` : ""}
    ${isElder() ? `<div class="row two"><button class="btn" data-act="addBday">${ic("cake")} ${esc(t("addBday"))}</button><button class="btn" data-act="importBdays">${ic("upload")} ${esc(t("importBdays"))}</button></div>` : ""}
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
  if (isGuest()) return shell("#/more", `
    ${signInCard(t("guestBody"))}
    <div class="menu card">
      <a class="li" href="#/elders">${ic("book")}<span class="grow"><b>${esc(t("eldersUpdates"))}</b></span>${ic("chev", "chev")}</a>
      <a class="li" href="#/bread">${ic("bread")}<span class="grow"><b>${esc(t("breadTitle"))}</b></span>${ic("chev", "chev")}</a>
      <button class="li" data-act="notify">${ic("bell")}<span class="grow"><b>${esc(t("notifications"))}</b><small>${esc(perm === "granted" ? t("notifyOnTxt") : perm === "denied" ? t("notifyDenied") : t("notifyAskBody"))}</small></span>${ic("chev", "chev")}</button>
      <button class="li" data-act="install">${ic("phone")}<span class="grow"><b>${esc(t("installTitle"))}</b><small>${esc(standalone() ? t("installed") : t("installHint"))}</small></span>${ic("chev", "chev")}</button>
    </div>
    <p class="small muted center pad">HKBP Singapore · ${esc(t("logoNote"))}</p>`);
  return shell("#/more", `
    <section class="profile card">
      <span class="avatar lg">${esc(initials(m.name))}</span>
      <div class="grow"><h3>${esc(m.name)}</h3><p class="small muted">${esc(fmtPhone(m.phone))}${m.dob ? " · " + esc(fmt(m.dob, { day: "numeric", month: "long" })) : ""}</p>
        <div class="chips">${m.is_admin ? `<span class="badge admin">${esc(t("role_admin"))}</span>` : ""}${roles.map(([g, r]) => `<span class="chip" style="--gc:${(G(g) || {}).color}">${esc(gname(G(g)))}${r === "chair" ? " · " + esc(t("role_chair")) : ""}</span>`).join("")}</div></div>
    </section>
    <div class="menu card">
      <a class="li" href="#/elders">${ic("book")}<span class="grow"><b>${esc(t("eldersUpdates"))}</b></span>${ic("chev", "chev")}</a>
      <a class="li" href="#/bread">${ic("bread")}<span class="grow"><b>${esc(t("breadTitle"))}</b></span>${ic("chev", "chev")}</a>
      ${isOffice() ? `<a class="li" href="#/o/secretary">${ic("lock")}<span class="grow"><b>${esc(t("officeTitle"))}</b><small>${esc(officeGroups().map(gname).join(" · "))}</small></span>${ic("chev", "chev")}</a>` : ""}
      <a class="li" href="#/people">${ic("cake")}<span class="grow"><b>${esc(t("people"))}</b><small>${esc(isAdmin() ? t("peopleAdmin") : t("peopleSub"))}</small></span>${ic("chev", "chev")}</a>
      <button class="li" data-act="notify">${ic("bell")}<span class="grow"><b>${esc(t("notifications"))}</b><small>${esc(perm === "granted" ? t("notifyOnTxt") : perm === "denied" ? t("notifyDenied") : t("notifyAskBody"))}</small></span>${ic("chev", "chev")}</button>
      ${hasRights() ? `<button class="li" data-act="toggleView">${ic("people")}<span class="grow"><b>${esc(t("layout"))}: ${esc(t(manage() ? "viewAdmin" : "viewMember"))}</b><small>${esc(t(manage() ? "toMember" : "toAdmin"))}</small></span>${ic("chev", "chev")}</button>` : ""}
      ${isAdmin() ? `<button class="li" data-act="breadSetup">${ic("bread")}<span class="grow"><b>${esc(t("bs_title"))}</b><small>${esc(t("src_" + ((D.settings || {}).bread_source || "elders")))}</small></span>${ic("chev", "chev")}</button>` : ""}
      ${serveOn() ? `<button class="li" data-act="servePick">${ic("calendar")}<span class="grow"><b>${esc(t("svTitle"))}</b><small>${esc((me().profile || {}).serve ? me().profile.serve.map((id) => gname(G(id))).filter(Boolean).join(", ") || t("svNone") : t("pfNotYet"))}</small></span>${ic("chev", "chev")}</button>` : ""}
      ${profileOn() ? `<button class="li" data-act="profile">${ic("people")}<span class="grow"><b>${esc(t("pfTitle"))}</b><small>${esc(me().profile ? profileCats(me().profile).map((id) => gname(G(id))).filter(Boolean).join(", ") : t("pfNotYet"))}</small></span>${ic("chev", "chev")}</button>` : ""}
      <button class="li" data-act="password">${ic("key")}<span class="grow"><b>${esc(t("changePw"))}</b></span>${ic("chev", "chev")}</button>
      <button class="li" data-act="install">${ic("phone")}<span class="grow"><b>${esc(t("installTitle"))}</b><small>${esc(standalone() ? t("installed") : t("installHint"))}</small></span>${ic("chev", "chev")}</button>
      ${isElder() ? `<button class="li" data-act="settings">${ic("gear")}<span class="grow"><b>${esc(t("settings"))}</b><small>${esc(api.mode === "remote" ? t("modeRemote") : t("modeLocal"))}</small></span>${ic("chev", "chev")}</button>` : ""}
      <button class="li" data-act="logout">${ic("logout")}<span class="grow"><b>${esc(t("signOut"))}</b></span></button>
    </div>
    <p class="small muted center pad">HKBP Singapore · ${esc(t("logoNote"))}</p>`);
};
R.notFound = () => shell("#/home", empty(t("notFound")), { back: "#/home" });

// ---------- router ----------
let rendering = false;
async function render() {
  if (rendering) return; rendering = true;
  try {
    const h = location.hash.replace(/^#\/?/, "").split("?")[0];
    let [r, arg] = h.split("/");
    if (r === "login") { if (api.hasSession()) { location.replace("#/home"); return; } await R.login(); return; }
    if (!api.hasSession() && await api.needsSetup()) { await R.login(); return; }
    if (!D) await refresh();
    if (!r) { history.replaceState(null, "", "#/home"); r = "home"; }
    const map = { tata: R.tata, home: R.home, groups: R.groups, g: R.group, serve: R.serve, s: R.section, calendar: R.calendar, bread: R.bread, elders: R.elders, berita: R.berita, people: R.people, more: R.more, o: R.office, warta: R.warta };
    const html = (map[r] || R.notFound)(arg);
    if (typeof html === "string") view().innerHTML = html;
    draftRestore(view()); wAutoBase();
    document.title = r === "home" ? "Sada HKBPS" : `${$(".brand b") ? $(".brand b").textContent : ""} · Sada HKBPS`;
    hydrate();
  } catch (e) { console.error(e); view().innerHTML = `<div class="login">${empty(errMsg(e))}<button class="btn primary" data-act="retry">${esc(t("retry"))}</button></div>`; }
  finally { rendering = false; }
}
function hydrate() {
  if (D && !isGuest() && api.hasSession() && $("#sheet").hidden) {
    if (viewMode() === null) { if (hasRights()) setTimeout(rolePrompt, 300); else LS.set("view", "member"); }
    else if (profileOn() && !me().profile) setTimeout(() => { if ($("#sheet").hidden && profileOn() && !me().profile) profilePrompt(); }, 900);
    else if (serveOn() && !(me().profile || {}).serve) setTimeout(() => { if ($("#sheet").hidden && serveOn() && !(me().profile || {}).serve) servePrompt(); }, 900);
  }
  if (D && /^#\/s\/multimedia/.test(location.hash) && $("#sheet").hidden && viewMode() !== null) {
    if (!mmRole()) setTimeout(mmPrompt, 250);
    else if (D.me.is_admin && manage() && !makers().length && !hydrate.mkAsked) { hydrate.mkAsked = true; setTimeout(A.addMaker, 400); }
  }
  const tg = (location.hash.match(/^#\/g\/([\w-]+)/) || [])[1];
  // Opening Youth or Sunday School: the admin is asked for that class's missing Teacher Makers; a Maker is asked to confirm their phone.
  if (D && tg && isTeachG(tg) && $("#sheet").hidden && isAdmin() && teachSeedMissing(tg).length && hydrate.tsAsked !== tg) { hydrate.tsAsked = tg; setTimeout(() => { if ($("#sheet").hidden) A.teachSetup({ g: tg }); }, 300); }
  else if (D && tg && isTeachG(tg) && $("#sheet").hidden && manage() && isTMaker(tg) && !tmOk(tg) && hydrate.tmAsked !== tg) { hydrate.tmAsked = tg; setTimeout(() => A.tmVerify({ g: tg }), 300); }
  if (D && /^#\/o\//.test(location.hash) && $("#sheet").hidden && viewMode() !== null && isOffice()) {
    if (!offOk()) setTimeout(officePrompt, 250);
    else if (D.me.is_admin && manage() && !officeGroups().some((g) => holders(g.id).length) && !hydrate.offAsked) { hydrate.offAsked = true; setTimeout(() => A.addHolder({ g: location.hash.split("/")[2] }), 400); }
  }
  document.documentElement.lang = lang === "en" ? "en" : lang === "bt" ? "bbc" : "id";
  document.querySelectorAll("[data-tata]").forEach(async (el) => { try { const h = await tataHtml(el.dataset.tata); if (h) { el.innerHTML = ""; el.appendChild(tataIframe(h)); } } catch (e) { el.innerHTML = `<p class="muted small">${esc(errMsg(e))}</p>`; } });
  document.querySelectorAll("[data-img]").forEach(async (el) => { try { const f = await api.rosterFile(el.dataset.img); if (f && f.file_b64) el.innerHTML = `<img src="data:${esc(f.mime)};base64,${f.file_b64}" alt="Roster">`; } catch {} });
}
window.addEventListener("hashchange", () => { window.scrollTo(0, 0); render(); });

// ---------- actions ----------
const A = {};
const F = {};
A.lang = (d) => { lang = d.l; LS.set("lang", lang); render(); };
A.pickView = (d) => { LS.set("view", d.v || null); closeSheet(); render(); };
function profilePrompt() {
  const p = me().profile || {};
  const q = (name, key, a, b) => `<fieldset class="yn"><legend>${esc(t(key))}</legend><div class="row2">
    <label><input type="radio" name="${name}" value="1" required ${p[name] === true ? "checked" : ""}><span>${esc(t(a))}</span></label>
    <label><input type="radio" name="${name}" value="0" ${p[name] === false ? "checked" : ""}><span>${esc(t(b))}</span></label></div></fieldset>`;
  sheet(t("pfTitle"), `<form class="form" data-form="profile">
    <p class="muted">${esc(t("pfLead"))}</p>
    ${q("married", "pfMarried", "pfYesMarried", "pfNotMarried")}
    ${q("male", "pfGender", "pfMale", "pfFemale")}
    ${q("pelaut", "pfPelaut", "yes", "no")}
    ${q("confirmed", "pfConfirmed", "yes", "no")}
    <button class="btn primary block">${esc(t("save"))}</button></form>`);
}
A.profile = () => profilePrompt();
A.allCats = () => { LS.set("allCats", LS.get("allCats") ? null : 1); render(); };
F.profile = async (f) => {
  const v = (n) => f.querySelector(`input[name="${n}"]:checked`).value === "1";
  const p = { married: v("married"), male: v("male"), pelaut: v("pelaut"), confirmed: v("confirmed") };
  const res = await api.profileSave(p); D.me.profile = res || p; LS.set("allCats", null);
  closeSheet(); toast(t("pfSaved") + " " + profileCats(D.me.profile).map((id) => gname(G(id))).filter(Boolean).join(", ")); render();
  if (serveOn()) setTimeout(servePrompt, 350); // second layer
};
function servePrompt() {
  const sv = (me().profile || {}).serve || [];
  sheet(t("svTitle"), `<form class="form" data-form="serve">
    <p class="muted">${esc(t("svLead"))}</p>
    <div class="pick-list">${D.groups.filter((g) => g.kind === "service").map((g) => `<label class="pick" style="--gc:${g.color}"><input type="checkbox" name="sv" value="${esc(g.id)}" ${sv.includes(g.id) ? "checked" : ""}><span class="gicon">${ic(g.icon)}</span><b>${esc(gname(g))}</b><i class="tick">${ic("check")}</i></label>`).join("")}</div>
    <button class="btn primary block">${esc(t("save"))}</button></form>`);
}
A.servePick = () => servePrompt();
A.allServe = () => { LS.set("allServe", LS.get("allServe") ? null : 1); render(); };
F.serve = async (f) => {
  const serve = [...f.querySelectorAll('input[name="sv"]:checked')].map((x) => x.value);
  const res = await api.profileSave({ serve }); D.me.profile = res || { ...(D.me.profile || {}), serve }; LS.set("allServe", null);
  closeSheet(); toast(t("svSaved")); if (/^#\/serve/.test(location.hash)) render(); else location.hash = "#/serve";
};
A.toggleView = () => { LS.set("view", manage() ? "member" : "admin"); toast(t(manage() ? "nowAdmin" : "nowMember")); render(); };
function rolePrompt() {
  if (!$("#sheet").hidden) return;
  sheet(t("whoAreYou"), `<p class="muted">${esc(t("whoLead"))}</p><div class="stack">
    <button class="opt-card" data-act="pickView" data-v="member">${ic("people")}<span><b>${esc(t("viewMember"))}</b><small>${esc(t("viewMemberSub"))}</small></span>${ic("chev", "chev")}</button>
    <button class="opt-card" data-act="pickView" data-v="admin">${ic("gear")}<span><b>${esc(t("viewAdmin"))}</b><small>${esc(t("viewAdminSub"))}</small></span>${ic("chev", "chev")}</button></div>`);
}

// ---------- Tata Ibadah (Multimedia workbench) ----------
const makers = () => D.people.filter((p) => ["maker", "chair"].includes((p.groups || {}).multimedia));
function tataBlock() {
  const role = mmRole(); const list = (D.services || []).slice(0, 6); const mk = makers();
  return `<div class="card tata">
    <div class="card-h"><h3>${ic("book")} ${esc(t("tataTitle"))}</h3>${role ? `<button class="badge ${role === "maker" ? "chair" : "member"}" data-act="mmSwitch">${esc(t("role_" + role))} · ${esc(t("change"))}</button>` : ""}</div>
    <p class="small muted">${esc(t(role === "maker" ? "tataMakerLead" : "tataReadLead"))}</p>
    ${role === "maker" ? `<button class="btn primary block" data-act="openWorkbench">${ic("edit")} ${esc(t("openWorkbench"))}</button>` : ""}
    ${list.length ? list.map((v) => `<a class="li" href="#/tata/${v.id}"><span class="date-chip"><b>${esc(v.service_date ? fmt(v.service_date, { day: "numeric" }) : "•")}</b><small>${esc(v.service_date ? fmt(v.service_date, { month: "short" }) : "")}</small></span><span class="grow"><b>${esc(v.title || t("tataTitle"))}</b><small>${esc(v.author_name || "")}</small></span>${ic("chev", "chev")}</a>`).join("") : `<p class="muted small">${esc(t("noTata"))}</p>`}
    ${(D.services || []).length > 6 ? `<a class="btn sm ghost" href="#/tata">${esc(t("seeAll"))}</a>` : ""}
  </div>
  ${D.me.is_admin && manage() ? `<div class="card"><div class="card-h"><h3>${ic("people")} ${esc(t("makerList"))}</h3><button class="btn sm" data-act="addMaker">${ic("plus")} ${esc(t("addMaker"))}</button></div>
    ${mk.length ? mk.map((p) => `<div class="li"><span class="avatar">${esc(initials(p.name))}</span><span class="grow"><b>${esc(p.name)}</b><small>${esc(fmtPhone(p.phone))} · ${esc(t("role_" + p.groups.multimedia))}</small></span>${p.groups.multimedia === "maker" ? `<button class="icon-btn" data-act="rmMaker" data-phone="${esc(p.phone || "")}" aria-label="${esc(t("delete"))}">${ic("trash")}</button>` : ""}</div>`).join("") : `<p class="muted small">${esc(t("noMakers"))}</p>`}</div>` : ""}`;
}
function mmPrompt() {
  if (!$("#sheet").hidden) return;
  sheet(t("mmWho"), `<p class="muted">${esc(t("mmWhoLead"))}</p><div class="stack">
    <button class="opt-card" data-act="mmPick" data-v="checker">${ic("check")}<span><b>${esc(t("role_checker"))}</b><small>${esc(t("checkerSub"))}</small></span>${ic("chev", "chev")}</button>
    <button class="opt-card" data-act="mmPick" data-v="maker">${ic("edit")}<span><b>${esc(t("role_maker"))}</b><small>${esc(t("makerSub"))}</small></span>${ic("chev", "chev")}</button></div>`);
}
A.mmSwitch = () => { setMMRole(""); mmPrompt(); };
A.mmPick = (d) => {
  if (d.v === "checker") { setMMRole("checker"); closeSheet(); render(); return; }
  if (isGuest()) return A_signIn();
  sheet(t("role_maker"), `<form class="form" data-form="mmmaker"><p class="muted">${esc(t("makerPhoneLead"))}</p>
    <label>${esc(t("f_phone"))}<div class="phone-in"><span>+65</span><input name="phone" inputmode="numeric" required placeholder="8123 4567" autocomplete="tel"></div></label>
    <button class="btn primary block">${esc(t("verify"))}</button></form>`, (el) => el.querySelector("input").focus());
};
F.mmmaker = async (f) => {
  // The number must be the signed-in member's own number and be on the Multimedia maker list. The server checks again on publish.
  if (S.phone8(f.phone.value) !== D.me.phone || !isMMMaker()) { setMMRole("checker"); closeSheet(); toast(t("notMaker"), true); return; }
  setMMRole("maker"); closeSheet(); toast(t("makerOk"));
};
A.addMaker = () => sheet(t("addMaker"), `<form class="form" data-form="maker"><p class="muted">${esc(t("addMakerLead"))}</p>
  <label>${esc(t("f_phone"))}<div class="phone-in"><span>+65</span><input name="phone" inputmode="numeric" required placeholder="8123 4567"></div></label>
  <label>${esc(t("f_nameIfNew"))}<input name="name" autocomplete="off"></label>
  <label class="check"><input type="checkbox" name="more" checked> ${esc(t("addAnother"))}</label>
  <button class="btn primary block">${ic("plus")} ${esc(t("addMaker"))}</button></form>`, (el) => el.querySelector("input").focus());
F.maker = async (f) => {
  const r = await api.setRole(f.phone.value, "multimedia", "maker", f.name.value.trim());
  const more = f.more.checked; await refresh(); toast(t("makerAdded", r.name));
  if (more) { closeSheet(); setTimeout(A.addMaker, 220); } else closeSheet();
};
A.rmMaker = async (d, btn) => {
  if (btn.dataset.sure !== "1") { btn.dataset.sure = "1"; toast(t("tapAgain")); return; }
  await api.setRole(d.phone, "multimedia", "member"); await refresh(); toast(t("saved")); render();
};
R.tata = (id) => {
  if (!id) return shell("#/serve", `<div class="card">${(D.services || []).map((v) => `<a class="li" href="#/tata/${v.id}"><span class="grow"><b>${esc(v.title || t("tataTitle"))}</b><small>${esc(v.service_date ? fmtDay(v.service_date) : "")} · ${esc(v.author_name || "")}</small></span>${ic("chev", "chev")}</a>`).join("") || `<p class="muted small">${esc(t("noTata"))}</p>`}</div>`, { back: "#/s/multimedia", title: t("tataTitle"), sub: "HKBP Singapore" });
  const v = (D.services || []).find((x) => x.id === id); if (!v) return R.notFound();
  const canRm = mmRole() === "maker" && isMMMaker();
  return shell("#/serve", `
    <div class="tata-view"><div class="tata-frame" data-tata="${v.id}"><span class="spin"></span></div></div>
    <p class="small muted center">${esc(t("tataRotate"))}</p>
    <div class="row two"><button class="btn" data-act="tataFull" data-id="${v.id}">${ic("screen")} ${esc(t("fullScreen"))}</button>${canRm ? `<button class="btn danger" data-act="del" data-kind="service" data-id="${v.id}">${ic("trash")} ${esc(t("delete"))}</button>` : ""}</div>`,
    { back: "#/s/multimedia", title: v.title || t("tataTitle"), sub: v.service_date ? fmtDay(v.service_date) : t("tataTitle") });
};
const tataCache = {};
async function tataHtml(id) { if (!tataCache[id]) tataCache[id] = await api.serviceHtml(id); return tataCache[id]; }
function tataIframe(html) { const f = document.createElement("iframe"); f.setAttribute("sandbox", "allow-scripts"); f.title = t("tataTitle"); f.src = URL.createObjectURL(new Blob([html], { type: "text/html" })); return f; }
A.tataFull = async (d) => { const html = await tataHtml(d.id); const el = $(".tata-frame"); if (el && el.requestFullscreen) el.requestFullscreen().catch(() => {}); else window.open(URL.createObjectURL(new Blob([html], { type: "text/html" })), "_blank"); };
A.openWorkbench = () => {
  if (!(mmRole() === "maker" && isMMMaker())) { toast(t("notMaker"), true); return; }
  const el = document.createElement("div"); el.id = "wb";
  el.innerHTML = `<div class="wb-bar"><button class="icon-btn" data-act="closeWb" aria-label="${esc(t("close"))}">${ic("x")}</button><b>${esc(t("tataTitle"))} · Workbench</b><button class="btn primary sm" data-act="publishWb">${ic("upload")} ${esc(t("publish"))}</button></div><iframe src="../workbench/index.html" title="Workbench"></iframe>`;
  document.body.appendChild(el); document.body.classList.add("noscroll");
};
A.openNatal = (d) => {
  const url = d.live ? "../youth/?kit=../natal/christmas-quiz.json" : `../natal/?lang=${lang}#${d.tab || "home"}`;
  const el = document.createElement("div"); el.id = "wb";
  el.innerHTML = `<div class="wb-bar"><button class="icon-btn" data-act="closeWb" aria-label="${esc(t("close"))}">${ic("x")}</button><b>🎄 ${esc(d.live ? t("natalLive") : t("natalTitle"))}</b><a class="btn sm" href="${url}" target="_blank" rel="noopener">${ic("link")} ${esc(t("natalNewTab"))}</a></div><iframe src="${url}" title="Natal Naposo" allow="fullscreen; autoplay"></iframe>`;
  document.body.appendChild(el); document.body.classList.add("noscroll");
};
A.beritaFile = () => {
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = W_ACCEPT;
  inp.onchange = async () => { const f = inp.files[0]; if (!f) return; toast(t("reading")); try { beritaReview(await P.file(f)); } catch (e) { console.warn(e); toast(t(e.message === "unsupported" ? "err_unsupported" : "err_read"), true); } };
  inp.click();
};
F.beritalink = async (f) => { const r = await P.link(f.link.value.trim()); if (!(r.lines || []).some(Boolean) && !r.tables.length) throw new S.AppError(r.note === "link_folder" ? "link_folder" : r.note === "link_private" ? "link_private" : "read"); beritaReview(r); };
F.berita = async (f) => {
  const day = f.day.value; const old = beritaAll().find((u) => u.day === day);
  await api.save("update", { id: old ? old.id : undefined, kind: "berita", day, title: "Berita Pelayanan · " + fmtID(day), body: f.body.value.trim(), notify: f.notify.checked });
  closeSheet(); await refresh(); toast(t("beritaSaved"));
};
// Delete every saved Warta Jemaat draft (tap twice to confirm).
A.wDelAll = async (d, btn) => {
  if (btn.dataset.sure !== "1") { btn.dataset.sure = "1"; btn.classList.add("sure"); btn.innerHTML = `${ic("trash")} ${esc(t("tapAgain"))}`; setTimeout(() => { if (btn.isConnected) { btn.dataset.sure = ""; btn.classList.remove("sure"); btn.innerHTML = `${ic("trash")} ${esc(t("delAll"))}`; } }, 4000); return; }
  await busy(btn, async () => { try { for (const p of wartaPosts()) await api.del("post", p.id); await refresh(); toast(t("deleted")); render(); } catch (e) { toast(errMsg(e), true); } });
};
A.closeWb = () => { const el = $("#wb"); if (el) el.remove(); document.body.classList.remove("noscroll"); };
A.publishWb = () => {
  const w = $("#wb iframe") && $("#wb iframe").contentWindow;
  if (!w || typeof w.buildStandalone !== "function") { toast(t("wbNotReady"), true); return; }
  const html = w.buildStandalone(); const meta = (w.state && w.state.meta) || {};
  let day = ""; try { const dt = w.serviceDate(); day = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`; } catch {}
  A.publishWb._html = html;
  sheet(t("publish"), `<form class="form" data-form="publish">
    <label>${esc(t("f_title"))}<input name="title" required value="${esc([t("tataTitle"), meta.sunday || meta.theme].filter(Boolean).join(" · "))}"></label>
    <label>${esc(t("f_date"))}<input type="date" name="day" value="${day}"></label>
    <label class="check"><input type="checkbox" name="notify" checked> ${esc(t("evNotifyAll"))}</label>
    <p class="small muted">${esc(t("publishNote", Math.round(html.length / 1024)))}</p>
    <button class="btn primary block">${ic("upload")} ${esc(t("publish"))}</button></form>`);
};
F.publish = async (f) => {
  const html = A.publishWb._html; if (!html) throw new S.AppError("server");
  if (html.length > 9000000) throw new S.AppError("file_too_big");
  const res = await api.save("service", { title: f.title.value.trim(), service_date: f.day.value || null, html, notify: f.notify.checked });
  closeSheet(); A.closeWb(); await refresh(); toast(t("published")); location.hash = "#/tata/" + res.id;
};

// ---------- daily bread setup (admin, first time and later) ----------
A.breadSetup = () => {
  if (!$("#sheet").hidden && $("#sheet [data-form=breadsetup]")) return;
  const st = D.settings || {}; const cur = st.bread_source || "claude_daily"; const hr = +(st.bread_hour ?? 6); const bl = st.bread_lang || lang;
  const senders = Array.isArray(st.wa_senders) ? st.wa_senders : [me().id];
  const elders = D.people.filter((p) => p.is_admin || "parhalado" in (p.groups || {}) || p.id === me().id);
  sheet(t("bs_title"), `<form class="form" data-form="breadsetup">
    <p class="muted">${esc(t("bs_lead"))}</p>
    <fieldset class="opts"><legend>${esc(t("bs_source"))}</legend>
      ${["claude_daily", "claude_week", "elders"].map((v) => `<label class="opt"><input type="radio" name="source" value="${v}" ${cur === v ? "checked" : ""}><span><b>${esc(t("src_" + v))}</b><small>${esc(t("src_" + v + "_sub"))}</small></span></label>`).join("")}
    </fieldset>
    <div class="row two"><label>${esc(t("bs_lang"))}<select name="blang">${["id", "bt", "en"].map((l) => `<option value="${l}" ${l === bl ? "selected" : ""}>${esc(t("lang_" + l))}</option>`).join("")}</select></label>
      <label>${esc(t("bs_time"))}<select name="bhour">${[4, 5, 6, 7, 8, 9].map((h) => `<option value="${h}" ${h === hr ? "selected" : ""}>${String(h).padStart(2, "0")}:00</option>`).join("")}</select></label></div>
    <label>${esc(t("f_claudeKeyServer"))}<input name="ckey" type="password" autocomplete="off" placeholder="${esc(st.claude_key_set ? t("keySaved") : "sk-ant-…")}"></label>
    <p class="small muted">${esc(t("claudeKeyServerNote"))}</p>
    <h4>${ic("wa")} ${esc(t("bs_wa"))}</h4>
    <p class="small muted">${esc(t("bs_waLead"))}</p>
    <label>${esc(t("f_waLink"))}<input name="walink" type="url" inputmode="url" value="${esc(st.wa_group_link || "")}" placeholder="https://chat.whatsapp.com/…"></label>
    <fieldset class="opts"><legend>${esc(t("bs_senders"))}</legend>
      ${elders.map((p) => `<label class="opt check"><input type="checkbox" name="sender" value="${p.id}" ${senders.includes(p.id) ? "checked" : ""}><span><b>${esc(p.name)}</b></span></label>`).join("")}
    </fieldset>
    <button class="btn primary block">${ic("check")} ${esc(t("bs_save"))}</button>
  </form>`);
};
F.breadsetup = async (f) => {
  const source = (f.querySelector("[name=source]:checked") || {}).value || "elders";
  const key = f.ckey.value.trim(); const st = D.settings || {};
  if (source !== "elders" && !key && !st.claude_key_set && api.mode === "remote") throw new S.AppError("need_claude_key");
  const link = f.walink.value.trim();
  if (link && !/^https:\/\/(chat\.whatsapp\.com|wa\.me|whatsapp\.com)\//.test(link)) throw new S.AppError("bad_wa_link");
  await api.settingsSave({ bread_source: source, bread_lang: f.blang.value, bread_hour: +f.bhour.value, wa_group_link: link, wa_senders: [...f.querySelectorAll("[name=sender]:checked")].map((x) => x.value), setup_done: true, claude_key: key });
  if (key) LS.set("claudeKey", key);
  closeSheet(); D = null; await refresh(); toast(t("bs_done"));
};

// ---------- birthdays ----------
A.icsBdays = () => download("hkbp-birthdays.ics", icsBirthdays(allBdays()), "text/calendar");
A.addBday = (d) => {
  const b = d.id ? (D.birthdays || []).find((x) => x.id === d.id) : null;
  const md = b ? b.bday.split("-") : ["", ""];
  sheet(t(b ? "editBday" : "addBday"), `<form class="form" data-form="bday" data-id="${b ? b.id : ""}">
    <label>${esc(t("f_name"))}<input name="name" required value="${esc(b ? b.name : "")}" autocomplete="off"></label>
    <div class="row three"><label>${esc(t("f_day"))}<select name="dd" required><option value=""></option>${Array.from({ length: 31 }, (_, i) => i + 1).map((n) => `<option ${+md[1] === n ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      <label>${esc(t("f_month"))}<select name="mm" required><option value=""></option>${Array.from({ length: 12 }, (_, i) => i + 1).map((n) => `<option value="${n}" ${+md[0] === n ? "selected" : ""}>${esc(fmt(`2024-${String(n).padStart(2, "0")}-15`, { month: "long" }))}</option>`).join("")}</select></label>
      <label>${esc(t("f_yearOpt"))}<input name="yy" inputmode="numeric" maxlength="4" value="${b && b.year ? b.year : ""}" placeholder="1980"></label></div>
    <button class="btn primary block">${esc(t("save"))}</button></form>`, (el) => el.querySelector("input").focus());
};
A.bdayMenu = (d) => {
  if (d.kind === "list") {
    const b = (D.birthdays || []).find((x) => x.id === d.id); if (!b) return;
    return sheet("🎂 " + b.name, `<p class="muted">${esc(fmt("2024-" + b.bday, { day: "numeric", month: "long" }))}${b.year ? " " + b.year : ""}</p>
      <div class="row two"><button class="btn" data-act="addBday" data-id="${b.id}">${ic("edit")} ${esc(t("edit"))}</button><button class="btn danger" data-act="del" data-kind="birthday" data-id="${b.id}">${ic("trash")} ${esc(t("delete"))}</button></div>`);
  }
  sheet("🎂 " + d.name, `<p class="muted">${esc(fmt("2024-" + d.bday, { day: "numeric", month: "long" }))}</p><p class="small muted">${esc(t("bdayFromMembers"))}</p>`);
};
F.bday = async (f) => {
  const y = f.yy.value.trim(); if (y && !/^(19|20)\d\d$/.test(y)) throw new S.AppError("bad_year");
  const dob = `${y || "1904"}-${String(f.mm.value).padStart(2, "0")}-${String(f.dd.value).padStart(2, "0")}`;
  if (isNaN(new Date(dob + "T12:00:00Z")) || new Date(dob + "T12:00:00Z").toISOString().slice(0, 10) !== dob) throw new S.AppError("bad_date");
  await api.save("birthday", { id: f.dataset.id || undefined, name: f.name.value.trim(), dob, year_known: !!y });
  closeSheet(); await refresh(); toast(t("saved"));
};
A.importBdays = () => sheet(t("importBdays"), `<p class="muted">${esc(t("importBdaysLead"))}</p>
  <button class="btn primary block" data-act="pickBdayFile">${ic("upload")} ${esc(t("chooseFile"))}</button>
  <form class="form" data-form="bdaylink"><label>${esc(t("f_link"))}<input name="link" type="url" inputmode="url" placeholder="https://docs.google.com/spreadsheets/…" required></label><button class="btn block">${esc(t("readLink"))}</button></form>`);
A.pickBdayFile = () => {
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".xlsx,.xls,.csv,.ods,.docx,.doc,.pdf";
  inp.onchange = async () => { const f = inp.files[0]; if (!f) return; toast(t("reading")); try { bdayPreview(bdayRows(await P.file(f)), f.name); } catch (e) { console.warn(e); toast(t(e.message === "unsupported" ? "err_unsupported" : "err_read"), true); } };
  inp.click();
};
F.bdaylink = async (f) => { const r = await P.link(f.link.value.trim()); if (!r.tables.length) throw new S.AppError(r.note === "link_private" ? "link_private" : "read"); bdayPreview(bdayRows(r), "Online sheet"); };
// "12/03/1980", "1980-03-12", "12 Maret 1980" (year known) or "12/03", "12 Maret" (no year).
function parseBday(s) {
  s = String(s || "").trim().replace(/\s+/g, " "); if (!s || s.length > 40) return null;
  const full = parseDob(s); if (full) { const y = +full.slice(0, 4); return y >= 1900 && y <= +today().slice(0, 4) ? { dob: full, year_known: true } : null; }
  let x, d, m;
  if ((x = s.match(/^(\d{1,2})[\/.\-](\d{1,2})$/))) [d, m] = [+x[1], +x[2]];
  else if ((x = s.match(/^(\d{1,2})[\s-]+([a-z]+)\.?$/i)) && MON[x[2].slice(0, 3).toLowerCase()]) [d, m] = [+x[1], MON[x[2].slice(0, 3).toLowerCase()]];
  else if ((x = s.match(/^([a-z]+)\.?\s+(\d{1,2})$/i)) && MON[x[1].slice(0, 3).toLowerCase()]) [m, d] = [MON[x[1].slice(0, 3).toLowerCase()], +x[2]];
  else return null;
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  return { dob: `1904-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, year_known: false };
}
const DATE_IN_TEXT = /(\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}|\d{1,2}[-\/.]\d{1,2}(?:[-\/.]\d{2,4})?|\d{1,2}\s+[a-z]{3,9}\.?(?:\s+\d{4})?)/i;
function bdayRows(res) {
  const out = []; const seen = new Set();
  const push = (name, raw, phone) => {
    name = String(name || "").replace(/^[\s\d.)\-:•]+/, "").replace(/[\s,:;\-–]+$/, "").replace(/\s+/g, " ").trim();
    const b = parseBday(raw); if (!name || !/[a-z]{2}/i.test(name) || !b) return;
    const k = norm(name) + b.dob.slice(5); if (seen.has(k)) return; seen.add(k);
    out.push({ name, ...b, phone: phone ? S.phone8(phone) : "" });
  };
  for (const tb of res.tables || []) {
    const hi = tb.rows.findIndex((r) => r.some((c) => /^(nama|name|goar)/i.test(String(c).trim())) && r.some((c) => /lahir|birth|dob|tgl|tanggal|ulang|date|hari/i.test(c)));
    if (hi >= 0) {
      const h = tb.rows[hi]; const ni = h.findIndex((c) => /^(nama|name|goar)/i.test(String(c).trim())); const di = h.findIndex((c) => /lahir|birth|dob|tgl|tanggal|ulang|date|hari/i.test(c)); const pi = h.findIndex((c) => /hp|phone|telp|telepon|mobile|wa\b|whatsapp|kontak/i.test(c));
      tb.rows.slice(hi + 1).forEach((r) => push(r[ni], r[di], pi >= 0 ? r[pi] : ""));
      continue;
    }
    tb.rows.forEach((r) => {
      const cells = r.map((c) => String(c || "").trim()).filter(Boolean);
      if (cells.length === 1) { const m = cells[0].match(DATE_IN_TEXT); if (m) push(cells[0].replace(m[0], " "), m[0]); return; }
      const di = cells.findIndex((c) => parseBday(c)); if (di < 0) return;
      const phone = cells.find((c) => /^(\+?65)?\s?[3689]\d{3}\s?\d{4}$/.test(c));
      const name = cells.filter((c, i) => i !== di && c !== phone && /[a-z]{2}/i.test(c)).sort((a, b) => b.length - a.length)[0];
      push(name, cells[di], phone);
    });
  }
  return out;
}
function bdayPreview(rows, fname) {
  if (!rows.length) { toast(t("noBdayRows"), true); return; }
  sheet(t("importBdays"), `<p class="small muted">${esc(fname)} · ${esc(t("rowsFound", rows.length))}</p>
    <div class="tbl-wrap"><table class="tbl"><tr><th>${esc(t("f_name"))}</th><th>${esc(t("f_dob"))}</th></tr>
    ${rows.map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(fmt(r.dob, { day: "numeric", month: "long" }))}${r.year_known ? " " + r.dob.slice(0, 4) : ""}</td></tr>`).join("")}</table></div>
    <p class="small muted">${esc(t("importBdaysNote"))}</p>
    <button class="btn primary block" data-act="saveBdays">${esc(t("saveBdays", rows.length))}</button>`, () => { A.saveBdays._rows = rows; });
}
A.saveBdays = async (d, btn) => {
  await busy(btn, async () => {
    try { const r = await api.birthdaysImport(A.saveBdays._rows); closeSheet(); await refresh(); toast(t("bdaysSaved", r.members + r.added, r.skipped)); render(); } catch (e) { toast(errMsg(e), true); }
  });
};
A.closeSheet = closeSheet;
A.retry = () => { D = null; render(); };
A.seedDemo = async (d, btn) => { await busy(btn, () => seedDemo()); toast(t("demoReady")); render(); };
A.notify = (d, btn) => enableNotifications(btn);
A.logout = async () => { await api.logout(); D = null; location.hash = "#/home"; render(); toast(t("signedOut")); };
A.signIn = () => A_signIn();
A.calPast = () => { LS.set("calPast", !LS.get("calPast", false)); render(); };
A.icsAll = () => download("hkbp-singapore.ics", ics(D.events.filter((e) => new Date(e.starts_at) > Date.now())), "text/calendar");
A.evMenu = (d) => {
  const e = D.events.find((x) => x.id === d.id); if (!e) return; const p = sgParts(e.starts_at); const g = e.group_id ? G(e.group_id) : null;
  const edit = e.group_id && isTeachG(e.group_id) ? canEdit(e.group_id) : isElder() || (e.group_id && canEdit(e.group_id));
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
// New event: first ask who it is for (whole church or one category), then the details.
A.newEvent = (d) => {
  if (d.id) return eventForm(D.events.find((x) => x.id === d.id));
  if (d.g) return eventForm({ group_id: d.g });
  const cats = D.groups.filter((g) => (isTeachG(g.id) ? canEdit(g.id) : isElder() || canEdit(g.id)));
  if (!isElder() && cats.length === 1) return eventForm({ group_id: cats[0].id });
  sheet(t("newEvent"), `<p class="muted">${esc(t("evWho"))}</p><div class="stack">
    ${isElder() ? `<button class="opt-card" data-act="evPick" data-g="">${ic("people")}<span><b>${esc(t("evGeneral"))}</b><small>${esc(t("evGeneralSub"))}</small></span>${ic("chev", "chev")}</button>` : ""}
    <button class="opt-card" data-act="evSpecific">${ic("groups")}<span><b>${esc(t("evSpecific"))}</b><small>${esc(t("evSpecificSub"))}</small></span>${ic("chev", "chev")}</button></div>`);
};
A.evSpecific = () => {
  const cats = D.groups.filter((g) => (isTeachG(g.id) ? canEdit(g.id) : isElder() || canEdit(g.id)));
  const list = (kind) => cats.filter((g) => g.kind === kind).map((g) => `<button class="gtile" data-act="evPick" data-g="${g.id}" style="--gc:${g.color}"><span class="gicon">${ic(g.icon)}</span><span class="gname"><b>${esc(gname(g))}</b></span>${ic("chev", "chev")}</button>`).join("");
  sheet(t("evPickCat"), `${list("sermon") ? `<h4>${esc(t("kindSermon"))}</h4><div class="glist">${list("sermon")}</div>` : ""}${list("service") ? `<h4>${esc(t("kindService"))}</h4><div class="glist">${list("service")}</div>` : ""}`);
};
A.evPick = (d) => eventForm({ group_id: d.g || null });
function eventForm(e) {
  const isNew = !e.id; const p = !isNew ? sgParts(e.starts_at) : { date: addDays(today(), 7), time: "10:00" };
  const g = e.group_id ? G(e.group_id) : null;
  sheet(t(isNew ? "newEvent" : "editEvent"), `<form class="form" data-form="event" data-id="${isNew ? "" : e.id}">
    <input type="hidden" name="group_id" value="${esc(e.group_id || "")}">
    <div class="for-chip" style="--gc:${g ? g.color : "var(--brand)"}">${ic(g ? g.icon : "people")}<span class="grow"><small>${esc(t("f_for"))}</small><b>${esc(g ? gname(g) : t("evGeneral"))}</b></span>${isNew ? `<button type="button" class="link" data-act="newEvent">${esc(t("change"))}</button>` : ""}</div>
    <label>${esc(t("f_title"))}<input name="title" required value="${esc(e.title || "")}"></label>
    <div class="row two"><label>${esc(t("f_date"))}<input type="date" name="date" required value="${p.date}"></label><label>${esc(t("f_time"))}<input type="time" name="time" required value="${p.time}"></label></div>
    <label>${esc(t("f_end"))}<input type="time" name="end" value="${e.ends_at ? sgParts(e.ends_at).time : ""}"></label>
    <label>${esc(t("f_place"))}<input name="place" value="${esc(e.place || "")}"></label>
    <label>${esc(t("f_remind"))}<select name="remind_min">${REMINDS.map((m) => `<option value="${m}" ${(e.remind_min ?? 1440) === m ? "selected" : ""}>${esc(remindLabel(m))}</option>`).join("")}</select></label>
    <label>${esc(t("f_notes"))}<textarea name="notes" rows="3">${esc(e.notes || "")}</textarea></label>
    <label class="check"><input type="checkbox" name="notify" ${isNew ? "checked" : ""}> ${esc(t(g ? "evNotifyGroup" : "evNotifyAll"))}</label>
    <button class="btn primary block">${esc(t("save"))}</button></form>`);
}
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
  <label>${esc(t("f_newPw"))}<input type="password" name="pw" required minlength="6" autocomplete="new-password"></label>
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
    <label>${esc(t("f_wed"))}<input type="date" name="wed" value="${esc(p.wed || "")}"></label>
    <label>${esc(t(d.id ? "f_pwKeep" : "f_password"))}<input name="password" autocomplete="off" placeholder="${esc(t("pwOptional"))}"></label>
    <h4>${esc(t("groupsRoles"))}</h4>
    <div class="roles">${D.groups.map((g) => `<label class="role-row" style="--gc:${g.color}"><span>${ic(g.icon)} ${esc(gname(g))}</span><select name="g_${g.id}"><option value="">—</option><option value="member" ${p.groups[g.id] === "member" ? "selected" : ""}>${esc(t("role_member"))}</option><option value="chair" ${p.groups[g.id] === "chair" ? "selected" : ""}>${esc(t("role_chair"))}</option>${g.id === "multimedia" ? ["maker", "checker"].map((r) => `<option value="${r}" ${p.groups[g.id] === r ? "selected" : ""}>${esc(t("role_" + r))}</option>`).join("") : ""}</select></label>`).join("")}</div>
    <label class="check"><input type="checkbox" name="is_admin" ${p.is_admin ? "checked" : ""}> ${esc(t("isAdmin"))}</label>
    <label class="check"><input type="checkbox" name="wa_optin" ${p.wa_optin ? "checked" : ""}> ${esc(t("waOptin"))}</label>
    <button class="btn primary block">${esc(t("save"))}</button>
    ${d.id && d.id !== me().id ? `<button type="button" class="btn block danger" data-act="del" data-kind="member" data-id="${p.id}">${ic("trash")} ${esc(t("deleteMember"))}</button>` : ""}
  </form>`);
};

// Member list file → rows. Column names are matched loosely (English, Indonesian or Batak headers).
const COLS = [
  ["alias", /nick|panggil|alias|call ?name/i], ["wa_optin", /^(whats ?app|wa)( ?opt.?in| daily ?bread| ?ya\/tidak)?$/i],
  ["phone", /phone|hp|telp|telepon|mobile|handphone|nomor|no\.? ?wa|contact|kontak/i], ["wed", /nikah|wedding|anniv|kawin|marri|pernikahan|perkawinan|pesta ?adat/i], ["dob", /birth|lahir|dob|tgl|tanggal|ulang/i],
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
  const n = norm(tok).replace(/\b(chair|ketua|member|anggota|maker|pembuat|checker|pemeriksa)\b/g, "").trim(); if (!n) return null;
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
      get("groups").split(/[;,\/\n]+/).forEach((tok) => { if (!tok.trim()) return; const g = matchGroup(tok); if (g) groups[g.id] = /chair|ketua/i.test(tok) ? "chair" : /maker|pembuat/i.test(tok) ? "maker" : /checker|pemeriksa/i.test(tok) ? "checker" : groups[g.id] || "member"; else unknown.push(tok.trim()); });
      get("chair").split(/[;,\/\n]+/).forEach((tok) => { if (!tok.trim() || /^(no|tidak|-)$/i.test(tok.trim())) return; const g = matchGroup(tok); if (g) groups[g.id] = "chair"; else unknown.push(tok.trim()); });
      const rawDob = get("dob"); const dob = parseDob(rawDob); const rawWed = get("wed"); const wed = parseDob(rawWed);
      const row = { name: get("name"), alias: get("alias"), phone: S.phone8(get("phone")), dob, wed, password: get("password"), groups, is_admin: yes(get("is_admin")), wa_optin: yes(get("wa_optin")) };
      row.problems = [!row.name && t("p_name"), !validPhone(row.phone) && t("p_phone"), rawDob && !dob && t("p_dob"), rawWed && !wed && t("p_wed"), unknown.length && t("p_group", unknown.join(", "))].filter(Boolean);
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
    ${rows.map((r) => `<tr class="${r.problems.length ? "bad" : ""}"><td>${esc(r.name)}${r.alias ? `<br><small>${esc(r.alias)}</small>` : ""}${r.is_admin ? ` <span class="badge admin">${esc(t("role_admin"))}</span>` : ""}</td><td>${esc(fmtPhone(r.phone))}</td><td>${esc(r.dob || "")}${r.wed ? `<br><small>💍 ${esc(r.wed)}</small>` : ""}</td><td>${r.password ? "••••" : `<small>${esc(t("keep"))}</small>`}</td><td>${esc(Object.entries(r.groups).map(([g, x]) => gname(G(g)) + (x === "chair" ? " ★" : "")).join(", "))}</td><td><small class="warn">${esc(r.problems.join("; "))}</small></td></tr>`).join("")}</table></div>
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
  const tp = e.target.closest("[data-tp]");
  if (tp) { const fm = tp.form; const ins = fm.querySelectorAll(`[data-tp="${tp.dataset.tp}"]`); fm[tp.dataset.tp].value = `${wTimeFix(ins[0].value)} - ${wTimeFix(ins[1].value)}`; return; }
  const f = e.target.closest("[data-filter]"); if (!f) return;
  const q = norm(f.value); document.querySelectorAll(f.dataset.filter).forEach((el) => (el.hidden = q && !el.dataset.q.includes(q)));
});
document.addEventListener("change", (e) => { const tp = e.target.closest && e.target.closest("[data-tp]"); if (tp) tp.value = wTimeFix(tp.value); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#sheet").hidden) closeSheet(); });

// ---------- forms ----------
F.login = async (f) => {
  try { await api.login(f.phone.value, f.pw.value); }
  catch (e) { if (e.code !== "needs_password") throw e; return firstPwSheet(f.phone.value); }
  D = null; await refresh(); afterSignIn(); backAfterLogin(); localReminders(); };
function afterSignIn() {
  if (viewMode() === "admin" && D && !hasRights()) { LS.set("view", "member"); toast(t("notAdmin")); }
  // Right after signing in, ask once for notifications (the phone only allows this after a tap).
  if ("Notification" in window && Notification.permission === "default") setTimeout(() => sheet(t("notifyAskTitle"), `<p class="muted">${esc(t("notifyAskBody"))}</p><button class="btn primary block" data-act="notifyNow">${ic("bell")} ${esc(t("notifyAskTitle"))}</button>`), 600);
}
A.notifyNow = async (d, btn) => { closeSheet(); await enableNotifications(btn); };
F.firstpw = async (f) => {
  if ((f.pw.value || "").length < 6) throw new S.AppError("short_password");
  if (f.pw.value !== f.pw2.value) throw new S.AppError("pw_mismatch");
  await api.firstPassword(f.dataset.phone, f.pw.value); closeSheet(); D = null; await refresh(); afterSignIn(); backAfterLogin(); toast(t("firstPwDone")); localReminders();
};
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
  const notify = f.notify.checked; const gid = f.group_id.value || null; const rem = +f.remind_min.value;
  const res = await api.save("event", { id: f.dataset.id || undefined, group_id: gid, title: f.title.value.trim(), starts_at: st, ends_at: en, place: f.place.value.trim(), notes: f.notes.value.trim(), remind_min: rem, notify });
  await refresh();
  const e = D.events.find((x) => x.id === (res && res.id)) || { id: res && res.id, title: f.title.value.trim(), starts_at: st, ends_at: en, remind_min: rem, group_id: gid };
  const who = gid ? gname(G(gid)) : t("wholeChurch");
  sheet(t("evSaved"), `<div class="done-ic">${ic("check")}</div>
    <p>${esc(t("evSavedCal", who))}</p>
    ${notify ? `<p class="small muted">${esc(t("evSavedPush", who))}</p>` : ""}
    ${rem > 0 ? `<p class="small muted">${esc(t("evSavedRemind", remindLabel(rem)))}</p>` : ""}
    <div class="stack"><button class="btn primary block" data-act="icsOne" data-id="${e.id}">${ic("calendar")} ${esc(t("addPhoneCal"))}</button>
    <a class="btn block" href="${gcal(e)}" target="_blank" rel="noopener">${ic("globe")} Google Calendar</a>
    <button class="btn block ghost" data-act="closeSheet">${esc(t("close"))}</button></div>`);
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
  await api.membersUpsert([{ name: f.name.value.trim(), alias: f.alias.value.trim(), phone: f.phone.value, dob: f.dob.value || null, wed: f.wed.value || null, password: f.password.value, groups, is_admin: f.is_admin.checked, wa_optin: f.wa_optin.checked }]);
  closeSheet(); await refresh(); toast(t("saved"));
};
A.waLink = (d) => {
  const g = G(d.g); if (!g) return;
  sheet(t("waLinkSet"), `<form class="form" data-form="walink" data-g="${g.id}">
    <p class="muted">${esc(t("waLinkLead", gname(g)))}</p>
    <ol class="small steps"><li>${esc(t("waLinkStep1"))}</li><li>${esc(t("waLinkStep2"))}</li><li>${esc(t("waLinkStep3"))}</li></ol>
    <label>${esc(t("waLinkField"))}<input name="link" type="url" inputmode="url" placeholder="https://chat.whatsapp.com/…" value="${esc(g.wa_link || "")}"></label>
    <button class="btn primary block">${esc(t("save"))}</button></form>`);
};
F.walink = async (f) => {
  const l = f.link.value.trim();
  if (l && !/^https:\/\/(chat\.whatsapp\.com|wa\.me|whatsapp\.com)\//.test(l)) throw new S.AppError("bad_link");
  await api.groupWaLink(f.dataset.g, l); closeSheet(); await refresh(); toast(t("saved"));
};
A.sendWish = (d) => {
  const g = G(d.g); if (!g) return;
  const people = D.people.filter((p) => g.id in (p.groups || {})); const text = wishText(g, celebrants(people, d.day || today()));
  if (!g.wa_link) { window.open(wa(text), "_blank", "noopener"); return; }
  // Both calls stay inside the tap, so the phone allows them.
  try { navigator.clipboard.writeText(text).catch(() => {}); } catch {}
  window.open(g.wa_link, "_blank", "noopener"); toast(t("wishCopied"));
};
A.calSub = async () => {
  if (api.mode !== "remote" || isGuest()) { sheet(t("calSub"), `<p class="muted">${esc(t(isGuest() ? "signInCat" : "calSubDemo"))}</p>`); return; }
  const url = api.calUrl(await api.calToken()); const hook = url.replace(/^https:/, "webcal:");
  sheet(t("calSub"), `<div class="form"><p class="muted">${esc(t("calSubLead"))}</p>
    <a class="btn primary block" href="${esc(hook)}">${ic("calendar")} ${esc(t("calSubIos"))}</a>
    <button class="btn block" data-act="calCopy" data-url="${esc(url)}">${ic("share")} ${esc(t("calSubCopy"))}</button>
    <ol class="small steps"><li>${esc(t("calSubAnd1"))}</li><li>${esc(t("calSubAnd2"))}</li><li>${esc(t("calSubAnd3"))}</li></ol>
    <p class="small muted">${esc(t("calSubNote"))}</p></div>`);
};
A.calCopy = async (d) => { try { await navigator.clipboard.writeText(d.url); toast(t("copied")); } catch { toast(d.url); } };
// ---------- auto-save: typed text is kept on this phone until the form is sent ----------
const DRAFT_FORMS = new Set(["post", "update", "event", "bread", "berita", "beritalink", "poll", "member", "group", "roster", "bday", "bdaylink", "holder", "teacher", "offfile", "wimplink", "wimpalllink"]);
const DRAFT_DAYS = 14;
const draftKey = (f) => "draft:" + Object.keys(f.dataset).sort().map((k) => k + "=" + f.dataset[k]).join("&") + (f.closest("#sheet") ? "" : "@" + location.hash.split("?")[0]);
const draftFields = (f) => [...f.elements].filter((el) => el.name && !/^(file|password|hidden|submit|button)$/.test(el.type));
function draftSave(f) {
  if (f.dataset.form === "finance") return finDraftSave(f);
  if (!DRAFT_FORMS.has(f.dataset.form)) return;
  const vals = draftFields(f).map((el) => [el.name, el.type === "checkbox" || el.type === "radio" ? el.checked : el.value]);
  LS.set(draftKey(f), { at: Date.now(), vals });
}
function draftRestore(root) {
  let restored = false;
  (root || document).querySelectorAll("form[data-form]").forEach((f) => {
    if (!DRAFT_FORMS.has(f.dataset.form)) return;
    const d = LS.get(draftKey(f), null); if (!d || !d.vals) return;
    if (Date.now() - (d.at || 0) > DRAFT_DAYS * 864e5) { LS.set(draftKey(f), null); return; }
    const els = draftFields(f); let changed = false;
    d.vals.forEach(([n, v], i) => { const el = els[i]; if (!el || el.name !== n) return;
      if (el.type === "checkbox" || el.type === "radio") { if (el.checked !== v) { el.checked = v; changed = true; } }
      else if (el.value !== v) { el.value = v; changed = true; } });
    if (changed) restored = true;
  });
  if (restored) toast(t("draftRestored"));
}
const draftClear = (f) => { if (f.dataset.form === "finance") LS.set(finDraftKey(f), null); else LS.set(draftKey(f), null); };
const draftLater = (e) => { const f = e.target.closest && e.target.closest("form[data-form]"); if (!f) return; draftSave.last = f; draftSave(f); };
document.addEventListener("input", draftLater); document.addEventListener("change", draftLater);
// Save right away when leaving: another page, closing the pop-up, or switching apps.
const draftFlush = () => { const f = draftSave.last; if (f && f.isConnected) draftSave(f); };
window.addEventListener("pagehide", draftFlush); document.addEventListener("visibilitychange", () => { if (document.hidden) draftFlush(); });
document.addEventListener("click", (e) => { if (e.target.closest && e.target.closest("[data-act=closeSheet], #sheet .sheet-backdrop")) draftFlush(); }, true);

document.addEventListener("submit", async (e) => {
  const f = e.target.closest("[data-form]"); if (!f) return; e.preventDefault();
  const btn = f.querySelector("button:not([type=button])");
  draftFlush(); const key = f.dataset.form === "finance" ? finDraftKey(f) : draftKey(f);
  await busy(btn, async () => { try { await F[f.dataset.form](f); LS.set(key, null); render(); } catch (err) { console.error(err); toast(errMsg(err), true); } });
});

// ---------- demo data (this phone only) ----------
async function seedDemo() {
  const day = today(); const ym = monthKey(day); const md = (n) => addDays(day, n).slice(5);
  await api.setupAdmin("Demo Admin", "80000001", "demo");
  await api.login("80000001", "demo");
  const people = [
    { name: "Pdt. Jonathan Sitompul", alias: "Amang Pandita", phone: "80000002", dob: "1975-" + md(3), password: "demo", groups: { parhalado: "chair", ama: "member", chairman: "chair" } },
    { name: "St. Bonar Hutapea", alias: "Amang Bonar", phone: "80000003", dob: "1968-" + md(0), password: "demo", groups: { parhalado: "member", ama: "chair", "song-leader": "member", secretary: "chair" } },
    { name: "Ruth Sinaga", alias: "Inang Ruth", phone: "80000004", dob: "1980-" + md(12), wed: "2005-" + md(0), password: "demo", groups: { ina: "chair", "song-leader": "chair", treasurer: "chair" } },
    { name: "Rina Simanjuntak", alias: "Rina", phone: "80000005", dob: "1999-" + md(5), password: "demo", groups: { naposo: "tmaker", band: "member", multimedia: "member" } },
    { name: "Josua Pardede", alias: "Josua", phone: "80000006", dob: "2001-" + md(20), password: "demo", groups: { naposo: "teacher", multimedia: "chair", band: "chair" } },
    { name: "Grace Tobing", alias: "Grace", phone: "80000007", dob: "1995-" + md(40), password: "demo", groups: { "sekolah-minggu": "tmaker", musik: "member" } },
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
  await api.save("poll", { group_id: "naposo", question: "Tema retreat Naposo tahun depan?", options: ["Panggilan & Pelayanan", "Iman di Tempat Kerja", "Keluarga & Persahabatan"], status: "open" });
  await api.save("poll", { group_id: "sekolah-minggu", question: "Lagu pujian favorit minggu ini?", options: ["Yesus Sayang Semua", "Allah Peduli", "Kasih-Nya"] });
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

// ---------- Youth and Sunday School teachers, and class polls ----------
// Starting Teacher Makers, given by the admin (YB). Phones come from the member list; the admin fills in any that are missing in a pop-up.
const TEACH_SEED = { "sekolah-minggu": ["@me", "Dien Pasaribu"], naposo: ["@me", "Richard Siburian", "Royen Gultom"] };
const normName = (n) => String(n || "").toLowerCase().replace(/^(pdt|st|sintua|cst|bapak|ibu|sdr|sdri|kak|bang)\.?\s+/g, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
function seedPerson(name) {
  if (name === "@me") return { name: D.me.name, phone: D.me.phone };
  const parts = normName(name).split(" ");
  const hit = D.people.filter((p) => { const n = normName(p.name); return parts.every((w) => n.split(" ").includes(w)); });
  return { name, phone: hit.length === 1 ? hit[0].phone || "" : "" };
}
const teachSeedMissing = (only) => Object.entries(TEACH_SEED).filter(([g]) => !only || g === only).flatMap(([g, list]) => list.map((n) => ({ g, ...seedPerson(n) }))
  .filter((x) => !D.people.some((p) => p.phone && p.phone === x.phone && (p.groups || {})[x.g] === "tmaker")));
A.teachSetup = (d = {}) => {
  const only = d.g && TEACH_SEED[d.g] ? d.g : null;
  const rows = Object.entries(TEACH_SEED).filter(([g]) => !only || g === only).map(([g, list]) => `<h4>${esc(gname(G(g)))} · ${esc(t("role_tmaker"))}</h4>` + list.map((n, i) => {
    const x = seedPerson(n); const done = D.people.some((p) => p.phone && p.phone === x.phone && (p.groups || {})[g] === "tmaker");
    return `<div class="ts-row"><label>${esc(t("f_name"))}<input name="n_${g}_${i}" value="${esc(x.name)}" ${n === "@me" ? "readonly" : ""}></label>
      <label>${esc(t("f_phone"))}${done ? ` <span class="badge chair">${ic("check")}</span>` : ""}<div class="phone-in"><span>+65</span><input name="p_${g}_${i}" inputmode="numeric" placeholder="8123 4567" value="${esc(x.phone)}"></div></label></div>`;
  }).join("")).join("");
  sheet(t("tsTitle"), `<form class="form" data-form="tsetup" data-g="${only || ""}"><p class="muted">${esc(t("tsLead"))}</p>${rows}
    <button class="btn primary block">${ic("check")} ${esc(t("tsSave"))}</button></form>`, (el) => { const e = [...el.querySelectorAll("input[name^=p_]")].find((x) => !x.value); if (e) e.focus(); });
};
F.tsetup = async (f) => {
  const missing = []; let n = 0;
  for (const [g, list] of Object.entries(TEACH_SEED).filter(([k]) => !f.dataset.g || k === f.dataset.g)) for (let i = 0; i < list.length; i++) {
    const name = f["n_" + g + "_" + i].value.trim(); const ph = f["p_" + g + "_" + i].value;
    if (!S.phone8(ph)) { missing.push(name); continue; }
    if (!validPhone(ph)) throw new S.AppError("bad_phone");
    if (D.people.some((p) => p.phone === S.phone8(ph) && (p.groups || {})[g] === "tmaker")) continue;
    await api.setTeacher(ph, g, "tmaker", name); n++;
  }
  closeSheet(); await refresh();
  toast(missing.length ? t("tsMissing", [...new Set(missing)].join(", ")) : t("tsDone"), !!missing.length);
};
A.tmVerify = (d) => sheet(t("tmVerify"), `<form class="form" data-form="tmcheck" data-g="${esc(d.g)}"><p class="muted">${esc(t("tmVerifyLead"))}</p>
  <label>${esc(t("f_phone"))}<div class="phone-in"><span>+65</span><input name="phone" inputmode="numeric" required placeholder="8123 4567" autocomplete="tel"></div></label>
  <button class="btn primary block">${esc(t("verify"))}</button></form>`, (el) => el.querySelector("input").focus());
F.tmcheck = async (f) => {
  // Must be the signed-in member's own number and a Teacher Maker of this class. The server checks every change again.
  if (S.phone8(f.phone.value) !== D.me.phone || !isTMaker(f.dataset.g)) { setTmOk(""); closeSheet(); toast(t("tmReject"), true); return; }
  setTmOk(f.dataset.g); closeSheet(); toast(t("tmOk"));
};

function teachersTab(gid, list) {
  const mk = canEdit(gid); const order = { tmaker: 0, teacher: 1 };
  const rows = list.slice().sort((a, b) => order[a.groups[gid]] - order[b.groups[gid]] || a.name.localeCompare(b.name)).map((p) => `<div class="li"><span class="avatar">${esc(initials(p.name))}</span>
    <span class="grow"><b>${esc(p.name)}</b><small>${esc(t("role_" + p.groups[gid]))}${p.phone ? " · " + esc(fmtPhone(p.phone)) : ""}</small></span>
    ${p.phone ? `<a class="icon-btn wa" href="https://wa.me/65${p.phone}" target="_blank" rel="noopener" aria-label="WhatsApp">${ic("wa")}</a>` : ""}
    ${mk && p.phone && p.id !== D.me.id ? `<button class="icon-btn" data-act="rmTeacher" data-g="${gid}" data-phone="${esc(p.phone)}" aria-label="${esc(t("delete"))}">${ic("trash")}</button>` : ""}</div>`).join("");
  return `<div class="card"><div class="card-h"><h3>${ic("people")} ${esc(t("t_teachers"))}</h3>${mk ? `<button class="btn sm primary" data-act="addTeacher" data-g="${gid}">${ic("plus")} ${esc(t("addTeacher"))}</button>` : ""}</div>
    <p class="small muted">${esc(t("teachersLead"))}</p>
    ${rows || `<p class="muted small">${esc(t("noTeachers"))}</p>`}
    ${isAdmin() ? `<button class="btn sm ghost" data-act="teachSetup" data-g="${gid}">${ic("gear")} ${esc(t("tsTitle"))}</button>` : ""}</div>`;
}
A.addTeacher = (d) => sheet(t("addTeacher"), `<form class="form" data-form="teacher" data-g="${esc(d.g)}"><p class="muted">${esc(t("addTeacherLead"))}</p>
  <label>${esc(t("f_teacherRole"))}<select name="role"><option value="teacher">${esc(t("role_teacher"))} · ${esc(t("teacherSub"))}</option><option value="tmaker" ${d.r === "tmaker" ? "selected" : ""}>${esc(t("role_tmaker"))} · ${esc(t("tmakerSub"))}</option></select></label>
  <label>${esc(t("f_phone"))}<div class="phone-in"><span>+65</span><input name="phone" inputmode="numeric" required placeholder="8123 4567"></div></label>
  <label>${esc(t("f_nameIfNew"))}<input name="name" autocomplete="off"></label>
  <label class="check"><input type="checkbox" name="more"> ${esc(t("addAnother"))}</label>
  <button class="btn primary block">${ic("plus")} ${esc(t("addTeacher"))}</button></form>`, (el) => el.querySelector("input[name=phone]").focus());
F.teacher = async (f) => {
  const g = f.dataset.g; const role = f.role.value;
  const r = await api.setTeacher(f.phone.value, g, role, f.name.value.trim());
  const more = f.more.checked; await refresh(); toast(t("teacherAdded", r.name, t("role_" + role)));
  closeSheet(); if (more) setTimeout(() => A.addTeacher({ g, r: role }), 220);
};
A.rmTeacher = async (d, btn) => {
  if (btn.dataset.sure !== "1") { btn.dataset.sure = "1"; toast(t("tapAgain")); return; }
  await api.setTeacher(d.phone, d.g, ""); await refresh(); toast(t("saved")); render();
};

function pollsTab(gid, list) {
  const mk = canEdit(gid);
  const order = { open: 0, draft: 1, closed: 2 };
  const sorted = list.slice().sort((a, b) => order[a.status] - order[b.status] || b.created_at.localeCompare(a.created_at));
  return (mk ? `<button class="btn primary block" data-act="newPoll" data-g="${gid}">${ic("plus")} ${esc(t("newPoll"))}</button>` : "")
    + (canRunPoll(gid) && !mk ? `<p class="small muted center">${esc(t("teacherPollLead"))}</p>` : "")
    + (sorted.length ? sorted.map(pollCard).join("") : empty(t("noPolls"), "check"));
}
function pollCard(p) {
  const gid = p.group_id; const run = canRunPoll(gid); const mk = canEdit(gid);
  const mine = p.mine || []; const counts = p.counts; const total = p.voters || 0;
  const bars = counts ? `<div class="poll-res">${p.options.map((o, i) => { const pct = total ? Math.round((counts[i] * 100) / total) : 0;
    return `<div class="pr ${mine.includes(i) ? "mine" : ""}"><span class="grow">${esc(o)}</span><b>${pct}%</b><small>${counts[i]}</small><i style="width:${pct}%"></i></div>`; }).join("")}</div>` : "";
  const form = p.status === "open" ? `<form class="form poll-form" data-form="vote" data-id="${p.id}">
    ${p.options.map((o, i) => `<label class="opt"><input type="${p.multi ? "checkbox" : "radio"}" name="c" value="${i}" ${mine.includes(i) ? "checked" : ""}><span>${esc(o)}</span></label>`).join("")}
    <button class="btn primary block">${esc(t(mine.length ? "changeVote" : "vote"))}</button></form>` : "";
  const share = `📊 *${p.question}*\n${p.options.map((o, i) => `${i + 1}. ${o}`).join("\n")}\n\n${t("pollVoteIn")}: ${appUrl()}#/g/${gid}?tab=polls`;
  return `<article class="card poll ${p.status}" style="--gc:${(G(gid) || {}).color}">
    <div class="meta"><span class="badge ${p.status === "open" ? "chair" : "member"}">${esc(t("poll_" + p.status))}</span> ${esc(fmt(p.created_at, { day: "numeric", month: "short" }))} · ${esc(p.author_name || "")}${p.multi ? " · " + esc(t("pollMultiShort")) : ""}</div>
    <h3>${esc(p.question)}</h3>
    ${form}
    ${bars || (p.status !== "draft" ? `<p class="small muted">${esc(t("pollHidden"))}</p>` : "")}
    <p class="small muted">${esc(t("votes", total))}${p.opened_by && p.status !== "draft" ? " · " + esc(t("pollBy", p.opened_by)) : ""}</p>
    <div class="row end">
      ${p.status !== "draft" ? `<a class="btn sm wa" href="${wa(share)}" target="_blank" rel="noopener">${ic("wa")}</a>` : ""}
      ${run && p.status !== "open" ? `<button class="btn sm primary" data-act="pollState" data-id="${p.id}" data-s="open">${esc(t(p.status === "closed" ? "pollReopen" : "pollStart"))}</button>` : ""}
      ${run && p.status === "open" ? `<button class="btn sm" data-act="pollState" data-id="${p.id}" data-s="closed">${esc(t("pollEnd"))}</button>` : ""}
      ${mk ? `<button class="btn sm danger" data-act="del" data-kind="poll" data-id="${p.id}" aria-label="${esc(t("delete"))}">${ic("trash")}</button>` : ""}
    </div></article>`;
}
A.newPoll = (d) => sheet(t("newPoll"), `<form class="form" data-form="poll" data-g="${esc(d.g)}">
  <label>${esc(t("f_question"))}<input name="question" required maxlength="300"></label>
  <label>${esc(t("f_options"))}<textarea name="options" rows="5" required placeholder="${esc(t("f_optionsPh"))}"></textarea></label>
  <label class="check"><input type="checkbox" name="multi"> ${esc(t("pollMulti"))}</label>
  <label class="check"><input type="checkbox" name="open"> ${esc(t("pollOpenNow"))}</label>
  <label class="check"><input type="checkbox" name="notify"> ${esc(t("notifyGroup"))}</label>
  <button class="btn primary block">${esc(t("save"))}</button></form>`, (el) => el.querySelector("input").focus());
F.poll = async (f) => {
  const options = f.options.value.split("\n").map((x) => x.replace(/^\s*(\d+[.)]|[-•*])\s*/, "").trim()).filter(Boolean);
  if (options.length < 2 || options.length > 12) throw new S.AppError("poll_opts");
  await api.save("poll", { group_id: f.dataset.g, question: f.question.value.trim(), options, multi: f.multi.checked, status: f.open.checked ? "open" : "draft", notify: f.notify.checked });
  closeSheet(); await refresh(); toast(t("saved"));
};
F.vote = async (f) => {
  const c = [...f.querySelectorAll("input[name=c]:checked")].map((x) => +x.value);
  if (!c.length) throw new S.AppError("poll_pick");
  await api.vote(f.dataset.id, c); await refresh(); toast(t("voted"));
};
A.pollState = (d, btn) => busy(btn, async () => { await api.pollState(d.id, d.s); await refresh(); toast(t(d.s === "open" ? "pollStarted" : "pollEnded")); render(); });

// ---------- Secretary, Treasurer, Chairman (office categories) ----------
// Only the office holders (added by the admin by phone number) and the admin see these; the server hides them from everyone else.
// Opening one asks for the phone number again (once per session), and a number that is not an office holder is turned away.
const isOffice = () => !!(D && (D.me.is_admin || D.groups.some((g) => g.kind === "office" && g.id in (D.me.groups || {}))));
const officeGroups = () => D.groups.filter((g) => g.kind === "office");
const holders = (gid) => D.people.filter((p) => gid in (p.groups || {}));
const offOk = () => { try { return !!D && sessionStorage.getItem("hkbp.off") === D.me.phone; } catch { return false; } };
const setOffOk = (v) => { try { v ? sessionStorage.setItem("hkbp.off", v) : sessionStorage.removeItem("hkbp.off"); } catch {} };
const canUpload = (gid) => manage() && (D.me.is_admin || !!roleIn(gid));
const fmtSize = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round((n || 0) / 1024)) + " KB");
const fmtID = (iso) => new Intl.DateTimeFormat("id-ID", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" }).format(new Date(iso + "T12:00:00+08:00"));
const dmy = (iso) => `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const lastPost = (gid, kind) => D.posts.filter((p) => p.group_id === gid && p.kind === kind).sort((a, b) => (b.day || b.created_at).localeCompare(a.day || a.created_at))[0];

function officeHome() {
  if (!isOffice()) return "";
  return `${finPrompt()}<h3 class="sec-h">${ic("lock")} ${esc(t("officeTitle"))}</h3><div class="glist">${officeGroups().map((g) => groupTile(g, esc(t("officeSub")))).join("")}</div>`;
}

R.office = (gid) => {
  const g = G(gid);
  if (isGuest()) return shell("#/home", signInCard(t("signInCat")), { back: "#/home" });
  if (!g || g.kind !== "office" || !isOffice()) return shell("#/home", empty(t("officeOnly"), "lock"), { back: "#/home" });
  if (!offOk()) return shell("#/home", `<div class="card center pad">${ic("lock")}<p>${esc(t("officeVerifyLead"))}</p><button class="btn primary" data-act="officePrompt">${esc(t("verify"))}</button></div>`, { back: "#/home", title: gname(g), sub: t("officeTitle") });
  const files = (D.files || []).filter((f) => f.group_id === gid);
  const hs = holders(gid);
  return shell("#/home", `
    <section class="ghero slim" style="--gc:${g.color}"><span class="gicon xl">${ic(g.icon)}</span>
      <div><h2>${esc(gname(g))}</h2><p>${esc(t("officeLead"))}</p></div></section>
    <div class="chips office-tabs">${officeGroups().map((o) => `<a class="chip ${o.id === gid ? "on" : ""}" href="#/o/${o.id}" style="--gc:${o.color}">${esc(gname(o))}</a>`).join("")}</div>
    ${gid === "secretary" ? wartaBlock() : ""}
    ${gid === "treasurer" ? financeBlock() : ""}
    <div class="card"><div class="card-h"><h3>${ic("file")} ${esc(t("officeFiles"))}</h3>${canUpload(gid) && gid !== "treasurer" ? `<button class="btn sm primary" data-act="uploadFile" data-g="${gid}">${ic("upload")} ${esc(t("uploadFile"))}</button>` : ""}</div>
      ${files.length ? files.map(fileRow).join("") : `<p class="muted small">${esc(t("noFiles"))}</p>`}</div>
    <div class="card"><div class="card-h"><h3>${ic("people")} ${esc(t("officeHolders"))}</h3>${isAdmin() ? `<button class="btn sm" data-act="addHolder" data-g="${gid}">${ic("plus")} ${esc(t("addHolder"))}</button>` : ""}</div>
      ${hs.length ? hs.map((p) => `<div class="li"><span class="avatar">${esc(initials(p.name))}</span><span class="grow"><b>${esc(p.name)}</b><small>${esc(fmtPhone(p.phone))}</small></span>
        ${p.phone ? `<a class="icon-btn wa" href="https://wa.me/65${p.phone}" target="_blank" rel="noopener" aria-label="WhatsApp">${ic("wa")}</a>` : ""}
        ${isAdmin() ? `<button class="icon-btn" data-act="rmHolder" data-g="${gid}" data-phone="${esc(p.phone || "")}" aria-label="${esc(t("delete"))}">${ic("trash")}</button>` : ""}</div>`).join("") : `<p class="muted small">${esc(t("noHolders"))}</p>`}</div>`,
    { back: "#/home", title: gname(g), sub: t("officeTitle") });
};
function fileRow(f) {
  return `<div class="li"><span class="ftype ${fileKind(f)}">${esc(fileKind(f).toUpperCase())}</span>
    <span class="grow"><b>${esc(f.title || f.file_name)}</b><small>${esc(fmt(f.created_at, { day: "numeric", month: "short" }))} · ${esc(f.author_name || "")} · ${esc(fmtSize(f.size))}${f.note ? " · " + esc(f.note) : ""}</small></span>
    <button class="icon-btn" data-act="openOffFile" data-id="${f.id}" aria-label="${esc(t("openOriginal"))}">${ic("file")}</button>
    <button class="icon-btn wa" data-act="shareFile" data-id="${f.id}" aria-label="WhatsApp">${ic("wa")}</button>
    ${canUpload(f.group_id) ? `<button class="icon-btn" data-act="del" data-kind="file" data-id="${f.id}" aria-label="${esc(t("delete"))}">${ic("trash")}</button>` : ""}</div>`;
}

// Phone check when opening an office category.
function officePrompt() {
  if (!$("#sheet").hidden) return;
  sheet(t("officeVerify"), `<form class="form" data-form="offcheck"><p class="muted">${esc(t("officeVerifyLead"))}</p>
    <label>${esc(t("f_phone"))}<div class="phone-in"><span>+65</span><input name="phone" inputmode="numeric" required placeholder="8123 4567" autocomplete="tel"></div></label>
    <button class="btn primary block">${esc(t("verify"))}</button></form>`, (el) => el.querySelector("input").focus());
}
A.officePrompt = officePrompt;
F.offcheck = async (f) => {
  // Must be the signed-in member's own number, and that number must be an office holder (or the admin). The server checks every read again.
  if (S.phone8(f.phone.value) !== D.me.phone || !isOffice()) { setOffOk(""); closeSheet(); toast(t("officeReject"), true); location.hash = "#/home"; return; }
  setOffOk(D.me.phone); closeSheet(); toast(t("officeOk"));
  if (D.me.is_admin && manage() && !officeGroups().some((g) => holders(g.id).length)) { hydrate.offAsked = true; setTimeout(() => A.addHolder({ g: location.hash.split("/")[2] }), 450); }
};

// Admin: who holds each office, by phone number.
A.addHolder = (d = {}) => sheet(t("addHolder"), `<form class="form" data-form="holder"><p class="muted">${esc(t("addHolderLead"))}</p>
  <label>${esc(t("officeRole"))}<select name="g">${officeGroups().map((o) => `<option value="${o.id}" ${o.id === d.g ? "selected" : ""}>${esc(gname(o))}</option>`).join("")}</select></label>
  <label>${esc(t("f_phone"))}<div class="phone-in"><span>+65</span><input name="phone" inputmode="numeric" required placeholder="8123 4567"></div></label>
  <label>${esc(t("f_nameIfNew"))}<input name="name" autocomplete="off"></label>
  <label class="check"><input type="checkbox" name="more" checked> ${esc(t("addAnother"))}</label>
  <button class="btn primary block">${ic("plus")} ${esc(t("addHolder"))}</button></form>`, (el) => el.querySelector("input[name=phone]").focus());
F.holder = async (f) => {
  const g = f.g.value; const r = await api.setRole(f.phone.value, g, "chair", f.name.value.trim());
  const more = f.more.checked; await refresh(); toast(t("holderAdded", r.name, gname(G(g))));
  closeSheet(); if (more) setTimeout(() => A.addHolder({ g }), 220);
};
A.rmHolder = async (d, btn) => {
  if (btn.dataset.sure !== "1") { btn.dataset.sure = "1"; toast(t("tapAgain")); return; }
  await api.setRole(d.phone, d.g, ""); await refresh(); toast(t("saved")); render();
};

// Files: upload, open, and share to WhatsApp with a pop-up.
const offCache = {};
const toB64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] || ""); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
async function offFile(id) {
  if (!offCache[id]) {
    const r = await api.file(id); if (!r || !r.file_b64) throw new S.AppError("server");
    const bin = atob(r.file_b64); const u8 = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    offCache[id] = new File([u8], r.file_name || "file", { type: r.mime || "application/octet-stream" });
  }
  return offCache[id];
}
async function saveOfficeFile(gid, file, title, note, notify) {
  if (file.size > 10 * 1048576) throw new S.AppError("file_too_big");
  const res = await api.save("file", { group_id: gid, title: title || file.name.replace(/\.[^.]+$/, ""), note: note || null, file_name: file.name, mime: file.type || "application/octet-stream", file_b64: await toB64(file), size: file.size, notify: !!notify });
  offCache[res.id] = file; await refresh(); return res;
}
A.uploadFile = (d) => sheet(t("uploadFile"), `<form class="form" data-form="offfile" data-g="${d.g}">
  <label>${esc(t("f_file"))}<input type="file" name="file" required></label>
  <label>${esc(t("f_title"))}<input name="title" placeholder="${esc(t("fileTitlePh"))}"></label>
  <label>${esc(t("f_note"))}<input name="note"></label>
  <label class="check"><input type="checkbox" name="notify" checked> ${esc(t("notifyOffice"))}</label>
  <p class="small muted">${esc(t("fileLimit"))}</p>
  <button class="btn primary block">${ic("upload")} ${esc(t("uploadFile"))}</button></form>`);
F.offfile = async (f) => {
  const file = f.file.files[0]; if (!file) return;
  const res = await saveOfficeFile(f.dataset.g, file, f.title.value.trim(), f.note.value.trim(), f.notify.checked);
  toast(t("saved")); setTimeout(() => shareSheet(file, res.title, res.group_id), 50);
};
A.openOffFile = (d, btn) => busy(btn, async () => {
  try { const f = await offFile(d.id); if (/pdf/.test(f.type) || /\.pdf$/i.test(f.name)) await showPdf(f, f.name); else if (/image/.test(f.type)) window.open(URL.createObjectURL(f), "_blank"); else download(f.name, f); }
  catch (e) { toast(errMsg(e), true); }
});
A.shareFile = async (d, btn) => {
  const meta = (D.files || []).find((x) => x.id === d.id); if (!meta) return;
  try { const f = await busy(btn, () => offFile(d.id)); shareSheet(f, meta.title || meta.file_name, meta.group_id); } catch (e) { toast(errMsg(e), true); }
};
function shareSheet(file, title, gid) {
  Object.assign(shareSheet, { file, title, gid });
  const canFiles = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  const isPdf = /pdf$/i.test(file.type || "") || /\.pdf$/i.test(file.name || "");
  sheet(t("waShareTitle"), `<p class="muted">${esc(t("waShareLead", title))}</p><div class="stack">
    ${isPdf ? `<button class="opt-card" data-act="pdfPeek">${ic("screen")}<span><b>${esc(t("pdfPeek"))}</b><small>${esc(t("pdfPeekSub"))}</small></span>${ic("chev", "chev")}</button>` : ""}
    <button class="opt-card" data-act="waSendFile">${ic("wa")}<span><b>${esc(t("waSendFile"))}</b><small>${esc(t(canFiles ? "waSendFileSub" : "waSendFileDl"))}</small></span>${ic("chev", "chev")}</button>
    <a class="opt-card" href="${wa(`📎 *${title}*\n${gname(G(gid))} · HKBP Singapore\n${appUrl()}#/o/${gid}`)}" target="_blank" rel="noopener">${ic("link")}<span><b>${esc(t("waSendLink"))}</b><small>${esc(t("waSendLinkSub"))}</small></span>${ic("chev", "chev")}</a>
    <button class="btn ghost block" data-act="closeSheet">${esc(t("notNow"))}</button></div>`);
}
A.pdfPeek = (d, btn) => busy(btn, async () => { try { await showPdf(shareSheet.file, shareSheet.title, true); } catch (e) { console.warn(e); toast(errMsg(e), true); } });
A.waSendFile = async () => {
  const f = shareSheet.file; if (!f) return; const text = `${shareSheet.title} · HKBP Singapore`;
  if (navigator.canShare && navigator.canShare({ files: [f] })) {
    // The phone's share sheet: pick WhatsApp, then the group or person. The file itself is sent.
    try { await navigator.share({ files: [f], title: shareSheet.title, text }); closeSheet(); } catch (e) { if (e.name !== "AbortError") toast(t("err_server"), true); }
    return;
  }
  download(f.name, f); window.open(wa(`${text}\n${t("waAttachHint")}`), "_blank");
};

// ---------- Treasurer: Warta Keuangan (used by the Secretary's Warta Jemaat) ----------
// Warta Keuangan: the treasurer types each part by hand every week. The Warta PDF cannot be made without it.
const finFor = (day) => D.posts.find((p) => p.group_id === "treasurer" && p.kind === "finance" && p.day === day);
function financeBlock() {
  const sun = nextSunday(); const cur = finFor(sun); const p = cur || lastPost("treasurer", "finance");
  return `<div class="card"><div class="card-h"><h3>${ic("coins")} ${esc(t("financeTitle"))}</h3>${canUpload("treasurer") ? `<button class="btn sm primary" data-act="financeForm">${ic("edit")} ${esc(t(cur ? "financeEdit" : "financeNew"))}</button>` : ""}</div>
    ${cur ? "" : `<div class="notice warn">${ic("bell")} <span>${esc(t("finNeeded", fmtID(sun)))}</span></div>`}
    <p class="small muted">${esc(t("financeLead"))}</p>
    ${p ? `<p class="small"><b>Warta ${esc(fmtID(p.day))}</b> · ${esc(p.author_name || "")}</p><p class="pre small">${esc(p.body)}</p>` : `<p class="muted small">${esc(t("noFinance"))}</p>`}</div>`;
}
function finPrompt() {
  if (!isOffice() || !canUpload("treasurer") || !(D.me.is_admin || "treasurer" in (D.me.groups || {}))) return "";
  const sun = nextSunday(); if (finFor(sun)) return "";
  return `<a class="card notice-card" href="#/o/treasurer">${ic("coins")}<span class="grow"><b>${esc(t("finNeededTitle"))}</b><small>${esc(t("finNeeded", fmtID(sun)))}</small></span>${ic("chev", "chev")}</a>`;
}
// Treasurer form, laid out like the 18 Oct Warta Keuangan: A. Persembahan (each offering with one or more currency amounts),
// B. Persembahan Bulanan and C. Dana Pembangunan Gereja (name and months). More sections can be added (name, optional amounts).
// The text for the Warta is built from the fields; letters follow the order of the sections.
const FIN_A = ["Persembahan Ibadah Umum", "Sekolah Minggu", "Remaja"];
const FIN_DEFAULT = [{ title: "PERSEMBAHAN", type: "amt" }, { title: "PERSEMBAHAN BULANAN", type: "when" }, { title: "DANA PEMBANGUNAN GEREJA", type: "when" }];
const CUR_TOP = ["SGD", "IDR", "MYR", "USD", "EUR", "AUD", "GBP", "JPY", "CNY", "HKD"];
const CURS = (() => { let all = []; try { all = Intl.supportedValuesOf("currency"); } catch (e) { all = CUR_TOP.slice(); } return CUR_TOP.concat(all.filter((c) => !CUR_TOP.includes(c))); })();
const curName = (c) => { try { return new Intl.DisplayNames([lang === "en" ? "en" : "id"], { type: "currency" }).of(c); } catch (e) { return c; } };
const finNum = (x) => { const n = parseFloat(String(x || "").replace(/[^\d.]/g, "")); return isFinite(n) && String(x || "").trim() ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""; };
const finRaw = (x) => String(x || "").replace(/,/g, "");
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
function finParse(body) {
  const out = { date: "", secs: [] }; let cur = null;
  String(body || "").split(/\n/).forEach((l0) => {
    const l = l0.trim(); const h = l.match(/^([A-Z])[.)]\s+(.*)$/);
    if (h && h[2] === h[2].toUpperCase().replace(/\d.*$/, "") + h[2].slice(h[2].toUpperCase().replace(/\d.*$/, "").length) && /[A-Z]{4}/.test(h[2])) {
      let title = h[2].trim();
      if (!out.secs.length) { const m = title.match(/^(PERSEMBAHAN)\s+(.*)$/i); if (m) { title = m[1].toUpperCase(); out.date = m[2].trim(); } }
      cur = { title, type: /BULANAN|PEMBANGUNAN/i.test(title) ? "when" : "amt", items: [] }; out.secs.push(cur); return;
    }
    if (!cur || !l || /^[-–]$/.test(l)) return;
    const x = l.replace(/^\d{1,2}[.)]\s*/, "").replace(/;$/, "");
    if (cur.type === "amt") {
      const amts = []; x.replace(/([A-Z]{3})\s*([\d.,]+\d)/g, (_, c, v) => amts.push({ cur: c, amt: finRaw(v) }));
      const name = x.replace(/[:,]\s*[A-Z]{3}\s*[\d.,]+.*$/, "").trim(); cur.items.push({ name, amts });
    } else { const i = x.lastIndexOf(","); cur.items.push(i > 0 ? { name: x.slice(0, i).trim(), when: x.slice(i + 1).trim() } : { name: x, when: "" }); }
  });
  return out;
}
function finBuild(date, secs) {
  const line = (type, r) => { if (!r.name) return ""; if (type === "when") return r.name + (r.when ? ", " + r.when : "");
    const a = (r.amts || []).filter((v) => v.cur && finNum(v.amt)).map((v) => `${v.cur} ${finNum(v.amt)}`); return a.length ? `${r.name}: ${a.join(" + ")}` : r.name; };
  return secs.filter((sx, i) => i === 0 || sx.title).map((sx, i) => { const items = (sx.items || []).map((r) => line(sx.type, r)).filter(Boolean);
    return `${LETTERS[i]}. ${(sx.title || "").toUpperCase()}${i === 0 && date ? " " + date : ""}\n${items.length ? items.map((l, j) => `${j + 1}. ${l}`).join("\n") : "-"}`; }).join("\n\n");
}
const rmBtn = (act) => `<button type="button" class="icon-btn danger" data-act="${act}" aria-label="${esc(t("delete"))}">${ic("trash")}</button>`;
const curRow = (v = {}) => `<div class="cur-row"><input type="hidden" name="cur" value="${esc(v.cur || "SGD")}"><button type="button" class="cur-btn" data-act="curPick">${esc(v.cur || "SGD")} ▾</button><input name="amt" inputmode="decimal" value="${esc(v.amt || "")}" placeholder="0.00" aria-label="${esc(t("finAmount"))}">${rmBtn("finRm")}</div>`;
const finRow = (type, r = {}) => type === "amt"
  ? `<div class="fin-row fa"><div class="fin-head"><input name="n" value="${esc(r.name || "")}" placeholder="${esc(t("finWhat"))}">${rmBtn("finRmItem")}</div>
      <div class="cur-rows">${(r.amts || []).map(curRow).join("")}</div>
      <button type="button" class="btn sm ghost" data-act="curAdd">${ic("plus")} ${esc(t("finAddCur"))}</button></div>`
  : `<div class="fin-row"><input name="n" value="${esc(r.name || "")}" placeholder="${esc(t("finName"))}"><input name="when" class="fin-sm" value="${esc(r.when || "")}" placeholder="${esc(t("finWhen"))}">${rmBtn("finRm")}</div>`;
const finSec = (sx, i, date, prevSun) => `<fieldset class="fin-sec" data-type="${sx.type}"><legend><span class="fin-l">${LETTERS[i] || "+"}.</span> ${i < 3 && !sx.custom ? `<b class="fin-t">${esc(sx.title)}</b><input type="hidden" name="st" value="${esc(sx.title)}">` : `<input name="st" class="fin-title" value="${esc(sx.title || "")}" placeholder="${esc(t("finSecName"))}">`}</legend>
    <div class="row end">${i >= 3 || sx.custom ? `<button type="button" class="btn sm ghost" data-act="finRmSec">${ic("x")} ${esc(t("finRmSec"))}</button>` : ""}<button type="button" class="btn sm danger" data-act="finClear">${ic("trash")} ${esc(t("delAll"))}</button></div>
    ${i === 0 ? `<label class="fin-date">${esc(t("finOffDate"))}<input name="fdate" value="${esc(date)}" placeholder="${esc(fmtID(prevSun))}" required></label>` : `<p class="small muted">${esc(t("finEmptyOk"))}</p>`}
    <div class="fin-rows">${(sx.items || []).map((r) => finRow(sx.type, r)).join("")}</div>
    <button type="button" class="btn sm" data-act="finAdd">${ic("plus")} ${esc(t(sx.type === "amt" ? "finAddOffering" : "finAddRow"))}</button></fieldset>`;
A.financeForm = (d) => {
  const sun = d && d.day || nextSunday(); const p = finFor(sun); const prevSun = addDays(sun, -7);
  let x = p ? finParse(p.body) : { date: fmtID(prevSun), secs: [] };
  const dr = LS.get("draft:finance:" + sun, null);
  if (dr && dr.secs && Date.now() - (dr.at || 0) < DRAFT_DAYS * 864e5 && (!p || (dr.at || 0) > Date.parse(p.updated_at || p.created_at || 0))) { x = { date: dr.fdate || x.date, secs: dr.secs.map((sx, i) => ({ ...sx, custom: i >= 3 })) }; setTimeout(() => toast(t("draftRestored")), 300); }
  FIN_DEFAULT.forEach((df, i) => { if (!x.secs[i]) x.secs[i] = { ...df, items: [] }; });
  if (!x.secs[0].items.length) x.secs[0].items = FIN_A.map((name) => ({ name, amts: [{ cur: "SGD" }] }));
  ["B", "C"].forEach((_, j) => { if (!x.secs[j + 1].items.length) x.secs[j + 1].items = [{}]; });
  sheet(t("financeTitle"), `<form class="form fin-form" data-form="finance" data-id="${p ? p.id : ""}" data-dkey="${esc(sun)}">
    <label>${esc(t("financeFor"))}<input type="date" name="day" value="${esc(sun)}" required></label>
    <div class="fin-secs">${x.secs.map((sx, i) => finSec(sx, i, x.date, prevSun)).join("")}</div>
    <button type="button" class="btn block" data-act="finAddSec" style="margin-top:12px">${ic("plus")} ${esc(t("finAddSec"))}</button>
    <details class="fin-prev"><summary>${esc(t("preview"))}</summary><p class="pre small" id="fin-prev"></p></details>
    <button class="btn primary block">${esc(t("save"))}</button></form>`);
  finPreview(false);
};
const finRelabel = () => document.querySelectorAll(".fin-secs .fin-sec .fin-l").forEach((el, i) => (el.textContent = (LETTERS[i] || "+") + "."));
A.finAddSec = () => { const box = $(".fin-secs"); const i = box.children.length; box.insertAdjacentHTML("beforeend", finSec({ title: "", type: "amt", custom: true, items: [{ amts: [{ cur: "SGD" }] }] }, i, "", "")); const n = box.lastElementChild.querySelector(".fin-title"); if (n) n.focus(); finPreview(); };
A.finRmSec = (d, btn) => { btn.closest(".fin-sec").remove(); finRelabel(); finPreview(); };
A.finAdd = (d, btn) => { const sec = btn.closest(".fin-sec"); const box = sec.querySelector(".fin-rows"); const type = sec.dataset.type; box.insertAdjacentHTML("beforeend", finRow(type, type === "amt" ? { amts: [{ cur: "SGD" }] } : {})); const ins = box.lastElementChild.querySelector("input[name=n]"); if (ins) ins.focus(); finPreview(); };
A.finRm = (d, btn) => { const r = btn.closest(".cur-row") || btn.closest(".fin-row"); if (r) r.remove(); finPreview(); };
A.finRmItem = (d, btn) => { const r = btn.closest(".fin-row"); if (r) r.remove(); finPreview(); };
A.finClear = (d, btn) => {
  if (btn.dataset.sure !== "1") { btn.dataset.sure = "1"; btn.classList.add("sure"); btn.innerHTML = `${ic("trash")} ${esc(t("tapAgain"))}`; setTimeout(() => { if (btn.isConnected) { btn.dataset.sure = ""; btn.classList.remove("sure"); btn.innerHTML = `${ic("trash")} ${esc(t("delAll"))}`; } }, 4000); return; }
  btn.closest(".fin-sec").querySelector(".fin-rows").innerHTML = ""; btn.dataset.sure = ""; btn.classList.remove("sure"); btn.innerHTML = `${ic("trash")} ${esc(t("delAll"))}`; finPreview();
};
A.curAdd = (d, btn) => { const box = btn.closest(".fin-row").querySelector(".cur-rows"); box.insertAdjacentHTML("beforeend", curRow({})); A.curPick({}, box.lastElementChild.querySelector(".cur-btn")); };
// Currency picker: every 3-letter currency code, with a search box at the top.
A.curPick = (d, btn) => {
  document.querySelectorAll(".cur-pop").forEach((x) => x.remove());
  const row = btn.closest(".cur-row"); const pop = document.createElement("div"); pop.className = "cur-pop";
  const list = (q) => CURS.filter((c) => !q || c.toLowerCase().includes(q) || curName(c).toLowerCase().includes(q)).slice(0, 200).map((c) => `<button type="button" data-act="curSet" data-c="${c}"><b>${c}</b><small>${esc(curName(c))}</small></button>`).join("") || `<p class="small muted">–</p>`;
  pop.innerHTML = `<input type="search" placeholder="${esc(t("search"))}" aria-label="${esc(t("search"))}"><div class="cur-list">${list("")}</div>`;
  row.appendChild(pop); const s2 = pop.querySelector("input"); s2.oninput = () => (pop.querySelector(".cur-list").innerHTML = list(s2.value.trim().toLowerCase())); setTimeout(() => s2.focus(), 30);
};
A.curSet = (d, btn) => { const row = btn.closest(".cur-row"); row.querySelector("[name=cur]").value = d.c; row.querySelector(".cur-btn").textContent = d.c + " ▾"; btn.closest(".cur-pop").remove(); const a = row.querySelector("[name=amt]"); if (a) a.focus(); finPreview(); };
document.addEventListener("click", (e) => { if (e.target.closest && !e.target.closest(".cur-pop") && !e.target.closest(".cur-btn, [data-act=curAdd]")) document.querySelectorAll(".cur-pop").forEach((x) => x.remove()); });
function finCollect(f) {
  return [...f.querySelectorAll(".fin-secs .fin-sec")].map((sec) => ({ title: sec.querySelector("[name=st]").value.trim(), type: sec.dataset.type,
    items: [...sec.querySelectorAll(".fin-row")].map((row) => sec.dataset.type === "amt"
      ? { name: row.querySelector("[name=n]").value.trim(), amts: [...row.querySelectorAll(".cur-row")].map((c) => ({ cur: c.querySelector("[name=cur]").value, amt: c.querySelector("[name=amt]").value.trim() })) }
      : { name: row.querySelector("[name=n]").value.trim(), when: row.querySelector("[name=when]").value.trim() }) }));
}
const finDraftKey = (f) => "draft:finance:" + (f.dataset.dkey || "");
function finDraftSave(f) { LS.set(finDraftKey(f), { at: Date.now(), fdate: f.fdate ? f.fdate.value.trim() : "", secs: finCollect(f) }); }
function finPreview(touch = true) { const f = document.querySelector(".fin-form"); const el = document.getElementById("fin-prev"); if (f && el) el.textContent = "WARTA KEUANGAN\n" + finBuild(f.fdate ? f.fdate.value.trim() : "", finCollect(f)); if (touch && f) finDraftSave(f); }
document.addEventListener("input", (e) => { if (e.target.closest && e.target.closest(".fin-form")) finPreview(); });
F.finance = async (f) => {
  const secs = finCollect(f);
  if (!f.fdate || !f.fdate.value.trim() || !(secs[0] && secs[0].items.some((r) => r.name && (r.amts || []).some((v) => v.cur && finNum(v.amt))))) throw new S.AppError("fin_parts");
  await api.save("post", { id: f.dataset.id || undefined, group_id: "treasurer", kind: "finance", title: "Warta Keuangan " + f.day.value, body: finBuild(f.fdate.value.trim(), secs), day: f.day.value });
  closeSheet(); await refresh(); toast(t("saved"));
  const wf = $("#warta-form .wfin"); if (wf) wf.outerHTML = wFinBox($("#warta-form").dataset.day);
};

// ---------- Secretary: Warta Jemaat (weekly bulletin, 2 pages A4 landscape, folded) ----------
// Everything the app already has is filled in automatically; the Secretary checks it, adds the rest, and makes the PDF.
//  - Minggu name and theme: the Tata Ibadah published by Multimedia for that Sunday
//  - birthdays this week: members and the imported birthday list
//  - Warta Keuangan: the Treasurer's latest entry
//  - Pelayan Ibadah: last week's "next Sunday" column, plus Multimedia / Song Leader / Musicians from their rosters
//  - Berita Pelayanan: elders' updates from the last 10 days; Jadwal: church calendar for the coming weeks
//  - Badan Organisasi, Pokok Doa, offering info, address: carried over from the previous Warta
// The church's weekly roster sheet (one tab per month), used when no other link is saved.
const ROSTER_DEFAULT = "https://docs.google.com/spreadsheets/d/1ftYDy2TeXSNI0QjUsEaTCL9uISr1v4jL/edit?gid=1530963920#gid=1530963920";
const TEAM_ROLES = ["Bahasa", "Pengkhotbah", "Liturgist", "St. Sekolah Minggu", "Pembaca Warta", "Tally Counter", "Penerima Tamu", "Pemain Musik", "Song Leader", "Sekolah Minggu", "Remaja", "Multimedia"];
const TEAM_ROSTER = { "Pemain Musik": "musik", "Song Leader": "song-leader", "Multimedia": "multimedia" };
// Other names the weekly roster sheet uses for the same job.
const ROLE_ALIAS = { agenda: "Liturgist", liturgis: "Liturgist", warta: "Pembaca Warta", "pembaca warta": "Pembaca Warta", "penerima tamu": "Penerima Tamu", "usher": "Penerima Tamu", "pemain musik": "Pemain Musik", musik: "Pemain Musik", "song leader": "Song Leader", "songleader": "Song Leader", "st sekolah minggu": "St. Sekolah Minggu", "st. sekolah minggu": "St. Sekolah Minggu", pengkhotbah: "Pengkhotbah", "pemimpin ibadah": "Liturgist", "tally counter": "Tally Counter", bahasa: "Bahasa", "sekolah minggu": "Sekolah Minggu", remaja: "Remaja", multimedia: "Multimedia", "keyboard/piano": "Pemain Musik", keyboard: "Pemain Musik", piano: "Pemain Musik", gitar: "Pemain Musik", guitar: "Pemain Musik", bass: "Pemain Musik", drum: "Pemain Musik", drums: "Pemain Musik" };
const WARTA_BASE = {
  resort: "Resort Singapore - Distrik XX Kepulauan Riau", address: "8 Short Street Singapore 188214", email: "hkbpsingapura@gmail.com",
  timeThis: "13.30 - 15.30", timeNext: "13.30 - 15.30", minggu: "", theme: "", verse: "", renTitle: "", renVerse: "", renungan: "", renunganBy: "", rosterLink: ROSTER_DEFAULT,
  bdays: "", anniv: "", bdayVerse: "Mazmur 22: 11: “Kepada-Mu aku diserahkan sejak aku lahir, sejak dalam kandungan ibuku Engkaulah Allahku.”",
  annivVerse: "Mazmur 128: 1: “Berbahagialah setiap orang yang takut akan TUHAN, yang hidup menurut jalan yang ditunjukkan-Nya!”",
  finance: "", org: "Spiritual Committee\nPreacher : Pdt. Catherina N Hutasoit\n88176835\nDeacons :\n1. St Ratna Silitonga\n2. St Johnny Tobing\nOrdinary Com.-Administration\nKetua (Chairman)\nSt Royen Gultom 97355376\nAnggota :\nSekretaris (Hon. Secretary)\nRichard Siburian 9842-9041\nBendahara (Hon. Treasurer)\nDwita Situmorang 90106487\nAnggota Biasa (Admin)\n1. Nurani Simatupang\n2. Maria Tobing\nAnggota Biasa (Auditors)\n1. Sondang Simbolon\n2. Petra Sibuea\nDewan Koinonia (Koinonia Council)\nSt Farinton Nainggolan\nAnggota :\n1. Dien Pasaribu (S Minggu)\n2. St Yosafat Bangun (Remaja)\n3. Naomi Lubis (Pemuda)\n4. Dearni Purba (Kaum Perempuan)\n5. Toga Sihombing (Kaum Bapak)\n6. Reynold Limbong (Pelaut/pekerja)\nDewan Marturia (Marturia Council)\nSt. Helmi Sihombing\nAnggota :\n1. St Royen Gultom (Zending)\n2. Richard Siburian (Musik)\n3. Mira Nainggolan (Musik-Vocal)\nDewan Diakonia (Diaconia Council)\nSt. Ratna Silitonga\nAnggota :\n1. St. Harry Sianturi (Sosial Kem.)\n2. Sophia Siagian (Kesehatan)\n3. Marcus Simanjuntak (Pendidikan)\n4. Andrew Butarbutar (Perlengkapan)\nSintua (Elders)\nSt Royen Gultom; St. Alston Manik; St Johnny Tobing; St Helmi Sihombing; St Ratna Silitonga; St Jannes Sibuea; St Sabar Butarbutar; St Yosafat Bangun; St Hermanto Hutasoit; St Farinton Nainggolan; St Harry Sianturi", doa: "1. Pelayanan gereja sesuai dengan warta jemaat & yang berulang tahun.\n2. Kesehatan seluruh jemaat HKBP Singapore dan se-Resort Singapore, termasuk para siswa, mahasiswa, Pekerja dan Pelaut di Singapore dan keluarga.\n3. Pemulihan jemaat yang sakit.",
  info: "1. PERSEMBAHAN\nSelain dari Persembahan dalam Ibadah minggu, segala bentuk persembahan lainnya, dapat disampaikan melalui: PayNow Corporate, bisa melalui **UEN: S61SS0070G** dan **Rekening gereja HKBP Singapore, DBS Current Account No. 019-901598-4, Registered Name: Huria Kristen Batak Protestant**. Setelah melakukan transfer, silakan screenshot bukti transfer dan dikirimkan kepada Ibu **Dwita Situmorang (Bendahara Gereja) (WA No 90106487)** dengan detail transfer (offering/pledge/janji iman/thanksgiving).",
  jadwalTitle: "", jadwal: "", berita: "", attDate: "", att: ["", "", "", "", ""],
  closing: "Selalu hidup beriman, penuh Kasih dan Berpengharapan.", team: TEAM_ROLES.map((r) => [r, "", ""]),
};
const CARRY = ["resort", "address", "email", "bdayVerse", "annivVerse", "org", "doa", "info", "closing", "rosterLink"];
const wartaPosts = () => D.posts.filter((p) => p.group_id === "secretary" && p.kind === "warta").sort((a, b) => (b.day || "").localeCompare(a.day || ""));
const parseJSON = (s) => { try { return JSON.parse(s) || {}; } catch { return {}; } };
function rosterNames(gid, iso) {
  const out = [];
  D.rosters.filter((r) => r.group_id === gid && r.month === iso.slice(0, 7)).forEach((r) => (r.table_json || []).forEach((tb) => tb.rows.forEach((row) => {
    if (rowDate(row, r.month) !== iso) return;
    const names = row.filter((c) => c && !DATE_RE.test(c) && !/^\d{4}-\d{2}-\d{2}$/.test(c) && !/^(minggu|sunday|sabtu|saturday)$/i.test(String(c).trim()));
    if (names.length) out.push(names.join(", "));
  })));
  return out.join("; ");
}
// The daily bread of that Sunday (or the latest one before it) fills the cover reflection.
function breadFor(day) {
  const b = D.bread.find((x) => x.day === day) || D.bread.filter((x) => x.day <= day && x.day >= addDays(day, -6)).sort((a, c) => c.day.localeCompare(a.day))[0];
  return b && b.body ? b : null;
}
// The parts that come from the app's data (recomputed with "Fill in again from the app").
function wartaAutoParts(day, team) {
  const next = addDays(day, 7);
  const seen = new Set(); const bdays = birthdaysBetween(day, 6).map((x) => x.p.name).filter((n) => !seen.has(n) && seen.add(n));
  const bn = beritaAll().find((u) => u.day === day) || beritaAll().find((u) => (u.day || u.created_at.slice(0, 10)) <= day && (u.day || u.created_at.slice(0, 10)) >= addDays(day, -7));
  const until = addDays(day, 35);
  const evs = D.events.filter((e) => !(e.group_id && (G(e.group_id) || {}).kind === "office")).map((e) => ({ e, d: sgParts(e.starts_at).date })).filter((x) => x.d >= day && x.d <= until);
  const b = breadFor(day);
  return {
    bdays: bdays.join("\n"),
    finance: (finFor(day) || {}).body || "",
    berita: bn ? bn.body : "",
    jadwalTitle: "JADWAL PELAYANAN BULAN " + new Intl.DateTimeFormat("id-ID", { month: "long" }).format(new Date(day + "T12:00:00+08:00")).toUpperCase(),
    jadwal: evs.map((x, i) => `${"abcdefghijklmnopqrstuvwxyz"[i] || i + 1}. ${x.e.title} (${+x.d.slice(8)}/${+x.d.slice(5, 7)})`).join("\n"),
    team: team.map(([r, a, c]) => { const g = TEAM_ROSTER[r]; return g ? [r, rosterNames(g, day) || a, rosterNames(g, next) || c] : [r, a, c]; }),
    ...(b ? { renungan: b.body, renTitle: b.title || "", renVerse: b.verse || "", renunganBy: "" } : {}),
  };
}
function wartaLoad(day) {
  const saved = wartaPosts().find((p) => p.day === day);
  if (saved) return { ...WARTA_BASE, ...parseJSON(saved.body), day, _id: saved.id };
  const prev = wartaPosts().find((p) => p.day < day); const P0 = prev ? parseJSON(prev.body) : {};
  const W = { ...WARTA_BASE, day }; CARRY.forEach((k) => { if (P0[k] != null && P0[k] !== "") W[k] = P0[k]; });
  // Last week's "next Sunday" column becomes this week's.
  const prevTeam = Array.isArray(P0.team) ? P0.team : null; const lastWeek = prev && prev.day === addDays(day, -7);
  W.team = TEAM_ROLES.concat(prevTeam ? prevTeam.map((r) => r[0]).filter((r) => !TEAM_ROLES.includes(r)) : []).map((r) => {
    const old = prevTeam && prevTeam.find((x) => x[0] === r); return [r, old && lastWeek ? old[2] || "" : "", ""]; });
  return Object.assign(W, wartaAutoParts(day, W.team));
}
async function tataMeta(day) {
  const v = (D.services || []).find((x) => x.service_date === day); if (!v) return null;
  try { const m = (await tataHtml(v.id) || "").match(/<script type="application\/json" id="tata-data">([\s\S]*?)<\/script>/); return m ? JSON.parse(m[1]).meta || null : null; } catch { return null; }
}
function wartaBlock() {
  const ws = wartaPosts().slice(0, 5); const sun = nextSunday();
  const can = canUpload("secretary");
  return `<div class="card"><div class="card-h"><h3>${ic("book")} Warta Jemaat</h3>${can && ws.length ? `<button class="btn sm danger" data-act="wDelAll">${ic("trash")} ${esc(t("delAll"))}</button>` : ""}</div>
    <p class="small muted">${esc(t("wartaLead"))}</p>
    ${can ? `<a class="btn primary block" href="#/warta/${sun}">${ic("edit")} ${esc(t("wartaMake", fmtID(sun)))}</a>` : ""}
    ${ws.map((p) => `<div class="li w-hist"><a class="grow-link" href="#/warta/${p.day}"><span class="date-chip"><b>${esc(fmt(p.day, { day: "numeric" }))}</b><small>${esc(fmt(p.day, { month: "short" }))}</small></span><span class="grow"><b>${esc(p.title || "Warta Jemaat")}</b><small>${esc(p.author_name || "")}</small></span></a>${can ? `<button class="icon-btn danger" data-act="del" data-kind="post" data-id="${p.id}" aria-label="${esc(t("delete"))}">${ic("trash")}</button>` : ic("chev", "chev")}</div>`).join("")}</div>`;
}
// Every field has its own upload button (file or online link).
const wUp = (name) => `<button type="button" class="w-up" data-act="wImp" data-f="${name}" aria-label="${esc(t("w_upload"))}" title="${esc(t("w_upload"))}">${ic("upload")}</button>`;
const wLab = (name, label, src) => `<span class="w-lab"><span>${esc(label)}${src ? ` <span class="src-tag">${esc(src)}</span>` : ""}</span>${wUp(name)}</span>`;
const wTa = (name, label, val, rows = 4, src = "") => `<label>${wLab(name, label, src)}<textarea name="${name}" rows="${rows}">${esc(val || "")}</textarea></label>`;
const wIn = (name, label, val, src = "") => `<label>${wLab(name, label, src)}<input name="${name}" value="${esc(val || "")}"></label>`;
// Sections filled from one file: one upload button for the whole section instead of one per field.
const W_SECS = { "@head": ["minggu", "theme", "verse", "timeThis", "timeNext"], "@ren": ["renTitle", "renVerse", "renungan", "renunganBy"] };
const wPlainLab = (label, src) => `<span class="w-lab"><span>${esc(label)}${src ? ` <span class="src-tag">${esc(src)}</span>` : ""}</span></span>`;
const wIn0 = (name, label, val, src = "") => `<label>${wPlainLab(label, src)}<input name="${name}" value="${esc(val || "")}"></label>`;
// Service time: start and end, each picked from the list or typed; the hidden field keeps "13.30 - 15.30".
const wTimeParts = (v) => { const m = String(v || "").match(/(\d{1,2}[.:]\d{2})\D+(\d{1,2}[.:]\d{2})/); return m ? [m[1].replace(":", "."), m[2].replace(":", ".")] : ["", ""]; };
const wTime = (name, label, val) => { const [a, b] = wTimeParts(val); return `<div class="wtime"><span class="wtime-l">${esc(label)}</span><div class="wtime-r">
  <input data-tp="${name}" list="w-times" value="${esc(a)}" inputmode="decimal" placeholder="13.30" aria-label="${esc(label)} ${esc(t("w_from"))}"><span>–</span>
  <input data-tp="${name}" list="w-times" value="${esc(b)}" inputmode="decimal" placeholder="15.30" aria-label="${esc(label)} ${esc(t("w_to"))}"></div>
  <input type="hidden" name="${name}" value="${esc(val || "")}"></div>`; };
const wTimeList = () => { const o = []; for (let m = 6 * 60; m <= 22 * 60; m += 15) o.push(`<option value="${String(Math.floor(m / 60)).padStart(2, "0")}.${String(m % 60).padStart(2, "0")}">`); return `<datalist id="w-times">${o.join("")}</datalist>`; };
const wTimeFix = (x) => { const m = String(x || "").trim().match(/^(\d{1,2})(?:[.:]?(\d{2}))?$/); return m ? `${m[1].padStart(2, "0")}.${m[2] || "00"}` : String(x || "").trim(); };
function wTimeSync(f) { ["timeThis", "timeNext"].forEach((n) => { if (!f || !f[n]) return; const [a, b] = wTimeParts(f[n].value); const ins = f.querySelectorAll(`[data-tp="${n}"]`); if (ins.length === 2 && a) { ins[0].value = a; ins[1].value = b; } }); }
const wTa0 = (name, label, val, rows = 4, src = "") => `<label>${wPlainLab(label, src)}<textarea name="${name}" rows="${rows}">${esc(val || "")}</textarea></label>`;
const wSecUp = (key, extra = "") => `<div class="row two w-secup"><button type="button" class="btn sm primary" data-act="wImp" data-f="${key}">${ic("upload")} ${esc(t("w_upSec"))}</button>${extra}</div>`;
R.warta = (day) => {
  if (!isOffice() || !offOk()) { location.replace("#/o/secretary"); return ""; }
  day = /^\d{4}-\d{2}-\d{2}$/.test(day || "") ? day : nextSunday();
  let W = wartaLoad(day); const can = canUpload("secretary");
  const dw = LS.get("draft:warta:" + day, null); R.warta._restored = false;
  if (can && dw && dw.W && Date.now() - (dw.at || 0) < DRAFT_DAYS * 864e5) { W = { ...W, ...dw.W, day, _id: W._id }; R.warta._restored = true; }
  R.warta._W = W;
  if (!W._id && (!W.minggu || !W.theme)) tataMeta(day).then((m) => {
    const f = $("#warta-form"); if (!m || !f || f.dataset.day !== day) return;
    const th = String(m.theme || "").match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    if (m.sunday && !f.minggu.value) f.minggu.value = m.sunday;
    if (m.theme && !f.theme.value) { f.theme.value = (th ? th[1] : m.theme).replace(/^["“]|["”]$/g, ""); if (th && !f.verse.value) f.verse.value = th[2]; }
  });
  if (!W.rosterLink) W.rosterLink = ROSTER_DEFAULT;
  if (!W._id || !(W.team || []).some((r) => r[1] || r[2])) setTimeout(() => A.wRoster({ quiet: 1 }), 400);
  const sec = (title, inner, open) => `<details class="card wsec"${open ? " open" : ""}><summary><b>${esc(title)}</b></summary>${inner}</details>`;
  return shell("#/home", `
    <div class="card"><p class="small muted">${esc(t("wartaFormLead"))}</p>
      ${can ? `<button class="btn primary block" data-act="wImpAll">${ic("upload")} ${esc(t("w_upAll"))}</button>
      <p class="small muted" style="margin:6px 2px 10px">${esc(t("w_upAllHint"))}</p>` : ""}
      <div class="row two"><button class="btn" data-act="wartaPreview">${ic("screen")} ${esc(t("preview"))}</button><button class="btn" data-act="wartaRefill">${ic("check")} ${esc(t("wartaRefill"))}</button></div></div>
    <form class="form" id="warta-form" data-form="warta" data-day="${day}">
      ${sec(t("w_head"), `${can ? `<div class="row two w-secup"><button type="button" class="btn sm primary" data-act="wImp" data-f="@all">${ic("upload")} ${esc(t("w_upEvery"))}</button></div>` : ""}${wIn0("minggu", "Minggu", W.minggu, "Tata Ibadah")}${wIn0("theme", t("w_theme"), W.theme, "Tata Ibadah")}${wIn0("verse", t("f_verse"), W.verse, "Tata Ibadah")}
        ${wTime("timeThis", t("w_timeThis"), W.timeThis)}${wTime("timeNext", t("w_timeNext"), W.timeNext)}${wTimeList()}`, true)}
      ${sec(t("w_renungan"), `<p class="small muted">${esc(t("w_renHint"))}</p>${can ? wSecUp("@ren", `<button type="button" class="btn sm" data-act="wFromBread">${ic("bread")} ${esc(t("w_fromBread"))}</button>`) : ""}${wIn0("renTitle", t("w_renTitle"), W.renTitle, t("bread"))}${wIn0("renVerse", t("f_verse"), W.renVerse, t("bread"))}${wTa0("renungan", t("w_renunganBody"), W.renungan, 12, t("bread"))}${wIn0("renunganBy", t("w_by"), W.renunganBy)}`, !W.renungan)}
      ${sec(t("birthdays"), `${wTa("bdays", t("w_bdays"), W.bdays, 4, t("src_bdays"))}${wTa("bdayVerse", t("w_verseGift"), W.bdayVerse, 2)}${wTa("anniv", t("w_anniv"), W.anniv, 3)}${wTa("annivVerse", t("w_verseGift"), W.annivVerse, 2)}`)}
      ${sec("Warta Keuangan", wFinBox(day), !finFor(day))}
      ${sec(t("w_team"), `<label>${wLab("rosterLink", t("w_rosterLink"))}<input name="rosterLink" type="url" inputmode="url" placeholder="https://docs.google.com/spreadsheets/…" value="${esc(W.rosterLink || "")}"></label>
        <p class="small muted">${esc(t("w_rosterHint"))}</p>
        <div class="row two"><button type="button" class="btn" data-act="wRoster">${ic("check")} ${esc(t("w_rosterRead"))}</button><button type="button" class="btn" data-act="wImp" data-f="team">${ic("upload")} ${esc(t("w_upload"))}</button></div>
        <div class="tbl-wrap"><table class="tbl wteam"><tr><th></th><th>${esc(fmtID(day))}</th><th>${esc(fmtID(addDays(day, 7)))}</th></tr>
        ${W.team.map(([r, a, b], i) => `<tr><th><input name="tr${i}" value="${esc(r)}"></th><td><input name="ta${i}" value="${esc(a)}"></td><td><input name="tb${i}" value="${esc(b)}"></td></tr>`).join("")}</table></div>
        <p class="small muted">${esc(t("w_teamHint"))}</p>`)}
      ${sec(t("w_news"), `${wTa("berita", "Berita Pelayanan", W.berita, 10, t("src_updates"))}${wIn("jadwalTitle", t("w_jadwalTitle"), W.jadwalTitle)}${wTa("jadwal", t("w_jadwal"), W.jadwal, 5, t("src_calendar"))}`)}
      ${sec(t("w_more"), `${wTa("doa", "Pokok Doa", W.doa, 4)}${wTa("info", t("w_info"), W.info, 6)}
        ${wIn("attDate", t("w_attDate"), W.attDate || fmtID(addDays(day, -7)))}
        <div class="w-lab" style="margin-top:10px"><span class="small"><b>${esc(t("w_att"))}</b></span>${wUp("att")}</div>
        <div class="row three att">${["Bapak", "Ibu", "Naposo", "Remaja", "Sekolah Minggu"].map((l, i) => `<label>${l}<input name="att${i}" inputmode="numeric" value="${esc((W.att || [])[i] || "")}"></label>`).join("")}</div>`)}
      ${sec(t("w_org"), wTa("org", t("w_org"), W.org, 16))}
      ${sec(t("w_kop"), `${wIn("resort", "Resort", W.resort)}${wIn("address", t("w_address"), W.address)}${wIn("email", "Email", W.email)}${wTa("closing", t("w_closing"), W.closing, 2)}`)}
      ${can ? `<div class="row two sticky-actions"><button type="button" class="btn" data-act="wartaSave">${esc(t("w_saveDraft"))}</button><button class="btn primary">${ic("file")} ${esc(t("w_makePdf"))}</button></div>` : ""}
    </form>`, { back: "#/o/secretary", title: "Warta Jemaat", sub: fmtID(day) });
};
// Warta Keuangan is typed by the treasurer only; the secretary sees it here and can ask for it.
function wFinBox(day) {
  const p = finFor(day);
  return `<div class="wfin">${p ? `<p class="small"><b>${esc(t("finFrom", p.author_name || t("treasurer")))}</b></p><p class="pre small">${esc(p.body)}</p>` : `<div class="notice warn">${ic("bell")} <span>${esc(t("finMissing", fmtID(day)))}</span></div>`}
    <div class="row two"><button type="button" class="btn" data-act="wAskFin">${ic("wa")} ${esc(t("finAsk"))}</button>${canUpload("treasurer") ? `<button type="button" class="btn" data-act="financeForm" data-day="${day}">${ic("edit")} ${esc(t(p ? "financeEdit" : "financeNew"))}</button>` : `<button type="button" class="btn" data-act="wFinReload">${ic("check")} ${esc(t("finReload"))}</button>`}</div></div>`;
}
A.wAskFin = () => {
  const f = $("#warta-form"); const day = f ? f.dataset.day : nextSunday();
  const tr = holders("treasurer").find((p) => p.phone); const url = location.href.split("#")[0] + "#/o/treasurer";
  window.open(wa(t("finAskMsg", fmtID(day), url), tr && tr.phone), "_blank", "noopener");
};
A.wFinReload = async () => { await refresh(); const f = $("#warta-form"); if (!f) return; const box = f.querySelector(".wfin"); if (box) box.outerHTML = wFinBox(f.dataset.day); toast(finFor(f.dataset.day) ? t("finArrived") : t("finStillMissing"), !finFor(f.dataset.day)); };
const W_FIELDS = ["minggu", "theme", "verse", "timeThis", "timeNext", "renTitle", "renVerse", "renungan", "renunganBy", "rosterLink", "bdays", "bdayVerse", "anniv", "annivVerse", "berita", "jadwalTitle", "jadwal", "doa", "info", "attDate", "org", "resort", "address", "email", "closing"];
function wartaCollect(f) {
  const W = { ...R.warta._W }; delete W._id;
  W_FIELDS.forEach((k) => { if (f[k]) W[k] = f[k].value.trim(); });
  W.att = [0, 1, 2, 3, 4].map((i) => (f["att" + i] ? f["att" + i].value.trim() : ""));
  W.team = []; for (let i = 0; f["tr" + i]; i++) if (f["tr" + i].value.trim()) W.team.push([f["tr" + i].value.trim(), f["ta" + i].value.trim(), f["tb" + i].value.trim()]);
  W.day = f.dataset.day; W.finance = (finFor(W.day) || {}).body || ""; return W;
}
async function wartaSaveDraft(W) {
  const res = await api.save("post", { id: R.warta._W._id || undefined, group_id: "secretary", kind: "warta", title: "Warta Jemaat " + fmtID(W.day), body: JSON.stringify(W), day: W.day });
  if ((R.warta._W || {}).day === W.day) R.warta._W = { ...W, _id: res.id };
  wBase = JSON.stringify(W); return res;
}
// Warta auto-save: a few seconds after typing stops, and always when leaving the page or the app.
let wBase = null, wTimer = null, wSaving = null;
function wAutoBase() { const f = $("#warta-form"); wBase = f && canUpload("secretary") ? JSON.stringify(wartaCollect(f)) : null; if (f && R.warta._restored) { R.warta._restored = false; wBase = ""; toast(t("draftRestored")); } }
function wAutoFlush(quiet) {
  clearTimeout(wTimer); const f = $("#warta-form"); if (!f || wBase === null || !canUpload("secretary")) return;
  const W = wartaCollect(f); const js = JSON.stringify(W); if (js === wBase) return;
  wBase = js; LS.set("draft:warta:" + W.day, { at: Date.now(), W });
  wSaving = (wSaving || Promise.resolve()).then(() => wartaSaveDraft(W)).then(() => { LS.set("draft:warta:" + W.day, null); if (!quiet) toast(t("autoSaved")); return refresh(); }).catch((e) => console.warn("warta autosave", e));
}
document.addEventListener("input", (e) => { if (e.target.closest && e.target.closest("#warta-form")) { clearTimeout(wTimer); wTimer = setTimeout(() => wAutoFlush(true), 3000); } });
window.addEventListener("pagehide", () => wAutoFlush(true)); document.addEventListener("visibilitychange", () => { if (document.hidden) wAutoFlush(true); });
A.wartaSave = (d, btn) => busy(btn, async () => { try { await wartaSaveDraft(wartaCollect($("#warta-form"))); await refresh(); toast(t("saved")); } catch (e) { toast(errMsg(e), true); } });
A.wartaRefill = () => {
  const f = $("#warta-form"); const W = wartaCollect(f); const a = wartaAutoParts(W.day, W.team);
  ["bdays", "berita", "jadwalTitle", "jadwal", "renungan", "renTitle", "renVerse"].forEach((k) => { if (a[k]) f[k].value = a[k]; });
  if (a.renungan) f.renunganBy.value = "";
  a.team.forEach(([, x, y], i) => { if (f["ta" + i] && x) f["ta" + i].value = x; if (f["tb" + i] && y) f["tb" + i].value = y; });
  toast(t("wartaRefilled"));
};
// Preview is the real PDF, page by page, exactly as it will print.
A.wartaPreview = (d, btn) => busy(btn, async () => {
  try { const W = wartaCollect($("#warta-form")); const file = await wartaPdf(W); await showPdf(file, "Warta Jemaat · " + fmtID(W.day)); }
  catch (e) { console.warn(e); toast(errMsg(e), true); }
});
F.warta = async (f) => {
  const W = wartaCollect(f); await wartaSaveDraft(W);
  if (!W.finance) { const d = f.querySelector(".wfin"); if (d) { d.closest("details").open = true; d.scrollIntoView({ block: "center" }); } throw new S.AppError("w_needFinance"); }
  const file = await wartaPdf(W);
  const res = await saveOfficeFile("secretary", file, "Warta Jemaat " + fmtID(W.day), "", false);
  toast(t("w_pdfReady")); setTimeout(() => shareSheet(file, res.title, "secretary"), 50);
};

// ---------- reading uploaded files into the Warta ----------
const W_LABEL = () => ({ minggu: "Minggu", theme: t("w_theme"), verse: t("f_verse"), timeThis: t("w_timeThis"), timeNext: t("w_timeNext"), renTitle: t("w_renTitle"), renVerse: t("f_verse"), renungan: t("w_renunganBody"), renunganBy: t("w_by"), rosterLink: t("w_rosterLink"), bdays: t("w_bdays"), bdayVerse: t("w_verseGift"), anniv: t("w_anniv"), annivVerse: t("w_verseGift"), team: t("w_team"), berita: "Berita Pelayanan", jadwalTitle: t("w_jadwalTitle"), jadwal: t("w_jadwal"), doa: "Pokok Doa", info: t("w_info"), attDate: t("w_attDate"), att: t("w_att"), org: t("w_org"), resort: "Resort", address: t("w_address"), email: "Email", closing: t("w_closing") });
const W_ACCEPT = ".docx,.doc,.pdf,.xlsx,.xls,.xlsm,.csv,.ods";
A.wImp = (d) => {
  const name = d.f; const lab = name === "@all" ? t("w_upEveryLab") : name === "@head" ? t("w_head") : name === "@ren" ? t("w_renungan") : W_LABEL()[name] || name;
  sheet(t("w_upload") + " · " + lab, `<p class="small muted">${esc(t("w_upLead"))}</p>
    <button class="btn primary block" data-act="wImpFile" data-f="${name}">${ic("upload")} ${esc(t("chooseFile"))}</button>
    <p class="small muted" style="text-align:center;margin:8px 0">.docx · .doc · .pdf · .xlsx · .xls</p>
    <form class="form" data-form="wimplink" data-f="${name}"><label>${esc(t("w_upLink"))}<input name="link" type="url" inputmode="url" placeholder="https://docs.google.com/…" required></label><button class="btn block">${esc(t("readLink"))}</button></form>`);
};
A.wImpFile = (d) => {
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = W_ACCEPT;
  inp.onchange = async () => { const f = inp.files[0]; if (!f) return; toast(t("reading")); try { wPut(d.f, await P.file(f), f.name); } catch (e) { console.warn(e); toast(t(e.message === "unsupported" ? "err_unsupported" : "err_read"), true); } };
  inp.click();
};
F.wimplink = async (f) => { const r = await P.link(f.link.value.trim()); if (!(r.lines || []).some(Boolean) && !r.tables.length) throw new S.AppError(r.note === "link_folder" ? "link_folder" : r.note === "link_private" ? "link_private" : "read"); wPut(f.dataset.f, r, "link"); };
const linesOfRes = (res) => (res.lines && res.lines.length ? res.lines : String(res.text || "").split(/\n/)).map((l) => String(l).replace(/\s+/g, " ").trim());
// One file for a whole section: the Tata Ibadah part (Sunday name, theme, passage, times) or the reflection.
function wPutSec(key, res) {
  const f = $("#warta-form"); if (!f) return;
  const W = wartaCollect(f); const parts = { ...wartaFromFile(res, W.day, W.team), ...(key === "@ren" ? renFromFile(res) : headFromFile(res)) };
  if (key === "@ren") { const full = wartaFromFile(res, W.day, W.team); ["renTitle", "renVerse", "renungan", "renunganBy"].forEach((k) => { if (full[k]) parts[k] = full[k]; }); }
  const got = W_SECS[key].filter((k) => parts[k]);
  if (!got.length) { toast(t("w_noMatch"), true); return; }
  got.forEach((k) => (f[k].value = parts[k])); wTimeSync(f);
  const det = f[got[0]].closest("details"); if (det) det.open = true;
  closeSheet(); toast(t("w_filledN", got.map((k) => W_LABEL()[k]).join(", ")));
}
// A daily bread or reflection file: title, Bible passage, text and who wrote it.
function renFromFile(res) {
  const L = linesOfRes(res).map(plain); while (L.length && !L[0]) L.shift(); while (L.length && !L[L.length - 1]) L.pop();
  const out = {}; const isRef = (x) => x.length < 60 && /\d+\s*[:.]\s*\d+/.test(x) && /[A-Za-z]/.test(x);
  if (L[0] && /^(renungan|daily bread|saat teduh)\b/i.test(L[0]) && L[0].length < 40) L.shift();
  let head = 0;
  for (let i = 0; i < Math.min(4, L.length) && head < 2; i++) {
    const x = L[i]; if (!x) continue;
    const rv = x.replace(/^(bacaan|nas|ayat|firman|verse|passage|text)\s*:?\s*/i, "").replace(/^\((.+)\)$/, "$1");
    if (!out.renVerse && isRef(rv)) { out.renVerse = rv; L[i] = ""; head++; continue; }
    if (!out.renTitle && x.split(/\s+/).length <= 12 && !/[.!?]$/.test(x.replace(/["”]$/, ""))) { out.renTitle = x.replace(/^(judul|title)\s*:?\s*/i, "").replace(/^[“"]|[”"]$/g, ""); L[i] = ""; head++; continue; }
    break;
  }
  const last = L[L.length - 1] || ""; const by = last.match(/^\(?\s*(?:oleh|by|penulis|ditulis oleh)?\s*:?\s*((?:pdt|st|ev|sintua|cst|dr|bpk|ibu)\.?\s[^()]{1,30}|[^()]{2,30})\s*\)?$/i);
  if (by && last.length < 40 && (/^\(.*\)$/.test(last) || /^(oleh|by|penulis|pdt|st|ev)\b/i.test(last))) { out.renunganBy = by[1].trim(); L.pop(); }
  const body = L.join("\n").replace(/^\n+/, "").replace(/\n{3,}/g, "\n\n").trim(); if (body.split(/\s+/).length > 15) out.renungan = body;
  return out;
}
// Tata Ibadah part: Sunday name, theme and passage come from wartaFromFile; service times from "13.00 - 14.30".
function headFromFile(res) {
  const all = linesOfRes(res).join("\n"); const out = {};
  const tm = all.match(/\b(\d{1,2}[.:]\d{2})\s*(?:-|–|s\/d|sampai)\s*(\d{1,2}[.:]\d{2})\b/); if (tm) out.timeThis = `${tm[1].replace(":", ".")} - ${tm[2].replace(":", ".")}`;
  return out;
}
A.wFromBread = () => {
  const f = $("#warta-form"); if (!f) return; const b = breadFor(f.dataset.day);
  if (!b) { toast(t("w_noBread"), true); return; }
  f.renTitle.value = b.title || ""; f.renVerse.value = b.verse || ""; f.renungan.value = b.body || ""; toast(t("w_filledN", t("bread")));
};
function wPut(name, res, src) {
  if (name === "@all") return wApplyAll([{ name: src === "link" ? t("w_upLink") : src, res }], true);
  if (W_SECS[name]) return wPutSec(name, res);
  const f = $("#warta-form"); if (!f) return;
  const W = wartaCollect(f); const parts = wartaFromFile(res, W.day, W.team, name);
  let v = parts[name];
  if (name === "team") { if (!parts.team) { toast(t("w_noMatch"), true); return; } wSetTeam(f, parts.team); }
  else if (name === "att") { if (!parts.att) { toast(t("w_noMatch"), true); return; } parts.att.forEach((n, i) => { if (f["att" + i]) f["att" + i].value = n; }); if (parts.attDate) f.attDate.value = parts.attDate; }
  else {
    const SEC_OF = { bdays: "bdays", bdayVerse: "bdays", anniv: "anniv", annivVerse: "anniv", org: "org", doa: "doa", info: "info", berita: "berita", jadwal: "info", jadwalTitle: "info" };
    if ((v == null || v === "") && SEC_OF[name] && wSections(linesOfRes(res))[SEC_OF[name]]) {
      // The file has this section but nothing in it this week (e.g. no anniversaries): leave it empty.
      if (/^(bdays|anniv)$/.test(name)) { f[name].value = ""; closeSheet(); toast(t("w_emptySec", W_LABEL()[name] || name)); return; }
    }
    if (v == null || v === "") {
      // No matching section: use the whole text of the file.
      const L = linesOfRes(res); const all = L.join("\n").replace(/\n{3,}/g, "\n\n").trim();
      v = f[name] && f[name].tagName === "INPUT" ? (L.find(Boolean) || "") : all;
    }
    if (!v) { toast(t("w_noMatch"), true); return; }
    f[name].value = v; if (name === "jadwal" && parts.jadwalTitle) f.jadwalTitle.value = parts.jadwalTitle;
    const det = f[name].closest("details"); if (det) det.open = true;
  }
  closeSheet(); toast(t("w_filled", W_LABEL()[name] || name));
}
function wSetTeam(f, team) {
  const tb = f.querySelector(".wteam");
  team.forEach(([r, a, b]) => {
    let i = 0; for (; f["tr" + i]; i++) if (f["tr" + i].value.trim().toLowerCase() === r.toLowerCase()) break;
    if (!f["tr" + i]) { tb.insertAdjacentHTML("beforeend", `<tr><th><input name="tr${i}" value="${esc(r)}"></th><td><input name="ta${i}"></td><td><input name="tb${i}"></td></tr>`); }
    if (a) f["ta" + i].value = a; if (b) f["tb" + i].value = b;
  });
  const det = tb.closest("details"); if (det) det.open = true;
}
A.wRoster = async (d, btn) => {
  const f = $("#warta-form"); if (!f) return; const url = f.rosterLink.value.trim();
  if (!url) { if (!d || !d.quiet) toast(t("w_rosterNeed"), true); return; }
  await busy(btn, async () => {
    try {
      const r = await P.link(url); const W = wartaCollect(f); const team = rosterFromTables(r.tables || [], W.day);
      if (!team) { if (!d || !d.quiet) toast(t(r.note === "link_folder" ? "err_link_folder" : r.note === "link_private" ? "err_link_private" : "w_noMatch"), true); return; }
      wSetTeam(f, team); if (!d || !d.quiet) toast(t("w_filled", t("w_team")));
    } catch (e) { if (!d || !d.quiet) toast(t("err_read"), true); }
  });
};
// One button: pick many files (or a folder on a computer), fill every part they match, then show the preview.
A.wImpAll = () => {
  sheet(t("w_upAll"), `<p class="small muted">${esc(t("w_upAllLead"))}</p>
    <button class="btn primary block" data-act="wImpAllPick">${ic("upload")} ${esc(t("w_pickFiles"))}</button>
    ${"webkitdirectory" in document.createElement("input") && !/iPhone|iPad|iPod/.test(navigator.userAgent) ? `<button class="btn block" data-act="wImpAllPick" data-dir="1" style="margin-top:8px">${ic("folder")} ${esc(t("w_pickFolder"))}</button>` : ""}
    <form class="form" data-form="wimpalllink"><label>${esc(t("w_upLinks"))}<textarea name="links" rows="3" placeholder="https://docs.google.com/…"></textarea></label><button class="btn block">${esc(t("readLink"))}</button></form>`);
};
A.wImpAllPick = (d) => {
  const inp = document.createElement("input"); inp.type = "file"; inp.multiple = true; inp.accept = W_ACCEPT; if (d.dir) inp.webkitdirectory = true;
  inp.onchange = async () => {
    const files = [...inp.files].filter((f) => /\.(docx|doc|pdf|xlsx|xls|xlsm|csv|ods)$/i.test(f.name)); if (!files.length) { toast(t("err_unsupported"), true); return; }
    toast(t("reading")); const got = [];
    for (const f of files) { try { got.push({ name: f.name, res: await P.file(f) }); } catch (e) { got.push({ name: f.name, err: 1 }); } }
    wApplyAll(got);
  };
  inp.click();
};
F.wimpalllink = async (f) => {
  const urls = f.links.value.split(/\s+/).filter((u) => /^https?:\/\//.test(u)); if (!urls.length) throw new S.AppError("read");
  const got = []; for (const u of urls) { try { const r = await P.link(u); got.push({ name: u.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40), res: r, err: !(r.lines || []).some(Boolean) && !r.tables.length }); } catch { got.push({ name: u, err: 1 }); } }
  wApplyAll(got);
};
function wApplyAll(got, full) {
  const f = $("#warta-form"); if (!f) return; const W = wartaCollect(f); const L = W_LABEL(); const report = [];
  got.forEach((g) => {
    if (g.err) { report.push([g.name, t("w_couldNotRead")]); return; }
    const parts = wartaFromFile(g.res, W.day, W.team, null); const done = [];
    // One file for the whole Warta: also read the Tata Ibadah header (Sunday, theme, passage, times).
    if (full) { const h = headFromFile(g.res) || {}; W_SECS["@head"].forEach((k) => { if (!parts[k] && h[k]) parts[k] = h[k]; }); }
    Object.entries(parts).forEach(([k, v]) => {
      if (v == null || v === "" || (Array.isArray(v) && !v.length)) return;
      if (k === "team") { wSetTeam(f, v); done.push(L.team); return; }
      if (k === "att") { v.forEach((n, i) => { if (f["att" + i]) f["att" + i].value = n; }); done.push(L.att); return; }
      if (k === "finance" || !f[k]) return; f[k].value = v; if (L[k] && !done.includes(L[k])) done.push(L[k]);
    });
    report.push([g.name, done.length ? done.join(", ") : t("w_nothingMatched")]);
  });
  wTimeSync(f); closeSheet();
  setTimeout(() => sheet(t("w_upDone"), `<div class="list">${report.map(([n, d]) => `<div class="li"><span class="grow"><b>${esc(n)}</b><small>${esc(d)}</small></span></div>`).join("")}</div>
    <p class="small muted">${esc(t("w_upDoneLead"))}</p>
    <button class="btn primary block" data-act="wImpPreview">${ic("screen")} ${esc(t("preview"))}</button>`), 230);
}
A.wImpPreview = () => { closeSheet(); setTimeout(() => A.wartaPreview({}, $('[data-act="wartaPreview"]')), 200); };
// PDF viewer: draws each page of the PDF with pdf.js, so the phone shows the file itself.
async function showPdf(file, title, viewOnly) {
  await P.load(P.LIBS.pdf); pdfjsLib.GlobalWorkerOptions.workerSrc = P.LIBS.pdfWorker;
  const doc = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  A.closeWb(); const el = document.createElement("div"); el.id = "wb"; el.className = "warta-prev pdf-view";
  el.innerHTML = `<div class="wb-bar"><button class="icon-btn" data-act="closeWb" aria-label="${esc(t("close"))}">${ic("x")}</button><b>${esc(title)}</b>${viewOnly ? "<span></span>" : `<span class="row"><button class="icon-btn" data-act="pdfShare" aria-label="${esc(t("share"))}">${ic("share")}</button><button class="icon-btn" data-act="pdfSave" aria-label="${esc(t("download"))}">${ic("download")}</button></span>`}</div><div class="wp-scroll"><div class="pdf-pages"></div></div>`;
  document.body.appendChild(el); document.body.classList.add("noscroll"); showPdf.file = file;
  const box = el.querySelector(".pdf-pages"); const w = Math.max(320, el.clientWidth - 16);
  for (let i = 1; i <= doc.numPages; i++) {
    const pg = await doc.getPage(i); const v0 = pg.getViewport({ scale: 1 }); const css = w / v0.width; const dpr = Math.min(3, (window.devicePixelRatio || 1) * 1.5);
    const vp = pg.getViewport({ scale: css * dpr }); const c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height; c.style.width = w + "px"; c.style.height = v0.height * css + "px";
    box.appendChild(c); await pg.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
  }
}
A.pdfSave = () => { const f = showPdf.file; if (f) download(f.name, f); };
A.pdfShare = async () => { const f = showPdf.file; if (!f) return; try { if (navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: f.name }); else download(f.name, f); } catch {} };

// Finds the Warta parts in a file. With `only`, the caller wants one field; otherwise every part found is returned.
const W_HEADS = [
  ["bdays", /^ulang tahun kelahiran\b/i], ["anniv", /^ulang tahun pernikahan\b/i], ["finance", /^warta keuangan\b/i], ["org", /^badan organisasi\b/i],
  ["sambutan", /^sambutan\s*&?\s*tema/i], ["doa", /^pokok doa\b/i], ["info", /^informasi tambahan\b/i], ["att", /^jumlah jemaat\b/i],
  ["team", /^pelayan ibadah\b/i], ["berita", /^berita pelayanan\b/i], ["closingBox", /^majelis gereja hkbp singapore mengucapkan/i], ["ren", /^[“"][A-Z0-9 ,.'!?-]{3,80}[”"]$/], ["wj", /^w\s*a\s*r\s*t\s*a\s+j\s*e\s*m\s*a\s*a\s*t$/i],
];
const plain = (s) => String(s || "").replace(/\*\*/g, "").trim();
function wSections(lines) {
  const out = {}; let cur = "_top";
  lines.forEach((raw) => {
    const l = plain(raw).replace(/^[\d.)\s]+(?=[A-Za-z])/, (m) => (/^\d+[.)]\s*$/.test(m) ? m : "")).trim();
    const h = W_HEADS.find(([, re]) => re.test(plain(raw))) || (/^sambutan&?tema/i.test(plain(raw).replace(/\s+/g, "")) ? ["sambutan"] : null);
    if (h) { cur = h[0]; (out[cur] = out[cur] || []).push({ head: plain(raw) }); return; }
    (out[cur] = out[cur] || []).push(raw);
  });
  Object.keys(out).forEach((k) => { out[k] = out[k].filter((x) => typeof x === "string" || x.head); });
  return out;
}
const sectionText = (arr) => (arr || []).filter((x) => typeof x === "string").join("\n").replace(/\n{3,}/g, "\n\n").replace(/^\n+|\n+$/g, "");
const isNumItem = (l) => /^(\d{1,2}|[a-zA-Z])[.)]\s+\S/.test(plain(l));
function wartaFromFile(res, day, team, only) {
  const lines = linesOfRes(res); const S2 = wSections(lines); const out = {};
  const want = (k) => !only || only === k || (only === "jadwal" && k === "jadwalTitle") || (only === "att" && k === "attDate");
  // Weekly roster from any table that has the Sunday's date.
  if (!only || only === "team") { const tm = rosterFromTables(res.tables || [], day) || (S2.team ? rosterFromTables([{ rows: S2.team.filter((x) => typeof x === "string").map((l) => plain(l).split(/\s*\|\s*/)) }], day) : null); if (tm) out.team = tm; }
  // Names in the birthday / anniversary part: numbered or plain lines, table cells ("A | B"), up to the gift-verse sentence.
  const names = (arr) => {
    const out = [];
    for (const x of (arr || []).filter((y) => typeof y === "string")) {
      const l = plain(x).replace(/\*\*/g, "").trim(); if (!l) continue;
      if (/sebagai kado|tertulis dalam/i.test(l)) break;
      if (/majelis|mengucapkan|satu minggu ini|terkasih yang/i.test(l)) continue;
      l.split(/\s*\|\s*|\t+/).forEach((c) => { c = c.replace(/^(\d{1,2}|[a-zA-Z])[.)]\s+/, "").replace(/^[-•·]\s*/, "").trim(); if (c && c.length < 60 && c.split(/\s+/).length <= 7 && !/[.:!?]$/.test(c)) out.push(c); });
    }
    return out;
  };
  // The gift verse: from "tertulis dalam" to the end of the quoted verse, never the rest of the section.
  const verseOf = (arr) => {
    const s = (arr || []).filter((x) => typeof x === "string").join("\n").replace(/\*\*/g, " "); const i = s.search(/tertulis dalam\s*/i); if (i < 0) return "";
    let r = s.slice(i).replace(/^tertulis dalam\s*/i, ""); const q = r.match(/^[^“"]*[“"][^”"]*[”"]/);
    r = q ? q[0] : r.split(/\n\s*\n/)[0].split("\n").slice(0, 2).join(" ");
    return plain(r.replace(/\s*\n\s*/g, " ")).trim();
  };
  if (S2.bdays) { if (want("bdays")) out.bdays = names(S2.bdays).join("\n"); const v = verseOf(S2.bdays); if (v && want("bdayVerse")) out.bdayVerse = v; }
  if (S2.anniv) { if (want("anniv")) out.anniv = names(S2.anniv).join("\n"); const v = verseOf(S2.anniv); if (v && want("annivVerse")) out.annivVerse = v; }
  if (S2.org && want("org")) out.org = sectionText(S2.org).replace(/^\s*HKBP SINGAPORE\s*\n/i, "");
  if (S2.doa && want("doa")) out.doa = sectionText(S2.doa);
  if (S2.info) {
    const tx = sectionText(S2.info).split("\n"); const j = tx.findIndex((l) => /JADWAL PELAYANAN/i.test(l));
    if (want("info")) out.info = (j >= 0 ? tx.slice(0, j) : tx).join("\n").trim();
    if (j >= 0) { if (want("jadwalTitle")) out.jadwalTitle = plain(tx[j]).replace(/^\d+[.)]\s*/, ""); const jl = []; for (let i = j + 1; i < tx.length && (isNumItem(tx[i]) || !tx[i]); i++) if (tx[i]) jl.push(plain(tx[i])); if (want("jadwal")) out.jadwal = jl.join("\n"); }
  }
  if (S2.berita && want("berita")) out.berita = sectionText(S2.berita);
  if (S2.ren && !/selamat hari minggu/i.test(S2.ren[0].head || "")) {
    const body = S2.ren.filter((x) => typeof x === "string").slice(); while (body.length && !body[0]) body.shift();
    const v = plain(body[0] || "").match(/^\((.+)\)$/); if (v) body.shift();
    const end = body.findIndex((l) => /^selamat hari minggu$/i.test(plain(l))); if (end >= 0) body.length = end;
    let txt = body.join("\n").replace(/\n{3,}/g, "\n\n").trim(); const by = txt.match(/\s*\(([^()]{2,30})\)\s*$/);
    if (by) { txt = txt.slice(0, by.index).trim(); if (want("renunganBy")) out.renunganBy = by[1]; }
    if (txt.split(/\s+/).length > 30) { if (want("renungan")) out.renungan = txt; if (want("renTitle")) out.renTitle = S2.ren[0].head.replace(/^[“"]|[”"]$/g, ""); if (v && want("renVerse")) out.renVerse = v[1]; }
  }
  if (S2.att && (want("att") || want("attDate"))) {
    const head = (S2.att.find((x) => x.head) || {}).head || ""; const dm = head.match(/minggu,?\s*(.+)$/i); if (dm) out.attDate = dm[1].trim();
    const nums = S2.att.filter((x) => typeof x === "string").join(" ").match(/\b\d{1,4}\b/g);
    if (nums && nums.length >= 5) out.att = nums.slice(-5);
  }
  const all = lines.map(plain).join("\n");
  // Sunday name and theme (from a Tata Ibadah or a previous Warta).
  const mg = all.match(/\b(Minggu\s+(?:[IVXLC]+|\d+|ke-?\s*\d+)\s+(?:setelah|sesudah|dung|di)\s+[A-Za-z]+|Minggu\s+(?:Advent|Adven|Epiphanias|Septuagesima|Sexagesima|Estomihi|Invocavit|Reminiscere|Okuli|Letare|Judika|Palmarum|Paskah|Quasimodogeniti|Misericordias Domini|Jubilate|Kantate|Rogate|Exaudi|Pentakosta|Trinitatis)\b(?:\s+[IVX]+)?)/i);
  if (mg && want("minggu")) out.minggu = mg[1].replace(/\s+/g, " ").toUpperCase();
  const th = all.match(/(?:tema|thema|topik)(?:\s+minggu)?\s*:?\s*\n?\s*[“"]([^”"\n]{3,90})[”"]\s*\n?\s*\(?([^)\n]{3,40}\d[^)\n]*)?\)?/i);
  if (th) { if (want("theme")) out.theme = th[1].trim(); if (th[2] && want("verse")) out.verse = th[2].trim(); }
  // A sermon or reflection text: long prose that matched nothing else.
  const words = all.split(/\s+/).length;
  if (want("renungan") && !only && !Object.keys(out).filter((k) => k !== "minggu" && k !== "theme" && k !== "verse").length && words > 80 && !(res.tables || []).some((tb) => tb.rows.length > 3 && tb.rows[0].length > 2)) {
    const L = lines.slice(); while (L.length && !L[0]) L.shift();
    const q = plain(L[0] || "").match(/^[“"](.+)[”"]$/); if (q) { out.renTitle = q[1]; L.shift(); const v = plain(L[0] || "").match(/^\((.+)\)$/); if (v) { out.renVerse = v[1]; L.shift(); } }
    out.renungan = L.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  if (only === "renungan" && !out.renungan) out.renungan = "";
  return out;
}
// Weekly roster: jobs down the side and Sundays across the top (or the other way round), one sheet per month is fine.
function rosterFromTables(tables, day) {
  const next = addDays(day, 7); const found = {};
  const roleOf = (c) => { const k = plain(c).toLowerCase().replace(/\s+/g, " ").replace(/[:.]$/, "").trim(); if (!k || k.length > 40) return null; return ROLE_ALIAS[k] || TEAM_ROLES.find((r) => r.toLowerCase() === k) || null; };
  const dateOf = (c, ym) => { const s = String(c || "").trim(); if (!s || s.length > 30) return null; return rowDate([s], ym); };
  // Two names in one cell (on two lines, or "St. A St. B") become "St. A, St. B".
  const val = (c) => plain(c).split(/\s*[\n;]\s*|\s+(?=(?:C?St|Pdt|Ev|Sy|Bvr|Dr)\.\s)/).filter(Boolean).join(", ");
  // Several lines for one job (more teachers, the instruments under Pemain Musik) are joined.
  const add = (role, d, v) => { if (!v) return; found[role] = found[role] || {}; const o = found[role][d]; if (!o) found[role][d] = v; else if (!o.split(", ").includes(v)) found[role][d] = o + ", " + v; };
  const tabYm = (tb) => { const m = String(tb.name || "").match(/(jan|feb|mar|apr|mei|may|jun|jul|agu|aug|sep|okt|oct|nov|des|dec)\w*\s+(\d{4})/i); return m ? `${m[2]}-${String(MONTHS[m[1].slice(0, 3).toLowerCase()]).padStart(2, "0")}` : null; };
  // A workbook with one tab per month: read only this Sunday's month and next Sunday's month.
  const months = [day.slice(0, 7), next.slice(0, 7)];
  const monthTabs = tables.filter((tb) => months.includes(tabYm(tb)));
  (monthTabs.length ? monthTabs : tables).forEach((tb) => {
    const rows = tb.rows || []; const ymG = tabYm(tb) || day.slice(0, 7);
    // Dates across a row.
    rows.forEach((row, ri) => {
      const cols = {}; row.forEach((c, ci) => { const d = dateOf(c, ymG); if (d === day || d === next) cols[d] = ci; });
      if (!Object.keys(cols).length) return;
      const first = row.findIndex((c) => dateOf(c, ymG)); let last = null; // labels sit left of the first date
      rows.slice(ri + 1).forEach((r) => {
        const labs = r.slice(0, first).map(plain).filter(Boolean); const role = labs.length ? roleOf(labs[0]) : last;
        last = role; if (!role) return;
        Object.entries(cols).forEach(([d, ci]) => add(role, d, val(r[ci])));
      });
    });
    // Dates down a column, jobs across the header row.
    const head = rows.find((r) => r.filter((c) => roleOf(c)).length >= 2);
    if (head) rows.forEach((r) => {
      const d = r.map((c) => dateOf(c, ymG)).find((x) => x === day || x === next); if (!d) return;
      head.forEach((c, ci) => { const role = roleOf(c); if (role) add(role, d, val(r[ci])); });
    });
  });
  const roles = Object.keys(found); if (!roles.length) return null;
  return roles.map((r) => [r, found[r][day] || "", found[r][next] || ""]);
}

// ---------- the printed bulletin ----------
// Two A4 landscape pages (1123 x 794 px). Positions are in points, measured from the secretary's Word layout
// (Arial Narrow, blue letterhead, thick-thin frames), so the PDF matches the printed Warta.
function wInline(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>"); }
// Text with numbered items: "1." / "A." / "a." get a hanging indent; lines under an item stay indented.
function wText(s, o = {}) {
  const n1 = o.n1 || "1.5em", n2 = o.n2 || n1; let lvl = 0, type1 = null, inItem = false; const out = [];
  String(s || "").split(/\n/).forEach((line) => {
    const l = line.trim();
    if (!l) { out.push(`<div class="gap"></div>`); inItem = o.keep ? inItem : false; if (!o.keep) lvl = 0; return; }
    const m = l.match(/^((?:\d{1,2}|[a-zA-Z])[.)])\s+(.*)$/);
    const capsLine = (x) => { const p = plain(x); return p.length > 3 && p === p.toUpperCase() && /[A-Z]{3}/.test(p); };
    if (m) {
      const ty = /^\d/.test(m[1]) ? "1" : /^[A-Z]/.test(m[1]) ? "A" : "a";
      if (!inItem || type1 === null || ty === type1 || lvl === 0) { lvl = 1; type1 = ty; } else lvl = 2;
      inItem = true;
      const bold = lvl === 1 ? (o.b1 === true || (o.b1 !== false && capsLine(m[2]))) : (o.b2 === true || capsLine(m[2]));
      const txt = wInline(m[2]);
      out.push(`<div class="wi l${lvl}" style="--n:${lvl === 1 ? n1 : n2}${lvl === 2 ? `;--p:${n1}` : ""}"><span class="wn">${bold && lvl === 1 ? `<b>${esc(m[1])}</b>` : esc(m[1])}</span><span class="wt">${bold ? `<b>${txt}</b>` : txt}</span></div>`);
      return;
    }
    const head = capsLine(l) || (/:$/.test(l) && l.length < 60 && !/[.,]\s/.test(l.slice(0, -1)));
    if (inItem && !head) { out.push(`<div class="wp-p" style="padding-left:${lvl === 2 ? `calc(${n1} + ${n2})` : n1}">${wInline(l)}</div>`); return; }
    inItem = false; lvl = 0;
    out.push(`<div class="wp-p">${head ? `<b>${wInline(l)}</b>` : wInline(l)}</div>`);
  });
  while (out.length && out[out.length - 1] === `<div class="gap"></div>`) out.pop();
  return out.join("");
}
const wNames = (s) => { const xs = String(s || "").split(/\n/).map((x) => x.trim().replace(/^\d{1,2}[.)]\s*/, "")).filter(Boolean); return xs.length ? xs.map((x, i) => `<div class="wi l1" style="--n:18pt"><span class="wn"><b>${i + 1}.</b></span><span class="wt"><b>${wInline(x)}</b></span></div>`).join("") : ""; };
// Organisation column: group headings in bold italic, names in italic, phone numbers lined up with a WhatsApp mark.
function wOrg(s) {
  const lines = String(s || "").split(/\n/).map((l) => l.trim()).filter((l, i) => !(i < 3 && /^(badan organisasi|hkbp singapore)$/i.test(l)));
  while (lines.length && !lines[0]) lines.shift();
  return lines.map((l) => {
    if (!l) return `<div class="gap" style="height:.4em"></div>`;
    const ph = l.match(/^(.*?)[\s\t]*((?:\+?65[\s-]?)?\d{4}[\s-]?\d{4})$/);
    const isHead = /\*\*/.test(l) || /:\s*$/.test(l) || /^(spiritual|preacher|deacons|ordinary|anggota|dewan|sintua|majelis|parhalado)\b/i.test(plain(l));
    const body = (txt) => (isHead ? `<b>${wInline(plain(txt))}</b>` : wInline(txt));
    if (ph && ph[1]) return `<div class="og p"><span>${body(ph[1])}</span><span class="ph"><img src="warta/wa.png" alt="">${esc(ph[2])}</span></div>`;
    if (ph) return `<div class="og"><span class="ph solo"><img src="warta/wa.png" alt=""><b>${esc(ph[2])}</b></span></div>`;
    return `<div class="og"><span>${body(l)}</span></div>`;
  }).join("");
}
function wartaHtml(W) {
  const next = addDays(W.day, 7); const ver = (s) => { const i = String(s || "").indexOf(":", String(s || "").indexOf(":") + 1); return i > 0 ? [s.slice(0, i), s.slice(i + 1).trim()] : [s, ""]; };
  const [bv1, bv2] = ver(W.bdayVerse); const [av1, av2] = ver(W.annivVerse);
  const up = (s) => esc(String(s || "").toUpperCase());
  const theme = up(W.theme), verse = up(W.verse);
  const rTitle = up(W.renTitle || W.theme), rVerse = up(W.renTitle ? W.renVerse : W.renVerse || W.verse);
  const ren = String(W.renungan || "").trim() + (W.renunganBy ? ` (${W.renunganBy})` : "");
  const minggu = esc(String(W.minggu || "").replace(/\s+/g, " ").trim());
  const att = W.att || []; const hasAtt = att.some(Boolean);
  return `<div class="wp" data-page="1">
    <div class="wr" data-fit="shrink" data-fs="9.96" style="left:35.2pt;top:29.5pt;width:373.4pt;height:482pt;font-size:9.96pt">
      <div class="wp-p"><b>Ulang Tahun Kelahiran</b></div>
      <div class="wp-p">Majelis &amp; Warga Jemaat mengucapkan Selamat Ulang Tahun bagi Bpk/Ibu/Sdr/i terkasih yang berulang tahun dalam satu minggu ini:</div>
      <div class="gap"></div>${W.bdays ? `<div class="names">${wNames(W.bdays)}</div><div class="gap"></div>` : ""}
      <div class="wp-p">Sebagai kado ulang tahun, terimalah Firman Tuhan yang tertulis dalam <b>${esc(bv1)}${bv2 ? `: ${esc(bv2)}` : ""}</b></div>
      <div class="gap"></div>
      <div class="wp-p"><b>Ulang Tahun Pernikahan</b></div>
      <div class="wp-p">Majelis &amp; Warga Jemaat mengucapkan Selamat Ulang Tahun Pernikahan bagi Bpk/Ibu terkasih yang merayakan ulang tahun pernikahan dalam satu minggu ini:</div>
      <div class="gap"></div>${W.anniv ? `<div class="names">${wNames(W.anniv)}</div><div class="gap"></div>` : ""}
      <div class="wp-p">Sebagai kado ulang tahun pernikahan, terimalah Firman Tuhan yang tertulis dalam <b>${esc(av1)}${av2 ? `: ${esc(av2)}` : ""}</b></div>
      <div class="gap"></div>
      <div class="wp-p"><b>WARTA KEUANGAN</b></div>
      <div class="fin" style="font-size:.904em;margin-top:.45em">${wText(W.finance, { n1: "14.4pt", n2: "7.4pt", b1: true, keep: false })}</div>
    </div>
    <div class="wbox" style="left:26.2pt;top:517.2pt;width:387.1pt;height:53pt">
      <div style="top:1.3pt">Majelis Gereja HKBP Singapore mengucapkan <b>:</b></div>
      <img src="warta/corsiva.png" alt="Selamat Hari Minggu" style="position:absolute;left:146.3pt;top:15.2pt;width:94.56pt;height:11.52pt">
      <div style="top:27.6pt">${esc(W.closing)}</div>
      <div style="top:40.3pt"><b>TUHAN MEMBERKATI</b></div>
    </div>
    <img class="whead" src="warta/head.jpg" alt="" style="left:435.8pt;top:17.7pt;width:396.8pt;height:112.1pt">
    <div class="hl hl-a" style="top:${(67.6 - 0.8465 * 11.7).toFixed(2)}pt;font-size:11.7pt">${esc(W.resort)}</div>
    <div class="hl hl-b" style="top:${(83.2 - 0.8465 * 12.4).toFixed(2)}pt;font-size:12.4pt">${minggu.toUpperCase()}</div>
    <div class="hl hl-b" style="top:${(98.8 - 0.8465 * 12.4).toFixed(2)}pt;font-size:12.4pt">${esc(fmtID(W.day))}</div>
    <div class="hl hl-c" style="top:${(109.6 - 0.8465 * 12.4).toFixed(2)}pt;font-size:12.4pt">${esc(W.address)}</div>
    <div class="hl hl-c" style="top:${(122.8 - 0.8465 * 12.4).toFixed(2)}pt;font-size:12.4pt">Email Address: ${esc(W.email)}</div>
    ${[[435.6, 130.3, 2.9, 447.6], [439.4, 130.3, 0.5, 443.5], [553.4, 130.3, 2.9, 446.2], [557.3, 130.3, 0.7, 443.5], [828.0, 130.3, 3.1, 446.2], [831.6, 130.3, 1.0, 447.6], [439.4, 573.8, 116.9, 2.7], [557.3, 573.8, 273.8, 2.7], [435.6, 577.4, 397, 0.5]].map(([x, y, w, h]) => `<i class="ln" style="left:${x}pt;top:${y}pt;width:${w}pt;height:${h}pt"></i>`).join("")}
    <img src="warta/badan.png" alt="BADAN ORGANISASI HKBP SINGAPORE" style="position:absolute;left:460.8pt;top:133.64pt;width:71.52pt;height:20.4pt">
    <div class="wr org" data-fit="shrink" data-fs="6.96" style="left:443.3pt;top:156.2pt;width:108.5pt;height:416pt;font-size:6.96pt">${wOrg(W.org)}</div>
    <div class="wr ren" data-fit="fill" data-fs="6.96" data-max="11.5" style="left:561.2pt;top:136.2pt;width:263.8pt;height:437pt;font-size:6.96pt">
      ${rTitle ? `<div class="rt"><b>“${rTitle}”</b>${rVerse ? `<br><b>(${rVerse})</b>` : ""}</div>` : ""}
      ${wText(ren, { n1: "18pt", b1: true, keep: true })}
      <div class="rf"><b>Selamat Hari Minggu<br>Tuhan Yesus Memberkati</b></div>
    </div>
  </div>
  <div class="wp" data-page="2">
    <div class="samb" style="left:28.6pt;top:33.1pt;width:381.6pt;height:133.2pt">
      <img src="warta/samb.png" alt="Sambutan &amp; Tema Ibadah" style="position:absolute;left:${(130 - 28.6).toFixed(2)}pt;top:${(47.12 - 33.1).toFixed(2)}pt;width:178.08pt;height:11.04pt">
      <div class="sb" data-fit="shrink" data-fs="12.96" style="top:${(72.9 - 0.9215 * 12.96 - 33.1).toFixed(2)}pt;font-size:12.96pt">
        <div>SHALOM! Selamat hari Minggu buat kita semua.</div>
        <div>Dengan sukacita kami mengucapkan selamat beribadah untuk jemaat sekalian. Hari ini adalah ${minggu.toUpperCase()}</div>
        <div class="gap"></div>
        <div style="font-size:.926em">Dengan tema Minggu:</div>
        <div style="font-size:.852em">“${theme}”</div>${verse ? `<div style="font-size:.852em">(${verse})</div>` : ""}
      </div>
    </div>
    <div class="wr" data-fit="shrink" data-fs="11.04" style="left:28.1pt;top:${(181.7 - 0.9215 * 11.04).toFixed(2)}pt;width:381pt;height:${(477 - 181.7 + 0.9215 * 11.04).toFixed(2)}pt;font-size:11.04pt">
      <div class="wp-p"><b>Pokok Doa (Didoakan Pengkhotbah)</b></div>
      ${wText(W.doa, { n1: "14.1pt", b1: false })}
      <div class="bar">INFORMASI TAMBAHAN (UNTUK DIBACA SENDIRI)</div>
      <div class="info">${wText(W.info, { n1: "18pt", b1: true, keep: true })}</div>
      ${W.jadwal ? `<div class="gap"></div><div class="gap"></div><div class="wi l1" style="--n:18pt"><span class="wn"><b>${String(W.info || "").match(/^\s*\d+[.)]/m) ? (String(W.info).match(/^\s*(\d+)[.)]/gm) || []).length + 1 : 1}.</b></span><span class="wt"><b>${esc(W.jadwalTitle)}</b></span></div>
        <div class="jad">${wText(W.jadwal, { n1: "14.1pt", b1: false })}</div>` : ""}
    </div>
    ${hasAtt ? `<table class="att" style="left:35pt;top:478.3pt;width:355pt"><colgroup>${[63.6, 71.1, 56.6, 56.7, 106.5].map((w) => `<col style="width:${w}pt">`).join("")}</colgroup>
      <tr><td colspan="5">JUMLAH JEMAAT DI MINGGU, ${esc(W.attDate || "")}</td></tr>
      <tr><td>BAPAK</td><td>IBU</td><td>NAPOSO</td><td>REMAJA</td><td>SEKOLAH MINGGU</td></tr>
      <tr>${[0, 1, 2, 3, 4].map((i) => `<td>${esc(att[i] || "")}</td>`).join("")}</tr></table>` : ""}
    <img src="warta/banner.png" alt="WARTA JEMAAT" style="position:absolute;left:453.92pt;top:22.32pt;width:338.16pt;height:16.8pt">
    <div style="position:absolute;left:435.6pt;top:${(47.7 - 0.8465 * 8.04).toFixed(2)}pt;font:700 8.04pt/1 var(--wn)">PELAYAN IBADAH</div>
    <table class="team" style="left:441.1pt;top:49.4pt;width:370.3pt"><colgroup><col style="width:79.2pt"><col style="width:149.1pt"><col style="width:142pt"></colgroup>
      <tr class="th"><td>Tanggal</td><td>Minggu,<br>${dmy(W.day)} ${esc(W.timeThis)}</td><td>Minggu,<br>${dmy(next)} ${esc(W.timeNext)}</td></tr>
      ${(W.team || []).map(([r, a, b]) => `<tr><td>${esc(r)}</td><td>${esc(a || "-").replace(/\n/g, "<br>")}</td><td>${esc(b || "-").replace(/\n/g, "<br>")}</td></tr>`).join("")}</table>
    <div class="wr ber" data-fit="shrink" data-fs="8.52" data-after=".team" style="left:435.6pt;top:212.6pt;width:379.5pt;height:372pt;font-size:8.52pt">
      <div class="wp-p"><b>BERITA PELAYANAN</b></div>
      ${wText(W.berita, { n1: "14.2pt", n2: "14.1pt", b1: true, keep: true })}
    </div>
  </div>`;
}
// Each text area keeps the Word sizes. Long text is made smaller until it fits; the cover reflection also grows to fill its column.
function fitWarta(root) {
  root.querySelectorAll(".wp").forEach((pg) => {
    const team = pg.querySelector(".team"), ber = pg.querySelector(".ber");
    if (team && ber) { const bottom = team.offsetTop + team.offsetHeight; const top = Math.max(212.6 * 4 / 3, bottom + 9.6 * 4 / 3); ber.style.top = top + "px"; ber.style.height = 585 * 4 / 3 - top + "px"; }
    pg.querySelectorAll("[data-fit]").forEach((el) => {
      const base = +el.dataset.fs; const max = +(el.dataset.max || base); const over = () => el.scrollHeight > el.clientHeight + 1;
      if (el.classList.contains("sb")) { el.style.fontSize = base + "pt"; let f = base; while (el.offsetTop + el.offsetHeight > el.parentNode.clientHeight - 4 && f > 8) { f -= 0.25; el.style.fontSize = f + "pt"; } return; }
      if (el.dataset.fit === "fill") {
        let lo = 5, hi = max; el.style.fontSize = hi + "pt";
        if (!over()) { let lh = 1.157; while (!over() && lh < 1.6) { lh += 0.03; el.style.lineHeight = lh; } if (over()) el.style.lineHeight = lh - 0.03; return; }
        for (let i = 0; i < 12; i++) { const mid = (lo + hi) / 2; el.style.fontSize = mid + "pt"; if (over()) hi = mid; else lo = mid; }
        el.style.fontSize = lo + "pt"; return;
      }
      let f = base; el.style.fontSize = f + "pt";
      while (over() && f > 5.5) { f -= 0.2; el.style.fontSize = f + "pt"; }
    });
  });
}
// The bulletin fonts: Arial Narrow and Arial when the phone has them, otherwise the same-width Liberation fonts bundled with the app.
function wartaFonts() {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  return Promise.all(["400 10pt WNarrow", "700 10pt WNarrow", "italic 400 10pt WNarrow", "italic 700 10pt WNarrow", "400 10pt WArial", "700 10pt WArial"].map((f) => document.fonts.load(f).catch(() => {}))).then(() => document.fonts.ready);
}
function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => { s.remove(); rej(new S.AppError("offline")); }; document.head.appendChild(s);
  });
}
async function wartaPdf(W) {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  const host = document.createElement("div"); host.className = "warta-host"; host.innerHTML = wartaHtml(W); document.body.appendChild(host);
  try {
    await wartaFonts();
    await Promise.all([...host.querySelectorAll("img")].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
    fitWarta(host);
    const pdf = new window.jspdf.jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
    const pages = host.querySelectorAll(".wp");
    for (let i = 0; i < pages.length; i++) {
      const c = await window.html2canvas(pages[i], { scale: 2.5, backgroundColor: "#ffffff", logging: false });
      if (i) pdf.addPage();
      pdf.addImage(c.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 297, 210);
    }
    return new File([pdf.output("blob")], `Warta Jemaat Minggu ${fmtID(W.day)}.pdf`, { type: "application/pdf" });
  } finally { host.remove(); }
}

// ---------- start ----------
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
navigator.serviceWorker && navigator.serviceWorker.addEventListener("message", (e) => { if (e.data && e.data.url) location.hash = e.data.url; });
const qs = new URLSearchParams(location.search);
(async () => {
  if (qs.get("demo") === "1" && api.mode === "local" && await api.needsSetup()) { await seedDemo(); }
  await render(); localReminders();
})();
document.addEventListener("visibilitychange", async () => { if (document.visibilityState === "visible" && D && !/^#\/login/.test(location.hash)) { try { await refresh(); if (!$("#sheet").classList.contains("open")) render(); localReminders(); } catch {} } });
})();
