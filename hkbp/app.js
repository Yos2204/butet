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
  redo: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  groups: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M15 14.5c3 0 6 1.8 6 5.5"/>',
  roster: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4M7 13h4M7 17h7"/>',
  calendar: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4"/><circle cx="12" cy="15" r="1.6"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  chat: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z"/><path d="M8.5 9.5h7M8.5 12.5h4"/>',
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
  gshare: '<path d="M12 15V4"/><path d="M8 8l4-4 4 4"/><path d="M6 12v8h12v-8"/>',
  gplus: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/>',
  gdots: '<circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/>',
  gcheck: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  gopen: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
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
const hasRights = () => !!(D && (D.me.is_admin || "parhalado" in (D.me.groups || {}) || Object.values(D.me.groups || {}).some((r) => ["chair", "maker", ...MAKERS, "teacher"].includes(r))));
// Multimedia: only people on the maker list (or its chair) may open the Tata Ibadah workbench; checkers and everyone else read.
const isMMMaker = () => !!(D && (D.me.is_admin || ["maker", "chair"].includes((D.me.groups || {}).multimedia)));
// Events (church-wide and per category) are set up only by Multimedia makers (YB 2026-10-28); the server checks this too.
const canEvents = () => manage() && isMMMaker();
// Sunday School and Remaja rosters are made by their Teacher Makers (YB 2026-10-28); the server uses the same rule.
const ROSTER_CATS = ["sekolah-minggu", "remaja"];
const canRoster = (gid) => manage() && (D.me.is_admin || roleIn(gid) === "chair" || (gid === "multimedia" && isMMMaker()) || (ROSTER_CATS.includes(gid) && isTMaker(gid)));
// Maker or User comes from the maker list (no pop-up): makers can edit, everyone else reads.
const mmRole = () => (D ? (isMMMaker() ? "maker" : "checker") : "");
const setMMRole = (v) => { try { v ? sessionStorage.setItem("hkbp.mm", v) : sessionStorage.removeItem("hkbp.mm"); } catch {} };
const manage = () => viewMode() === "admin" && hasRights();
const isAdmin = () => !!(D && D.me.is_admin) && manage();
const isElder = () => manage() && (D.me.is_admin || "parhalado" in (D.me.groups || {}));
// Daily bread is written only by the Elders Makers (chair of Parhalado) and the admin.
const isBreadMaker = () => manage() && (D.me.is_admin || (D.me.groups || {}).parhalado === "chair");
const roleIn = (gid) => (D.me.groups || {})[gid] || null;
// Youth and Sunday School are run by teachers: only a Teacher Maker (phone checked once per session) posts materials, news, events and polls.
// A Teacher reads everything and starts or ends polls in class. Other categories: the chair (and the admin) post.
const TEACH = S.TEACH || ["naposo", "sekolah-minggu", "remaja", "ama", "ina", "pelaut"];
const MAKERS = S.MAKERS || ["tmaker", "ychair", "ytreasurer", "ysecretary"];
// Youth's Makers are its officers (YB 2026-10-25); the other teacher-run classes have Teacher Makers.
const roleLabel = (gid, r) => t(r === "tmaker" && ["ama", "ina", "pelaut"].includes(gid) ? "role_k" + gid : r === "chair" && ["band", "parhalado", "song-leader", "musik", "koor"].includes(gid) ? "role_maker" : "role_" + r);
const makerRoles = (gid) => (gid === "naposo" ? ["ychair", "ytreasurer", "ysecretary"] : ["tmaker"]);
const isTeachG = (gid) => TEACH.includes(gid);
const isTMaker = (gid) => !!D && (D.me.is_admin || MAKERS.includes(roleIn(gid)));
const isTeacherIn = (gid) => !!D && (D.me.is_admin || [...MAKERS, "teacher"].includes(roleIn(gid)));
// Teacher Makers confirm their phone number every time they open Youth or Sunday School; leaving the class forgets it.
let tmPass = null;
// The admin (YB) is a full Maker everywhere and is never asked for the phone check.
const tmOk = (gid) => !!D && (D.me.is_admin || (!!tmPass && tmPass.phone === D.me.phone && (!gid || tmPass.g === gid)));
const tmTitle = (gid) => t("tmVerifyRole", roleLabel(gid, makerRoles(gid).includes(roleIn(gid)) ? roleIn(gid) : makerRoles(gid)[0]));
const setTmOk = (g) => { tmPass = g ? { g, phone: D.me.phone } : null; };
window.addEventListener("hashchange", () => { try { wAutoFlush(false); draftFlush(); } catch (e) { console.warn(e); } });
window.addEventListener("hashchange", () => { const g = (location.hash.match(/^#\/g\/([\w-]+)/) || [])[1]; if (tmPass && g !== tmPass.g) tmPass = null; if (g !== hydrate.tmAsked) hydrate.tmAsked = null; });
const canEdit = (gid) => manage() && (isTeachG(gid) ? isTMaker(gid) && tmOk(gid) : D.me.is_admin || roleIn(gid) === "chair");
// Parhalado polls are started and ended by its makers (chair); in the classes, by every teacher.
const canRunPoll = (gid) => manage() && (gid === "parhalado" ? D.me.is_admin || roleIn(gid) === "chair" : isTeacherIn(gid));
const canSee = (g) => (g.kind === "office" ? isOffice() : (g.kind === "service" && g.id !== "parhalado") || isElder() || !!roleIn(g.id) || !!(D && D.me.is_admin));
// First-login profile (YB 2026-10-24): four questions pick which categories the member sees.
// Everyone gets it except YB (super admin, sees everything). Categories a member leads (chair, teacher...) always show.
const PROFILE_SKIP = ["85334780"];
// "Status aplikasi & notifikasi" is for YB only (YB 2026-10-28); the server checks this too.
const isYB = () => !!D && !isGuest() && !!me() && S.phone8(me().phone) === "85334780";
const pfSkipped = () => !!D && !isGuest() && !!me() && PROFILE_SKIP.includes(S.phone8(me().phone));
// YB can try the questions on his own account (test mode, this phone only), then end the test to see everything again.
const profileOn = () => !!D && !isGuest() && !!me() && (!pfSkipped() || !!LS.get("pfTest"));
// Rules (YB 2026-10-28), the same as the server's hk__auto_groups:
// married + male: Ama + Sekolah Minggu; married + female: Ina + Sekolah Minggu; not married + sidi or pelaut: Naposobulung;
// not married + not sidi: Remaja; pelaut adds Pelaut & Pekerja. The server's saved result (profile.auto) wins when present.
function profileCats(p) {
  if (!p) return null;
  if (Array.isArray(p.auto)) return p.auto.filter((id) => (G(id) || {}).kind === "sermon");
  const c = [];
  if (p.married) c.push(p.male ? "ama" : "ina", "sekolah-minggu");
  else c.push(p.confirmed || p.pelaut ? "naposo" : "remaja");
  if (p.pelaut) c.push("pelaut");
  return c;
}
// Second pop-up (YB 2026-10-24): pick the service sections you serve in; Jadwal then shows only those. Pilot: YB only.
const SERVE_PILOT = ["85334780"];
const serveOn = () => !!D && !isGuest() && !!me() && SERVE_PILOT.includes(S.phone8(me().phone));
// Asked again on the first open of every month (YB 2026-10-24), with last month's picks ticked.
const serveDue = () => { if (!serveOn()) return false; const p = me().profile || {}; return !p.serve || (p.serve_ym || "") < today().slice(0, 7); };
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
  // Surname alone ("Gultom") too, when only one member has it (YB 2026-10-28); the server uses the same rule.
  const last = toks[toks.length - 1]; if (toks.length >= 2 && last.length >= 3 && D.people.filter((p) => norm(p.name).split(" ").includes(last)).length <= 1) out.add(last);
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
  setTimeout(() => { try { tataPrefetch(); } catch (e) {} }, 3000);
  if (D && !D.guest && api.ping) { let k = "pinged"; try { if (!sessionStorage.getItem(k)) { sessionStorage.setItem(k, "1"); api.ping(standalone()).catch(() => {}); } } catch {} }
}
const isGuest = () => !D || !!D.guest;
// Go to sign-in, and come back to the same page afterwards.
let A_signIn = () => { LS.set("afterLogin", location.hash && !/^#\/login/.test(location.hash) ? location.hash : "#/home"); closeSheet(); location.hash = "#/login"; };
const backAfterLogin = () => { const h = LS.get("afterLogin", "#/home") || "#/home"; LS.set("afterLogin", null); location.hash = h; };
const signInCard = (msg) => `<div class="card center pad sign-in-card">${ic("lock")}<p>${esc(msg)}</p><button class="btn primary" data-act="signIn">${ic("lock")} ${esc(t("signIn"))}</button></div>`;

// ---------- layout ----------
let CUR_TAB = "#/home"; // the bottom tab the current page belongs to (used by swipe navigation)
const TABS = [["home", "#/home", "tab_home"], ["groups", "#/groups", "tab_groups"], ["calendar", "#/calendar", "sched"], ["chat", "#/chat", "Chat"], ["more", "#/more", "tab_more"]];
function shell(active, inner, opts = {}) {
  // People who are not signed in see only Home, plus a Sign in tab (YB 2026-10-28).
  const tabs = isGuest() ? TABS.filter(([, h]) => h === "#/home") : TABS;
  // Rosters pages light up the Schedule tab too (YB 2026-10-29: calendar and rosters combined).
  const act = active === "#/serve" ? "#/calendar" : active; CUR_TAB = act; const label = (k) => (k === "sched" ? L3("Jadwal", "Jadwal", "Schedule") : k === "Chat" ? "Chat" : t(k));
  const nav = tabs.map(([i, h, k]) => `<a href="${h}" class="${act === h ? "on" : ""}" ${act === h ? 'aria-current="page"' : ""}>${ic(i)}${tabBadge(h)}<span>${esc(label(k))}</span></a>`).join("")
    + (isGuest() ? `<a href="#/login" data-act="signIn">${ic("lock")}<span>${esc(t("signIn"))}</span></a>` : "");
  return `
  <header class="top">
    ${opts.back ? `<a class="icon-btn" href="${opts.back}" aria-label="${esc(t("back"))}">${ic("back")}</a>` : `<img class="logo-sm" src="logo.png" alt="">`}
    <div class="brand"><b>${esc(opts.title || "Sada HKBPS")}</b>${opts.sub ? `<small>${esc(opts.sub)}</small>` : `<small>${esc(t("tagline"))}</small>`}</div>
    ${langSwitch()}
  </header>
  ${D && D.offline ? `<div class="banner">${esc(t("offline"))}</div>` : ""}
  ${api.mode === "local" ? `<div class="banner soft">${ic("phone")} ${esc(t("demoBanner"))}</div>` : ""}
  <main${opts.cols ? ' class="cols"' : ""}>${inner}</main>
  <nav class="tabs"><div class="in" style="grid-template-columns:repeat(${tabs.length + (isGuest() ? 1 : 0)},1fr)">${nav}</div></nav>`;
}
const langSwitch = () => `<div class="langs" role="group" aria-label="${esc(t("language"))}">${["id", "bt", "en"].map((l) => `<button data-act="lang" data-l="${l}" aria-pressed="${lang === l}">${l.toUpperCase()}</button>`).join("")}</div>`;
const empty = (msg, icon = "star") => `<div class="empty">${ic(icon)}<p>${esc(msg)}</p></div>`;
const roleBadge = (gid) => { if (!manage()) return ""; const r = isAdmin() && !roleIn(gid) ? "admin" : roleIn(gid); return r ? `<span class="badge ${MAKERS.includes(r) ? "chair" : r === "teacher" ? "member" : r}">${esc(roleLabel(gid, r))}</span>` : ""; };
const groupTile = (g, extra = "") => `<a class="gtile" href="#/${({ sermon: "g", office: "o" })[g.kind] || "s"}/${g.id}" style="--gc:${g.color}">
    <span class="gicon">${ic(g.icon)}</span><span class="gname"><b>${esc(gname(g))}</b><small>${extra}</small></span>${newBadge(g.kind !== "office" && groupNew(g.id))}${roleBadge(g.id)}${ic("chev", "chev")}</a>`;

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
        <label>${esc(t("f_phone"))}<div class="phone-in"><span>+65</span><input name="phone" inputmode="numeric" required placeholder="8123 4567" autocomplete="username" data-phonecheck value="${esc(LS.get("remote.phone") || "")}"></div></label>
        <p class="small muted pc-hint" aria-live="polite"></p>
        <p class="small muted pc-note">${esc(t("pcNotice"))}</p>
        <div class="pc-reg" hidden><label>${esc(t("f_name"))}<input name="rname" maxlength="80" autocomplete="name"></label></div>
        <div class="pc-pw" hidden><label>${esc(t("f_password"))}<input name="pw" type="password" autocomplete="current-password"></label></div>
        <div class="pc-new" hidden>
          <label>${esc(t("f_newPw"))}<input name="npw" type="password" minlength="6" autocomplete="new-password"></label>
          <label>${esc(t("f_pw2"))}<input name="npw2" type="password" minlength="6" autocomplete="new-password"></label>
        </div>
        <button class="btn primary block" disabled>${ic("lock")} <span class="pc-btn">${esc(t("signIn"))}</span></button>
        <p class="small muted center pc-forgot" hidden>${esc(t("forgot"))}</p>
        <p class="center pc-browse" hidden><a class="small" href="#/home">${esc(t("pcBrowse"))}</a></p>
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
      ${isGuest() ? "" : `<a class="search-entry" href="#/search">${ic("search")}<span>${esc(L3("Cari anggota, acara, file, roster…", "Bilang ruas, ulaon, file…", "Search members, events, files, rosters…"))}</span></a>`}
    </section>
    ${isGuest() ? `<button class="card notify-ask" data-act="signIn">${ic("lock")}<span><b>${esc(t("guestTitle"))}</b><small>${esc(L3("Masuk untuk melihat Tata Ibadah, kalender, roster, kategorial dan tugas Anda.", "Masuk asa diida Tata Ibadah, kalender, roster, kategorial dohot ulaonmu.", "Sign in to see the Tata Ibadah, calendar, rosters, your categories and your duties."))}</small></span>${ic("chev", "chev")}</button>` : ""}
    ${mine ? `<div class="card hbd">${ic("cake")}<div><h2>${esc(t("hbdTitle", firstName(m.name)))}</h2><p>${esc(t("hbdBody"))}</p></div></div>` : ""}
    ${wishesCard()}
    ${m.wed && m.wed.slice(5) === day.slice(5) ? `<div class="card hbd">💍<div><h2>${esc(t("annivTitle", firstName(m.name)))}</h2><p>${esc(t("annivBody"))}</p></div></div>` : ""}
    ${annivToday.length ? `<article class="card"><div class="card-h"><h3>💍 ${esc(t("annivs"))}</h3></div>${annivToday.map((p) => `<div class="li">${avatarOf(p)}<span class="grow"><b>${esc(p.name)}</b><small>${esc(t("today"))}</small></span>${p.phone && p.id !== m.id ? `<a class="icon-btn wa" href="${wa(t("annivWish", firstName(p.name)), p.phone)}" target="_blank" rel="noopener" aria-label="WhatsApp">${ic("wa")}</a>` : `<span class="party">🎉</span>`}</div>`).join("")}</article>` : ""}
    ${notifyAsk ? `<button class="card notify-ask" data-act="notify">${ic("bell")}<span><b>${esc(t("notifyAskTitle"))}</b><small>${esc(standalone() || !/iP(hone|ad)/.test(navigator.userAgent) ? t("notifyAskBody") : t("iosInstallFirst"))}</small></span>${ic("chev", "chev")}</button>` : ""}

    ${nowCard()}
    ${thisSundayCard()}
    ${voyageHomeCard()}
    ${griefHomeCard()}
    <article class="card bread-card">
      <div class="kicker">${ic("bread")} ${esc(t("breadTitle"))}</div>
      ${b ? `
        <p class="verse-ref">${esc(b.verse || "")}</p>
        <h2>${esc(b.title || "")}</h2>
        <p class="clamp">${esc(b.body || "")}</p>
        ${isGuest() ? `<div class="row"><a class="btn primary" href="#/bread/${b.day}">${esc(t("seeMore"))}</a></div>` : `<div class="row"><a class="btn primary" href="#/bread/${b.day}">${esc(t("readMore"))}</a><a class="btn wa" href="${wa(breadText(b))}" target="_blank" rel="noopener">${ic("wa")} WhatsApp</a></div>`}` : `
        <p class="muted">${esc(t("noBread"))}</p>
        ${isGuest() ? `<a class="btn" href="#/bread">${esc(t("seeMore"))}</a>` : isBreadMaker() ? `<a class="btn primary" href="#/bread/new">${ic("edit")} ${esc(t("writeBread"))}</a>` : `<a class="btn" href="#/bread">${esc(t("breadArchive"))}</a>`}`}
    </article>

    ${bdays.length ? `<article class="card">
      <div class="card-h"><h3>${ic("cake")} ${esc(t("birthdays"))}</h3><a class="small" href="#/people">${esc(t("seeAll"))}</a></div>
      ${bdays.slice(0, 6).map(({ p, day: d, inDays }) => `<div class="li">${avatarOf(p)}<span class="grow"><b>${esc(p.name)}</b><small>${esc(inDays === 0 ? t("today") : inDays === 1 ? t("tomorrow") : fmt(d, { weekday: "long", day: "numeric", month: "short" }))}</small></span>
        ${inDays === 0 ? wishBtn(p) : ""}${inDays === 0 && p.phone && p.id !== m.id ? `<a class="icon-btn wa" href="${wa(t("hbdWish", firstName(p.name)), p.phone)}" target="_blank" rel="noopener" aria-label="WhatsApp">${ic("wa")}</a>` : inDays === 0 ? `<span class="party">🎉</span>` : ""}</div>`).join("")}
    </article>` : ""}

    ${isGuest() ? [["bday", "🎂", "celebBdayTitle", "celebNoBday"], ["wed", "💍", "celebWedTitle", "celebNoWed"]].map(([k, emo, title, none]) => { const list = (D.celebrations || []).filter((c) => c.kind === k && c.day === day); return `<article class="card">
      <div class="card-h"><h3>${emo} ${esc(t(title))}</h3></div>
      ${list.length ? list.map((c) => { const n = Math.round((new Date(c.day + "T12:00:00Z") - new Date(day + "T12:00:00Z")) / 864e5); return `<div class="li"><span class="avatar">${esc(initials(c.name))}</span><span class="grow"><b>${esc(c.name)}</b><small>${esc(n === 0 ? t("today") : n === 1 ? t("tomorrow") : fmt(c.day, { weekday: "long", day: "numeric", month: "short" }))}</small></span>${n === 0 ? `<span class="party">🎉</span>` : ""}</div>`; }).join("") : `<p class="muted small">${esc(t(none))}</p>`}
    </article>`; }).join("") : ""}

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
  return `<a class="li" href="${rosterHome(d.roster.group_id, d.roster.month)}" style="--gc:${d.group ? d.group.color : "#64748b"}">
    <span class="date-chip">${d.date ? `<b>${esc(fmt(d.date, { day: "numeric" }))}</b><small>${esc(fmt(d.date, { month: "short" }))}</small>` : `<small>${esc(fmt(d.roster.month + "-15", { month: "short" }))}</small>`}</span>
    <span class="grow"><b>${esc(gname(d.group))}${d.roles.length ? " · " + esc(d.roles.join(", ")) : ""}</b><small>${esc(d.row.slice(0, 120))}</small></span></a>`;
}
function eventRow(e) {
  const p = sgParts(e.starts_at); const g = e.group_id ? G(e.group_id) : null; const past = new Date(e.starts_at) < Date.now();
  return `<div class="li ev ${past ? "past" : ""}" style="--gc:${g ? g.color : "var(--brand)"}">
    <span class="date-chip"><b>${esc(fmt(p.date, { day: "numeric" }))}</b><small>${esc(fmt(p.date, { month: "short" }))}</small></span>
    <span class="grow"><b>${esc(e.title)}</b><small>${esc(fmt(p.date, { weekday: "short" }))} ${esc(fmtTime(e.starts_at))}${e.place ? " · " + esc(e.place) : ""} · ${esc(gname(g))}${esc(rsvpLine(e))}</small></span>
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
    ${pf && manage() ? `<div class="card row between pf-note"><span class="small muted">${esc(t(isAdmin() && LS.get("allCats") ? "pfAllShown" : "pfFiltered"))}</span><span class="row"><button class="btn sm ghost" data-act="profile">${esc(t("pfChange"))}</button>${LS.get("pfTest") ? `<button class="btn sm" data-act="pfTest">${esc(t("pfTestEnd"))}</button>` : ""}${isAdmin() && !LS.get("pfTest") ? `<button class="btn sm" data-act="allCats">${esc(t(LS.get("allCats") ? "pfMine" : "pfAll"))}</button>` : ""}</span></div>` : ""}
    <div class="gcards">${list.map((g) => {
      const n = D.people.filter((p) => g.id in (p.groups || {})).length; const posts = D.posts.filter((p) => p.group_id === g.id).length; const ok = canSee(g);
      return `<a class="gcard ${ok ? "" : "locked"}" href="#/g/${g.id}" style="--gc:${g.color}">
        <span class="gcard-bg"></span><span class="gicon lg">${ic(g.icon)}</span>
        <span class="gcard-t"><b>${esc(gname(g))}</b><small>${esc(t("motto_" + g.id) !== "motto_" + g.id ? t("motto_" + g.id) : "")}</small></span>
        <span class="gcard-f">${newBadge(ok && groupNew(g.id))}${roleBadge(g.id) || (ok ? "" : `<span class="badge">${ic("lock")} ${esc(t("membersOnly"))}</span>`)}<span class="small">${n} ${esc(t("members"))}${ok ? ` · ${posts} ${esc(t("posts"))}` : ""}</span></span>
      </a>`; }).join("")}</div>`);
};

R.group = (gid) => {
  const g = G(gid); if (!g) return R.notFound();
  markGroupSeen(gid);
  const tab = new URLSearchParams(location.hash.split("?")[1] || "").get("tab") || "sermon";
  const ok = canSee(g); const edit = canEdit(gid);
  const posts = D.posts.filter((p) => p.group_id === gid);
  const sermons = posts.filter((p) => p.kind === "sermon").sort((a, b) => (b.day || b.created_at).localeCompare(a.day || a.created_at));
  const news = posts.filter((p) => p.kind !== "sermon");
  const evs = D.events.filter((e) => e.group_id === gid);
  const people = D.people.filter((p) => gid in (p.groups || {}));
  // Parhalado uses this same page (YB 2026-10-28): its members get Roster and Polls; its makers (chair) post and make rosters.
  const elders = gid === "parhalado"; const inElders = elders && !!D && (D.me.is_admin || "parhalado" in (D.me.groups || {}));
  const teach = isTeachG(gid); const pollsOn = (teach && isTeacherIn(gid)) || inElders; const polls = (D.polls || []).filter((p) => p.group_id === gid);
  const teachers = people.filter((p) => [...MAKERS, "teacher"].includes(p.groups[gid]));
  const rosterOn = (ROSTER_CATS.includes(gid) && isTeacherIn(gid)) || inElders;
  const filesOn = gid === "naposo"; const yfiles = (D.files || []).filter((f) => f.group_id === gid);
  const rym = new URLSearchParams(location.hash.split("?")[1] || "").get("m") || LS.get("ym." + gid, monthKey(today()));
  const slidesOn = gid === "sekolah-minggu" && Array.isArray(D.ss_decks);
  const tabs = [["sermon", "t_sermon", sermons.length], ...(slidesOn ? [["slides", "Slide", 0]] : []), ...(filesOn ? [["files", "File & Video", yfiles.length]] : []), ...(rosterOn ? [["roster", "Roster", D.rosters.filter((r) => r.group_id === gid && r.month === rym).length]] : []), ...(pollsOn ? [["polls", "t_polls", polls.filter((p) => p.status === "open").length]] : []), ["news", "t_news", news.length], ["events", "t_events", evs.length], ...(teach ? [["teachers", "t_teachers", teachers.length]] : []), ["members", "t_members", people.length]];
  let body = "";
  if (!ok) body = isGuest() ? signInCard(t("signInCat")) : empty(t("membersOnlyLong"), "lock");
  else if (tab === "slides" && slidesOn) body = ssList();
  else if (tab === "roster" && rosterOn) body = rosterBlock(gid, rym);
  else if (tab === "files" && filesOn) body = youthFilesTab(gid, yfiles);
  else if (tab === "polls" && pollsOn) body = pollsTab(gid, polls);
  else if (tab === "teachers" && teach) body = teachersTab(gid, teachers);
  else if (tab === "sermon") body = (edit && g.kind === "sermon" ? `<button class="btn block" data-act="discuss" data-g="${gid}">✨ ${esc(L3("Bahan diskusi dari Tata Ibadah Minggu ini", "Bahan diskusi sian Tata Ibadah", "Discussion questions from Sunday's Tata Ibadah"))}</button>` : "") + (edit ? `<button class="btn primary block" data-act="newPost" data-g="${gid}" data-kind="sermon">${ic("plus")} ${esc(t("newSermon"))}</button>` : "") + (sermons.length ? sermons.map((p) => postCard(p, edit)).join("") : empty(t("noSermon"), "book"));
  else if (tab === "news") body = (edit ? `<button class="btn primary block" data-act="newPost" data-g="${gid}" data-kind="news">${ic("plus")} ${esc(t("newNews"))}</button>` : "") + (news.length ? news.map((p) => postCard(p, edit)).join("") : empty(t("noNews"), "bell"));
  else if (tab === "events") body = (canEvents() ? `<button class="btn primary block" data-act="newEvent" data-g="${gid}">${ic("plus")} ${esc(t("newEvent"))}</button>` : "") + `<div class="card">${evs.length ? evs.map(eventRow).join("") : `<p class="muted small">${esc(t("noEvents"))}</p>`}</div>`;
  else body = peopleList(people, gid);
  const svc = g.kind === "service";
  return shell(svc ? "#/serve" : "#/groups", `
    <section class="ghero" style="--gc:${g.color}">
      <span class="gicon xl">${ic(g.icon)}</span>
      <div><h2>${esc(gname(g))}</h2><p>${esc(t("motto_" + g.id) !== "motto_" + g.id ? t("motto_" + g.id) : t(svc ? "kindService" : "kindSermon"))}</p>${roleBadge(gid) ? `<div class="hero-role">${roleBadge(gid)} <small>${esc(edit ? t("canUpdate") : teach && canRunPoll(gid) ? t("teacherSub") : t("readOnly"))}</small></div>` : ""}</div>
    </section>
    ${ok ? wishCard(g, people) : ""}
    ${elders && ok ? `<div class="row two"><a class="btn" href="#/elders">${ic("book")} ${esc(t("eldersUpdates"))}</a><a class="btn" href="#/bread">${ic("bread")} ${esc(t("breadTitle"))}</a></div>` : ""}
    ${gid === "naposo" ? natalBlock(gid) : ""}
    ${ok && teach && manage() && isTMaker(gid) && !tmOk(gid) ? `<button class="card notify-ask" data-act="tmVerify" data-g="${gid}">${ic("lock")}<span><b>${esc(tmTitle(gid))}</b><small>${esc(t("tmNeedVerify"))}</small></span>${ic("chev", "chev")}</button>` : ""}
    ${ok ? `<div class="seg" role="tablist" style="--gc:${g.color}">${tabs.map(([k, l, n]) => `<a role="tab" aria-selected="${tab === k}" href="#/g/${gid}?tab=${k}">${esc(t(l))}${n ? ` <i>${n}</i>` : ""}</a>`).join("")}</div>` : ""}
    <div style="--gc:${g.color}">${body}</div>`, { back: svc ? "#/serve" : "#/groups", title: gname(g), sub: t(svc ? "kindService" : "kindSermon") });
};
// Youth files and videos (YB 2026-10-28): the Youth makers upload any kind of file or add a video link; every Youth member sees them.
const ytId = (u) => (String(u || "").match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/) || [])[1] || "";
function youthFilesTab(gid, list) {
  const mk = canEdit(gid); list = list.slice().sort((a, b) => (b.day || "").localeCompare(a.day || "") || b.created_at.localeCompare(a.created_at));
  const vids = list.filter((f) => f.link); const docs = list.filter((f) => !f.link); const dayTag = (f) => (f.day ? "🗓 " + rDateCell(f.day) + " · " : "");
  const video = (f) => { const id = ytId(f.link); return `<article class="card" style="padding:0;overflow:hidden">
      <a href="${esc(f.link)}" target="_blank" rel="noopener" style="display:block;position:relative;color:inherit">${id ? `<img src="https://img.youtube.com/vi/${id}/hqdefault.jpg" alt="" style="display:block;width:100%;aspect-ratio:16/9;object-fit:cover">` : `<div style="aspect-ratio:16/9;display:grid;place-items:center;background:var(--surface-2)">${ic("screen")}</div>`}
        <span style="position:absolute;inset:0;display:grid;place-items:center"><span style="width:56px;height:56px;border-radius:50%;background:rgba(0,0,0,.6);display:grid;place-items:center;color:#fff;font-size:22px">▶</span></span></a>
      <div class="row between" style="padding:10px 14px;margin:0"><span class="grow"><b>${esc(f.title || f.link)}</b><small class="muted" style="display:block">${esc(dayTag(f))}${esc(fmt(f.created_at, { day: "numeric", month: "short" }))} · ${esc(f.author_name || "")}${f.note ? " · " + esc(f.note) : ""}</small></span>
        <a class="icon-btn wa" href="${wa(`🎬 *${f.title || ""}*\n${f.link}\n\n– ${gname(G(gid))}, HKBP Singapore`)}" target="_blank" rel="noopener" aria-label="WhatsApp">${ic("wa")}</a>
        ${mk ? `<button class="icon-btn danger" data-act="del" data-kind="file" data-id="${f.id}" aria-label="${esc(t("delete"))}">${ic("trash")}</button>` : ""}</div></article>`; };
  const doc = (f) => `<div class="li"><span class="ftype ${fileKind(f)}">${esc(fileKind(f).toUpperCase())}</span>
      <span class="grow"><b>${esc(f.title || f.file_name)}</b><small>${esc(dayTag(f))}${esc(fmt(f.created_at, { day: "numeric", month: "short" }))} · ${esc(f.author_name || "")} · ${esc(fmtSize(f.size))}${f.note ? " · " + esc(f.note) : ""}</small></span>
      <button class="icon-btn" data-act="openOffFile" data-id="${f.id}" aria-label="${esc(t("openOriginal"))}">${ic("file")}</button>
      <button class="icon-btn wa" data-act="shareFile" data-id="${f.id}" aria-label="WhatsApp">${ic("wa")}</button>
      ${mk ? `<button class="icon-btn danger" data-act="del" data-kind="file" data-id="${f.id}" aria-label="${esc(t("delete"))}">${ic("trash")}</button>` : ""}</div>`;
  return (mk ? `<div class="row two"><button class="btn primary" data-act="yUpload" data-g="${gid}">${ic("upload")} ${esc(L3("Unggah file", "Upload file", "Upload a file"))}</button><button class="btn" data-act="yVideo" data-g="${gid}">${ic("screen")} ${esc(L3("Tambah video", "Tambah video", "Add a video"))}</button></div>` : "")
    + (vids.length ? `<h3 class="sec-h">🎬 Video</h3>${vids.map(video).join("")}` : "")
    + (docs.length ? `<h3 class="sec-h">📎 File</h3><div class="card">${docs.map(doc).join("")}</div>` : "")
    + (!vids.length && !docs.length ? empty(L3("Belum ada file atau video.", "Dang adong file manang video.", "No files or videos yet."), "folder") : "");
}
// Birthday and wedding anniversary wishes for a category. The leader saves the category's WhatsApp group link once;
// after that one tap copies the ready-made wishes and opens that group, and the leader pastes and sends.
const isGLead = (gid) => !!D && !isGuest() && (D.me.is_admin || ["chair", ...MAKERS].includes(roleIn(gid)));
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
  return `<div class="card">${people.map((p) => `<div class="li">${avatarOf(p)}<span class="grow"><b>${esc(p.name)}</b><small>${gid && ["chair", ...MAKERS, "teacher"].includes(p.groups[gid]) ? esc(roleLabel(gid, p.groups[gid])) : ""}${p.phone ? (gid && ["chair", ...MAKERS, "teacher"].includes(p.groups[gid]) ? " · " : "") + esc(fmtPhone(p.phone)) : ""}</small></span>
    ${p.phone ? `<a class="icon-btn wa" href="https://wa.me/65${p.phone}" target="_blank" rel="noopener" aria-label="WhatsApp">${ic("wa")}</a>` : ""}</div>`).join("")}</div>`;
}

// Service sections (non-sermonic) with monthly rosters.
R.serve = () => {
  const list = D.groups.filter((g) => g.kind === "service" && g.id !== "parhalado" && serveShown(g));
  const ym = monthKey(today()); const sv = serveOn() && (me().profile || {}).serve;
  return shell("#/serve", `
    ${schedHead("roster")}
    ${sv && manage() ? `<div class="card row between pf-note"><span class="small muted">${esc(t(LS.get("allServe") ? "svAllShown" : "svFiltered"))}</span><span class="row"><button class="btn sm ghost" data-act="servePick">${esc(t("pfChange"))}</button><button class="btn sm" data-act="allServe">${esc(t(LS.get("allServe") ? "pfMine" : "pfAll"))}</button></span></div>` : ""}
    <div class="glist">${list.map((g) => { const has = D.rosters.some((r) => r.group_id === g.id && r.month === ym); const nx = D.rosters.some((r) => r.group_id === g.id && r.month === shiftMonth(ym, 1));
      return groupTile(g, `${has ? "✓ " : ""}${esc(t(has ? "rosterReady" : "rosterMissing", monthName(ym)))}${nx ? " · " + esc(t("nextReady")) : ""}`); }).join("")}</div>
    ${(() => { // Parhalado's roster and polls: its own section, shown only to Parhalado members and the admin (YB 2026-10-28).
      const g = G("parhalado"); if (!g || !(D.me.is_admin || "parhalado" in (D.me.groups || {}))) return "";
      const has = D.rosters.some((r) => r.group_id === g.id && r.month === ym); const open = (D.polls || []).filter((p) => p.group_id === g.id && p.status === "open").length;
      return `<h3 class="sec-h">${esc(L3("Roster Parhalado", "Roster Parhalado", "Elders' roster"))}</h3><div class="glist"><a class="gtile" href="${rosterHome(g.id, ym)}" style="--gc:${g.color}"><span class="gicon">${ic(g.icon)}</span><span class="gname"><b>${esc(gname(g))}</b><small>${has ? "✓ " : ""}${esc(t(has ? "rosterReady" : "rosterMissing", monthName(ym)))}${open ? " · " + esc(L3(`${open} polling terbuka`, `${open} polling bukka`, `${open} open poll${open > 1 ? "s" : ""}`)) : ""}</small></span>${roleBadge(g.id)}${ic("chev", "chev")}</a></div>`; })()}
    ${(() => { // Teachers' rosters (Sunday School, Remaja) also listed here for their teachers; they open the class's Roster tab.
      const cls = ROSTER_CATS.map(G).filter((g) => g && isTeacherIn(g.id)); if (!cls.length) return "";
      return `<h3 class="sec-h">${esc(L3("Roster Guru", "Roster Guru", "Teachers' rosters"))}</h3><div class="glist">${cls.map((g) => { const has = D.rosters.some((r) => r.group_id === g.id && r.month === ym);
        return `<a class="gtile" href="${rosterHome(g.id, ym)}" style="--gc:${g.color}"><span class="gicon">${ic(g.icon)}</span><span class="gname"><b>${esc(gname(g))}</b><small>${has ? "✓ " : ""}${esc(t(has ? "rosterReady" : "rosterMissing", monthName(ym)))}</small></span>${roleBadge(g.id)}${ic("chev", "chev")}</a>`; }).join("")}</div>`; })()}
    ${isAdmin() ? `<button class="btn block ghost" data-act="newSection">${ic("plus")} ${esc(t("addSection"))}</button>` : ""}`);
};

R.section = (gid) => {
  if (gid === "parhalado") return R.group(gid);
  const g = G(gid); if (!g) return R.notFound();
  const q = new URLSearchParams(location.hash.split("?")[1] || "");
  const ym = q.get("m") || LS.get("ym." + gid, monthKey(today()));
  const edit = canRoster(gid);
  const people = D.people.filter((p) => gid in (p.groups || {}));
  return shell("#/serve", `
    <section class="ghero slim" style="--gc:${g.color}">
      <span class="gicon xl">${ic(g.icon)}</span>
      <div><h2>${esc(gname(g))}</h2><p>${esc(t("kindService"))}</p>${roleBadge(gid) ? `<div class="hero-role">${roleBadge(gid)} <small>${esc(edit ? t("canUpdate") : t("readOnly"))}</small></div>` : ""}</div>
    </section>
    ${gid === "multimedia" ? tataBlock() : ""}
    ${gid === "parhalado" ? `<div class="row two"><a class="btn" href="#/elders">${ic("book")} ${esc(t("eldersUpdates"))}</a><a class="btn" href="#/bread">${ic("bread")} ${esc(t("breadTitle"))}</a></div>` : ""}
    ${gid === "parhalado" ? `<h3 class="sec-h">${esc(t("t_polls"))}</h3><div style="--gc:${g.color}">${pollsTab(gid, (D.polls || []).filter((p) => p.group_id === gid))}</div>` : ""}
    ${gid === "band" ? `<h3 class="sec-h">🎬 File & Video</h3><div style="--gc:${g.color}">${youthFilesTab(gid, (D.files || []).filter((f) => f.group_id === gid))}</div>` : ""}
    ${rosterBlock(gid, ym)}
    <h3 class="sec-h">${esc(t("t_members"))}</h3>
    ${peopleList(people, gid)}`, { back: "#/serve", title: gname(g), sub: t("kindService") });
};
// The month's rosters: month bar, "you serve", Make Roster and the roster cards. Service sections and Sunday School / Remaja share it.
const rosterHome = (gid, ym) => ((G(gid) || {}).kind === "sermon" || gid === "parhalado" ? `#/g/${gid}?tab=roster&m=${ym}` : `#/s/${gid}?m=${ym}`);
function rosterBlock(gid, ym) {
  const g = G(gid); const edit = canRoster(gid);
  const rs = D.rosters.filter((r) => r.group_id === gid && r.month === ym);
  const mine = duties().filter((d) => d.roster.group_id === gid && d.roster.month === ym);
  return `<div class="monthbar" style="--gc:${g.color}">
      <a class="icon-btn" href="${rosterHome(gid, shiftMonth(ym, -1))}" aria-label="${esc(t("prevMonth"))}">${ic("back")}</a>
      <b>${esc(monthName(ym))}</b>
      <a class="icon-btn" href="${rosterHome(gid, shiftMonth(ym, 1))}" aria-label="${esc(t("nextMonth"))}">${ic("chev")}</a>
    </div>
    ${mine.length ? `<div class="card mine" style="--gc:${g.color}"><h3>${ic("check")} ${esc(t("youServe"))}</h3>${mine.map(dutyRow).join("")}</div>` : ""}
    ${edit ? `<button class="btn primary block" data-act="uploadRoster" data-g="${gid}" data-m="${ym}" style="--gc:${g.color}">${ic("plus")} ${esc(L3("Buat Roster", "Bahen Roster", "Make Roster"))}</button>` : ""}
    ${edit ? `<button class="btn block" data-act="rosterDraft" data-g="${gid}" data-m="${ym}">✨ ${esc(L3("Draf roster bulan ini secara adil", "Draf roster na adil", "Draft this month fairly"))}</button>` : ""}
    ${rs.length ? rs.map((r) => rosterCard(r, edit)).join("") : empty(t("noRoster", monthName(ym)), "roster")}`;
}
// Files and videos tagged to this roster's Sundays, one line per Sunday, shown with the roster.
function rosterFiles(r) {
  const fs = (D.files || []).filter((f) => f.group_id === r.group_id && f.day && f.day.slice(0, 7) === r.month);
  if (!fs.length) return "";
  const days = [...new Set(fs.map((f) => f.day))].sort();
  return `<div class="roster-files" style="margin:10px 0 4px"><p class="small muted" style="margin:0 0 6px"><b>${esc(L3("File & video per Minggu", "File & video sadarion Minggu", "Files & videos by Sunday"))}</b></p>${days.map((d) => `<div class="li" style="align-items:flex-start">
      <span class="date-chip"><b>${esc(fmt(d, { day: "numeric" }))}</b><small>${esc(fmt(d, { month: "short" }))}</small></span>
      <span class="grow chips" style="margin-top:2px">${fs.filter((f) => f.day === d).map((f) => f.link
        ? `<a class="chip" href="${esc(f.link)}" target="_blank" rel="noopener">🎬 ${esc(f.title || "Video")}</a>`
        : `<button class="chip" data-act="openOffFile" data-id="${f.id}">📎 ${esc(f.title || f.file_name)}</button>`).join("")}</span></div>`).join("")}</div>`;
}
const fileKind = (r) => r.link && !r.file_name ? "link" : /\.(xlsx|xls|csv|ods)$/i.test(r.file_name || "") ? "xls" : /\.pdf$/i.test(r.file_name || "") ? "pdf" : /\.docx?$/i.test(r.file_name || "") ? "doc" : /^image/.test(r.mime || "") ? "img" : "file";
// A roster made in the app, shown as one card per Sunday (YB 2026-10-28): date and buttons on top, jobs and names in a grid,
// then that Sunday's files and videos. No wide table, so nothing scrolls sideways. Sundays that only have files are listed too.
function madeRosterList(r, rowEdit, canFile, names) {
  const rows = r.table_json[0].rows; const head = rows[0] || [];
  const byDay = {}; rows.slice(1).forEach((row) => { const iso = rowDate(row, r.month); if (iso) byDay[iso] = row; });
  const fs = (D.files || []).filter((f) => f.group_id === r.group_id && f.day && f.day.slice(0, 7) === r.month);
  const tatas = r.group_id === "multimedia" ? (D.services || []).filter((v) => v.service_date && v.service_date.slice(0, 7) === r.month) : [];
  const days = [...new Set([...Object.keys(byDay), ...fs.map((f) => f.day), ...tatas.map((v) => v.service_date)])].sort();
  if (!days.length) return `<p class="small muted">${esc(t("noRoster", monthName(r.month)))}</p>`;
  const act = (a, iso, icon, label, cls = "", extra = "") => `<button class="icon-btn ${cls}" data-act="${a}" data-g="${esc(r.group_id)}" data-m="${esc(r.month)}" data-day="${iso}" ${extra} aria-label="${esc(label)}">${icon}</button>`;
  return `<div class="rr-list">${days.map((iso) => {
    const row = byDay[iso]; const mine = !!row && row.some((c, j) => j > 0 && hit(c, names));
    const jobs = row ? head.map((h, j) => [h, row[j] || ""]).slice(1).filter(([h, w]) => h && w) : [];
    const files = fs.filter((f) => f.day === iso); const tata = tatas.filter((v) => v.service_date === iso);
    return `<div class="rr-day${mine ? " me" : ""}">
      <div class="rr-head"><span class="date-chip"><b>${esc(fmt(iso, { day: "numeric" }))}</b><small>${esc(fmt(iso, { month: "short" }))}</small></span>
        <span class="grow"><b>${esc(fmt(iso, { weekday: "long" }))}</b>${mine ? `<small class="rr-you">${ic("check")} ${esc(L3("Anda bertugas", "Ho marhobas", "You're serving"))}</small> <button class="link rr-cant" data-act="cantMake" data-g="${esc(r.group_id)}" data-day="${iso}" data-jobs="${esc(head.filter((h, j) => j && hit(row[j] || "", names)).join(", "))}">${esc(L3("Tidak bisa?", "Ndang boi?", "Can't make it?"))}</button>` : ""}</span>
        ${rowEdit || canFile ? `<span class="rr-acts">${canFile ? act("yAttach", iso, "📎", L3("Tambah file atau video", "Tambah file manang video", "Add a file or video")) : ""}${rowEdit && row ? act("uploadRoster", iso, ic("edit"), t("edit"), "", 'data-edit="1"') + act("rrDelRow", iso, ic("trash"), t("delete"), "danger") : ""}</span>` : ""}</div>
      ${jobs.length ? `<div class="rr-jobs">${jobs.map(([h, w]) => `<div class="rr-job${hit(w, names) ? " me" : ""}"><small>${esc(h)}</small><b>${esc(w)}</b></div>`).join("")}</div>` : row ? `<p class="small muted" style="margin:8px 0 0">—</p>` : ""}
      ${files.length || tata.length ? `<div class="chips rr-files">${tata.map((v) => `<a class="chip rr-tata" href="#/tata/${v.id}">📖 ${esc(t("tataTitle"))}</a>`).join("")}${files.map((f) => f.link
        ? `<a class="chip" href="${esc(f.link)}" target="_blank" rel="noopener">🎬 ${esc(f.title || "Video")}</a>`
        : `<button class="chip" data-act="openOffFile" data-id="${f.id}">📎 ${esc(f.title || f.file_name)}</button>`).join("")}</div>` : ""}
    </div>`; }).join("")}</div>`;
}
// Styles for the roster cards (kept here so only app.js needs updating).
try { document.head.insertAdjacentHTML("beforeend", `<style>
  .rr-list { display: grid; gap: 10px; margin-top: 10px; }
  .rr-day { padding: 12px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface); }
  .rr-day.me { border-color: var(--gc, var(--brand)); box-shadow: 0 0 0 1px var(--gc, var(--brand)) inset; background: color-mix(in srgb, var(--gc, var(--brand)) 5%, var(--surface)); }
  .rr-head { display: flex; align-items: center; gap: 12px; }
  .rr-head .grow b { display: block; font-weight: 800; }
  .rr-you { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; color: var(--good); }
  .rr-you .ic { width: 14px; height: 14px; }
  .rr-acts { display: flex; gap: 6px; flex: none; }
  .rr-acts .icon-btn { width: 34px; height: 34px; border-radius: 10px; font-size: 15px; }
  .rr-acts .icon-btn .ic { width: 17px; height: 17px; }
  .rr-jobs { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 10px 14px; margin-top: 12px; padding-top: 12px; border-top: 1px dashed var(--line); }
  .rr-job small { display: block; font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
  .rr-job b { display: block; font-weight: 600; font-size: 15px; line-height: 1.35; overflow-wrap: anywhere; }
  .rr-job.me b { color: var(--gc, var(--brand)); font-weight: 800; }
  .rr-files { margin-top: 10px; }
  .rr-tata { background: var(--brand); border-color: var(--brand); color: var(--brand-ink); font-weight: 800; }
</style>`); } catch (e) {}
function rosterCard(r, edit) {
  const names = myNames();
  const tables = (r.table_json || []).filter((tb) => tb.rows.length);
  const made = !r.file_name && !r.link; const rowEdit = edit && made;
  // Edit and delete sit under the date in the first column, so they stay on screen however many jobs the roster has.
  const filesHere = ["naposo", "band"].includes(r.group_id); const canFile = filesHere && canEdit(r.group_id);
  const rowActs = (row, i, j) => { if (!rowEdit || i === 0 || j !== 0) return ""; const iso = rowDate(row, r.month); return iso ? `<span style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">${canFile ? `<button class="icon-btn" style="width:36px;height:36px" data-act="yAttach" data-g="${esc(r.group_id)}" data-day="${iso}" aria-label="${esc(L3("Tambah file atau video", "Tambah file manang video", "Add a file or video"))}">📎</button>` : ""}<button class="icon-btn" style="width:36px;height:36px" data-act="uploadRoster" data-g="${esc(r.group_id)}" data-m="${esc(r.month)}" data-day="${iso}" data-edit="1" aria-label="${esc(t("edit"))}">${ic("edit")}</button><button class="icon-btn danger" style="width:36px;height:36px" data-act="rrDelRow" data-g="${esc(r.group_id)}" data-day="${iso}" aria-label="${esc(t("delete"))}">${ic("trash")}</button></span>` : ""; };
  return `<article class="card roster" style="--gc:${(G(r.group_id) || {}).color}">
    <div class="roster-h">${made ? `<span class="ftype link">${ic("calendar")}</span>` : `<span class="ftype ${fileKind(r)}">${esc(fileKind(r).toUpperCase())}</span>`}<div class="grow"><b>${esc(r.title || r.file_name || "Roster")}</b><small>${esc([r.file_name || r.link, r.author_name].filter(Boolean).join(" · "))}</small></div></div>
    ${made && tables.length ? madeRosterList(r, rowEdit, canFile, names) : rosterFiles(r) + (tables.length ? tables.map((tb) => `<div class="tbl-wrap"><table class="tbl">${tb.rows.map((row, i) => `<tr class="${row.some((c) => hit(c, names)) ? "me" : ""}">${row.map((c, j) => `<${i === 0 ? "th" : "td"} class="${hit(c, names) ? "me" : ""}">${esc(c)}${rowActs(row, i, j)}</${i === 0 ? "th" : "td"}>`).join("")}</tr>`).join("")}</table></div>${tables.length > 1 ? `<p class="small muted">${esc(tb.name)}</p>` : ""}`).join("") : r.mime && /^image/.test(r.mime) ? `<div class="img-slot" data-img="${r.id}"></div>` : `<p class="small muted">${esc(t("noPreview"))}</p>`)}
    <div class="row end">
      ${r.has_file ? `<button class="btn sm" data-act="openFile" data-id="${r.id}">${ic("file")} ${esc(t("openOriginal"))}</button>` : ""}
      ${r.link ? `<a class="btn sm" href="${esc(r.link)}" target="_blank" rel="noopener">${ic("link")} ${esc(t("openLink"))}</a>` : ""}
      ${edit ? `<button class="btn sm ghost danger" data-act="del" data-kind="roster" data-id="${r.id}" aria-label="${esc(t("delete"))}">${ic("trash")}${made ? " " + esc(L3("Hapus roster bulan ini", "Hapus roster bulan on", "Delete this month's roster")) : ""}</button>` : ""}
    </div></article>`;
}

R.calendar = () => {
  const now = Date.now(); const day = today();
  const show = LS.get("calPast", false);
  const evs = D.events.filter((e) => show || new Date(e.starts_at) > now - 3 * 3600e3);
  const canAdd = canEvents();
  // Each month is split into Events, Birthdays and Wedding anniversaries (YB 2026-10-28).
  const byMonth = {}; const add = (k, part, item) => { byMonth[k] = byMonth[k] || { du: [], mt: [], ev: [], bd: [], an: [] }; byMonth[k][part].push(item); };
  if (!isGuest()) duties().forEach((d) => { if (d.date && (show || d.date >= day)) add(monthKey(d.date), "du", { k: d.date, html: dutyRow(d) }); });
  evs.forEach((e) => { const p = sgParts(e.starts_at); add(monthKey(p.date), "ev", { k: p.date + " " + p.time, html: eventRow(e) }); });
  if (!isGuest()) (D.meetings || []).filter((x) => !x.event_id && (show || meetEnd(x) >= Date.now())).forEach((x) => { const p = sgParts(x.starts_at);
    add(monthKey(p.date), "mt", { k: p.date + " " + p.time, html: `<a class="li" href="#/meet"><span class="date-chip"><b>${esc(fmt(x.starts_at, { day: "numeric" }))}</b><small>${esc(fmt(x.starts_at, { month: "short" }))}</small></span><span class="grow"><b>📹 ${esc(x.title)}</b><small>${esc(fmtTime(x.starts_at))} · ${esc(x.by || "")}</small></span>${ic("chev", "chev")}</a>` }); });
  // Birthdays and anniversaries fill this month and the next two.
  const all = allBdays(); const wed = (D.people || []).filter((p) => p.anniv); let [y, mo] = day.split("-").map(Number);
  for (let i = 0; i < 3; i++) {
    const ym = `${y}-${String(mo).padStart(2, "0")}`;
    all.filter((b) => b.bday.slice(0, 2) === ym.slice(5)).forEach((b) => { const d = `${ym}-${b.bday.slice(3)}`; if (show || d >= day) add(ym, "bd", { k: d, html: bdayRow(b, d) }); });
    wed.filter((p) => p.anniv.slice(0, 2) === ym.slice(5)).forEach((p) => { const d = `${ym}-${p.anniv.slice(3)}`; if (show || d >= day) add(ym, "an", { k: d, html: annivRow(p, d) }); });
    if (++mo > 12) { mo = 1; y++; }
  }
  const months = Object.keys(byMonth).sort();
  const part = (icon, title, list) => list.length ? `<div class="card cal-part"><div class="card-h"><h3>${icon} ${esc(title)}</h3><span class="badge">${list.length}</span></div>${list.sort((a, c) => a.k.localeCompare(c.k)).map((x) => x.html).join("")}</div>` : "";
  return shell("#/calendar", `
    ${schedHead("agenda")}
    <div class="row two">${canAdd ? `<button class="btn primary" data-act="newEvent">${ic("plus")} ${esc(t("newEvent"))}</button>` : ""}${isElder() ? `<button class="btn" data-act="bdayTools">${ic("cake")} ${esc(L3("Ulang tahun", "Ari tubu", "Birthdays"))}</button>` : ""}<button class="btn" data-act="phoneCal">${ic("download")} ${esc(L3("Ke kalender HP", "Tu kalender HP", "To my phone"))}</button></div>
    ${months.length ? months.map((k) => `<h3 class="sec-h">${esc(monthName(k))}</h3>
      ${part(ic("check"), L3("Tugas Anda", "Ulaonmu", "Your duties"), byMonth[k].du)}
      ${part(ic("screen"), L3("Rapat", "Rapat", "Meetings"), byMonth[k].mt)}
      ${part(ic("calendar"), L3("Acara", "Ulaon", "Events"), byMonth[k].ev)}
      ${part(ic("cake"), L3("Ulang Tahun", "Ari Tubu", "Birthdays"), byMonth[k].bd)}
      ${part("💍", L3("Ulang Tahun Pernikahan", "Ulang Taon Pardongan Saripeon", "Wedding anniversaries"), byMonth[k].an)}`).join("") : empty(t("noEvents"), "calendar")}
    <p class="center"><button class="btn sm ghost" data-act="calPast">${esc(t(show ? "hidePast" : "showPast"))}</button></p>`);
};
function annivRow(p, d) {
  return `<div class="li"><span class="date-chip" style="--gc:#b7791f"><b>${esc(fmt(d, { day: "numeric" }))}</b><small>${esc(fmt(d, { month: "short" }))}</small></span>
    <span class="grow"><b>💍 ${esc(p.name)}</b><small>${esc(L3("Ulang tahun pernikahan", "Ulang taon pardongan saripeon", "Wedding anniversary"))}</small></span></div>`;
}
// Schedule (YB 2026-10-29): Calendar and Rosters are one tab with a switch at the top.
// Agenda = each month's events, your duties, birthdays and anniversaries; Roster = every section's roster.
function schedHead(which) {
  const seg = (k, href, icon, label) => `<a role="tab" aria-selected="${which === k}" href="${href}">${ic(icon)} ${esc(label)}</a>`;
  return `<h2 class="page-h">${esc(L3("Jadwal", "Jadwal", "Schedule"))}</h2>
    <div class="seg sched-seg" role="tablist" style="--gc:var(--brand)">${seg("agenda", "#/calendar", "calendar", L3("Agenda", "Agenda", "Agenda"))}${seg("roster", "#/serve", "roster", "Roster")}${isGuest() ? "" : seg("meet", "#/meet", "screen", L3("Rapat", "Rapat", "Meetings"))}</div>
    <p class="lead">${esc(which === "agenda" ? L3("Acara, tugas Anda, rapat, ulang tahun dan ulang tahun pernikahan setiap bulan.", "Ulaon, ulaonmu, rapat, ari tubu dohot ari pardongan saripeon sadarion bulan.", "Each month's events, your duties, meetings, birthdays and anniversaries.") : which === "meet" ? L3("Rapat video gratis: video, suara, berbagi layar, chat, angkat tangan, ruang kecil, polling, latar virtual, dan rekam.", "Rapat video.", "Free video meetings: video, audio, screen sharing, chat, raise hand, breakout rooms, polls, virtual backgrounds and recording.") : t("serveLead"))}</p>`;
}
try { document.head.insertAdjacentHTML("beforeend", `<style>
  .sched-seg { margin: 12px 0 6px; }
  .sched-seg a { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 10px; font-size: 14.5px; }
  .sched-seg a .ic { width: 18px; height: 18px; }
</style>`); } catch (e) {}
function bdayRow(b, d) {
  const inner = `<span class="date-chip bday"><b>${esc(fmt(d, { day: "numeric" }))}</b><small>${esc(fmt(d, { month: "short" }))}</small></span>
    <span class="grow"><b>🎂 ${esc(b.name)}</b><small>${esc(t("bdayOf"))}</small></span>`;
  return isElder() ? `<button class="li" data-act="bdayMenu" data-kind="${b.kind}" data-id="${b.id}" data-name="${esc(b.name)}" data-bday="${b.bday}">${inner}${ic("chev", "chev")}</button>` : `<div class="li">${inner}</div>`;
}

R.bread = (arg) => {
  const day = today();
  if ((arg === "new" || (arg && arg.startsWith("edit-"))) && isBreadMaker()) return breadEditor(arg === "new" ? day : arg.slice(5));
  const list = D.bread.filter((b) => isBreadMaker() || b.day <= day);
  const b = list.find((x) => x.day === (arg || day)) || (!arg ? list.find((x) => x.day <= day) : null);
  const future = isBreadMaker() ? D.bread.filter((x) => x.day > day).sort((a, c) => a.day.localeCompare(c.day)) : [];
  return shell("#/home", `
    ${b ? `<article class="bread-full">
      <div class="kicker">${ic("bread")} ${esc(t("breadTitle"))} · ${esc(fmtDay(b.day))}</div>
      <h1>${esc(b.title || "")}</h1>
      <p class="verse-ref big">${esc(b.verse || "")}</p>
      <div class="pre body">${esc(b.body || "")}</div>
      <p class="small muted">${esc(b.author_name || "")}</p>
      ${/[?&]wa=1/.test(location.hash) ? `<div class="card wa-send"><b>${ic("wa")} ${esc(t("waSendTitle"))}</b><p class="small">${esc(t("waSendSteps"))}</p><a class="btn wa block" href="${wa(breadText(b))}" target="_blank" rel="noopener">${ic("wa")} ${esc(t("waSendBtn"))}</a></div>` : ""}
      <div class="row two"><a class="btn wa" href="${wa(breadText(b))}" target="_blank" rel="noopener">${ic("wa")} ${esc(t("shareWa"))}</a><button class="btn" data-act="copyBread" data-day="${b.day}">${ic("share")} ${esc(t("copy"))}</button></div>
      ${isBreadMaker() ? `<div class="row two"><a class="btn" href="#/bread/edit-${b.day}">${ic("edit")} ${esc(t("edit"))}</a><button class="btn danger" data-act="del" data-kind="bread" data-id="${b.day}">${ic("trash")} ${esc(t("delete"))}</button></div>` : ""}
    </article>` : empty(t("noBread"), "bread")}
    ${(D.settings || {}).wa_group_link ? `<a class="btn wa block" href="${esc(D.settings.wa_group_link)}" target="_blank" rel="noopener">${ic("wa")} ${esc(t("joinWaGroup"))}</a>` : ""}
    ${isAdmin() ? `<button class="card li" data-act="breadSetup">${ic("gear")}<span class="grow"><b>${esc(t("bs_title"))}</b><small>${esc(t("src_" + ((D.settings || {}).bread_source || "elders")))} · ${String((D.settings || {}).bread_hour ?? 6).padStart(2, "0")}:00</small></span>${ic("chev", "chev")}</button>` : ""}
    ${isBreadMaker() ? `<div class="card"><h3>${ic("edit")} ${esc(t("breadPlan"))}</h3><p class="small muted">${esc(t("breadPlanLead"))}</p>
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
      <div class="card">${D.people.map((p) => `<button class="li mrow" data-act="editMember" data-id="${p.id}" data-q="${esc(norm(p.name + " " + (p.phone || "")))}">${avatarOf(p)}<span class="grow"><b>${esc(p.name)}${p.is_admin ? ` <span class="badge admin">${esc(t("role_admin"))}</span>` : ""}</b><small>${esc(fmtPhone(p.phone))} · ${esc(Object.entries(p.groups || {}).map(([g, r]) => gname(G(g)) + (r === "chair" ? " ★" : "")).join(", ") || "—")}${p.has_password === false ? " · " + esc(t("noPassword")) : ""}</small></span>${ic("chev", "chev")}</button>`).join("")}</div>` : ""}`,
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
      <button class="avatar-btn" data-act="photoPick" aria-label="${esc(L3("Foto profil", "Foto profil", "Profile photo"))}">${avatarOf(m, "lg")}<i class="avatar-edit">${ic("camera")}</i></button>
      <div class="grow"><h3>${esc(m.name)}</h3><p class="small muted">${esc(fmtPhone(m.phone))}${m.dob ? " · " + esc(fmt(m.dob, { day: "numeric", month: "long" })) : ""}</p>
        <div class="chips">${m.is_admin && manage() ? `<span class="badge admin">${esc(t("role_admin"))}</span>` : ""}${roles.map(([g, r]) => `<span class="chip" style="--gc:${(G(g) || {}).color}">${esc(gname(G(g)))}${r === "chair" && manage() ? " · " + esc(t("role_chair")) : ""}</span>`).join("")}</div>
        <button class="btn sm pf-reset" data-act="pfReset">${ic("redo")} ${esc(t("pfReset"))}</button></div>
    </section>
    <div class="menu card">
      <a class="li" href="#/elders">${ic("book")}<span class="grow"><b>${esc(t("eldersUpdates"))}</b></span>${ic("chev", "chev")}</a>
      <a class="li" href="#/bread">${ic("bread")}<span class="grow"><b>${esc(t("breadTitle"))}</b></span>${ic("chev", "chev")}</a>
      ${isOffice() && manage() ? `<a class="li" href="#/o/secretary">${ic("lock")}<span class="grow"><b>${esc(t("officeTitle"))}</b><small>${esc(officeGroups().map(gname).join(" · "))}</small></span>${ic("chev", "chev")}</a>` : ""}
      ${communityMenu()}
      <a class="li" href="#/prayer">${ic("heart")}<span class="grow"><b>🙏 ${esc(L3("Pokok Doa", "Pokok Tangiang", "Prayer requests"))}</b><small>${esc(L3("Bagikan dan ikut mendoakan", "Bagi dohot tangianghon", "Share and pray together"))}</small></span>${ic("chev", "chev")}</a>
      ${D.me.is_admin && manage() ? `<a class="li" href="#/checkinqr">${ic("camera")}<span class="grow"><b>QR Check-in</b><small>${esc(L3("QR untuk pintu gereja dan data kehadiran", "QR tu pintu gareja", "Door QR and attendance"))}</small></span>${ic("chev", "chev")}</a>` : ""}
      <a class="li" href="#/people">${ic("cake")}<span class="grow"><b>${esc(t("people"))}</b><small>${esc(isAdmin() ? t("peopleAdmin") : t("peopleSub"))}</small></span>${ic("chev", "chev")}</a>
      <button class="li" data-act="notify">${ic("bell")}<span class="grow"><b>${esc(t("notifications"))}</b><small>${esc(perm === "granted" ? t("notifyOnTxt") : perm === "denied" ? t("notifyDenied") : t("notifyAskBody"))}</small></span>${ic("chev", "chev")}</button>
      ${hasRights() ? `<button class="li" data-act="toggleView">${ic("people")}<span class="grow"><b>${esc(t("layout"))}: ${esc(t(manage() ? "viewAdmin" : "viewMember"))}</b><small>${esc(t(manage() ? "toMember" : "toAdmin"))}</small></span>${ic("chev", "chev")}</button>` : ""}
      ${isAdmin() && isYB() ? `<a class="li" href="#/appstatus">${ic("phone")}<span class="grow"><b>${esc(t("asTitle"))}</b><small>${esc(t("asSub"))}</small></span>${ic("chev", "chev")}</a>` : ""}
      ${isAdmin() ? `<button class="li" data-act="breadSetup">${ic("bread")}<span class="grow"><b>${esc(t("bs_title"))}</b><small>${esc(t("src_" + ((D.settings || {}).bread_source || "elders")))}</small></span>${ic("chev", "chev")}</button>` : ""}
      ${serveOn() && manage() ? `<button class="li" data-act="servePick">${ic("calendar")}<span class="grow"><b>${esc(t("svTitle"))}</b><small>${esc((me().profile || {}).serve ? me().profile.serve.map((id) => gname(G(id))).filter(Boolean).join(", ") || t("svNone") : t("pfNotYet"))}</small></span>${ic("chev", "chev")}</button>` : ""}
      ${pfSkipped() && manage() ? `<button class="li" data-act="pfTest">${ic("spark")}<span class="grow"><b>${esc(t(LS.get("pfTest") ? "pfTestEnd" : "pfTestStart"))}</b><small>${esc(t(LS.get("pfTest") ? "pfTestOnSub" : "pfTestSub"))}</small></span>${ic("chev", "chev")}</button>` : ""}
      ${profileOn() ? `<button class="li" data-act="profile">${ic("people")}<span class="grow"><b>${esc(t("pfTitle"))}</b><small>${esc(me().profile ? profileCats(me().profile).map((id) => gname(G(id))).filter(Boolean).join(", ") : t("pfNotYet"))}</small></span>${ic("chev", "chev")}</button>` : ""}
      ${manage() ? `<button class="li" data-act="password">${ic("key")}<span class="grow"><b>${esc(t("changePw"))}</b></span>${ic("chev", "chev")}</button>` : ""}
      <button class="li" data-act="install">${ic("phone")}<span class="grow"><b>${esc(t("installTitle"))}</b><small>${esc(standalone() ? t("installed") : t("installHint"))}</small></span>${ic("chev", "chev")}</button>
      ${isYB() && manage() ? `<button class="li" data-act="settings">${ic("gear")}<span class="grow"><b>${esc(t("settings"))}</b><small>${esc(api.mode === "remote" ? t("modeRemote") : t("modeLocal"))}</small></span>${ic("chev", "chev")}</button>` : ""}
      <button class="li" data-act="logout">${ic("logout")}<span class="grow"><b>${esc(t("signOut"))}</b></span></button>
    </div>
    <p class="small muted center pad">HKBP Singapore · ${esc(t("logoNote"))}</p>`);
};
// Admin only: who has signed in to the app, installed it and turned notifications on.
let AS = { rows: null, tries: [], f: "all" };
const asDot = (on, label) => `<span class="as-pill ${on ? "on" : "off"}"><i></i>${esc(label)}</span>`;
function asFill() {
  const el = $("#asList"); if (!el || !AS.rows) return;
  const rows = AS.rows, n = rows.length, si = rows.filter((r) => r.signed_in).length, no = rows.filter((r) => r.notif).length, ins = rows.filter((r) => r.installed).length;
  const show = rows.filter((r) => AS.f === "all" || (AS.f === "noapp" && !r.signed_in) || (AS.f === "nonotif" && !r.notif));
  el.innerHTML = `
    <div class="as-totals"><div class="card"><b>${si}/${n}</b><small>${esc(t("asSigned"))}</small></div><div class="card"><b>${no}/${n}</b><small>${esc(t("asNotifOn"))}</small></div><div class="card"><b>${ins}/${n}</b><small>${esc(t("asInstalled"))}</small></div></div>
    <div class="chips">${[["all", "asAll"], ["noapp", "asNoApp"], ["nonotif", "asNoNotif"]].map(([f, k]) => `<button class="chip ${AS.f === f ? "on" : ""}" data-act="asFilter" data-f="${f}">${esc(t(k))}</button>`).join("")}</div>
    <div class="card menu">${show.length ? show.map((r) => `<div class="li as-row">${avatarOf(r)}<span class="grow"><b>${esc(r.name)}</b>${r.self_reg ? ` <span class="badge chair">${esc(t("asSelfReg"))}</span>` : ""}<small>${esc(fmtPhone(r.phone))} · ${esc(r.last_seen ? t("asLast") + " " + fmt(r.last_seen, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : t("asNever"))}</small></span><span class="as-pills">${asDot(r.signed_in, t("asApp"))}${asDot(r.notif, t("asNotif"))}</span></div>`).join("") : empty(t("asNone"))}</div>
    <h3 class="sec-h">${esc(t("asOthers"))}</h3>
    <div class="card menu">${AS.tries.length ? AS.tries.map((r) => `<div class="li as-row"><span class="avatar">?</span><span class="grow"><b>${esc(fmtPhone(r.phone))}</b><small>${esc(t("asTried", r.tries))} · ${esc(t("asLastTry") + " " + fmt(r.last_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))}</small></span><span class="as-pills">${asDot(false, t("asNotListed"))}</span></div>`).join("") : `<p class="small muted pad">${esc(t("asNoOthers"))}</p>`}</div>
    <p class="small muted pad">${esc(t("asNote"))}</p>`;
}
R.appstatus = () => {
  if (!isAdmin() || !isYB()) return shell("#/more", empty(t("notFound")), { back: "#/more" });
  AS.rows = null;
  Promise.all([api.appStatus(), api.phoneTries ? api.phoneTries().catch(() => []) : []]).then(([r, tr]) => { AS.rows = r || []; AS.tries = tr || []; asFill(); }).catch((e) => { const el = $("#asList"); if (el) el.innerHTML = empty(errMsg(e)); });
  const hc = HYMN.selfTest();
  return shell("#/more", `<div class="card li"><span class="grow"><b>🎵 Hymn splitter: ${hc.pass}/${hc.total} ${hc.fails.length ? "✗" : "✓"}</b><small>${esc(hc.fails.length ? hc.fails.join(" · ") : "Same rules as the Tata Ibadah workbench: verses, Reff, max 6 lines")}</small></span></div><div id="asList">${skel(4)}</div>`, { back: "#/more", title: t("asShort"), sub: t("asSub") });
};
R.notFound = () => shell("#/home", empty(t("notFound")), { back: "#/home" });

// ---------- router ----------
let rendering = false;
async function render() {
  if (rendering) return; rendering = true;
  try {
    const h = location.hash.replace(/^#\/?/, "").split("?")[0];
    let [r, arg] = h.split("/");
    if (r === "login") { if (api.hasSession()) { location.replace("#/home"); return; } await R.login(); const lf = $('form[data-form="login"]'); if (lf && lf.phone && lf.phone.value) pcCheck(lf).catch(() => {}); return; }
    if (!api.hasSession() && await api.needsSetup()) { await R.login(); return; }
    if (!D) await refresh();
    if (!r) { history.replaceState(null, "", "#/home"); r = "home"; }
    if (isGuest() && !["home", "bread", "checkin"].includes(r)) { history.replaceState(null, "", "#/home"); r = "home"; arg = undefined; }
    const map = { sswb: R.sswb, ssdeck: R.ssdeck, fx: R.fx, meet: R.meet, tutur: R.tutur, ende: R.ende, stories: R.stories, voyage: R.voyage, live: R.live, grief: R.grief, care: R.care, search: R.search, prayer: R.prayer, checkin: R.checkin, checkinqr: R.checkinqr, chat: R.chat, tata: R.tata, home: R.home, groups: R.groups, g: R.group, serve: R.serve, s: R.section, calendar: R.calendar, bread: R.bread, elders: R.elders, berita: R.berita, people: R.people, more: R.more, appstatus: R.appstatus, o: R.office, warta: R.warta };
    const html = (map[r] || R.notFound)(arg);
    if (typeof html === "string") view().innerHTML = html;
    draftRestore(view()); wAutoBase();
    document.title = r === "home" ? "Sada HKBPS" : `${$(".brand b") ? $(".brand b").textContent : ""} · Sada HKBPS`;
    hydrate();
  } catch (e) { console.error(e); view().innerHTML = `<div class="login">${empty(errMsg(e))}<button class="btn primary" data-act="retry">${esc(t("retry"))}</button></div>`; }
  finally { rendering = false; }
}
function hydrate() {
  // Jarvis "go" (YB 2026-10-26) opens #/s/multimedia?wb=1: open the workbench straight away for a Multimedia Maker.
  if (/^#\/s\/multimedia\?(.*&)?wb=1\b/.test(location.hash) && D && !isGuest() && !document.getElementById("wb")) {
    history.replaceState(null, "", "#/s/multimedia");
    if (isMMMaker()) setTimeout(() => A.openWorkbench({ go: 1 }), 150); else toast(t("notMaker"), true);
  }
  if (D && !isGuest() && api.hasSession() && $("#sheet").hidden) {
    if (viewMode() === null) { if (hasRights()) setTimeout(rolePrompt, 300); else LS.set("view", "member"); }
    else if (profileOn() && !me().profile) setTimeout(() => { if ($("#sheet").hidden && profileOn() && !me().profile) profilePrompt(); }, 900);
    else if (needBday() && LS.get("bdayAsked") !== today()) setTimeout(() => { if ($("#sheet").hidden && needBday()) bdayPrompt(); }, 900);
    else if (serveDue()) setTimeout(() => { if ($("#sheet").hidden && serveDue()) servePrompt(); }, 900);
  }
  if (D && /^#\/s\/multimedia/.test(location.hash) && $("#sheet").hidden && viewMode() !== null) {
    if (D.me.is_admin && manage() && !makers().length && !hydrate.mkAsked) { hydrate.mkAsked = true; setTimeout(A.addMaker, 400); }
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

// ---------- Sunday School slides workbench (YB 2026-10-30) ----------
// Learned from the Sunday School decks in the church Drive folder ("Worship (English|Indonesia|Batak) - <date>"):
// cover, ice-breaker question, songs, prayers, Ten Commandments (one slide each), memory verse, Apostles' Creed (3 pages),
// offering (with the child leading it), announcements, birthdays, the Lord's Prayer, closing; footer on every slide.
// Makers (Sunday School Teacher Makers and the admin) build it here in English, Indonesian or Batak, starting from last week's
// deck (in Sada or in the Drive folder), and publish it: Sunday School, Ama and Ina members get a push and can open it.
const SS_FN = ((window.HKBP_CONFIG || {}).supabaseUrl || "https://tbicfofdorwrupzlqgdm.supabase.co").replace(/\/$/, "") + "/functions/v1/hkbp-ssdeck";
const SS_LANGS = { en: "English", id: "Indonesia", bt: "Batak" };
const SS_TYPES = ["cover", "question", "song", "prayer", "tencom", "verse", "creed", "offering", "announce", "birthday", "lords", "closing"];
const SS_NAMES = {
  en: { cover: "Cover", question: "Question", song: "Song", prayer: "Prayer", tencom: "Ten Commandments", verse: "Memory Verse", creed: "Apostles' Creed", offering: "Offering", announce: "Announcement", birthday: "Birthday", lords: "The Lord's Prayer", closing: "Closing" },
  id: { cover: "Sampul", question: "Pertanyaan", song: "Lagu", prayer: "Doa", tencom: "10 Perintah Tuhan", verse: "Ayat Hafalan", creed: "Pengakuan Iman Rasuli", offering: "Persembahan", announce: "Warta Gereja", birthday: "Ulang Tahun", lords: "Doa Bapa Kami", closing: "Penutup" },
  bt: { cover: "Sampul", question: "Sungkun-sungkun", song: "Marende", prayer: "Tangiang", tencom: "Patik", verse: "Ayat Hafalan", creed: "Hata Haporseaon", offering: "Pelean", announce: "Tingting", birthday: "Ari Tubu", lords: "Tangiang Ale Amanami", closing: "Panutup" },
};
const SS_TEMPLATE = {
  en: [["cover", "Sunday School", "Welcome back to"], ["question", "", ""], ["song", "Let's Sing", ""], ["prayer", "Opening Prayer", ""], ["song", "Let's Sing", ""], ["tencom", "TEN COMMANDMENT", ""], ["verse", "Memory Verse", ""], ["song", "Let's Sing", ""], ["creed", "Apostles' Creed", ""], ["offering", "Offering", ""], ["announce", "Announcement", ""], ["birthday", "Happy Birthday!", ""], ["lords", "The Lord's Prayer", ""], ["closing", "See you next Sunday!", ""]],
  id: [["cover", "Sunday School", "Selamat Datang"], ["question", "", ""], ["song", "Bernyanyi", ""], ["prayer", "Doa Pembuka", ""], ["song", "Bernyanyi", ""], ["tencom", "Hukum Taurat / 10 Perintah Tuhan", ""], ["verse", "Ayat Hafalan", ""], ["song", "Bernyanyi", ""], ["creed", "Pengakuan Iman Rasuli", ""], ["offering", "Persembahan", ""], ["announce", "Warta Gereja", ""], ["birthday", "Happy Birthday!", ""], ["lords", "Doa Bapa Kami", ""], ["closing", "Sampai jumpa Minggu depan!", ""]],
  bt: [["cover", "Sunday School", "Horas!"], ["question", "", ""], ["song", "MARENDE", ""], ["prayer", "Votum/Tangiang", ""], ["prayer", "Doa Pembuka", ""], ["song", "MARENDE", ""], ["tencom", "Patik / Ten Commandments", ""], ["prayer", "Tangiang mangido gogo", ""], ["song", "MARENDE", ""], ["prayer", "Manopoti Dosa", ""], ["verse", "Ayat Hafalan", ""], ["prayer", "Turpuk Siingoton", ""], ["creed", "Hata Haporseaon", ""], ["offering", "Offering", ""], ["announce", "Announcement / Tingting", ""], ["lords", "Tangiang Ale Amanami", ""], ["closing", "Horas! Sampai jumpa Minggu depan", ""]],
};
const SSW = { lang: null, day: null, secs: null };
const ssKey = () => `ssw:${SSW.lang}:${SSW.day}`;
const ssSave = () => LS.set(ssKey(), { at: Date.now(), secs: SSW.secs });
const ssToken = () => { try { return JSON.parse(localStorage.getItem("hkbp.remote.token") || "null"); } catch (e) { return null; } };
async function ssCall(body) {
  const r = await fetch(SS_FN, { method: "POST", headers: { "content-type": "application/json", "x-token": String(ssToken() || "") }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(j.error === "not_allowed" ? t("notAllowed") || "not_allowed" : j.error || "error " + r.status); return j;
}
function ssDateLabel(day, lang) { const loc = lang === "en" ? "en-GB" : "id-ID"; return new Intl.DateTimeFormat(loc, { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Singapore" }).format(new Date(day + "T12:00:00+08:00")); }
function ssTemplate(lang) { return SS_TEMPLATE[lang].map(([type, title, extra]) => ({ type, title, extra, body: "" })); }

// A deck from the Drive folder (its slides as text) into sections, so last week's wording carries over.
function ssParse(slides, lang) {
  const FOOT = /SUNDAY SCHOOL\s*[-–]\s*HKBP SINGAPORE/i; const secs = []; let cur = null; const add = (x) => { secs.push(x); cur = x; return x; };
  const kind = (t0) => /commandment|taurat|patik/i.test(t0) ? "tencom" : /memory verse|ayat hafalan/i.test(t0) ? "verse" : /creed|haporseaon|iman rasuli/i.test(t0) ? "creed"
    : /offering|persembahan|pelean/i.test(t0) ? "offering" : /announcement|warta|tingting/i.test(t0) ? "announce" : /lord.?s prayer|bapa kami|ale amanami/i.test(t0) ? "lords"
    : /prayer|doa|tangiang|votum|manopoti|turpuk|siingoton/i.test(t0) ? "prayer" : /birthday|ari tubu|ulang tahun|🎂/i.test(t0) ? "birthday" : "";
  slides.forEach((sl, i) => {
    const boxes = (sl.boxes || []).filter((b) => !FOOT.test(b)); const b0 = boxes[0] || ""; const b1 = boxes[1] || "";
    if (i === 0 && /sunday school/i.test(b0)) { add({ type: "cover", title: "Sunday School", extra: boxes[1] || "", body: "" }); return; }
    if (!boxes.length && (sl.boxes || []).length) { if (!secs.some((x) => x.type === "closing")) add({ type: "closing", title: SS_TEMPLATE[lang].slice(-1)[0][1], extra: "", body: "" }); return; }   // only the footer: the closing slide
    if (/^marende$/i.test(b0) || (!boxes.length && sl.pictures)) { if (!(cur && cur.type === "song" && cur.open)) add({ type: "song", title: /^marende$/i.test(b0) ? "MARENDE" : SS_TEMPLATE[lang][2][1], extra: "", body: "", open: true, pics: 0 }); cur.pics += sl.pictures || 0; return; }
    if (cur && cur.type === "song" && cur.open && /^\s*\d+\s*\./.test(b0)) { cur.body = [cur.body, ...boxes].filter(Boolean).join("\n\n"); return; }
    if (cur) cur.open = false;
    if (/^\d{1,2}$/.test(b0) && cur && cur.type === "tencom") { cur.items = cur.items || []; cur.items.push(boxes.slice(1).join("\n")); cur.body = cur.items.join("\n\n"); return; }
    const pg = b1.match(/^(.*?)\s*\n?\((?:page|halaman)\s*(\d+)/i) || (b1 && kind(b1) === "creed" ? [b1, b1, "1"] : null);
    if (pg && kind(pg[1]) === "creed") { let c = secs.find((x) => x.type === "creed"); if (!c) c = add({ type: "creed", title: pg[1].trim(), extra: "", body: "" }); c.body = [c.body, b0].filter(Boolean).join("\n\n"); return; }
    if (b1 && kind(b1) === "lords") { add({ type: "lords", title: b1.trim(), extra: "", body: b0 }); return; }
    if (/^🎂|happy\s*\n?\s*birthday/i.test(b0)) { add({ type: "birthday", title: "Happy Birthday!", extra: "", body: boxes.slice(1).join("\n") }); return; }
    if (/memory verse\s*[–-]|ayat hafalan\s*[–-]/i.test(b0)) { const v = secs.slice().reverse().find((x) => x.type === "verse") || add({ type: "verse", title: SS_NAMES[lang].verse, extra: "", body: "" }); if (!v.extra) v.extra = b0; v.body = [v.body, boxes.slice(1).join("\n")].filter(Boolean).join("\n\n"); return; }
    const k = kind(b0.split("\n")[0]);
    if (k === "offering") { add({ type: "offering", title: b0.split("\n")[0].trim(), extra: b0.split("\n").slice(1).join(" ").trim(), body: "" }); return; }
    if (k) { add({ type: k, title: b0.split("\n").map((l) => l.trim()).filter(Boolean).join(" / ").replace(/:\s*\//, " /").replace(/:$/, ""), extra: "", body: boxes.slice(1).join("\n\n"), items: [] }); return; }
    if (i === 1 || (cur && cur.type === "cover")) { add({ type: "question", title: "", extra: "", body: boxes.join("\n") }); return; }
    if (cur && cur.type === "announce") { cur.body = [cur.body, ...boxes].filter(Boolean).join("\n"); return; }
    if (cur && cur.type === "prayer" && !cur.body) { cur.body = boxes.join("\n"); return; }
    if (boxes.length) add({ type: "prayer", title: b0.split("\n")[0], extra: "", body: boxes.slice(1).join("\n") });
  });
  return secs.map(({ open, pics, items, ...x }) => ({ ...x, note: pics && !x.body ? "pics" : "" }));
}

// The deck itself: one self-contained page of 16:9 slides in the learned colours; arrows, tap, swipe, full screen.
function ssRender(lang, day, secs) {
  const e = (x) => String(x == null ? "" : x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const year = day.slice(0, 4); const foot = `SUNDAY SCHOOL - HKBP SINGAPORE | ${year}`;
  const paras = (txt) => String(txt || "").replace(/\r/g, "").split(/\n\s*\n/).map((p) => p.split("\n").map((l) => l.trim()).filter(Boolean)).filter((p) => p.length);
  const chunk = (lines, max) => { if (lines.length <= max) return [lines]; const parts = Math.ceil(lines.length / max), out = []; let i = 0; for (let k = 0; k < parts; k++) { const n = Math.ceil((lines.length - i) / (parts - k)); out.push(lines.slice(i, i + n)); i += n; } return out; };
  const S = []; const slide = (cls, inner) => S.push(`<section class="dk-slide ${cls}"><div class="in">${inner}</div><footer>${e(foot)}</footer></section>`);
  const lines = (ls) => ls.map((l) => `<p>${e(l)}</p>`).join("");
  secs.forEach((x) => {
    const title = x.title || SS_NAMES[lang][x.type] || "";
    if (x.type === "cover") return slide("cover", `<p class="kick">${e(x.extra || "")}</p><h1>${e(title || "Sunday School")}</h1><p class="date">HKBP SINGAPORE | ${e(ssDateLabel(day, lang))}</p>`);
    if (x.type === "question") return slide("question", `<p class="q">${e(x.body)}</p>`);
    if (x.type === "song") {
      slide("song-t", `<p class="kick">♪ ♫</p><h1>${e(title)}</h1>${x.extra ? `<p class="sub">${e(x.extra)}</p>` : ""}`);
      (x.images || []).forEach((src) => S.push(`<section class="dk-slide pic"><img src="${src}" alt=""><footer>${e(foot)}</footer></section>`));
      if (x.body) { const r = HYMN.splitHymn(title + " " + (x.extra || ""), String(x.body).split(/\r?\n/));
        (r.ok ? r.slides : chunk(String(x.body).split(/\n/).filter(Boolean), 6).map((ls, i) => ({ kind: "verse", verse: i + 1, lines: ls }))).forEach((v) => {
          const ref = v.kind === "reff"; const tag = v.withReff ? v.reffFrom : -1;
          slide("lyric" + (ref ? " reff" : ""), `<p class="vn">${ref ? "Reff" : e(v.verse)}</p><div class="ly">${v.lines.map((l, i) => (i === tag ? `<p class="tag">Reff</p>` : "") + `<p>${e(l)}</p>`).join("")}</div>`); }); }
      return;
    }
    if (x.type === "tencom") { slide("tencom-t", `<h1>${e(title)}</h1>`); paras(x.body).forEach((p, i) => slide("tencom", `<p class="num">${i + 1}</p><div class="cmd">${lines(p)}</div>`)); return; }
    if (x.type === "verse") { slide("verse-t", `<h1>${e(title)}</h1>`); if (x.body) slide("verse", `<p class="kick">${e(x.extra || title)}</p><div class="vtext">${lines(String(x.body).split("\n").filter(Boolean))}</div>`); return; }
    if (x.type === "creed") { slide("creed-t", `<h1>${e(title)}</h1>`); let ps = paras(x.body); if (ps.length !== 3) { const all = ps.flat(); ps = chunk(all, Math.ceil(all.length / 3) || 1); }
      ps.forEach((p, i) => slide("creed", `<p class="kick">${e(title)} <small>(${lang === "id" ? "halaman" : "page"} ${i + 1} ${lang === "id" ? "dari" : "out of"} ${ps.length})</small></p><div class="tx">${lines(p)}</div>`)); return; }
    if (x.type === "offering") return slide("offering", `<h1>${e(title)}</h1>${x.extra ? `<p class="sub">${e(x.extra)}</p>` : ""}`);
    if (x.type === "announce") { slide("announce-t", `<h1>${e(title)}</h1>`); const items = String(x.body || "").split("\n").map((l) => l.trim()).filter(Boolean); chunk(items, 5).forEach((ls) => slide("announce", `<ul>${ls.map((l) => `<li>${e(l)}</li>`).join("")}</ul>`)); return; }
    if (x.type === "birthday") { const names = String(x.body || "").split("\n").map((l) => l.trim()).filter(Boolean); if (names.length) slide("birthday", `<p class="cake">🎂🥳</p><h1>${e(title)}</h1><div class="names">${lines(names)}</div>`); return; }
    if (x.type === "lords") { chunk(String(x.body || "").split("\n").map((l) => l.trim()).filter(Boolean), 8).forEach((ls) => slide("lords", `<p class="kick">${e(title)}</p><div class="tx">${lines(ls)}</div>`)); return; }
    if (x.type === "closing") return slide("closing", `<h1>${e(title)}</h1>`);
    slide("prayer-t", `<h1>${e(title)}</h1>`); paras(x.body).forEach((p) => chunk(p, 7).forEach((ls) => slide("prayer", `<p class="kick">${e(title)}</p><div class="tx">${lines(ls)}</div>`)));
  });
  const css = `*{box-sizing:border-box;margin:0}html,body{height:100%;background:#0b1022;font-family:Arial,"Helvetica Neue",Calibri,sans-serif}
  .stage{position:fixed;inset:0;display:grid;place-items:center}.deck{position:relative;width:min(100vw,177.78vh);aspect-ratio:16/9;container-type:inline-size;overflow:hidden;border-radius:6px}
  .dk-slide{position:absolute;inset:0;display:none;color:#111;padding:6cqw 7cqw 7cqw}.dk-slide.on{display:flex;animation:in .25s ease-out}@keyframes in{from{transform:translateX(1.5cqw)}to{transform:none}}
  .dk-slide .in{margin:auto;width:100%;text-align:center}.dk-slide footer{position:absolute;left:0;right:0;bottom:2.2cqw;text-align:center;font-size:1.5cqw;letter-spacing:.12em;font-weight:700;opacity:.7}
  h1{font-size:7.2cqw;line-height:1.08;font-weight:900}.kick{font-size:2.4cqw;font-weight:800;letter-spacing:.08em;text-transform:uppercase;margin-bottom:1.6cqw;opacity:.85}.sub{font-size:3.4cqw;font-weight:700;margin-top:1.8cqw}
  .cover{background:radial-gradient(circle at 15% 20%,#fff6e8,#ECE3D7 55%,#e2d3bf)}.cover h1{font-size:10cqw;color:#1d3c78}.cover .kick{font-size:4cqw;text-transform:none;letter-spacing:0;color:#c0392b}.cover .date{font-size:2.6cqw;font-weight:800;margin-top:2cqw;color:#333}
  .question{background:linear-gradient(160deg,#cfe1ff,#A6C9FD)}.question .q{font-size:5.2cqw;font-weight:800;line-height:1.25;color:#0d2a63}
  .song-t,.verse-t,.creed-t,.announce-t,.prayer-t{background:linear-gradient(160deg,#fff,#EBF8F6)}.song-t h1{color:#7a1fa2}.song-t .kick{font-size:5cqw;color:#e67e22}
  .lyric,.lyric.reff{background:#fff}.lyric .in{display:flex;gap:4cqw;align-items:center;text-align:left}.lyric .vn{font-size:6cqw;font-weight:900;color:#3D6BB2;min-width:9cqw;text-align:center}.lyric.reff .vn{font-size:2.6cqw;border:.35cqw solid #3D6BB2;border-radius:1cqw;padding:1cqw 1.4cqw;letter-spacing:.12em}
  .lyric .ly p{font-size:4.6cqw;line-height:1.3;font-weight:700;white-space:nowrap}.lyric .ly p.tag{display:inline-block;font-size:1.8cqw;letter-spacing:.16em;border:.25cqw solid #3D6BB2;color:#3D6BB2;border-radius:.8cqw;padding:.5cqw 1cqw;margin:1cqw 0}
  .prayer,.creed,.lords{background:linear-gradient(160deg,#fff,#EBF8F6)}.tx p,.vtext p{font-size:3.9cqw;line-height:1.35;font-weight:700}.prayer-t h1,.creed-t h1,.verse-t h1,.announce-t h1{color:#0f6e5f}
  .tencom-t{background:#3D6BB2;color:#fff}.tencom{background:#8AAFE9}.tencom .in{display:flex;align-items:center;gap:5cqw;text-align:left}.tencom .num{font-size:14cqw;font-weight:900;color:#fff;min-width:14cqw;text-align:center;line-height:1}.tencom .cmd p{font-size:4.8cqw;font-weight:800;line-height:1.25;color:#0b1a3a}
  .verse{background:linear-gradient(160deg,#fff8e1,#ffe9a8)}.verse .vtext p{font-size:4.6cqw;color:#3b2a00}
  .offering{background:linear-gradient(160deg,#e8f8ec,#bfe8c9)}.offering h1{color:#196B24}
  .announce{background:#fff}.announce ul{text-align:left;font-size:3.6cqw;font-weight:700;line-height:1.35;padding-left:4cqw}.announce li{margin:1.2cqw 0}
  .birthday{background:radial-gradient(circle at 50% 30%,#fff0f6,#ffd1e3)}.birthday .cake{font-size:9cqw}.birthday h1{color:#c2185b}.birthday .names p{font-size:4.4cqw;font-weight:800;margin-top:1cqw}
  .closing{background:radial-gradient(circle at 15% 20%,#fff6e8,#ECE3D7)}.closing h1{color:#1d3c78}
  .pic{background:#fff;padding:0}.pic img{width:100%;height:100%;object-fit:contain}
  .bar{position:fixed;right:12px;bottom:12px;display:flex;gap:8px;align-items:center;background:rgba(0,0,0,.55);color:#fff;border-radius:999px;padding:6px 10px;font:600 13px Arial;z-index:9;transition:opacity .3s}
  .bar button{border:0;background:rgba(255,255,255,.18);color:#fff;border-radius:999px;padding:6px 12px;font:700 13px Arial}body.idle .bar{opacity:0}`;
  const js = `(function(){var s=[].slice.call(document.querySelectorAll('.dk-slide')),i=0,c=document.getElementById('cnt');function go(n){i=Math.max(0,Math.min(s.length-1,n));s.forEach(function(x,k){x.classList.toggle('on',k===i)});c.textContent=(i+1)+' / '+s.length}
  var h=+(location.hash.replace('#s','')||1);go(h-1);document.addEventListener('keydown',function(e){if(['ArrowRight','PageDown',' ','Enter'].indexOf(e.key)>=0){go(i+1);e.preventDefault()}if(['ArrowLeft','PageUp','Backspace'].indexOf(e.key)>=0){go(i-1);e.preventDefault()}if(e.key==='Home')go(0);if(e.key==='End')go(s.length-1)});
  document.querySelector('.deck').addEventListener('click',function(e){var r=this.getBoundingClientRect();go(i+(e.clientX-r.left>r.width/3?1:-1))});var x0=null;document.addEventListener('touchstart',function(e){x0=e.touches[0].clientX},{passive:true});document.addEventListener('touchend',function(e){if(x0==null)return;var d=e.changedTouches[0].clientX-x0;if(Math.abs(d)>50)go(i+(d<0?1:-1));x0=null},{passive:true});
  document.getElementById('prev').onclick=function(e){e.stopPropagation();go(i-1)};document.getElementById('next').onclick=function(e){e.stopPropagation();go(i+1)};document.getElementById('fs').onclick=function(e){e.stopPropagation();var d=document.documentElement;(d.requestFullscreen||d.webkitRequestFullscreen||function(){}).call(d)};
  var t;function wake(){document.body.classList.remove('idle');clearTimeout(t);t=setTimeout(function(){document.body.classList.add('idle')},2500)}['mousemove','touchstart','keydown'].forEach(function(n){document.addEventListener(n,wake,{passive:true})});wake()})();`;
  return `<!doctype html><html lang="${lang === "en" ? "en" : "id"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sunday School · ${e(ssDateLabel(day, lang))} · ${SS_LANGS[lang]}</title><style>${css}</style></head>
  <body><div class="stage"><div class="deck">${S.join("")}</div></div><div class="bar"><button id="prev">‹</button><span id="cnt"></span><button id="next">›</button><button id="fs">⛶</button></div><script>${js}<\/script></body></html>`;
}

// Viewers: the Sunday School "Slide" tab and the deck page.
function ssList() {
  const list = D.ss_decks || []; const mk = !!D.ss_maker && manage();
  return `${mk ? `<a class="btn primary block" href="#/sswb">🎨 ${esc(L3("Buka workbench slide Sekolah Minggu", "Bukka workbench", "Open the Sunday School slide workbench"))}</a>` : ""}
    ${list.length ? `<div class="card">${list.map((x) => `<a class="li" href="#/ssdeck/${x.id}"><span class="date-chip"><b>${esc(fmt(x.day, { day: "numeric" }))}</b><small>${esc(fmt(x.day, { month: "short" }))}</small></span><span class="grow"><b>${esc(x.title || "Sunday School")}</b><small>${esc(SS_LANGS[x.lang] || x.lang)} · ${esc(x.by || "")}</small></span>${ic("chev", "chev")}</a>`).join("")}</div>`
      : empty(L3("Belum ada slide Sekolah Minggu.", "Dang adong.", "No Sunday School slides yet."), "screen")}`;
}
R.ssdeck = (id) => {
  if (isGuest()) return R.home();
  setTimeout(async () => { const box = document.getElementById("ssBox"); if (!box) return;
    try { const r = await api.save("ss_html", { deck_id: id }); if (!r || !r.html) throw new Error("not_found"); box.innerHTML = ""; const f = tataIframe(r.html); f.style.cssText = "width:100%;aspect-ratio:16/9;border:0;border-radius:14px;background:#0b1022"; box.appendChild(f); SSV.html = r.html; SSV.sections = r.sections; }
    catch (e) { box.innerHTML = `<p class="warn">${esc(errMsg(e))}</p>`; } }, 0);
  const x = (D.ss_decks || []).find((d) => d.id === id) || {};
  return shell("#/groups", `<div id="ssBox">${skel(2)}</div>
    <div class="row two"><button class="btn" data-act="ssFull">⛶ ${esc(L3("Layar penuh", "Layar penuh", "Full screen"))}</button>${D.ss_maker && manage() ? `<a class="btn" href="#/sswb?from=${esc(id)}">✏️ ${esc(L3("Ubah", "Ubah", "Edit"))}</a>` : ""}</div>`,
    { back: "#/g/sekolah-minggu?tab=slides", title: "Sunday School", sub: x.day ? `${fmt(x.day, { day: "numeric", month: "long" })} · ${SS_LANGS[x.lang] || ""}` : "" });
};
const SSV = { html: "", sections: null };
A.ssFull = () => { const f = document.querySelector("#ssBox iframe"); if (!f) return; (f.requestFullscreen || f.webkitRequestFullscreen || function () {}).call(f); };

// The workbench (makers only).
R.sswb = () => {
  if (!D.ss_maker) return shell("#/groups", `<div class="card center pad">${ic("lock")}<p>${esc(L3("Hanya untuk Teacher Maker Sekolah Minggu.", "", "Sunday School Teacher Makers only."))}</p></div>`, { back: "#/g/sekolah-minggu?tab=slides", title: "Sunday School" });
  const q = new URLSearchParams(location.hash.split("?")[1] || "");
  if (!SSW.lang) SSW.lang = LS.get("sswLang", "en"); if (!SSW.day) SSW.day = nextSunday();
  if (q.get("from")) { const src = (D.ss_decks || []).find((d) => d.id === q.get("from")); if (src) { SSW.lang = src.lang; SSW.day = src.day; } }
  if (!SSW.secs) { const dr = LS.get(ssKey(), null); SSW.secs = dr && dr.secs ? dr.secs : null; }
  if (q.get("from") && SSV.sections && !SSW.secs) SSW.secs = SSV.sections;
  const secs = SSW.secs;
  const typeOpt = (sel) => SS_TYPES.map((tp) => `<option value="${tp}"${tp === sel ? " selected" : ""}>${esc(SS_NAMES[SSW.lang][tp])}</option>`).join("");
  const field = (x, i) => {
    const extraLabel = { cover: L3("Sapaan", "Sapaan", "Greeting"), song: L3("Nomor / judul lagu", "Nomor ende", "Song number / name"), verse: L3("Judul ayat (mis. Memory Verse – November 2026)", "", "Verse heading (e.g. Memory Verse – November 2026)"), offering: L3("Anak yang memimpin", "Dakdanak", "Child leading the offering") }[x.type];
    const bodyLabel = { question: L3("Pertanyaan pembuka", "Sungkun-sungkun", "Ice-breaker question"), song: L3("Lirik (baris kosong = bait baru, \"Reff:\" untuk reff)", "Lirik", "Lyrics (blank line = new verse, \"Reff:\" for the refrain)"), tencom: L3("10 perintah (pisahkan dengan baris kosong)", "Patik (baris kosong)", "The 10 commandments (separate with a blank line)"),
      verse: L3("Isi ayat dan referensi", "Ayat", "Verse text and reference"), creed: L3("Teks (3 halaman, pisahkan dengan baris kosong)", "Hata Haporseaon", "Text (3 pages, separate with a blank line)"), announce: L3("Satu pengumuman per baris", "Sada baris", "One announcement per line"), birthday: L3("Nama, satu per baris", "Goar", "Names, one per line"), lords: L3("Teks doa", "Tangiang", "Prayer text"), prayer: L3("Teks (boleh kosong bila didoakan bebas)", "Tangiang", "Text (may be empty for a free prayer)") }[x.type];
    return `<article class="card ssw-sec" data-i="${i}"><div class="row between" style="margin:0"><select class="ssw-type" data-i="${i}">${typeOpt(x.type)}</select><span class="row" style="margin:0;gap:4px"><button class="icon-btn" data-act="sswMove" data-i="${i}" data-d="-1" aria-label="Up">↑</button><button class="icon-btn" data-act="sswMove" data-i="${i}" data-d="1" aria-label="Down">↓</button><button class="icon-btn danger" data-act="sswDel" data-i="${i}" aria-label="${esc(t("delete"))}">${ic("trash")}</button></span></div>
      ${x.type !== "question" ? `<input class="ssw-in" data-i="${i}" data-k="title" value="${esc(x.title || "")}" placeholder="${esc(SS_NAMES[SSW.lang][x.type])}">` : ""}
      ${extraLabel ? `<label class="small">${esc(extraLabel)}<input class="ssw-in" data-i="${i}" data-k="extra" value="${esc(x.extra || "")}"></label>` : ""}
      ${bodyLabel ? `<label class="small">${esc(bodyLabel)}<textarea class="ssw-in" data-i="${i}" data-k="body" rows="${["tencom", "creed", "lords", "song"].includes(x.type) ? 8 : 3}">${esc(x.body || "")}</textarea></label>` : ""}
      ${x.type === "song" ? `<div class="row" style="margin:6px 0 0;flex-wrap:wrap">${(x.images || []).map((src, k) => `<span class="ssw-img"><img src="${src}" alt=""><button class="icon-btn danger" data-act="sswImgDel" data-i="${i}" data-k="${k}" aria-label="${esc(t("delete"))}">×</button></span>`).join("")}<button class="btn sm ghost" data-act="sswImg" data-i="${i}">📷 ${esc(L3("Gambar lirik", "Gambar", "Lyric pictures"))}</button></div>${x.note === "pics" ? `<p class="small muted">${esc(L3("Di deck lama liriknya berupa gambar: ketik liriknya atau unggah gambarnya.", "", "In the old deck the lyrics were pictures: type them or upload the pictures."))}</p>` : ""}` : ""}
    </article>`;
  };
  return shell("#/groups", `<h2 class="page-h">🎨 ${esc(L3("Workbench Sekolah Minggu", "Workbench Sekolah Minggu", "Sunday School workbench"))}</h2>
    <div class="seg" style="--gc:#e67e22">${Object.entries(SS_LANGS).map(([k, v]) => `<a role="tab" aria-selected="${SSW.lang === k}" href="javascript:void 0" data-act="sswLang" data-l="${k}">${v}</a>`).join("")}</div>
    <label>${esc(L3("Hari Minggu", "Ari Minggu", "Sunday"))}<input type="date" id="sswDay" value="${esc(SSW.day)}"></label>
    <div class="row two"><button class="btn" data-act="sswImport" data-src="drive">⬇️ ${esc(L3("Dari deck terakhir (Drive)", "Sian Drive", "From the latest deck (Drive)"))}</button><button class="btn" data-act="sswImport" data-src="sada">↺ ${esc(L3("Dari slide Sada terakhir", "Sian Sada", "From the latest Sada deck"))}</button></div>
    ${secs ? `${secs.map(field).join("")}
      <div class="row two"><select id="sswAdd">${typeOpt("song")}</select><button class="btn" data-act="sswAdd">${ic("plus")} ${esc(L3("Tambah bagian", "Tambah", "Add section"))}</button></div>
      <div class="row two sticky-actions"><button class="btn" data-act="sswPreview">👁 ${esc(L3("Pratinjau", "Ida", "Preview"))}</button><button class="btn primary" data-act="sswPublish">🚀 ${esc(L3("Terbitkan", "Terbitkan", "Publish"))}</button></div>`
      : `<button class="btn block" data-act="sswBlank">${esc(L3("Atau mulai dari template kosong", "Template kosong", "Or start from an empty template"))}</button>`}`,
    { back: "#/g/sekolah-minggu?tab=slides", title: L3("Workbench Sekolah Minggu", "Workbench", "Sunday School workbench"), sub: SS_LANGS[SSW.lang] });
};
const sswRe = () => { ssSave(); const y = window.scrollY; render(); setTimeout(() => window.scrollTo(0, y), 0); };
A.sswLang = (d) => { SSW.lang = d.l; LS.set("sswLang", d.l); const dr = LS.get(ssKey(), null); SSW.secs = dr && dr.secs ? dr.secs : null; render(); };
A.sswBlank = () => { SSW.secs = ssTemplate(SSW.lang); sswRe(); };
A.sswAdd = () => { const tp = (document.getElementById("sswAdd") || {}).value || "song"; SSW.secs.push({ type: tp, title: SS_NAMES[SSW.lang][tp], extra: "", body: "" }); sswRe(); };
A.sswDel = (d) => { SSW.secs.splice(+d.i, 1); sswRe(); };
A.sswMove = (d) => { const i = +d.i, j = i + +d.d; if (j < 0 || j >= SSW.secs.length) return; [SSW.secs[i], SSW.secs[j]] = [SSW.secs[j], SSW.secs[i]]; sswRe(); };
A.sswImg = (d) => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.multiple = true;
  inp.onchange = async () => { const sec = SSW.secs[+d.i]; sec.images = sec.images || []; for (const f of inp.files) { try { sec.images.push(await resizeImage(f, 1600, 0.8)); } catch (e) {} } sswRe(); }; inp.click(); };
A.sswImgDel = (d) => { const sec = SSW.secs[+d.i]; (sec.images || []).splice(+d.k, 1); sswRe(); };
document.addEventListener("input", (e) => { const el = e.target; if (!el || !el.classList) return;
  if (el.classList.contains("ssw-in") && SSW.secs) { SSW.secs[+el.dataset.i][el.dataset.k] = el.value; ssSave(); }
  if (el.id === "sswDay" && el.value) { SSW.day = el.value; } });
document.addEventListener("change", (e) => { const el = e.target; if (el && el.classList && el.classList.contains("ssw-type") && SSW.secs) { SSW.secs[+el.dataset.i].type = el.value; sswRe(); } });
A.sswImport = async (d, btn) => {
  try {
    if (d.src === "sada") {
      const prev = (D.ss_decks || []).find((x) => x.lang === SSW.lang); if (!prev) throw new Error(L3("Belum ada slide Sada dalam bahasa ini.", "Dang adong.", "No Sada deck in this language yet."));
      const r = await busy(btn, () => api.save("ss_html", { deck_id: prev.id })); if (!r || !r.sections) throw new Error("no_sections");
      SSW.secs = r.sections.map((x) => ({ ...x }));
    } else {
      const ls = await busy(btn, () => ssCall({ op: "list" }));
      const when = (n) => { const m = String(n).match(/(\d{1,2})\s*([A-Za-z]+)\s*(\d{4})/); if (!m) return ""; const mi = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(m[2].slice(0, 3).toLowerCase()); return mi < 0 ? "" : `${m[3]}-${String(mi + 1).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`; };
      const deck = (ls.decks || []).filter((x) => x.lang === SSW.lang && !/^copy of/i.test(x.name)).map((x) => ({ ...x, d: when(x.name) })).sort((a, b) => b.d.localeCompare(a.d))[0];
      if (!deck) throw new Error(L3("Tidak ada deck bahasa ini di folder Drive.", "Dang adong.", "No deck in this language in the Drive folder."));
      toast(L3("Membaca ", "Manjaha ", "Reading ") + deck.name);
      const r = await busy(btn, () => ssCall({ id: deck.id, google: deck.google }));
      SSW.secs = ssParse(r.slides || [], SSW.lang);
    }
    const cov = SSW.secs.find((x) => x.type === "cover"); if (!cov) SSW.secs.unshift({ type: "cover", title: "Sunday School", extra: SS_TEMPLATE[SSW.lang][0][2], body: "" });
    sswRe(); toast(L3("Siap diubah untuk Minggu ini.", "Siap.", "Ready to edit for this Sunday."));
  } catch (e) { toast(e.message || errMsg(e), true); }
};
A.sswPreview = () => { const html = ssRender(SSW.lang, SSW.day, SSW.secs); sheet("👁 " + L3("Pratinjau", "Ida", "Preview"), `<div id="sswPrev"></div><p class="small muted">${esc(L3("Ketuk sisi kanan/kiri atau gunakan panah untuk pindah slide.", "", "Tap right/left or use the arrows to move between slides."))}</p>`);
  const f = tataIframe(html); f.style.cssText = "width:100%;aspect-ratio:16/9;border:0;border-radius:12px;background:#0b1022"; document.getElementById("sswPrev").appendChild(f); };
A.sswPublish = async (d, btn) => {
  const html = ssRender(SSW.lang, SSW.day, SSW.secs);
  try { const r = await busy(btn, () => api.save("ss_deck", { day: SSW.day, lang: SSW.lang, title: `Sunday School · ${ssDateLabel(SSW.day, SSW.lang)}`, sections: SSW.secs, html, notify: true }));
    await refresh(); toast(L3(`Terbit. ${r.told || 0} orang diberi tahu.`, `Tarbit. ${r.told || 0} dipaboa.`, `Published. ${r.told || 0} people notified.`)); location.hash = "#/ssdeck/" + r.id; }
  catch (e) { toast(errMsg(e), true); }
};
try { document.head.insertAdjacentHTML("beforeend", `<style>
  .ssw-sec { display: grid; gap: 8px; } .ssw-sec select.ssw-type { width: auto; font-weight: 800; }
  .ssw-img { position: relative; display: inline-block; } .ssw-img img { width: 70px; height: 50px; object-fit: cover; border-radius: 8px; } .ssw-img .icon-btn { position: absolute; top: -8px; right: -8px; width: 22px; height: 22px; font-size: 13px; }
</style>`); } catch (e) {}

// ---------- Kurs: currency converter (YB 2026-10-30) ----------
// Rates from open.er-api.com (free, no key; updated daily), kept on the phone so it also works offline.
// Type an amount and the result updates as you type; swap, pick any currency, or tap a chip.
const FX_CHIPS = ["SGD", "IDR", "MYR", "USD", "EUR", "AUD", "GBP", "JPY", "CNY", "HKD", "PHP", "THB", "KRW", "INR"];
const FX = { busy: false };
const fxFlag = (c) => (/^[A-Z]{3}$/.test(c) && c !== "XAU" ? String.fromCodePoint(...[...c.slice(0, 2)].map((x) => 0x1f1e6 + x.charCodeAt(0) - 65)) : "💱");
const fxDigits = (c) => { if (["IDR", "JPY", "KRW", "VND", "CLP", "ISK", "HUF", "TWD"].includes(c)) return 0; try { return new Intl.NumberFormat("en", { style: "currency", currency: c }).resolvedOptions().maximumFractionDigits; } catch (e) { return 2; } };
const fxFmt = (v, c) => (isFinite(v) ? v.toLocaleString("en-US", { minimumFractionDigits: Math.min(fxDigits(c), v >= 1 || v === 0 ? fxDigits(c) : 2), maximumFractionDigits: v < 1 && v > 0 ? 6 : fxDigits(c) }) : "–");
function fxRate(from, to) { const r = (LS.get("fxRates", null) || {}).rates || {}; return r[from] && r[to] ? r[to] / r[from] : NaN; }
async function fxLoad(force) {
  const cur = LS.get("fxRates", null);
  if (!force && cur && Date.now() - cur.at < 3600e3) return cur;
  if (FX.busy) return cur; FX.busy = true;
  try { const r = await fetch("https://open.er-api.com/v6/latest/USD"); const j = await r.json(); if (j && j.result === "success" && j.rates) { const v = { at: Date.now(), updated: (j.time_last_update_unix || 0) * 1000, rates: j.rates }; LS.set("fxRates", v); return v; } }
  catch (e) {} finally { FX.busy = false; }
  return cur;
}
function fxPaint() {
  const from = LS.get("fxFrom", "SGD"), to = LS.get("fxTo", "IDR"); const el = document.getElementById("fxAmt"); if (!el) return;
  const amt = parseFloat(String(el.value).replace(/,/g, "")) || 0; const rate = fxRate(from, to); const st = LS.get("fxRates", null);
  const set = (id, v) => { const x = document.getElementById(id); if (x) x.textContent = v; };
  set("fxOut", fxFmt(amt * rate, to));
  const fit = (id) => { const x = document.getElementById(id); if (!x) return; let fs = 34; x.style.fontSize = fs + "px"; while (fs > 16 && x.scrollWidth > x.clientWidth + 1) { fs -= 2; x.style.fontSize = fs + "px"; } };
  fit("fxOut"); fit("fxAmt"); set("fxRate", isFinite(rate) ? `1 ${from} = ${fxFmt(rate, to)} ${to}` : L3("Kurs belum tersedia, periksa internet.", "Kurs dang adong.", "Rates not available yet, check the internet."));
  set("fxInv", isFinite(rate) ? `1 ${to} = ${fxFmt(1 / rate, from)} ${from}` : "");
  set("fxWhen", st ? L3("Kurs diperbarui ", "Diperbarui ", "Rates updated ") + fmt(new Date(st.updated || st.at).toISOString(), { day: "numeric", month: "short" }) + " " + fmtTime(new Date(st.updated || st.at).toISOString()) + " · open.er-api.com" : "");
  const list = document.getElementById("fxList");
  if (list) list.innerHTML = FX_CHIPS.filter((c) => c !== from).map((c) => `<button class="li fx-li" data-act="fxTo" data-c="${c}"><span class="fx-flag">${fxFlag(c)}</span><span class="grow"><b>${c}</b><small>${esc(curName(c))}</small></span><b class="fx-v">${fxFmt(amt * fxRate(from, c), c)}</b></button>`).join("");
}
R.fx = () => {
  const from = LS.get("fxFrom", "SGD"), to = LS.get("fxTo", "IDR");
  setTimeout(async () => { fxPaint(); const before = JSON.stringify((LS.get("fxRates", null) || {}).updated); await fxLoad(false); if (JSON.stringify((LS.get("fxRates", null) || {}).updated) !== before || !before) fxPaint(); }, 0);
  return shell("#/more", `<h2 class="page-h">💱 ${esc(L3("Kurs", "Kurs", "Exchange rates"))}</h2>
    <div class="fx-card">
      <div class="fx-row"><button class="fx-cur" data-act="fxPick" data-side="from"><span class="fx-flag">${fxFlag(from)}</span>${from} ▾</button>
        <input id="fxAmt" inputmode="decimal" autocomplete="off" value="${esc(LS.get("fxAmt", "100"))}" aria-label="${esc(t("finAmount"))}"></div>
      <button class="fx-swap" data-act="fxSwap" aria-label="Swap">⇅</button>
      <div class="fx-row out"><button class="fx-cur" data-act="fxPick" data-side="to"><span class="fx-flag">${fxFlag(to)}</span>${to} ▾</button><span id="fxOut" class="fx-out">–</span></div>
      <p class="fx-rate" id="fxRate"></p><p class="fx-inv" id="fxInv"></p>
    </div>
    <div class="chips fx-chips">${FX_CHIPS.map((c) => `<button class="chip${c === to ? " on" : ""}" data-act="fxTo" data-c="${c}">${fxFlag(c)} ${c}</button>`).join("")}</div>
    <h3 class="sec-h">${esc(L3("Dalam mata uang lain", "Hepeng na asing", "In other currencies"))}</h3><div class="card" id="fxList"></div>
    <div class="row between"><small class="muted" id="fxWhen"></small><button class="btn sm ghost" data-act="fxRefresh">↻ ${esc(L3("Perbarui", "Perbarui", "Refresh"))}</button></div>`,
    { back: "#/more", title: L3("Kurs", "Kurs", "Exchange rates") });
};
document.addEventListener("input", (e) => { if (e.target && e.target.id === "fxAmt") { LS.set("fxAmt", e.target.value); fxPaint(); } });
A.fxSwap = () => { const f = LS.get("fxFrom", "SGD"), t0 = LS.get("fxTo", "IDR"); LS.set("fxFrom", t0); LS.set("fxTo", f); render(); };
A.fxTo = (d) => { if (d.c === LS.get("fxFrom", "SGD")) { A.fxSwap(); return; } LS.set("fxTo", d.c); render(); };
A.fxRefresh = async (d, btn) => { await busy(btn, () => fxLoad(true)); fxPaint(); toast(t("saved")); };
A.fxPick = (d) => {
  const side = d.side; const all = Object.keys((LS.get("fxRates", null) || {}).rates || {}).sort(); const list = [...FX_CHIPS, ...all.filter((c) => !FX_CHIPS.includes(c))];
  sheet(L3("Pilih mata uang", "Pilih hepeng", "Choose a currency"), `<input type="search" id="fxFind" placeholder="${esc(t("search"))}" autocomplete="off" style="margin-bottom:8px">
    <div class="card fx-pick">${list.map((c) => `<button class="li" data-act="fxSet" data-side="${side}" data-c="${c}" data-n="${esc(norm(c + " " + curName(c)))}"><span class="fx-flag">${fxFlag(c)}</span><span class="grow"><b>${c}</b><small>${esc(curName(c))}</small></span></button>`).join("")}</div>`);
};
A.fxSet = (d) => { const other = d.side === "from" ? LS.get("fxTo", "IDR") : LS.get("fxFrom", "SGD"); if (d.c === other) { closeSheet(); A.fxSwap(); return; } LS.set(d.side === "from" ? "fxFrom" : "fxTo", d.c); closeSheet(); render(); };
document.addEventListener("input", (e) => { if (e.target && e.target.id === "fxFind") { const q = norm(e.target.value); document.querySelectorAll(".fx-pick .li").forEach((a) => (a.style.display = !q || a.dataset.n.includes(q) ? "" : "none")); } });
try { document.head.insertAdjacentHTML("beforeend", `<style>
  .fx-card { position: relative; margin: 12px 0; padding: 18px; border-radius: 24px; background: linear-gradient(145deg, var(--brand), color-mix(in srgb, var(--brand) 60%, #0b1022)); color: #fff; box-shadow: var(--shadow-lg); }
  .fx-row { display: flex; align-items: center; gap: 12px; background: rgba(255, 255, 255, .1); border-radius: 18px; padding: 10px 12px; }
  .fx-row.out { background: rgba(255, 255, 255, .18); }
  .fx-cur { flex: none; display: inline-flex; align-items: center; gap: 8px; border: 0; border-radius: 12px; padding: 10px 12px; background: rgba(255, 255, 255, .16); color: #fff; font-weight: 800; font-size: 16px; }
  .fx-flag { font-size: 22px; line-height: 1; }
  #fxAmt { flex: 1; min-width: 0; border: 0; background: transparent; color: #fff; font-size: 34px; font-weight: 800; text-align: right; box-shadow: none; padding: 4px 0; }
  .fx-out { flex: 1; min-width: 0; text-align: right; font-size: 34px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.15; }
  .fx-swap { display: block; margin: -8px auto; position: relative; z-index: 1; width: 44px; height: 44px; border-radius: 50%; border: 3px solid color-mix(in srgb, var(--brand) 80%, #0b1022); background: #fff; color: var(--brand); font-size: 20px; font-weight: 900; }
  .fx-rate { margin: 14px 0 0; font-weight: 800; font-size: 15px; } .fx-inv { margin: 2px 0 0; font-size: 13px; opacity: .8; }
  .fx-chips { margin: 4px 0 6px; overflow-x: auto; flex-wrap: nowrap; padding-bottom: 4px; } .fx-chips .chip { flex: none; }
  .fx-li { width: 100%; text-align: left; display: flex; align-items: center; gap: 12px; } .fx-li .grow { flex: 1; min-width: 0; } .fx-v { font-size: 15.5px; white-space: nowrap; margin-left: auto; }
</style>`); } catch (e) {}

// ---------- Private messages (YB 2026-10-30) ----------
// One-to-one, like Messenger: the room is dm:<id>:<id> (both ids, sorted). Only the two people can read it, not even the admin.
// Inbox with unread counts in the Chat tab, read receipts ("Dilihat"), live dot, photos, replies and reactions as in group chat.
const dmRoom = (otherId) => "dm:" + [D.me.id, otherId].sort().join(":");
A.dmNew = () => {
  const people = (D.people || []).filter((p) => p.id !== D.me.id).sort((a, b) => a.name.localeCompare(b.name));
  sheet("✏️ " + L3("Pesan baru", "Pesan baru", "New message"), `<input type="search" id="dmFind" placeholder="${esc(L3("Cari nama…", "Bilang goar…", "Search a name…"))}" autocomplete="off" style="margin-bottom:8px">
    <div class="card dm-pick">${people.map((p) => `<a class="li" data-n="${esc(norm(p.name + " " + (p.alias || "")))}" href="#/chat/${esc(dmRoom(p.id))}">${avatarOf(p)}<span class="grow"><b>${esc(p.name)}</b><small>${esc(seenText(p.id))}</small></span>${ic("chev", "chev")}</a>`).join("")}</div>`);
  setTimeout(() => { const i = document.getElementById("dmFind"); if (i) i.focus(); }, 50);
};
document.addEventListener("input", (e) => { if (e.target && e.target.id === "dmFind") { const q = norm(e.target.value); document.querySelectorAll(".dm-pick .li").forEach((a) => (a.style.display = !q || a.dataset.n.includes(q) ? "" : "none")); } });
document.addEventListener("click", (e) => { const a = e.target.closest && e.target.closest(".dm-pick a.li"); if (a) closeSheet(); });
try { document.head.insertAdjacentHTML("beforeend", `<style>
  .dm-list .li.unread b { font-weight: 900; } .dm-list .li.unread small { color: var(--ink); font-weight: 700; }
  .dm-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex: none; } .dm-meta small { color: var(--muted); font-size: 12px; }
  .dm-n { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; background: #ef4444; color: #fff; font-size: 12px; line-height: 20px; text-align: center; }
  .ch-seen { font-size: 11.5px; color: var(--muted); padding: 0 8px; }
</style>`); } catch (e) {}

// ---------- Rapat: video meetings (YB 2026-10-30) ----------
// Each meeting is a private room on Jitsi Meet (free, no account for guests): video, audio, screen share, chat, raise hand,
// reactions, lobby and password, breakout rooms, polls, tile view, virtual backgrounds, recording to your device.
// Sada schedules it for a group, sends the invitation push, puts it in the calendar (RSVP and a 10-minute reminder),
// opens it with your name filled in, and keeps the notes (notulen). Makers and elders can open meetings.
const meetUrl = (x) => `https://meet.jit.si/${encodeURIComponent(x.room)}#userInfo.displayName=${encodeURIComponent(JSON.stringify(D.me.name || ""))}&config.prejoinPageEnabled=true&config.subject=${encodeURIComponent(JSON.stringify(x.title))}`;
const meetEnd = (x) => Date.parse(x.starts_at) + (x.minutes || 60) * 60e3;
const meetNow = () => (D.meetings || []).filter((x) => Date.now() >= Date.parse(x.starts_at) - 10 * 60e3 && Date.now() <= meetEnd(x));
const canMeet = () => !!D && !isGuest() && (D.me.is_admin || isChatMaker() || "parhalado" in (D.me.groups || {}));
function meetAudiences() {
  const g = D.me.groups || {}; const elder = D.me.is_admin || "parhalado" in g; const out = [];
  if (elder) out.push(["all", "", L3("Seluruh jemaat", "Sude ruas", "Whole church")]);
  if (elder) out.push(["elders", "", "Parhalado"]);
  if (isChatMaker()) out.push(["makers", "", L3("Semua makers", "Sude makers", "All makers")]);
  (D.groups || []).filter((x) => x.kind !== "office" && (D.me.is_admin || x.id in g)).forEach((x) => out.push(["group", x.id, gname(x)]));
  return out;
}
R.meet = () => {
  const list = (D.meetings || []).slice(); const now = Date.now();
  const live = list.filter((x) => now >= Date.parse(x.starts_at) - 10 * 60e3 && now <= meetEnd(x));
  const next = list.filter((x) => Date.parse(x.starts_at) - 10 * 60e3 > now);
  const past = list.filter((x) => meetEnd(x) < now).reverse().slice(0, 10);
  const row = (x, state) => `<article class="card meet${state === "live" ? " on" : ""}"><div class="row between" style="margin:0"><span class="grow"><b>${esc(x.title)}</b><small class="muted" style="display:block">${esc(fmt(x.starts_at, { weekday: "short", day: "numeric", month: "short" }))} · ${esc(fmtTime(x.starts_at))}–${esc(fmtTime(new Date(meetEnd(x)).toISOString()))} · ${esc(x.audience === "group" ? gname(G(x.group_id)) : x.audience === "all" ? L3("Jemaat", "Ruas", "Church") : x.audience === "elders" ? "Parhalado" : "Makers")} · ${esc(x.by || "")}</small></span>${state === "live" ? `<span class="live-dot"></span>` : ""}</div>
      ${state !== "past" ? `<div class="row two"><a class="btn${state === "live" ? " primary" : ""}" href="${esc(meetUrl(x))}" target="_blank" rel="noopener">📹 ${esc(state === "live" ? L3("Gabung sekarang", "Masuk", "Join now") : L3("Buka ruang", "Bukka", "Open room"))}</a><a class="btn wa" href="${wa(`📹 *${x.title}*\n${fmt(x.starts_at, { weekday: "long", day: "numeric", month: "long" })} · ${fmtTime(x.starts_at)}\n${"https://meet.jit.si/" + x.room}\n\n– HKBP Singapore`)}" target="_blank" rel="noopener">${ic("wa")} WhatsApp</a></div>` : ""}
      ${x.notes ? `<details class="meet-notes"${state === "past" ? " open" : ""}><summary>📝 ${esc(L3("Notulen", "Notulen", "Notes"))}</summary><p class="pre small">${esc(x.notes)}</p></details>` : ""}
      ${x.mine || D.me.is_admin ? `<div class="row end" style="margin-top:6px"><button class="btn sm ghost" data-act="meetNotes" data-id="${x.id}">📝 ${esc(L3("Notulen", "Notulen", "Notes"))}</button>${state !== "past" ? `<button class="btn sm danger" data-act="del" data-kind="meet" data-id="${x.id}" aria-label="${esc(t("delete"))}">${ic("trash")}</button>` : ""}</div>` : ""}</article>`;
  return shell("#/calendar", `${schedHead("meet")}
    ${canMeet() ? `<div class="row two"><button class="btn primary" data-act="meetNew" data-now="1">⚡ ${esc(L3("Mulai sekarang", "Mulai", "Start now"))}</button><button class="btn" data-act="meetNew">🗓 ${esc(L3("Jadwalkan", "Jadwalhon", "Schedule"))}</button></div>` : ""}
    ${live.length ? `<h3 class="sec-h">🔴 ${esc(L3("Sedang berlangsung", "Masa", "On now"))}</h3>${live.map((x) => row(x, "live")).join("")}` : ""}
    <h3 class="sec-h">${esc(L3("Akan datang", "Naeng ro", "Upcoming"))}</h3>${next.length ? next.map((x) => row(x, "next")).join("") : `<p class="muted small">${esc(L3("Belum ada rapat terjadwal.", "Dang adong.", "No meetings scheduled."))}</p>`}
    ${past.length ? `<h3 class="sec-h">${esc(L3("Sebelumnya", "Na salpu", "Earlier"))}</h3>${past.map((x) => row(x, "past")).join("")}` : ""}
    <p class="small muted">${esc(L3("Rapat berjalan di Jitsi Meet (meet.jit.si) di browser atau aplikasi Jitsi. Orang pertama yang masuk menjadi moderator dan diminta masuk dengan Google/GitHub sekali; peserta lain tidak perlu akun.", "", "Meetings run on Jitsi Meet (meet.jit.si) in the browser or the Jitsi app. The first person in becomes the moderator and is asked to sign in with Google/GitHub once; others need no account."))}</p>`,
    { title: L3("Rapat", "Rapat", "Meetings") });
};
A.meetNew = (d) => {
  const auds = meetAudiences(); const now = d.now === "1";
  const local = new Date(Date.now() + 8 * 3600e3 + 3600e3); const dt = local.toISOString().slice(0, 13) + ":00";
  sheet(now ? "⚡ " + L3("Mulai rapat sekarang", "Mulai rapat", "Start a meeting now") : "🗓 " + L3("Jadwalkan rapat", "Jadwalhon rapat", "Schedule a meeting"), `<form class="form" data-form="meet" data-now="${now ? 1 : 0}">
    <label>${esc(L3("Judul", "Judul", "Title"))}<input name="title" required maxlength="120" placeholder="${esc(L3("Rapat Multimedia", "Rapat", "Multimedia meeting"))}"></label>
    <label>${esc(L3("Undang", "Undang", "Invite"))}<select name="aud">${auds.map(([a, g, label], i) => `<option value="${a}|${g}"${i === 0 ? " selected" : ""}>${esc(label)}</option>`).join("")}</select></label>
    ${now ? "" : `<label>${esc(L3("Mulai", "Mulai", "Starts"))}<input type="datetime-local" name="at" value="${dt}" required></label>`}
    <label>${esc(L3("Durasi", "Durasi", "Length"))}<select name="minutes">${[30, 45, 60, 90, 120, 180].map((m) => `<option value="${m}"${m === 60 ? " selected" : ""}>${m} min</option>`).join("")}</select></label>
    <p class="small muted">${esc(L3("Yang diundang mendapat notifikasi; rapat terjadwal masuk kalender dengan pengingat 10 menit sebelumnya.", "", "Invitees get a push; a scheduled meeting goes into the calendar with a reminder 10 minutes before."))}</p>
    <button class="btn primary block">${esc(now ? L3("Mulai dan undang", "Mulai", "Start and invite") : L3("Jadwalkan dan undang", "Jadwalhon", "Schedule and invite"))}</button></form>`);
};
F.meet = async (f) => {
  const [audience, group_id] = f.aud.value.split("|"); const now = f.dataset.now === "1";
  const starts_at = now ? new Date().toISOString() : new Date(f.at.value + ":00+08:00").toISOString();
  const x = await api.save("meet", { title: f.title.value.trim(), audience, group_id: group_id || null, starts_at, minutes: +f.minutes.value });
  closeSheet(); await refresh();
  if (now && x && x.room) window.open(meetUrl(x), "_blank", "noopener");
  toast(L3("Undangan terkirim.", "Undangan tarkirim.", "Invitations sent."));
};
A.meetNotes = (d) => {
  const x = (D.meetings || []).find((m) => String(m.id) === String(d.id)); if (!x) return;
  sheet("📝 " + x.title, `<form class="form" data-form="meetnotes" data-id="${x.id}"><label>${esc(L3("Notulen rapat", "Notulen", "Meeting notes"))}<textarea name="notes" rows="10" maxlength="8000">${esc(x.notes || "")}</textarea></label>
    <p class="small muted">${esc(L3("Semua yang diundang dapat membaca notulen ini.", "", "Everyone invited can read these notes."))}</p><button class="btn primary block">${esc(t("save"))}</button></form>`);
};
F.meetnotes = async (f) => { await api.save("meet_notes", { meet_id: +f.dataset.id, notes: f.notes.value }); closeSheet(); await refresh(); toast(t("saved")); };
try { document.head.insertAdjacentHTML("beforeend", `<style>
  .card.meet.on { border: 2px solid #ef4444; } .card.meet .row.two { margin-top: 10px; } .meet-notes summary { cursor: pointer; display: block !important; font-weight: 700; margin-top: 8px; }
</style>`); } catch (e) {}

// Pinned "now" card on Home (YB 2026-10-30), styled like an iPhone lock-screen activity: Sada's icon, a bold title,
// the time on the right, and one big highlighted line. Shown only when something is happening:
// a live service, then your duty (from the day before), then an event today.
function nowCard() {
  if (isGuest() || !D) return "";
  const td = today(), tm = addDays(td, 1);
  const icon = `<span class="nc-ic"><img src="icon-192.png" alt="" onerror="this.replaceWith(Object.assign(document.createElement('b'),{textContent:'⛪'}))"></span>`;
  const card = (href, label, title, right, big, sub, live) => `<a class="nowcard${live ? " live" : ""}" href="${href}">
    <div class="nc-top">${icon}<span class="grow"><small>${esc(label)}</small><b>${esc(title)}</b></span>${right ? `<span class="nc-time">${right}</span>` : ""}</div>
    <div class="nc-box"><span class="nc-big">${esc(big)}</span><span class="nc-sub">${esc(sub)}</span></div></a>`;
  const mt = meetNow()[0];
  if (mt) return card("#/meet", "Sada HKBPS · " + L3("Rapat", "Rapat", "Meeting"), mt.title, `<i class="live-dot"></i> ${esc(fmtTime(mt.starts_at))}`,
    L3("Gabung", "Masuk", "Join"), L3(`Sedang berlangsung · ${mt.by}. Ketuk untuk bergabung.`, "Masa · ketuk asa masuk.", `On now · ${mt.by}. Tap to join.`), true);
  if (D.live && D.live.service_id) return card("#/live", "Sada HKBPS", L3("Ibadah sedang berlangsung", "Partangiangan masa", "The service is on"), `<i class="live-dot"></i> LIVE`,
    L3("Ikuti", "Ihuthon", "Follow"), L3("Slide Tata Ibadah di HP Anda, huruf besar. Ketuk untuk membuka.", "Slide di HP mu.", "The Tata Ibadah slides on your phone, in large text. Tap to open."), true);
  const du = duties().filter((d) => d.date === td || d.date === tm).sort((a, b) => a.date.localeCompare(b.date));
  if (du.length) {
    const d = du[0]; const more = du.length > 1 ? ` · +${du.length - 1}` : "";
    return card(rosterHome(d.roster.group_id, d.roster.month), "Sada HKBPS · " + gname(d.group), d.date === td ? L3("Bertugas hari ini", "Marhobas sadarion", "Serving today") : L3("Besok bertugas", "Marhobas marsogot", "Serving tomorrow"),
      esc(fmt(d.date, { weekday: "short", day: "numeric", month: "short" })), d.roles.join(", ") + more,
      L3("Tugas Anda hari Minggu ini. Roster dan Tata Ibadah ada di Sada.", "Ulaonmu di ari Minggu. Roster dohot Tata Ibadah di Sada.", "Your duty this Sunday. The roster and Tata Ibadah are in Sada."));
  }
  const now = Date.now();
  const ev = (D.events || []).filter((e) => sgParts(e.starts_at).date === td && Date.parse(e.ends_at || e.starts_at) + (e.ends_at ? 0 : 2 * 3600e3) > now).sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  if (ev) return card("#/calendar", "Sada HKBPS · " + L3("Acara hari ini", "Ulaon sadarion", "Today's event"), ev.title,
    esc(fmtTime(ev.starts_at)) + (ev.ends_at ? " – " + esc(fmtTime(ev.ends_at)) : ""), fmtTime(ev.starts_at), ev.place || L3("Ketuk untuk detail", "Ketuk", "Tap for details"));
  return "";
}
try { document.head.insertAdjacentHTML("beforeend", `<style>
  .nowcard { display: block; margin: 12px 0; padding: 14px 16px 16px; border-radius: 26px; background: #121214; color: #fff; text-decoration: none; box-shadow: 0 10px 30px rgba(0, 0, 0, .25); border: 1px solid rgba(255, 255, 255, .08); }
  .nc-top { display: flex; align-items: center; gap: 12px; }
  .nc-ic { width: 44px; height: 44px; border-radius: 11px; background: #fff; display: grid; place-items: center; overflow: hidden; flex: none; }
  .nc-ic img { width: 100%; height: 100%; object-fit: cover; } .nc-ic b { font-size: 24px; }
  .nc-top small { display: block; color: rgba(255, 255, 255, .7); font-size: 13px; } .nc-top b { display: block; font-size: 18px; font-weight: 800; line-height: 1.2; }
  .nc-time { color: #4ade80; font-weight: 800; font-size: 15px; white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; }
  .nowcard.live .nc-time { color: #f87171; }
  .nc-box { display: flex; align-items: center; gap: 16px; margin-top: 12px; padding: 14px 16px; border-radius: 16px; border: 1.5px solid #3b82f6; background: #0f2233; }
  .nowcard.live .nc-box { border-color: #ef4444; background: #2a1215; }
  .nc-big { font-size: 30px; font-weight: 800; letter-spacing: .04em; line-height: 1.1; flex: none; max-width: 55%; overflow-wrap: anywhere; }
  .nc-sub { font-size: 13.5px; line-height: 1.35; color: rgba(255, 255, 255, .78); }
</style>`); } catch (e) {}

// ---------- Hymn splitter (YB 2026-10-29) ----------
// The same rules as the Tata Ibadah workbench (workbench/index.html) and hymn-split.js: one verse per slide, the Reff on its
// own slide (a short verse and a short Reff share one), at most 6 lines, "Reff:" labels only when they are real labels.
// Used by the Buku Ende page; HYMN.selfTest() runs the same checks as hymn-split.test.js (shown on App status).
const HYMN = (() => {
const MAX_LINES = 6;
const CUE_RE = /^\s*[-–(]\s*([A-Za-z][A-Za-z ]{2,24})\s*[-–)]\s*$/;                  // -Berdiri-, (Duduk), – Musik –
const REFF_RE = /^\[?\s*(?:reff?|refrein|refrain|chorus|koor)\s*(?:\.?\s*\]?\s*:|\.|\]|$)\s*/i;   // a real label only: "Reff:", "[Reff]", "Ref.", "Koor:", "Reff" alone; never a lyric that starts with the word
const NUM_RE = /^\s*(\d{1,2})\s*[.)]\s+/;                                           // 1. or 2)

// Verse numbers in the heading, after the hymn number: "KJ No. 4: 1-3", "BE 123 : 1,3,5", "KJ 33 ay. 1 - 2 & 4".
function verseCount(heading) {
  const m = String(heading || "").match(/(?:[:]|\bay(?:at)?\.?|\bbait)\s*([\d\s,&\-–]+)/i);
  if (!m) return 0;
  let n = 0;
  for (const part of m[1].split(/[,&]/).map((x) => x.trim()).filter(Boolean)) {
    const r = part.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (r) n += Math.max(0, +r[2] - +r[1] + 1); else if (/^\d+$/.test(part)) n += 1;
  }
  return n;
}

// Even pieces of at most MAX_LINES: 7 -> [4,3], 8 -> [4,4], 9 -> [5,4], 12 -> [6,6], 13 -> [5,4,4].
function balanced(lines) {
  if (lines.length <= MAX_LINES) return [lines];
  const parts = Math.ceil(lines.length / MAX_LINES); const out = []; let i = 0;
  for (let p = 0; p < parts; p++) { const size = Math.ceil((lines.length - i) / (parts - p)); out.push(lines.slice(i, i + size)); i += size; }
  return out;
}

function splitHymn(heading, rawLines, opts = {}) {
  const repeatReff = opts.repeatReff !== false;
  // 1. Read the lines: lyric lines, cues (kept for the next slide), Reff markers, verse numbers, blank lines.
  const items = []; let cue = null; let reffNext = false; let blankBefore = false;
  for (const raw of rawLines) {
    const t = String(raw || "").replace(/\s+/g, " ").trim();
    if (!t) { blankBefore = true; continue; }
    const c = t.match(CUE_RE);
    if (c && !REFF_RE.test(t)) { cue = c[1].trim(); blankBefore = true; continue; }
    let text = t, reff = false, num = null;
    if (REFF_RE.test(t)) { reff = true; text = t.replace(REFF_RE, "").trim(); if (!text) { reffNext = true; continue; } }
    if (reffNext) { reff = true; reffNext = false; }
    const nm = text.match(NUM_RE); if (nm) { num = +nm[1]; text = text.replace(NUM_RE, ""); }
    items.push({ text, reffStart: reff, num, cue, blankBefore }); cue = null; blankBefore = false;
  }
  const N = items.length; const V = verseCount(heading);
  const reffAt = items.map((x, i) => (x.reffStart ? i : -1)).filter((i) => i >= 0);
  let blocks = null; let how = "";

  // 2a. Blank lines or verse numbers mark the verses.
  const starts = items.map((x, i) => (i > 0 && (x.num || (x.blankBefore && !x.reffStart)) ? i : -1)).filter((i) => i > 0);
  if (!blocks && starts.length && (!V || starts.length + 1 === V || starts.length + 1 === V * 2)) {
    const cuts = [0, ...starts, N]; blocks = [];
    for (let k = 0; k < cuts.length - 1; k++) {
      const seg = items.slice(cuts[k], cuts[k + 1]); const r = seg.findIndex((x) => x.reffStart);
      if (r > 0) { blocks.push({ kind: "verse", items: seg.slice(0, r) }); blocks.push({ kind: "reff", items: seg.slice(r) }); }
      else blocks.push({ kind: seg[0].reffStart ? "reff" : "verse", items: seg });
    }
    how = "blank lines, cues or verse numbers between verses";
  }
  // 2b. A Reff after every verse: equal verse+Reff blocks, checked against every marker position.
  if (!blocks && reffAt.length >= 2) {
    const M = reffAt.length; const v = reffAt[0];
    if (N % M === 0 && v > 0) {
      const per = N / M; const k = per - v;
      if (k > 0 && reffAt.every((pos, i) => pos === v + i * per)) {
        blocks = [];
        for (let i = 0; i < M; i++) { blocks.push({ kind: "verse", items: items.slice(i * per, i * per + v) }); blocks.push({ kind: "reff", items: items.slice(i * per + v, (i + 1) * per) }); }
        how = `Reff after every verse (${M} verses of ${v} lines, Reff ${k} lines)`;
      }
    }
  }
  // 2c. One Reff printed once: the heading's verse count gives the verse length; the Reff is sung after every verse.
  if (!blocks && reffAt.length === 1 && V > 1) {
    const v = reffAt[0]; const k = N - V * v;
    if (v > 0 && k > 0) {
      const reff = items.slice(v, v + k); const verses = [items.slice(0, v), ...Array.from({ length: V - 1 }, (_, i) => items.slice(v + k + i * v, v + k + (i + 1) * v))];
      blocks = []; verses.forEach((vs, i) => { blocks.push({ kind: "verse", items: vs }); if (repeatReff || i === 0) blocks.push({ kind: "reff", items: reff, repeat: i > 0 }); });
      how = `Reff printed once, repeated after each of ${V} verses`;
    }
  }
  // 2c'. One Reff and one verse (no verse count in the heading): the verse, then the Reff.
  if (!blocks && reffAt.length === 1 && V <= 1 && reffAt[0] > 0) {
    blocks = [{ kind: "verse", items: items.slice(0, reffAt[0]) }, { kind: "reff", items: items.slice(reffAt[0]) }];
    how = "one verse and its Reff";
  }
  // 2d. The heading's verse count splits the lines evenly.
  if (!blocks && V >= 1 && N % V === 0 && !reffAt.length) {
    const v = N / V; blocks = Array.from({ length: V }, (_, i) => ({ kind: "verse", items: items.slice(i * v, (i + 1) * v) }));
    how = `heading says ${V} verse${V > 1 ? "s" : ""} of ${v} lines`;
  }
  // 2e. Cue lines between verses are the boundaries.
  if (!blocks && items.some((x, i) => i > 0 && x.cue)) {
    const cuts = [0, ...items.map((x, i) => (i > 0 && x.cue ? i : -1)).filter((i) => i > 0), N];
    blocks = []; for (let k = 0; k < cuts.length - 1; k++) blocks.push({ kind: "verse", items: items.slice(cuts[k], cuts[k + 1]) });
    how = "cue lines between verses";
  }
  // 2f. Nothing to go on: balanced slides of 4 to 6 lines.
  if (!blocks) { blocks = [{ kind: "verse", items }]; how = "no structure found: balanced slides"; }
  // A Reff printed only once (after verse 1) is sung after every verse: repeat it after each later verse.
  const reffBlocks = blocks.filter((b) => b.kind === "reff" && !b.repeat);
  if (repeatReff && reffBlocks.length === 1 && blocks.filter((b) => b.kind === "verse").length > 1) {
    const out = [];
    blocks.forEach((b, i) => { out.push(b); const next = blocks[i + 1]; if (b.kind === "verse" && i > blocks.indexOf(reffBlocks[0]) && (!next || next.kind !== "reff")) out.push({ kind: "reff", items: reffBlocks[0].items, repeat: true }); });
    blocks = out;
  }

  // 3. Slides: at most 6 lines each; the verse number, the Reff label and any cue go with the right slide.
  const slides = []; let verseNo = 0;
  for (let bi = 0; bi < blocks.length; bi++) {
    const b = blocks[bi]; const nx = blocks[bi + 1];
    if (b.kind === "verse" && nx && nx.kind === "reff" && b.items.length <= 4 && nx.items.length <= 4 && b.items.length + nx.items.length <= MAX_LINES) {
      verseNo++;
      slides.push({ kind: "verse", verse: verseNo, part: null, cue: ([...b.items, ...nx.items].find((x) => x.cue) || {}).cue || null, repeat: false,
        withReff: true, reffFrom: b.items.length, reffRepeat: !!nx.repeat, lines: [...b.items, ...nx.items].map((x) => x.text) });
      bi++; continue;
    }
    if (b.kind === "verse") verseNo++;
    const pieces = balanced(b.items);
    pieces.forEach((p, j) => slides.push({ kind: b.kind, verse: b.kind === "verse" ? verseNo : null, part: pieces.length > 1 ? `${j + 1}/${pieces.length}` : null,
      cue: (p.find((x) => x.cue) || {}).cue || null, repeat: !!b.repeat, lines: p.map((x) => x.text) }));
  }
  // 4. Checks: nothing lost, nothing doubled (except a repeated Reff), never more than 6 lines.
  const used = slides.filter((s) => !s.repeat).reduce((n, s) => n + (s.reffRepeat ? s.reffFrom : s.lines.length), 0);
  const ok = used === N && slides.every((s) => s.lines.length <= MAX_LINES && s.lines.length > 0);
  return { slides, verses: verseNo, how, ok, verseCountInHeading: V, lines: N };
}
  // The checks from hymn-split.test.js: the 7 songs of 1 November 2026 (their structure, with placeholder words) and harder cases.
  function build(shape) { const out = []; let n = 0; for (const tok of shape.match(/\[[^\]]+\]|./g)) {
    if (tok === "L") out.push(`baris ${++n}`); else if (tok === "R") out.push(`Reff: baris ${++n}`); else if (tok === "r") out.push("Reff:");
    else if (tok === "·") out.push(""); else if (tok === "N") out.push(`${out.filter((x) => /^\d+\./.test(x)).length + 1}. baris ${++n}`); else out.push(tok.slice(1, -1)); } return out; }
  const desc = (r) => r.slides.map((x) => `${x.kind === "reff" ? "R" : "V" + x.verse}${x.part ? "(" + x.part + ")" : ""}:${x.withReff ? x.reffFrom + "+R" + (x.lines.length - x.reffFrom) : x.lines.length}${x.cue ? "[" + x.cue + "]" : ""}`).join(" ");
  const CASES = [
    ["KJ. NO 4: 1-3", "LLLLLLLL[-Berdiri-]LLLL", "V1:4 V2:4 V3:4[Berdiri]"], ["KJ No 457: 1-2", "LLRLLLRL", "V1:2+R2 V2:2+R2"],
    ["KJ No. 33: 1-2", "LLRL[-Berdiri-]LLRL", "V1:2+R2 V2:2+R2[Berdiri]"], ["KJ No. 375: 1", "LLL", "V1:3"],
    ["KJ No. 407: 1-2", "LLLL[-Berdiri-]LLLL", "V1:4 V2:4[Berdiri]"], ["KJ No. 376: 1-3", "LLrLLLLrLL[-Musik-]LLrLL", "V1:2+R2 V2:2+R2 V3:2+R2[Musik]"],
    ["KJ NO 370: 1-3", "LLLRLLLLLRLL[-Musik-]LLLRLL", "V1:3+R3 V2:3+R3 V3:3+R3[Musik]"], ["BE No. 12: 1-3", "LLLLLLLLLLLLLLLLLLLLLLLL", "V1(1/2):4 V1(2/2):4 V2(1/2):4 V2(2/2):4 V3(1/2):4 V3(2/2):4"],
    ["BE No. 210: 1-3", "LLLL·rLLLL·LLLL·LLLL", "V1:4 R:4 V2:4 R:4 V3:4 R:4"], ["BE No. 12: 1-2", "LLLLLRLLLLLLLRLL", "V1:5 R:3 V2:5 R:3"],
    ["BE No. 31: 1-2", "LLLLRLLLLLRL", "V1:4+R2 V2:4+R2"], ["BE No. 5", "NLLLNLLLNLLL", "V1:4 V2:4 V3:4"],
    ["KJ No. 99: 1-2", "LLLLLLLLLLLL", "V1:6 V2:6"], ["BE No. 77: 1,3,5", "LLLLLLLLLLLLLLL", "V1:5 V2:5 V3:5"],
    ["Lagu Persembahan", "LLLLLLLLLL", "V1(1/2):5 V1(2/2):5"], ["KJ No. 4: 1-3", "LLLLLL[-Berdiri-]LLLLLL", "V1:4 V2:4[Berdiri] V3:4"],
  ];
  function selfTest() {
    const fails = [];
    CASES.forEach(([h, shape, want]) => { const r = splitHymn(h, build(shape)); const got = desc(r); if (!r.ok || got !== want) fails.push(`${h}: ${got} (expected ${want})`); });
    const kw = splitHymn("BE No. 40: 1", ["Refrein hati kami", "Koor gereja bernyanyi", "baris 3", "baris 4"]);
    if (kw.slides[0].lines[0] !== "Refrein hati kami" || kw.slides[0].lines[1] !== "Koor gereja bernyanyi") fails.push("a lyric starting with Refrein/Koor was cut");
    const rf = splitHymn("KJ No. 2: 1-2", ["a", "b", "Refrein:", "c", "d", "e", "f", "Refrein:", "g", "h"]);
    if (!rf.slides.every((x) => x.withReff)) fails.push('"Refrein:" was not read as a Reff label');
    return { total: CASES.length + 2, pass: CASES.length + 2 - fails.length, fails };
  }
  // A song as text for Claude: verses separated by a blank line, the Reff marked, a repeated Reff sent only once.
  function asText(title, text) {
    const r = splitHymn(title, String(text || "").split(/\r?\n/)); if (!r.ok) return text;
    return r.slides.filter((x) => !x.repeat).map((x) => x.withReff ? [...x.lines.slice(0, x.reffFrom), ...(x.reffRepeat ? [] : ["Reff:", ...x.lines.slice(x.reffFrom)])].join("\n") : (x.kind === "reff" ? "Reff:\n" : "") + x.lines.join("\n")).join("\n\n");
  }
  return { splitHymn, verseCount, selfTest, asText };
})();


// ---------- Hymn structure (YB 2026-10-29) ----------
// The same rules the Tata Ibadah workbench uses to cut songs into slides (also in hymn-split.js with its tests):
// verses from blank lines, verse numbers, "Reff" markers after every verse, the heading's verse count ("KJ No. 4: 1-3"),
// or cues (-Berdiri-, -Musik-); the Reff kept as its own part. Sada uses it to read songs from a Tata Ibadah (Buku Ende page).
const HS_MAX = 6;
const HS_CUE = /^\s*[-–(]\s*([A-Za-z][A-Za-z ]{2,24})\s*[-–)]\s*$/;                  // -Berdiri-, (Duduk), – Musik –
const HS_REFF = /^\s*(?:reff?|refrein|refrain|chorus|koor)\s*(?:[:.]\s*|$)/i;   // "Reff:", "Ref.", "Refrein:", "Reff" alone; not a lyric that starts with "Ref…"               // Reff:, Ref., Refrein, Koor:
const HS_NUM = /^\s*(\d{1,2})\s*[.)]\s+/;                                           // 1. or 2)

// Verse numbers in the heading, after the hymn number: "KJ No. 4: 1-3", "BE 123 : 1,3,5", "KJ 33 ay. 1 - 2 & 4".
function hsVerseCount(heading) {
  const m = String(heading || "").match(/(?:[:]|\bay(?:at)?\.?|\bbait)\s*([\d\s,&\-–]+)/i);
  if (!m) return 0;
  let n = 0;
  for (const part of m[1].split(/[,&]/).map((x) => x.trim()).filter(Boolean)) {
    const r = part.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (r) n += Math.max(0, +r[2] - +r[1] + 1); else if (/^\d+$/.test(part)) n += 1;
  }
  return n;
}

// Even pieces of at most HS_MAX: 7 -> [4,3], 8 -> [4,4], 9 -> [5,4], 12 -> [6,6], 13 -> [5,4,4].
function hsBalanced(lines) {
  if (lines.length <= HS_MAX) return [lines];
  const parts = Math.ceil(lines.length / HS_MAX); const out = []; let i = 0;
  for (let p = 0; p < parts; p++) { const size = Math.ceil((lines.length - i) / (parts - p)); out.push(lines.slice(i, i + size)); i += size; }
  return out;
}

function hymnSplit(heading, rawLines, opts = {}) {
  const repeatReff = opts.repeatReff !== false;
  // 1. Read the lines: lyric lines, cues (kept for the next slide), Reff markers, verse numbers, blank lines.
  const items = []; let cue = null; let reffNext = false; let blankBefore = false;
  for (const raw of rawLines) {
    const t = String(raw || "").replace(/\s+/g, " ").trim();
    if (!t) { blankBefore = true; continue; }
    const c = t.match(HS_CUE);
    if (c && !HS_REFF.test(t)) { cue = c[1].trim(); blankBefore = true; continue; }
    let text = t, reff = false, num = null;
    if (HS_REFF.test(t)) { reff = true; text = t.replace(HS_REFF, "").trim(); if (!text) { reffNext = true; continue; } }
    if (reffNext) { reff = true; reffNext = false; }
    const nm = text.match(HS_NUM); if (nm) { num = +nm[1]; text = text.replace(HS_NUM, ""); }
    items.push({ text, reffStart: reff, num, cue, blankBefore }); cue = null; blankBefore = false;
  }
  const N = items.length; const V = hsVerseCount(heading);
  const reffAt = items.map((x, i) => (x.reffStart ? i : -1)).filter((i) => i >= 0);
  let blocks = null; let how = "";

  // 2a. Blank lines or verse numbers mark the verses.
  const starts = items.map((x, i) => (i > 0 && (x.num || (x.blankBefore && !x.reffStart)) ? i : -1)).filter((i) => i > 0);
  if (!blocks && starts.length && (!V || starts.length + 1 === V || starts.length + 1 === V * 2)) {
    const cuts = [0, ...starts, N]; blocks = [];
    for (let k = 0; k < cuts.length - 1; k++) {
      const seg = items.slice(cuts[k], cuts[k + 1]); const r = seg.findIndex((x) => x.reffStart);
      if (r > 0) { blocks.push({ kind: "verse", items: seg.slice(0, r) }); blocks.push({ kind: "reff", items: seg.slice(r) }); }
      else blocks.push({ kind: seg[0].reffStart ? "reff" : "verse", items: seg });
    }
    how = "blank lines, cues or verse numbers between verses";
  }
  // 2b. A Reff after every verse: equal verse+Reff blocks, checked against every marker position.
  if (!blocks && reffAt.length >= 2) {
    const M = reffAt.length; const v = reffAt[0];
    if (N % M === 0 && v > 0) {
      const per = N / M; const k = per - v;
      if (k > 0 && reffAt.every((pos, i) => pos === v + i * per)) {
        blocks = [];
        for (let i = 0; i < M; i++) { blocks.push({ kind: "verse", items: items.slice(i * per, i * per + v) }); blocks.push({ kind: "reff", items: items.slice(i * per + v, (i + 1) * per) }); }
        how = `Reff after every verse (${M} verses of ${v} lines, Reff ${k} lines)`;
      }
    }
  }
  // 2c. One Reff printed once: the heading's verse count gives the verse length; the Reff is sung after every verse.
  if (!blocks && reffAt.length === 1 && V > 1) {
    const v = reffAt[0]; const k = N - V * v;
    if (v > 0 && k > 0) {
      const reff = items.slice(v, v + k); const verses = [items.slice(0, v), ...Array.from({ length: V - 1 }, (_, i) => items.slice(v + k + i * v, v + k + (i + 1) * v))];
      blocks = []; verses.forEach((vs, i) => { blocks.push({ kind: "verse", items: vs }); if (repeatReff || i === 0) blocks.push({ kind: "reff", items: reff, repeat: i > 0 }); });
      how = `Reff printed once, repeated after each of ${V} verses`;
    }
  }
  // 2c'. One Reff and one verse (no verse count in the heading): the verse, then the Reff.
  if (!blocks && reffAt.length === 1 && V <= 1 && reffAt[0] > 0) {
    blocks = [{ kind: "verse", items: items.slice(0, reffAt[0]) }, { kind: "reff", items: items.slice(reffAt[0]) }];
    how = "one verse and its Reff";
  }
  // 2d. The heading's verse count splits the lines evenly.
  if (!blocks && V >= 1 && N % V === 0 && !reffAt.length) {
    const v = N / V; blocks = Array.from({ length: V }, (_, i) => ({ kind: "verse", items: items.slice(i * v, (i + 1) * v) }));
    how = `heading says ${V} verse${V > 1 ? "s" : ""} of ${v} lines`;
  }
  // 2e. Cue lines between verses are the boundaries.
  if (!blocks && items.some((x, i) => i > 0 && x.cue)) {
    const cuts = [0, ...items.map((x, i) => (i > 0 && x.cue ? i : -1)).filter((i) => i > 0), N];
    blocks = []; for (let k = 0; k < cuts.length - 1; k++) blocks.push({ kind: "verse", items: items.slice(cuts[k], cuts[k + 1]) });
    how = "cue lines between verses";
  }
  // 2f. Nothing to go on: balanced slides of 4 to 6 lines.
  if (!blocks) { blocks = [{ kind: "verse", items }]; how = "no structure found: balanced slides"; }
  // A Reff printed only once (after verse 1) is sung after every verse: repeat it after each later verse.
  const reffBlocks = blocks.filter((b) => b.kind === "reff" && !b.repeat);
  if (repeatReff && reffBlocks.length === 1 && blocks.filter((b) => b.kind === "verse").length > 1) {
    const out = [];
    blocks.forEach((b, i) => { out.push(b); const next = blocks[i + 1]; if (b.kind === "verse" && i > blocks.indexOf(reffBlocks[0]) && (!next || next.kind !== "reff")) out.push({ kind: "reff", items: reffBlocks[0].items, repeat: true }); });
    blocks = out;
  }

  // 3. Slides: at most 6 lines each; the verse number, the Reff label and any cue go with the right slide.
  const slides = []; let verseNo = 0;
  for (const b of blocks) {
    if (b.kind === "verse") verseNo++;
    const pieces = hsBalanced(b.items);
    pieces.forEach((p, j) => slides.push({ kind: b.kind, verse: b.kind === "verse" ? verseNo : null, part: pieces.length > 1 ? `${j + 1}/${pieces.length}` : null,
      cue: (p.find((x) => x.cue) || {}).cue || null, repeat: !!b.repeat, lines: p.map((x) => x.text) }));
  }
  // 4. Checks: nothing lost, nothing doubled (except a repeated Reff), never more than 6 lines.
  const used = slides.filter((s) => !s.repeat).reduce((n, s) => n + s.lines.length, 0);
  const ok = used === N && slides.every((s) => s.lines.length <= HS_MAX && s.lines.length > 0);
  return { slides, verses: verseNo, how, ok, verseCountInHeading: V, lines: N };
}


// ---------- Community features (YB 2026-10-29) ----------
// Partuturan helper, Buku Ende line by line, Turi-turian stories, Pelaut voyage mode, live Tata Ibadah follow-along,
// Dukacita support, pastoral care nudge (opt-in), and Claude-made roster drafts and discussion questions.

// Claude jobs run on the server with the church's key: queue one, then wait for the answer.
async function aiRun(task, input, onWait) {
  let r = await api.save("ai", { task, input });
  const until = Date.now() + 120e3;
  while (r && r.status === "queued" && Date.now() < until) { if (onWait) onWait(); await new Promise((ok) => setTimeout(ok, 2500)); r = await api.save("ai_get", { job_id: r.id }); }
  if (!r || r.status !== "done") throw new Error(r && r.error === "no_claude_key" ? L3("Kunci Claude gereja belum disimpan (Admin: More → Renungan Harian → kunci Claude di server).", "Kunci Claude dang disimpan.", "The church's Claude key is not saved yet (admin: More → Daily Bread setup → Claude key on the server).") : L3("Claude belum bisa menjawab, coba lagi.", "Coba muse.", "Claude could not answer, please try again."));
  return r.result || {};
}
const busySheet = (title, text) => sheet(title, `<div class="center pad">${skel(3)}<p class="muted small">${esc(text)}</p></div>`);

// More: one place for the community features.
function communityMenu() {
  if (isGuest()) return "";
  const elder = D.me.is_admin || "parhalado" in (D.me.groups || {});
  const it = (href, icon, title, sub) => `<a class="li" href="${href}">${ic(icon)}<span class="grow"><b>${title}</b><small>${esc(sub)}</small></span>${ic("chev", "chev")}</a>`;
  return it("#/fx", "coins", "💱 " + esc(L3("Kurs", "Kurs", "Exchange rates")), L3("Konversi mata uang, kurs terbaru", "Kurs hepeng", "Currency converter, latest rates"))
    + it("#/tutur", "people", "🤝 Partuturan", L3("Cara saling menyapa menurut Dalihan Na Tolu", "Partuturan Dalihan Na Tolu", "How to address each other (Dalihan Na Tolu)"))
    + it("#/ende", "book", "🎵 Buku Ende", L3("Arti setiap baris lagu", "Lapatan ni ende", "The meaning of every hymn line"))
    + it("#/stories", "mic", "🎙️ Turi-turian", L3("Cerita orang tua, direkam untuk generasi muda", "Turi-turian ni natua-tua", "Elders' stories, recorded for the young"))
    + it("#/voyage", "globe", "🚢 Pelaut", L3("Mode berlayar dan paket offline", "Mode marlayar", "Voyage mode and offline pack"))
    + it("#/grief", "heart", "🕊️ Dukacita", L3("Dukung keluarga yang berduka", "Apuli na marsak", "Support a grieving family"))
    + (elder ? it("#/care", "bell", "🫶 " + esc(L3("Perlu dikunjungi", "Ingkon dikunjungi", "Time for a visit")), L3("Jemaat yang lama tidak hadir (hanya sintua)", "Ruas na leleng so ro", "Members not seen for a while (elders only)")) : "")
    + `<label class="li care-opt"><input type="checkbox" data-act="careOptin" ${D.care_optin ? "checked" : ""}><span class="grow"><b>${esc(L3("Sintua boleh menghubungi saya", "Sintua boi manghubungi au", "Elders may check on me"))}</b><small>${esc(L3("Jika saya lama tidak hadir atau membuka aplikasi", "Molo leleng ndang ro", "If I haven't been at church or in the app for a while"))}</small></span></label>`;
}
A.careOptin = async (d, el) => { const on = el.checked; try { await api.save("care_optin", { on }); D.care_optin = on; toast(on ? L3("Terima kasih. Sintua akan menyapa bila Anda lama tidak hadir.", "Mauliate.", "Thank you. The elders will check on you if you're away a while.") : t("saved")); } catch (e) { el.checked = !on; toast(errMsg(e), true); } };

// 1. Partuturan: how two people address each other (a general guide following Dalihan Na Tolu).
R.tutur = () => {
  const mg = (n, v) => `<input name="${n}" list="margaList" autocomplete="off" placeholder="Simanjuntak, Hutabarat…" value="${esc(v || "")}">`;
  const MARGA = ["Simanjuntak", "Hutabarat", "Sihombing", "Panjaitan", "Siburian", "Gultom", "Hutasoit", "Manik", "Tobing", "Lumbantobing", "Nainggolan", "Silitonga", "Sianturi", "Butarbutar", "Pasaribu", "Situmorang", "Lubis", "Purba", "Limbong", "Sirait", "Sitompul", "Siregar", "Simatupang", "Napitupulu", "Pardede", "Marpaung", "Silalahi", "Sinaga", "Simbolon", "Sitorus", "Tampubolon", "Hutagalung", "Hutapea", "Siahaan", "Manurung", "Panggabean", "Bangun", "Matondang"];
  const me = (D.me.name || "").split(" ").slice(-1)[0];
  return shell("#/more", `<h2 class="page-h">🤝 Partuturan</h2><p class="lead">${esc(L3("Masukkan marga Anda dan marga orang itu (serta boru ibu kalian). Sada memberi panggilan yang lazim menurut Dalihan Na Tolu.", "Bahen marga mu dohot marga ni ibana.", "Enter your marga and theirs (and your mothers' boru). Sada suggests the usual term of address under Dalihan Na Tolu."))}</p>
    <datalist id="margaList">${MARGA.map((x) => `<option value="${x}">`).join("")}</datalist>
    <form class="card form" data-form="tutur">
      <div class="row2"><label>${esc(L3("Saya", "Ahu", "Me"))}<select name="g1"><option value="m">${esc(L3("Laki-laki", "Baoa", "Male"))}</option><option value="f">${esc(L3("Perempuan", "Boru-boru", "Female"))}</option></select></label>
        <label>${esc(L3("Dia", "Ibana", "Them"))}<select name="g2"><option value="m">${esc(L3("Laki-laki", "Baoa", "Male"))}</option><option value="f">${esc(L3("Perempuan", "Boru-boru", "Female"))}</option></select></label></div>
      <div class="row2"><label>${esc(L3("Marga saya", "Margangku", "My marga"))}${mg("m1", (D.me.name || "").trim().split(/\s+/).length > 1 ? me : "")}</label><label>${esc(L3("Marga dia / boru dia", "Marga / boru ni ibana", "Their marga / boru"))}${mg("m2")}</label></div>
      <div class="row2"><label>${esc(L3("Boru ibu saya", "Boru ni inang", "My mother's boru"))}${mg("b1")}</label><label>${esc(L3("Boru ibu dia", "Boru ni inangna", "Their mother's boru"))}${mg("b2")}</label></div>
      <label>${esc(L3("Generasi dia dibanding saya", "Generasi", "Their generation"))}<select name="gen"><option value="up">${esc(L3("Satu generasi di atas (seperti orang tua)", "Di ginjang", "One above (like a parent)"))}</option><option value="same" selected>${esc(L3("Sebaya", "Sapangkat", "Same generation"))}</option><option value="down">${esc(L3("Satu generasi di bawah (seperti anak)", "Di toru", "One below (like a child)"))}</option></select></label>
      <label>${esc(L3("Lebih tua? (generasi di atas: dibanding ayah/ibu Anda di garis itu · sebaya: dibanding Anda)", "Umbalga? (di ginjang: sian ama/inang · sapangkat: sian ho)", "Older? (generation above: than your father/mother on that side · same generation: than you)"))}<select name="old"><option value="y">${esc(L3("Ya, lebih tua", "Olo", "Yes, older"))}</option><option value="n">${esc(L3("Tidak, lebih muda", "Ndang", "No, younger"))}</option><option value="u">${esc(L3("Tidak tahu", "Ndang huboto", "Not sure"))}</option></select></label>
      <button class="btn primary block">${esc(L3("Lihat panggilan", "Ida", "Show the term"))}</button></form>
    <div id="tuturRes"></div>`, { back: "#/more", title: "Partuturan" });
};
function tuturTerm(i) {
  // Dalihan Na Tolu, general rules (ego = "saya"). "old": y/n/u; for the generation above it compares with the parent on that side.
  const n = (x) => norm(x || "").replace(/^lumban\s*/, "").replace(/\s+/g, "");
  const same = (a, b) => !!n(a) && !!n(b) && n(a) === n(b);
  const M = i.g1 === "m", Mt = i.g2 === "m", o = i.old;
  const pick = (older, younger, both) => (o === "y" ? older : o === "n" ? younger : both);
  const T = (term, id, en) => [term, L3(id, "", en)];
  if (same(i.m1, i.m2)) { // dongan tubu: the same marga
    if (i.gen === "up") return Mt ? T(pick("Amangtua", "Amanguda", "Amangtua / Amanguda"), "Laki-laki semarga, satu generasi di atas: amangtua bila lebih tua dari ayah Anda, amanguda bila lebih muda.", "A man of your marga one generation up: amangtua if older than your father, amanguda if younger.")
      : T("Namboru", "Perempuan semarga, satu generasi di atas (seperti saudari ayah).", "A woman of your marga one generation up (like your father's sister).");
    if (i.gen === "down") return Mt ? T("Amang", "Laki-laki semarga, satu generasi di bawah (seperti anak Anda).", "A man of your marga one generation down (like your son).")
      : T("Inang", "Perempuan semarga, satu generasi di bawah (seperti putri Anda).", "A woman of your marga one generation down (like your daughter).");
    if (M !== Mt) return T("Ito", "Laki-laki dan perempuan semarga saling memanggil ito (dan tidak boleh menikah).", "A man and a woman of the same marga call each other ito (and may not marry).");
    return T(pick("Angkang", "Anggi", "Angkang / Anggi"), M ? "Sesama laki-laki semarga (dongan tubu): angkang bila lebih tua, anggi bila lebih muda." : "Sesama perempuan semarga: angkang bila lebih tua, anggi bila lebih muda.",
      M ? "Men of the same marga (dongan tubu): angkang if older, anggi if younger." : "Women of the same marga: angkang if older, anggi if younger.");
  }
  if (same(i.m2, i.b1)) { // their marga is my mother's marga: the hula-hula (tulang) side
    if (i.gen === "up") return Mt ? T("Tulang", "Laki-laki dari marga ibu Anda, satu generasi di atas (seperti saudara ibu).", "A man of your mother's marga one generation up (like your mother's brother).")
      : T(pick("Inangtua", "Inanguda", "Inanguda / Inangtua"), "Perempuan dari marga ibu Anda, satu generasi di atas (seperti saudari ibu): inangtua bila lebih tua dari ibu Anda, inanguda bila lebih muda. (Nantulang adalah istri tulang, yang bermarga lain.)",
        "A woman of your mother's marga one generation up (like your mother's sister): inangtua if older than your mother, inanguda if younger. (Nantulang is the tulang's wife, of another marga.)");
    if (i.gen === "down") return Mt ? T("Tulang", "Laki-laki dari marga ibu Anda tetap dihormati sebagai tulang, walau lebih muda.", "A man of your mother's marga is still honoured as tulang, even when younger.")
      : T("Inang", "Perempuan dari marga ibu Anda, satu generasi di bawah.", "A woman of your mother's marga one generation down.");
    if (M && Mt) return T("Lae", "Putra tulang (marga ibu Anda), sebaya: lae.", "Your tulang's son (your mother's marga), same generation: lae.");
    if (M && !Mt) return T("Pariban", "Putri tulang (marga ibu Anda), sebaya: pariban, boleh dinikahi menurut adat.", "Your tulang's daughter (your mother's marga), same generation: pariban, marriageable by custom.");
    if (!M && Mt) return T("Ito", "Bagi perempuan, putra tulang dipanggil ito.", "For a woman, her tulang's son is ito.");
    return T("Pariban", "Sesama perempuan, putri tulang dan putri namboru saling memanggil pariban.", "Between women, the tulang's daughter and the namboru's daughter call each other pariban.");
  }
  if (same(i.m1, i.b2)) { // my marga is their mother's marga: I am on their hula-hula side, they are the boru side
    if (i.gen === "down") return T("Bere", "Anak dari perempuan semarga Anda (anak ito atau namboru generasi berikut): bere.", "The child of a woman of your marga: bere.");
    if (i.gen === "up") return Mt ? T("Amangboru", "Laki-laki satu generasi di atas yang ibunya semarga Anda: dari pihak boru, dipanggil amangboru.", "A man one generation up whose mother is of your marga: the boru side, amangboru.")
      : T("Namboru", "Perempuan satu generasi di atas yang ibunya semarga Anda: dipanggil namboru.", "A woman one generation up whose mother is of your marga: namboru.");
    if (M && Mt) return T("Lae", "Putra namboru (ibunya semarga Anda), sebaya: lae.", "Your namboru's son (his mother is of your marga), same generation: lae.");
    if (M && !Mt) return T("Ito", "Putri namboru, sebaya: ito (bukan pariban bagi laki-laki).", "Your namboru's daughter, same generation: ito (not pariban for a man).");
    if (!M && Mt) return T("Pariban", "Bagi perempuan, putra namboru adalah pariban.", "For a woman, her namboru's son is her pariban.");
    return T("Pariban", "Sesama perempuan, putri namboru dan putri tulang saling memanggil pariban.", "Between women, the namboru's daughter and the tulang's daughter call each other pariban.");
  }
  if (same(i.b1, i.b2)) // our mothers are of the same marga: like children of sisters
    return T(M === Mt ? pick("Angkang", "Anggi", "Angkang / Anggi") : "Ito", "Ibu kalian semarga (seperti anak dua bersaudari): dianggap saudara sendiri.", "Your mothers are of the same marga (like children of two sisters): treated as siblings.");
  return T(i.gen === "up" ? (Mt ? "Amang" : "Inang") : i.gen === "down" ? (Mt ? "Amang" : "Inang") : M === Mt ? (M ? "Lae" : "Eda") : "Ito",
    "Marga kalian tidak langsung berhubungan di sini: ini panggilan umum yang sopan. Martarombo (telusuri silsilah) untuk panggilan yang tepat.", "Your margas aren't directly linked here: this is the polite general term. Trace the tarombo for the exact one.");
}

F.tutur = async (f) => {
  const i = { g1: f.g1.value, g2: f.g2.value, m1: f.m1.value, m2: f.m2.value, b1: f.b1.value, b2: f.b2.value, gen: f.gen.value, old: f.old.value };
  const [term, why] = tuturTerm(i);
  document.getElementById("tuturRes").innerHTML = `<article class="card tutur-res"><p class="small muted">${esc(L3("Panggil dia", "Dok ma ibana", "Call them"))}</p><h2>${esc(term)}</h2><p>${esc(why)}</p>
    <p class="small muted">${esc(L3("Panduan umum. Adat bisa berbeda per keluarga dan daerah; tanyakan orang tua atau sintua bila ragu.", "Tanya natua-tua.", "A general guide. Custom can differ by family and region; ask your parents or an elder if unsure."))}</p></article>`;
  throw Object.assign(new Error("noRender"), { silent: true });
};

// 2. Buku Ende line by line: a hymn from Sunday's Tata Ibadah (or pasted), with the meaning of each line in Bahasa and English.
R.ende = () => {
  const v = (D.services || []).find((x) => x.service_date === nextSunday()) || (D.services || [])[0];
  setTimeout(async () => {
    const box = document.getElementById("endeSongs"); if (!box) return;
    if (!v) { box.innerHTML = ""; return; }
    try {
      const doc = new DOMParser().parseFromString(await tataHtml(v.id), "text/html");
      const songs = endeSongs(doc);
      ENDE.songs = songs;
      box.innerHTML = songs.length ? `<h3 class="sec-h">${esc(L3("Lagu Minggu ini", "Ende Minggu on", "This Sunday's hymns"))}</h3><div class="card">${songs.map((x, k) => `<button class="li" data-act="endeOpen" data-k="${k}"><span class="grow"><b>${esc(x.title)}</b><small>${esc(x.text.split("\n")[0].slice(0, 60))}</small></span>${ic("chev", "chev")}</button>`).join("")}</div>` : "";
    } catch (e) { box.innerHTML = ""; }
  }, 0);
  return shell("#/more", `<h2 class="page-h">🎵 Buku Ende</h2><p class="lead">${esc(L3("Arti setiap baris lagu dalam Bahasa Indonesia dan Inggris, supaya semua bisa bernyanyi sambil mengerti.", "Lapatan ni ganup baris ni ende.", "The meaning of every line in Bahasa Indonesia and English, so everyone can sing and understand."))}</p>
    <div id="endeSongs">${skel(2)}</div>
    <form class="card form" data-form="ende"><label>${esc(L3("Atau tempel teks lagu", "Manang tempel ende", "Or paste a hymn"))}<textarea name="text" rows="6" placeholder="${esc(L3("Tempel bait-bait lagu di sini…", "Tempel…", "Paste the verses here…"))}"></textarea></label><button class="btn primary block">✨ ${esc(L3("Arti per baris", "Lapatan", "Meaning line by line"))}</button></form>
    <div id="endeRes"></div>`, { back: "#/more", title: "Buku Ende" });
};
const ENDE = { songs: [] };
const HYMN_HEAD_RE = /\b(BE|B\.\s*E|BUKU\s*ENDE|KJ|PKJ|NKB|BN|KLB)\b/i;
// Songs in a published Tata Ibadah, as text with verse breaks and "Reff:" (the Reff once), for the line-by-line meanings.
function endeSongs(doc) {
  const out = []; const byKey = {};
  // new workbench format: one page per verse (or Reff), all pages of a song share the same heading
  doc.querySelectorAll("section.pg.vr").forEach((sec) => {
    const eyEl = sec.querySelector("header .ey"); const eyC = eyEl ? eyEl.cloneNode(true) : null; if (eyC) eyC.querySelectorAll(".chip").forEach((c) => c.remove());
    const ey = ((eyC || {}).textContent || "").replace(/\s+/g, " ").trim(); const name = ((sec.querySelector("header h2") || {}).textContent || "").trim();
    if (!HYMN_HEAD_RE.test(ey) || !sec.querySelector(".ly")) return;
    const key = ey + "|" + name; let song = byKey[key];
    if (!song) { song = byKey[key] = { title: [ey.replace(/^[^·]*·\s*/, ""), name].filter(Boolean).join(" · "), verses: [], reffs: [] }; out.push(song); }
    const isReffPage = /reff/i.test(((sec.querySelector(".vn") || {}).textContent || ""));
    const vLines = [], rLines = [];
    sec.querySelectorAll(".ly p").forEach((p) => (isReffPage || p.classList.contains("ref") ? rLines : vLines).push(p.textContent.trim()));
    if (vLines.length) song.verses.push(vLines);
    const r = rLines.join("\n"); if (r && !song.reffs.includes(r)) song.reffs.push(r);
  });
  out.forEach((x) => { x.text = x.verses.map((v, i) => v.join("\n") + (i === 0 && x.reffs.length ? "\n\nReff:\n" + x.reffs.join("\n\n") : "")).join("\n\n"); });
  // older format: a whole song on one page, heading first; split it with the hymn rules
  doc.querySelectorAll("section.pg").forEach((sec) => {
    const h = ((sec.querySelector("h1") || {}).textContent || "").trim(); const th = sec.querySelector(".th");
    if (sec.classList.contains("vr") || !HYMN_HEAD_RE.test(h) || !th) return;
    const lines = th.innerHTML.split(/<br\s*\/?>/i).map((x) => { const t0 = doc.createElement("div"); t0.innerHTML = x; return t0.textContent.trim(); }).filter(Boolean);
    const r = hymnSplit(h.replace(/[“"”].*$/, ""), lines); const seen = new Set();
    const text = r.slides.filter((sl) => sl.kind === "verse" || !seen.has(sl.lines.join("|")) && seen.add(sl.lines.join("|"))).map((sl) => (sl.kind === "reff" ? "Reff:\n" : "") + sl.lines.join("\n")).join("\n\n");
    out.push({ title: h, text });
  });
  return out.filter((x) => x.text && x.text.trim());
}
async function endeShow(title, text) {
  const el = document.getElementById("endeRes"); if (!el) return;
  el.innerHTML = `<div class="card center pad">${skel(3)}<p class="small muted">${esc(L3("Claude sedang menuliskan artinya…", "Claude manurat…", "Claude is writing the meanings…"))}</p></div>`; el.scrollIntoView({ behavior: "smooth", block: "start" });
  try {
    const r = await aiRun("meaning", { title, text: HYMN.asText(title, text.trim()) });
    el.innerHTML = `<article class="card ende-res"><h3>${esc(title || "Buku Ende")}</h3>${(r.lines || []).map((x) => x.sep ? `<hr>` : `<div class="ende-l${x.ref ? " ref" : ""}"><b>${esc(x.bt || "")}</b><span>🇮🇩 ${esc(x.id || "")}</span><span>🇬🇧 ${esc(x.en || "")}</span></div>`).join("")}
      <p class="small muted">${esc(L3("Arti dibuat oleh Claude untuk membantu memahami; bukan terjemahan resmi.", "Sian Claude.", "Meanings written by Claude to help understanding; not an official translation."))}</p></article>`;
  } catch (e) { el.innerHTML = `<p class="warn">${esc(e.message)}</p>`; }
}
A.endeOpen = (d) => { const x = ENDE.songs[+d.k]; if (x) endeShow(x.title, x.text); };
F.ende = async (f) => { const text = f.text.value.trim(); if (!text) return; endeShow("", text); throw Object.assign(new Error("noRender"), { silent: true }); };

// 3. Turi-turian: record (or upload) a short audio story from a parent or elder.
const REC = { rec: null, chunks: [], t0: 0, timer: null, blob: null, mime: "" };
R.stories = () => {
  const list = D.stories || [];
  return shell("#/more", `<h2 class="page-h">🎙️ Turi-turian</h2><p class="lead">${esc(L3("Rekam cerita orang tua dan para tetua: merantau, kampung halaman, iman. Disimpan untuk generasi muda HKBP Singapore.", "Turi-turian ni natua-tua.", "Record stories from parents and elders: migration, the kampung, faith. Kept for HKBP Singapore's young people."))}</p>
    <article class="card rec-card"><div class="rec-row"><button class="rec-btn" data-act="recToggle" aria-label="${esc(L3("Rekam", "Rekam", "Record"))}"><i></i></button><div class="grow"><b id="recState">${esc(L3("Ketuk untuk merekam (maks. 5 menit)", "Ketuk asa marekam", "Tap to record (up to 5 minutes)"))}</b><small id="recTime" class="muted">0:00</small></div></div>
      <div id="recPrev"></div>
      <form class="form" data-form="story" id="recForm" hidden><label>${esc(L3("Judul cerita", "Goar ni turi-turian", "Story title"))}<input name="title" required maxlength="120"></label><label>${esc(L3("Siapa yang bercerita", "Ise na marturi", "Who is telling it"))}<input name="speaker" maxlength="80" placeholder="Ompung, Amang, Inang…"></label><label>${esc(t("f_note"))}<input name="note" maxlength="200"></label><button class="btn primary block">${ic("upload")} ${esc(L3("Simpan cerita", "Simpan", "Save story"))}</button></form>
      <label class="btn sm ghost upl">${ic("upload")} ${esc(L3("atau pilih file audio", "manang file audio", "or choose an audio file"))}<input type="file" accept="audio/*" data-act-change="storyFile" hidden></label></article>
    ${list.length ? `<div class="card">${list.map((x) => `<div class="li story"><button class="icon-btn" data-act="storyPlay" data-id="${x.id}" aria-label="Play">▶</button><span class="grow"><b>${esc(x.title)}</b><small>${esc([x.speaker, x.by, x.seconds ? Math.floor(x.seconds / 60) + ":" + String(x.seconds % 60).padStart(2, "0") : "", fmt(x.at, { day: "numeric", month: "short" })].filter(Boolean).join(" · "))}</small><span class="story-audio" id="sa${x.id}"></span></span>${x.mine || D.me.is_admin ? `<button class="icon-btn danger" data-act="del" data-kind="story" data-id="${x.id}" aria-label="${esc(t("delete"))}">${ic("trash")}</button>` : ""}</div>`).join("")}</div>` : empty(L3("Belum ada cerita. Jadilah yang pertama merekam!", "Dang adong.", "No stories yet. Be the first to record one!"), "mic")}`,
    { back: "#/more", title: "Turi-turian" });
};
A.recToggle = async (d, btn) => {
  if (REC.rec && REC.rec.state === "recording") { REC.rec.stop(); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((x) => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(x)) || "";
    REC.rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 48000 } : undefined); REC.chunks = []; REC.mime = REC.rec.mimeType || mime || "audio/mp4";
    REC.rec.ondataavailable = (e) => { if (e.data && e.data.size) REC.chunks.push(e.data); };
    REC.rec.onstop = () => { stream.getTracks().forEach((t0) => t0.stop()); clearInterval(REC.timer); btn.classList.remove("on"); REC.blob = new Blob(REC.chunks, { type: REC.mime }); storyReady(); };
    REC.rec.start(1000); REC.t0 = Date.now(); btn.classList.add("on");
    const st = document.getElementById("recState"); if (st) st.textContent = L3("Merekam… ketuk lagi untuk berhenti", "Marekam…", "Recording… tap again to stop");
    REC.timer = setInterval(() => { const s0 = Math.floor((Date.now() - REC.t0) / 1000); const el = document.getElementById("recTime"); if (el) el.textContent = Math.floor(s0 / 60) + ":" + String(s0 % 60).padStart(2, "0"); if (s0 >= 300 && REC.rec.state === "recording") REC.rec.stop(); }, 500);
  } catch (e) { toast(L3("Mikrofon tidak bisa dibuka. Izinkan mikrofon untuk Sada di pengaturan HP.", "Mikrofon ndang boi.", "The microphone could not be opened. Allow the microphone for Sada in your phone settings."), true); }
};
function storyReady() {
  const prev = document.getElementById("recPrev"); const form = document.getElementById("recForm"); if (!prev || !REC.blob) return;
  REC.seconds = Math.max(1, Math.round((Date.now() - (REC.t0 || Date.now())) / 1000));
  prev.innerHTML = `<audio controls src="${URL.createObjectURL(REC.blob)}" style="width:100%"></audio>`; form.hidden = false;
  const st = document.getElementById("recState"); if (st) st.textContent = L3("Dengarkan, lalu beri judul dan simpan.", "Begema.", "Listen back, then give it a title and save.");
}
A.storyFile = (d, el) => { const f0 = el.files && el.files[0]; if (!f0) return; if (f0.size > 4.4 * 1048576) { toast(t("err_file_too_big") || "Max 4 MB", true); return; } REC.blob = f0; REC.mime = f0.type || "audio/mp4"; REC.t0 = 0; storyReady(); REC.seconds = null; };
F.story = async (f) => {
  if (!REC.blob) return; if (REC.blob.size > 4.4 * 1048576) throw new S.AppError("file_too_big");
  const audio = (await toB64(REC.blob)); await api.save("story", { title: f.title.value.trim(), speaker: f.speaker.value.trim(), note: f.note.value.trim(), mime: REC.mime, audio, seconds: REC.seconds || null });
  REC.blob = null; await refresh(); toast(L3("Cerita tersimpan. Mauliate!", "Mauliate!", "Story saved. Thank you!"));
};
A.storyPlay = async (d, btn) => {
  const el = document.getElementById("sa" + d.id); if (!el) return; if (el.innerHTML) { el.innerHTML = ""; return; }
  try { const r = await busy(btn, () => api.save("story_audio", { story_id: +d.id })); const bytes = Uint8Array.from(atob(r.audio), (c) => c.charCodeAt(0));
    el.innerHTML = `<audio controls autoplay src="${URL.createObjectURL(new Blob([bytes], { type: r.mime || "audio/mp4" }))}" style="width:100%;margin-top:6px"></audio>`; } catch (e) { toast(errMsg(e), true); }
};
document.addEventListener("change", (e) => { const el = e.target; if (el && el.dataset && el.dataset.actChange && A[el.dataset.actChange]) A[el.dataset.actChange](el.dataset, el); });

// 4. Pelaut: voyage mode, an offline pack, and the church praying while they are at sea.
const atSea = () => (D.voyages || []).filter((v) => v.start <= today() && v.end >= today());
const myVoyage = () => (D.voyages || []).find((v) => v.mine && v.end >= addDays(today(), -14));
function voyageHomeCard() {
  if (isGuest()) return "";
  const mv = myVoyage(); const sea = atSea().filter((v) => !v.mine);
  let h = "";
  if (mv && mv.end < today() && !mv.welcomed) h += `<article class="card voyage-home"><h3>🏠 ${esc(L3(`Selamat datang kembali, ${firstName(D.me.name)}!`, `Horas, ${firstName(D.me.name)}! Selamat ro`, `Welcome home, ${firstName(D.me.name)}!`))}</h3><p>${esc(L3("Jemaat HKBP Singapore bersyukur Anda pulang dengan selamat. Sampai jumpa di ibadah Minggu!", "Mauliate tu Tuhan.", "HKBP Singapore thanks God you're home safely. See you on Sunday!"))}</p><button class="btn sm" data-act="voyageSeen" data-id="${mv.id}">🙏 ${esc(L3("Terima kasih", "Mauliate", "Thank you"))}</button></article>`;
  if (sea.length) h += `<a class="card li voyage-card" href="#/voyage">🚢<span class="grow"><b>${esc(L3(`${sea.length} anggota sedang berlayar`, `${sea.length} ruas marlayar`, `${sea.length} member${sea.length > 1 ? "s" : ""} at sea`))}</b><small>${esc(sea.map((v) => firstName(v.name)).join(", "))} · ${esc(L3("doakan mereka", "tangianghon", "pray for them"))}</small></span>${ic("chev", "chev")}</a>`;
  return h;
}
A.voyageSeen = async (d) => { try { await api.save("voyage_home", { voyage_id: +d.id }); await refresh(); render(); } catch (e) { toast(errMsg(e), true); } };
R.voyage = () => {
  const mv = myVoyage(); const sea = atSea(); const pack = LS.get("voyagePack", null);
  return shell("#/more", `<h2 class="page-h">🚢 ${esc(L3("Pelaut", "Pelaut", "Sailors"))}</h2>
    ${sea.length ? `<article class="card"><h3>🙏 ${esc(L3("Sedang berlayar, doakan mereka", "Na marlayar", "At sea now, pray for them"))}</h3>${sea.map((v) => `<div class="li"><span class="grow"><b>${esc(v.name)}</b><small>${esc([v.ship, L3("pulang", "mulak", "home") + " " + fmt(v.end, { day: "numeric", month: "short" })].filter(Boolean).join(" · "))}</small></span>🌊</div>`).join("")}</article>` : ""}
    ${mv && mv.end >= today() ? `<article class="card"><h3>⛴️ ${esc(L3("Pelayaran Anda", "Pelayaranmu", "Your voyage"))}</h3><p>${esc([mv.ship, fmt(mv.start, { day: "numeric", month: "short" }) + " – " + fmt(mv.end, { day: "numeric", month: "short", year: "numeric" })].filter(Boolean).join(" · "))}</p><div class="row two"><button class="btn primary" data-act="voyagePack">⬇️ ${esc(L3("Unduh paket offline", "Unduh paket", "Download offline pack"))}</button><button class="btn" data-act="voyageSeen" data-id="${mv.id}">🏠 ${esc(L3("Saya sudah pulang", "Nunga mulak", "I'm home"))}</button></div></article>`
      : `<form class="card form" data-form="voyage"><h3>⛴️ ${esc(L3("Akan berlayar?", "Naeng marlayar?", "Going to sea?"))}</h3><p class="small muted">${esc(L3("Sebelum berangkat, catat pelayaran Anda dan unduh paket renungan & Tata Ibadah untuk dibaca tanpa sinyal.", "", "Before you sail, note your voyage and download the devotions and Tata Ibadah to read without signal."))}</p>
        <label>${esc(L3("Nama kapal (boleh kosong)", "Goar ni kapal", "Ship name (optional)"))}<input name="ship" maxlength="80"></label>
        <div class="row2"><label>${esc(L3("Berangkat", "Borhat", "Leaving"))}<input type="date" name="start" value="${today()}" required></label><label>${esc(L3("Pulang (perkiraan)", "Mulak", "Back (about)"))}<input type="date" name="end" value="${addDays(today(), 60)}" required></label></div>
        <label class="check"><input type="checkbox" name="shared" checked> ${esc(L3("Tampilkan nama saya agar jemaat mendoakan", "Patuduhon goarhu", "Show my name so the church can pray"))}</label>
        <button class="btn primary block">${esc(L3("Simpan dan unduh paket", "Simpan", "Save and download the pack"))}</button></form>`}
    ${pack ? `<h3 class="sec-h">📦 ${esc(L3("Paket offline", "Paket", "Offline pack"))} · ${esc(fmt(pack.at, { day: "numeric", month: "short" }))}</h3><div class="card">${(pack.breads || []).map((b) => `<details class="pack-b"><summary><b>${esc(fmt(b.day, { day: "numeric", month: "short" }))}</b> · ${esc(b.title || "")}</summary><p class="small muted">${esc(b.verse || "")}</p><p class="pre">${esc(b.body || "")}</p></details>`).join("") || `<p class="muted small">${esc(L3("Belum ada renungan dalam paket.", "", "No devotions in the pack yet."))}</p>`}${pack.tata ? `<a class="li" href="#/tata/${pack.tata}">${ic("book")}<span class="grow"><b>${esc(t("tataTitle"))}</b><small>${esc(L3("Tersimpan di HP", "Tarsimpan", "Saved on this phone"))}</small></span>${ic("chev", "chev")}</a>` : ""}</div>` : ""}`,
    { back: "#/more", title: L3("Pelaut", "Pelaut", "Sailors") });
};
async function voyagePackSave() {
  const breads = (D.bread || []).slice().sort((a, b) => (b.day || "").localeCompare(a.day || "")).slice(0, 40).map((b) => ({ day: b.day, title: b.title, verse: b.verse, body: b.body }));
  const v = (D.services || []).find((x) => x.service_date >= today()) || (D.services || [])[0];
  if (v) { try { await tataHtml(v.id); } catch (e) {} }
  LS.set("voyagePack", { at: new Date().toISOString(), breads, tata: v ? v.id : null });
}
F.voyage = async (f) => { await api.save("voyage", { ship: f.ship.value.trim(), start: f.start.value, end: f.end.value, shared: f.shared.checked }); await voyagePackSave(); await refresh(); toast(L3("Selamat berlayar! Tuhan menyertai. Paket offline sudah diunduh.", "Selamat marlayar!", "Bon voyage! God be with you. The offline pack is downloaded.")); };
A.voyagePack = async (d, btn) => { await busy(btn, voyagePackSave); toast(L3("Paket offline diperbarui.", "", "Offline pack updated.")); render(); };

// 5. Live Tata Ibadah: the operator's phone sends the slide on screen; members follow it in large text.
const LIVE = { on: null, last: "", sentAt: 0, timer: null };
window.addEventListener("message", (e) => {
  const tx = e.data && e.data.hkbpSlide; if (!tx || !LIVE.on || tx === LIVE.last) return;
  LIVE.last = tx; api.save("live_push", { service_id: LIVE.on, slide: 0, body: tx }).catch(() => {});
});
A.liveToggle = async (d) => {
  if (LIVE.on === d.id) { LIVE.on = null; try { await api.save("live_stop", { service_id: d.id }); } catch (e) {} toast(L3("Siaran live berhenti.", "", "Live broadcast stopped.")); render(); return; }
  LIVE.on = d.id; LIVE.last = ""; toast(L3("Live aktif: slide yang tampil di HP ini muncul di HP jemaat (Home → Ikuti live). Biarkan Sada terbuka.", "", "Live on: the slide on this phone appears on members' phones (Home → Follow live). Keep Sada open.")); render();
};
function liveBanner() {
  if (isGuest() || !D.live || !D.live.service_id || /^#\/live/.test(location.hash)) return "";
  return `<a class="card live-banner" href="#/live"><span class="live-dot"></span><span class="grow"><b>${esc(L3("Ibadah sedang berlangsung", "Partangiangan masa", "The service is on now"))}</b><small>${esc(L3("Ikuti slide live di HP Anda, huruf besar", "Ihuthon live", "Follow the slides live on your phone, in large text"))}</small></span>${ic("chev", "chev")}</a>`;
}
R.live = () => {
  clearInterval(LIVE.timer);
  const pull = async () => { if (!/^#\/live/.test(location.hash)) { clearInterval(LIVE.timer); return; } try { const r = await api.save("live_get", {}); const el = document.getElementById("liveBody"); if (!el) return; if (!r || !r.body) { el.innerHTML = `<p class="muted center">${esc(L3("Belum ada siaran live. Halaman ini akan terisi saat ibadah dimulai.", "", "No live broadcast yet. This page fills in when the service starts."))}</p>`; return; } if (el.dataset.t !== r.body) { el.dataset.t = r.body; el.innerHTML = esc(r.body).replace(/\n/g, "<br>"); el.classList.remove("in"); void el.offsetWidth; el.classList.add("in"); } } catch (e) {} };
  LIVE.timer = setInterval(pull, 2000); setTimeout(pull, 0);
  const fs = LS.get("liveFs", 26);
  return shell("#/home", `<div class="live-top"><span class="live-dot"></span><b>${esc(L3("Live dari layar gereja", "Live", "Live from the church screen"))}</b><span class="grow"></span><button class="icon-btn" data-act="liveFont" data-d="-2" aria-label="A-">A−</button><button class="icon-btn" data-act="liveFont" data-d="2" aria-label="A+">A+</button></div>
    <div class="live-body" id="liveBody" style="font-size:${fs}px">${skel(3)}</div>`, { back: "#/home", title: L3("Ikuti live", "Ihuthon live", "Follow live") });
};
A.liveFont = (d) => { const fs = Math.max(16, Math.min(48, LS.get("liveFs", 26) + +d.d)); LS.set("liveFs", fs); const el = document.getElementById("liveBody"); if (el) el.style.fontSize = fs + "px"; };

// 6. Dukacita: the elders open a case; members send condolences, offer a visit or a meal; duties are covered.
function griefHomeCard() { const g = (D && D.grief) || []; if (isGuest() || !g.length) return ""; return `<a class="card li grief-card" href="#/grief">🕊️<span class="grow"><b>${esc(L3("Berita duka", "Barita dukacita", "Bereavement"))}</b><small>${esc(g.map((x) => `${x.deceased} · ${L3("keluarga", "keluarga", "family of")} ${x.family}`).join(" · "))}</small></span>${ic("chev", "chev")}</a>`; }
function personDuties(p) { const names = myNames(p); const out = []; (D.rosters || []).forEach((r) => (r.table_json || []).forEach((tb) => { const rows = tb.rows || []; const head = rows[0] || []; rows.slice(1).forEach((row) => { const iso = rowDate(row, r.month); if (!iso || iso < today()) return; const jobs = head.filter((h, j) => j && hit(row[j] || "", names)); if (jobs.length) out.push({ g: r.group_id, iso, jobs }); }); })); return out.sort((a, b) => a.iso.localeCompare(b.iso)); }
R.grief = () => {
  const list = D.grief || []; const elder = D.me.is_admin || "parhalado" in (D.me.groups || {});
  return shell("#/more", `<h2 class="page-h">🕊️ ${esc(L3("Dukacita", "Dukacita", "Bereavement"))}</h2><p class="lead">${esc(L3("Menghibur keluarga yang berduka: ucapan, kunjungan, makanan, dan tugas pelayanan mereka digantikan.", "", "Comfort a grieving family: condolences, visits, meals, and cover for their duties."))}</p>
    ${elder ? `<details class="card"><summary><b>➕ ${esc(L3("Sampaikan berita duka", "Barita dukacita", "Share a bereavement"))}</b></summary><form class="form" data-form="grief"><label>${esc(L3("Keluarga (anggota)", "Keluarga", "Family (member)"))}<select name="member" required>${(D.people || []).slice().sort((a, b) => a.name.localeCompare(b.name)).map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></label>
      <label>${esc(L3("Yang berpulang", "Na monding", "Who passed away"))}<input name="deceased" required maxlength="120"></label><label>${esc(L3("Keterangan (ibadah penghiburan, dll.)", "Keterangan", "Details (service, etc.)"))}<textarea name="note" rows="2" maxlength="500"></textarea></label>
      <label class="check"><input type="checkbox" name="notify" checked> ${esc(L3("Kabari seluruh jemaat", "Paboa tu sude", "Tell the whole church"))}</label><button class="btn primary block">${esc(L3("Sampaikan", "Paboa", "Share"))}</button></form></details>` : ""}
    ${list.length ? list.map((g) => { const fam = (D.people || []).find((p) => p.id === g.member_id); const dut = fam ? personDuties(fam) : []; const mineFam = g.member_id === D.me.id;
      return `<article class="card grief"><h3>🕊️ ${esc(g.deceased)}</h3><p class="small muted">${esc(L3("Keluarga", "Keluarga", "Family of"))} <b>${esc(g.family)}</b> · ${esc(fmt(g.at, { day: "numeric", month: "short" }))}</p>${g.note ? `<p class="pre">${esc(g.note)}</p>` : ""}
        ${mineFam ? "" : `<div class="row three"><button class="btn sm primary" data-act="griefHelp" data-id="${g.id}" data-k="msg">💌 ${esc(L3("Ucapan", "Ucapan", "Message"))}</button><button class="btn sm" data-act="griefHelp" data-id="${g.id}" data-k="visit">🏠 ${esc(L3("Berkunjung", "Mangunjungi", "Visit"))}</button><button class="btn sm" data-act="griefHelp" data-id="${g.id}" data-k="meal">🍲 ${esc(L3("Makanan", "Sipanganon", "Meal"))}</button></div>`}
        ${(g.helps || []).length ? `<div class="grief-helps">${g.helps.map((x) => `<div class="li"><span>${x.kind === "visit" ? "🏠" : x.kind === "meal" ? "🍲" : "💌"}</span><span class="grow"><b>${esc(x.name)}</b><small>${esc(x.day ? fmt(x.day, { weekday: "short", day: "numeric", month: "short" }) : "")}${x.body ? " · " + esc(x.body) : x.kind === "msg" ? " · " + esc(L3("ucapan untuk keluarga", "", "a message to the family")) : ""}</small></span>${x.mine ? `<button class="icon-btn danger" data-act="del" data-kind="grief_help" data-id="${x.id}" aria-label="${esc(t("delete"))}">${ic("trash")}</button>` : ""}</div>`).join("")}</div>` : ""}
        ${elder && dut.length ? `<p class="small muted">${esc(L3("Tugas pelayanan keluarga ini", "Tugas", "This family's duties"))}:</p>${dut.slice(0, 4).map((x) => `<div class="li"><span class="grow"><b>${esc(gname(G(x.g)))} · ${esc(fmtDay(x.iso))}</b><small>${esc(x.jobs.join(", "))}</small></span><button class="btn sm ghost" data-act="griefCover" data-g="${x.g}" data-day="${x.iso}" data-jobs="${esc(x.jobs.join(", "))}" data-who="${esc(g.family)}">${esc(L3("Cari pengganti", "Pengganti", "Find cover"))}</button></div>`).join("")}` : ""}
        ${elder ? `<button class="btn sm ghost" data-act="griefClose" data-id="${g.id}">${esc(L3("Tutup", "Tutup", "Close"))}</button>` : ""}</article>`; }).join("")
      : empty(L3("Tidak ada berita duka saat ini.", "", "No bereavements right now."), "heart")}`, { back: "#/more", title: L3("Dukacita", "Dukacita", "Bereavement") });
};
F.grief = async (f) => { await api.save("grief", { member_id: f.member.value, deceased: f.deceased.value.trim(), note: f.note.value.trim(), notify: f.notify.checked }); await refresh(); toast(L3("Berita duka disampaikan.", "", "Shared.")); };
A.griefHelp = (d) => {
  const k = d.k; const title = k === "msg" ? L3("Ucapan duka", "Ucapan", "Condolence message") : k === "visit" ? L3("Saya akan berkunjung", "Mangunjungi", "I'll visit") : L3("Saya akan membawa makanan", "Sipanganon", "I'll bring a meal");
  sheet(title, `<form class="form" data-form="griefhelp" data-id="${esc(d.id)}" data-k="${k}">${k === "msg" ? `<label>${esc(L3("Pesan Anda untuk keluarga", "Pesan", "Your message to the family"))}<textarea name="body" rows="3" maxlength="500" required>${esc(L3("Turut berduka cita. Kiranya Tuhan menghibur dan menguatkan keluarga.", "Turut marsak ate.", "Our deepest sympathy. May the Lord comfort and strengthen your family."))}</textarea></label>` : `<label>${esc(t("f_date"))}<input type="date" name="day" value="${addDays(today(), 1)}" required></label><label>${esc(t("f_note"))}<input name="body" maxlength="200"></label>`}
    <button class="btn primary block">${esc(L3("Kirim", "Kirim", "Send"))}</button></form>`);
};
F.griefhelp = async (f) => { await api.save("grief_help", { grief_id: +f.dataset.id, kind: f.dataset.k, day: f.day ? f.day.value : null, body: f.body ? f.body.value.trim() : "" }); closeSheet(); await refresh(); toast(L3("Terkirim ke keluarga.", "", "Sent to the family.")); };
A.griefCover = async (d) => { try { const r = await api.save("swap", { group_id: d.g, label: fmtDay(d.day), jobs: d.jobs, note: L3("Keluarga sedang berduka.", "Keluarga marsak.", "The family is grieving."), who: d.who, free: "", url: rosterHome(d.g, d.day.slice(0, 7)) }); toast(L3(`Makers diberi tahu (${r.told || 0}).`, "", `Makers told (${r.told || 0}).`)); } catch (e) { toast(errMsg(e), true); } };
A.griefClose = async (d) => { try { await api.save("grief_close", { grief_id: +d.id }); await refresh(); render(); } catch (e) { toast(errMsg(e), true); } };

// 7. Time for a visit (elders only): members who opted in and haven't been seen in church or the app for 3 weeks.
R.care = () => {
  const list = D.care || [];
  return shell("#/more", `<h2 class="page-h">🫶 ${esc(L3("Perlu dikunjungi", "Ingkon dikunjungi", "Time for a visit"))}</h2><p class="lead">${esc(L3("Jemaat yang memilih “Sintua boleh menghubungi saya” dan belum terlihat di gereja atau aplikasi selama 3 minggu. Hanya sintua yang melihat daftar ini.", "", "Members who chose “Elders may check on me” and haven't been seen at church or in the app for 3 weeks. Only elders see this list."))}</p>
    ${list.length ? `<div class="card">${list.map((p) => `<div class="li">${avatarOf(p)}<span class="grow"><b>${esc(p.name)}</b><small>${esc(L3("Terakhir di aplikasi", "Aplikasi", "Last in the app"))}: ${esc(p.seen ? fmt(p.seen, { day: "numeric", month: "short" }) : "–")} · ${esc(L3("di gereja", "gareja", "at church"))}: ${esc(p.church ? fmt(p.church, { day: "numeric", month: "short" }) : "–")}</small></span>${p.phone ? `<a class="icon-btn wa" href="${wa(L3(`Syalom ${firstName(p.name)}, apa kabar? Kami merindukan Anda di ibadah. Tuhan memberkati.`, `Horas ${firstName(p.name)}!`, `Hello ${firstName(p.name)}, how are you? We miss you at church. God bless.`), p.phone)}" target="_blank" rel="noopener" aria-label="WhatsApp">${ic("wa")}</a><a class="icon-btn" href="tel:+65${esc(p.phone)}" aria-label="Call">📞</a>` : ""}</div>`).join("")}</div>` : empty(L3("Semua yang memilih untuk disapa masih aktif. Puji Tuhan!", "", "Everyone who opted in has been around recently. Praise God!"), "heart")}`,
    { back: "#/more", title: L3("Perlu dikunjungi", "Ingkon dikunjungi", "Time for a visit") });
};

// 8. Fair roster draft: Claude spreads the month's duties fairly; the makers check, then save.
A.rosterDraft = async (d) => {
  const gid = d.g, ym = d.m; const g = G(gid); const old = manualRoster(gid, ym);
  const sundays = []; for (let x = ym + "-01"; x.slice(0, 7) === ym; x = addDays(x, 1)) if (new Date(x + "T12:00:00Z").getUTCDay() === 0) sundays.push(x);
  const jobs = old ? old.table_json[0].rows[0].slice(1).filter(Boolean) : (ROSTER_JOBS[gid] || ["Petugas"]);
  const people = (D.people || []).filter((p) => gid in (p.groups || {})).map((p) => p.name);
  if (!people.length) { toast(L3("Belum ada anggota di seksi ini.", "", "No members in this section yet."), true); return; }
  const load = {}; const since = addDays(today(), -92);
  (D.rosters || []).filter((r) => r.group_id === gid).forEach((r) => (r.table_json || []).forEach((tb) => (tb.rows || []).slice(1).forEach((row) => { const iso = rowDate(row, r.month); if (!iso || iso < since) return; people.forEach((n) => { if (row.some((c, j) => j && hit(c, myNames({ name: n })))) load[n] = (load[n] || 0) + 1; }); })));
  const busyMap = {}; sundays.forEach((s0) => { const away = [...(D.voyages || []).filter((v) => v.start <= s0 && v.end >= s0).map((v) => v.name), ...(D.grief || []).map((x) => x.family)]; if (away.length) busyMap[s0] = away; });
  const keep = {}; if (old) { const head = old.table_json[0].rows[0]; old.table_json[0].rows.slice(1).forEach((row) => { const iso = rowDate(row, ym); if (!iso) return; head.forEach((h, j) => { if (j && row[j]) (keep[iso] = keep[iso] || {})[h] = row[j]; }); }); }
  busySheet("✨ " + L3("Draf roster", "Draf roster", "Roster draft"), L3("Claude sedang menyusun roster yang adil…", "Claude manyusun…", "Claude is drafting a fair roster…"));
  try {
    const r = await aiRun("roster", { group_id: gid, group: gname(g), month: ym, sundays, jobs, people, load, busy: busyMap, keep });
    const head = [L3("Tanggal", "Tanggal", "Date"), ...jobs];
    const rows = sundays.map((s0) => { const a = ((r.rows || []).find((x) => x.day === s0) || {}).assign || {}; return [rDateCell(s0), ...jobs.map((j) => (keep[s0] && keep[s0][j]) || a[j] || "")]; });
    ROSTER_DRAFT.v = { gid, ym, old, head, rows };
    sheet("✨ " + L3("Draf roster", "Draf roster", "Roster draft") + " · " + monthName(ym), `<p class="small muted">${esc(r.note || "")}</p><div class="tbl-wrap"><table class="tbl"><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>${rows.map((row) => `<tr>${row.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table></div>
      <p class="small muted">${esc(L3("Periksa dulu. Setelah disimpan, Anda tetap bisa mengubah setiap Minggu dengan ✏️.", "", "Check it first. After saving you can still change each Sunday with ✏️."))}</p><button class="btn primary block" data-act="rosterDraftSave">${ic("check")} ${esc(L3("Simpan roster ini", "Simpan", "Save this roster"))}</button>`);
  } catch (e) { closeSheet(); toast(e.message, true); }
};
const ROSTER_DRAFT = { v: null };
A.rosterDraftSave = async (d, btn) => { const v = ROSTER_DRAFT.v; if (!v) return; await busy(btn, () => rosterWrite(v.gid, v.ym, v.old, v.head, v.rows, false)); closeSheet(); await refresh(); toast(t("saved")); render(); };

// 9. Discussion questions for a category's small group, from Sunday's Tata Ibadah.
const DISCUSS = { v: null };
A.discuss = async (d) => {
  const g = G(d.g); const v = (D.services || []).find((x) => x.service_date === nextSunday()) || (D.services || [])[0];
  if (!v) { toast(L3("Belum ada Tata Ibadah.", "", "No Tata Ibadah yet."), true); return; }
  busySheet("✨ " + gname(g), L3("Claude sedang menyiapkan bahan diskusi…", "Claude manyiapkon…", "Claude is preparing the discussion…"));
  try {
    const doc = new DOMParser().parseFromString(await tataHtml(v.id), "text/html");
    const text = [...doc.querySelectorAll("section.pg")].map((x) => x.textContent.replace(/\s+\n/g, "\n").trim()).join("\n\n").slice(0, 14000);
    const hint = { "sekolah-minggu": "children aged 4-12, very simple, playful", remaja: "teenagers 13-17", naposo: "young adults", ama: "fathers", ina: "mothers", pelaut: "sailors and workers far from home" }[d.g] || "adults";
    const r = await aiRun("questions", { category: gname(g), text, lang, hint });
    const plain = `*${r.title || ""}*\n${r.verse || ""}\n\n${r.opening || ""}\n\n${(r.questions || []).map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\n✅ ${r.action || ""}\n\n🙏 ${r.prayer || ""}`;
    DISCUSS.v = { gid: d.g, title: r.title || L3("Bahan diskusi", "Bahan diskusi", "Discussion"), plain };
    sheet("✨ " + (r.title || ""), `<p class="small muted">${esc(r.verse || "")}</p><p>${esc(r.opening || "")}</p><ol class="disc-q">${(r.questions || []).map((q) => `<li>${esc(q)}</li>`).join("")}</ol><p>✅ ${esc(r.action || "")}</p><p class="pre">🙏 ${esc(r.prayer || "")}</p>
      <div class="row two"><a class="btn wa" href="${wa(plain + "\n\n– HKBP Singapore")}" target="_blank" rel="noopener">${ic("wa")} WhatsApp</a><button class="btn primary" data-act="discussPost">${ic("plus")} ${esc(L3("Posting ke Materi", "Posting", "Post to Materials"))}</button></div>`);
  } catch (e) { closeSheet(); toast(e.message, true); }
};
A.discussPost = async (d, btn) => { const v = DISCUSS.v; if (!v) return; await busy(btn, () => api.save("post", { group_id: v.gid, kind: "sermon", title: v.title, body: v.plain.replace(/\*/g, "") })); closeSheet(); await refresh(); toast(t("saved")); render(); };

try { document.head.insertAdjacentHTML("beforeend", `<style>
  .care-opt { cursor: pointer; } .care-opt input { width: 22px; height: 22px; flex: none; accent-color: var(--brand); }
  .tutur-res h2 { font-size: 30px; margin: 2px 0 6px; color: var(--brand); }
  .ende-res hr { border: 0; border-top: 1px dashed var(--line); margin: 10px 0; }
  .ende-l { display: grid; gap: 2px; padding: 6px 0; } .ende-l b { font-size: 16px; } .ende-l span { font-size: 13.5px; color: var(--muted); }
  .ende-l.ref b { font-style: italic; color: var(--gold); }
  .rec-row { display: flex; gap: 14px; align-items: center; }
  .rec-btn { width: 64px; height: 64px; border-radius: 50%; border: 4px solid #ef4444; background: var(--surface); display: grid; place-items: center; flex: none; }
  .rec-btn i { width: 26px; height: 26px; border-radius: 50%; background: #ef4444; transition: .2s; } .rec-btn.on i { border-radius: 6px; width: 22px; height: 22px; animation: presPulse 1.4s infinite; }
  .upl { margin-top: 10px; cursor: pointer; } .story .icon-btn { font-size: 15px; }
  .voyage-card, .grief-card { font-size: 15px; } .voyage-home { border-top: 4px solid #0ea5e9; }
  .pack-b summary { cursor: pointer; padding: 8px 0; display: block !important; } .pack-b { border-bottom: 1px solid var(--line); }
  .live-banner { display: flex; align-items: center; gap: 12px; border: 2px solid #ef4444; }
  .live-dot { width: 12px; height: 12px; border-radius: 50%; background: #ef4444; flex: none; animation: presPulse 1.4s infinite; box-shadow: 0 0 0 0 rgba(239, 68, 68, .5); }
  .live-top { display: flex; align-items: center; gap: 10px; margin: 10px 0; }
  .live-body { background: #0b1022; color: #fff; border-radius: 18px; padding: 22px 20px; line-height: 1.45; font-weight: 600; min-height: 50vh; white-space: normal; }
  .live-body.in { animation: pageIn .25s ease-out; }
  .grief { border-left: 4px solid #64748b; } .row.three { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 8px 0; }
  .disc-q li { margin: 6px 0; }
</style>`); } catch (e) {}

// Swipe between the bottom tabs (YB 2026-10-29): swipe left = next tab, swipe right = previous tab.
// The page follows the finger and then slides in. Not while typing, in a pop-up, in the Tata Ibadah workbench,
// or when the finger starts on something that scrolls sideways (tables, chips, the Agenda/Roster switch).
(() => {
  let sx = 0, sy = 0, t0 = 0, mode = null, main = null, dx = 0;
  const order = () => TABS.map((x) => x[1]);
  const scrollsSideways = (el) => { for (let n = el; n && n !== document.body; n = n.parentElement) { if (n.scrollWidth > n.clientWidth + 2) { const ox = getComputedStyle(n).overflowX; if (ox === "auto" || ox === "scroll") return true; } } return false; };
  const blocked = (e) => {
    if (!D || isGuest() || e.touches.length !== 1) return true;
    const sh = document.getElementById("sheet"); if (sh && !sh.hidden) return true;
    if (document.getElementById("wb")) return true;
    const tg = e.target; if (!tg || !tg.closest) return true;
    if (tg.closest("input, textarea, select, [contenteditable], nav.tabs, .ch-bar, iframe")) return true;
    return scrollsSideways(tg);
  };
  addEventListener("touchstart", (e) => {
    mode = null; dx = 0; if (blocked(e)) { mode = "off"; return; }
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; t0 = Date.now(); main = document.querySelector("#view > main");
  }, { passive: true });
  addEventListener("touchmove", (e) => {
    if (mode === "off" || !main) return;
    const x = e.touches[0].clientX - sx, y = e.touches[0].clientY - sy;
    if (!mode) { if (Math.abs(x) < 12 && Math.abs(y) < 12) return; mode = Math.abs(x) > Math.abs(y) * 1.4 ? "h" : "off"; if (mode === "off") return; }
    const list = order(); const i = list.indexOf(CUR_TAB);
    const edge = (x > 0 && i <= 0) || (x < 0 && i >= list.length - 1);   // no tab beyond the first/last: resist
    dx = edge ? x * 0.18 : x;
    main.style.transition = "none"; main.style.transform = `translateX(${dx * 0.55}px)`; main.style.opacity = String(1 - Math.min(0.35, Math.abs(dx) / 900));
  }, { passive: true });
  addEventListener("touchend", () => {
    if (mode !== "h" || !main) { mode = null; return; }
    const list = order(); const i = list.indexOf(CUR_TAB); const fast = Date.now() - t0 < 350 && Math.abs(dx) > 40;
    const go = (Math.abs(dx) > 80 || fast) ? (dx < 0 ? i + 1 : i - 1) : -1; const m = main; mode = null; main = null;
    if (i < 0 || go < 0 || go >= list.length) { m.style.transition = "transform .22s ease, opacity .22s ease"; m.style.transform = ""; m.style.opacity = ""; return; }
    m.style.transition = "transform .16s ease-in, opacity .16s ease-in"; m.style.transform = `translateX(${dx < 0 ? -60 : 60}px)`; m.style.opacity = "0";
    SLIDE_IN = dx < 0 ? "from-right" : "from-left";
    setTimeout(() => { location.hash = list[go]; window.scrollTo(0, 0); }, 120);
  }, { passive: true });
  // The new page slides in from the side it came from.
  let SLIDE_IN = "";
  try { new MutationObserver(() => { const m = document.querySelector("#view > main"); if (m && SLIDE_IN) { m.classList.add(SLIDE_IN); SLIDE_IN = ""; } })
    .observe(document.getElementById("view") || document.body, { childList: true }); } catch (e) {}
  try { document.head.insertAdjacentHTML("beforeend", `<style>
    #view > main.from-right { animation: slideFromRight .24s ease-out both; }
    #view > main.from-left { animation: slideFromLeft .24s ease-out both; }
    @keyframes slideFromRight { from { opacity: 0; transform: translateX(48px); } to { opacity: 1; transform: none; } }
    @keyframes slideFromLeft { from { opacity: 0; transform: translateX(-48px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { #view > main.from-right, #view > main.from-left { animation: none; } }
  </style>`); } catch (e) {}
})();

// ---------- Improvements (YB 2026-10-29) ----------
// Search, "This Sunday", "Can't make it", undo, profile photos, RSVP, unread badges, prayer requests, birthday wishes,
// QR check-in, skeleton loading, pull to refresh. Each piece is small and uses the same app data (D) as everything else.

// Skeleton placeholders while something loads.
const skel = (n) => `<div class="skel-list" aria-hidden="true">${'<div class="skel"><i></i><span><b></b><b></b></span></div>'.repeat(n)}</div>`;

// Undo bar: the thing disappears at once; after 5 seconds it is really deleted, unless "Undo" was tapped.
let UNDO = null;
function undoBar(text, commit, revert) {
  if (UNDO) { clearTimeout(UNDO.t); UNDO.go(); }
  const el = document.createElement("div"); el.className = "undo-bar"; el.setAttribute("role", "status");
  el.innerHTML = `<span>${esc(text)}</span><button type="button">${esc(L3("Urungkan", "Urungkan", "Undo"))}</button>`;
  document.body.appendChild(el); requestAnimationFrame(() => el.classList.add("show"));
  const close = () => { el.classList.remove("show"); setTimeout(() => el.remove(), 250); };
  const u = { go: () => { close(); if (UNDO === u) UNDO = null; commit(); } };
  u.t = setTimeout(u.go, 5000);
  el.querySelector("button").onclick = () => { clearTimeout(u.t); close(); if (UNDO === u) UNDO = null; if (revert) revert(); };
  UNDO = u;
}

// Images made smaller on the phone before sending (profile photos, chat photos).
async function resizeImage(file, max, q, square) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("bad_image")); i.src = url; });
    let w = img.naturalWidth, h = img.naturalHeight, sx = 0, sy = 0, sw = w, sh = h;
    if (square) { const s0 = Math.min(w, h); sx = (w - s0) / 2; sy = (h - s0) / 2; sw = sh = s0; w = h = Math.min(max, s0); }
    else { const k = Math.min(1, max / Math.max(w, h)); w = Math.round(w * k); h = Math.round(h * k); }
    const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
    return c.toDataURL("image/jpeg", q);
  } finally { URL.revokeObjectURL(url); }
}

// Profile photo: tap your picture on More.
A.photoPick = () => {
  if (!(D.photos && D.photos[D.me.id])) return A.photoNew();
  sheet(L3("Foto profil", "Foto profil", "Profile photo"), `<div class="stack"><button class="opt-card" data-act="photoNew">${ic("camera")}<span><b>${esc(L3("Ganti foto", "Ganti foto", "Change photo"))}</b></span>${ic("chev", "chev")}</button>
    <button class="opt-card" data-act="photoRemove">${ic("trash")}<span><b>${esc(L3("Hapus foto", "Hapus foto", "Remove photo"))}</b></span>${ic("chev", "chev")}</button></div>`);
};
A.photoNew = () => {
  closeSheet(); const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*";
  inp.onchange = async () => { const f = inp.files[0]; if (!f) return; try { const data = await resizeImage(f, 192, 0.8, true); await api.save("photo", { photo: data }); D.photos = { ...(D.photos || {}), [D.me.id]: data }; toast(t("saved")); render(); } catch (e) { toast(errMsg(e), true); } };
  inp.click();
};
A.photoRemove = async () => { closeSheet(); try { await api.save("photo", { photo: "" }); if (D.photos) delete D.photos[D.me.id]; render(); } catch (e) { toast(errMsg(e), true); } };

// Unread: groups with posts this phone has not opened yet, and chat rooms with new messages.
function groupSeen() { let s = LS.get("seenG", null); if (!s) { s = {}; (D.groups || []).forEach((g) => (s[g.id] = new Date().toISOString())); LS.set("seenG", s); } return s; }
const groupNew = (gid) => { if (!D || isGuest()) return false; const since = groupSeen()[gid] || ""; return (D.posts || []).some((p) => p.group_id === gid && !["warta", "finance"].includes(p.kind) && (p.created_at || "") > since); };
function markGroupSeen(gid) { if (!D || isGuest()) return; const s = groupSeen(); s[gid] = new Date().toISOString(); LS.set("seenG", s); }
const newBadge = (on) => (on ? `<span class="badge new">${esc(L3("Baru", "Baru", "New"))}</span>` : "");
function tabBadge(h) {
  if (!D || isGuest()) return "";
  if (h === "#/chat") { const n = dmUnread(); return n ? `<i class="tab-dot n">${n}</i>` : chatRooms().some((r) => chatUnread(r.id)) ? `<i class="tab-dot"></i>` : ""; }
  if (h === "#/groups") { const n = (D.groups || []).filter((g) => g.kind === "sermon" && canSee(g) && groupNew(g.id)).length; return n ? `<i class="tab-dot n">${n}</i>` : ""; }
  return "";
}

// Search: members, groups, events, files and videos, posts, and roster lines.
R.search = () => {
  setTimeout(() => { const i = document.getElementById("searchIn"); if (i) { i.focus(); searchRun(i.value); } }, 0);
  return shell("#/home", `<div class="search-top">${ic("search")}<input id="searchIn" type="search" enterkeyhint="search" autocomplete="off" placeholder="${esc(L3("Cari anggota, acara, file, roster…", "Bilang…", "Search members, events, files, rosters…"))}" value="${esc(LS.get("lastQ", "") || "")}"></div><div id="searchRes"></div>`,
    { back: "#/home", title: L3("Cari", "Bilang", "Search") });
};
function searchRun(q) {
  LS.set("lastQ", q); const el = document.getElementById("searchRes"); if (!el) return;
  const n = norm(q); if (n.length < 2) { el.innerHTML = `<p class="muted small center pad">${esc(L3("Ketik minimal 2 huruf.", "Surat 2 huruf.", "Type at least 2 letters."))}</p>`; return; }
  const has = (x) => norm(x || "").includes(n); const digits = q.replace(/\D/g, "");
  const people = (D.people || []).filter((p) => has(p.name) || has(p.alias) || (digits.length >= 3 && (p.phone || "").includes(digits))).slice(0, 20);
  const groups = (D.groups || []).filter((g) => canSee(g) && has(gname(g)));
  const evs = (D.events || []).filter((e) => has(e.title) || has(e.place) || has(e.notes)).slice(0, 15);
  const files = (D.files || []).filter((f) => has(f.title) || has(f.file_name) || has(f.note)).slice(0, 15);
  const posts = (D.posts || []).filter((p) => !["warta", "finance"].includes(p.kind) && (has(p.title) || has(p.body))).slice(0, 10);
  const lines = []; (D.rosters || []).forEach((r) => (r.table_json || []).forEach((tb) => { const rows = tb.rows || []; const head = rows[0] || []; rows.slice(1).forEach((row) => { if (row.some((c, j) => j && has(c))) lines.push({ r, row, head }); }); }));
  const sec = (title, html) => (html ? `<h3 class="sec-h">${esc(title)}</h3><div class="card">${html}</div>` : "");
  const out = sec(L3("Anggota", "Ruas", "Members"), people.map((p) => `<div class="li">${avatarOf(p)}<span class="grow"><b>${esc(p.name)}</b><small>${esc([fmtPhone(p.phone), ...Object.keys(p.groups || {}).map((g) => gname(G(g))).filter(Boolean)].filter(Boolean).join(" · "))}</small></span>${p.id !== D.me.id ? `<a class="icon-btn" href="#/chat/${esc(dmRoom(p.id))}" aria-label="${esc(L3("Kirim pesan", "Kirim pesan", "Message"))}">${ic("chat")}</a>` : ""}${p.phone && p.id !== D.me.id ? `<a class="icon-btn wa" href="${wa("", p.phone)}" target="_blank" rel="noopener" aria-label="WhatsApp">${ic("wa")}</a>` : ""}</div>`).join(""))
    + (groups.length ? `<h3 class="sec-h">${esc(t("tab_groups"))}</h3><div class="glist">${groups.map((g) => groupTile(g, esc(t(g.kind === "service" ? "kindService" : "kindSermon")))).join("")}</div>` : "")
    + sec(L3("Acara", "Ulaon", "Events"), evs.map(eventRow).join(""))
    + sec(L3("Roster", "Roster", "Rosters"), lines.slice(0, 15).map(({ r, row, head }) => `<a class="li" href="${rosterHome(r.group_id, r.month)}"><span class="grow"><b>${esc(gname(G(r.group_id)))} · ${esc(row[0] || "")}</b><small>${esc(row.map((c, j) => (j && c ? `${head[j] || ""}: ${c}` : "")).filter(Boolean).join(" · "))}</small></span>${ic("chev", "chev")}</a>`).join(""))
    + sec(L3("File & video", "File & video", "Files & videos"), files.map((f) => `<div class="li"><span class="ftype">${f.link ? "▶" : esc(fileKind(f).toUpperCase())}</span><span class="grow"><b>${esc(f.title || f.file_name)}</b><small>${esc(gname(G(f.group_id)))}${f.day ? " · " + esc(fmtDay(f.day)) : ""}</small></span>${f.link ? `<a class="icon-btn" href="${esc(f.link)}" target="_blank" rel="noopener" aria-label="Video">${ic("screen")}</a>` : `<button class="icon-btn" data-act="openOffFile" data-id="${f.id}" aria-label="${esc(t("openOriginal"))}">${ic("file")}</button>`}</div>`).join(""))
    + sec(L3("Kiriman", "Kiriman", "Posts"), posts.map((p) => `<a class="li" href="#/g/${p.group_id}?tab=${p.kind === "sermon" ? "sermon" : "news"}"><span class="grow"><b>${esc(p.title || "")}</b><small>${esc(gname(G(p.group_id)))} · ${esc(String(p.body || "").slice(0, 70))}</small></span>${ic("chev", "chev")}</a>`).join(""));
  el.innerHTML = out || empty(L3("Tidak ditemukan.", "Ndang dapot.", "Nothing found."), "search");
}
document.addEventListener("input", (e) => { if (e.target && e.target.id === "searchIn") searchRun(e.target.value); });

// "This Sunday" on Home: the Tata Ibadah, your duty, who serves in each section, and that day's events.
function thisSundayCard() {
  if (isGuest()) return "";
  const sun = nextSunday(); const tata = (D.services || []).find((v) => v.service_date === sun);
  const mine = duties().filter((d) => d.date === sun);
  const serving = [];
  (D.rosters || []).forEach((r) => { if (r.file_name || r.link) return; const tb = (r.table_json || [])[0]; if (!tb) return; const rows = tb.rows || []; const head = rows[0] || [];
    rows.slice(1).forEach((row) => { if (rowDate(row, r.month) !== sun) return; const jobs = head.map((h, j) => [h, row[j]]).slice(1).filter(([h, w]) => h && w); if (jobs.length) serving.push({ g: G(r.group_id), jobs }); }); });
  const evs = (D.events || []).filter((e) => sgParts(e.starts_at).date === sun);
  if (!tata && !mine.length && !serving.length && !evs.length) return "";
  return `<article class="card sunday"><div class="sun-kick">⛪ ${esc(L3("Minggu ini", "Minggu on", "This Sunday"))} · ${esc(fmt(sun, { weekday: "long", day: "numeric", month: "long" }))}</div>
    ${tata ? `<a class="btn primary block" href="#/tata/${tata.id}">${ic("book")} ${esc(t("tataTitle"))}</a>` : ""}
    ${mine.map((d) => `<div class="li sun-mine" style="--gc:${d.group ? d.group.color : "var(--brand)"}"><span class="grow"><b>✓ ${esc(L3("Anda bertugas", "Ho marhobas", "You're serving"))} · ${esc(gname(d.group))}</b><small>${esc(d.roles.join(", "))}</small></span><button class="btn sm ghost" data-act="cantMake" data-g="${esc(d.roster.group_id)}" data-day="${sun}" data-jobs="${esc(d.roles.join(", "))}">${esc(L3("Tidak bisa?", "Ndang boi?", "Can't make it?"))}</button></div>`).join("")}
    ${serving.length ? `<details class="sun-serve"><summary>${esc(L3("Yang bertugas", "Na marhobas", "Who's serving"))} · ${serving.length} ${esc(L3("seksi", "seksi", "sections"))}</summary>${serving.map((x) => `<div class="li" style="--gc:${x.g ? x.g.color : "var(--brand)"}"><span class="sun-gi">${ic(x.g ? x.g.icon : "people")}</span><span class="grow"><b>${esc(gname(x.g))}</b><small>${esc(x.jobs.map(([h, w]) => `${h}: ${w}`).join(" · "))}</small></span></div>`).join("")}</details>` : ""}
    ${evs.map(eventRow).join("")}</article>`;
}

// "I can't make it": tells that section's roster makers, with who is free that Sunday.
A.cantMake = (d) => {
  const g = G(d.g); const day = d.day; const taken = [];
  (D.rosters || []).forEach((r) => (r.table_json || []).forEach((tb) => (tb.rows || []).forEach((row) => { if (rowDate(row, r.month) === day) row.forEach((c) => taken.push(c)); })));
  const free = (D.people || []).filter((p) => p.id !== D.me.id && d.g in (p.groups || {}) && !taken.some((c) => hit(c, myNames(p)))).map((p) => p.name);
  sheet(L3("Tidak bisa bertugas", "Ndang boi marhobas", "Can't make it"), `<form class="form" data-form="cantmake" data-g="${esc(d.g)}" data-day="${esc(day)}" data-jobs="${esc(d.jobs || "")}">
    <p class="muted">${esc(gname(g))} · ${esc(fmtDay(day))}${d.jobs ? " · " + esc(d.jobs) : ""}</p>
    <label>${esc(L3("Alasan (boleh kosong)", "Alasan", "Reason (optional)"))}<textarea name="note" rows="2" maxlength="200"></textarea></label>
    ${free.length ? `<p class="small muted">${esc(L3("Yang kosong hari itu", "Na so marhobas", "Free that Sunday"))}: <b>${esc(free.join(", "))}</b></p>` : ""}
    <input type="hidden" name="free" value="${esc(free.slice(0, 8).join(", "))}">
    <button class="btn primary block">${esc(L3("Beri tahu makers", "Paboa tu makers", "Tell the makers"))}</button></form>`);
};
F.cantmake = async (f) => {
  const r = await api.save("swap", { group_id: f.dataset.g, label: fmtDay(f.dataset.day), jobs: f.dataset.jobs, note: f.note.value.trim(), free: f.free.value, url: rosterHome(f.dataset.g, f.dataset.day.slice(0, 7)) });
  closeSheet(); toast(L3(`Terkirim ke ${r.told || 0} makers.`, `Tarkirim tu ${r.told || 0} makers.`, `Sent to ${r.told || 0} makers.`));
};

// Event RSVP: Going / Maybe / Can't, with counts; reminders then go only to those coming.
const rsvpOf = (e) => (D.rsvps && D.rsvps[e.id]) || { going: 0, maybe: 0, no: 0, who: [] };
function rsvpLine(e) {
  if (isGuest()) return ""; const r = rsvpOf(e);
  return (r.going || r.maybe ? ` · ✓ ${r.going}${r.maybe ? " · ? " + r.maybe : ""}` : "") + (r.mine ? ` · ${r.mine === "going" ? L3("Anda hadir", "Ro ho", "You're going") : r.mine === "maybe" ? L3("Mungkin", "Boha", "Maybe") : L3("Tidak hadir", "Ndang ro", "Not going")}` : "");
}
function rsvpBlock(e) {
  if (isGuest() || new Date(e.starts_at) < Date.now()) return ""; const r = rsvpOf(e);
  const b = (st, icon, label) => `<button type="button" class="rsvp-btn${r.mine === st ? " on" : ""}" data-act="rsvp" data-id="${e.id}" data-s="${st}"><span>${icon} ${esc(label)}</span><b>${r[st] || 0}</b></button>`;
  const who = (r.who || []).filter((x) => x.s === "going").map((x) => x.n);
  return `<div class="rsvp"><p class="small muted">${esc(L3("Apakah Anda hadir?", "Ro do ho?", "Are you coming?"))}</p><div class="rsvp-row">${b("going", "✓", L3("Hadir", "Ro", "Going"))}${b("maybe", "?", L3("Mungkin", "Boha", "Maybe"))}${b("no", "✕", L3("Tidak", "Ndang", "Can't"))}</div>${who.length ? `<p class="small muted">✓ ${esc(who.join(", "))}</p>` : ""}</div>`;
}
A.rsvp = async (d) => {
  const e = D.events.find((x) => x.id === d.id); if (!e) return; const r = { ...rsvpOf(e) }; const st = r.mine === d.s ? "" : d.s;
  try {
    await api.save("rsvp", { event_id: e.id, status: st });
    if (r.mine) r[r.mine] = Math.max(0, (r[r.mine] || 0) - 1); if (st) r[st] = (r[st] || 0) + 1; r.mine = st || null;
    r.who = (r.who || []).filter((x) => x.n !== D.me.name); if (st) r.who.push({ n: D.me.name, s: st });
    D.rsvps = { ...(D.rsvps || {}), [e.id]: r }; render(); A.evMenu({ id: e.id });
  } catch (err) { toast(errMsg(err), true); }
};

// Prayer requests: post one (optionally without your name; the elders still see it), pray along, mark answered.
R.prayer = () => {
  const list = D.prayers || []; const elder = D.me.is_admin || "parhalado" in (D.me.groups || {});
  return shell("#/more", `<h2 class="page-h">🙏 ${esc(L3("Pokok Doa", "Pokok Tangiang", "Prayer requests"))}</h2>
    <p class="lead">${esc(L3("Bagikan permohonan doa. Jemaat dapat ikut mendoakan, dan para sintua melihat semua permohonan.", "Bagi pangidoan tangiang. Ruas boi mangidoan, jala sintua mamereng sude.", "Share a prayer request. Others can pray along, and the elders see every request."))}</p>
    <form class="card form" data-form="prayer"><label>${esc(L3("Permohonan doa", "Pangidoan", "Your request"))}<textarea name="body" rows="3" maxlength="1000" required></textarea></label>
      <label class="check"><input type="checkbox" name="anon"> ${esc(L3("Tanpa nama (sintua tetap melihat nama Anda)", "Ndang marhite goar (sintua mamereng)", "Without my name (the elders still see it)"))}</label>
      <button class="btn primary block">${ic("plus")} ${esc(L3("Kirim", "Kirim", "Post"))}</button></form>
    ${list.length ? list.map((p) => `<article class="card prayer${p.answered ? " done" : ""}"><div class="meta">${esc(p.name || L3("Anonim", "Anonim", "Anonymous"))}${p.anon && p.name ? " · " + esc(L3("tanpa nama", "anonim", "anonymous")) : ""} · ${esc(fmt(p.at, { day: "numeric", month: "short" }))}${p.answered ? ` · <span class="badge chair">✓ ${esc(L3("Terjawab", "Dialusi", "Answered"))}</span>` : ""}</div>
      <p class="pre">${esc(p.body)}</p>
      <div class="row between"><button class="btn sm${p.i_prayed ? " primary" : ""}" data-act="pray" data-id="${p.id}">🙏 ${esc(p.i_prayed ? L3("Sudah didoakan", "Nunga ditangianghon", "Prayed") : L3("Saya mendoakan", "Hu tangianghon", "I prayed"))} · ${p.prayed}</button>
        ${p.mine || elder ? `<span class="row" style="margin:0"><button class="btn sm ghost" data-act="prayerDone" data-id="${p.id}" aria-label="${esc(L3("Terjawab", "Dialusi", "Answered"))}">✓</button><button class="btn sm danger" data-act="del" data-kind="prayer" data-id="${p.id}" aria-label="${esc(t("delete"))}">${ic("trash")}</button></span>` : ""}</div></article>`).join("")
      : empty(L3("Belum ada pokok doa.", "Dang adong.", "No prayer requests yet."), "heart")}`, { back: "#/more", title: L3("Pokok Doa", "Pokok Tangiang", "Prayer requests") });
};
F.prayer = async (f) => { const body = f.body.value.trim(); if (!body) return; await api.save("prayer", { body, anon: f.anon.checked }); await refresh(); toast(L3("Terkirim. Tuhan mendengar doa kita.", "Tarkirim. Tuhan manangihon.", "Posted. God hears our prayers.")); };
A.pray = (d) => { const p = (D.prayers || []).find((x) => String(x.id) === String(d.id)); if (!p) return; p.i_prayed = !p.i_prayed; p.prayed += p.i_prayed ? 1 : -1; render(); api.save("pray", { prayer_id: +d.id }).catch((e) => toast(errMsg(e), true)); };
A.prayerDone = async (d) => { try { await api.save("prayer_answered", { prayer_id: +d.id }); await refresh(); render(); } catch (e) { toast(errMsg(e), true); } };

// Birthday wishes: members write one in the app; the birthday person gets them all in one push at 19:00 and reads them on Home.
function wishBtn(p) {
  if (isGuest() || !p || !p.id || p.id === D.me.id || p.kind === "list") return "";
  const sent = (D.wished || []).includes(p.id);
  return `<button class="btn sm${sent ? " ghost" : " primary"}" data-act="wishSend" data-id="${esc(p.id)}" data-name="${esc(firstName(p.name))}">${sent ? "✓ " + esc(L3("Terkirim", "Tarkirim", "Sent")) : "💌 " + esc(L3("Ucapan", "Ucapan", "Wish"))}</button>`;
}
A.wishSend = (d) => sheet(`💌 ${d.name}`, `<form class="form" data-form="wish" data-id="${esc(d.id)}">
  <label>${esc(L3("Ucapan Anda", "Ucapanmu", "Your wish"))}<textarea name="body" rows="3" maxlength="300" required>${esc(L3(`Selamat ulang tahun, ${d.name}! Tuhan memberkati.`, `Selamat ari tubu, ${d.name}! Horas!`, `Happy birthday, ${d.name}! God bless you.`))}</textarea></label>
  <p class="small muted">${esc(L3("Semua ucapan sampai jam 19.00 dalam satu notifikasi.", "Sude ucapan sahat jam 19.00.", "All wishes reach them together at 7 pm in one notification."))}</p>
  <button class="btn primary block">💌 ${esc(L3("Kirim ucapan", "Kirim ucapan", "Send wish"))}</button></form>`);
F.wish = async (f) => { await api.save("wish", { to: f.dataset.id, body: f.body.value.trim() }); closeSheet(); D.wished = [...new Set([...(D.wished || []), f.dataset.id])]; toast(L3("Ucapan terkirim 💌", "Ucapan tarkirim 💌", "Wish sent 💌")); };
function wishesCard() {
  const w = (D && D.wishes) || []; if (isGuest() || !w.length) return "";
  return `<article class="card wishes"><div class="card-h"><h3>💌 ${esc(L3(`${w.length} ucapan untuk Anda`, `${w.length} ucapan tu ho`, `${w.length} wishes for you`))}</h3></div>${w.map((x) => `<div class="wish"><b>${esc(x.from)}</b><p>${esc(x.body)}</p></div>`).join("")}</article>`;
}

// QR check-in: the admin prints a QR for the church door; members scan it with the phone camera and are counted once a day.
R.checkin = () => {
  const k = new URLSearchParams(location.hash.split("?")[1] || "").get("k") || "";
  if (isGuest()) { LS.set("afterLogin", location.hash); return shell("#/home", `<div class="card center pad"><h2>👋 Check-in</h2><p class="muted">${esc(L3("Masuk dulu, lalu Anda tercatat hadir.", "Bongot jolo.", "Sign in first, then you're checked in."))}</p><button class="btn primary" data-act="signIn">${ic("lock")} ${esc(t("signIn"))}</button></div>`, { title: "Check-in" }); }
  setTimeout(async () => {
    const el = document.getElementById("ciRes"); if (!el) return;
    try { const r = await api.save("checkin", { key: k }); D.checked_in = true;
      el.innerHTML = `<div class="ci-ok">${ic("check")}</div><h2>${esc(r.already ? L3("Sudah tercatat hari ini", "Nunga tarsurat", "Already checked in today") : L3("Selamat beribadah!", "Horas! Selamat marminggu!", "Welcome to church!"))}</h2><p class="muted">${esc(D.me.name)} · ${esc(r.cat)} · ${esc(fmtDay(r.day))}</p><a class="btn primary" href="#/home">${esc(t("tab_home"))}</a>`;
    } catch (e) { el.innerHTML = `<p class="warn">${esc(e && /bad_code/.test(e.message || e.code || "") ? L3("Kode QR ini tidak berlaku.", "Kode QR ndang berlaku.", "This QR code is not valid.") : errMsg(e))}</p>`; }
  }, 0);
  return shell("#/home", `<div class="card center pad" id="ciRes">${skel(1)}</div>`, { back: "#/home", title: "Check-in" });
};
R.checkinqr = () => {
  if (!D.me.is_admin) return R.notFound();
  const url = appUrl() + "#/checkin?k=" + encodeURIComponent(D.checkin_key || "");
  setTimeout(async () => {
    const el = document.getElementById("qrBox"); if (!el) return;
    try { await loadScript("https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"); el.innerHTML = ""; new window.QRCode(el, { text: url, width: 720, height: 720, correctLevel: window.QRCode.CorrectLevel.M }); }
    catch (e) { el.innerHTML = `<p class="warn small">${esc(errMsg(e))}</p>`; }
  }, 0);
  const att = D.attendance || {}; const days = Object.keys(att).sort().reverse().slice(0, 8); const CATS = ["Bapak", "Ibu", "Naposo", "Remaja", "Sekolah Minggu", "Lainnya"];
  return shell("#/more", `<div class="card center qr-card"><h3>📷 QR Check-in</h3><p class="small muted">${esc(L3("Cetak dan tempel di pintu gereja. Jemaat memindai dengan kamera HP saat datang; jumlahnya masuk ke Warta Jemaat.", "Cetak jala tempel di pintu gareja.", "Print it for the church door. Members scan it with their phone camera; the counts go into the Warta Jemaat."))}</p>
      <div id="qrBox" class="qr-box">${skel(1)}</div><button class="btn" data-act="printPage">${ic("download")} ${esc(L3("Cetak", "Cetak", "Print"))}</button></div>
    <h3 class="sec-h">${esc(L3("Kehadiran", "Na ro", "Attendance"))}</h3>
    ${days.length ? `<div class="tbl-wrap"><table class="tbl"><tr><th>${esc(t("f_date"))}</th>${CATS.map((c) => `<th>${esc(c)}</th>`).join("")}<th>Total</th></tr>${days.map((d) => { const c = att[d]; const tot = Object.values(c).reduce((a, b) => a + b, 0); return `<tr><td>${esc(fmt(d, { day: "numeric", month: "short" }))}</td>${CATS.map((k) => `<td>${c[k] || ""}</td>`).join("")}<td><b>${tot}</b></td></tr>`; }).join("")}</table></div>` : `<p class="muted small">${esc(L3("Belum ada check-in.", "Dang adong.", "No check-ins yet."))}</p>`}`,
    { back: "#/more", title: "QR Check-in" });
};
A.printPage = () => window.print();

// Pull down at the top of a page to refresh.
(() => {
  let y0 = null, pulling = false; const ind = document.createElement("div"); ind.className = "ptr"; ind.textContent = "↻"; document.body.appendChild(ind);
  addEventListener("touchstart", (e) => { const sh = document.getElementById("sheet"); y0 = window.scrollY <= 0 && (!sh || sh.hidden) && !document.getElementById("wb") ? e.touches[0].clientY : null; pulling = false; }, { passive: true });
  addEventListener("touchmove", (e) => { if (y0 == null) return; const dy = e.touches[0].clientY - y0; if (dy > 12) { pulling = true; ind.style.opacity = String(Math.min(1, dy / 90)); ind.style.transform = `translate(-50%, ${Math.min(dy, 100) - 40}px) rotate(${dy * 3}deg)`; } }, { passive: true });
  addEventListener("touchend", async (e) => {
    if (y0 == null) return; const dy = e.changedTouches[0].clientY - y0; y0 = null;
    if (!(pulling && dy > 90)) { ind.style.opacity = "0"; ind.style.transform = ""; return; }
    ind.classList.add("spinning"); try { await refresh(); render(); } catch (err) {} ind.classList.remove("spinning"); ind.style.opacity = "0"; ind.style.transform = "";
  }, { passive: true });
})();

// Look of all of the above (kept here so only app.js needs updating). Dark mode uses the same colour tokens.
try { document.head.insertAdjacentHTML("beforeend", `<style>
  #view > main { animation: pageIn .22s ease-out both; }
  @keyframes pageIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  .skel-list { display: grid; gap: 12px; padding: 8px 0; }
  .skel { display: flex; gap: 12px; align-items: center; }
  .skel i { width: 42px; height: 42px; border-radius: 50%; flex: none; }
  .skel span { flex: 1; display: grid; gap: 7px; } .skel b { height: 11px; border-radius: 6px; } .skel b + b { width: 60%; }
  .skel i, .skel b { background: linear-gradient(90deg, var(--surface-2) 25%, color-mix(in srgb, var(--surface-2) 40%, var(--surface)) 50%, var(--surface-2) 75%); background-size: 200% 100%; animation: shimmer 1.2s infinite linear; }
  @keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
  .undo-bar { position: fixed; left: 50%; bottom: calc(80px + env(safe-area-inset-bottom)); transform: translate(-50%, 30px); opacity: 0; transition: .22s; z-index: 70; display: flex; align-items: center; gap: 14px; padding: 10px 12px 10px 18px; border-radius: 14px; background: var(--ink); color: var(--bg); box-shadow: var(--shadow-lg); font-weight: 600; }
  .undo-bar.show { transform: translate(-50%, 0); opacity: 1; }
  .undo-bar button { border: 0; background: transparent; color: var(--gold); font-weight: 800; padding: 6px 8px; font-size: 15px; }
  .ptr { position: fixed; top: calc(env(safe-area-inset-top) + 8px); left: 50%; transform: translate(-50%, -40px); opacity: 0; z-index: 40; width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; background: var(--surface); color: var(--brand); box-shadow: var(--shadow-lg); font-size: 20px; font-weight: 800; transition: opacity .15s; }
  .ptr.spinning { opacity: 1 !important; transform: translate(-50%, 20px) !important; animation: spin .8s linear infinite; }
  .search-entry { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding: 11px 14px; border-radius: 14px; background: var(--surface); border: 1px solid var(--line); color: var(--muted); box-shadow: var(--shadow); }
  .search-entry .ic { width: 19px; height: 19px; }
  .search-top { display: flex; align-items: center; gap: 10px; margin: 12px 0; padding: 0 14px; border-radius: 14px; background: var(--surface); border: 1px solid var(--line); }
  .search-top input { border: 0; background: transparent; padding: 13px 0; box-shadow: none; }
  .search-top .ic { color: var(--muted); }
  .card.sunday { border-top: 4px solid var(--gold); display: grid; gap: 10px; }
  .sun-kick { font-weight: 800; font-size: 15px; }
  .sun-mine { border: 1px solid color-mix(in srgb, var(--gc) 35%, var(--line)); border-radius: 12px; padding: 8px 10px; background: color-mix(in srgb, var(--gc) 6%, var(--surface)); }
  .sun-serve summary { display: block !important; cursor: pointer; font-weight: 700; color: var(--brand); padding: 4px 0; }
  .sun-gi { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; flex: none; background: color-mix(in srgb, var(--gc) 14%, var(--surface)); color: var(--gc); }
  .sun-gi .ic { width: 18px; height: 18px; }
  .rr-cant { font-size: 12px; font-weight: 700; margin-left: 6px; }
  .badge.new { background: #ef4444; color: #fff; }
  nav.tabs a { position: relative; }
  .tab-dot { position: absolute; top: 3px; left: calc(50% + 8px); min-width: 10px; height: 10px; border-radius: 999px; background: #ef4444; border: 2px solid var(--surface); font-style: normal; }
  .tab-dot.n { height: 17px; min-width: 17px; padding: 0 4px; font-size: 10.5px; line-height: 13px; color: #fff; font-weight: 800; text-align: center; }
  .avatar img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block; }
  .avatar-btn { position: relative; border: 0; background: none; padding: 0; border-radius: 50%; }
  .avatar-edit { position: absolute; right: -2px; bottom: -2px; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; background: var(--brand); color: var(--brand-ink); border: 2px solid var(--surface); font-style: normal; }
  .avatar-edit .ic { width: 13px; height: 13px; }
  .rsvp { margin: 10px 0; } .rsvp-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .rsvp-btn { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 10px 6px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface); font-weight: 700; color: var(--ink); }
  .rsvp-btn b { font-size: 18px; } .rsvp-btn.on { background: var(--brand); border-color: var(--brand); color: var(--brand-ink); }
  .card.prayer .meta { font-size: 13px; color: var(--muted); }
  .card.prayer.done { opacity: .75; }
  .card.wishes { border-left: 4px solid #ec4899; } .wish { padding: 8px 0; border-bottom: 1px solid var(--line); } .wish:last-child { border-bottom: 0; } .wish p { margin: 2px 0 0; }
  .qr-card h3 { justify-content: center; } .qr-box { display: grid; place-items: center; margin: 14px auto; padding: 14px; background: #fff; border-radius: 16px; width: min(100%, 660px); min-height: 200px; box-sizing: border-box; }
  .qr-box img, .qr-box canvas { width: 100% !important; height: auto !important; max-width: 640px; image-rendering: pixelated; }
  @media print { .qr-box { width: 17cm; } nav.tabs, header.top, .qr-card .btn { display: none !important; } }
  .ci-ok { width: 72px; height: 72px; margin: 0 auto 8px; border-radius: 50%; display: grid; place-items: center; background: #22c55e; color: #fff; } .ci-ok .ic { width: 38px; height: 38px; }
  .chat { display: flex; flex-direction: column; gap: 10px; padding: 12px 0 120px; }
  .ch-day { align-self: center; font-size: 12px; font-weight: 700; color: var(--muted); background: var(--surface-2); padding: 3px 10px; border-radius: 999px; margin: 6px 0; }
  .ch-msg { max-width: 82%; align-self: flex-start; display: flex; flex-direction: column; gap: 3px; }
  .ch-msg.mine { align-self: flex-end; align-items: flex-end; }
  .ch-name { font-size: 12.5px; color: var(--brand); padding-left: 12px; }
  .ch-bubble { background: var(--surface); border: 1px solid var(--line); padding: 9px 13px; border-radius: 18px 18px 18px 6px; line-height: 1.45; overflow-wrap: anywhere; box-shadow: var(--shadow); cursor: pointer; display: grid; gap: 6px; }
  .ch-msg.mine .ch-bubble { background: var(--brand); border-color: var(--brand); color: var(--brand-ink); border-radius: 18px 18px 6px 18px; }
  .ch-msg.sel .ch-bubble { outline: 2px solid var(--gold); outline-offset: 2px; }
  .ch-quote { display: block; font-size: 13px; padding: 5px 9px; border-left: 3px solid var(--gold); border-radius: 6px; background: color-mix(in srgb, currentColor 8%, transparent); opacity: .9; }
  .ch-quote b { display: block; font-size: 12px; }
  .ch-img { max-width: 100%; max-height: 300px; border-radius: 12px; display: block; }
  .ch-rxs { display: flex; gap: 4px; flex-wrap: wrap; }
  .ch-rx { border: 1px solid var(--line); background: var(--surface); border-radius: 999px; padding: 1px 8px; font-size: 13px; font-weight: 700; color: var(--ink); }
  .ch-rx.me { border-color: var(--brand); background: color-mix(in srgb, var(--brand) 12%, var(--surface)); }
  .ch-acts { display: flex; gap: 4px; flex-wrap: wrap; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 4px; box-shadow: var(--shadow-lg); }
  .ch-acts button { border: 0; background: transparent; font-size: 18px; padding: 4px 6px; border-radius: 10px; }
  .ch-acts button:nth-last-child(-n+2) { font-size: 13px; font-weight: 700; color: var(--brand); }
  .ch-time { font-size: 11.5px; color: var(--muted); padding: 0 8px; }
  .ch-online { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 12.5px; color: var(--muted); margin: 6px 0 0; min-height: 18px; }
  .ch-online i { width: 9px; height: 9px; border-radius: 50%; background: #22c55e; display: inline-block; }
  .ch-bar { position: fixed; left: 0; right: 0; bottom: calc(66px + env(safe-area-inset-bottom)); z-index: 19; display: grid; gap: 6px; padding: 8px max(12px, env(safe-area-inset-left)); background: color-mix(in srgb, var(--bg) 92%, transparent); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-top: 1px solid var(--line); }
  .ch-row { display: flex; gap: 8px; align-items: flex-end; }
  .ch-pend { display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 6px 8px; border-radius: 12px; background: var(--surface); border: 1px solid var(--line); }
  .ch-pend img { width: 40px; height: 40px; object-fit: cover; border-radius: 8px; }
  .ch-bar textarea { flex: 1; min-height: 44px; max-height: 140px; resize: none; padding: 11px 14px; border-radius: 22px; border: 1px solid var(--line); background: var(--surface); line-height: 1.35; }
  .ch-bar .btn { width: 46px; min-width: 46px; height: 44px; border-radius: 50%; padding: 0; font-size: 18px; }
  .ch-bar .icon-btn { width: 44px; height: 44px; border-radius: 50%; }
  @media (orientation: landscape) and (max-height: 540px), (min-width: 900px) { .ch-bar { bottom: 0; left: calc(84px + env(safe-area-inset-left)); } }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .hbd { background: linear-gradient(135deg, #3b2a12, #3a1730); color: #ffe7c2; } :root:not([data-theme="light"]) .hbd h2 { color: #ffb4d3; } }
  :root[data-theme="dark"] .hbd { background: linear-gradient(135deg, #3b2a12, #3a1730); color: #ffe7c2; } :root[data-theme="dark"] .hbd h2 { color: #ffb4d3; }
  @media (prefers-reduced-motion: reduce) { #view > main, .skel i, .skel b, .ptr.spinning { animation: none; } }
</style>`); } catch (e) {}
// The phone-calendar options and the birthday tools open in a small menu, so the Agenda starts with the months themselves.
A.phoneCal = () => sheet(L3("Ke kalender HP", "Tu kalender HP", "To my phone calendar"), `<div class="stack">
  <button class="opt-card" data-act="calSub">${ic("calendar")}<span><b>${esc(t("calSub"))}</b><small>${esc(t("calSubSub"))}</small></span>${ic("chev", "chev")}</button>
  <button class="opt-card" data-act="icsAll">${ic("download")}<span><b>${esc(t("addAllCal"))}</b><small>${esc(L3("Sekali saja, acara yang akan datang", "Sahali, ulaon na naeng ro", "Once, the upcoming events"))}</small></span>${ic("chev", "chev")}</button>
  <button class="opt-card" data-act="icsBdays">${ic("cake")}<span><b>${esc(t("bdaysToCal"))}</b><small>${esc(L3("Setiap tahun, otomatis", "Ganup taon", "Every year, automatically"))}</small></span>${ic("chev", "chev")}</button></div>`);
A.bdayTools = () => sheet(L3("Ulang tahun", "Ari tubu", "Birthdays"), `<div class="stack">
  <button class="opt-card" data-act="addBday">${ic("plus")}<span><b>${esc(t("addBday"))}</b></span>${ic("chev", "chev")}</button>
  <button class="opt-card" data-act="importBdays">${ic("upload")}<span><b>${esc(t("importBdays"))}</b></span>${ic("chev", "chev")}</button></div>`);

// ---------- Live / not live (YB 2026-10-29) ----------
// Green dot = has the app open right now (seen in the last 3 minutes); grey = not. Long-press or hover shows when last seen.
// The app pings the server every minute while it is open; chat rooms also report who is live.
const CH_ONLINE = new Set();
const seenAt = (id) => Math.max(CH_ONLINE.has(id) ? Date.now() : 0, D && D.seen && D.seen[id] ? Date.parse(D.seen[id]) : 0);
const isLive = (id) => !!id && !!D && ((D.me && id === D.me.id && !isGuest()) || Date.now() - seenAt(id) < 3 * 60e3);
const seenText = (id) => { if (isLive(id)) return L3("Sedang aktif", "Adong di aplikasi", "Live now"); const t0 = seenAt(id); if (!t0) return L3("Belum aktif", "Dang adong", "Not seen yet");
  const m = Math.round((Date.now() - t0) / 60e3); const ago = m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} ${L3("jam", "jam", "h")}` : `${Math.round(m / 1440)} ${L3("hari", "ari", "d")}`; return L3(`Terakhir aktif ${ago} lalu`, `Parpudi ${ago} na salpu`, `Last seen ${ago} ago`); };
const presDot = (id) => (id ? `<i class="pres ${isLive(id) ? "on" : "off"}" title="${esc(seenText(id))}" aria-label="${esc(seenText(id))}"></i>` : "");
const avatarOf = (p, cls = "") => { const ph = p && p.id && D && D.photos && D.photos[p.id]; return `<span class="avatar${cls ? " " + cls : ""}">${ph ? `<img src="${esc(ph)}" alt="">` : esc(initials(p && p.name))}${presDot(p && p.id)}</span>`; };
setInterval(() => { try { if (D && !isGuest() && !document.hidden && api.ping) api.ping(standalone()).catch(() => {}); } catch (e) {} }, 60e3);
try { document.head.insertAdjacentHTML("beforeend", `<style>
  .avatar { position: relative; }
  .pres { position: absolute; right: -1px; bottom: -1px; width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--surface); background: #c3cad8; }
  .pres.on { background: #22c55e; box-shadow: 0 0 0 0 rgba(34, 197, 94, .5); animation: presPulse 2s infinite; }
  .avatar.lg .pres { width: 16px; height: 16px; border-width: 3px; }
  .ch-name .pres { position: static; display: inline-block; width: 9px; height: 9px; border-width: 0; margin-right: 5px; vertical-align: 1px; animation: none; }
  .ch-online { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 12.5px; color: var(--muted); margin: 6px 0 0; }
  .ch-online i { width: 9px; height: 9px; border-radius: 50%; background: #22c55e; display: inline-block; }
  @keyframes presPulse { 0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, .45); } 70% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); } 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); } }
  @media (prefers-reduced-motion: reduce) { .pres.on { animation: none; } }
</style>`); } catch (e) {}

// ---------- Chat (YB 2026-10-29) ----------
// Two rooms, both two-way: "makers" for the makers of every category and section (and the admin), "all" for every member.
// Tap a message to react (🙏 ❤️ 👍 😂 🎉), reply to it or delete your own; 📷 sends a photo. The open room checks every 4 seconds.
const CHAT_ROLES = ["chair", "maker", "tmaker", "ychair", "ytreasurer", "ysecretary"];
const isChatMaker = () => !!D && !isGuest() && (D.me.is_admin || Object.values(D.me.groups || {}).some((r) => CHAT_ROLES.includes(r)));
const chatRooms = () => [
  ...(isChatMaker() ? [{ id: "makers", name: L3("Makers", "Makers", "Makers"), sub: L3("Makers semua kategorial dan seksi", "Makers sude kategorial dohot seksi", "Makers of every category and section") }] : []),
  { id: "all", name: L3("Jemaat", "Ruas", "Everyone"), sub: L3("Makers dan seluruh jemaat", "Makers dohot sude ruas", "Makers and all members") },
];
const REACTS = ["🙏", "❤️", "👍", "😂", "🎉"];
let CH = { room: null, msgs: [], last: 0, timer: null, sending: false, reacts: {}, sel: null, reply: null, image: null };
// Unread: the newest message id per room (from the app data) against the last one this phone showed.
function chatSeen() { let s = LS.get("chatSeen", null); if (!s) { s = { ...((D && D.chat_last) || {}) }; LS.set("chatSeen", s); } return s; }
function markChatSeen(room, id) { const s = chatSeen(); if (id && (s[room] || 0) < id) { s[room] = id; LS.set("chatSeen", s); } }
const chatUnread = (room) => !!D && !isGuest() && (String(room).startsWith("dm:") ? ((D.dms || []).find((x) => x.room === room) || {}).unread > 0 : ((D.chat_last && D.chat_last[room]) || 0) > (chatSeen()[room] || 0));
const dmUnread = () => (D && D.dms ? D.dms.reduce((n, x) => n + (x.unread || 0), 0) : 0);
function chatHtml() {
  if (!CH.msgs.length) return empty(L3("Belum ada pesan. Mulai percakapan!", "Dang adong pesan. Mulai ma!", "No messages yet. Start the conversation!"), "people");
  let lastDay = ""; const me = D.me.name;
  return CH.msgs.map((m) => {
    const mine = m.member_id === D.me.id; const day = sgParts(m.at).date;
    const sep = day !== lastDay ? `<div class="ch-day">${esc(day === today() ? t("today") : fmt(day, { weekday: "long", day: "numeric", month: "long" }))}</div>` : ""; lastDay = day;
    const rx = CH.reacts[m.id] || {}; const sel = CH.sel === m.id;
    const chips = Object.keys(rx).map((e) => `<button class="ch-rx${rx[e].includes(me) ? " me" : ""}" data-act="chatReact" data-id="${m.id}" data-e="${e}" title="${esc(rx[e].join(", "))}">${e} ${rx[e].length}</button>`).join("");
    const dm = String(CH.room || "").startsWith("dm:"); const lastMine = dm && mine && !CH.msgs.slice(CH.msgs.indexOf(m) + 1).some((x) => x.member_id === D.me.id);
    const seen = lastMine ? `<small class="ch-seen">${CH.otherRead >= m.id ? "✓✓ " + esc(L3("Dilihat", "Dibereng", "Seen")) : "✓ " + esc(L3("Terkirim", "Tarkirim", "Sent"))}</small>` : "";
    return `${sep}<div class="ch-msg${mine ? " mine" : ""}${sel ? " sel" : ""}">${mine || dm ? "" : `<b class="ch-name">${presDot(m.member_id)}${esc(m.name || "")}</b>`}
      <div class="ch-bubble" data-act="chatMsg" data-id="${m.id}">${m.reply ? `<span class="ch-quote"><b>${esc(m.reply.name || "")}</b>${esc(m.reply.body || "")}</span>` : ""}${m.image ? `<img class="ch-img" src="${esc(m.image)}" alt="" data-act="chatImg" data-id="${m.id}">` : ""}${m.body ? `<span>${esc(m.body).replace(/\n/g, "<br>")}</span>` : ""}</div>
      ${chips ? `<div class="ch-rxs">${chips}</div>` : ""}
      ${sel ? `<div class="ch-acts">${REACTS.map((e) => `<button data-act="chatReact" data-id="${m.id}" data-e="${e}">${e}</button>`).join("")}<button data-act="chatReply" data-id="${m.id}">↩︎ ${esc(L3("Balas", "Balas", "Reply"))}</button>${mine || D.me.is_admin ? `<button data-act="chatDel" data-id="${m.id}">${esc(t("delete"))}</button>` : ""}</div>` : ""}
      <small class="ch-time">${esc(fmtTime(m.at))}</small>${seen}</div>`;
  }).join("");
}
function chatPaint(scroll) { const box = document.getElementById("chatBox"); if (!box) return; const atEnd = window.innerHeight + window.scrollY >= document.body.scrollHeight - 120; box.innerHTML = chatHtml(); if (scroll || atEnd) window.scrollTo(0, document.body.scrollHeight); }
function chatPending() {
  const el = document.getElementById("chReply"); if (!el) return;
  const bits = [];
  if (CH.reply) bits.push(`<span class="grow">↩︎ <b>${esc(CH.reply.name || "")}</b> ${esc(String(CH.reply.body || "📷").slice(0, 60))}</span>`);
  if (CH.image) bits.push(`<img src="${esc(CH.image)}" alt=""><span class="grow">${esc(L3("Foto siap dikirim", "Foto siap", "Photo ready to send"))}</span>`);
  el.hidden = !bits.length; el.innerHTML = bits.join("") + (bits.length ? `<button class="icon-btn" data-act="chatCancel" aria-label="${esc(t("cancel"))}">${ic("x")}</button>` : "");
}
async function chatLoad(first) {
  const room = CH.room; if (!room) return;
  const r = await api.save("chat_list", { room, after: CH.last || null }); if (CH.room !== room) return;
  const add = (r && r.messages) || []; add.forEach((m) => { if (!CH.msgs.some((x) => x.id === m.id)) CH.msgs.push(m); });
  if (add.length) CH.last = add[add.length - 1].id;
  markChatSeen(room, CH.last); if (D && D.chat_last) D.chat_last[room] = Math.max(D.chat_last[room] || 0, CH.last);
  const rx = (r && r.reacts) || {}; let rxChanged = JSON.stringify(rx) !== JSON.stringify(CH.reacts); CH.reacts = rx;
  if (r && r.other_read != null && r.other_read !== CH.otherRead) { CH.otherRead = r.other_read; rxChanged = true; }
  if (String(room).startsWith("dm:") && D.dms) { const x = D.dms.find((y) => y.room === room); if (x && x.unread) { x.unread = 0; const tb = document.querySelector('nav.tabs a[href="#/chat"] .tab-dot'); if (tb && !dmUnread()) tb.remove(); } }
  let liveChanged = false;
  if (r && Array.isArray(r.online)) { const before = [...CH_ONLINE].sort().join(); CH_ONLINE.clear(); r.online.forEach((id) => CH_ONLINE.add(id)); liveChanged = before !== [...CH_ONLINE].sort().join();
    const el = document.getElementById("chOnline"); if (el) el.innerHTML = `<i></i> ${esc(L3(`${r.online.length} sedang aktif`, `${r.online.length} adong di aplikasi`, `${r.online.length} live now`))}`; }
  if (add.length || first || rxChanged || liveChanged) chatPaint(first || add.length > 0);
}
R.chat = (room) => {
  if (isGuest()) return R.home();
  const rooms = chatRooms();
  if (!room) return shell("#/chat", `<h2 class="page-h">💬 Chat</h2><p class="lead">${esc(L3("Percakapan dua arah. Ketuk sebuah ruang untuk membuka.", "Marsiboto dua arah. Ketuk ruang asa bukka.", "Two-way conversations. Tap a room to open it."))}</p>
    <div class="glist">${rooms.map((r) => `<a class="gtile" href="#/chat/${r.id}" style="--gc:${r.id === "makers" ? "var(--gold)" : "var(--brand)"}"><span class="gicon">${ic(r.id === "makers" ? "gear" : "people")}</span><span class="gname"><b>${esc(r.name)}</b><small>${esc(r.sub)}</small></span>${newBadge(chatUnread(r.id))}${ic("chev", "chev")}</a>`).join("")}</div>
    <div class="row between" style="margin:18px 0 6px"><h3 class="sec-h" style="margin:0">${esc(L3("Pesan pribadi", "Pesan pribadi", "Private messages"))}</h3><button class="btn sm primary" data-act="dmNew">✏️ ${esc(L3("Pesan baru", "Pesan baru", "New message"))}</button></div>
    ${(D.dms || []).length ? `<div class="card dm-list">${D.dms.map((x) => { const p = (D.people || []).find((q) => q.id === x.other) || { id: x.other, name: x.name };
      return `<a class="li${x.unread ? " unread" : ""}" href="#/chat/${esc(x.room)}">${avatarOf(p)}<span class="grow"><b>${esc(x.name || "")}</b><small>${x.last_mine ? esc(L3("Anda: ", "Ho: ", "You: ")) : ""}${esc(x.last || "")}</small></span><span class="dm-meta"><small>${esc(sgParts(x.at).date === today() ? fmtTime(x.at) : fmt(x.at, { day: "numeric", month: "short" }))}</small>${x.unread ? `<b class="dm-n">${x.unread}</b>` : ""}</span></a>`; }).join("")}</div>`
      : `<p class="muted small">${esc(L3("Belum ada pesan pribadi. Ketuk “Pesan baru” untuk mengirim pesan ke seorang anggota.", "Dang adong.", "No private messages yet. Tap “New message” to write to a member."))}</p>`}`, { title: "Chat" });
  let rm = rooms.find((r) => r.id === room);
  if (!rm && String(room).startsWith("dm:")) { const oid = room.slice(3).split(":").find((x) => x !== D.me.id); const op = (D.people || []).find((p) => p.id === oid);
    if (op && room === dmRoom(oid)) rm = { id: room, name: op.name, sub: seenText(oid), dm: oid }; }
  if (!rm) return R.notFound();
  if (CH.room !== room) { CH.room = room; CH.msgs = []; CH.last = 0; CH.reacts = {}; CH.sel = null; CH.reply = null; CH.image = null; CH.otherRead = 0; }
  clearInterval(CH.timer);
  CH.timer = setInterval(() => { if (!new RegExp("^#/chat/" + CH.room + "\\b").test(location.hash)) { clearInterval(CH.timer); return; } if (!document.hidden) chatLoad(false).catch(() => {}); }, 4000);
  setTimeout(() => { chatPending(); chatLoad(true).catch((e) => toast(errMsg(e), true)); }, 0);
  return shell("#/chat", `<p class="ch-online" id="chOnline"></p><div id="chatBox" class="chat">${CH.msgs.length ? chatHtml() : skel(4)}</div>
    <div class="ch-bar"><div class="ch-pend" id="chReply" hidden></div><div class="ch-row"><button class="icon-btn" data-act="chatPhoto" aria-label="${esc(L3("Kirim foto", "Kirim foto", "Send a photo"))}">${ic("camera")}</button>
      <textarea id="chatIn" rows="1" maxlength="1000" placeholder="${esc(L3("Tulis pesan…", "Surat pesan…", "Write a message…"))}"></textarea><button class="btn primary" data-act="chatSend" aria-label="${esc(L3("Kirim", "Kirim", "Send"))}">➤</button></div></div>`,
    { back: "#/chat", title: "💬 " + rm.name, sub: rm.sub });
};
A.chatMsg = (d) => { CH.sel = CH.sel === +d.id ? null : +d.id; chatPaint(false); };
A.chatReact = async (d) => {
  const id = +d.id, e = d.e, me = D.me.name; const rx = { ...(CH.reacts[id] || {}) }; const list = (rx[e] || []).slice();
  const i = list.indexOf(me); if (i >= 0) list.splice(i, 1); else list.push(me);
  if (list.length) rx[e] = list; else delete rx[e]; CH.reacts = { ...CH.reacts, [id]: rx }; CH.sel = null; chatPaint(false);
  try { await api.save("chat_react", { msg_id: id, emoji: e }); } catch (err) { toast(errMsg(err), true); }
};
A.chatReply = (d) => { CH.reply = CH.msgs.find((m) => m.id === +d.id) || null; CH.sel = null; chatPaint(false); chatPending(); const i = document.getElementById("chatIn"); if (i) i.focus(); };
A.chatCancel = () => { CH.reply = null; CH.image = null; chatPending(); };
A.chatImg = (d) => { const m = CH.msgs.find((x) => x.id === +d.id); if (m && m.image) sheet(m.name || "", `<img src="${esc(m.image)}" alt="" style="width:100%;border-radius:14px">${m.body ? `<p>${esc(m.body)}</p>` : ""}`); };
A.chatPhoto = () => {
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*";
  inp.onchange = async () => { const f = inp.files[0]; if (!f) return; try { let data = await resizeImage(f, 1280, 0.72); if (data.length > 440000) data = await resizeImage(f, 900, 0.6); CH.image = data; chatPending(); } catch (e) { toast(errMsg(e), true); } };
  inp.click();
};
A.chatSend = async (d, btn) => {
  const inp = document.getElementById("chatIn"); const body = (inp && inp.value || "").trim(); if ((!body && !CH.image) || CH.sending) return;
  CH.sending = true; btn.disabled = true;
  try {
    const m = await api.save("chat", { room: CH.room, body, reply_to: CH.reply ? CH.reply.id : null, image: CH.image || null });
    inp.value = ""; inp.style.height = ""; CH.reply = null; CH.image = null; chatPending();
    if (m && m.id && !CH.msgs.some((x) => x.id === m.id)) { CH.msgs.push(m); CH.last = Math.max(CH.last, m.id); markChatSeen(CH.room, CH.last); }
    chatPaint(true); inp.focus();
  } catch (e) { toast(e && /too_fast/.test(e.message || e.code || "") ? L3("Terlalu cepat, tunggu sebentar.", "Hatop hian, paima jolo.", "Too fast, wait a moment.") : errMsg(e), true); }
  finally { CH.sending = false; btn.disabled = false; }
};
A.chatDel = (d, btn) => {
  const host = btn.closest(".ch-msg"); if (host) host.style.display = "none"; CH.sel = null;
  undoBar(t("deleted"), async () => { try { await api.del("chat", d.id); CH.msgs = CH.msgs.filter((m) => String(m.id) !== String(d.id)); chatPaint(false); } catch (e) { if (host) host.style.display = ""; toast(errMsg(e), true); } }, () => { if (host) host.style.display = ""; });
};
// Enter sends, Shift+Enter makes a new line; the box grows with the text.
document.addEventListener("keydown", (e) => { if (e.target && e.target.id === "chatIn" && e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); const b = document.querySelector('[data-act="chatSend"]'); if (b) A.chatSend(b.dataset, b); } });
document.addEventListener("input", (e) => { if (e.target && e.target.id === "chatIn") { e.target.style.height = "auto"; e.target.style.height = Math.min(140, e.target.scrollHeight) + "px"; } });

// Youth / ReNa Band file and video uploads (the tab itself is youthFilesTab).
A.yAttach = (d) => sheet(rDateCell(d.day), `<div class="stack">
  <button class="opt-card" data-act="yUpload" data-g="${esc(d.g)}" data-day="${esc(d.day)}">${ic("upload")}<span><b>${esc(L3("Unggah file", "Upload file", "Upload a file"))}</b><small>${esc(L3("Partitur, chord, lagu, slide…", "Partitur, chord, ende…", "Sheet music, chords, songs, slides…"))}</small></span>${ic("chev", "chev")}</button>
  <button class="opt-card" data-act="yVideo" data-g="${esc(d.g)}" data-day="${esc(d.day)}">${ic("screen")}<span><b>${esc(L3("Tambah video", "Tambah video", "Add a video"))}</b><small>YouTube, Instagram, Google Drive…</small></span>${ic("chev", "chev")}</button></div>`);
// "For Sunday": tags the file or video to a Sunday so it shows with that Sunday in the roster (YB 2026-10-28). Optional.
const yDayField = (d) => `<label>${esc(L3("Untuk hari Minggu (boleh dikosongkan)", "Tu ari Minggu (boi dikosongkan)", "For Sunday (optional)"))}<input type="date" name="day" value="${esc(d.day || nextSunday())}"></label>
  <p class="small muted" style="margin-top:4px">${esc(L3("Akan tampil bersama roster Minggu itu.", "Tarida rap dohot roster Minggu i.", "It will show with that Sunday's roster."))}</p>`;
A.yUpload = (d) => sheet(L3("Unggah file", "Upload file", "Upload a file"), `<form class="form" data-form="yfile" data-g="${esc(d.g)}">
  <label>${esc(t("f_file"))}<input type="file" name="file" required></label>
  ${yDayField(d)}
  <label>${esc(t("f_title"))}<input name="title" placeholder="${esc(t("fileTitlePh"))}"></label>
  <label>${esc(t("f_note"))}<input name="note"></label>
  <label class="check"><input type="checkbox" name="notify" checked> ${esc(t("notifyGroup"))}</label>
  <p class="small muted">${esc(L3("Semua jenis file: dokumen, foto, lagu, presentasi, dll. Maksimal 10 MB.", "Sude jenis file. Maksimal 10 MB.", "Any kind of file: documents, photos, songs, slides and more. Up to 10 MB."))}</p>
  <button class="btn primary block">${ic("upload")} ${esc(L3("Unggah", "Upload", "Upload"))}</button></form>`);
F.yfile = async (f) => {
  const file = f.file.files[0]; if (!file) return;
  await saveOfficeFile(f.dataset.g, file, f.title.value.trim(), f.note.value.trim(), f.notify.checked, { day: f.day.value || null });
  closeSheet(); toast(t("saved")); render();
};
A.yVideo = (d) => sheet(L3("Tambah video", "Tambah video", "Add a video"), `<form class="form" data-form="yvideo" data-g="${esc(d.g)}">
  <label>${esc(L3("Link video (YouTube, Instagram, Google Drive, dll.)", "Link video (YouTube, dll.)", "Video link (YouTube, Instagram, Google Drive and more)"))}<input name="link" type="url" inputmode="url" required placeholder="https://youtu.be/…"></label>
  ${yDayField(d)}
  <label>${esc(t("f_title"))}<input name="title" required></label>
  <label>${esc(t("f_note"))}<input name="note"></label>
  <label class="check"><input type="checkbox" name="notify" checked> ${esc(t("notifyGroup"))}</label>
  <button class="btn primary block">${ic("plus")} ${esc(L3("Tambah video", "Tambah video", "Add a video"))}</button></form>`);
F.yvideo = async (f) => {
  const link = f.link.value.trim(); if (!/^https:\/\//.test(link)) throw new S.AppError("bad_link");
  await api.save("file", { group_id: f.dataset.g, title: f.title.value.trim(), note: f.note.value.trim() || null, link, file_name: f.title.value.trim(), mime: "video/link", size: 0, notify: f.notify.checked, day: f.day.value || null });
  await refresh(); closeSheet(); toast(t("saved")); render();
};
A.lang = (d) => { lang = d.l; LS.set("lang", lang); gateRender(); render(); };
A.pickView = (d) => { LS.set("view", d.v || null); closeSheet(); render(); };
// Reset (YB 2026-10-25): opens both pop-ups again with empty answers; old answers stay until the new ones are saved.
let pfBlank = false;
function profilePrompt(blank) {
  pfBlank = !!blank;
  const p = blank ? {} : me().profile || {};
  const q = (name, key, a, b) => `<fieldset class="yn"><legend>${esc(t(key))}</legend><div class="row2">
    <label><input type="radio" name="${name}" value="1" required ${p[name] === true ? "checked" : ""}><span>${esc(t(a))}</span></label>
    <label><input type="radio" name="${name}" value="0" ${p[name] === false ? "checked" : ""}><span>${esc(t(b))}</span></label></div></fieldset>`;
  sheet(t("pfTitle"), `<form class="form" data-form="profile">
    <p class="muted">${esc(t("pfLead"))}</p>
    ${q("married", "pfMarried", "pfYesMarried", "pfNotMarried")}
    ${q("male", "pfGender", "pfMale", "pfFemale")}
    ${q("pelaut", "pfPelaut", "yes", "no")}
    ${q("confirmed", "pfConfirmed", "yes", "no")}
    ${needBday() ? bdayFields() : ""}
    <button class="btn primary block">${esc(t("save"))}</button></form>`);
}
A.profile = () => profilePrompt();
A.pfReset = () => profilePrompt(true);
A.pfTest = () => {
  if (LS.get("pfTest")) { LS.set("pfTest", null); toast(t("pfTestDone")); render(); return; }
  LS.set("pfTest", 1); LS.set("allCats", null); location.hash = "#/groups"; setTimeout(profilePrompt, 300);
};
A.allCats = () => { LS.set("allCats", LS.get("allCats") ? null : 1); render(); };
F.profile = async (f) => {
  const v = (n) => f.querySelector(`input[name="${n}"]:checked`).value === "1";
  const p = { married: v("married"), male: v("male"), pelaut: v("pelaut"), confirmed: v("confirmed") };
  const md = bdayValue(f); if (md) p.dob_md = md;
  const res = await api.profileSave(p); bdayTake(res); D.me.profile = res ? (({ dob, ...x }) => x)(res) : p; LS.set("allCats", null);
  closeSheet(); toast(t("pfSaved") + " " + profileCats(D.me.profile).map((id) => gname(G(id))).filter(Boolean).join(", ")); render();
  if (serveOn()) setTimeout(() => servePrompt(pfBlank), 350); // second layer
};
// Birthday question (YB 2026-10-28): asked with the first questions, and on its own for members who answered before,
// only while the app has no birthday for them (none on their profile and none on the birthday list). The year is not asked.
const bdayKnown = () => !!me().dob || (D.birthdays || []).some((b) => hit(b.name, myNames(me())));
const needBday = () => !!D && !isGuest() && !!me() && !!me().id && !bdayKnown();
const bdayFields = () => `<fieldset class="yn"><legend>${esc(L3("Tanggal ulang tahun Anda", "Ari tubum", "Your birthday"))}</legend><div class="row2">
  <label class="pick-sel">${esc(t("f_day"))}<select name="bdd" required><option value=""></option>${Array.from({ length: 31 }, (_, i) => `<option>${i + 1}</option>`).join("")}</select></label>
  <label class="pick-sel">${esc(t("f_month"))}<select name="bmm" required><option value=""></option>${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${esc(fmt(`2024-${String(i + 1).padStart(2, "0")}-15`, { month: "long" }))}</option>`).join("")}</select></label></div></fieldset>`;
const bdayValue = (f) => (f.bdd && f.bmm && f.bdd.value && f.bmm.value ? `${String(f.bmm.value).padStart(2, "0")}-${String(f.bdd.value).padStart(2, "0")}` : "");
const bdayTake = (res) => { if (res && res.dob) D.me.dob = res.dob; };
function bdayPrompt() {
  LS.set("bdayAsked", today());
  sheet(L3("Ulang tahun Anda", "Ari tubum", "Your birthday"), `<form class="form" data-form="bdayask"><p class="muted">${esc(L3("Supaya gereja bisa mengucapkan selamat ulang tahun kepada Anda. Tahun tidak perlu diisi.", "Asa boi gareja mandok selamat ari tubu tu ho. Taon ndang porlu.", "So the church can wish you a happy birthday. The year is not needed."))}</p>
    ${bdayFields()}<button class="btn primary block">${esc(t("save"))}</button></form>`);
}
F.bdayask = async (f) => { const md = bdayValue(f); if (!md) throw new S.AppError("bad_date"); bdayTake(await api.profileSave({ dob_md: md })); closeSheet(); toast(t("saved")); };
function servePrompt(blank) {
  const sv = blank ? [] : (me().profile || {}).serve || [];
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
A.asFilter = (d) => { AS.f = d.f; asFill(); };
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
  // A Tata Ibadah moves to its Sunday in the Multimedia roster (YB 2026-10-29) when that month has a roster made in the app.
  const inRoster = (v) => !!(v.service_date && manualRoster("multimedia", v.service_date.slice(0, 7)));
  const role = mmRole(); const moved = (D.services || []).filter(inRoster).length; const list = (D.services || []).filter((v) => !inRoster(v)).slice(0, 6); const mk = makers();
  return `<div class="card tata">
    <div class="card-h"><h3>${ic("book")} ${esc(t("tataTitle"))}</h3>${role ? `<span class="badge ${role === "maker" ? "chair" : "member"}">${esc(t("role_" + role))}</span>` : ""}</div>
    <p class="small muted">${esc(t(role === "maker" ? "tataMakerLead" : "tataReadLead"))}</p>
    ${role === "maker" ? `<button class="btn primary block" data-act="openWorkbench">${ic("edit")} ${esc(t("openWorkbench"))}</button>` : ""}
    ${list.length ? list.map((v) => `<a class="li" href="#/tata/${v.id}"><span class="date-chip"><b>${esc(v.service_date ? fmt(v.service_date, { day: "numeric" }) : "•")}</b><small>${esc(v.service_date ? fmt(v.service_date, { month: "short" }) : "")}</small></span><span class="grow"><b>${esc(v.title || t("tataTitle"))}</b><small>${esc(v.author_name || "")}</small></span>${ic("chev", "chev")}</a>`).join("") : moved ? `<p class="small muted">${esc(L3("Tata Ibadah ada di roster di bawah, pada hari Minggunya.", "Tata Ibadah adong di roster di toru, di ari Minggu na.", "Each Tata Ibadah is in the roster below, on its Sunday."))}</p>` : `<p class="muted small">${esc(t("noTata"))}</p>`}
    ${list.length > 6 ? `<a class="btn sm ghost" href="#/tata">${esc(t("seeAll"))}</a>` : ""}
  </div>
  ${D.me.is_admin && manage() ? `<div class="card"><div class="card-h"><h3>${ic("people")} ${esc(t("makerList"))}</h3><button class="btn sm" data-act="addMaker">${ic("plus")} ${esc(t("addMaker"))}</button></div>
    ${mk.length ? mk.map((p) => `<div class="li">${avatarOf(p)}<span class="grow"><b>${esc(p.name)}</b><small>${esc(fmtPhone(p.phone))} · ${esc(t("role_" + p.groups.multimedia))}</small></span>${p.groups.multimedia === "maker" ? `<button class="icon-btn" data-act="rmMaker" data-phone="${esc(p.phone || "")}" aria-label="${esc(t("delete"))}">${ic("trash")}</button>` : ""}</div>`).join("") : `<p class="muted small">${esc(t("noMakers"))}</p>`}</div>` : ""}`;
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
    ${isMMMaker() ? `<button class="btn block${LIVE.on === v.id ? " primary" : ""}" data-act="liveToggle" data-id="${v.id}">📡 ${esc(LIVE.on === v.id ? L3("Siaran live aktif · ketuk untuk berhenti", "Siaran live · ketuk asa mansai", "Live to members' phones · tap to stop") : L3("Siarkan slide ke HP jemaat", "Siarhon slide tu HP ruas", "Broadcast slides to members' phones"))}</button>` : ""}
    <div class="row two"><button class="btn" data-act="tataFull" data-id="${v.id}">${ic("screen")} ${esc(t("fullScreen"))}</button>${canRm ? `<button class="btn danger" data-act="del" data-kind="service" data-id="${v.id}">${ic("trash")} ${esc(t("delete"))}</button>` : ""}</div>`,
    { back: "#/s/multimedia", title: v.title || t("tataTitle"), sub: v.service_date ? fmtDay(v.service_date) : t("tataTitle") });
};
const tataCache = {};
// Tata Ibadah offline (YB 2026-10-29): each one opened, and the coming Sunday's in the background, is kept on the phone,
// so the slides still open during the service without signal. Only the latest two are kept.
const tataLocal = (id) => { try { return localStorage.getItem("hkbp.tata." + id); } catch (e) { return null; } };
function tataKeep(id, h) { try { Object.keys(localStorage).filter((k) => k.startsWith("hkbp.tata.") && k !== "hkbp.tata." + id).slice(0, -1).forEach((k) => localStorage.removeItem(k)); localStorage.setItem("hkbp.tata." + id, h); } catch (e) {} }
async function tataHtml(id) {
  if (tataCache[id]) return tataCache[id];
  try { const h = await api.serviceHtml(id); tataCache[id] = h; tataKeep(id, h); return h; }
  catch (e) { const c = tataLocal(id); if (c) { tataCache[id] = c; return c; } throw e; }
}
function tataPrefetch() { if (!D || !navigator.onLine) return; const v = (D.services || []).find((x) => x.service_date === nextSunday()) || (D.services || [])[0]; if (v && !tataLocal(v.id)) tataHtml(v.id).catch(() => {}); }
// The slides report which slide is on screen (for live follow-along), without changing anything else in them.
const LIVE_REPORTER = `<script>(function(){var last="";function vis(e){var s=getComputedStyle(e);return s.display!=="none"&&s.visibility!=="hidden"&&+s.opacity>0.05;}
function cur(){var best=null,ba=0,vw=innerWidth,vh=innerHeight,els=document.querySelectorAll(".dk-slide, section.pg");for(var i=0;i<els.length;i++){var e=els[i],r=e.getBoundingClientRect();if(r.width<2||r.height<2||!vis(e))continue;
var w=Math.max(0,Math.min(r.right,vw)-Math.max(r.left,0)),h=Math.max(0,Math.min(r.bottom,vh)-Math.max(r.top,0));if(w*h>ba){ba=w*h;best=e;}}return best;}
setInterval(function(){var b=cur();if(!b)return;var t=(b.innerText||"").replace(/\\n{3,}/g,"\\n\\n").trim().slice(0,4000);if(t&&t!==last){last=t;try{parent.postMessage({hkbpSlide:t},"*");}catch(e){}}},700);})();<\/script>`;
function tataIframe(html) { html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, LIVE_REPORTER + "</body>") : html + LIVE_REPORTER; const f = document.createElement("iframe"); f.setAttribute("sandbox", "allow-scripts"); f.title = t("tataTitle"); f.src = URL.createObjectURL(new Blob([html], { type: "text/html" })); return f; }
A.tataFull = async (d) => { const html = await tataHtml(d.id); const el = $(".tata-frame"); if (el && el.requestFullscreen) el.requestFullscreen().catch(() => {}); else window.open(URL.createObjectURL(new Blob([html], { type: "text/html" })), "_blank"); };
A.openWorkbench = (d) => {
  if (!(mmRole() === "maker" && isMMMaker())) { toast(t("notMaker"), true); return; }
  const el = document.createElement("div"); el.id = "wb";
  el.innerHTML = `<div class="wb-bar"><button class="icon-btn" data-act="closeWb" aria-label="${esc(t("close"))}">${ic("x")}</button><b>${esc(t("tataTitle"))} · Workbench</b><button class="btn primary sm" data-act="publishWb">${ic("upload")} ${esc(t("publish"))}</button></div><iframe src="../workbench/index.html${d && d.go ? "?go=1" : ""}" title="Workbench" allow="fullscreen"></iframe>`;
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
  const edit = canEvents();
  sheet(e.title, `<p class="muted">${esc(fmtDay(p.date))} · ${esc(fmtTime(e.starts_at))}${e.ends_at ? "–" + esc(fmtTime(e.ends_at)) : ""}</p>
    ${e.place ? `<p>${ic("pin")} ${esc(e.place)}</p>` : ""}<p class="small muted">${esc(gname(g))} · ${esc(t("remindTxt", remindLabel(e.remind_min)))}</p>${e.notes ? `<p class="pre">${esc(e.notes)}</p>` : ""}
    ${rsvpBlock(e)}
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
  if (!canEvents()) { toast(t("notMaker"), true); return; }
  if (d.g) return eventForm({ group_id: d.g });
  sheet(t("newEvent"), `<p class="muted">${esc(t("evWho"))}</p><div class="stack">
    <button class="opt-card" data-act="evPick" data-g="">${ic("people")}<span><b>${esc(t("evGeneral"))}</b><small>${esc(t("evGeneralSub"))}</small></span>${ic("chev", "chev")}</button>
    <button class="opt-card" data-act="evSpecific">${ic("groups")}<span><b>${esc(t("evSpecific"))}</b><small>${esc(t("evSpecificSub"))}</small></span>${ic("chev", "chev")}</button></div>`);
};
A.evSpecific = () => {
  const cats = canEvents() ? D.groups.filter((g) => g.kind !== "office") : [];
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
A.del = (d, btn) => {
  // Deleted at once, with an "Undo" bar for 5 seconds (YB 2026-10-29); the server is only told when the time is up.
  const inSheet = !!btn.closest("#sheet"); const host = inSheet ? null : btn.closest(".rr-day, .ch-msg, article, .card, .li");
  if (inSheet) closeSheet(); if (host) host.style.display = "none";
  undoBar(t("deleted"), async () => { try { await api.del(d.kind, d.id); await refresh(); if (d.kind === "bread" && /^#\/bread\//.test(location.hash)) location.hash = "#/bread"; render(); } catch (e) { if (host) host.style.display = ""; toast(errMsg(e), true); } }, () => { if (host) host.style.display = ""; });
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
// Roster by date (YB 2026-10-28): like creating an event, pick the Sunday with a date picker and type who serves in each job.
// Each month stays one table (dates down the side, jobs across), so "My duties", the highlights and the Warta still find the names.
const L3 = (id, bt, en) => (lang === "en" ? en : lang === "bt" ? bt : id);
const ROSTER_JOBS = { multimedia: ["Operator Slide", "Live Stream", "Sound"], "song-leader": ["Song Leader"], musik: ["Keyboard/Piano", "Gitar", "Bass", "Drum"], band: ["Vokal", "Keyboard", "Gitar", "Bass", "Drum"], koor: ["Pemandu Koor"],
  parhalado: ["Pengkhotbah", "Liturgis", "St. Sekolah Minggu"], "sekolah-minggu": ["Liturgis", "Pengajar", "Pemusik"], remaja: ["Liturgis", "Pengajar", "Pemusik"], jemaat: ["Pembaca Warta", "Penerima Tamu", "Tally Counter"] };
const manualRoster = (gid, ym) => D.rosters.find((r) => r.group_id === gid && r.month === ym && !r.file_name && !r.link && ((r.table_json || [])[0] || {}).rows);
function rosterJobs(gid) {
  const own = D.rosters.filter((r) => r.group_id === gid && (r.table_json || []).length).sort((a, b) => b.month.localeCompare(a.month));
  for (const r of own) { const h = ((r.table_json[0] || {}).rows || [])[0]; if (h && h.length > 1) return h.slice(1).filter(Boolean); }
  return ROSTER_JOBS[gid] || [L3("Petugas", "Parhobas", "Server")];
}
function rosterRowFor(gid, iso) {
  const r = manualRoster(gid, iso.slice(0, 7)); if (!r) return null;
  const rows = r.table_json[0].rows; const row = rows.slice(1).find((x) => rowDate(x, r.month) === iso); if (!row) return null;
  return rows[0].map((h, j) => [h, row[j] || ""]).slice(1);
}
const rDateCell = (iso) => new Intl.DateTimeFormat("id-ID", { timeZone: TZ, weekday: "long", day: "numeric", month: "short" }).format(new Date(iso + "T12:00:00+08:00")).replace(/\./g, "");
const rrRow = (job = "", who = "") => `<div class="fin-row rr-row" style="grid-template-columns:minmax(0,8.5em) minmax(0,1fr) auto"><input name="job" value="${esc(job)}" placeholder="${esc(L3("Tugas", "Ulaon", "Job"))}" aria-label="${esc(L3("Tugas", "Ulaon", "Job"))}"><input name="who" value="${esc(who)}" placeholder="${esc(L3("Nama", "Goar", "Name"))}" aria-label="${esc(L3("Nama", "Goar", "Name"))}">${rmBtn("rrRm")}</div>`;
function rrFill(f) {
  const gid = f.dataset.g; const have = rosterRowFor(gid, f.day.value) || []; const box = f.querySelector(".rr-rows");
  const jobs = rosterJobs(gid); have.forEach(([h]) => { if (h && !jobs.some((j) => norm(j) === norm(h))) jobs.push(h); });
  box.innerHTML = jobs.map((j) => rrRow(j, (have.find(([h]) => norm(h) === norm(j)) || [, ""])[1])).join("");
  f.querySelector(".rr-del").hidden = !have.length;
  f.querySelector(".rr-note").textContent = have.some(([, w]) => w) ? L3("Sudah ada jadwal untuk tanggal ini; perubahan akan menggantinya.", "Nunga adong jadwal di tanggal on; na niubah gabe pangganti.", "This date already has a roster; your changes will replace it.") : "";
}
A.uploadRoster = (d) => {
  const g = G(d.g); const ns = nextSunday(); const m = d.m || ns.slice(0, 7);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(d.day || "") ? d.day : ns.slice(0, 7) === m ? ns : (() => { const s0 = m + "-01"; const wd = new Date(s0 + "T12:00:00+08:00").getDay(); return addDays(s0, (7 - wd) % 7); })();
  const title = d.edit ? t("edit") + " · Roster" : L3("Buat Roster", "Bahen Roster", "Make Roster");
  sheet(title, `${d.cont ? `<p class="small muted">${esc(L3("Tersimpan. Lanjut ke Minggu berikutnya, atau tutup (✕) jika sudah selesai.", "Nunga tarsimpan. Lanjut tu Minggu na ro, manang tutup (✕) molo nunga sae.", "Saved. Carry on with the next Sunday, or close (✕) when you are done."))}</p>` : ""}<form class="form" data-form="rosterday" data-g="${esc(d.g)}" data-edit="${d.edit ? 1 : ""}">
    <div class="for-chip" style="--gc:${g.color}">${ic(g.icon)}<span class="grow"><small>${esc(t("f_for"))}</small><b>${esc(gname(g))}</b></span></div>
    <label>${esc(t("f_date"))}<input type="date" name="day" required value="${day}"></label>
    <h4>${ic("people")} ${esc(L3("Siapa yang melayani", "Ise na marhobas", "Who serves"))}</h4>
    <p class="small muted rr-note"></p>
    <div class="rr-rows"></div>
    <button type="button" class="btn sm" data-act="rrAdd">${ic("plus")} ${esc(L3("Tambah tugas", "Tambah ulaon", "Add a job"))}</button>
    <label class="check"><input type="checkbox" name="notify" checked> ${esc(L3("Beri tahu yang bertugas di Minggu ini", "Paboa tu na marhobas di Minggu on", "Notify the people on duty this Sunday"))}</label>
    <button class="btn primary block">${esc(t("save"))}</button>
    <div class="rr-del" hidden><button type="button" class="btn block danger" data-act="rrDel">${ic("trash")} ${esc(L3("Hapus Minggu ini dari roster", "Hapus Minggu on sian roster", "Remove this Sunday from the roster"))}</button></div></form>
    ${d.edit ? "" : `<p class="or"><span>${esc(t("or"))}</span></p>`}
    ${d.edit ? "" : `<button class="btn block ghost" data-act="uploadRosterFile" data-g="${esc(d.g)}" data-m="${esc(m)}">${ic("upload")} ${esc(L3("Unggah file atau link", "Upload file manang link", "Upload a file or link"))}</button>`}`, (el) => {
    const f = el.querySelector("form"); rrFill(f); f.day.addEventListener("change", () => rrFill(f));
  });
};
A.rrAdd = (d, btn) => { const box = btn.closest("form").querySelector(".rr-rows"); box.insertAdjacentHTML("beforeend", rrRow()); box.lastElementChild.querySelector("input").focus(); };
A.rrRm = (d, btn) => { const r = btn.closest(".rr-row"); if (r) r.remove(); };
F.rosterday = async (f) => {
  const gid = f.dataset.g; const day = f.day.value; if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new S.AppError("bad_date");
  const pairs = [...f.querySelectorAll(".rr-row")].map((r) => [r.querySelector("[name=job]").value.trim(), r.querySelector("[name=who]").value.trim()]).filter(([j]) => j);
  if (!pairs.some(([, w]) => w)) { toast(L3("Isi minimal satu nama.", "Isi sahali goar.", "Fill in at least one name."), true); return; }
  const ym = day.slice(0, 7); const old = manualRoster(gid, ym);
  const head = old ? old.table_json[0].rows[0].slice() : [L3("Tanggal", "Tanggal", "Date")];
  pairs.forEach(([j]) => { if (!head.slice(1).some((h) => norm(h) === norm(j))) head.push(j); });
  const pad = (r) => head.map((_, i) => r[i] || "");
  const others = old ? old.table_json[0].rows.slice(1).filter((x) => rowDate(x, ym) !== day).map(pad) : [];
  const mine = head.map((h, i) => (i === 0 ? rDateCell(day) : (pairs.find(([j]) => norm(j) === norm(h)) || [, ""])[1]));
  const rows = [...others, mine].sort((a, b) => (rowDate(a, ym) || "").localeCompare(rowDate(b, ym) || ""));
  await rosterWrite(gid, ym, old, head, rows, f.notify.checked, day);
  closeSheet(); LS.set("ym." + gid, ym); await refresh(); toast(t("saved"));
  location.hash = rosterHome(gid, ym);
  // Make Roster: the next Sunday opens straight away with the same jobs, until the maker closes it.
  if (!f.dataset.edit) { const nx = addDays(day, 7); setTimeout(() => { if ($("#sheet").hidden) A.uploadRoster({ g: gid, m: nx.slice(0, 7), day: nx, cont: 1 }); }, 450); }
};
function rosterWrite(gid, ym, old, head, rows, notify, onlyIso) {
  const table_json = [{ name: monthName(ym), rows: [head, ...rows] }];
  return api.save("roster", { id: old ? old.id : undefined, group_id: gid, month: ym, title: old ? old.title : `${t("roster")} ${gname(G(gid))} ${monthName(ym)}`,
    table_json, text_content: [head, ...rows].map((r) => r.join(" | ")).join("\n"), notify_list: notify ? rosterNotifyList(gid, table_json, ym, onlyIso) : [] });
}
// Roster notifications go only to the members named in it (YB 2026-10-28), each with their own Sundays and jobs.
// With onlyIso, only that Sunday counts (Make Roster); otherwise every row of the roster (an uploaded file or link).
function rosterNotifyList(gid, tables, ym, onlyIso) {
  const g = G(gid) || {}; const out = [];
  D.people.filter((p) => p.id).forEach((p) => {
    const names = myNames(p); if (!names.length) return; const lines = [];
    (tables || []).forEach((tb) => {
      const rows = tb.rows || []; const hi = Math.max(0, rows.findIndex((r) => r.filter(Boolean).length >= 2)); const head = rows[hi] || [];
      rows.forEach((row, i) => {
        if (i <= hi) return; const iso = rowDate(row, ym); if (onlyIso && iso !== onlyIso) return;
        const jobs = row.map((c, j) => (hit(c, names) && head[j] && head[j] !== c ? head[j] : null)).filter(Boolean);
        if (jobs.length || row.some((c) => hit(c, names))) lines.push(`${iso ? rDateCell(iso) : row.filter(Boolean)[0] || ""}${jobs.length ? " · " + jobs.join(", ") : ""}`);
      });
    });
    if (lines.length) out.push({ member: p.id, title: `📅 Jadwal ${g.name_id || gname(g)}`, body: "Anda bertugas:\n" + lines.slice(0, 8).join("\n") });
  });
  return out;
}
// Remove one Sunday from a made roster (tap twice). The last Sunday of a month removes that month's roster.
async function rosterRemoveDay(gid, day, btn) {
  const ym = day.slice(0, 7); const old = manualRoster(gid, ym); if (!old) return;
  const head = old.table_json[0].rows[0]; const rows = old.table_json[0].rows.slice(1).filter((x) => rowDate(x, ym) !== day);
  await busy(btn, async () => {
    try { if (rows.length) await rosterWrite(gid, ym, old, head, rows, false); else await api.del("roster", old.id); closeSheet(); await refresh(); toast(t("deleted")); render(); }
    catch (e) { toast(errMsg(e), true); }
  });
}
A.rrDel = (d, btn) => {
  const f = btn.closest("form"); const g = f.dataset.g, day = f.day.value; closeSheet();
  const host = [...document.querySelectorAll('.rr-day [data-act="rrDelRow"]')].find((x) => x.dataset.day === day && x.dataset.g === g); const card = host && host.closest(".rr-day"); if (card) card.style.display = "none";
  undoBar(t("deleted"), () => rosterRemoveDay(g, day, null), () => { if (card) card.style.display = ""; });
};
// Trash button on a roster row: the first tap turns it red, the second removes that Sunday.
A.rrDelRow = (d, btn) => {
  const host = btn.closest(".rr-day"); if (host) host.style.display = "none";
  undoBar(t("deleted"), () => rosterRemoveDay(d.g, d.day, null), () => { if (host) host.style.display = ""; });
};
A.uploadRosterFile = (d) => {
  const g = G(d.g);
  sheet(t("uploadRoster"), `<form class="form" data-form="roster" data-g="${d.g}">
    <label>${esc(t("f_month"))}<input type="month" name="month" value="${d.m}" required></label>
    <label>${esc(t("f_title"))}<input name="title" value="${esc(`${t("roster")} ${gname(g)} ${monthName(d.m)}`)}"></label>
    <div class="drop"><input type="file" name="file" id="rfile" accept=".docx,.doc,.pdf,.xlsx,.xls,.csv,.ods,image/*"><label for="rfile">${ic("upload")}<b>${esc(t("pickFile"))}</b><small>.docx · .doc · .pdf · .xlsx · .xls · ${esc(t("photo"))}</small></label></div>
    <p class="or"><span>${esc(t("or"))}</span></p>
    <label>${esc(t("f_link"))}<input type="url" name="link" placeholder="https://docs.google.com/spreadsheets/… / https://1drv.ms/…"></label>
    <div id="rprev"></div>
    <label class="check"><input type="checkbox" name="notify" checked> ${esc(L3("Beri tahu yang namanya ada di roster", "Paboa tu na adong goarna di roster", "Notify the people named in the roster"))}</label>
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
  if (!isYB()) { toast(t("needClaudeKey"), true); return; } // Settings is for YB only (YB 2026-10-28)
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
  const n = norm(tok).replace(/\b(chair|ketua|member|anggota|maker|pembuat|checker|pemeriksa|user)\b/g, "").trim(); if (!n) return null;
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
      get("groups").split(/[;,\/\n]+/).forEach((tok) => { if (!tok.trim()) return; const g = matchGroup(tok); if (g) groups[g.id] = /chair|ketua/i.test(tok) ? "chair" : /maker|pembuat/i.test(tok) ? "maker" : /checker|pemeriksa|\buser\b/i.test(tok) ? "checker" : groups[g.id] || "member"; else unknown.push(tok.trim()); });
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
// Sign-in: the phone number is checked as it is typed. Makers (anyone who can change things) then
// see a password field (or create their own password the first time); everyone else signs in with
// the phone number only and can read. Numbers not on the list keep reading the public pages.
const pwIsPhone = (pw, phone) => /^[+0-9 ()-]+$/.test(pw || "") && S.phone8(pw) === S.phone8(phone);
function pcShow(f, kind) {
  f.dataset.kind = kind || ""; f.dataset.kphone = kind ? S.phone8(f.phone.value) : "";
  const q = (c) => f.querySelector(c);
  q(".pc-pw").hidden = kind !== "maker"; q(".pc-new").hidden = kind !== "maker_new"; q(".pc-forgot").hidden = kind !== "maker"; q(".pc-reg").hidden = q(".pc-browse").hidden = kind !== "unknown"; q(".pc-note").hidden = !!kind;
  q(".pc-hint").textContent = kind ? t("pc_" + kind) : "";
  q(".pc-btn").textContent = t(kind === "maker_new" ? "firstPwBtn" : kind === "unknown" ? "pcRegister" : "signIn");
  q("button").disabled = !kind;
  const focus = kind === "maker" ? f.pw : kind === "maker_new" ? f.npw : kind === "unknown" ? f.rname : null; if (focus) setTimeout(() => focus.focus(), 50);
}
async function pcCheck(f) {
  const ph = S.phone8(f.phone.value);
  if (!validPhone(ph)) { pcShow(f, ""); return ""; }
  if (f.dataset.kphone === ph && f.dataset.kind) return f.dataset.kind;
  const kind = await api.phoneCheck(ph);
  if (S.phone8(f.phone.value) === ph) pcShow(f, kind);
  return kind;
}
let pcTimer = 0;
document.addEventListener("input", (e) => {
  const el = e.target.closest && e.target.closest("[data-phonecheck]"); if (!el) return;
  const f = el.form; if (f.dataset.kphone !== S.phone8(el.value)) pcShow(f, "");
  clearTimeout(pcTimer); pcTimer = setTimeout(() => pcCheck(f).catch((err) => toast(errMsg(err), true)), 300);
});
function mustChangeSheet(oldPw) {
  sheet(t("pcChangeTitle"), `<form class="form" data-form="password"><p class="muted">${esc(t("pcChangeLead"))}</p>
    <input type="hidden" name="old" value="${esc(oldPw)}">
    <label>${esc(t("f_newPw"))}<input type="password" name="pw" required minlength="6" autocomplete="new-password"></label>
    <button class="btn primary block">${ic("lock")} ${esc(t("save"))}</button></form>`, (el) => el.querySelector("input[name=pw]").focus());
}
F.login = async (f) => {
  const phone = S.phone8(f.phone.value);
  if (!validPhone(phone)) throw new S.AppError("bad_phone");
  const kind = await pcCheck(f);
  // Not on the list: register with name + phone, no password (YB 2026-10-26). Read only, like other members.
  if (kind === "unknown") {
    const name = (f.rname.value || "").replace(/\s+/g, " ").trim();
    if (name.length < 2) { f.rname.focus(); throw new S.AppError("bad_name"); }
    await api.register(phone, name); D = null; await refresh(); afterSignIn(); backAfterLogin(); toast(t("registered")); localReminders(); return;
  }
  if (kind === "maker_new") {
    const pw = f.npw.value || "";
    if (pw.length < 6) throw new S.AppError("short_password");
    if (pw !== f.npw2.value) throw new S.AppError("pw_mismatch");
    if (pwIsPhone(pw, phone)) throw new S.AppError("pw_is_phone");
    await api.firstPassword(phone, pw); D = null; await refresh(); afterSignIn(); backAfterLogin(); toast(t("firstPwDone")); localReminders(); return;
  }
  if (kind === "maker" && !f.pw.value) { f.pw.focus(); throw new S.AppError("bad_login"); }
  const pw = kind === "maker" ? f.pw.value : "";
  let r;
  try { r = await api.login(phone, pw); }
  catch (e) { if (e.code !== "needs_password") throw e; return firstPwSheet(phone); }
  D = null; await refresh(); afterSignIn(); backAfterLogin(); localReminders();
  if (r && r.must_change) setTimeout(() => mustChangeSheet(pw), 700);
};
function afterSignIn() {
  if (viewMode() === "admin" && D && !hasRights()) { LS.set("view", "member"); toast(t("notAdmin")); }
  // Right after signing in, ask once for notifications (the phone only allows this after a tap).
  if ("Notification" in window && Notification.permission === "default") setTimeout(() => sheet(t("notifyAskTitle"), `<p class="muted">${esc(t("notifyAskBody"))}</p><button class="btn primary block" data-act="notifyNow">${ic("bell")} ${esc(t("notifyAskTitle"))}</button>`), 600);
}
A.notifyNow = async (d, btn) => { closeSheet(); await enableNotifications(btn); };
F.firstpw = async (f) => {
  if ((f.pw.value || "").length < 6) throw new S.AppError("short_password");
  if (f.pw.value !== f.pw2.value) throw new S.AppError("pw_mismatch");
  if (pwIsPhone(f.pw.value, f.dataset.phone)) throw new S.AppError("pw_is_phone");
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
  const row = { group_id: f.dataset.g, month: f.month.value, title: f.title.value.trim(), link: f.link.value.trim() || null, table_json: res.tables || [], text_content: (res.text || "").slice(0, 60000),
    notify_list: f.notify.checked ? rosterNotifyList(f.dataset.g, res.tables || [], f.month.value) : [] };
  if (file) Object.assign(row, { file_name: file.name, mime: file.type || "application/octet-stream", file_b64: await P.toB64(file) });
  await api.save("roster", row); closeSheet(); LS.set("ym." + f.dataset.g, f.month.value); await refresh(); toast(t("saved"));
  location.hash = rosterHome(f.dataset.g, f.month.value);
};
F.group = async (f) => {
  const id = norm(f.name_en.value || f.name_id.value).replace(/ /g, "-").slice(0, 30) || "group-" + Date.now();
  await api.save("group", { id, kind: f.kind.value, name_id: f.name_id.value.trim(), name_bt: f.name_bt.value.trim() || f.name_id.value.trim(), name_en: f.name_en.value.trim() || f.name_id.value.trim(), color: f.color.value, icon: f.icon.value, sort: 50 });
  closeSheet(); await refresh(); toast(t("saved"));
};
F.password = async (f) => { if (pwIsPhone(f.pw.value, (D && D.me && D.me.phone) || "")) throw new S.AppError("pw_is_phone"); await api.setPassword(f.old.value, f.pw.value); closeSheet(); toast(t("saved")); };
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
  await busy(btn, async () => { try { await F[f.dataset.form](f); LS.set(key, null); render(); } catch (err) { if (err && err.silent) return; console.error(err); toast(errMsg(err), true); } });  // err.silent: the form showed its result in place (no page redraw)
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
// Starting Makers, given by the admin (YB). Phones come from the member list or from YB; the admin fills in any that are missing in a pop-up.
const TEACH_SEED = {
  "sekolah-minggu": [["@me", "tmaker"], ["Dien Pasaribu", "tmaker", "88783871"]],
  remaja: [["@me", "tmaker"], ["Royen Gultom", "tmaker"]],
  ama: [["@me", "tmaker"], ["Toga Sihombing", "tmaker", "97894504"]],
  ina: [["@me", "tmaker"], ["Dearni Purba", "tmaker", "97827584"]],
  pelaut: [["@me", "tmaker"], ["Reynold Limbong", "tmaker", "91244555"]],
  naposo: [["Naomi Lubis", "ychair", "89498420"], ["Vhasya Bintang", "ytreasurer", "91881205"], ["Gio Sihombing", "ysecretary", "90538139"]],
};
const normName = (n) => String(n || "").toLowerCase().replace(/^(pdt|st|sintua|cst|bapak|ibu|sdr|sdri|kak|bang)\.?\s+/g, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
function seedPerson([name, role, phone]) {
  if (name === "@me") return { name: D.me.name, phone: D.me.phone, role };
  const parts = normName(name).split(" ");
  const hit = D.people.filter((p) => { const n = normName(p.name); return parts.every((w) => n.split(" ").includes(w)); });
  return { name, role, phone: phone || (hit.length === 1 ? hit[0].phone || "" : "") };
}
const seedDone = (g, x) => D.people.some((p) => p.phone && p.phone === x.phone && (p.groups || {})[g] === x.role);
const teachSeedMissing = (only) => Object.entries(TEACH_SEED).filter(([g]) => !only || g === only).flatMap(([g, list]) => list.map((n) => ({ g, ...seedPerson(n) })))
  .filter((x) => !seedDone(x.g, x));
A.teachSetup = (d = {}) => {
  const only = d.g && TEACH_SEED[d.g] ? d.g : null;
  const rows = Object.entries(TEACH_SEED).filter(([g]) => !only || g === only).map(([g, list]) => `<h4>${esc(gname(G(g)))}</h4>` + list.map((n, i) => {
    const x = seedPerson(n); const done = seedDone(g, x);
    return `<div class="ts-row"><p class="small"><b>${esc(roleLabel(g, x.role))}</b></p><label>${esc(t("f_name"))}<input name="n_${g}_${i}" value="${esc(x.name)}" ${n[0] === "@me" ? "readonly" : ""}></label>
      <label>${esc(t("f_phone"))}${done ? ` <span class="badge chair">${ic("check")}</span>` : ""}<div class="phone-in"><span>+65</span><input name="p_${g}_${i}" inputmode="numeric" placeholder="8123 4567" value="${esc(x.phone)}"></div></label></div>`;
  }).join("")).join("");
  sheet(t("tsTitle"), `<form class="form" data-form="tsetup" data-g="${only || ""}"><p class="muted">${esc(t("tsLead"))}</p>${rows}
    <button class="btn primary block">${ic("check")} ${esc(t("tsSave"))}</button></form>`, (el) => { const e = [...el.querySelectorAll("input[name^=p_]")].find((x) => !x.value); if (e) e.focus(); });
};
F.tsetup = async (f) => {
  const missing = []; let n = 0;
  for (const [g, list] of Object.entries(TEACH_SEED).filter(([k]) => !f.dataset.g || k === f.dataset.g)) for (let i = 0; i < list.length; i++) {
    const name = f["n_" + g + "_" + i].value.trim(); const ph = f["p_" + g + "_" + i].value; const role = list[i][1];
    if (!S.phone8(ph)) { missing.push(name); continue; }
    if (!validPhone(ph)) throw new S.AppError("bad_phone");
    if (D.people.some((p) => p.phone === S.phone8(ph) && (p.groups || {})[g] === role)) continue;
    await api.setTeacher(ph, g, role, name); n++;
  }
  closeSheet(); await refresh();
  toast(missing.length ? t("tsMissing", [...new Set(missing)].join(", ")) : t("tsDone"), !!missing.length);
};
A.tmVerify = (d) => sheet(tmTitle(d.g), `<form class="form" data-form="tmcheck" data-g="${esc(d.g)}"><p class="muted">${esc(t("tmVerifyLead"))}</p>
  <label>${esc(t("f_phone"))}<div class="phone-in"><span>+65</span><input name="phone" inputmode="numeric" required placeholder="8123 4567" autocomplete="tel"></div></label>
  <button class="btn primary block">${esc(t("verify"))}</button></form>`, (el) => el.querySelector("input").focus());
F.tmcheck = async (f) => {
  // Must be the signed-in member's own number and a Teacher Maker of this class. The server checks every change again.
  if (S.phone8(f.phone.value) !== D.me.phone || !isTMaker(f.dataset.g)) { setTmOk(""); closeSheet(); toast(t("tmReject"), true); return; }
  setTmOk(f.dataset.g); closeSheet(); toast(t("tmOk"));
};

function teachersTab(gid, list) {
  const mk = canEdit(gid); const order = { ychair: 0, ytreasurer: 1, ysecretary: 2, tmaker: 3, teacher: 4 };
  const rows = list.slice().sort((a, b) => order[a.groups[gid]] - order[b.groups[gid]] || a.name.localeCompare(b.name)).map((p) => `<div class="li">${avatarOf(p)}
    <span class="grow"><b>${esc(p.name)}</b><small>${esc(roleLabel(gid, p.groups[gid]))}${p.phone ? " · " + esc(fmtPhone(p.phone)) : ""}</small></span>
    ${p.phone ? `<a class="icon-btn wa" href="https://wa.me/65${p.phone}" target="_blank" rel="noopener" aria-label="WhatsApp">${ic("wa")}</a>` : ""}
    ${mk && p.phone && p.id !== D.me.id ? `<button class="icon-btn" data-act="rmTeacher" data-g="${gid}" data-phone="${esc(p.phone)}" aria-label="${esc(t("delete"))}">${ic("trash")}</button>` : ""}</div>`).join("");
  return `<div class="card"><div class="card-h"><h3>${ic("people")} ${esc(t("t_teachers"))}</h3>${mk ? `<button class="btn sm primary" data-act="addTeacher" data-g="${gid}">${ic("plus")} ${esc(t("addTeacher"))}</button>` : ""}</div>
    <p class="small muted">${esc(t("teachersLead"))}</p>
    ${rows || `<p class="muted small">${esc(t("noTeachers"))}</p>`}
    ${isAdmin() ? `<button class="btn sm ghost" data-act="teachSetup" data-g="${gid}">${ic("gear")} ${esc(t("tsTitle"))}</button>` : ""}</div>`;
}
A.addTeacher = (d) => sheet(t("addTeacher"), `<form class="form" data-form="teacher" data-g="${esc(d.g)}"><p class="muted">${esc(t("addTeacherLead"))}</p>
  <label>${esc(t("f_teacherRole"))}<select name="role"><option value="teacher">${esc(t("role_teacher"))} · ${esc(t("teacherSub"))}</option>${makerRoles(d.g).map((r) => `<option value="${r}" ${d.r === r ? "selected" : ""}>${esc(roleLabel(d.g, r))} · ${esc(t("tmakerSub"))}</option>`).join("")}</select></label>
  <label>${esc(t("f_phone"))}<div class="phone-in"><span>+65</span><input name="phone" inputmode="numeric" required placeholder="8123 4567"></div></label>
  <label>${esc(t("f_nameIfNew"))}<input name="name" autocomplete="off"></label>
  <label class="check"><input type="checkbox" name="more"> ${esc(t("addAnother"))}</label>
  <button class="btn primary block">${ic("plus")} ${esc(t("addTeacher"))}</button></form>`, (el) => el.querySelector("input[name=phone]").focus());
F.teacher = async (f) => {
  const g = f.dataset.g; const role = f.role.value;
  const r = await api.setTeacher(f.phone.value, g, role, f.name.value.trim());
  const more = f.more.checked; await refresh(); toast(t("teacherAdded", r.name, roleLabel(g, role)));
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
  <button class="btn primary block">${esc(t("save"))}</button></form>`, (el) => el.querySelector("input").focus());
F.poll = async (f) => {
  const options = f.options.value.split("\n").map((x) => x.replace(/^\s*(\d+[.)]|[-•*])\s*/, "").trim()).filter(Boolean);
  if (options.length < 2 || options.length > 12) throw new S.AppError("poll_opts");
  await api.save("poll", { group_id: f.dataset.g, question: f.question.value.trim(), options, multi: f.multi.checked, status: f.open.checked ? "open" : "draft" }); // polls are for Makers only, so no group notification
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
  if (!isOffice() || !manage()) return "";
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
      ${hs.length ? hs.map((p) => `<div class="li">${avatarOf(p)}<span class="grow"><b>${esc(p.name)}</b><small>${esc(fmtPhone(p.phone))}</small></span>
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
async function saveOfficeFile(gid, file, title, note, notify, extra = {}) {
  if (file.size > 10 * 1048576) throw new S.AppError("file_too_big");
  const res = await api.save("file", { group_id: gid, title: title || file.name.replace(/\.[^.]+$/, ""), note: note || null, file_name: file.name, mime: file.type || "application/octet-stream", file_b64: await toB64(file), size: file.size, notify: !!notify, ...extra });
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
    <a class="opt-card" href="${wa(`📎 *${title}*\n${gname(G(gid))} · HKBP Singapore\n${appUrl()}${gid === "naposo" ? "#/g/naposo?tab=files" : gid === "band" ? "#/s/band" : "#/o/" + gid}`)}" target="_blank" rel="noopener">${ic("link")}<span><b>${esc(t("waSendLink"))}</b><small>${esc(t("waSendLinkSub"))}</small></span>${ic("chev", "chev")}</a>
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
  return `<div class="card"><div class="card-h"><h3>${ic("coins")} ${esc(t("financeTitle"))}</h3>${canUpload("treasurer") ? `<span class="row" style="margin:0;gap:6px"><button class="btn sm" data-act="finScan">📷 ${esc(L3("Scan struk", "Scan struk", "Scan receipt"))}</button><button class="btn sm primary" data-act="financeForm">${ic("edit")} ${esc(t(cur ? "financeEdit" : "financeNew"))}</button></span>` : ""}</div>
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
    <button type="button" class="btn block" data-act="finScan" data-day="${esc(sun)}">📷 ${esc(L3("Scan struk: isi jumlah SGD otomatis", "Scan struk", "Scan a receipt: fill in the SGD amounts"))}</button>
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

// Receipt scan (YB 2026-10-29): the treasurer takes a photo (or picks a screenshot) of the receipt; Claude reads the SGD amounts,
// they go into the SGD fields of the Warta Keuangan for the coming Sunday (the Warta date), it is saved, and only the
// Secretary and the Chairman get a push that the money parts were updated. Other currencies and other parts stay as they were.
A.finScan = (d) => {
  const sun = (d && d.day) || nextSunday();
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*";
  inp.onchange = async () => {
    const file = inp.files && inp.files[0]; if (!file) return;
    busySheet("📷 " + L3("Membaca struk", "Manjaha struk", "Reading the receipt"), L3("Claude sedang membaca jumlah SGD…", "Claude manjaha…", "Claude is reading the SGD amounts…"));
    try {
      let img = await resizeImage(file, 1600, 0.82); if (img.length > 900000) img = await resizeImage(file, 1200, 0.72);
      const p = finFor(sun); const prevSun = addDays(sun, -7);
      const x = p ? finParse(p.body) : { date: fmtID(prevSun), secs: [] };
      FIN_DEFAULT.forEach((df, i) => { if (!x.secs[i]) x.secs[i] = { ...df, items: [] }; });
      if (!x.secs[0].items.length) x.secs[0].items = FIN_A.map((name) => ({ name, amts: [] }));
      const names = [...new Set([...x.secs[0].items.map((r) => r.name).filter(Boolean), ...FIN_A])];
      const r = await aiRun("receipt", { image: img.split(",")[1], mime: "image/jpeg", names });
      const got = (r.items || []).filter((it) => it && it.name && isFinite(+it.sgd) && +it.sgd > 0);
      if (!got.length) throw new Error(L3("Tidak ada jumlah SGD yang terbaca. Coba foto lebih jelas, atau isi manual.", "Ndang terbaca.", "No SGD amount could be read. Try a clearer photo, or type it in."));
      // into the SGD field of the matching offering (or a new line for an offering not on the list yet)
      const key = (v) => norm(v).replace(/\s+/g, "");
      got.forEach((it) => {
        const k = key(it.name); let row = x.secs[0].items.find((q) => key(q.name) === k) || x.secs[0].items.find((q) => key(q.name) && (key(q.name).includes(k) || k.includes(key(q.name))));
        if (!row) { row = { name: it.name, amts: [] }; x.secs[0].items.push(row); }
        row.amts = row.amts || []; const sg = row.amts.find((a) => a.cur === "SGD");
        if (sg) sg.amt = String(+it.sgd); else row.amts.unshift({ cur: "SGD", amt: String(+it.sgd) });
      });
      const body = finBuild(x.date || fmtID(prevSun), x.secs);
      await api.save("post", { id: p ? p.id : undefined, group_id: "treasurer", kind: "finance", title: "Warta Keuangan " + sun, body, day: sun });
      const summary = got.map((it) => `${it.name}: SGD ${finNum(it.sgd)}`).join(" · ");
      const n = await api.save("fin_notify", { day: sun, label: fmtID(sun), summary }).catch(() => ({ told: 0 }));
      await refresh(); render(); LS.set("draft:finance:" + sun, null);
      sheet("✓ " + L3("Warta Keuangan diperbarui", "Warta Keuangan diperbarui", "Warta Keuangan updated"), `<p class="small muted">Warta ${esc(fmtID(sun))}${r.date ? " · " + esc(L3("tanggal struk", "tanggal", "receipt date")) + " " + esc(fmtID(r.date)) : ""}</p>
        <div class="card">${got.map((it) => `<div class="li"><span class="grow"><b>${esc(it.name)}</b></span><b>SGD ${esc(finNum(it.sgd))}</b></div>`).join("")}</div>
        ${r.note ? `<p class="small muted">${esc(r.note)}</p>` : ""}
        <p class="small">🔔 ${esc(L3(`Sekretaris dan Ketua sudah diberi tahu (${n.told || 0}).`, `Sekretaris dohot Ketua dipaboa (${n.told || 0}).`, `The Secretary and the Chairman were notified (${n.told || 0}).`))}</p>
        <button class="btn primary block" data-act="financeForm" data-day="${esc(sun)}">${ic("edit")} ${esc(L3("Periksa / ubah", "Ida / ubah", "Check / edit"))}</button>`);
    } catch (e) { closeSheet(); toast(e.message || errMsg(e), true); }
  };
  inp.click();
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
    // attendance last Sunday, counted by the QR check-in at the church door
    ...(((D.attendance || {})[addDays(day, -7)]) ? { attDate: fmtID(addDays(day, -7)), att: ["Bapak", "Ibu", "Naposo", "Remaja", "Sekolah Minggu"].map((k) => String(D.attendance[addDays(day, -7)][k] || "")) } : {}),
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

// ---------- Home-screen gate (YB 2026-10-27) ----------
// On a phone the app is used only from its home-screen icon. In a browser tab everything is covered by a one-tap
// "Add to Home Screen" screen: Android asks the browser to install; iPhone shows the Share → Add to Home Screen steps;
// a page opened inside WhatsApp/Facebook etc. first gets an "Open in Chrome / Safari" button. Laptops are not gated.
// Support: open …/hkbp/?web=1 to use the browser version for that visit.
const gateUA = navigator.userAgent;
const gIOS = () => /iPhone|iPad|iPod/.test(gateUA) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const gAndroid = () => /Android/.test(gateUA);
const gInApp = () => /FBAN|FBAV|FB_IAB|Instagram|Line\/|WhatsApp|Twitter|TikTok|Snapchat|MicroMessenger|GSA\/|; wv\)/.test(gateUA) || (gIOS() && !/Safari\//.test(gateUA));
const gateOff = () => { try { if (/[?&]web=1\b/.test(location.search + location.hash)) sessionStorage.setItem("hk-web", "1"); return sessionStorage.getItem("hk-web") === "1"; } catch { return false; } };
const gateNeeded = () => (gIOS() || gAndroid()) && !standalone() && !gateOff();
let gateState = "";   // "", "adding" or "done"
function gateRender() {
  const g = $("#gate"); if (!g) return;
  if (!gateNeeded()) { g.hidden = true; document.body.classList.remove("gated"); return; }
  let had = false; try { had = localStorage.getItem("hk-installed") === "1"; } catch {}
  const ios = gIOS(), inApp = gInApp(), bip = window.__bip, url = appUrl();
  const step = (n, icon, text, small) => `<li><span class="n">${n}</span><span class="k">${ic(icon)}</span><span>${esc(text)}${small ? `<small>${esc(small)}</small>` : ""}</span></li>`;
  let body;
  if (gateState === "done") body = `<div class="gdone">${ic("gcheck")}</div><h1>${esc(t("gateDoneTitle"))}</h1><p>${esc(t("gateDoneLead"))}</p>`;
  else if (inApp) {
    const br = ios ? "Safari" : "Chrome";
    const href = ios ? "x-safari-" + url : `intent://${url.replace(/^https?:\/\//, "")}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
    body = `<h1>${esc(t("gateTitle"))}</h1><p>${esc(t("gateInApp", br))}</p><a class="btn primary gbtn" href="${esc(href)}">${ic("gopen")}${esc(t(ios ? "gateOpenSafari" : "gateOpenChrome"))}</a>` +
      (ios ? `<ol class="gsteps">${step(1, "gdots", t("gateIosInApp1"))}${step(2, "gopen", t("gateOpenSafari"))}</ol>` : "");
  } else if (ios) {
    body = `<h1>${esc(t("gateTitle"))}</h1><p>${esc(t(had ? "gateHave" : "gateLead"))}</p><ol class="gsteps">${step(1, "gshare", t("gateStep1Ios"), t("gateShareWhere"))}${step(2, "gplus", t("gateStep2Ios"))}${step(3, "gcheck", t("gateStep3"))}</ol><div class="ghand" aria-hidden="true">👇</div>`;
  } else if (bip) {
    body = `<h1>${esc(t("gateTitle"))}</h1><p>${esc(t("gateLead"))}</p><button class="btn primary gbtn" data-act="gateAdd"${gateState === "adding" ? " disabled" : ""}>${ic("gplus")}${esc(t(gateState === "adding" ? "gateAdding" : "gateBtn"))}</button>`;
  } else {
    body = `<h1>${esc(t("gateTitle"))}</h1><p>${esc(t(had ? "gateHave" : "gateLead"))}</p><ol class="gsteps">${step(1, "gdots", t("gateStep1And"))}${step(2, "gplus", t("gateStep2And"))}${step(3, "gcheck", t("gateStep3"))}</ol>`;
  }
  g.innerHTML = `<div class="gl">${langSwitch()}<img class="gicon" src="icon-192.png" alt="Sada HKBPS">${body}<p class="gsmall">${esc(t("gateWhy"))}</p></div>`;
  g.hidden = false; document.body.classList.add("gated");
}
A.gateAdd = async () => {
  const e = window.__bip; if (!e) { gateRender(); return; }
  gateState = "adding"; gateRender();
  try { e.prompt(); const c = await e.userChoice; window.__bip = null; if (c && c.outcome === "accepted") { gateState = "done"; try { localStorage.setItem("hk-installed", "1"); } catch {} } else gateState = ""; }
  catch { gateState = ""; }
  gateRender();
};
document.addEventListener("bip", () => { if (gateState !== "done") gateRender(); });
document.addEventListener("hk-installed", () => { gateState = "done"; gateRender(); });
try { matchMedia("(display-mode: standalone)").addEventListener("change", () => gateRender()); } catch {}
gateRender();

// ---------- start ----------
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
window.addEventListener("message", (e) => { if (e.origin !== location.origin || !e.data || e.data.wb !== "present") return; const el = $("#wb"); if (el) el.classList.toggle("present", !!e.data.on); });
navigator.serviceWorker && navigator.serviceWorker.addEventListener("message", (e) => { if (e.data && e.data.url) location.hash = e.data.url; });
const qs = new URLSearchParams(location.search);
(async () => {
  if (qs.get("demo") === "1" && api.mode === "local" && await api.needsSetup()) { await seedDemo(); }
  await render(); localReminders();
})();
document.addEventListener("visibilitychange", async () => { if (document.visibilityState === "visible" && D && !/^#\/login/.test(location.hash)) { try { await refresh(); if (!$("#sheet").classList.contains("open")) render(); localReminders(); } catch {} } });
})();
