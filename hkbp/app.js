// HKBP Singapore: one app for the categorial groups (sermonic), service sections with monthly rosters,
// daily bread, birthdays, elders' updates and church events. Data layer in store.js, file readers in parse.js.
(() => {
"use strict";
const S = window.HKBP_STORE, P = window.HKBP_PARSE, I18N = window.HKBP_I18N;
const LS = S.LS;
let api = S.pick();
let D = null;               // everything the signed-in member may see
let lang = LS.get("lang", "en");   // English unless the member picked another language (YB 2026-10-31)
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
  gallery: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
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
  textsize: '<path d="M3 7V5h11v2M8.5 5v14M6.5 19h4M14 12v-1.5h7V12M17.5 10.5V19M16 19h3"/>',
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
function toast(msg, bad) { const el = $("#toast"); el.textContent = msg; el.className = "toast show" + (bad ? " bad" : ""); clearTimeout(toast.h); toast.h = setTimeout(() => (el.className = "toast"), String(msg).length > 90 ? 6500 : 2600); }
function errMsg(e) { if (e && e.viewOnly) return e.message; if (e && e.code === "roster_clash") return clashText(e.clash || []); const c = (e && e.code) || (e && e.message) || "server"; return t("err_" + c) !== "err_" + c ? t("err_" + c) : t("err_server"); }
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
// The verse of the day comes in all three languages (YB 2026-10-31): b.langs = {id, bt, en: {verse, title, body}}.
// The reader's pick (LS breadLang) wins, then the app language. An elder's own devotion has one language only.
const BREAD_LANGS = ["id", "bt", "en"];
function breadLangs(b) { return b && b.langs && b.author_name === "Ayat Harian" ? BREAD_LANGS.filter((l) => b.langs[l] && b.langs[l].body) : []; }
function breadPick(b) { const ls = breadLangs(b); const want = LS.get("breadLang", lang); return ls.includes(want) ? want : ls.includes(lang) ? lang : ls[0] || ""; }
// A one-verse reading shows no verse number (YB 2026-10-31): "1 For everything…" reads "For everything…".
const breadOne = (o) => (o && o.author_name === "Ayat Harian" && o.verse && !/[-–,;]/.test(o.verse.split(":").slice(1).join(":")) && /^\d+\s/.test(o.body || "") ? { ...o, body: o.body.replace(/^\d+\s+/, "") } : o);
function breadOf(b) { const l = breadPick(b); return breadOne(l ? { ...b, ...b.langs[l], lang: l } : b); }
function breadText(b) { b = breadOf(b); return `📖 *${t("breadTitle")} · HKBP Singapore*\n${fmtDay(b.day)}\n\n*${b.title || ""}*\n${b.verse || ""}\n\n${b.body || ""}\n\n${appUrl()}#/bread/${b.day}`; }
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
// Inside the Jarvis home-screen app (it sets "jarvis.noNotify"), Sada never asks for, keeps or shows notifications,
// so nothing reaches the user under Jarvis's name (YB 2026-10-31). The Sada HKBPS app itself is unaffected.
const inJarvis = () => { try { return localStorage.getItem("jarvis.noNotify") === "1"; } catch { return false; } };
async function swReg() { if (!("serviceWorker" in navigator)) return null; try { return await navigator.serviceWorker.ready; } catch { return null; } }
function b64urlToU8(s) { const p = "=".repeat((4 - (s.length % 4)) % 4); const b = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(b, (c) => c.charCodeAt(0)); }
const vapid = () => (D && D.settings && D.settings.vapid_public) || (api.cfg && api.cfg.vapidPublicKey) || "";
async function enableNotifications(btn) {
  if (inJarvis()) { toast(L3("Notifikasi mati di Jarvis. Buka aplikasi Sada HKBPS untuk menyalakannya.", "Notifikasi mate di Jarvis. Buka aplikasi Sada HKBPS laho pasangkon.", "Notifications are off inside Jarvis. Open the Sada HKBPS app to turn them on."), true); return; }
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
  if (inJarvis()) { try { const r = reg || await swReg(); const s = r && r.pushManager && await r.pushManager.getSubscription(); if (s) await s.unsubscribe(); } catch {} return false; }
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
const NUDGE_SKIP = ["80001234"]; // Claude's test number, not a person
async function localReminders() {
  if (inJarvis()) return;
  if (D && !isGuest()) await ensurePush();
  if (!D || !LS.get("notifyOn") || !("Notification" in window) || Notification.permission !== "granted") return;
  if (api.mode === "remote" && LS.get("pushOn") && vapid()) return; // the server sends these
  const reg = await swReg(); if (!reg) return;
  const shown = LS.get("shown", {}); const day = today(); const once = (k) => { if (shown[k]) return false; shown[k] = day; return true; };
  const b = breadOf(D.bread.find((x) => x.day === day));
  if (b && once("bread:" + day)) reg.showNotification(`📖 ${t("breadTitle")}: ${b.title || ""}`, { body: `${b.verse || ""}\n${(b.body || "").slice(0, 140)}`, icon: "icon-192.png", tag: "bread", data: { url: "#/bread" } });
  if (me().dob && me().dob.slice(5) === day.slice(5) && once("bday:" + day)) reg.showNotification(t("hbdTitle", firstName(me().name)), { body: t("hbdBody"), icon: "icon-192.png", tag: "bday" });
  if (me().wed && me().wed.slice(5) === day.slice(5) && once("anniv:" + day)) reg.showNotification(t("annivTitle", firstName(me().name)), { body: t("annivBody"), icon: "icon-192.png", tag: "anniv" });
  const now = Date.now();
  D.events.forEach((e) => { const st = new Date(e.starts_at).getTime(); if (st > now && st - e.remind_min * 60e3 <= now && once("ev:" + e.id)) reg.showNotification(`🗓 ${e.title}`, { body: `${fmtDay(sgParts(e.starts_at).date)} · ${fmtTime(e.starts_at)}${e.place ? " · " + e.place : ""}`, icon: "icon-192.png", tag: "ev-" + e.id, data: { url: "#/calendar" } }); });
  Object.keys(shown).forEach((k) => { if (shown[k] < addDays(day, -40)) delete shown[k]; });
  LS.set("shown", shown);
}

// ---------- Verse of the day writer (free) ----------
async function claudeBread(day, langCode, recent) {
  // free (YB 2026-10-30): a well-known verse, read from SABDA, with a short prayer; the elder can add their own reflection
  const L = ["Mazmur 23:1-4", "Yohanes 3:16-17", "Roma 8:28", "Filipi 4:6-7", "Yesaya 41:10", "Amsal 3:5-6", "Matius 11:28-30", "Yeremia 29:11", "Mazmur 121:1-8", "Yesaya 40:29-31", "Matius 6:33-34", "Yosua 1:9", "Ratapan 3:22-23", "Mikha 6:8", "1 Tesalonika 5:16-18", "Yohanes 14:27", "2 Korintus 12:9", "Galatia 5:22-23", "Filipi 4:13", "Mazmur 46:2-4"];
  const ref = L.filter((r) => !recent.includes(r))[Math.floor(Math.random() * L.length) % Math.max(1, L.filter((r) => !recent.includes(r)).length)] || L[0];
  const vs = await litPassage(ref, langCode === "bt" ? "toba" : "tb");
  const pray = { id: "Doa: Tuhan, terima kasih untuk firman-Mu hari ini. Tolonglah kami hidup menurut firman-Mu. Amin.", bt: "Tangiang: Ale Tuhan, mauliate di hata-Mu sadarion. Urupi ma hami mangolu hombar tu hata-Mu. Amen.", en: "Prayer: Lord, thank you for your word today. Help us to live by it. Amen." }[langCode] || "";
  return { verse: ref, title: langCode === "bt" ? "Ayat Siganup Ari" : langCode === "en" ? "Verse of the Day" : "Ayat Harian", body: (vs.length === 1 ? vs[0].t : vs.map((v) => `${v.v} ${v.t}`).join(" ")) + "\n\n" + pray };
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
const TABS_ALL = [["home", "#/home", "tab_home"], ["groups", "#/groups", "tab_groups"], ["calendar", "#/calendar", "sched"], ["chat", "#/chat", "Chat"], ["book", "#/library", "lib"], ["more", "#/more", "tab_more"]];
function shell(active, inner, opts = {}) {
  // People who are not signed in see only Home, plus a Sign in tab (YB 2026-10-28).
  const tabs = isGuest() ? TABS_ALL.filter(([, h]) => h === "#/home") : navTabs();
  // Rosters pages light up the Schedule tab too (YB 2026-10-29: calendar and rosters combined).
  const act = active === "#/serve" ? "#/calendar" : active; CUR_TAB = act; const label = (k) => (k === "sched" ? L3("Jadwal", "Jadwal", "Schedule") : k === "lib" ? L3("Dokumen", "Dokumen", "Documents") : k === "Chat" ? "Chat" : t(k));
  const nav = tabs.map(([i, h, k]) => `<a href="${h}" class="${act === h ? "on" : ""}" ${act === h ? 'aria-current="page"' : ""}>${ic(i)}${tabBadge(h)}<span>${esc(label(k))}</span></a>`).join("")
    + (isGuest() ? `<a href="#/login" data-act="signIn">${ic("lock")}<span>${esc(t("signIn"))}</span></a>` : "");
  return `
  <header class="top${opts.back || opts.title ? "" : " plain"}">
    ${opts.back ? `<a class="icon-btn" href="${opts.back}" aria-label="${esc(t("back"))}">${ic("back")}</a>` : `<img class="logo-sm" src="logo.png" alt="">`}
    <div class="brand"><b>${esc(opts.title || "Sada HKBPS")}</b>${opts.sub ? `<small>${esc(opts.sub)}</small>` : `<small>${esc(t("tagline"))}</small>`}</div>
    ${callHead()}${langSwitch()}
  </header>
  ${D && D.offline ? `<div class="banner">${esc(t("offline"))}</div>` : ""}
  ${api.mode === "local" ? `<div class="banner soft">${ic("phone")} ${esc(t("demoBanner"))}</div>` : ""}
  <main${opts.cols ? ' class="cols"' : ""}>${inner}</main>
  <nav class="tabs"><div class="in" style="grid-template-columns:repeat(${tabs.length + (isGuest() ? 1 : 0)},1fr)"><a class="nav-brand" href="#/home"><img src="logo.png" alt=""><span><b>Sada HKBPS</b><small>${esc(t("tagline"))}</small></span></a>${nav}${!isGuest() ? `<a href="#/chat" class="nav-chat${act === "#/chat" ? " on" : ""}">${ic("chat")}${tabBadge("#/chat")}<span>Chat</span></a>` : ""}<div class="nav-foot">${langSwitch()}</div></div></nav>
  ${!isGuest() && act !== "#/chat" && !/^#\/search/.test(location.hash) ? `<a id="chatFab" class="chat-fab" href="#/chat" aria-label="Chat" draggable="false" style="${chatFabPos()}">${ic("chat")}${tabBadge("#/chat")}</a>` : ""}`;
}
const langSwitch = () => `<div class="langs" role="group" aria-label="${esc(t("language"))}">${["id", "bt", "en"].map((l) => `<button data-act="lang" data-l="${l}" aria-pressed="${lang === l}">${l.toUpperCase()}</button>`).join("")}</div>`;
const empty = (msg, icon = "star") => `<div class="empty">${ic(icon)}<p>${esc(msg)}</p></div>`;
const roleBadge = (gid) => { if (!manage()) return ""; const r = isAdmin() && !roleIn(gid) ? "admin" : roleIn(gid); return r ? `<span class="badge ${MAKERS.includes(r) ? "chair" : r === "teacher" ? "member" : r}">${esc(roleLabel(gid, r))}</span>` : ""; };
const groupTile = (g, extra = "") => `<a class="gtile" href="#/${({ sermon: "g", office: "o" })[g.kind] || "s"}/${g.id}" style="--gc:${g.color}">
    ${gIcon(g)}<span class="gname"><b>${esc(gname(g))}</b><small>${extra}</small></span>${newBadge(g.kind !== "office" && groupNew(g.id))}${roleBadge(g.id)}${ic("chev", "chev")}</a>`;

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
      <div class="pk-slot"></div>
      <form class="card form" data-form="login">
        <label>${esc(t("f_phone"))}<div class="phone-in"><span>+65</span><input name="phone" inputmode="numeric" required placeholder="8123 4567" autocomplete="username" data-phonecheck value="${esc(LS.get("remote.phone") || "")}"></div></label>
        <p class="small muted pc-hint" aria-live="polite"></p>
        <p class="small muted pc-note">${esc(t("pcNotice"))}</p>
        <div class="pc-reg" hidden><label>${esc(t("f_name"))}<input name="rname" maxlength="80" autocomplete="name"></label></div>
        <div class="pc-pw" hidden><label>${esc(t("f_password"))}<input name="pw" type="password" autocomplete="current-password"></label><button type="button" class="btn block pk-pw" data-act="pkLogin" hidden></button></div>
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
  if (!isGuest() && simpleKind()) return simpleHome();
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
    <section class="hello hero">
      <p class="hero-date">${esc(fmtDay(day))}</p>
      <h1>${esc(t(hour < 11 ? "morning" : hour < 15 ? "afternoon" : hour < 18 ? "evening1" : "evening2"))}${m.name ? ", " + esc(firstName(m.name)) : ""}</h1>
      ${isGuest() ? "" : `<a class="search-entry hero-search" href="#/search">${ic("search")}<span>${esc(L3("Cari anggota, lagu, dokumen, acara…", "Lului ruas, ende, dokumen…", "Search members, songs, documents, events…"))}</span></a>`}
    </section>
    ${isGuest() ? `<button class="card notify-ask" data-act="signIn">${ic("lock")}<span><b>${esc(t("guestTitle"))}</b><small>${esc(L3("Masuk untuk melihat Tata Ibadah, kalender, roster, kategorial dan tugas Anda.", "Bongot jolo asa diida Tata Ibadah, kalender, roster, kategorial dohot ulaonmu.", "Sign in to see the Tata Ibadah, calendar, rosters, your categories and your duties."))}</small></span>${ic("chev", "chev")}</button>` : ""}
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
        <p class="verse-ref">${esc(breadOf(b).verse || "")}</p>
        <h2>${esc(breadOf(b).title || "")}</h2>
        <p class="clamp pre">${esc(breadOf(b).body || "")}</p>
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
        <span class="gcard-bg"></span>${gIcon(g, "lg")}
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
  const quizOn = gid === "remaja" && !isGuest() && (D.me.is_admin || gid in (D.me.groups || {}));
  const tabs = [["sermon", "t_sermon", sermons.length], ...(slidesOn ? [["slides", "Slide", 0]] : []), ...(filesOn ? [["files", "File & Video", yfiles.length]] : []), ...(rosterOn ? [["roster", "Roster", D.rosters.filter((r) => r.group_id === gid && r.month === rym).length]] : []), ...(pollsOn ? [["polls", "t_polls", polls.filter((p) => p.status === "open").length]] : []), ...(quizOn ? [["quiz", "🎯 Kuis", 0]] : []), ["news", "t_news", news.length], ["events", "t_events", evs.length], ...(teach ? [["teachers", "t_teachers", teachers.length]] : []), ["members", "t_members", people.length]];
  let body = "";
  if (!ok) body = isGuest() ? signInCard(t("signInCat")) : empty(t("membersOnlyLong"), "lock");
  else if (tab === "slides" && slidesOn) body = ssList();
  else if (tab === "roster" && rosterOn) body = rosterBlock(gid, rym);
  else if (tab === "files" && filesOn) body = youthFilesTab(gid, yfiles);
  else if (tab === "polls" && pollsOn) body = pollsTab(gid, polls);
  else if (tab === "quiz" && quizOn) body = quizTab(gid);
  else if (tab === "teachers" && teach) body = teachersTab(gid, teachers);
  else if (tab === "sermon") body = (edit && g.kind === "sermon" ? `<button class="btn block" data-act="discuss" data-g="${gid}">✨ ${esc(L3("Bahan diskusi dari Tata Ibadah Minggu ini", "Bahan diskusi sian Tata Ibadah", "Discussion questions from Sunday's Tata Ibadah"))}</button>` : "") + (edit ? `<button class="btn primary block" data-act="newPost" data-g="${gid}" data-kind="sermon">${ic("plus")} ${esc(t("newSermon"))}</button>` : "") + (sermons.length ? sermons.map((p) => postCard(p, edit)).join("") : empty(t("noSermon"), "book"));
  else if (tab === "news") body = (edit ? `<button class="btn primary block" data-act="newPost" data-g="${gid}" data-kind="news">${ic("plus")} ${esc(t("newNews"))}</button>` : "") + (news.length ? news.map((p) => postCard(p, edit)).join("") : empty(t("noNews"), "bell"));
  else if (tab === "events") body = (canEvents() ? `<button class="btn primary block" data-act="newEvent" data-g="${gid}">${ic("plus")} ${esc(t("newEvent"))}</button>` : "") + `<div class="card">${evs.length ? evs.map(eventRow).join("") : `<p class="muted small">${esc(t("noEvents"))}</p>`}</div>`;
  else body = peopleList(people, gid);
  const svc = g.kind === "service";
  return shell(svc ? "#/serve" : "#/groups", `
    <section class="ghero" style="--gc:${g.color}">
      ${heroPic(g)}
      <div><h2>${esc(gname(g))}</h2><p>${esc(t("motto_" + g.id) !== "motto_" + g.id ? t("motto_" + g.id) : t(svc ? "kindService" : "kindSermon"))}</p>${roleBadge(gid) ? `<div class="hero-role">${roleBadge(gid)} <small>${esc(edit ? t("canUpdate") : teach && canRunPoll(gid) ? t("teacherSub") : t("readOnly"))}</small></div>` : ""}</div>
    </section>
    ${ok ? wishCard(g, people) : ""}
    ${elders && ok ? `<div class="row two"><a class="btn" href="#/elders">${ic("book")} ${esc(t("eldersUpdates"))}</a><a class="btn" href="#/bread">${ic("bread")} ${esc(t("breadTitle"))}</a></div>` : ""}
    ${gid === "naposo" ? natalBlock(gid) : ""}
    ${ok && teach && manage() && isTMaker(gid) && !tmOk(gid) ? `<button class="card notify-ask" data-act="tmVerify" data-g="${gid}">${ic("lock")}<span><b>${esc(tmTitle(gid))}</b><small>${esc(t("tmNeedVerify"))}</small></span>${ic("chev", "chev")}</button>` : ""}
    ${ok ? `<div class="seg" role="tablist" style="--gc:${g.color}">${tabs.map(([k, l, n]) => `<a role="tab" aria-selected="${tab === k}" href="#/g/${gid}?tab=${k}">${esc(t(l))}${n ? ` <i>${n}</i>` : ""}</a>`).join("")}</div>` : ""}
    <div style="--gc:${g.color}">${body}</div>
    ${!svc && !isGuest() ? `<div class="row two cat-links" style="--gc:${g.color}"><a class="card cat-link" href="#/tutur"><b>🤝 Partuturan</b><small>${esc(L3("Cara saling menyapa", "Partuturan", "How to address each other"))}</small></a><a class="card cat-link" href="#/ende"><b>🎵 Buku Ende</b><small>${esc(L3("Arti setiap baris lagu", "Lapatan ni ende", "The meaning of every hymn line"))}</small></a></div>` : ""}`, { back: svc ? "#/serve" : "#/groups", title: gname(g), sub: t(svc ? "kindService" : "kindSermon") });
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
    + (!vids.length && !docs.length ? empty(L3("Belum ada file atau video.", "Ndang adong file manang video.", "No files or videos yet."), "folder") : "");
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
      return `<h3 class="sec-h">${esc(L3("Roster Parhalado", "Roster Parhalado", "Elders' roster"))}</h3><div class="glist"><a class="gtile" href="${rosterHome(g.id, ym)}" style="--gc:${g.color}">${gIcon(g)}<span class="gname"><b>${esc(gname(g))}</b><small>${has ? "✓ " : ""}${esc(t(has ? "rosterReady" : "rosterMissing", monthName(ym)))}${open ? " · " + esc(L3(`${open} polling terbuka`, `${open} polling bukka`, `${open} open poll${open > 1 ? "s" : ""}`)) : ""}</small></span>${roleBadge(g.id)}${ic("chev", "chev")}</a></div>`; })()}
    ${(() => { // Teachers' rosters (Sunday School, Remaja) also listed here for their teachers; they open the class's Roster tab.
      const cls = ROSTER_CATS.map(G).filter((g) => g && isTeacherIn(g.id)); if (!cls.length) return "";
      return `<h3 class="sec-h">${esc(L3("Roster Guru", "Roster Guru", "Teachers' rosters"))}</h3><div class="glist">${cls.map((g) => { const has = D.rosters.some((r) => r.group_id === g.id && r.month === ym);
        return `<a class="gtile" href="${rosterHome(g.id, ym)}" style="--gc:${g.color}">${gIcon(g)}<span class="gname"><b>${esc(gname(g))}</b><small>${has ? "✓ " : ""}${esc(t(has ? "rosterReady" : "rosterMissing", monthName(ym)))}</small></span>${roleBadge(g.id)}${ic("chev", "chev")}</a>`; }).join("")}</div>`; })()}
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
      ${heroPic(g)}
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
    ${edit ? `<button class="btn block" data-act="rosterDraft" data-g="${gid}" data-m="${ym}">✨ ${esc(L3("Buat draf roster bulan ini secara adil", "Draf roster na adil", "Draft this month fairly"))}</button>` : ""}
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
  const part = (icon, title, list, kind) => list.length ? `<div class="card cal-part ${kind || ""}"><div class="card-h"><h3>${icon} ${esc(title)}</h3><span class="badge">${list.length}</span></div>${list.sort((a, c) => a.k.localeCompare(c.k)).map((x) => x.html).join("")}</div>` : "";
  return shell("#/calendar", `
    ${schedHead("agenda")}
    <div class="row two">${canAdd ? `<button class="btn primary" data-act="newEvent">${ic("plus")} ${esc(t("newEvent"))}</button>` : ""}${isElder() ? `<button class="btn" data-act="bdayTools">${ic("cake")} ${esc(L3("Ulang tahun", "Ari tubu", "Birthdays"))}</button>` : ""}<button class="btn" data-act="phoneCal">${ic("download")} ${esc(L3("Ke kalender HP", "Tu kalender HP", "To my phone"))}</button></div>
    ${months.length ? months.map((k) => `<h2 class="month-h"><span>📅 ${esc(monthName(k))}</span></h2>
      ${part(ic("check"), L3("Tugas Anda", "Ulaonmu", "Your duties"), byMonth[k].du, "du")}
      ${part(ic("screen"), L3("Rapat", "Rapat", "Meetings"), byMonth[k].mt, "mt")}
      ${part(ic("calendar"), L3("Acara", "Ulaon", "Events"), byMonth[k].ev, "ev")}
      ${part(ic("cake"), L3("Ulang Tahun", "Ari Tubu", "Birthdays"), byMonth[k].bd, "bd")}
      ${part("💍", L3("Ulang Tahun Pernikahan", "Ulang Taon Pardongan Saripeon", "Wedding anniversaries"), byMonth[k].an, "an")}`).join("") : empty(t("noEvents"), "calendar")}
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
    <div class="seg sched-seg" role="tablist" style="--gc:var(--brand)">${seg("agenda", "#/calendar", "calendar", "Warnasari")}${seg("roster", "#/serve", "roster", "Roster")}${isGuest() ? "" : seg("meet", "#/meet", "screen", L3("Rapat", "Rapat", "Meetings"))}${isLit() ? seg("lit", "#/lit", "book", L3("Liturgi", "Liturgi", "Liturgy")) : ""}</div>
    <p class="lead">${esc(which === "agenda" ? L3("Acara, tugas Anda, rapat, ulang tahun dan ulang tahun pernikahan setiap bulan.", "Ulaon, ulaonmu, rapat, ari tubu dohot ari pardongan saripeon sadarion bulan.", "Each month's events, your duties, meetings, birthdays and anniversaries.") : which === "lit" ? L3("Naskah liturgis setiap minggu: sambutan, nyanyian, Agenda, nas, dan aba-aba berdiri/duduk. Tampilkan sebagai slide.", "Naskah paragenda.", "The liturgist's script for each week: welcome, songs, Agenda, readings and stand/sit cues. Show it as slides.") : which === "meet" ? L3("Rapat video gratis: video, suara, berbagi layar, chat, angkat tangan, ruang kecil, polling, latar virtual, dan rekam.", "Rapat video.", "Free video meetings: video, audio, screen sharing, chat, raise hand, breakout rooms, polls, virtual backgrounds and recording.") : t("serveLead"))}</p>`;
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
  const bls = breadLangs(b), bl = b ? breadOf(b) : null;
  return shell("#/home", `
    ${b ? `<article class="bread-full" lang="${esc(bl.lang === "bt" ? "bbc" : bl.lang || lang)}">
      <div class="kicker">${ic("bread")} ${esc(t("breadTitle"))} · ${esc(fmtDay(b.day))}</div>
      ${bls.length > 1 ? `<div class="chips bread-langs" role="group" aria-label="${esc(L3("Bahasa", "Hata", "Language"))}">${bls.map((l) => `<button class="chip${l === bl.lang ? " on" : ""}" data-act="breadLang" data-l="${l}" aria-pressed="${l === bl.lang}">${esc({ id: "Indonesia", bt: "Batak", en: "English" }[l])}</button>`).join("")}</div>` : ""}
      <p>${speakBtn(".bread-full")}</p>
      <h1>${esc(bl.title || "")}</h1>
      <p class="verse-ref big">${esc(bl.verse || "")}</p>
      <div class="pre body">${esc(bl.body || "")}</div>
      ${bls.length ? "" : `<p class="small muted">${esc(b.author_name || "")}</p>`}
      ${/[?&]wa=1/.test(location.hash) ? `<div class="card wa-send"><b>${ic("wa")} ${esc(t("waSendTitle"))}</b><p class="small">${esc(t("waSendSteps"))}</p><a class="btn wa block" href="${wa(breadText(b))}" target="_blank" rel="noopener">${ic("wa")} ${esc(t("waSendBtn"))}</a></div>` : ""}
      <div class="row two"><a class="btn wa" href="${wa(breadText(b))}" target="_blank" rel="noopener">${ic("wa")} ${esc(t("shareWa"))}</a><button class="btn" data-act="copyBread" data-day="${b.day}">${ic("share")} ${esc(t("copy"))}</button></div>
      ${isBreadMaker() ? `<div class="row two"><a class="btn" href="#/bread/edit-${b.day}">${ic("edit")} ${esc(t("edit"))}</a><button class="btn danger" data-act="del" data-kind="bread" data-id="${b.day}">${ic("trash")} ${esc(t("delete"))}</button></div>` : ""}
    </article>` : empty(t("noBread"), "bread")}
    ${(D.settings || {}).wa_group_link ? `<a class="btn wa block" href="${esc(D.settings.wa_group_link)}" target="_blank" rel="noopener">${ic("wa")} ${esc(t("joinWaGroup"))}</a>` : ""}
    ${isAdmin() ? `<button class="card li" data-act="breadSetup">${ic("gear")}<span class="grow"><b>${esc(t("bs_title"))}</b><small>${esc(breadSrcLabel())} · ${String((D.settings || {}).bread_hour ?? 6).padStart(2, "0")}:00</small></span>${ic("chev", "chev")}</button>` : ""}
    ${isBreadMaker() ? `<div class="card"><h3>${ic("edit")} ${esc(t("breadPlan"))}</h3><p class="small muted">${esc(t("breadPlanLead"))}</p>
      <div class="row two"><a class="btn primary" href="#/bread/new">${ic("plus")} ${esc(t("writeBread"))}</a><button class="btn" data-act="genWeek">${ic("ai")} ${esc(t("genWeek"))}</button></div>
      ${future.length ? `<div class="chips">${future.map((x) => `<a class="chip" href="#/bread/${x.day}">${esc(fmtShort(x.day))}</a>`).join("")}</div>` : ""}</div>` : ""}
    <h3 class="sec-h">${esc(t("breadArchive"))}</h3>
    <div class="card">${list.filter((x) => x.day <= day).slice(0, 40).map((x) => `<a class="li" href="#/bread/${x.day}"><span class="date-chip"><b>${esc(fmt(x.day, { day: "numeric" }))}</b><small>${esc(fmt(x.day, { month: "short" }))}</small></span><span class="grow"><b>${esc(breadOf(x).title || "")}</b><small>${esc(breadOf(x).verse || "")}</small></span></a>`).join("") || `<p class="muted small">${esc(t("noBread"))}</p>`}</div>`,
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
        <button class="btn sm pf-photo" data-act="photoPick">${ic("camera")} ${esc(D.photos && D.photos[m.id] ? L3("Ganti foto profil", "Ganti foto profil", "Change profile photo") : L3("Tambah foto profil", "Tambah foto profil", "Add a profile photo"))}</button>
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
      ${isAdmin() ? `<button class="li" data-act="breadSetup">${ic("bread")}<span class="grow"><b>${esc(t("bs_title"))}</b><small>${esc(breadSrcLabel())}</small></span>${ic("chev", "chev")}</button>` : ""}
      ${serveOn() && manage() ? `<button class="li" data-act="servePick">${ic("calendar")}<span class="grow"><b>${esc(t("svTitle"))}</b><small>${esc((me().profile || {}).serve ? me().profile.serve.map((id) => gname(G(id))).filter(Boolean).join(", ") || t("svNone") : t("pfNotYet"))}</small></span>${ic("chev", "chev")}</button>` : ""}
      ${pfSkipped() && manage() ? `<button class="li" data-act="pfTest">${ic("spark")}<span class="grow"><b>${esc(t(LS.get("pfTest") ? "pfTestEnd" : "pfTestStart"))}</b><small>${esc(t(LS.get("pfTest") ? "pfTestOnSub" : "pfTestSub"))}</small></span>${ic("chev", "chev")}</button>` : ""}
      ${profileOn() ? `<button class="li" data-act="profile">${ic("people")}<span class="grow"><b>${esc(t("pfTitle"))}</b><small>${esc(me().profile ? profileCats(me().profile).map((id) => gname(G(id))).filter(Boolean).join(", ") : t("pfNotYet"))}</small></span>${ic("chev", "chev")}</button>` : ""}
      ${typeof pkMenuItem === "function" ? pkMenuItem() : ""}
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
  Promise.all([api.appStatus(), api.phoneTries ? api.phoneTries().catch(() => []) : []]).then(([r, tr]) => { AS.rows = r || []; AS.tries = (tr || []).filter((r) => !NUDGE_SKIP.includes(r.phone)); asFill(); }).catch((e) => { const el = $("#asList"); if (el) el.innerHTML = empty(errMsg(e)); });
  const hc = HYMN.selfTest();
  return shell("#/more", `${hc.fails.length ? `<div class="card li"><span class="grow"><b>🎵 Hymn splitter: ${hc.pass}/${hc.total} ✗</b><small>${esc(hc.fails.join(" · "))}</small></span></div>` : ""}<div id="asList">${skel(4)}</div>`, { back: "#/more", title: t("asShort"), sub: t("asSub") });
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
    const map = { quizwb: R.quizwb, sunday: R.sunday, usage: R.usage, tarombo: R.tarombo, rpp: R.rpp, lit: R.lit, litwb: R.litwb, doc: R.doc, library: R.library, song: R.song, access: R.access, sswb: R.sswb, ssdeck: R.ssdeck, fx: R.fx, meet: R.meet, tutur: R.tutur, ende: R.ende, stories: R.stories, voyage: R.voyage, live: R.live, grief: R.grief, care: R.care, search: R.search, prayer: R.prayer, checkin: R.checkin, checkinqr: R.checkinqr, chat: R.chat, call: R.call, tata: R.tata, home: R.home, groups: R.groups, g: R.group, serve: R.serve, s: R.section, calendar: R.calendar, bread: R.bread, elders: R.elders, berita: R.berita, people: R.people, more: R.more, appstatus: R.appstatus, o: R.office, warta: R.warta };
    try { usageTick(r); } catch (e) {}
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
    else if (notifyNeeded()) setTimeout(() => { if ($("#sheet").hidden && notifyNeeded()) notifyPrompt(); }, 1200);
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
try { document.head.insertAdjacentHTML("beforeend", `<style>
  /* search results (YB 2026-10-30): a leading tile, a small kicker, one-line titles, two-line passages */
  .deep-li { align-items: center; gap: 12px; } .deep-li .grow { min-width: 0; display: grid; gap: 1px; }
  .sx-lead { flex: none; width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center; font-size: 22px; background: color-mix(in srgb, var(--brand) 8%, var(--surface)); }
  .sx-book { display: grid; place-items: center; width: 46px; height: 46px; border-radius: 14px; font-size: 10.5px; font-weight: 900; letter-spacing: .06em; color: #fff; line-height: 1.05; }
  .sx-book b { font-size: 16px; letter-spacing: 0; } .sx-book.kj { background: linear-gradient(140deg, #2f6fd1, #1d4fa3); } .sx-book.be { background: linear-gradient(140deg, #2f9e62, #1d7448); } .sx-book.bn { background: linear-gradient(140deg, #8a4fd6, #6233a8); }
  .sx-lead:has(.sx-book), .sx-lead:has(.sx-date) { background: none; } .sx-doc { font-size: 22px; }
  .sx-date { display: grid; place-items: center; width: 46px; height: 46px; border-radius: 14px; background: color-mix(in srgb, var(--gold, #d8b25e) 22%, var(--surface)); color: #8a5a00; font-size: 10.5px; font-weight: 800; text-transform: uppercase; line-height: 1.05; } .sx-date b { font-size: 17px; }
  .sx-kick { font-style: normal; font-size: 11px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); }
  .sx-t { font-size: 15px; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
  .sx-s { font-size: 13px; line-height: 1.4; color: var(--muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .deep-li mark { background: #ffe58f; color: inherit; border-radius: 4px; padding: 0 2px; }
</style>`); } catch (e) {}
// ---------- Search, the look (YB 2026-10-30): one search bar, filter chips with counts, tidy sections, recent searches ----------
const SX = { f: "all" };
const SX_KINDS = [
  [/^(Anggota|Ruas|Members)$/i, "people", "👤", ["Anggota", "Ruas", "Members"]], [/^(Kategorial|Groups|Kategori)/i, "groups", "👥", ["Kategorial", "Kategorial", "Groups"]],
  [/^(Acara|Ulaon|Events)$/i, "events", "🗓", ["Acara", "Ulaon", "Events"]], [/^(Roster|Rosters)$/i, "roster", "📋", ["Roster", "Roster", "Rosters"]],
  [/^(File & video|Files & videos)$/i, "files", "📁", ["File", "File", "Files"]], [/^(Kiriman|Posts)$/i, "posts", "📝", ["Kiriman", "Kiriman", "Posts"]],
  [/Alkitab|Bibel|Bible/i, "bible", "📖", ["Alkitab", "Bibel", "Bible"]], [/Nyanyian|Ende|Songs/i, "songs", "🎵", ["Lagu", "Ende", "Songs"]],
  [/Dokumen|Church documents/i, "docs", "📚", ["Dokumen", "Dokumen", "Documents"]], [/Tarombo/i, "taro", "🌳", ["Tarombo", "Tarombo", "Tarombo"]],
  [/^(Fitur|Features)$/i, "feat", "✨", ["Fitur", "Fitur", "Features"]], [/RPP/, "rpp", "⚖️", ["RPP", "RPP", "RPP"]], [/Liturgi|Paragenda|Liturgy/i, "lit", "📜", ["Liturgi", "Liturgi", "Liturgy"]]];
function sxDecorate() {
  const res = document.getElementById("searchRes"); if (!res) return;
  res.querySelectorAll("h3.sec-h").forEach((h) => { if (h.closest(".sx-sec")) return; const body = h.nextElementSibling; if (!body) return;
    const raw = h.textContent.replace(/^[^\p{L}]+/u, "").trim(); const k = SX_KINDS.find(([re]) => re.test(raw)) || [null, "other", "🔎", [raw, raw, raw]];
    const n = body.querySelectorAll(".li, .gtile, .deep-li").length || body.children.length;
    const sec = document.createElement("section"); sec.className = "sx-sec"; sec.dataset.k = k[1]; sec.dataset.n = n;
    sec.innerHTML = `<div class="sx-h"><span class="sx-ic">${k[2]}</span><b>${esc(L3(...k[3]))}</b><em>${n}</em></div>`;
    h.parentNode.insertBefore(sec, h); h.remove(); body.classList.add("sx-card"); sec.appendChild(body); });
  const secs = [...res.querySelectorAll(".sx-sec")]; const chips = document.getElementById("sxChips"); if (!chips) return;
  if (!secs.length) { chips.innerHTML = ""; return; }
  const total = secs.reduce((a, s2) => a + +s2.dataset.n, 0); if (!secs.some((s2) => s2.dataset.k === SX.f)) SX.f = "all";
  chips.innerHTML = `<button class="sx-chip${SX.f === "all" ? " on" : ""}" data-act="sxF" data-k="all">${esc(L3("Semua", "Sude", "All"))} <em>${total}</em></button>` + secs.map((s2) => { const k = SX_KINDS.find((x) => x[1] === s2.dataset.k);
    return `<button class="sx-chip${SX.f === s2.dataset.k ? " on" : ""}" data-act="sxF" data-k="${s2.dataset.k}">${k ? k[2] + " " + esc(L3(...k[3])) : s2.dataset.k} <em>${s2.dataset.n}</em></button>`; }).join("");
  secs.forEach((s2) => (s2.hidden = SX.f !== "all" && s2.dataset.k !== SX.f));
}
A.sxF = (d) => { SX.f = d.k; sxDecorate(); };
A.sxClear = () => { const i = document.getElementById("searchIn"); if (!i) return; i.value = ""; SX.f = "all"; searchRun(""); i.focus(); };
A.sxPick = (d) => { const i = document.getElementById("searchIn"); if (!i) return; i.value = d.q; searchRun(d.q); };
A.sxForget = () => { LS.set("searchHist", []); searchRun(""); };
function sxHistAdd(q) { q = String(q || "").trim(); if (q.length < 2) return; const h = (LS.get("searchHist", []) || []).filter((x) => norm(x) !== norm(q)); h.unshift(q); LS.set("searchHist", h.slice(0, 8)); }
function sxEmpty() {
  const h = LS.get("searchHist", []) || []; const sug = ["KJ 4", "Mazmur 23", "Sihombing", L3("Panggilan video", "Telepon video", "Video call"), L3("Ayat harian", "Ayat ari on", "Daily verse"), "Tarombo", "Haleluya"];
  return `${h.length ? `<div class="sx-blk"><div class="sx-blk-h"><b>🕘 ${esc(L3("Pencarian terakhir", "Lului na salpu", "Recent searches"))}</b><button class="sx-link" data-act="sxForget">${esc(L3("Hapus", "Apus", "Clear"))}</button></div><div class="sx-pills">${h.map((q) => `<button class="sx-pill" data-act="sxPick" data-q="${esc(q)}">${esc(q)}</button>`).join("")}</div></div>` : ""}
    <div class="sx-blk"><div class="sx-blk-h"><b>✨ ${esc(L3("Coba cari", "Lului", "Try"))}</b></div><div class="sx-pills">${sug.map((q) => `<button class="sx-pill soft" data-act="sxPick" data-q="${esc(q)}">${esc(q)}</button>`).join("")}</div></div>
    <div class="sx-what"><p>${esc(L3("Satu kotak untuk semuanya:", "Sada kotak tu sude:", "One box for everything:"))}</p><div>👤 ${esc(L3("Anggota", "Ruas", "Members"))} · 🎵 ${esc(L3("Lagu", "Ende", "Songs"))} · 📚 ${esc(L3("Dokumen", "Dokumen", "Documents"))} · 📖 ${esc(L3("Alkitab", "Bibel", "Bible"))} · 🗓 ${esc(L3("Acara", "Ulaon", "Events"))} · 📋 Roster · 🌳 Tarombo · ✨ ${esc(L3("Fitur Sada (ketik mis. \"video call\", \"foto profil\")", "Fitur Sada", "Sada features (type e.g. \"video call\", \"profile photo\")"))} · 📞 ${esc(L3("Telepon anggota", "Telepon ruas", "Call a member"))}</div></div>`;
}
try { document.head.insertAdjacentHTML("beforeend", `<style>
  .sx-top { position: sticky; top: calc(64px + env(safe-area-inset-top)); z-index: 4; padding: 8px 0 6px; background: linear-gradient(var(--bg, #f2f3f8) 75%, transparent); }
  .sx-box { display: flex; align-items: center; gap: 10px; background: var(--surface); border: 1.5px solid var(--line); border-radius: 20px; padding: 4px 6px 4px 16px; box-shadow: 0 8px 22px rgba(20,22,60,.08); }
  .sx-box:focus-within { border-color: var(--brand); box-shadow: 0 0 0 4px color-mix(in srgb, var(--brand) 14%, transparent), 0 8px 22px rgba(20,22,60,.08); }
  .sx-box svg { width: 20px; height: 20px; color: var(--brand); flex: none; } .sx-box input { flex: 1; min-width: 0; border: 0 !important; outline: 0; background: transparent !important; box-shadow: none !important; padding: 12px 0; font-size: 17px !important; -webkit-appearance: none; }
  .sx-box input::-webkit-search-cancel-button { display: none; } .sx-x { width: 34px; height: 34px; border-radius: 50%; border: 0; background: color-mix(in srgb, var(--ink) 9%, var(--surface)); color: var(--ink); font-weight: 800; flex: none; }
  .sx-chips { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding: 8px 0 2px; } .sx-chips::-webkit-scrollbar { display: none; }
  .sx-chip { flex: none; border: 1px solid var(--line); background: var(--surface); color: var(--ink); border-radius: 999px; padding: 7px 12px; font-size: 13.5px; font-weight: 700; white-space: nowrap; }
  .sx-chip em { font-style: normal; font-size: 11.5px; color: var(--muted); margin-left: 2px; } .sx-chip.on { background: var(--brand); border-color: var(--brand); color: #fff; } .sx-chip.on em { color: rgba(255,255,255,.75); }
  .sx-sec { margin: 14px 0 4px; } .sx-sec[hidden] { display: none; } .sx-h { display: flex; align-items: center; gap: 8px; margin: 0 4px 8px; }
  .sx-ic { width: 30px; height: 30px; border-radius: 10px; display: grid; place-items: center; background: color-mix(in srgb, var(--brand) 9%, var(--surface)); font-size: 16px; }
  .sx-h b { font-size: 15.5px; } .sx-h em { font-style: normal; font-size: 12px; font-weight: 800; color: var(--brand); background: color-mix(in srgb, var(--brand) 10%, var(--surface)); border-radius: 999px; padding: 2px 8px; }
  .sx-card { border-radius: 18px; padding: 4px 12px; box-shadow: 0 4px 16px rgba(20,22,60,.06); } .sx-card .li { padding: 11px 2px; } .sx-card .li + .li { border-top: 1px solid var(--line); }
  .sx-card .li small { display: block; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .sx-card mark { background: #ffe9a8; color: inherit; border-radius: 4px; padding: 0 2px; }
  .sx-sec .glist { margin: 0; } .sx-blk { margin: 16px 2px; } .sx-blk-h { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; } .sx-link { border: 0; background: none; color: var(--brand); font-weight: 700; }
  .sx-pills { display: flex; flex-wrap: wrap; gap: 8px; } .sx-pill { border: 1px solid var(--line); background: var(--surface); border-radius: 999px; padding: 8px 14px; font-weight: 700; color: var(--ink); }
  .sx-pill.soft { background: color-mix(in srgb, var(--brand) 7%, var(--surface)); border-color: transparent; color: var(--brand); }
  .sx-what { margin: 22px 2px; padding: 14px 16px; border-radius: 18px; background: var(--surface); border: 1px dashed var(--line); color: var(--muted); } .sx-what p { margin: 0 0 6px; font-weight: 700; color: var(--ink); } .sx-what div { line-height: 1.8; }
  .sx-load { display: flex; align-items: center; gap: 8px; justify-content: center; color: var(--muted); font-size: 13px; margin: 14px 0; } .sx-load i { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--line); border-top-color: var(--brand); animation: sxspin .7s linear infinite; }
  @keyframes sxspin { to { transform: rotate(360deg); } }
  .sx-none { text-align: center; color: var(--muted); padding: 30px 10px; } .sx-none b { display: block; color: var(--ink); font-size: 17px; margin: 6px 0 4px; }
</style>`); } catch (e) {}
// ---------- Search everything (YB 2026-10-30): songs, church documents, the Bible, tarombo, and for Parhalado RPP and liturgy ----------
const DEEP = { n: 0, rpp: null };
function deepSnip(text, q, w = 46) { const t = String(text || "").replace(/\s+/g, " "); const i = norm(t).indexOf(q); if (i < 0) return t.slice(0, w * 2);
  const a = Math.max(0, i - w), b = Math.min(t.length, i + q.length + w); return (a ? "…" : "") + t.slice(a, b) + (b < t.length ? "…" : ""); }
const deepMark = (s, q) => { s = String(s || ""); const t = esc(s); if (!q) return t;
  // find the words in the original text (letters may carry accents; punctuation stays in place)
  const fold = (x) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); const re = new RegExp(fold(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[\\s\\W]+"), "i");
  const m = fold(s).match(re); if (!m) return t; const i = m.index, j = i + m[0].length;
  return esc(s.slice(0, i)) + "<mark>" + esc(s.slice(i, j)) + "</mark>" + esc(s.slice(j)); };
async function deepSearch(qRaw) {
  const my = ++DEEP.n; const box = document.getElementById("searchDeep"); if (!box) return;
  const q = norm(qRaw); if (q.length < 2) { box.innerHTML = ""; return; }
  box.innerHTML = `<div class="sx-load"><i></i>${esc(L3("Mencari di lagu dan dokumen…", "Manglului di ende dohot dokumen…", "Searching songs and documents…"))}</div>`;
  const sec = (icon, title, rows) => (rows.length ? `<h3 class="sec-h">${icon} ${esc(title)}</h3><div class="card deep-card">${rows.join("")}</div>` : "");
  const row = (href, title, sub, act, lead, kick) => `<${act ? "button" : "a"} class="li deep-li" ${act ? act : `href="${esc(href)}"`}>${lead ? `<span class="sx-lead">${lead}</span>` : ""}<span class="grow">${kick ? `<i class="sx-kick">${esc(kick)}</i>` : ""}<b class="sx-t">${title}</b>${sub ? `<small class="sx-s">${sub}</small>` : ""}</span>${ic("chev", "chev")}</${act ? "button" : "a"}>`;
  const tcase = (x) => { x = String(x || "").replace(/\s+/g, " ").trim(); if (x === x.toUpperCase() && /[A-Z]{3}/.test(x)) x = x.toLowerCase().replace(/(^|[\s(–-])(\p{L})/gu, (m2, a2, c) => a2 + c.toUpperCase()).replace(/\b([ivxl]+)\b(?=[.\s]|$)/gi, (r) => (/^[ivxl]+$/i.test(r) ? r.toUpperCase() : r)); return x.length > 72 ? x.slice(0, 70) + "…" : x; };
  const book = (b, n) => `<span class="sx-book ${b.toLowerCase()}">${esc(b)}<b>${esc(n)}</b></span>`;
  let out = "";
  // 📖 a Bible reference: "Yoh 3:16", "Mazmur 23", "1 Korintus 13:4-7"
  if (/^\s*[1-3]?\s*[A-Za-z]{2,}\.?\s+\d{1,3}(\s*[:.]\s*\d{1,3}(\s*[-–]\s*\d{1,3})?)?\s*$/.test(qRaw) && !/^\s*(kj|be|bn|pkj|nkb|buku|kidung|no)\b/i.test(qRaw)) out += sec("📖", L3("Alkitab", "Bibel", "Bible"), [row("", esc(qRaw.trim()), esc(L3("Buka di Alkitab · TB, Toba, KJV", "Bukka di Bibel", "Open in the Bible · TB, Toba, KJV")), `data-act="deepBible" data-q="${esc(qRaw.trim())}"`, "📖")]);
  // 🎵 songs: by number ("KJ 4", "BE 587", "4"), title or any line
  try { await songsLoad(false); } catch (e) {}
  if (my !== DEEP.n) return;
  const BK = { kj: "KJ", "kidung jemaat": "KJ", be: "BE", "buku ende": "BE", bn: "BN", "buku nyanyian": "BN" };
  const m = norm(qRaw).match(/^(kj|be|bn|kidung jemaat|buku ende|buku nyanyian)?\s*(?:no\s*)?(\d{1,3})$/);
  const songs = []; const list = SONGS.list || [];
  if (m) list.filter((x) => +x.k.split(":")[1] === +m[2] && (!m[1] || x.k.startsWith(BK[m[1]] + ":"))).forEach((x) => songs.push({ x, snip: "" }));
  else for (const x of list) { if (songs.length >= 12) break;
    if (norm(x.t || "").includes(q)) { songs.push({ x, snip: "" }); continue; }
    const lines = [...Object.values(x.v || {}).flat(), ...(x.r || [])]; const hit = lines.find((l) => norm(l).includes(q)); if (hit) songs.push({ x, snip: hit }); }
  out += sec("🎵", L3("Nyanyian", "Ende", "Songs"), songs.map(({ x, snip }) => { const [b, n] = x.k.split(":"); return row(`#/song/${encodeURIComponent(x.k)}`, x.t ? deepMark(tcase(x.t), q) : esc(`${b} ${n}`), snip ? "“" + deepMark(deepSnip(snip, q), q) + "”" : "", "", book(b, n), ({ KJ: "Kidung Jemaat", BE: "Buku Ende", BN: "Buku Nyanyian" })[b] || b); }));
  // 📚 church documents the person may read (the Agendas only for Parhalado)
  const docRows = [];
  for (const [slug, meta] of Object.entries(DOC_META)) { if (meta.restricted && !isParhalado()) continue; let doc = null;
    try { doc = await docLoad(slug, false); } catch (e) { continue; } if (my !== DEEP.n) return;
    let n = 0; const seenT = new Set(); (doc.sections || []).forEach((s2, i) => { if (n >= 4) return; const ttl = String(s2.title || ""); if (ttl.length > 110 || /\d{2,3}\s+[A-Z].*\d{2,3}\s+[A-Z]/.test(ttl)) return;   // skip table-of-contents lines
      const key = norm(ttl); const inTitle = key.includes(q); const line = (s2.lines || []).find((l) => l && norm(l).includes(q)); if (!inTitle && !line) return; if (seenT.has(key) && !line) return; seenT.add(key);
      n++; docRows.push(row(`#/doc/${slug}?i=${i}`, deepMark(tcase(ttl) || meta.title, q), line ? deepMark(deepSnip(line.replace(/^§/, ""), q, 60), q) : "", "", `<span class="sx-doc">${meta.icon || "📚"}</span>`, meta.title)); }); }
  out += sec("📚", L3("Dokumen Gereja", "Dokumen Huria", "Church documents"), docRows);
  // 🌳 tarombo margas
  const margas = (typeof TARO_ALL !== "undefined" ? TARO_ALL : []).filter((x) => mnorm(x).includes(mnorm(qRaw))).slice(0, 8);
  out += sec("🌳", "Tarombo", margas.map((x) => row("", deepMark(x, q), esc((taroFind(x) || []).slice(-2).join(" › ")), `data-act="deepTaro" data-m="${esc(x)}"`, "🌳", L3("Marga", "Marga", "Marga"))));
  // ⚖️ RPP list and 📜 liturgy scripts: Parhalado only
  if (isParhalado()) {
    try { if (!DEEP.rpp) DEEP.rpp = await api.save("rpp_list", {}); } catch (e) { DEEP.rpp = []; }
    out += sec("⚖️", "RPP", (DEEP.rpp || []).filter((r) => norm([r.name, r.reason, r.stage, r.notes].join(" ")).includes(q)).slice(0, 6).map((r) => row("#/rpp", deepMark(r.name, q), esc([r.stage, r.status === "aktif" ? L3("Aktif", "Aktif", "Active") : L3("Selesai", "Nunga sae", "Ended")].filter(Boolean).join(" · ")), "", "⚖️", "RPP")));
    let lits = []; try { lits = await litList(false); } catch (e) {}
    out += sec("📜", L3("Naskah Liturgi", "Naskah Paragenda", "Liturgy scripts"), (lits || []).filter((x) => norm([x.name, x.liturgist, x.preacher, x.day].join(" ")).includes(q)).slice(0, 6).map((x) => row(`#/lit/${x.id}`, deepMark(x.name, q), esc("📜 " + (x.liturgist || "")), "", `<span class="sx-date"><b>${esc(fmt(x.day, { day: "numeric" }))}</b>${esc(fmt(x.day, { month: "short" }))}</span>`, L3("Naskah liturgi", "Naskah paragenda", "Liturgy script"))));
  }
  if (my !== DEEP.n) return;
  box.innerHTML = out; sxDecorate();
  const res = document.getElementById("searchRes");
  if (res && !res.querySelector(".sx-sec")) box.innerHTML = `<div class="sx-none">🔍<b>${esc(L3("Tidak ditemukan", "Ndang dapot", "Nothing found"))}</b>${esc(L3("Coba kata lain, nomor lagu (mis. KJ 4) atau nas (mis. Mazmur 23).", "Lului hata na asing.", "Try another word, a song number (e.g. KJ 4) or a passage (e.g. Psalm 23)."))}</div>`;
  else sxHistAdd(qRaw);
}
A.deepBible = (d) => { LS.set("bibPendingQ", d.q); location.hash = "#/library?s=bible"; };
A.deepTaro = (d) => { LS.set("taroPending", d.m); location.hash = "#/tarombo"; };
// the Bible page and the tarombo page pick up what the search asked for
setInterval(() => {
  const bq = LS.get("bibPendingQ", ""); const f = bq && document.querySelector('form[data-form="bibSearch"]');
  if (f) { LS.set("bibPendingQ", ""); f.q.value = bq; F.bibSearch(f).catch(() => {}); }
  const tm = LS.get("taroPending", ""); const ti = tm && document.getElementById("taroFind");
  if (ti && document.querySelector(".taro-tree")) { LS.set("taroPending", ""); ti.value = tm; const x = document.querySelector(".taro-x"); if (x) x.hidden = false; taroShow(tm); }
}, 300);
try { document.head.insertAdjacentHTML("beforeend", `<style>.deep-li small { display: block; color: var(--muted); } .deep-li mark { background: #ffe9a8; color: inherit; border-radius: 3px; padding: 0 1px; } .deep-card { padding-top: 4px; padding-bottom: 4px; }</style>`); } catch (e) {}
// ---------- Keyboard on iPhone (YB 2026-10-30) ----------
// Tapping Home's search pill: focus a hidden field during the tap (iOS then opens the keyboard), and the search page takes the focus over.
document.addEventListener("click", (e) => { const a = e.target.closest && e.target.closest("a.search-entry"); if (!a) return;
  let px = document.getElementById("kbProxy"); if (!px) { px = document.createElement("input"); px.id = "kbProxy"; px.type = "text"; px.setAttribute("aria-hidden", "true"); px.tabIndex = -1;
    px.setAttribute("style", "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0;pointer-events:none"); document.body.appendChild(px); }
  try { px.focus({ preventScroll: true }); } catch (err) {} }, true);
// A field that is focused but has no keyboard (iOS) gets it back with one tap.
document.addEventListener("touchend", (e) => { const el = e.target; if (!el || el.id !== "searchIn") return; if (document.activeElement === el && !el.dataset.kbOk) { el.blur(); el.focus(); el.dataset.kbOk = "1"; } }, true);
document.addEventListener("focusin", (e) => { if (e.target && e.target.id === "searchIn") e.target.dataset.kbOk = "1"; });
try { document.head.insertAdjacentHTML("beforeend", `<style>.search-top input, #taroFind, input[type=search] { font-size: 16px !important; }</style>`); } catch (e) {}
// Live code for the downloaded Tata Ibadah file (YB 2026-10-30): Multimedia makers see it on the Tata Ibadah page.
async function liveCodePaint(kind) { const el = document.getElementById("liveCode"); if (!el) return; try { const r = await api.save(kind || "live_code_get", {}); el.textContent = r.code; } catch (e) { el.textContent = "–"; } }
A.liveCodeNew = async (d, btn) => { if (!confirm(L3("Buat kode live baru? Kode lama berhenti berlaku di laptop gereja.", "Kode baru?", "Make a new live code? The old one stops working on the church laptop."))) return; await busy(btn, () => liveCodePaint("live_code_new")); toast(L3("Kode live baru dibuat.", "Kode baru.", "New live code made.")); };
try { document.head.insertAdjacentHTML("beforeend", `<style>.live-code { display: flex; align-items: center; gap: 10px; } .live-code small { display: block; color: var(--muted); margin-top: 2px; } #liveCode { letter-spacing: .18em; font-variant-numeric: tabular-nums; color: var(--brand); }</style>`); } catch (e) {}
// ---------- Weekly quiz (YB 2026-10-30): Remaja makers write it, teens play once on Sunday, leaderboard; scored on the server ----------
const QZ = { list: [], gid: "", play: null, ed: null };
const qzMaker = (gid) => !!D && (D.me.is_admin || ["tmaker", "teacher", "chair", "maker"].includes((D.me.groups || {})[gid]));
function quizTab(gid) {
  QZ.gid = gid; setTimeout(() => quizPaint(gid), 0);
  return `${qzMaker(gid) ? `<a class="btn primary block" href="#/quizwb/new?g=${gid}">🎯 ${esc(L3("Buat kuis minggu ini", "Bahen kuis minggu on", "Make this week's quiz"))}</a>` : ""}<div id="quizBox">${skel(3)}</div>`;
}
async function quizPaint(gid) {
  const box = document.getElementById("quizBox"); if (!box) return;
  try { QZ.list = (await api.save("quiz_list", { group_id: gid })) || []; } catch (e) { box.innerHTML = `<p class="warn">${esc(errMsg(e))}</p>`; return; }
  const mk = qzMaker(gid); const st = (z) => ({ draft: L3("Draf", "Draf", "Draft"), open: L3("Dibuka", "Tarbukka", "Open"), closed: L3("Selesai", "Nunga sae", "Closed") })[z.status];
  const open = QZ.list.filter((z) => z.status === "open");
  const hero = !mk ? open.map((z) => `<article class="qz-hero"><p class="qz-kick">🎯 ${esc(L3("Kuis Minggu Ini", "Kuis Minggu On", "This week's quiz"))} · ${esc(fmt(z.day, { day: "numeric", month: "long" }))}</p><h2>${esc(z.title)}</h2><p>${z.n} ${esc(L3("pertanyaan", "sungkun-sungkun", "questions"))} · ${z.played} ${esc(L3("sudah ikut", "nunga ro", "played"))}</p>
      ${z.mine ? `<div class="qz-score">⭐ ${z.mine.score} / ${z.mine.total}</div><button class="btn block" data-act="qzResults" data-id="${z.id}">🏆 ${esc(L3("Lihat peringkat", "Ida peringkat", "See the leaderboard"))}</button>`
        : `<button class="btn qz-go block" data-act="qzStart" data-id="${z.id}">▶ ${esc(L3("Mulai kuis", "Mulai kuis", "Start the quiz"))}</button>`}</article>`).join("") : "";
  const rows = QZ.list.filter((z) => mk || z.status !== "open").map((z) => `<div class="li qz-row"><span class="date-chip"><b>${esc(fmt(z.day, { day: "numeric" }))}</b><small>${esc(fmt(z.day, { month: "short" }))}</small></span>
      <span class="grow"><b>${esc(z.title)}</b><small><span class="badge${z.status === "open" ? " ok" : ""}">${esc(st(z))}</span> ${z.n} ${esc(L3("soal", "sungkun", "questions"))} · ${z.played} ${esc(L3("ikut", "ro", "played"))}${z.mine ? ` · ⭐ ${z.mine.score}/${z.mine.total}` : ""}</small></span>
      <span class="qz-acts">${mk ? `${z.status !== "open" ? `<button class="btn sm primary" data-act="qzStatus" data-id="${z.id}" data-s="open">▶ ${esc(L3("Buka", "Bukka", "Open"))}</button>` : `<button class="btn sm" data-act="qzStatus" data-id="${z.id}" data-s="closed">■ ${esc(L3("Tutup", "Tutup", "Close"))}</button>`}
        <a class="icon-btn" href="#/quizwb/${z.id}?g=${gid}" aria-label="Edit">✏️</a>` : ""}${mk || z.mine || z.status === "closed" ? `<button class="icon-btn" data-act="qzResults" data-id="${z.id}" aria-label="Hasil">🏆</button>` : ""}</span></div>`).join("");
  box.innerHTML = hero + (rows ? `<h3 class="sec-h">${esc(mk ? L3("Semua kuis", "Sude kuis", "All quizzes") : L3("Kuis sebelumnya", "Kuis na salpu", "Earlier quizzes"))}</h3><div class="card">${rows}</div>` : "")
    + (!hero && !rows ? empty(mk ? L3("Belum ada kuis. Buat kuis pertama untuk Minggu ini!", "Dang adong kuis.", "No quizzes yet. Make the first one for this Sunday!") : L3("Belum ada kuis minggu ini. Nantikan hari Minggu!", "Dang adong kuis.", "No quiz this week yet. Watch this space on Sunday!"), "star") : "");
}
A.qzStatus = async (d, btn) => { try { await busy(btn, () => api.save("quiz_status", { id: d.id, status: d.s })); toast(d.s === "open" ? L3("Kuis dibuka. Anggota Remaja diberi tahu.", "Kuis tarbukka.", "Quiz opened. The teens have been notified.") : L3("Kuis ditutup. Semua bisa melihat jawabannya.", "Kuis ditutup.", "Quiz closed. Everyone can see the answers.")); quizPaint(QZ.gid); } catch (e) { toast(errMsg(e), true); } };
// Playing: one question at a time; the answers are checked on the server at the end.
A.qzStart = (d) => { const z = QZ.list.find((x) => x.id === d.id); if (!z) return; QZ.play = { z, i: 0, ans: [], t0: Date.now() }; qzShow(); };
function qzShow() {
  const p = QZ.play; const q = p.z.questions[p.i]; const n = p.z.questions.length;
  sheet("🎯 " + p.z.title, `<div class="qz-play"><div class="qz-prog"><i style="width:${Math.round((p.i / n) * 100)}%"></i></div><p class="qz-count">${p.i + 1} / ${n}</p><h3 class="qz-q">${esc(q.q)}</h3>
    <div class="qz-opts">${q.options.map((o, k) => `<button class="qz-opt" data-act="qzPick" data-k="${k}"><span>${"ABCD"[k]}</span>${esc(o)}</button>`).join("")}</div></div>`);
}
A.qzPick = async (d, btn) => { const p = QZ.play; if (!p || p.lock) return; p.lock = true; p.ans[p.i] = +d.k; btn.classList.add("on");
  await new Promise((r) => setTimeout(r, 220)); p.lock = false;
  if (p.i < p.z.questions.length - 1) { p.i++; qzShow(); return; }
  sheet("🎯 " + p.z.title, `<div class="center pad">⏳ ${esc(L3("Menghitung skor…", "Mangetong skor…", "Counting your score…"))}</div>`);
  try { const r = await api.save("quiz_answer", { id: p.z.id, answers: p.ans, ms: Date.now() - p.t0 }); const pct = r.score / r.total;
    sheet("🎯 " + p.z.title, `<div class="qz-done"><div class="qz-big">${pct === 1 ? "🏆" : pct >= 0.7 ? "🎉" : pct >= 0.4 ? "👍" : "💪"}</div><h2>${r.score} / ${r.total}</h2><p class="muted">${esc(pct === 1 ? L3("Sempurna! Luar biasa!", "Sempurna!", "Perfect!") : pct >= 0.7 ? L3("Hebat! Hampir sempurna.", "Denggan!", "Great job!") : L3("Terima kasih sudah ikut! Lihat pembahasannya di bawah.", "Mauliate!", "Thanks for playing! See the answers below."))}</p>
      <div class="qz-review">${p.z.questions.map((q, i) => { const key = (r.key[i] || {}); const ok = p.ans[i] === +key.answer; return `<div class="qz-rv ${ok ? "ok" : "no"}"><b>${ok ? "✓" : "✗"} ${esc(q.q)}</b><small>${esc(L3("Jawaban", "Alus", "Answer"))}: ${esc(q.options[+key.answer] || "")}${ok ? "" : ` · ${esc(L3("pilihanmu", "pilihanmu", "yours"))}: ${esc(q.options[p.ans[i]] || "–")}`}</small>${key.explain ? `<small class="qz-ex">💡 ${esc(key.explain)}</small>` : ""}</div>`; }).join("")}</div>
      <button class="btn primary block" data-act="qzResults" data-id="${p.z.id}">🏆 ${esc(L3("Lihat peringkat", "Ida peringkat", "See the leaderboard"))}</button></div>`);
    QZ.play = null; quizPaint(QZ.gid); } catch (e) { closeSheet(); toast(e.message === "already_played" ? L3("Anda sudah ikut kuis ini.", "Nunga ro ho.", "You've already played this quiz.") : errMsg(e), true); } };
A.qzResults = async (d) => { sheet("🏆 " + L3("Peringkat", "Peringkat", "Leaderboard"), skel(3));
  try { const l = await api.save("quiz_results", { id: d.id }); const sec = (ms) => (ms ? Math.round(ms / 1000) + "s" : "");
    sheet("🏆 " + L3("Peringkat", "Peringkat", "Leaderboard"), l.length ? `<div class="qz-board">${l.map((x, i) => `<div class="qz-b${x.me ? " me" : ""}"><span class="qz-rank">${["🥇", "🥈", "🥉"][i] || i + 1}</span><b>${esc(x.name)}</b><span>${x.score}/${x.total}</span><small>${sec(x.ms)}</small></div>`).join("")}</div>
      <p class="small muted">${esc(L3("Urutan: skor tertinggi, lalu yang paling cepat.", "Skor, dungi hatop.", "Ranked by score, then by speed."))}</p>` : empty(L3("Belum ada yang ikut.", "Dang adong.", "Nobody has played yet."), "star")); }
  catch (e) { sheet("🏆", `<p class="warn">${esc(e.message === "play_first" ? L3("Ikuti kuisnya dulu untuk melihat peringkat.", "Ihuthon kuis jolo.", "Play the quiz first to see the leaderboard.") : errMsg(e))}</p>`); } };
// The workbench: title, Sunday, questions with 2–4 options, the right answer and an optional explanation.
const QZ_BIBLE = [["Siapa yang membangun bahtera atas perintah Allah?", ["Nuh", "Abraham", "Musa", "Daud"], 0, "Kejadian 6–9."], ["Apa kitab pertama dalam Alkitab?", ["Kejadian", "Keluaran", "Matius", "Mazmur"], 0, ""], ["Berapa murid yang dipilih Tuhan Yesus?", ["7", "10", "12", "40"], 2, "Markus 3:13-19."],
  ["Di kota mana Tuhan Yesus lahir?", ["Nazaret", "Betlehem", "Yerusalem", "Kapernaum"], 1, "Lukas 2:4-7."], ["Siapa yang dilemparkan ke gua singa?", ["Yunus", "Daniel", "Elia", "Yusuf"], 1, "Daniel 6."], ["Siapa yang ditelan ikan besar?", ["Yunus", "Petrus", "Paulus", "Musa"], 0, "Yunus 1–2."],
  ["Siapa yang mengalahkan Goliat?", ["Saul", "Daud", "Simson", "Gideon"], 1, "1 Samuel 17."], ["Murid mana yang menyangkal Yesus tiga kali?", ["Yohanes", "Yudas", "Petrus", "Tomas"], 2, "Lukas 22:54-62."], ["Apa kitab terakhir dalam Alkitab?", ["Yudas", "Wahyu", "Maleakhi", "Kisah Para Rasul"], 1, ""],
  ["Pada hari ke berapa Tuhan Yesus bangkit?", ["Pertama", "Kedua", "Ketiga", "Ketujuh"], 2, "1 Korintus 15:4."], ["Siapa yang memimpin bangsa Israel keluar dari Mesir?", ["Yosua", "Musa", "Harun", "Samuel"], 1, "Keluaran 12–14."], ["Berapa jumlah Hukum Taurat (Dasa Titah)?", ["5", "7", "10", "12"], 2, "Keluaran 20."],
  ["Siapa ibu Tuhan Yesus?", ["Marta", "Maria", "Elisabet", "Hana"], 1, ""], ["Siapa pemungut cukai yang naik pohon ara untuk melihat Yesus?", ["Matius", "Zakheus", "Nikodemus", "Lewi"], 1, "Lukas 19:1-10."], ["Apa mukjizat pertama Tuhan Yesus?", ["Berjalan di atas air", "Air menjadi anggur", "Memberi makan 5000 orang", "Menyembuhkan orang buta"], 1, "Yohanes 2:1-11."]];
const QZ_BOOKS = ["Kejadian", "Keluaran", "Mazmur", "Amsal", "Yesaya", "Yeremia", "Matius", "Markus", "Lukas", "Yohanes", "Kisah Para Rasul", "Roma", "1 Korintus", "Galatia", "Efesus", "Filipi", "Kolose", "Ibrani", "Yakobus", "1 Petrus", "Wahyu"];
const qzShuffle = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((x) => x[1]);
function qzOpts(right, pool, n = 4) { const opts = qzShuffle([right, ...qzShuffle(pool.filter((x) => x !== right)).slice(0, n - 1)]); return { options: opts, answer: opts.indexOf(right) }; }
R.quizwb = (arg) => {
  const id = String(arg || "").split("?")[0]; const gid = new URLSearchParams(location.hash.split("?")[1] || "").get("g") || "remaja";
  if (!qzMaker(gid)) { location.replace(`#/g/${gid}?tab=quiz`); return ""; }
  QZ.mat = null; setTimeout(async () => { const box = document.getElementById("qzwBox"); if (!box) return;
    if (id === "new") QZ.ed = { gid, id: null, day: nextSunday(), title: L3("Kuis Minggu Ini", "Kuis Minggu On", "This week's quiz"), questions: [] };
    else { if (!QZ.list.length || QZ.gid !== gid) { QZ.gid = gid; QZ.list = (await api.save("quiz_list", { group_id: gid })) || []; } const z = QZ.list.find((x) => x.id === id); if (!z) { box.innerHTML = empty("–", "star"); return; } QZ.ed = { gid, id: z.id, day: z.day, title: z.title, status: z.status, questions: JSON.parse(JSON.stringify(z.questions)) }; }
    qzwPaint(); }, 0);
  return shell("#/groups", `<div id="qzwBox">${skel(4)}</div>`, { back: `#/g/${gid}?tab=quiz`, title: L3("Pembuat Kuis", "Pambahen Kuis", "Quiz maker") });
};
function qzwPaint() {
  const box = document.getElementById("qzwBox"); const e = QZ.ed; if (!box || !e) return;
  box.innerHTML = `<div class="card qzw-meta"><label class="small">${esc(L3("Judul kuis", "Judul", "Quiz title"))}<input class="qzw-m" data-k="title" value="${esc(e.title)}"></label><label class="small">${esc(L3("Untuk hari Minggu", "Tu ari Minggu", "For Sunday"))}<input type="date" class="qzw-m" data-k="day" value="${esc(e.day)}"></label></div>
    ${qzwMatCard()}
    <button class="btn block" data-act="qzwAuto">✨ ${esc(L3("Draf otomatis dari Tata Ibadah + soal Alkitab", "Draf sian Tata Ibadah", "Auto-draft from the Tata Ibadah + Bible questions"))}</button>
    ${e.questions.map((q, i) => `<article class="card qzw-q"><div class="row between" style="margin:0"><b>${i + 1}.</b><span class="row" style="margin:0;gap:4px">${qzMat().text ? `<button class="icon-btn" data-act="qzwRedo" data-i="${i}" aria-label="${esc(L3("Soal baru dari bahan", "Soal na imbaru", "New question from the materials"))}" title="${esc(L3("Soal baru dari bahan", "Soal na imbaru", "New question from the materials"))}">↻</button>` : ""}<button class="icon-btn" data-act="qzwMove" data-i="${i}" data-d="-1">↑</button><button class="icon-btn" data-act="qzwMove" data-i="${i}" data-d="1">↓</button><button class="icon-btn danger" data-act="qzwDel" data-i="${i}">${ic("trash")}</button></span></div>
      <textarea class="qzw-i" data-i="${i}" data-k="q" rows="2" placeholder="${esc(L3("Pertanyaan", "Sungkun-sungkun", "Question"))}">${esc(q.q || "")}</textarea>
      ${[0, 1, 2, 3].map((k) => `<div class="qzw-o"><input type="radio" name="ans${i}" class="qzw-r" data-i="${i}" data-k="${k}"${+q.answer === k ? " checked" : ""} aria-label="${esc(L3("Jawaban benar", "Alus na tama", "Correct answer"))}"><input class="qzw-i" data-i="${i}" data-k="o${k}" value="${esc((q.options || [])[k] || "")}" placeholder="${esc(L3("Pilihan", "Pilihan", "Option"))} ${"ABCD"[k]}${k > 1 ? " (" + L3("boleh kosong", "boi kosong", "optional") + ")" : ""}"></div>`).join("")}
      <input class="qzw-i" data-i="${i}" data-k="explain" value="${esc(q.explain || "")}" placeholder="💡 ${esc(L3("Penjelasan / ayat (boleh kosong)", "Penjelasan", "Explanation / verse (optional)"))}"></article>`).join("")}
    <button class="btn block" data-act="qzwAdd">${ic("plus")} ${esc(L3("Tambah pertanyaan", "Tambah sungkun-sungkun", "Add a question"))}</button>
    <p class="small muted">${esc(L3("Tandai jawaban benar dengan bulatan di kiri. Teens mengerjakan satu kali; skor dihitung di server.", "", "Mark the right answer with the circle on the left. Teens play once; the score is counted on the server."))}</p>
    <div class="row two sticky-actions"><button class="btn" data-act="qzwSave" data-open="0">💾 ${esc(L3("Simpan draf", "Simpan draf", "Save draft"))}</button><button class="btn primary" data-act="qzwSave" data-open="1">▶ ${esc(L3("Simpan & buka", "Simpan & bukka", "Save & open"))}</button></div>`;
}
document.addEventListener("input", (ev) => { const el = ev.target; if (!el || !el.classList || !QZ.ed) return;
  if (el.classList.contains("qzw-m")) QZ.ed[el.dataset.k] = el.value;
  if (el.classList.contains("qzw-i")) { const q = QZ.ed.questions[+el.dataset.i]; const k = el.dataset.k; if (k[0] === "o" && k.length === 2) { q.options = q.options || []; q.options[+k[1]] = el.value; } else q[k] = el.value; } });
document.addEventListener("change", (ev) => { const el = ev.target; if (el && el.classList && el.classList.contains("qzw-r") && QZ.ed) QZ.ed.questions[+el.dataset.i].answer = +el.dataset.k; });
const qzwRe = () => { const y = window.scrollY; qzwPaint(); window.scrollTo(0, y); };
A.qzwAdd = () => { QZ.ed.questions.push({ q: "", options: ["", "", "", ""], answer: 0, explain: "" }); qzwRe(); };
A.qzwDel = (d) => { QZ.ed.questions.splice(+d.i, 1); qzwRe(); };
A.qzwMove = (d) => { const a = QZ.ed.questions, i = +d.i, j = i + +d.d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; qzwRe(); };
// Teens Quiz Workbench (YB 2026-10-31): the teacher adds this week's lesson materials (PDF, Word, PowerPoint, text, photos of handouts)
// or pastes the lesson text; Sada makes the questions on the phone, free (YB 2026-10-31: no Claude key), into this draft, the teacher
// checks and edits them, then Save & open. "↻" makes another question from the same materials.
const QZW_SET = { n: 10, lang: "auto", diff: "mixed", types: "both" };
const qzMat = () => QZ.mat || (QZ.mat = { files: [], paste: "", text: "", ...QZW_SET, ...LS.get("qzw-set", {}) });
const qzWords = (t) => { const k = (String(t || "").match(/\S+/g) || []).length; return k.toLocaleString() + " " + L3("kata", "hata", "words"); };
function qzwMatCard() {
  const m = qzMat(); const ready = m.files.some((f) => f.state === "ready") || m.paste.trim().length > 40; const reading = m.files.some((f) => f.state === "reading");
  const opt = (k, list) => list.map(([v, l]) => `<option value="${v}"${String(m[k]) === String(v) ? " selected" : ""}>${esc(l)}</option>`).join("");
  return `<div class="card qzw-mat"><b>📚 ${esc(L3("Dari bahan pelajaran minggu ini", "Sian bahan parsiajaran minggu on", "From this week's lesson materials"))}</b>
    <p class="small muted" style="margin:0">${esc(L3("Masukkan PDF, Word, PowerPoint, teks, atau foto handout pelajaran. Sada membuat soal dari bahan itu (gratis, di HP Anda); Anda memeriksa dan mengubahnya, lalu Simpan & buka.", "Pamasuk PDF, Word, PowerPoint, teks, manang foto. Sada mambahen soal (gratis); hamu mamareso, dung i Simpan & bukka.", "Add the lesson PDF, Word, PowerPoint, text or photos of handouts. Sada makes the questions from them (free, on your phone); you check and edit them, then Save & open."))}</p>
    <button class="btn block" data-act="qzwFiles">📎 ${esc(L3("Pilih file pelajaran", "Pillit file", "Choose lesson files"))}</button>
    ${m.files.map((f, i) => `<div class="qzw-f"><span class="grow"><b>${esc(f.name)}</b><small${f.state === "error" ? ' class="err"' : ""}>${esc(f.state === "reading" ? L3("Membaca…", "Manjaha…", "Reading…") : f.state === "error" ? f.error : f.note)}</small></span><button class="icon-btn" data-act="qzwRmFile" data-i="${i}" aria-label="${esc(t("delete"))}">✕</button></div>`).join("")}
    <textarea class="qzw-s" data-k="paste" rows="3" placeholder="${esc(L3("Atau tempel teks pelajaran / nas Alkitab di sini", "Manang tempel teks parsiajaran dison", "Or paste the lesson text / Bible passage here"))}">${esc(m.paste)}</textarea>
    <div class="qzw-set">
      <label class="small">${esc(L3("Jumlah soal", "Godang ni soal", "Questions"))}<select class="qzw-s" data-k="n">${opt("n", [5, 8, 10, 12, 15, 20].map((k) => [k, k]))}</select></label>
      <label class="small">${esc(L3("Bahasa", "Hata", "Language"))}<select class="qzw-s" data-k="lang">${opt("lang", [["auto", L3("Sama dengan bahan", "Songon bahan", "Same as the materials")], ["id", "Bahasa Indonesia"], ["en", "English"], ["bt", "Bahasa Batak Toba"]])}</select></label>
      <label class="small">${esc(L3("Tingkat", "Tingkat", "Difficulty"))}<select class="qzw-s" data-k="diff">${opt("diff", [["easy", L3("Mudah", "Mura", "Easy")], ["mixed", L3("Campur", "Campur", "Mixed")], ["hard", L3("Menantang", "Maol", "Challenging")]])}</select></label>
      <label class="small">${esc(L3("Jenis soal", "Jenis", "Question types"))}<select class="qzw-s" data-k="types">${opt("types", [["both", L3("Pilihan ganda + Benar/Salah", "PG + Benar/Salah", "Multiple choice + True/False")], ["mcq", L3("Pilihan ganda", "Pilihan ganda", "Multiple choice")], ["tf", L3("Benar / Salah", "Benar / Salah", "True / False")]])}</select></label>
    </div>
    <button class="btn primary block" data-act="qzwWrite"${ready && !reading ? "" : " disabled"}>✨ ${esc(L3("Buat soal dari bahan", "Bahen soal sian bahan", "Make questions from the materials"))}</button></div>`;
}
document.addEventListener("input", (ev) => { const el = ev.target; if (!el || !el.classList || !el.classList.contains("qzw-s") || !QZ.ed) return;
  const m = qzMat(); if (el.dataset.k === "paste") { m.paste = el.value; const b = document.querySelector('[data-act="qzwWrite"]'); if (b) b.disabled = !(m.files.some((f) => f.state === "ready") || m.paste.trim().length > 40) || m.files.some((f) => f.state === "reading"); }
  else { m[el.dataset.k] = el.dataset.k === "n" ? +el.value : el.value; LS.set("qzw-set", { n: m.n, lang: m.lang, diff: m.diff, types: m.types }); } });
document.addEventListener("change", (ev) => { const el = ev.target; if (el && el.classList && el.classList.contains("qzw-s") && el.tagName === "SELECT") el.dispatchEvent(new Event("input", { bubbles: true })); });
// One lesson file → text. Photos of handouts are read on the phone (Tesseract, free, Indonesian + English).
async function qzwRead(f) {
  const name = f.name.toLowerCase();
  if (/^image\//.test(f.type)) {
    const url = await resizeImage(f, 1800, 0.9);
    if (!window.Tesseract) await P.load("https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js");
    const { data } = await window.Tesseract.recognize(url, "ind+eng"); const text = String(data.text || "").replace(/[ \t]+/g, " ").trim();
    if (text.length < 20) throw new Error("empty"); return { text, note: L3("Foto handout", "Foto", "Photo of a handout") + " · " + qzWords(text) };
  }
  if (/\.(txt|md|csv)$/.test(name)) { const text = (await f.text()).trim(); if (!text) throw new Error("empty"); return { text, note: qzWords(text) }; }
  if (/\.pptx$/.test(name)) {
    await P.load("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js");
    const zip = await window.JSZip.loadAsync(await f.arrayBuffer()); const dec = (x) => x.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (a, k) => String.fromCharCode(+k)).replace(/&amp;/g, "&");
    const names = Object.keys(zip.files).filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k)).sort((a, b) => +a.match(/(\d+)\.xml$/)[1] - +b.match(/(\d+)\.xml$/)[1]);
    const out = []; for (const k of names) { const xml = await zip.file(k).async("string"); const paras = xml.split("</a:p>").map((pp) => [...pp.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)].map((mm) => dec(mm[1])).join("").trim()).filter(Boolean);
      const nn = k.replace("slides/slide", "notesSlides/notesSlide"); let notes = ""; if (zip.file(nn)) { const nx = await zip.file(nn).async("string"); notes = [...nx.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)].map((mm) => dec(mm[1])).join(" ").replace(/\s+/g, " ").trim(); }
      if (paras.length || notes) out.push(`[slide ${k.match(/(\d+)\.xml$/)[1]}]\n${paras.join("\n")}${notes ? "\nCatatan: " + notes : ""}`); }
    const text = out.join("\n\n"); if (!text) throw new Error("empty"); return { text, note: `${names.length} slide · ${qzWords(text)}` };
  }
  if (/\.(docx|doc|pdf)$/.test(name)) { const r = await P.file(f); const text = String(r.text || (r.lines || []).join("\n") || "").trim(); if (!text) throw new Error("empty"); return { text, note: qzWords(text) }; }
  if (/\.(ppt)$/.test(name)) throw new Error("old");
  throw new Error("unsupported");
}
A.qzwFiles = () => {
  const inp = document.createElement("input"); inp.type = "file"; inp.multiple = true; inp.accept = ".pdf,.docx,.doc,.pptx,.txt,.md,.csv,image/*";
  inp.onchange = () => { const m = qzMat();
    for (const f of inp.files) { const entry = { name: f.name, state: "reading", text: "", note: "" }; m.files.push(entry);
      qzwRead(f).then((r) => Object.assign(entry, r, { state: "ready" })).catch((e) => { entry.state = "error"; entry.error = e.message === "empty" ? L3("Tidak ada teks di file ini.", "Dang adong teks.", "No text found in this file.") : e.message === "old" ? L3("Format lama. Simpan sebagai .pptx atau PDF.", "Format na buruk.", "Old format. Save it as .pptx or PDF.") : L3("File ini tidak bisa dibaca.", "Dang tarjaha.", "This file can't be read."); }).finally(qzwRe); }
    qzwRe(); };
  inp.click();
};
A.qzwRmFile = (d) => { qzMat().files.splice(+d.i, 1); qzwRe(); };
// ---- the free question maker: sentences from the materials become fill-in-the-blank and true/false questions ----
const QZ_STOP = new Set(("yang dan di ke dari itu ini untuk dengan dalam pada adalah akan tidak juga oleh karena sebagai atau kita kami mereka ia dia " +
  "kamu anda saya aku nya pun lah kah tetapi tapi jika kalau agar supaya maka sudah telah sedang masih lebih sangat bisa dapat harus ada para " +
  "the and of to in is are was were be been a an that this it for on with as by at from or not but his her their they he she we you i " +
  "na do ni tu jala dohot di sian ma ndang dang ibana hita nasida ho ahu tahe ba asa songon on i").split(" "));
function qzLangOf(text) {
  const w = String(text).toLowerCase().match(/[a-z]+/g) || []; const c = { id: 0, en: 0, bt: 0 };
  w.forEach((x) => { if (/^(yang|dan|itu|dengan|untuk|adalah|tidak)$/.test(x)) c.id++; else if (/^(the|and|of|is|that|with|was)$/.test(x)) c.en++; else if (/^(do|ni|jala|dohot|ndang|songon|ibana)$/.test(x)) c.bt++; });
  return c.en > c.id && c.en > c.bt ? "en" : c.bt > c.id ? "bt" : "id";
}
function qzSentences(text) {
  const clean = String(text || "").replace(/^=== .* ===$/gm, "").replace(/^\[slide \d+\]$/gm, "").replace(/^Catatan:\s*/gm, "");
  const out = [];
  clean.split(/\n+/).forEach((para) => para.split(/(?<=[.!?;])\s+/).forEach((x) => {
    const t = x.replace(/\s+/g, " ").replace(/^[\-•*\d.)\s]+(?=[A-Za-z"“])/, "").trim(); const n = (t.match(/\S+/g) || []).length;
    if (n >= 6 && n <= 40 && /[a-z]/.test(t) && t.replace(/[^A-Za-z]/g, "").length > t.length * 0.55 && !out.includes(t)) out.push(t);
  }));
  return out;
}
// The word to ask about in a sentence: a name (capitalised, not first), a number, or a long word; with its kind.
function qzKeys(sent) {
  const toks = sent.split(/\s+/); const keys = [];
  toks.forEach((raw, i) => { const w = raw.replace(/^[^\wÀ-ÿ]+|[^\wÀ-ÿ]+$/g, ""); if (!w) return; const lw = w.toLowerCase();
    if (/^\d{1,4}$/.test(w)) keys.push({ w, kind: "num" });
    else if (i > 0 && /^[A-Z][a-zà-ÿ]{2,}$/.test(w) && !QZ_STOP.has(lw)) keys.push({ w, kind: "name" });
    else if (w.length >= 6 && /^[a-zà-ÿ]+$/.test(w) && !QZ_STOP.has(lw)) keys.push({ w, kind: "word" }); });
  return keys;
}
function qzMake(text, opt, k, used) {
  const sents = qzSentences(text).filter((x) => !(used || []).includes(x)); if (!sents.length) return [];
  const lg = opt.lang && opt.lang !== "auto" ? opt.lang : qzLangOf(text);
  const T = { fill: { id: "Lengkapi kalimat ini:", bt: "Gohi hata on:", en: "Fill in the blank:" }, tf: { id: "Benar atau salah?", bt: "Tutu manang ndang?", en: "True or false?" },
    yes: { id: "Benar", bt: "Tutu", en: "True" }, no: { id: "Salah", bt: "Ndang tutu", en: "False" }, right: { id: "Yang benar", bt: "Na tutu", en: "Correct" } };
  const pool = { name: new Set(), num: new Set(), word: new Set() };
  qzSentences(text).forEach((x) => qzKeys(x).forEach((kk) => pool[kk.kind].add(kk.w)));
  const pick = (keys) => { const pref = opt.diff === "easy" ? ["name", "num", "word"] : opt.diff === "hard" ? ["word", "name", "num"] : qzShuffle(["name", "num", "word"]);
    for (const kind of pref) { const c = keys.filter((x) => x.kind === kind); if (c.length) return c.sort((a, b) => b.w.length - a.w.length)[Math.floor(Math.random() * Math.min(2, c.length))]; } return null; };
  const wrong = (key, nW) => { let c = [...pool[key.kind]].filter((x) => x.toLowerCase() !== key.w.toLowerCase());
    if (key.kind === "num") { const v = +key.w; [1, 2, 3, 5, 7, 10, 12].forEach((d) => { if (v + d > 0) c.push(String(v + d)); if (v - d > 0) c.push(String(v - d)); }); c = [...new Set(c)]; }
    if (c.length < nW) c.push(...[...pool.word, ...pool.name].filter((x) => x.toLowerCase() !== key.w.toLowerCase() && !c.includes(x)));
    // look-alike words first (same beginning / ending, e.g. me-…, ber-…, …nya, …ed), so a wrong option is not obvious from its form
    const kw = key.w.toLowerCase(), sim = (x) => { x = x.toLowerCase(); return (x.slice(0, 2) === kw.slice(0, 2) ? 2 : 0) + (x.slice(-2) === kw.slice(-2) ? 2 : 0) + (Math.abs(x.length - kw.length) < 3 ? 1 : 0); };
    if (key.kind === "word") c = qzShuffle(c).sort((p, q) => sim(q) - sim(p)).slice(0, Math.max(nW + 2, 5));
    return qzShuffle(c).slice(0, nW); };
  const blank = (sent, w, by) => sent.replace(new RegExp("(^|[^\\wÀ-ÿ])" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?=[^\\wÀ-ÿ]|$)"), (m0, p) => p + by);
  const out = []; let tfTurn = opt.types === "tf";
  for (const sent of qzShuffle(sents.slice())) {
    if (out.length >= k) break;
    const key = pick(qzKeys(sent)); if (!key) continue;
    const type = opt.types === "mcq" ? "mcq" : opt.types === "tf" ? "tf" : (tfTurn = !tfTurn) ? "tf" : "mcq";
    if (type === "mcq") { const ws = wrong(key, 3); if (ws.length < 2) continue;
      const options = qzShuffle([key.w, ...ws]); out.push({ q: `${T.fill[lg]}\n“${blank(sent, key.w, "_____")}”`, options, answer: options.indexOf(key.w), explain: sent, type: "mcq", src: sent }); }
    else { const truth = Math.random() < 0.5; let shown = sent;
      if (!truth) { const ws = wrong(key, 1); if (!ws.length) continue; shown = blank(sent, key.w, ws[0]); }
      out.push({ q: `${T.tf[lg]}\n“${shown}”`, options: [T.yes[lg], T.no[lg]], answer: truth ? 0 : 1, explain: truth ? sent : `${T.right[lg]}: ${sent}`, type: "tf", src: sent }); }
  }
  return out;
}
const qzwText = (m) => [...m.files.filter((f) => f.state === "ready" && f.text).map((f) => f.text), m.paste.trim()].filter(Boolean).join("\n\n");
A.qzwWrite = async () => {
  const e = QZ.ed, m = qzMat(); const text = qzwText(m);
  if (!text) { toast(L3("Tambahkan file atau tempel teks pelajaran dulu.", "Tambah file jolo.", "Add a file or paste the lesson text first."), true); return; }
  const used = e.questions.map((q) => q.src).filter(Boolean);
  const qs = qzMake(text, m, m.n, used);
  if (!qs.length) { toast(L3("Belum ada kalimat yang bisa dijadikan soal. Tambahkan bahan yang lebih lengkap.", "Ndang adong hata na boi gabe soal.", "No sentences could be turned into questions. Add fuller materials."), true); return; }
  const def = L3("Kuis Minggu Ini", "Kuis Minggu On", "This week's quiz");
  m.text = text;
  if (e.questions.every((q) => !String(q.q || "").trim())) e.questions = qs; else e.questions.push(...qs);
  if (!e.title || e.title === def) { const first = (text.split("\n").map((x) => x.trim()).find((x) => x.length >= 4 && x.length <= 60 && !/^===|^\[slide/.test(x)) || ""); if (first) e.title = first.replace(/[.:;,]+$/, ""); }
  qzwRe(); toast(qs.length < m.n
    ? L3(`${qs.length} soal dibuat (bahannya cukup untuk segitu). Periksa dan ubah bila perlu.`, `${qs.length} soal nunga dibahen. Pareso jolo.`, `${qs.length} questions made (that's what the materials allow). Check and edit them.`)
    : L3(`${qs.length} soal dibuat. Periksa dan ubah bila perlu, lalu Simpan & buka.`, `${qs.length} soal nunga dibahen. Pareso jolo.`, `${qs.length} questions made. Check and edit them, then Save & open.`));
};
A.qzwRedo = (d) => {
  const e = QZ.ed, m = qzMat(), i = +d.i, q = e.questions[i]; const text = m.text || qzwText(m); if (!q || !text) return;
  const type = q.type || ((q.options || []).filter(Boolean).length === 2 ? "tf" : "mcq");
  const used = e.questions.map((x) => x.src).filter(Boolean);
  const [nq] = qzMake(text, { ...m, types: type }, 1, used.length < qzSentences(text).length ? used : []);
  if (!nq) { toast(L3("Tidak ada kalimat lain untuk soal baru.", "Ndang adong hata na asing.", "No other sentence left for a new question."), true); return; }
  e.questions[i] = nq; qzwRe();
};
A.qzwAuto = async (d, btn) => {
  const e = QZ.ed; const out = [];
  await busy(btn, async () => {
    const sv = (D.services || []).find((v) => v.service_date === e.day) || upcomingService();
    let text = ""; if (sv) { try { const doc = new DOMParser().parseFromString(await tataHtml(sv.id), "text/html"); text = doc.body.textContent.replace(/\s+/g, " "); } catch (er) {} }
    const ref = (re) => { const m = text.match(re); return m ? m[1].trim() : ""; };
    const bookOf = (r) => (r.match(/^([1-3]?\s?[A-Za-z][A-Za-z ]+?)\s+\d/) || [])[1] || "";
    const kh = ref(/(?:Khotbah|Kotbah|Jamita)\s*:?\s*([1-3]?\s?[A-Za-z][A-Za-z ]+\d+\s*:\s*\d+(?:\s*[-–]\s*\d+)?)/i), ep = ref(/Epistel\s*:?\s*([1-3]?\s?[A-Za-z][A-Za-z ]+\d+\s*:\s*\d+(?:\s*[-–]\s*\d+)?)/i);
    const theme = ref(/(?:Tema|Topik|Thema)\s*:?\s*[“"‘']([^”"’']{4,80})[”"’']/i);
    const tc = (s) => s.toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, a2, c) => a2 + c.toUpperCase());
    if (kh && bookOf(kh)) { const b = tc(bookOf(kh)); out.push({ q: L3("Nas khotbah Minggu ini diambil dari kitab apa?", "Sian buku dia turpuk jamita Minggu on?", "Which book was this Sunday's sermon text from?"), ...qzOpts(b, QZ_BOOKS), explain: tc(kh) }); }
    if (ep && bookOf(ep)) { const b = tc(bookOf(ep)); out.push({ q: L3("Nas Epistel Minggu ini diambil dari kitab apa?", "Sian buku dia Epistel Minggu on?", "Which book was this Sunday's Epistle from?"), ...qzOpts(b, QZ_BOOKS), explain: tc(ep) }); }
    if (theme) out.push({ q: L3("Apa tema ibadah Minggu ini?", "Aha topik ni Minggu on?", "What was this Sunday's theme?"), ...qzOpts(tc(theme), ["Kasih Yang Sejati", "Hidup Dalam Pengharapan", "Setia Dalam Perkara Kecil", "Bersukacitalah Senantiasa", "Berjaga-jaga Dan Berdoa"]), explain: "" });
    qzShuffle(QZ_BIBLE).slice(0, Math.max(3, 6 - out.length)).forEach(([q, o, a2, ex]) => { const opts = qzShuffle(o); out.push({ q, options: opts, answer: opts.indexOf(o[a2]), explain: ex }); });
  });
  e.questions.push(...out); qzwRe(); toast(L3(`${out.length} pertanyaan ditambahkan. Periksa dan ubah bila perlu.`, `${out.length} sungkun-sungkun.`, `${out.length} questions added. Check and edit them.`));
};
A.qzwSave = async (d, btn) => {
  const e = QZ.ed; const qs = e.questions.map((q) => { const opts = (q.options || []).map((o) => String(o || "").trim()); const keep = opts.map((o, k) => [o, k]).filter(([o]) => o);
    return { q: String(q.q || "").trim(), options: keep.map(([o]) => o), answer: Math.max(0, keep.findIndex(([, k]) => k === +q.answer)), explain: String(q.explain || "").trim() }; });
  const bad = qs.findIndex((q) => !q.q || q.options.length < 2); if (!qs.length || bad >= 0) { toast(qs.length ? L3(`Pertanyaan ${bad + 1} perlu teks dan minimal 2 pilihan.`, "Isi sungkun-sungkun.", `Question ${bad + 1} needs text and at least 2 options.`) : L3("Tambahkan minimal 1 pertanyaan.", "Tambah sungkun-sungkun.", "Add at least one question."), true); return; }
  try { await busy(btn, async () => { const r = await api.save("quiz_save", { id: e.id, group_id: e.gid, day: e.day, title: e.title, questions: qs }); e.id = r.id; if (d.open === "1") await api.save("quiz_status", { id: r.id, status: "open" }); });
    toast(d.open === "1" ? L3("Kuis dibuka. Anggota Remaja diberi tahu.", "Kuis tarbukka.", "Quiz opened. The teens have been notified.") : t("saved")); location.hash = `#/g/${e.gid}?tab=quiz`; } catch (er) { toast(errMsg(er), true); } };
try { document.head.insertAdjacentHTML("beforeend", `<style>
  .qz-hero { background: linear-gradient(140deg, #ff7a59, #e3367d 60%, #7b3fe4); color: #fff; border-radius: 24px; padding: 18px; margin: 10px 0 14px; box-shadow: 0 12px 28px rgba(227,54,125,.28); }
  .qz-hero h2 { color: #fff; margin: 4px 0; font-size: 24px; } .qz-hero p { margin: 0 0 12px; opacity: .92; } .qz-kick { font-size: 12.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
  .qz-go { background: #fff; color: #c2185b; font-weight: 900; font-size: 18px; border: 0; } .qz-score { font-size: 30px; font-weight: 900; margin: 6px 0 10px; } .qz-hero .btn:not(.qz-go) { background: rgba(255,255,255,.18); color: #fff; border: 0; }
  .qz-row { align-items: center; } .qz-acts { display: flex; gap: 4px; align-items: center; flex: none; }
  .qz-play { padding: 4px 0; } .qz-prog { height: 8px; border-radius: 99px; background: var(--line); overflow: hidden; } .qz-prog i { display: block; height: 100%; background: linear-gradient(90deg, #ff7a59, #e3367d); transition: width .3s; }
  .qz-count { text-align: center; color: var(--muted); font-weight: 800; margin: 10px 0 2px; } .qz-q { text-align: center; font-size: 21px; line-height: 1.3; margin: 6px 0 16px; }
  .qz-opts { display: grid; gap: 10px; } .qz-opt { display: flex; align-items: center; gap: 12px; text-align: left; padding: 14px 16px; border-radius: 16px; border: 2px solid var(--line); background: var(--surface); font-size: 17px; font-weight: 700; color: var(--ink); }
  .qz-opt span { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: color-mix(in srgb, #e3367d 12%, var(--surface)); color: #c2185b; font-weight: 900; flex: none; }
  .qz-opt.on { border-color: #e3367d; background: color-mix(in srgb, #e3367d 10%, var(--surface)); transform: scale(.98); }
  .qz-done { text-align: center; } .qz-big { font-size: 64px; } .qz-done h2 { font-size: 36px; margin: 0; } .qz-review { text-align: left; display: grid; gap: 8px; margin: 14px 0; }
  .qz-rv { padding: 10px 12px; border-radius: 12px; display: grid; gap: 3px; } .qz-rv.ok { background: #e7f6ec; } .qz-rv.no { background: #fdecec; } .qz-rv small { color: var(--muted); } .qz-ex { color: var(--ink) !important; }
  .qz-board { display: grid; gap: 6px; } .qz-b { display: grid; grid-template-columns: 36px 1fr auto auto; gap: 10px; align-items: center; padding: 10px 12px; border-radius: 14px; background: var(--surface-2, #f4f5fa); }
  .qz-b.me { outline: 2px solid #e3367d; } .qz-rank { font-size: 20px; text-align: center; font-weight: 900; } .qz-b span:nth-child(3) { font-weight: 900; } .qz-b small { color: var(--muted); }
  .qzw-meta, .qzw-q { display: grid; gap: 8px; } .qzw-o { display: flex; align-items: center; gap: 8px; } .qzw-o input[type=radio] { width: 22px; height: 22px; flex: none; accent-color: #1f8a4c; } .qzw-o input:not([type]) , .qzw-o .qzw-i { flex: 1; }
  .qzw-mat { display: grid; gap: 10px; } .qzw-f { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 12px; background: var(--surface-2, #f4f5fa); } .qzw-f b { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .qzw-f small { display: block; color: var(--muted); } .qzw-f small.err { color: #b93a26; }
  .qzw-set { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; } .qzw-set label { display: grid; gap: 4px; } .qzw-set select { width: 100%; min-width: 0; }
</style>`); } catch (e) {}
try { document.head.insertAdjacentHTML("beforeend", `<style>
  .taro-search { display: flex; align-items: center; gap: 10px; background: var(--surface); border: 1.5px solid var(--line); border-radius: 18px; padding: 4px 6px 4px 14px; margin: 10px 0 8px; box-shadow: 0 4px 14px rgba(20,22,60,.06); }
  .taro-search:focus-within { border-color: var(--brand); box-shadow: 0 0 0 4px color-mix(in srgb, var(--brand) 14%, transparent); }
  .taro-search svg { width: 20px; height: 20px; color: var(--muted); flex: none; }
  .taro-search input { flex: 1; min-width: 0; border: 0 !important; outline: 0; background: transparent !important; box-shadow: none !important; font-size: 17px; padding: 10px 0; -webkit-appearance: none; appearance: none; }
  .taro-search input::-webkit-search-cancel-button, .taro-search input::-webkit-calendar-picker-indicator { display: none; -webkit-appearance: none; }
  .taro-x { width: 34px; height: 34px; border-radius: 50%; border: 0; background: color-mix(in srgb, var(--ink) 10%, var(--surface)); color: var(--ink); font-size: 15px; font-weight: 800; flex: none; display: grid; place-items: center; }
  .taro-x[hidden] { display: none; }
  .taro-tools { display: flex; gap: 8px; margin-bottom: 12px; } .taro-tools .btn { flex: 1; }
  /* Tarombo as a family tree (YB 2026-10-31): each person is a card, lines run from a parent down to the children, tap a card to open or close its branch.
     The three main lines carry Batak Toba ulos colours (red, gold, black) on their connector lines and a woven band on their card. */
  .tt { --tl: color-mix(in srgb, var(--ink) 28%, var(--surface)); --ind: 16px; padding: 2px 0 8px; overflow-x: auto; }
  .tt ul.tt-kids { list-style: none; margin: 0 0 0 calc(var(--ind) + 2px); padding: 0; }
  .tt ul.tt-kids > li { position: relative; padding: 8px 0 0 var(--ind); margin: 0; }
  .tt ul.tt-kids > li::before { content: ""; position: absolute; left: 0; top: 0; width: calc(var(--ind) - 2px); height: 30px; border-left: 2px solid var(--tl); border-bottom: 2px solid var(--tl); border-bottom-left-radius: 10px; }
  .tt ul.tt-kids > li:not(:last-child)::after { content: ""; position: absolute; left: 0; top: 0; bottom: 0; border-left: 2px solid var(--tl); }
  .tt .tt-n.l0 { --tl: #b3202a; } .tt .tt-n.l1 { --tl: #c99a2e; } .tt .tt-n.l2 { --tl: color-mix(in srgb, var(--ink) 78%, var(--surface)); }
  .tt-n > summary, .tt-n[open] > summary { display: flex !important; margin: 0; color: inherit; list-style: none; } .tt-n > summary::-webkit-details-marker { display: none; } .tt-n > summary::before { content: none !important; }
  .tt-card { position: relative; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 14px; background: var(--surface); border: 1px solid var(--line); box-shadow: 0 2px 8px rgba(20,22,60,.05); cursor: pointer; max-width: 560px; -webkit-tap-highlight-color: transparent; transition: border-color .15s, box-shadow .15s; }
  div.tt-card { cursor: default; }
  .tt-card:active { transform: scale(.99); }
  .tt-t { flex: 1; min-width: 0; display: grid; gap: 2px; } .tt-t b { font-size: 15px; line-height: 1.25; } .tt-t small { color: var(--muted); font-size: 12px; line-height: 1.35; font-weight: 500; }
  .tt-n.d0 > .tt-card { background: linear-gradient(140deg, var(--brand), #2b2e74); color: #fff; border: 0; padding: 14px 14px 14px 16px; box-shadow: 0 8px 20px rgba(30,32,90,.18); }
  .tt-n.d0 > .tt-card .tt-t b { font-size: 18px; } .tt-n.d0 > .tt-card small { color: rgba(255,255,255,.78); }
  .tt-n.d0 > .tt-card .tt-count { background: rgba(255,255,255,.18); color: #fff; } .tt-n.d0 > .tt-card .tt-tog { border-color: rgba(255,255,255,.5); color: #fff; }
  .tt-n.d1 > .tt-card { padding-left: 18px; overflow: hidden; }
  .tt-n.d1 > .tt-card::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 7px;
    background: repeating-linear-gradient(180deg, #b3202a 0 12px, #1a1a1a 12px 15px, #f4ead5 15px 17px, #d8b25e 17px 19px, #f4ead5 19px 21px, #1a1a1a 21px 24px); }
  .tt-n.d1 > .tt-card .tt-t b { font-size: 16.5px; }
  .tt-count { flex: none; font-size: 11px; font-weight: 800; color: var(--brand); background: color-mix(in srgb, var(--brand) 11%, var(--surface)); border-radius: 999px; padding: 3px 8px; }
  .tt-tog { flex: none; width: 26px; height: 26px; border-radius: 50%; border: 2px solid var(--tl); color: var(--tl); display: grid; place-items: center; font-weight: 900; font-size: 16px; line-height: 1; }
  .tt-tog::before { content: "+"; } .tt-n[open] > summary .tt-tog::before { content: "−"; }
  .tt-n[open] > summary.tt-card { border-color: color-mix(in srgb, var(--tl) 45%, var(--line)); }
  .tt-n[open] > .tt-kids { animation: ttIn .18s ease-out; } @keyframes ttIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
  .tt-n.on-path > .tt-card { border-color: var(--gold, #c99a2e); box-shadow: 0 0 0 3px color-mix(in srgb, var(--gold, #c99a2e) 25%, transparent); } .tt-n.on-path > .tt-card .tt-t b { color: var(--brand); } .tt-n.d0.on-path > .tt-card .tt-t b { color: #fff; }
  .tt-margas { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 10px; border-radius: 14px; border: 1px dashed color-mix(in srgb, var(--tl) 55%, var(--line)); background: color-mix(in srgb, var(--tl) 5%, var(--surface)); max-width: 560px; }
  .tt-margas-h { flex-basis: 100%; font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
  .tt-leaf { display: inline-block; padding: 5px 11px; border-radius: 999px; background: var(--surface); border: 1px solid var(--line); font-size: 13.5px; font-weight: 700; color: var(--ink); }
  .tt-leaf.hit { background: var(--gold, #d8b25e); border-color: var(--gold, #d8b25e); color: #111; box-shadow: 0 0 0 4px rgba(216,178,94,.3); }
  @media (max-width: 420px) { .tt { --ind: 12px; } .tt-card { padding: 9px 10px; gap: 8px; } .tt-t b { font-size: 14.5px; } .tt-tog { width: 24px; height: 24px; } }
  @media (min-width: 900px) { .tt { --ind: 22px; } }
  .taro-chip { display: inline-block; padding: 6px 12px; border-radius: 999px; background: var(--surface); border: 1px solid var(--line); font-size: 13.5px; font-weight: 700; color: var(--ink); }
  .taro-chip.hit { background: var(--gold, #d8b25e); border-color: var(--gold, #d8b25e); color: #111; box-shadow: 0 0 0 4px rgba(216,178,94,.3); }
  .taro-sug { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 12px; } .taro-chip.pick { cursor: pointer; background: color-mix(in srgb, var(--brand) 8%, var(--surface)); border-color: transparent; color: var(--brand); }
  .taro-res { background: linear-gradient(140deg, var(--brand), #2b2e74); color: #fff; border-radius: 20px; padding: 14px 16px; margin: 0 0 12px; box-shadow: 0 10px 24px rgba(30,32,90,.2); }
  .taro-res-h { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 8px; } .taro-res-h b { font-size: 20px; } .taro-res-h small { opacity: .75; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; }
  .taro-steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; } .taro-steps li { position: relative; padding-left: 22px; font-size: 14px; opacity: .9; }
  .taro-steps li::before { content: "↳"; position: absolute; left: 2px; opacity: .6; } .taro-steps li:first-child::before { content: "●"; font-size: 10px; top: 4px; }
  .taro-steps li.me { opacity: 1; font-weight: 800; color: #ffe29a; } .taro-none { margin: 0 0 12px; }
</style>`); } catch (e) {}

// ---------- Liturgy workbench: build every week from the month's order of service (YB 2026-10-30) ----------
// Agenda code lookup (YB 2026-10-30): "A.XV/A.1", "D.XIII.41", "B.7", "C.2" → the text, from an Agenda in Dokumen Gereja.
// A = verses by season (sub-parts A/B), B = confession prayers, C = words of forgiveness, D = opening prayers (numbered straight through).
const AG_ROM = "(?:XX|XIX|XVIII|XVII|XVI|XV|XIV|XIII|XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)";
function agLines(doc) { const out = []; (doc.sections || []).forEach((s) => { if (s.title) out.push(String(s.title).trim()); (s.lines || []).forEach((l) => { if (l && l.trim()) out.push(l.trim()); }); }); return out; }
function agRegions(L, lang) {
  const find = (re, from = 0, to = L.length) => { for (let i = from; i < to; i++) if (re.test(L[i])) return i; return -1; };
  const b0 = lang === "id" ? find(/^B\.\s+DOA PENGAKUAN DOSA/) : find(/^B\.\s+Tan/, Math.floor(L.length * 0.4));
  if (b0 < 0) return null;
  let a0 = -1; for (let i = b0 - 1; i >= 0; i--) if (/^I\.\s+A\s*D\s*V\s*E\s*N\s*T\s*U\s*S/i.test(L[i])) { a0 = i; break; }
  const c0 = find(/^C\.\s+\S/, b0 + 1); const d0 = lang === "id" ? find(/^D\.\s+\S/, b0 + 1) : find(/^I\.\s+A\s*D\s*V\s*E\s*N\s*T\s*U\s*S/i, Math.max(b0, c0) + 1);
  const e0 = find(/^E\.\s+\S/, d0 + 1);
  return { A: [a0, b0], B: [b0, c0 > 0 && (d0 < 0 || c0 < d0) ? c0 : d0], C: c0 > 0 && (d0 < 0 || c0 < d0) ? [c0, d0] : null, D: [d0, e0 > 0 ? e0 : L.length] };
}
function agItem(L, i, stop) {
  const out = []; const first = L[i].replace(/^(?:[A-D]\.\s*)?\d{1,3}\.\s*/, ""); if (first) out.push(first);
  for (let j = i + 1; j < stop; j++) { const l = L[j]; if (/^(?:[A-D]\.\s*)?\d{1,3}\.\s/.test(l) || new RegExp("^" + AG_ROM + "\\.\\s").test(l) || /^[A-E]\.\s+[A-Z]{3}/.test(l)) break; out.push(l); }
  return out.join(" ").replace(/\s+/g, " ").replace(/\bA\s+m\s+i\s+n\s*\.?/g, "Amin.").replace(/\bA\s+m\s+e\s+n\s*\.?/g, "Amen.").replace(/\s+([.,!?;:])(?=\s|$)/g, "$1").trim();
}
function agResolve(doc, lang, kind, sec, sub, n) {
  if (!doc) return null; const L = doc._lines || (doc._lines = agLines(doc)); const R = doc._reg || (doc._reg = agRegions(L, lang)); if (!R) return null;
  const r = R[kind]; if (!r || r[0] < 0) return null; const stop = r[1] > 0 ? r[1] : L.length;
  if (kind === "B" || kind === "C" || kind === "D") { const re = new RegExp("^(?:" + kind + "\\.\\s*)?" + n + "\\.\\s"); for (let i = r[0]; i < stop; i++) if (re.test(L[i])) return agItem(L, i, stop); return null; }
  const heads = []; for (let i = r[0]; i < stop; i++) if (new RegExp("^" + sec + "\\.\\s").test(L[i])) heads.push(i);
  for (const h of heads) { let end = stop; for (let j = h + 1; j < stop; j++) if (new RegExp("^" + AG_ROM + "\\.\\s").test(L[j])) { end = j; break; }
    let insub = !sub;
    for (let i = h + 1; i < end; i++) { if (!insub && new RegExp("^" + sub + "\\.\\s*(?:1\\.|\\S)").test(L[i])) insub = true; else if (insub && sub && /^[B-D]\.\s*1?\.?/.test(L[i]) && L[i][0] !== sub) break;
      if (insub && new RegExp("^(?:" + (sub || "[A-D]") + "\\.\\s*)?" + n + "\\.\\s").test(L[i])) return agItem(L, i, end); } }
  return null;
}
function agParse(s) { const t = String(s || "").replace(/\s+/g, ""); const o = {}; let m;
  m = t.match(/A\.?([IVX]+)[./]([AB])\.?(\d+)/); o.A = m ? [m[1], m[2], +m[3]] : null; m = t.match(/D\.?([IVX]+)\.?(\d+)/); o.D = m ? [m[1], null, +m[2]] : null;
  m = t.match(/B\.?(\d+)/); o.B = m ? +m[1] : null; m = t.match(/C\.?(\d+)/); o.C = m ? +m[1] : null; return o; }
// Liturgy from the month's order of service (YB 2026-10-30): read the PDF by position, find each week, and build the liturgist's script.
function pdfLinesFromItems(items) {
  // group text pieces by their height on the page (rows), then left to right; a wide gap becomes two spaces
  const rows = [];
  items.filter((it) => it.str && it.str.trim()).forEach((it) => { const x = it.transform[4], y = it.transform[5], h = Math.abs(it.transform[3]) || 10;
    let r = rows.find((q) => Math.abs(q.y - y) <= Math.max(2.5, h * 0.35)); if (!r) { r = { y, items: [] }; rows.push(r); } r.items.push({ x, w: it.width || 0, s: it.str }); });
  rows.sort((a, b) => b.y - a.y);
  return rows.map((r) => { r.items.sort((a, b) => a.x - b.x); let out = "", end = null; r.items.forEach((p) => { if (end != null) out += p.x - end > 6 ? "  " : (/\s$/.test(out) || /^\s/.test(p.s) ? "" : p.x - end > 1.2 ? " " : ""); out += p.s; end = p.x + p.w; }); return out.replace(/[ \t]+$/, ""); });
}
const AC_MONTHS = { januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6, juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12, january: 1, february: 2, march: 3, may: 5, june: 6, july: 7, august: 8, october: 10, december: 12 };
const AC_REF = "([1-3]?\\s?[A-Za-zÀ-ÿ]+(?:\\s[A-Za-zÀ-ÿ]+)?\\s+\\d+\\s*:\\s*\\d+[a-z]?(?:\\s*[-–]\\s*\\d+[a-z]?)?(?:\\s*[,.]\\s*\\d+(?:\\s*[-–]\\s*\\d+)?)*)";
function parseAcara(text) {
  const lines = String(text).replace(/\r/g, "").split("\n"); const flat = lines.join("\n");
  const dre = /(\d{1,2})\s*,?\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|january|february|march|may|june|july|august|october|december)\s+(20\d{2})/gi;
  const marks = []; let m; while ((m = dre.exec(flat))) marks.push({ at: m.index, day: `${m[3]}-${String(AC_MONTHS[m[2].toLowerCase()]).padStart(2, "0")}-${String(+m[1]).padStart(2, "0")}` });
  const weeks = [];
  marks.forEach((mk, i) => { if (weeks.some((w) => w.day === mk.day)) return;
    const start = Math.max(0, flat.lastIndexOf("\n", Math.max(0, flat.lastIndexOf("\n", mk.at - 1) - 1)));
    const block = flat.slice(start, i + 1 < marks.length ? Math.max(start, flat.lastIndexOf("\n", Math.max(0, flat.lastIndexOf("\n", marks[i + 1].at - 1) - 1))) : flat.length);
    weeks.push({ day: mk.day, ...parseWeek(block) }); });
  return weeks;
}
function parseWeek(block) {
  const t = block.replace(/[ \t]+/g, " "); const one = t.replace(/\s+/g, " ");
  const topic = ((one.match(/Top[i]k\s*:?\s*[“"'‘]\s*([^“”"'‘’\n]{4,120}?)\s*[”"'’]/i) || t.match(/Top[i]k\s*:?\s*([A-Z][^\n]{3,100})/i) || [])[1] || "").replace(/\s+ACARA IBADAH.*$/i, "").trim();
  const name = ((t.match(/\n\s*(Minggu\s+[^\n]{3,80}?)\s*\n/i) || [])[1] || "").replace(/\s+/g, " ").trim();
  const book0 = ((one.match(/Acara Kebaktian Minggu\s+(BN\/KJ|KJ\/BN|KJ|BE|BN)\b/i) || [])[1] || "KJ").toUpperCase().slice(0, 2);
  const ev = []; let m;
  const songRe = /(?:Bernyanyi|BERNYANYI|Marende|MARENDE)\s*(?:dari\s+(?:Buku Nyanyian(?:\s+HKBP)?|Kidung Jemaat|Buku Ende)\s*)?(?:(KJ|BE|BN|B\.\s?E|B\.\s?N|PKJ)\.?\s*(?:HKBP\.?)?\s*(?:N[Oo]\.?\s*:?\s*)?)?(\d{1,3})\s*:\s*(\d{1,2}(?:\s*[-–]\s*\d{1,2})?(?:\s*[,+]\s*\d{1,2}(?:\s*[-–]\s*\d{1,2})?)*)/g;
  while ((m = songRe.exec(one))) { let book = (m[1] || book0).replace(/[\s.]/g, "").toUpperCase(); if (book === "BN" && /Buku Nyanyian/i.test(m[0])) book = "BN";
    const vs = []; m[3].split(/[,+]/).forEach((p) => { const r = p.split(/[-–]/).map((x) => parseInt(x, 10)).filter((x) => x > 0); if (r.length === 2 && r[1] >= r[0] && r[1] - r[0] < 20) for (let q = r[0]; q <= r[1]; q++) vs.push(q); else if (r.length === 1) vs.push(r[0]); });
    const title = ((one.slice(m.index + m[0].length, m.index + m[0].length + 60).match(/^\s*[“"]\s*([^”"]{2,50})\s*[”"]/) || [])[1] || "").trim();
    ev.push({ at: m.index, k: "song", book: ["KJ", "BE", "BN"].includes(book) ? book : book0, num: +m[2], verses: vs, title, offering: /^[^\n]{0,70}?\(?\s*PERSEMBAHAN/i.test(one.slice(m.index + m[0].length, m.index + m[0].length + 90).split(/\s\d{1,2}\s*\.\s|Bernyanyi|BERNYANYI/)[0]) || /PERSEMBAHAN[^.]{0,40}$/i.test(one.slice(Math.max(0, m.index - 45), m.index)) }); }
  const add = (k, re, f) => { const r = new RegExp(re.source, "gi"); let x; while ((x = r.exec(one))) ev.push({ at: x.index, k, ...(f ? f(x) : {}) }); };
  add("votum", /Votum[^()]{0,70}?\(?\s*(A\s*\.?\s*[IVX]+\s*[./]\s*[AB]\s*\.?\s*\d+\s*[\/–-]\s*D\s*\.?\s*[IVX]+\s*\.?\s*\d+)/, (x) => ({ ref: x[1] }));
  add("hukum", new RegExp("Hukum\\s+(?:Tuhan|Taurat)\\s*:?\\s*([IVX]+\\s*[-–]\\s*[IVX]+|" + AC_REF.slice(1, -1) + ")"), (x) => ({ ref: x[1] }));
  add("confess", /(?:Pangakuan|Pengakuan)\s+Dosa[^()]{0,70}?\(?\s*(B\s*\.?\s*\d+\s*[-–\/]\s*C\s*\.?\s*\d+)/, (x) => ({ ref: x[1] }));
  add("epistel", new RegExp("Epistel\\s*:?\\s*" + AC_REF), (x) => ({ ref: x[1] }));
  add("creed", /Pengakuan\s+Iman/); add("warta", /Warta\s+Jemaat/);
  add("sermon", new RegExp("(?:Khotbah|Kotbah)\\s*:?\\s*" + AC_REF), (x) => ({ ref: x[1] }));
  add("close", /Doa\s+(?:Persembahan|Penutup)/);
  ev.sort((a, b) => a.at - b.at);
  const firstOf = (k) => ev.filter((e) => e.k === k).slice(0, 1);
  const plan = []; const seen = {};
  ev.forEach((e) => { if (e.k === "song") { if (!plan.some((p) => p.k === "song" && p.num === e.num && p.book === e.book)) plan.push(e); return; } if (seen[e.k]) return; seen[e.k] = 1; plan.push(e); });
  const scripted = (one.match(/\bL\s*:/g) || []).length >= 4 && !plan.some((p) => p.k === "votum");
  return { topic, name, book: book0, plan, scripted, lines: block.split("\n") };
}
function buildFromWeek(w, meta, T, agDoc) {
  const lang = meta.lang === "bt" ? "bt" : "id"; const t = T[lang]; const items = [];
  const L = (s) => t.L + ": " + s, J = (s) => t.J + ": " + s;
  const cue = (kind) => items.push({ t: "cue", kind, text: t[kind] });
  const standBefore = () => { for (let i = items.length - 1; i >= 0; i--) { const it = items[i]; if (it.t === "song") { it.standLast = true; return; } if (it.t === "part" || it.t === "reading") break; } cue("stand"); };
  const ag = (kind, sec, sub, n) => { const x = agResolve(agDoc, lang, kind, sec, sub, n); return x ? ["§" + x] : [`(${lang === "bt" ? "Ida Agenda" : "Lihat Agenda"} ${kind}${sec ? "." + sec : ""}${sub ? "/" + sub : ""}.${n})`]; };
  const nm = (meta.name || w.name || "").split(" · ")[0];
  items.push({ t: "welcome", title: lang === "bt" ? "Hata Panjouon" : "Ucapan Selamat Datang", lines: lang === "bt"
    ? [`Horas jala selamat ari Minggu ma di hita saluhutna. Goar ni Minggu sadarion: Minggu ${nm}.`, "Molo adong na parjolo hali marminggu di HKBP Singapura, hujou hami ma asa ro tu jolo laho mangalehon goarna. Mauliate.", "Tapasaut ma roha dohot pingkiranta marhitehite tangiang, laho mamuji Debata."]
    : [`Selamat hari Minggu bagi seluruh jemaat Tuhan yang terkasih. Hari ini kita beribadah pada Minggu ${nm}.`, "Jika ada di antara kita yang baru pertama kali beribadah di HKBP Singapura, kami undang ke depan untuk memperkenalkan diri. Terima kasih.", "Mari kita bersaat teduh sejenak dan berdoa, mempersiapkan hati untuk memuji dan memuliakan Tuhan."] });
  items.push({ t: "cue", kind: "music", text: "Musik" });
  let afterWarta = false, afterSermon = false;
  w.plan.forEach((p) => {
    if (p.k === "song") { const off = afterWarta || afterSermon || p.offering; items.push({ t: "song", book: p.book, num: p.num, verses: p.verses, title: p.title || "", lines: [], offering: !!off }); afterWarta = false; afterSermon = false; return; }
    afterWarta = false; afterSermon = false;
    if (p.k === "votum") { const r = agParse(p.ref); standBefore();
      items.push({ t: "part", title: t.parts.votum, lines: [L(t.votum[0]), ...(r.A ? ag("A", ...r.A) : []), J(t.haleluya)] });
      items.push({ t: "part", title: lang === "bt" ? "Martangiang" : "Berdoa", lines: [L(lang === "bt" ? "Martangiang ma hita." : "Marilah kita berdoa."), ...(r.D ? ag("D", r.D[0], null, r.D[2]) : []), J(lang === "bt" ? "Amen." : "Amin.")] }); cue("sit"); return; }
    if (p.k === "hukum") { const rng = p.ref.replace(/\s/g, ""); const ROM = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
      if (/^[IVX]+[-–][IVX]+$/.test(rng)) { const [a, b] = rng.split(/[-–]/).map((x) => ROM.indexOf(x)); items.push({ t: "part", title: t.parts.hukum, lines: [L(t.hukum_intro), ...ROM.slice(a, b + 1).map((r) => `§${r}. ${t.hukum[r]}`), ...t.hukum_close.map((x) => "§" + x), J(t.hukum_resp)] }); }
      else items.push({ t: "reading", title: t.parts.hukum, ref: p.ref.replace(/\s+/g, " ").replace(/\b([A-Z])([A-Z]+)\b/g, (q, a, b) => a + b.toLowerCase()), ver: lang === "bt" ? "toba" : "tb", intro: [L(t.hukum_intro)], close: [J(t.hukum_resp)] }); return; }
    if (p.k === "confess") { const r = agParse(p.ref); standBefore(); items.push({ t: "part", title: t.parts.confess, lines: [L(t.confess_intro), ...(r.B ? ag("B", null, null, r.B) : []), L(t.promise_intro), ...(r.C ? ag("C", null, null, r.C) : []), "L+J: " + (lang === "bt" ? "Amen." : "Amin.")] }); cue("sit"); return; }
    const pretty = (s) => s.replace(/\s+/g, " ").replace(/\b([A-Z])([A-Z]+)\b/g, (q, a, b) => a + b.toLowerCase());
    if (p.k === "epistel") { items.push({ t: "reading", title: t.parts.epistel, ref: pretty(p.ref), ver: lang === "bt" ? "toba" : "tb", intro: [L(t.epistel_intro)], close: [L(t.epistel_close)] }); return; }
    if (p.k === "creed") { standBefore(); items.push({ t: "part", title: t.parts.creed, lines: [L(t.creed[0]), ...t.creed.slice(1)] }); cue("sit"); return; }
    if (p.k === "warta") { items.push({ t: "note", title: lang === "bt" ? "Koor sian HKBPS (molo adong)" : "Koor dari HKBPS (jika ada)", text: "" });
      items.push({ t: "note", title: t.warta, say: lang === "bt" ? "Tabege ma tingting ni huria di ari Minggu on." : "Marilah kita mendengar warta jemaat pada hari Minggu ini.", text: meta.warta ? (lang === "bt" ? "Dijaha " : "Dibacakan oleh ") + meta.warta : "" });
      items.push({ t: "note", title: lang === "bt" ? "Koor sian tamu (molo adong)" : "Koor dari tamu (jika ada)", text: "" }); afterWarta = true; return; }
    if (p.k === "sermon") { items.push({ t: "note", title: t.sermon + ": " + pretty(p.ref), text: meta.preacher || "" }); afterSermon = true; return; }
    if (p.k === "close") { standBefore();
      items.push({ t: "part", title: lang === "bt" ? "Tangiang Pelean" : "Doa Persembahan", lines: [L(t.offer_prayer[0]), ...t.offer_prayer.slice(1)] });
      items.push({ t: "part", title: lang === "bt" ? "Marende (Huria, dipandu Song Leader)" : "Bernyanyi (Jemaat, dipandu Song Leader)", lines: [J("♫ " + (t.offer_song.length ? t.offer_song.join(" ") : "Ale Tuhan, sai jalo ma …"))] });
      items.push({ t: "part", title: lang === "bt" ? "Tangiang Ale Amanami" : "Doa Bapa Kami", lines: [L(t.our_father[0]), ...t.our_father.slice(1), J("♫ " + t.our_father_resp)] });
      items.push({ t: "part", title: lang === "bt" ? "Pasupasu" : "Doa Berkat", lines: [L(t.blessing[0]), ...t.blessing.slice(1), J("♫ " + t.amen)],
        after: lang === "bt" ? "(Parjamita dohot Paragenda laho tu jolo ni pintu gareja manalami ruas, jala angka parhalado manutup ulaon i dohot tangiang na dipangulahon Parjamita.)" : "(Pengkhotbah dan Liturgis berjalan ke depan pintu gereja untuk berjabat tangan dengan jemaat, dan para pelayan menutup pelayanan dengan doa yang dipimpin oleh Pengkhotbah.)" }); }
  });
  return items;
}
function buildScripted(w, meta, T) {
  const lang = meta.lang === "bt" ? "bt" : "id"; const t = T[lang]; const nm = (meta.name || w.name || "").split(" · ")[0];
  const items = [{ t: "welcome", title: lang === "bt" ? "Hata Panjouon" : "Ucapan Selamat Datang", lines: lang === "bt"
    ? [`Horas jala selamat ari Minggu ma di hita saluhutna. Goar ni Minggu sadarion: Minggu ${nm}.`, "Molo adong na parjolo hali marminggu di HKBP Singapura, hujou hami ma asa ro tu jolo laho mangalehon goarna. Mauliate.", "Tapasaut ma roha dohot pingkiranta marhitehite tangiang, laho mamuji Debata."]
    : [`Selamat hari Minggu bagi seluruh jemaat Tuhan yang terkasih. Hari ini kita beribadah pada Minggu ${nm}.`, "Jika ada di antara kita yang baru pertama kali beribadah di HKBP Singapura, kami undang ke depan untuk memperkenalkan diri. Terima kasih.", "Mari kita bersaat teduh sejenak dan berdoa, mempersiapkan hati untuk memuji dan memuliakan Tuhan."] }, { t: "cue", kind: "music", text: "Musik" }];
  const L = w.lines.map((l) => l.replace(/\s{2,}/g, " ").trim()).filter((l) => l && !/^\d+\s*\|?\s*ACARA IBADAH/i.test(l) && !/^ACARA IBADAH( BULAN)?/i.test(l) && !/^\d{1,3}\s*\|?$/.test(l));
  const isHead = (l) => /^\d{1,2}\s*\.\s*\S/.test(l) && /[A-Z]{4}/.test(l.slice(0, 40)) || /^(Bernyanyi|BERNYANYI)\b/.test(l);
  let i = L.findIndex(isHead); if (i < 0) return null;
  const sections = []; let cur = null;
  for (; i < L.length; i++) { const l = L[i];
    if (isHead(l)) { cur = { head: l.replace(/^\d{1,2}\s*\.\s*/, ""), body: [] }; sections.push(cur); continue; }
    if (cur) { const p = cur.body[cur.body.length - 1]; if (p && !/^(L\+J|L|J)\s*:/.test(l) && !/Berdiri|Duduk/i.test(l) && !/^\d\s*[.:]\s/.test(l) && !/[.!?:;”"»)…]$/.test(p)) cur.body[cur.body.length - 1] = p + " " + l; else cur.body.push(l); } }
  const songRe = /(KJ|BE|BN|B\.\s?E|B\.\s?N)\.?\s*(?:HKBP\.?)?\s*(?:N[Oo]\.?\s*:?\s*)?(\d{1,3})\s*:\s*(\d{1,2}(?:\s*[-–]\s*\d{1,2})?(?:\s*[,+]\s*\d{1,2}(?:\s*[-–]\s*\d{1,2})?)*)/;
  const cap = (x) => (x === x.toUpperCase() ? x.toLowerCase().replace(/(^|[\s(–-])(\p{L})/gu, (m, a, c) => a + c.toUpperCase()) : x);
  for (const sec of sections) {
    const sm = sec.head.match(songRe);
    if (sm && /BERNYANYI|Bernyanyi|MARENDE/.test(sec.head)) { const vs = []; sm[3].split(/[,+]/).forEach((p) => { const r = p.split(/[-–]/).map((x) => parseInt(x, 10)).filter((x) => x > 0); if (r.length === 2 && r[1] >= r[0]) for (let q = r[0]; q <= r[1]; q++) vs.push(q); else if (r.length === 1) vs.push(r[0]); });
      items.push({ t: "song", book: sm[1].replace(/[\s.]/g, "").toUpperCase(), num: +sm[2], verses: vs, title: ((sec.head.match(/[“"]\s*([^”"]+?)\s*[”"]/) || [])[1] || ""), lines: sec.body.filter((x) => !/Berdiri/i.test(x)), offering: /PERSEMBAHAN/i.test(sec.head), standLast: sec.body.some((x) => /Berdiri/i.test(x)) }); continue; }
    let part = { t: "part", title: cap(sec.head.replace(/\s*\((?:L|Liturgis)\s*:[^)]*\)\s*$/i, "").trim()), lines: [] };
    for (const x of sec.body) {
      if (/^-*\s*\(?\s*Jemaat\s+Berdiri\s*\)?\s*-*$|^-+\s*Berdiri\s*-+$/i.test(x)) { if (part.lines.length) items.push(part); items.push({ t: "cue", kind: "stand", text: t.stand }); part = { ...part, lines: [] }; continue; }
      if (/\(Jemaat\s+Duduk\)/i.test(x)) { part.lines.push(x.replace(/\s*\(Jemaat\s+Duduk\)/i, "")); items.push(part); items.push({ t: "cue", kind: "sit", text: t.sit }); part = { ...part, lines: [] }; continue; }
      part.lines.push(x); }
    if (part.lines.length || !items.length || items[items.length - 1].title !== part.title) items.push(part);
  }
  return items;
}
const LIT_T = {"id": {"votum": ["Di dalam Nama Allah Bapa, dan Nama AnakNya Tuhan Yesus Kristus dan Nama Roh Kudus, yang menciptakan langit dan bumi. Amin."], "haleluya": "Haleluya - Haleluya - Haleluya!", "hukum_intro": "Dengarlah Hukum Tuhan!", "hukum": {"I": "Akulah Tuhan Allahmu! Jangan ada padamu allah lain di hadapanKu.", "II": "Jangan perbuat bagimu patung yang menyerupai apapun yang ada di langit, atau yang ada di bumi, atau yang ada di dalam air di bawah bumi, untuk disembah atau dituruti.", "III": "Jangan menyebut Nama Tuhan AllahMu dengan sembarangan sebab Tuhan akan menghukum orang yang menyianyiakan namaNya.", "IV": "Ingat dan kuduskanlah hari Sabat: enam hari lamanya engkau akan bekerja dan melakukan segala pekerjaanmu, tetapi hari ke tujuh adalah hari Sabat Tuhan, Allahmu maka jangan melakukan sesuatu pekerjaan, engkau atau anakmu laki-laki, atau anakmu perempuan atau hambamu laki-laki atau hambamu perempuan, atau hewanmu, atau orang asing yang berada di tempat kediamanmu. Sebab pada enam hari lamanya Tuhan menjadikan langit dan bumi laut dan segala isinya, dan Ia berhenti pada hari yang ke tujuh, itulah sebabnya Tuhan memberkati hari Sabat dan menguduskannya.", "V": "Hormatilah ayah dan ibumu, supaya lanjut umurmu di bumi yang diberikan Tuhan, Allahmu, kepadamu.", "VI": "Jangan membunuh.", "VII": "Jangan berzina.", "VIII": "Jangan mencuri.", "IX": "Jangan mengucapkan saksi dusta terhadap sesamamu manusia.", "X": "Jangan mengingini rumah sesamamu: Jangan mengingini isterinya, atau hambanya laki-laki, atau hambanya perempuan atau lembunya atau keledainya, atau apapun yang dimiliki sesamamu."}, "hukum_close": ["Bagaimana Firman Tuhan tentang kesepuluh Hukum itu?", "\"Aku, Tuhan, Allahmu, adalah Allah yang cemburu, yang membalaskan kesalahan bapa kepada anak-anaknya, kepada keturunannya yang ketiga dan keempat dari orang yang membenci Aku, tetapi Aku menunjukkan Kasih setia kepada beribu-ribu orang, yaitu mereka yang mengasihi Aku dan berpegang pada perintah-perintahKu\"."], "hukum_resp": "Ya Tuhan, Allah, kuatkanlah kami melakukan yang sesuai dengan HukumMu.", "confess_intro": "Marilah kita merendahkan diri untuk mengaku dosa kita!", "promise_intro": "Marilah kita mendengar janji Tuhan tentang pengampunan dosa.", "epistel_intro": "Marilah kita mendengar Firman Tuhan yang ditetapkan untuk hari Minggu ini.", "epistel_close": "Berbahagialah orang yang mendengar Firman Allah serta memeliharanya. Amin.", "creed": ["Marilah kita bersama-sama mengaku iman kepercayaan kita, sebagaimana teman-teman seiman di seluruh dunia. Kita bersama-sama mengucapkannya:", "Aku percaya kepada Allah, Bapa yang Mahakuasa, Khalik langit dan bumi.", "Aku percaya kepada Yesus Kristus, AnakNya yang tunggal Tuhan kita. Yang dikandung daripada Roh Kudus, lahir dari anak dara Maria, yang menderita sengsara di bawah pemerintahan Pontius Pilatus, disalibkan, mati dan dikuburkan, yang turun ke dalam kerajaan maut. Pada hari yang ketiga, bangkit pula dari antara orang mati.", "Naik ke surga, duduk di sebelah kanan Allah, Bapa yang Mahakuasa. Dari sana akan datang kelak, untuk menghakimi orang yang hidup dan yang mati Aku percaya kepada Roh Kudus, dan adanya satu gereja yang Kudus; Persekutuan orang Kudus; Pengampunan dosa; Kebangkitan daging; dan hidup yang kekal.", "Amin."], "offer_prayer": ["Marilah kita berdoa untuk menyerahkan persembahan kita kepada Tuhan:", "Ya Allah, Bapa kami yang di surga. Kami mengaku bahwa Tuhan adalah sumber dari segala karunia yang melimpah dalam kehidupan kami masing-masing.", "Sebahagian daripada karunia itu, kami serahkan kembali sebagai persembahan kepada Tuhan.", "Terimalah dan berkatilah persembahan umatMu ini, agar dapat kami pergunakan untuk pekerjaan dan pelayanan Kerajaan Tuhan di dunia ini.", "Bukalah hati kami untuk mengenal betapa banyak berkat dan karunia yang kami peroleh dari Tuhan, supaya kami senantiasa bersyukur kepadaMu di dalam Nama Yesus Kristus Tuhan kami. Amin."], "offer_song": ["Tuhan, karuniaMu, roh dan jiwaku semua. Nyawa juga hidupku, harta milikku semua.", "Kuserahkan padaMu, untuk selama-lamanya."], "our_father": ["Bapa kami yang di surga, dikuduskanlah namaMu, datanglah kerajaanMu, jadilah kehendakMu di bumi seperti di surga.", "Berikanlah kami pada hari ini makanan kami yang secukupnya.", "Dan ampunilah kami akan kesalahan kami, seperti kami juga telah mengampuni orang yang bersalah kepada kami.", "Dan janganlah membawa kami ke dalam pencobaan, tetapi lepaskanlah kami daripada yang jahat."], "our_father_resp": "Karena Engkau punya Kerajaan dan Kekuasaan dan Kemuliaan sampai selama- lamanya. Amin.", "blessing": ["Pulanglah dengan sejahtera, dan terimalah berkat Tuhan:", "\"Tuhan memberkati engkau dan melindungi engkau, Tuhan menyinari engkau dengan wajahNya dan memberi engkau Kasih karunia, Tuhan menghadapkan wajahNya kepadamu dan memberi engkau damai sejahtera\"."], "amen": "Amin - Amin - Amin.", "L": "Liturgis", "J": "Jemaat", "stand": "Jemaat dipersilakan berdiri.", "sit": "Jemaat dipersilakan duduk kembali.", "warta": "Warta Jemaat", "sermon": "Khotbah", "parts": {"votum": "Votum / Introitus", "hukum": "Hukum Tuhan", "confess": "Pengakuan Dosa", "epistel": "Epistel", "creed": "Pengakuan Iman Rasuli", "close": "Doa Persembahan – Doa Bapa Kami – Doa Berkat"}}, "bt": {"votum": ["Marhitehite Goar ni Debata Ama dohot Goar ni AnakNa, Tuhan Jesus Kristus dohot Goar ni Tondi Parbadia, na tumompa langit dohot tano on. Amen."], "haleluya": "Haleluya! Haleluya! Haleluya!", "hukum_intro": "Tangihon hamu ma Patik ni Debata.", "hukum": {"I": "Ahu do Jahowa Debatam, ninna Debatanta. Ndang jadi marangkup Ahu bahenonmu Debatam.", "II": "Ndang jadi ganaonmu jala ndang jadi sumanonmu manang aha na di banua ginjang dohot na di banua tonga on, ro di na di bagasan aek na di toru ni tano, ianggo tung gabe sisombaon manang sioloan.", "III": "Ndang jadi dohonon Goar ni Debata, ianggo so ture dalanna, ai hona uhumNa do sogot angka na marsineang di GoarNa.", "IV": "Ingot hamu ma pabadiahon ari Minggu i! Di na onom ari ma ula hamu nasa siulaonmu; alai anggo ari papituhon i, ari paradianan ni Jahowa Debatam doi. Ndang jadi ho mangula anggo di na sadari i, manang anakmu pe manang borum manang naposom lahilahi manang naposom boruboru, ro di pinahanmu, ro di isi ni huta ni halak pe na mangebati hutam. Aidina onom ari do ditompa Debata langit dohot tano dohot laut dohot nasa isina, dung i maradian do Ibana di ari papituhon i. Dibahen i do umbahen na dipasupasu Debata Jahowa ari paradiananNa i jala diparbadiai.", "V": "Ingkon pasangaponmu do natorasmu, asa martua ho jala leleng mangolu di tano na nilehon ni Jahowa Debatam di ho,", "VI": "Unang ho mamunu!", "VII": "Unang ho mangalangkup!", "VIII": "Unang ho manangko!", "IX": "Unang ho olo manghatindangkon hata na so tutu maralohon dongan jolma.", "X": "Ndang jadi haliangan ni roham bagas ni donganmu, ndang jadi haliangan ni roham dongan saripe ni donganmu, manang naposona baoa manang naposona boruboru manang lombuna manang hodana, manang dia pe ugasan ni donganmu."}, "hukum_close": ["Beha pandok ni Debata taringot tu Patik na sampulu i?", "‘On do: Ahu do Jahowa Debatam, ninna Debatanta. Pargogo na so hatudosan jala Parrimas, Siluluhon dosa ni amaama tu pinomparna, ro di sundut patoluhon, ro di sundut paopathon, pinompar ni angka na sogo roha di Ahu; alai asi do rohangKu di angka na marriburibu, angka na marholong ni roha di Ahu, na so mangalaosi PatikHi (Manang pamilliton sian Katechismus i singkat ni Patik ondeng)."], "hukum_resp": "Ale Tuhan Debata! Sai pargogoi ma hami mangulahon na hombar tu PatikMi.", "confess_intro": "Tatopoti ma dosanta!", "promise_intro": "Tabege ma hata bagabaga taringot tu hasesaan ni dosa.", "epistel_intro": "Tabege ma Hata ni Debata turpuk ni ari Minggu on.", "epistel_close": "Martua do angka na tumangihon Hata ni Debata, jala na umpeopsa. Amen.", "creed": ["Tahatindangkon ma haporseaonta i, songon na hinatindangkon ni donganta sahaporseaon di sandok portibi on. Rap ma hita mandok:", "Ahu porsea di Debata Jahowa, i do Ama, Pargogo na so hatudosan na tumompa langit dohot tano.", "Ahu porsea di Jesus Kristus, Anak ni Debata Jahowa, na sasada i; i ma na tinubuhon ni si Maria na gabegabean sian Tondi Parbadia andorang so habubuhan;", "ido Tuhanta, na tumaon na bernit di panguhuman ni si Latus; na mate tarpajal do Ibana di hau pinarsilang, na tuat tu banua toru, dung ditanom, na mulak mangolu di ari patoluhon, na manack tu surgo laho hundul tu siamun ni Debata Jahowa, AmaNa i, Pargogo na so hatudosan i, disi ma Ibana, paima mulak sogot tu tano on manguhumi halak na mangolu dohot na mate.", "Ahu porsea di Tondi Parbadia, jala adong sada huria na badia, Huria hatopan ni halak Kristen angka na badia, dohot di hasesaan ni dosa, dohot di Hata i, na mandok: Mulak mangolu sogot daging ni halak naung mate, dohot di hangoluan na so ra suda."], "offer_prayer": ["a. Tatangianghon ma peleanta:", "Ale Debata, Amanami na di banua ginjang, Ho do haroroan ni saluhut silehonlehon na denggan dohot nasa uhbasa na mauliutus.", "Hupasahat hami ma sian na nilehonMi tu hami, peleannami tu Ho. Sai jalo ma i gabe uap na hushus di joloM. Pasupasu ma i jala ramoti asa huparhaseang hami pelean on, patimbulhon harajaonMu di tongatonga ni HuriaM dohot di portibi on.", "Buhai ma rohanami marhitehite TondiM, asa lam hutanda hami godang ni silehonlehonMi tu hami, asa lam girgir hami mandok mauliate tu Ho, marhitehite / Jesus Kristus Tuhannami. Amen."], "offer_song": [], "our_father": ["Ale Amanami na di banua ginjang! Sai pinarbadia ma GoarMu! Sai ro ma harajaonMu! Sai saut ma lomo ni rohaM di banua tonga on songon na di banua ginjang! Lehon ma tu hami sadari on hangoluan siapari! Sesa ma dosanami songon panesanami di dosa ni dongan na mardosa tu hami! Unang hami togihon tu pangunjunan! Palua ma hami sian pangago!"], "our_father_resp": "Ai Ho do nampuna harajaon dohot hagogoon ro di hasangapon saleleng ni lelengna. Amen!", "blessing": ["Laho ma hamu marhitehite dame, jala jalo hamu ma pasupasu ni Debata:", "\"Sai dipasupasu Jahowa ma ho jala diramoti!", "Sai disondangi Jahowa ma ho marhitehite bohiNa jala asi ma rohaNa di ho!", "Sai diompakkon Jahowa ma bohiNa tu ho jala dilehon ma tu ho hadameon!\""], "amen": "Amen, Amen, Amen.", "L": "Paragenda", "J": "Huria", "stand": "Jongjong ma hamu saluhutna.", "sit": "Hundul ma hamu saluhutna.", "warta": "Tingting", "sermon": "Jamita", "parts": {"votum": "Votum / Introitus", "hukum": "Patik ni Debata", "confess": "Panopotion Dosa", "epistel": "Epistel", "creed": "Haporseaon (Panindangion Haporseaon)", "close": "Tangiang Pelean – Ale Amanami – Pasupasu"}}};
async function pdfLayoutText(file, onPage) {
  const lib = await pdfjsLoad(); const doc = await lib.getDocument({ data: await file.arrayBuffer() }).promise; let out = "";
  for (let p = 1; p <= doc.numPages; p++) { const tc = await (await doc.getPage(p)).getTextContent(); out += pdfLinesFromItems(tc.items).join("\n") + "\n"; if (onPage) onPage(p, doc.numPages); }
  return out;
}
// the week's details from the Parhalado roster: language, Sunday name, preacher, liturgist, announcements
function rosterMeta(day) {
  const out = {};
  (D.rosters || []).filter((r) => r.group_id === "parhalado").forEach((r) => (r.table_json || []).forEach((tb) => { const rows = tb.rows || []; const head = (rows[0] || []).map((h) => String(h || ""));
    const col = (re) => head.findIndex((h) => re.test(h));
    rows.slice(1).forEach((row) => { if (rowDate(row, r.month) !== day || out.name) return; const v = (re) => { const i = col(re); return i >= 0 ? String(row[i] || "").trim() : ""; };
      out.lang = /batak/i.test(v(/Bahasa/i)) ? "bt" : "id"; out.name = v(/Nama Minggu/i); out.preacher = v(/Khotbah|Pengkhotbah/i); out.resort = v(/Asal|Resort/i);
      out.liturgist = v(/Liturgis|Agenda/i); out.warta = v(/Warta/i); }); }));
  return out;
}
const LAUTO = { weeks: [] };
A.litAuto = () => {
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".pdf,.txt,application/pdf,text/plain";
  inp.onchange = async () => { const file = inp.files && inp.files[0]; if (!file) return;
    sheet("📥 " + L3("Membaca Acara Ibadah", "Manjaha Acara Ibadah", "Reading the order of service"), `<p class="small muted">${esc(file.name)}</p><div class="rec-bar"><i id="impBar"></i></div><p class="small" id="impPct"></p>`);
    try {
      const text = /\.txt$/i.test(file.name) ? await file.text() : await pdfLayoutText(file, (p, n) => { const b = document.getElementById("impBar"); if (b) b.style.width = Math.round((p / n) * 100) + "%"; const e = document.getElementById("impPct"); if (e) e.textContent = `${p} / ${n}`; });
      const weeks = parseAcara(text); if (!weeks.length) throw new Error(L3("Tidak ada tanggal ibadah yang terbaca (mis. “01 NOVEMBER 2026”). Berkas hasil scan tidak bisa dibaca.", "Ndang adong tanggal.", "No service dates found (e.g. “01 NOVEMBER 2026”). Scanned files can't be read."));
      const ag = {}; for (const k of ["id", "bt"]) { try { ag[k] = await docLoad("agenda-" + k, false); } catch (e) { ag[k] = null; } }
      const have = await litList(true);
      LAUTO.weeks = weeks.map((w) => { const rm = rosterMeta(w.day); const txt = w.lines.join(" "); const cnt = (re) => (txt.match(re) || []).length;
        const lang = rm.lang || (w.book === "BE" && !w.scripted ? "bt" : null) || (cnt(/\b(Marende|Huria|Paragenda|Tangiang|Patik|Jamita|Haporseaon)\b/gi) > cnt(/\b(Bernyanyi|Jemaat|Liturgis|Doa|Hukum|Khotbah|Pengakuan)\b/gi) ? "bt" : "id");
        const pretty = (x) => (x === x.toUpperCase() ? x.toLowerCase().replace(/(^|[\s(–-])(\p{L})/gu, (m, a, c) => a + c.toUpperCase()).replace(/\b(Xx|Xv|Xi|Iv|Vi|Ii|Iii|Viii|Vii|Xxi|Xxii|Xxiii|Xxiv|Xxv|Xiii|Xii|Xiv|Xvi|Xvii|Xviii|Xix)\b/g, (r) => r.toUpperCase()) : x);
        const name = rm.name || pretty((w.name || "").replace(/^Minggu\s+/i, "")) || "Ibadah Minggu";
        const meta = { day: w.day, lang, name, topic: w.topic ? pretty(w.topic) : "", preacher: rm.preacher || "", resort: rm.resort || "", liturgist: rm.liturgist || "", warta: rm.warta || "" };
        const items = w.scripted ? buildScripted(w, meta, LIT_T) || [] : buildFromWeek(w, meta, LIT_T, ag[lang]);
        const ex = (have || []).find((x) => x.day === w.day);
        return { ...meta, items, id: ex ? ex.id : null, scripted: w.scripted, on: true,
          songs: items.filter((x) => x.t === "song").length, reads: items.filter((x) => x.t === "reading").map((x) => x.ref).filter(Boolean),
          missing: items.filter((x) => (x.lines || []).some((l) => /^\((Lihat|Ida) Agenda/.test(l))).length, noAgenda: !ag[lang] && !w.scripted }; });
      litAutoSheet();
    } catch (e) { closeSheet(); toast(e.message || errMsg(e), true); } };
  inp.click();
};
function litAutoSheet() {
  sheet("📥 " + L3("Liturgi dari Acara Ibadah", "Liturgi sian Acara Ibadah", "Liturgy from the order of service"), `<p class="small muted">${esc(L3("Periksa setiap minggu. Lagu, nas dan kode Agenda diambil dari berkas; pengkhotbah, liturgis dan bahasa dari roster Parhalado.", "Ida ganup minggu.", "Check each week. Songs, readings and Agenda codes come from the file; preacher, liturgist and language from the Parhalado roster."))}</p>
    <div class="card">${LAUTO.weeks.map((w, i) => `<label class="li lauto"><input type="checkbox" class="lauto-cb" data-i="${i}"${w.on ? " checked" : ""}><span class="date-chip"><b>${esc(fmt(w.day, { day: "numeric" }))}</b><small>${esc(fmt(w.day, { month: "short" }))}</small></span>
      <span class="grow"><b>${esc(w.name)}</b><small>${w.lang === "bt" ? "Batak" : "Indonesia"} · 🎵 ${w.songs} · 📖 ${esc(w.reads.join(", ") || "–")}${w.liturgist ? " · 📜 " + esc(w.liturgist) : ""}</small>
      <small>${w.scripted ? `<span class="badge">${esc(L3("naskah lengkap dari berkas", "naskah lengkap", "full script from the file"))}</span> ` : ""}${w.noAgenda ? `<span class="badge warn">${esc(L3("Agenda belum ada di Dokumen Gereja", "Agenda dang adong", "Agenda not in Church Documents"))}</span> ` : w.missing ? `<span class="badge warn">${w.missing} ${esc(L3("kode Agenda tidak ditemukan", "kode ndang dapot", "Agenda codes not found"))}</span> ` : !w.scripted ? `<span class="badge ok">✓ Agenda</span> ` : ""}<span class="badge">${esc(w.id ? L3("memperbarui", "manguba", "updates existing") : L3("baru", "baru", "new"))}</span></small></span></label>`).join("")}</div>
    <button class="btn primary block" data-act="litAutoSave">💾 ${esc(L3("Simpan", "Simpan", "Save"))} ${LAUTO.weeks.filter((w) => w.on).length} ${esc(L3("minggu", "minggu", "weeks"))}</button><button class="btn ghost block" data-act="closeSheet">${esc(t("cancel"))}</button>`);
}
document.addEventListener("change", (e) => { const el = e.target; if (!el || !el.classList || !el.classList.contains("lauto-cb")) return; const w = LAUTO.weeks[+el.dataset.i]; if (w) w.on = !!el.checked; const b = document.querySelector('[data-act="litAutoSave"]'); if (b) b.textContent = `💾 ${L3("Simpan", "Simpan", "Save")} ${LAUTO.weeks.filter((x) => x.on).length} ${L3("minggu", "minggu", "weeks")}`; });
A.litAutoSave = async (d, btn) => { const todo = LAUTO.weeks.filter((w) => w.on); if (!todo.length) return;
  try { await busy(btn, async () => { for (const w of todo) { await api.save("lit_save", { id: w.id || null, day: w.day, lang: w.lang, name: w.name, topic: w.topic, preacher: w.preacher, resort: w.resort, liturgist: w.liturgist, warta: w.warta, items: w.items, draft: false }); } });
    closeSheet(); LIT.list = null; toast(L3(`${todo.length} minggu tersimpan.`, `${todo.length} minggu tarsimpan.`, `${todo.length} weeks saved.`)); render(); } catch (e) { toast(errMsg(e), true); } };
try { document.head.insertAdjacentHTML("beforeend", `<style>.lauto { align-items: center; } .lauto input { width: 20px; height: 20px; flex: none; } .badge.ok { background: #dcf3e4; color: #17633a; }</style>`); } catch (e) {}
try { document.head.insertAdjacentHTML("beforeend", `<style>
  /* Home top (YB 2026-10-30): one hero band, then one This Sunday card */
  .hero { background: linear-gradient(140deg, var(--brand) 0%, #23266b 62%, #3b2f7a 100%); color: #fff; border-radius: 26px; padding: 18px 18px 16px; margin: 6px 0 14px; box-shadow: 0 14px 30px rgba(30,32,90,.22); position: relative; overflow: hidden; }
  .hero::after { content: ""; position: absolute; right: -40px; top: -40px; width: 160px; height: 160px; border-radius: 50%; background: radial-gradient(circle, rgba(216,178,94,.35), transparent 70%); pointer-events: none; }
  .hero .hero-date { margin: 0; font-size: 12.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: rgba(255,255,255,.75); }
  .hero h1 { color: #fff; margin: 4px 0 14px; font-size: 26px; line-height: 1.15; position: relative; z-index: 1; padding-right: 62px; } .hero .hero-date { padding-right: 62px; }
  .hero .hero-search { display: flex; align-items: center; gap: 10px; background: #fff; color: var(--muted); border: 0; border-radius: 16px; padding: 12px 14px; margin: 0; box-shadow: 0 4px 14px rgba(0,0,0,.12); position: relative; z-index: 1; text-decoration: none; font-size: 15px; }
  .hero .hero-search svg { width: 18px; height: 18px; color: var(--brand); flex: none; } .hero .hero-search span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .card.sunday { padding: 14px 14px 10px; border-top: 0; border-left: 5px solid var(--gold, #d8b25e); }
  .sun-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
  .sun-head .sun-kick { display: grid; font-size: 16px; font-weight: 800; color: var(--ink); } .sun-head .sun-kick small { font-size: 12.5px; font-weight: 600; color: var(--muted); }
  .sun-open { display: inline-flex; align-items: center; gap: 2px; font-weight: 800; font-size: 14px; color: var(--brand); text-decoration: none; background: color-mix(in srgb, var(--brand) 9%, var(--surface)); padding: 6px 10px 6px 12px; border-radius: 999px; }
  .sun-open svg { width: 16px; height: 16px; }
  .sun-acts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 8px; }
  .sun-acts > a, .sun-acts > span.off { display: grid; justify-items: center; gap: 4px; padding: 10px 6px; border-radius: 14px; background: var(--surface-2, #f4f5fa); border: 1px solid var(--line); color: var(--ink); text-decoration: none; font-size: 12.5px; font-weight: 700; text-align: center; line-height: 1.2; }
  .sun-acts > a > span, .sun-acts > span.off > span { font-size: 22px; line-height: 1; } .sun-acts > span.off { opacity: .45; }
  .sun-acts > a:active { transform: scale(.97); }
  main.cols > .hero, main.cols > .card.sunday { grid-column: 1 / -1; }
</style>`); } catch (e) {}
// ---------- Floating chat bubble (YB 2026-10-30): top right by default, drag it anywhere; the place is kept on this phone ----------
function chatFabPos() { const p = LS.get("chatFab", null); const W = window.innerWidth || 390, Hh = window.innerHeight || 800;
  const x = p ? Math.round(p.x * W) : W - 74, y = p ? Math.round(p.y * Hh) : 92;
  return `left:${Math.max(6, Math.min(W - 64, x))}px;top:${Math.max(6, Math.min(Hh - 130, y))}px`; }
(() => { let drag = null;
  document.addEventListener("pointerdown", (e) => { const f = e.target.closest && e.target.closest("#chatFab"); if (!f) return; const r = f.getBoundingClientRect(); drag = { f, dx: e.clientX - r.left, dy: e.clientY - r.top, x0: e.clientX, y0: e.clientY, moved: false }; try { f.setPointerCapture(e.pointerId); } catch (err) {} e.stopPropagation(); }, true);
  document.addEventListener("pointermove", (e) => { if (!drag) return; if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) return; drag.moved = true; drag.f.classList.add("dragging");
    const W = window.innerWidth, Hh = window.innerHeight; drag.f.style.left = Math.max(6, Math.min(W - 64, e.clientX - drag.dx)) + "px"; drag.f.style.top = Math.max(6, Math.min(Hh - 130, e.clientY - drag.dy)) + "px"; e.preventDefault(); e.stopPropagation(); }, { passive: false, capture: true });
  document.addEventListener("pointerup", () => { if (!drag) return; const f = drag.f; f.classList.remove("dragging");
    if (drag.moved) { LS.set("chatFab", { x: parseFloat(f.style.left) / window.innerWidth, y: parseFloat(f.style.top) / window.innerHeight }); f.dataset.justDragged = "1"; setTimeout(() => delete f.dataset.justDragged, 300); } drag = null; }, true);
  document.addEventListener("dragstart", (e) => { if (e.target.closest && e.target.closest("#chatFab")) e.preventDefault(); }, true);
  document.addEventListener("pointercancel", () => { if (drag) { drag.f.classList.remove("dragging"); drag = null; } }, true);
  document.addEventListener("touchmove", (e) => { if (drag && drag.moved) e.preventDefault(); }, { passive: false, capture: true });
  document.addEventListener("click", (e) => { const f = e.target.closest && e.target.closest("#chatFab"); if (f && f.dataset.justDragged) { e.preventDefault(); e.stopPropagation(); } }, true);
})();
try { document.head.insertAdjacentHTML("beforeend", `<style>
  .chat-fab { position: fixed; z-index: 60; width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; background: var(--brand); color: #fff; box-shadow: 0 8px 22px rgba(20,22,70,.35); touch-action: none; -webkit-user-select: none; user-select: none; -webkit-user-drag: none; transition: transform .15s, box-shadow .15s; }
  .chat-fab svg { width: 26px; height: 26px; } .chat-fab.dragging { transform: scale(1.1); box-shadow: 0 12px 30px rgba(20,22,70,.45); transition: none; }
  .chat-fab .badge, .chat-fab .tbadge, .chat-fab > span { position: absolute; top: -2px; right: -2px; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 99px; background: #e5484d; color: #fff; font-size: 11px; font-weight: 800; display: grid; place-items: center; border: 2px solid var(--surface, #fff); }
  .sun-link { display: block; padding: 0; overflow: hidden; } main.cols > .sun-link { grid-column: 1 / -1; }
  .sun-link summary { display: flex; align-items: center; gap: 12px; padding: 14px 16px; cursor: pointer; list-style: none; } .sun-link summary::-webkit-details-marker { display: none; }
  .sun-link summary b { flex: 1; font-size: 16px; } .sun-ic { font-size: 22px; line-height: 1; } .sun-tog { display: grid; transition: transform .2s; color: var(--muted); } .sun-link[open] .sun-tog { transform: rotate(90deg); }
  .sun-link > p, .sun-link > .btn { margin: 0 16px 12px; } .sun-link > .btn { width: calc(100% - 32px); }
</style>`); } catch (e) {}
// ---------- No paid AI (YB 2026-10-30): every helper below runs free, on the phone or from the church's own texts ----------
// RPP: a topic engine built on the rulings in the Juklak RPP HKBP; it quotes the matching Juklak lines live from Dokumen Gereja.
const RPP_TOPICS = [
  { id: "occult", kw: ["dukun", "jimat", "sesajen", "sesaji", "roh nenek", "nenek moyang", "berhala", "ilmu hitam", "guna-guna", "santet", "pelet", "ramal", "nujum", "keramat", "pusaka", "kebal", "begu", "datu", "parbegu", "sombaon", "mansaem", "marsanti", "mangalahat", "pohung", "parsili", "shaman", "occult", "amulet", "idol", "witch"],
    v: "ya", sec: /BINDU III/, bt: ["begu", "tondi", "aji", "pelean", "pohung", "parsili", "mansaem", "marsanti", "partahanan", "sombaon"], ref: "Bindu III · Patik 1 & 2",
    t: ["Juklak RPP (Bindu III, Hukum Pertama dan Kedua) menyebut praktik hasipelebeguon sebagai pelanggaran: persembahan kepada roh (butti), pusaka keramat (piso/hujur ni begu), jimat kebal (partahanan ni daging), mandabu aji, sesajen marsanti, mansaem, mangalahat horbo, pohung dan parsili.", "The Juklak RPP (Bindu III, First and Second Commandments) names occult and ancestor-worship practices as breaches: offerings to spirits (butti), sacred heirlooms (piso/hujur ni begu), invulnerability charms, poisoning by magic, marsanti offerings, mansaem, mangalahat horbo, pohung and parsili."],
    s: [["Kunjungi dan nasihati secara pastoral.", "Visit and counsel pastorally."], ["Bila tetap dilakukan, bawa ke rapat Parhalado untuk tahap RPP menurut buku RPP.", "If it continues, bring it to the Parhalado meeting for the RPP stages in the RPP book."], ["Dampingi dalam pertobatan; pulihkan setelah ada pengakuan.", "Walk with them in repentance; restore them after confession."]] },
  { id: "absence", kw: ["tidak ibadah", "tidak beribadah", "tidak ke gereja", "tidak pernah ibadah", "tidak pernah ke gereja", "tidak hadir", "jarang ibadah", "tidak datang", "absen", "menghilang", "marminggu", "not attend", "absent", "stopped coming"],
    v: "years", sec: /Patik Paopathon/, bt: ["marminggu", "taon", "sumurut"], ref: "Bindu III · 3. Patik Paopathon",
    t: ["Juklak RPP (Hukum Keempat): anggota atau parhalado yang tidak beribadah Minggu berturut-turut selama 2 (dua) tahun dianggap telah keluar dari keanggotaan atau jabatannya, dan diumumkan di warta setelah dipastikan dan dinasihati lebih dulu.", "Juklak RPP (Fourth Commandment): a member or office-bearer who has not attended Sunday worship for 2 (two) consecutive years is considered to have left membership or office, announced in the warta after it has been confirmed and they have been counselled."],
    s: [["Pastikan faktanya: sudah berapa lama tidak beribadah, dan apakah ada alasan (sakit, kerja di kapal, pindah).", "Confirm the facts: how long, and whether there is a reason (illness, work at sea, moving)."], ["Kunjungi dan nasihati lebih dulu.", "Visit and counsel first."], ["Bila genap 2 tahun, umumkan di warta sesuai Juklak.", "After 2 full years, announce it in the warta as the Juklak says."]] },
  { id: "insult", kw: ["menghina", "mencaci", "memaki", "memukul", "melawan sintua", "menyerang", "mempermalukan", "mengancam", "insult", "hit the", "attack"], need: ["sintua", "pendeta", "pelayan", "parhalado", "guru huria", "elder", "pastor", "majelis"],
    v: "ya", sec: /Patik Paopathon/, bt: ["mangaleai", "tohonan", "tangan"], ref: "Bindu III · 3. Patik Paopathon",
    t: ["Juklak RPP: anggota atau parhalado yang menghina pelayan tahbisan (dengan kata-kata, perbuatan, atau sampai memukul) karena pelayanan gereja dikenai RPP (dibalihon). Bila terjadi dalam urusan adat atau sehari-hari, cukup ditegur dengan kata-kata.", "Juklak RPP: a member or office-bearer who insults an ordained servant (by words, conduct, or by striking them) because of church service falls under RPP. If it happens in adat or daily matters, a spoken rebuke is enough."],
    s: [["Pastikan apakah kejadiannya terkait pelayanan gereja atau urusan adat/sehari-hari.", "Establish whether it was about church service or adat/daily matters."], ["Bila terkait pelayanan gereja: proses RPP lewat rapat Parhalado.", "If it was about church service: RPP through the Parhalado meeting."], ["Bila urusan lain: tegur dengan kata-kata dan damaikan.", "Otherwise: a spoken rebuke and reconciliation."]] },
  { id: "office", kw: ["mabuk", "berjudi", "judi", "mencuri", "korupsi", "menggelapkan"], need: ["sintua", "pendeta", "pelayan", "parhalado", "guru huria", "majelis", "elder"],
    v: "ya", sec: /Patik Paopathon/, bt: ["partohonan", "mabuk", "marjuji", "manangko"], ref: "Bindu III · 3. Patik Paopathon",
    t: ["Juklak RPP: pelayan tahbisan yang merusak jabatannya sendiri, misalnya mabuk, berjudi atau mencuri, dikenai paminsangon (disiplin).", "Juklak RPP: an ordained servant who disgraces their own office, for example by drunkenness, gambling or stealing, is disciplined (paminsangon)."],
    s: [["Pastikan faktanya secara tertutup.", "Confirm the facts privately."], ["Bawa ke rapat Parhalado untuk paminsangon menurut buku RPP.", "Bring it to the Parhalado meeting for discipline according to the RPP book."]] },
  { id: "adultery", kw: ["selingkuh", "zina", "berzina", "berzinah", "perselingkuhan", "hubungan gelap", "simpanan", "wanita lain", "pria lain", "affair", "cheating", "adultery", "marmainan"],
    v: "ya", sec: /Patik Papituhon/, bt: ["marmainan", "dongan saripe", "tingting", "pengadilan"], ref: "Bindu III · 6. Patik Papituhon",
    t: ["Juklak RPP (Hukum Ketujuh): laki-laki atau perempuan yang berzinah dengan orang yang bukan pasangannya dikenai RPP (dibalihon) melalui warta, setelah dipastikan oleh parhalado dan diakui. Bila tidak diakui di hadapan parhalado tetapi diputuskan benar oleh pengadilan, gereja menjalankan RPP.", "Juklak RPP (Seventh Commandment): a man or woman who commits adultery is put under RPP through the warta, after the Parhalado has confirmed it and it has been admitted. If not admitted but a court rules it true, the church applies RPP."],
    s: [["Parhalado memastikan kabar itu lebih dulu.", "The Parhalado first confirms the report."], ["Bila diakui (atau diputuskan pengadilan): RPP lewat warta.", "If admitted (or ruled by a court): RPP through the warta."], ["Dampingi keluarga dan buka jalan pemulihan.", "Care for the family and open the way to restoration."]] },
  { id: "marriage", kw: ["menikah", "nikah", "kawin", "pernikahan", "pemberkatan", "catatan sipil", "beda agama", "agama lain", "pindah agama", "kawin lari", "gereja lain", "pentakosta", "karismatik", "kharismatik", "sekte", "katolik", "muslim", "islam", "married", "wedding", "marriage", "parbagason", "marbagas"],
    v: "marriage", sec: /BINDU IV/, bt: ["parbagason", "Katolik", "sekte", "pentakostal", "kharismatik", "surat hatorangan"], ref: "Bindu IV · 1. Parbagason",
    t: ["Juklak RPP (Bindu IV, Parbagason): anggota yang pindah ke gereja/sekte yang tidak sepaham dengan HKBP tentang sakramen (misalnya pentakostal dan karismatik) dikenai RPP, dan gereja tidak memberi surat keterangan ke gereja seperti itu. Pernikahan di Gereja Katolik berbeda: karena Joint Declaration 1999, HKBP memberi surat keterangan, dan anggota yang menikah di Gereja Katolik dianggap telah masuk Gereja Katolik tanpa warta RPP. Hal lain tentang pernikahan (termasuk beda agama) disebut ‘Nunga tangkas’, artinya diatur di buku RPP.", "Juklak RPP (Bindu IV, Marriage): members who join a church or sect that does not share HKBP's teaching on the sacraments (e.g. Pentecostal and charismatic) fall under RPP, and the church gives no letter to such churches. Marriage in the Catholic Church is different: because of the 1999 Joint Declaration, HKBP gives a letter, and the member is considered to have joined the Catholic Church, without an RPP announcement. Other marriage matters (including interfaith) are ‘Nunga tangkas’: governed by the RPP book."],
    s: [["Tanyakan di gereja mana dan bagaimana pemberkatannya.", "Ask in which church and how the marriage was blessed."], ["Katolik: beri surat keterangan, tanpa warta RPP.", "Catholic: give a letter, no RPP announcement."], ["Sekte pentakostal/karismatik: RPP sesuai Juklak.", "Pentecostal/charismatic sect: RPP as the Juklak says."], ["Kasus lain: lihat buku RPP dan bahas di rapat Parhalado.", "Other cases: see the RPP book and discuss in the Parhalado meeting."]] },
  { id: "divorce", kw: ["cerai", "bercerai", "perceraian", "menggugat cerai", "gugatan cerai", "pisah ranjang", "divorce", "sirang"],
    v: "ya", sec: /BINDU IV/, bt: ["sirang", "parsirangon", "manuntut"], ref: "Bindu IV · 1.i Parbagason",
    t: ["Juklak RPP: bila suami-istri bercerai di pengadilan, hanya pihak yang menuntut perceraian yang dikenai RPP; keanggotaan atau jabatan pasangan yang tidak setuju tetap. Perceraian dianggap sah bagi gereja bila salah satu terbukti berzinah (diakui atau diputuskan pengadilan). Bila mereka mau berdamai dan saling mengampuni, mereka tidak harus bercerai, tetapi RPP tetap dijalankan.", "Juklak RPP: when a couple divorces in court, only the one who sued is put under RPP; the other spouse keeps their membership or office. The church accepts a divorce when one has been proven to commit adultery. If they reconcile and forgive, they need not divorce, but RPP still applies."],
    s: [["Pastikan siapa yang menggugat cerai.", "Establish who filed for divorce."], ["RPP hanya untuk pihak penggugat.", "RPP applies only to the one who filed."], ["Utamakan pendamaian dan pengampunan.", "Put reconciliation and forgiveness first."]] },
  { id: "funeral", kw: ["juhut tata", "jambar juhut", "purpur sapata", "sira", "garam", "saur matua", "kematian", "pemakaman", "adat kematian", "funeral"],
    v: "ya", sec: /BINDU IV|^HKBP\.?$/, bt: ["juhut tata", "purpur sapata", "Sira tu batang"], ref: "Bindu IV · 4. Di tingki na matean",
    t: ["Juklak RPP (Bindu IV, saat kematian) melarang tiga hal: membagi jambar juhut tata, juhut purpur sapata, dan menabur garam (sira) pada peti jenazah, karena berasal dari kepercayaan lama.", "Juklak RPP (Bindu IV, at a death) forbids three things: sharing jambar juhut tata, juhut purpur sapata, and putting salt (sira) on the coffin, because they come from the old beliefs."],
    s: [["Ingatkan keluarga sebelum acara adat.", "Remind the family before the adat ceremony."], ["Bila tetap dilakukan: nasihati, lalu bawa ke rapat Parhalado.", "If it still happens: counsel, then bring it to the Parhalado meeting."]] },
  { id: "ongkal", kw: ["ongkal holi", "mangongkal", "tulang belulang", "gondang", "tortor", "manortor"],
    v: "tergantung", sec: /Mangongkal Holi|Gondang/, bt: ["Mangongkal", "Gondang"], ref: "Bindu IV · 5–6",
    t: ["Juklak RPP mencatat Mangongkal Holi dan Gondang sebagai ‘Nunga tangkas’: aturannya ada di buku RPP HKBP. Penilaian tergantung bentuk acaranya (unsur pemujaan roh atau tidak).", "The Juklak RPP marks Mangongkal Holi and Gondang as ‘Nunga tangkas’: the rules are in the RPP book. It depends on the form of the ceremony (whether it involves spirit worship)."],
    s: [["Periksa susunan acaranya.", "Check the order of the ceremony."], ["Rujuk buku RPP dan bahas di rapat Parhalado.", "Consult the RPP book and discuss in the Parhalado meeting."]] },
  { id: "vice", kw: ["judi", "berjudi", "togel", "kasino", "membunuh", "pembunuhan", "mabuk", "narkoba", "ganja", "sabu", "drugs", "gambling", "drunk", "murder"],
    v: "ya", sec: /BINDU V\b|Juji|Pamunu|Parmabuk/, bt: ["Juji", "Pamunu", "Parmabuk", "Parganja"], ref: "Bindu V",
    t: ["Juklak RPP (Bindu V) menggolongkan judi (juji), pembunuhan (pamunu), mabuk dan narkoba (parmabuk, parganja) sebagai perbuatan yang harus dijauhi; penanganannya mengikuti buku RPP (‘Nunga tangkas’).", "The Juklak RPP (Bindu V) lists gambling (juji), murder (pamunu), drunkenness and drugs (parmabuk, parganja) as conduct to be avoided; they are handled by the RPP book (‘Nunga tangkas’)."],
    s: [["Kunjungi dan nasihati; tawarkan pendampingan (konseling, rehabilitasi).", "Visit and counsel; offer support (counselling, rehabilitation)."], ["Bila berlanjut: tahap RPP menurut buku RPP.", "If it continues: the RPP stages in the RPP book."]] },
  { id: "baptism", kw: ["baptis", "pembaptisan", "tardidi", "pandidion", "anak dari", "wali", "sisolhot"], need: ["rpp", "dikenai", "sedang", "bali", "wali", "tidak ada orang tua", "yatim"],
    v: "tergantung", sec: /BINDU IV/, bt: ["pandidion", "sisolhot", "bali"], ref: "Bindu IV · 1.o",
    t: ["Juklak RPP: anak dari orang tua yang sedang dikenai RPP boleh dibaptis bila dibawa oleh ayah atau ibu yang tidak dikenai RPP. Anak yatim piatu boleh dibawa oleh kerabatnya. Bila kedua orang tua masih hidup, kerabat tidak boleh membawanya; bila keduanya dikenai RPP, anak itu kelak dibaptis dewasa atas kehendaknya sendiri.", "Juklak RPP: a child of parents under RPP may be baptised if brought by the parent who is not under RPP. Orphans may be brought by relatives. If both parents are alive, relatives may not bring the child; if both are under RPP, the child is baptised later as an adult."],
    s: [["Periksa status RPP kedua orang tua.", "Check both parents' RPP status."], ["Ikuti ketentuan o.1–o.3 Juklak.", "Follow points o.1–o.3 of the Juklak."]] },
];
async function freeRpp(q) {
  const qn = " " + norm(q) + " "; const has = (k) => qn.includes(norm(k));
  const scored = RPP_TOPICS.map((tp) => ({ tp, n: tp.kw.filter(has).length * 2 + (tp.need ? (tp.need.some(has) ? 1 : -9) : 0) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  const tx = (a) => (lang === "en" ? a[1] : a[0]);
  if (!scored.length) return { verdict: "tergantung", headline: L3("Juklak RPP tidak menyebut kasus ini secara jelas.", "Ndang tangkas di Juklak RPP.", "The Juklak RPP does not clearly cover this case."), explanation: [L3("Tidak ada aturan di Juklak yang cocok dengan kata-kata dalam pertanyaan. Coba sebutkan perbuatannya dengan jelas (misalnya: tidak ibadah 2 tahun, menikah di gereja lain, berzinah, dukun, judi), atau bawa ke rapat Parhalado dan rujuk buku RPP HKBP.", "Bawa tu rapat Parhalado.", "No Juklak ruling matches the words in the question. Try naming the act plainly (e.g. not attending for 2 years, marrying in another church, adultery, shamans, gambling), or take it to the Parhalado meeting and consult the RPP book.")], rules: [], steps: [], note: "" };
  const top = scored[0].tp; let v = top.v;
  if (v === "years") { const m = norm(q).match(/(\d+|satu|dua|tiga|empat|lima|setahun)\s*(tahun|thn|taon|year)/); const n = m ? ({ satu: 1, setahun: 1, dua: 2, tiga: 3, empat: 4, lima: 5 }[m[1]] || +m[1]) : 0; v = n >= 2 ? "ya" : "tergantung"; }
  if (v === "marriage") v = has("katolik") || has("catholic") ? "tidak" : (["pentakosta", "karismatik", "kharismatik", "sekte"].some(has) ? "ya" : "tergantung");
  const rules = [];
  try { const doc = await docLoad("juklak-rpp", false);
    for (const x of scored.slice(0, 2)) { const tp = x.tp; const secs = (doc.sections || []).filter((s) => tp.sec.test(s.title));
      const qw = norm(q).split(" ").filter((w) => w.length >= 5);
      const score = (l) => tp.bt.filter((b) => norm(l).includes(norm(b))).length * 100 + qw.filter((w) => norm(l).includes(w)).length * 150 + Math.min(l.length, 99);
      const lines = secs.flatMap((s) => s.lines.filter((l) => l && l.length > 25 && tp.bt.some((b) => norm(l).includes(norm(b))))).sort((a, b) => score(b) - score(a));
      lines.slice(0, 2).forEach((l) => { const w = l.split(/\s+/); rules.push({ ref: tp.ref, quote: w.slice(0, 32).join(" ") + (w.length > 32 ? " …" : ""), meaning: "" }); });
      if (!lines.length) rules.push({ ref: tp.ref, quote: "Nunga tangkas", meaning: L3("Juklak menyatakan aturan ini sudah jelas di buku RPP HKBP.", "", "The Juklak says this is already set out in the RPP book.") }); } } catch (e) {}
  const second = scored[1] && scored[1].n >= scored[0].n - 1 ? scored[1].tp : null;
  return { verdict: v, headline: v === "ya" ? L3("Menurut Juklak RPP, ini termasuk pelanggaran.", "Pangalaosion RPP do on.", "By the Juklak RPP, this is a breach.") : v === "tidak" ? L3("Menurut Juklak RPP, ini tidak dikenai RPP.", "Ndada pangalaosion RPP.", "By the Juklak RPP, this is not put under RPP.") : L3("Tergantung faktanya; lihat ketentuan di bawah.", "Tergantung.", "It depends on the facts; see the rules below."),
    explanation: [tx(top.t), ...(second ? [tx(second.t)] : [])], rules, steps: top.s.map(tx),
    note: L3("Jawaban dari pencarian aturan di teks Juklak RPP (tanpa AI, gratis). Keputusan tetap pada rapat Parhalado.", "Sian Juklak RPP. Keputusan di rapat Parhalado.", "Answered by matching the rules in the Juklak RPP text (no AI, free). The Parhalado meeting decides.") };
}
// Fair roster, by rule: everyone gets a turn, fewest recent duties first, nobody twice on one Sunday, nobody who is away.
function localRoster(i) {
  const load = { ...(i.load || {}) }; const rows = []; let prev = new Set();
  const h = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  for (const day of i.sundays) {
    const away = new Set((i.busy || {})[day] || []); const used = new Set(); const assign = {};
    for (const j of i.jobs) { const kept = ((i.keep || {})[day] || {})[j]; if (kept) { assign[j] = kept; used.add(kept); load[kept] = (load[kept] || 0) + 1; } }
    for (const j of i.jobs) {
      if (assign[j]) continue;
      const pick = i.people.filter((p) => !away.has(p) && !used.has(p)).sort((a, b) => (load[a] || 0) - (load[b] || 0) || (prev.has(a) ? 1 : 0) - (prev.has(b) ? 1 : 0) || h(a + day + j) - h(b + day + j))[0];
      if (pick) { assign[j] = pick; used.add(pick); load[pick] = (load[pick] || 0) + 1; } else assign[j] = "";
    }
    rows.push({ day, assign }); prev = used;
  }
  return { rows, note: L3("Disusun merata: yang paling jarang bertugas dalam 3 bulan terakhir didahulukan, tidak ada yang dua kali di Minggu yang sama, dan yang sedang berlayar atau berduka tidak dijadwalkan.", "Dibagi rata.", "Spread evenly: those who served least in the last 3 months go first, nobody twice on one Sunday, and those at sea or grieving are left out.") };
}
// Discussion material from Sunday's Tata Ibadah: theme, readings and questions from templates.
function localQuestions(i) {
  const tx = i.text || ""; const grab = (re) => { const m = tx.match(re); return m ? m[1].replace(/\s+/g, " ").trim().slice(0, 90) : ""; };
  const theme = grab(/(?:Tema|Topik|Thema|Topic)\s*:?\s*[“"]?([^"\n”]{4,})/i); const ep = grab(/Epistel\s*:?\s*([1-3]?\s?[A-Za-z][A-Za-z ]+\d+\s*:\s*[\d\-–, ]+)/i); const kh = grab(/(?:Khotbah|Kotbah|Jamita|Evangelium)\s*:?\s*([1-3]?\s?[A-Za-z][A-Za-z ]+\d+\s*:\s*[\d\-–, ]+)/i);
  const kids = /children/.test(i.hint || ""); const bt = i.lang === "bt", en = i.lang === "en";
  const T = (a, b, c) => (bt ? b : en ? c : a);
  const qs = kids ? [T("Siapa saja yang ada dalam cerita Alkitab hari ini?", "Ise do angka na adong di turiturian sian Bibel sadarion?", "Who is in today's Bible story?"), T("Apa yang Tuhan Yesus lakukan atau katakan?", "Aha do na binahen manang na nidok ni Tuhan Jesus?", "What did Jesus do or say?"), T("Bagian mana yang paling kamu sukai? Mengapa?", "Dia na umpos di rohami? Boasa?", "Which part do you like best? Why?"), T("Bagaimana kamu bisa menolong teman minggu ini?", "Songon dia ho boi mangurupi dongan minggu on?", "How can you help a friend this week?"), T("Apa yang ingin kamu ucapkan kepada Tuhan dalam doa?", "Aha na naeng dohononmu tu Tuhan di tangiang?", "What would you like to tell God in prayer?")]
    : [T(`Apa pesan utama ${kh || ep || "nas Minggu ini"} bagi Anda?`, `Aha do sipaingot na ummarga sian ${kh || ep || "turpuk Minggu on"} di ho?`, `What is the main message of ${kh || ep || "this Sunday's text"} for you?`),
       theme ? T(`Tema minggu ini “${theme}”. Di mana tema ini paling terasa dalam hidup Anda saat ini?`, `Topik “${theme}”. Di dia do na tarida i di ngolum saonari?`, `This week's theme is “${theme}”. Where do you feel it most in your life now?`) : T("Ayat mana yang paling menyentuh Anda? Mengapa?", "Ayat dia do na umpos di rohamu? Boasa?", "Which verse touches you most? Why?"),
       ep ? T(`Bagaimana ${ep} menolong kita memahami nas khotbah?`, `Songon dia ${ep} mangurupi hita mangantusi jamita?`, `How does ${ep} help us understand the sermon text?`) : T("Apa yang dikatakan nas ini tentang Allah?", "Aha do na nidok ni turpuk on taringot tu Debata?", "What does this passage say about God?"),
       T("Apa yang sulit untuk dilakukan dari firman ini, dan mengapa?", "Aha na maol siulahonon sian hata on, jala boasa?", "What is hard to live out from this word, and why?"),
       T("Bagaimana firman ini berbicara kepada kita sebagai perantau di Singapura?", "Songon dia hata on tu hita parserak di Singapura?", "How does this word speak to us living away from home in Singapore?"),
       T("Satu langkah nyata apa yang akan Anda lakukan minggu ini?", "Aha langka na tongon siulahononmu minggu on?", "What one concrete step will you take this week?")];
  return { title: theme || T("Bahan diskusi Minggu ini", "Bahan diskusi Minggu on", "This Sunday's discussion"), verse: [kh, ep].filter(Boolean).join(" · "),
    opening: T("Bacalah nas bersama-sama dengan perlahan, lalu diam sejenak sebelum berbagi.", "Jaha ma rap turpuk i, dungi paima jolo saotik.", "Read the passage together slowly, then pause a moment before sharing."),
    questions: qs, action: T("Pilih satu orang yang akan Anda doakan dan sapa minggu ini.", "Pillit ma sahalak na tangianghononmu jala na sapaonmu minggu on.", "Choose one person to pray for and reach out to this week."),
    prayer: T("Tuhan, terima kasih untuk firman-Mu. Tolonglah kami melakukannya minggu ini. Amin.", "Ale Tuhan, mauliate di hata-Mu. Urupi ma hami mangulahon i minggu on. Amen.", "Lord, thank you for your word. Help us to live it this week. Amen.") };
}
// Offering receipts, read on the phone (Tesseract, free): SGD amounts matched to the church's offering names.
let TESS = null;
async function ocrReceipt(dataUrl, names) {
  if (!window.Tesseract) await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js"; s.onload = res; s.onerror = () => rej(new Error(L3("Pembaca struk tidak bisa dimuat. Periksa koneksi internet.", "", "The receipt reader could not load. Check the internet connection."))); document.head.appendChild(s); });
  const { data } = await window.Tesseract.recognize(dataUrl, "eng"); const lines = String(data.text || "").split("\n").map((l) => l.trim()).filter(Boolean);
  const amt = (l) => { const m = l.replace(/,(?=\d{3}\b)/g, "").match(/(?:S\$|SGD|\$)?\s*(\d{1,6}(?:\.\d{2}))\b(?!.*\d\.\d{2})/); return m ? +m[1] : null; };
  const syn = [[/kolekte|umum|ibadah|offering|general/i, names[0]], [/\bSM\b|sekolah\s*minggu|sunday\s*school/i, "Sekolah Minggu"]];
  const key = (v) => norm(v).replace(/\s+/g, ""); const items = []; let total = null;
  for (const l of lines) { const a = amt(l); if (a == null || a <= 0) continue; if (/total|jumlah|grand/i.test(l)) { total = a; continue; }
    if (/(IDR|RP\.?|MYR|RM|USD|US\$)/i.test(l)) continue;
    const label = l.replace(/(?:S\$|SGD|\$)?\s*\d[\d,.]*\s*$/, "").trim(); let name = names.find((n) => key(label) && (key(label).includes(key(n)) || key(n).includes(key(label))));
    if (!name) { const s2 = syn.find(([re]) => re.test(label)); if (s2 && names.includes(s2[1])) name = s2[1]; }
    if (name || label.length > 2) items.push({ name: name || label.slice(0, 40), sgd: a }); }
  if (!items.length && total) items.push({ name: names[0], sgd: total });
  return { items, total_sgd: total };
}
// Read aloud (free, the phone's own voice): Indonesian voice for Indonesian and Batak, English for English.
function speakText(text) {
  const ss = window.speechSynthesis; if (!ss) { toast(L3("HP ini tidak mendukung bacakan.", "", "This phone cannot read aloud."), true); return; }
  if (ss.speaking) { ss.cancel(); return; }
  const parts = String(text).replace(/\s+/g, " ").match(/[^.!?;:]+[.!?;:]*/g) || [text]; const chunks = []; let cur = "";
  parts.forEach((p) => { if ((cur + p).length > 220 && cur) { chunks.push(cur); cur = ""; } cur += p; }); if (cur) chunks.push(cur);
  const vl = lang === "en" ? "en" : "id"; const voice = ss.getVoices().find((v) => v.lang && v.lang.toLowerCase().startsWith(vl));
  chunks.forEach((c) => { const u = new SpeechSynthesisUtterance(c.trim()); u.lang = vl === "en" ? "en-US" : "id-ID"; if (voice) u.voice = voice; u.rate = 0.92; ss.speak(u); });
}
A.speak = (d) => { const el = document.querySelector(d.sel); if (el) speakText(el.innerText); };
const speakBtn = (sel, label) => `<button class="btn" data-act="speak" data-sel="${esc(sel)}">🔊 ${esc(label || L3("Bacakan", "Jahahon", "Read aloud"))}</button>`;
// Text size for the whole app, saved on this phone.
const TXZ = [1, 1.12, 1.25, 1.4]; const applyTz = () => { try { document.documentElement.style.setProperty("--tz", String(LS.get("tz", 1))); } catch (e) {} }; applyTz();
A.textSize = () => sheet("🔠 " + L3("Ukuran teks", "Balga ni surat", "Text size"), `<p class="small muted">${esc(L3("Berlaku untuk seluruh Sada di HP ini.", "Tu sude Sada di HP on.", "Applies to all of Sada on this phone."))}</p>
  <div class="tz-row">${TXZ.map((z, i) => `<button class="btn${+LS.get("tz", 1) === z ? " primary" : ""}" data-act="tzSet" data-z="${z}" style="font-size:${14 + i * 3}px">A</button>`).join("")}</div>`);
A.tzSet = (d) => { LS.set("tz", +d.z); applyTz(); closeSheet(); render(); };
// Usage review: page views per day on this phone, sent once a day; the admin sees the totals (Lainnya → Pemakaian fitur).
function usageTick(r) {
  if (!D || isGuest() || (VIEWAS && VIEWAS.on) || !r) return; const d0 = today(); const u = LS.get("usage", {}) || {};
  u[d0] = u[d0] || {}; u[d0][r] = (u[d0][r] || 0) + 1; Object.keys(u).forEach((k) => { if (k < addDays(d0, -10)) delete u[k]; }); LS.set("usage", u);
  if (LS.get("usageSent", "") !== d0) { LS.set("usageSent", d0); api.save("usage_log", { days: u }).catch(() => {}); }
  prepOffline();
}
const ROUTE_NAMES = { home: "Beranda", groups: "Kategorial", g: "Halaman kategori", calendar: "Warnasari", serve: "Roster", meet: "Rapat", lit: "Liturgi", litwb: "Workbench liturgi", chat: "Chat", library: "Alkitab & nyanyian", song: "Lagu", doc: "Dokumen Gereja", more: "Lainnya", bread: "Renungan harian", tata: "Tata Ibadah", live: "Ikuti live", sunday: "Minggu Ini", rpp: "RPP", tarombo: "Tarombo", tutur: "Partuturan", ende: "Arti Buku Ende", care: "Kunjungan", prayer: "Pokok doa", fx: "Kurs", search: "Cari", o: "Seksi", sswb: "Workbench SM", stories: "Turi-turian", grief: "Dukacita", sea: "Pelaut", access: "Akses", appstatus: "Status aplikasi", usage: "Pemakaian fitur" };
R.usage = () => {
  if (!D.me.is_admin) { location.replace("#/more"); return ""; }
  const days = +(new URLSearchParams(location.hash.split("?")[1] || "").get("d") || 90);
  setTimeout(async () => { const box = document.getElementById("usageBox"); if (!box) return;
    try { const r = await api.save("usage_report", { days }); const max = Math.max(1, ...r.routes.map((x) => x.views));
      box.innerHTML = `<div class="row two"><div class="card center"><b class="big-n">${r.active}</b><small>${esc(L3("anggota aktif", "ruas aktif", "active members"))} / ${r.members}</small></div><div class="card center"><b class="big-n">${r.routes.length}</b><small>${esc(L3("fitur dipakai", "fitur", "features used"))}</small></div></div>
        <div class="card">${r.routes.map((x) => `<div class="use-r"><span>${esc(ROUTE_NAMES[x.route] || x.route)}</span><i style="width:${Math.round((x.views / max) * 100)}%"></i><small>${x.views} · ${x.people} ${esc(L3("org", "halak", "people"))}</small></div>`).join("") || empty(L3("Belum ada data.", "Ndang adong data.", "No data yet."), "chart")}</div>
        <p class="small muted">${esc(L3("Fitur yang jarang dipakai bisa disederhanakan atau dihapus dari tampilan sederhana.", "", "Rarely used features can be simplified or dropped from the simple views."))}</p>`; } catch (e) { box.innerHTML = `<p class="warn">${esc(errMsg(e))}</p>`; } }, 0);
  return shell("#/more", `<h2 class="page-h">📊 ${esc(L3("Pemakaian fitur", "Pamakean fitur", "Feature usage"))}</h2>
    <div class="seg" role="tablist" style="--gc:var(--brand)">${[30, 90, 365].map((n) => `<a role="tab" aria-selected="${days === n}" href="#/usage?d=${n}">${n} ${esc(L3("hari", "ari", "days"))}</a>`).join("")}</div><div id="usageBox">${skel(4)}</div>`, { back: "#/more", title: L3("Pemakaian fitur", "Pamakean fitur", "Feature usage") });
};
// Offline-first for the Parhalado: from Friday, this week's liturgy, readings, songs and Tata Ibadah are saved on the phone.
let PREP_DONE = false;
function prepOffline() {
  if (PREP_DONE || !isLit() || !navigator.onLine) return; const wd = new Date().getDay(); if (![5, 6, 0].includes(wd)) return;
  const sun = nextSunday(); if (LS.get("prepFor", "") === sun) { PREP_DONE = true; return; } PREP_DONE = true;
  setTimeout(async () => { try { await songsLoad(true); const l = await litList(true); const x = l.find((y) => y.day >= today());
    if (x) { const full = await litGet(x.id); for (const it of full.items || []) if (it.t === "reading" && it.ref) { try { await litPassage(it.ref, it.ver); } catch (e) {} } }
    const sv = upcomingService(); if (sv) { try { await tataHtml(sv.id); } catch (e) {} } LS.set("prepFor", sun); } catch (e) {} }, 5000);
}
// "Minggu Ini": everything for this Sunday in one place, for everyone.
const SONG_REF = /\b(KJ|BE|BN|B\.\s?E\.?|PKJ|NKB)\.?\s*(?:No\.?\s*)?(\d{1,3})\s*:\s*([\d\s,\-–+]+(?:dst)?)/gi;
R.sunday = () => {
  const sv = upcomingService();
  setTimeout(async () => { const box = document.getElementById("sunBox"); if (!box) return;
    if (!sv) { box.innerHTML = empty(L3("Tata Ibadah Minggu ini belum terbit.", "Tata Ibadah dang tarbit dope.", "This Sunday's Tata Ibadah is not published yet."), "book"); return; }
    let text = ""; try { const doc = new DOMParser().parseFromString(await tataHtml(sv.id), "text/html"); text = [...doc.querySelectorAll("section.pg")].map((x) => x.textContent).join("\n") || doc.body.textContent; } catch (e) {}
    await songsLoad(false);
    const songs = []; const seen = new Set(); let m; SONG_REF.lastIndex = 0;
    while ((m = SONG_REF.exec(text))) { const book = m[1].toUpperCase().replace(/[\s.]/g, "") === "BE" ? "BE" : m[1].toUpperCase().replace(/[\s.]/g, ""); const k = book + ":" + m[2]; if (seen.has(k)) continue; seen.add(k);
      const vs = []; m[3].replace(/dst/g, "").split(/[,+]/).forEach((p) => { const r = p.split(/[-–]/).map((x) => parseInt(x, 10)).filter((x) => x > 0); if (r.length === 2 && r[1] >= r[0] && r[1] - r[0] < 20) for (let q = r[0]; q <= r[1]; q++) vs.push(q); else if (r.length === 1) vs.push(r[0]); });
      songs.push({ book, num: +m[2], verses: vs }); }
    const refs = []; const rre = /(Epistel|Ev(?:angelium)?|Khotbah|Kotbah|Jamita)\s*:?\s*([1-3]?\s?[A-Z][A-Za-z]+(?:\s[A-Z][a-z]+)?\s+\d+\s*:\s*\d+(?:\s*[-–]\s*\d+)?)/g; let r2;
    while ((r2 = rre.exec(text))) if (!refs.some((x) => x.ref === r2[2])) refs.push({ kind: /Epistel/i.test(r2[1]) ? "Epistel" : L3("Nas Khotbah", "Turpuk Jamita", "Sermon text"), ref: r2[2].replace(/\s+/g, " ") });
    box.innerHTML = `${songs.length ? `<h3 class="sec-h">🎵 ${esc(L3("Nyanyian", "Ende", "Songs"))}</h3>${songs.map((s, i) => { const g = litSong(s); return `<details class="card sun-song"><summary><b>${esc(s.book)} ${s.num}${s.verses.length ? ": " + s.verses.join(", ") : ""}</b>${g.title ? ` <small>${esc(g.title)}</small>` : ""}</summary>
        <div id="sunSong${i}">${g.verses.length ? g.verses.map((v) => `<div class="lit-v"><b>${esc(v.n)}</b><div>${v.lines.map((l) => `<p>${esc(l)}</p>`).join("")}</div></div>`).join("") : `<p class="muted small">${esc(L3("Lirik belum ada di Sada.", "Lirik ndang adong dope.", "Lyrics not in Sada yet."))}</p>`}</div>${g.verses.length ? speakBtn("#sunSong" + i) : ""}</details>`; }).join("")}` : ""}
      ${refs.length ? `<h3 class="sec-h">📖 ${esc(L3("Nas Alkitab", "Turpuk Bibel", "Bible readings"))}</h3>${refs.map((x, i) => `<article class="card"><h4>${esc(x.kind)} · ${esc(x.ref)}</h4><div class="lit-bible" id="sunRd${i}">${skel(2)}</div>${speakBtn("#sunRd" + i)}</article>`).join("")}` : ""}`;
    refs.forEach(async (x, i) => { const el = document.getElementById("sunRd" + i); try { const vs = await litPassage(x.ref, lang === "bt" ? "toba" : "tb"); el.innerHTML = vs.map((v) => `<p><sup>${v.v}</sup>${esc(v.t)}</p>`).join(""); } catch (e) { el.innerHTML = `<p class="muted small">${esc(L3("Nas tidak dapat dimuat. Periksa koneksi internet.", "Ndang boi.", "Couldn't load the passage. Check the internet connection."))}</p>`; } }); }, 0);
  return shell("#/home", `<div class="s-week"><p class="s-kick">${esc(L3("Minggu Ini", "Minggu On", "This Sunday"))} · ${esc(fmt(sv ? sv.service_date : nextSunday(), { weekday: "long", day: "numeric", month: "long" }))}</p><div class="s-duty"><b>${esc(sv ? sv.title || "" : "")}</b></div></div>
    <div class="row two">${sv ? `<a class="btn primary" href="#/tata/${sv.id}">📖 Tata Ibadah</a>` : ""}<a class="btn" href="#/live">🔴 ${esc(L3("Ikuti live", "Ihuthon live", "Follow live"))}</a></div>
    <div id="sunBox">${skel(4)}</div>`, { back: "#/home", title: L3("Minggu Ini", "Minggu On", "This Sunday") });
};
// Pastoral visit notes (Parhalado): one line after each visit; the history shows under each name.
A.visitAdd = (d) => sheet("📝 " + L3("Catat kunjungan", "Catat kunjungan", "Record a visit"), `<form class="form" data-form="visitSave" data-id="${esc(d.id)}"><p><b>${esc((D.people.find((p) => p.id === d.id) || {}).name || "")}</b></p>
  <label>${esc(L3("Tanggal", "Tanggal", "Date"))}<input type="date" name="day" value="${today()}"></label><label>${esc(L3("Catatan singkat", "Catatan", "Short note"))}<textarea name="note" rows="3" required placeholder="${esc(L3("mis. Sehat, kerja shift malam, minta didoakan.", "", "e.g. Well, on night shifts, asked for prayer."))}"></textarea></label>
  <button class="btn primary block">${esc(t("save"))}</button></form>`);
F.visitSave = async (f) => { await api.save("visit_save", { member_id: f.dataset.id, day: f.day.value, note: f.note.value }); closeSheet(); toast(t("saved")); render(); throw Object.assign(new Error("noRender"), { silent: true }); };
async function visitsPaint() { try { const vs = await api.save("visit_list", {}); document.querySelectorAll("[data-mid]").forEach((li) => { const mine = vs.filter((v) => v.member_id === li.dataset.mid).slice(0, 3); const box = li.querySelector(".visit-h"); if (box) box.innerHTML = mine.map((v) => `<small>📝 ${esc(fmt(v.day, { day: "numeric", month: "short" }))} · ${esc(v.note)} <i>– ${esc(v.by || "")}</i></small>`).join(""); }); } catch (e) {} }
// Buku Ende meanings without AI: each verse opens in Google Translate (it knows Batak Toba).
try { window.__sadaFree = { freeRpp, localRoster, localQuestions }; } catch (e) {}
const gtr = (text, to) => `https://translate.google.com/?sl=bbc&tl=${to}&text=${encodeURIComponent(text)}&op=translate`;
try { document.head.insertAdjacentHTML("beforeend", `<style>
  #view main, #view > .page, #view .wrap { zoom: var(--tz, 1); } .tz-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .use-r { display: grid; grid-template-columns: 9em 1fr auto; gap: 8px; align-items: center; padding: 6px 0; border-top: 1px solid var(--line); font-size: 14px; } .use-r i { display: block; height: 10px; border-radius: 99px; background: var(--brand); min-width: 4px; } .big-n { font-size: 30px; display: block; }
  .sun-song summary { cursor: pointer; } .sun-song summary small { color: var(--muted); } .visit-h { display: grid; gap: 2px; margin-top: 4px; } .visit-h small { color: var(--muted); }
  .ende-v { margin: 0 0 12px; } .ende-v p { margin: 0; } .ende-v .row { margin-top: 6px; }
</style>`); } catch (e) {}
try { document.head.insertAdjacentHTML("beforeend", `<style>
  .month-h { position: sticky; top: calc(64px + env(safe-area-inset-top)); z-index: 3; margin: 22px 0 10px; } .month-h span { display: inline-block; background: var(--brand); color: #fff; font-size: 17px; font-weight: 800; letter-spacing: .02em; padding: 8px 16px; border-radius: 999px; box-shadow: 0 6px 16px rgba(0,0,0,.12); }
  .cal-part { border-left: 5px solid var(--pc, var(--brand)); } .cal-part .card-h h3 { color: var(--pc, var(--ink)); font-size: 16px; } .cal-part .card-h .badge { background: var(--pc, var(--brand)); color: #fff; }
  .cal-part.du { --pc: #1f8a4c; } .cal-part.mt { --pc: #6d3fc0; } .cal-part.ev { --pc: #1f5fa8; } .cal-part.bd { --pc: #c94f8a; } .cal-part.an { --pc: #b7791f; }
  .chips:has(> .chip.on), .chips.office-tabs, .chips.bib-vers, .chips.fx-chips { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 4px; gap: 4px; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
  .chips:has(> .chip.on) > .chip, .chips.office-tabs > .chip, .chips.bib-vers > .chip, .chips.fx-chips > .chip { border: 0; background: transparent; border-radius: 10px; padding: 8px 12px; font-size: 14px; font-weight: 700; color: var(--muted); white-space: nowrap; flex: 1 0 auto; text-align: center; }
  .chips:has(> .chip.on) > .chip.on, .chips.office-tabs > .chip.on, .chips.bib-vers > .chip.on, .chips.fx-chips > .chip.on { background: var(--gc, var(--brand)); color: #fff; }
  .seg { scrollbar-width: none; } .seg::-webkit-scrollbar, .chips::-webkit-scrollbar { display: none; } .seg a { min-width: max-content; }
  .s-hello h1 { font-size: 30px; margin: 10px 0 2px; } .s-hello p { font-size: 17px; color: var(--muted); margin: 0 0 12px; }
  .s-week { background: linear-gradient(135deg, var(--brand), #1b1f5c); color: #fff; border-radius: 22px; padding: 18px; margin: 6px 0 16px; box-shadow: var(--shadow); }
  .s-kick { font-size: 14px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; opacity: .85; margin: 0 0 8px; } .s-duty { font-size: 19px; margin: 6px 0; } .s-duty span { display: block; font-size: 15px; opacity: .85; } .s-none { font-size: 17px; margin: 0; opacity: .9; }
  .s-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; } .s-grid.pastor { grid-template-columns: 1fr; }
  .s-tile { display: grid; gap: 4px; align-content: start; background: var(--surface); border-radius: 20px; padding: 18px 16px; text-decoration: none; color: var(--ink); box-shadow: var(--shadow); min-height: 120px; border: 1px solid var(--line); }
  .s-tile .s-ic { font-size: 34px; line-height: 1; } .s-tile b { font-size: 19px; line-height: 1.2; } .s-tile small { font-size: 14px; color: var(--muted); }
  .s-grid.pastor .s-tile { grid-template-columns: auto 1fr; align-items: center; min-height: 0; column-gap: 16px; } .s-grid.pastor .s-tile .s-ic { grid-row: span 2; font-size: 40px; } .s-grid.pastor .s-tile.big b { font-size: 22px; }
  .s-switch { margin-top: 18px; }
  .rpp-ans { border-left: 5px solid #8a8f99; } .rpp-ans.yes { border-left-color: #c2410c; } .rpp-ans.no { border-left-color: #1f8a4c; } .rpp-ans.maybe { border-left-color: #b7791f; }
  .rpp-v { font-size: 19px; margin-bottom: 8px; } .rpp-h { font-weight: 700; } .rpp-ans h4 { margin: 14px 0 6px; } .rpp-rule { background: var(--surface-2); border-radius: 12px; padding: 10px 12px; margin: 6px 0; } .rpp-rule blockquote { margin: 6px 0; font-style: italic; color: var(--brand); }
  .badge.warn { background: #fde7d9; color: #9a3412; }
  .taro-box { margin-top: 10px; padding: 10px 12px; border-radius: 12px; background: var(--surface-2); } .taro-path { font-size: 12.5px; color: var(--muted); margin: 4px 0 0; } .taro-path b { color: var(--ink); }
  .tutur-ref summary { cursor: pointer; } .tref-r { display: grid; grid-template-columns: 9.5em 1fr; gap: 8px; padding: 8px 0; border-top: 1px solid var(--line); font-size: 14px; } .tref-r b { color: var(--brand); }
</style>`); } catch (e) {}
// ---------- Simple views for the elders and the pastor (YB 2026-10-30) ----------
// Elders who are not makers (Parhalado members) and the pastor see a large, calm home with only what they use, and fewer tabs.
// The full app is one tap away ("Tampilan lengkap"), and back again. Elders who are makers keep the normal view.
const isPastor = () => !!D && !isGuest() && /^Pdt\b\.?/i.test(D.me.name || "");
const isPlainElder = () => !!D && !isGuest() && ((D.me.groups || {}).parhalado === "member") && !D.me.is_admin;
const simpleKind = () => (VIEWAS && VIEWAS.on ? (isPastor() ? "pastor" : isPlainElder() ? "elder" : "") : LS.get("fullView", false) ? "" : isPastor() ? "pastor" : isPlainElder() ? "elder" : "");
function navTabs() {
  const k = simpleKind(); const TABS = TABS_ALL.filter(([, h]) => h !== "#/chat");   // Chat is the floating bubble (YB 2026-10-30)
  if (k === "pastor") return TABS.filter(([, h]) => ["#/home", "#/calendar", "#/library", "#/more"].includes(h));
  if (k === "elder") return TABS.filter(([, h]) => ["#/home", "#/calendar", "#/library", "#/more"].includes(h));
  return TABS;
}
function upcomingService() { const td = today(); return (D.services || []).filter((s) => s.service_date >= td).sort((a, b) => a.service_date.localeCompare(b.service_date))[0] || null; }
function simpleHome() {
  const k = simpleKind(); const first = (D.me.name || "").replace(/^(Pdt|St|Cst)\.?\s+/i, "").split(" ")[0];
  const sun = nextSunday(); const sv = upcomingService(); const mine = duties().filter((d) => d.date >= today()).sort((a, b) => a.date.localeCompare(b.date));
  const soon = mine.filter((d) => d.date <= addDays(today(), 7));
  setTimeout(async () => { const el = document.getElementById("simpleLit"); if (!el) return; const l = await litList(false); const x = l.find((y) => y.day >= today());
    if (x) { el.href = "#/lit/" + x.id; el.querySelector("small").textContent = `${fmt(x.day, { day: "numeric", month: "long" })} · ${x.name}`; } }, 0);
  const tile = (href, icon, title, sub, big) => `<a class="s-tile${big ? " big" : ""}" href="${href}"${href.startsWith("#/lit") ? ' id="simpleLit"' : ""}><span class="s-ic">${icon}</span><b>${esc(title)}</b>${sub != null ? `<small>${esc(sub)}</small>` : ""}</a>`;
  const week = `<div class="s-week"><p class="s-kick">${esc(L3("Minggu ini", "Minggu on", "This Sunday"))} · ${esc(fmt(sun, { weekday: "long", day: "numeric", month: "long" }))}</p>
    ${soon.length ? soon.map((d) => `<div class="s-duty">🙌 <b>${esc(d.roles.join(", "))}</b> <span>${esc(gname(d.group))} · ${esc(fmt(d.date, { weekday: "short", day: "numeric", month: "short" }))}</span></div>`).join("") : `<p class="s-none">${esc(L3("Tidak ada tugas pelayanan minggu ini.", "Ndang adong ulaon minggu on.", "No duties this week."))}</p>`}</div>`;
  const tiles = k === "pastor"
    ? [tile("#/lit", "📜", L3("Naskah Liturgi", "Naskah Paragenda", "Liturgy script"), L3("Word & slide", "Word & slide", "Word & slides"), true),
       tile(sv ? `#/tata/${sv.id}` : "#/calendar", "📖", "Tata Ibadah", sv ? fmt(sv.service_date, { day: "numeric", month: "long" }) : "", true),
       tile("#/calendar", "📅", L3("Jadwal Pelayanan", "Jadwal", "Service roster"), "", true),
       tile("#/rpp", "⚖️", "RPP", L3("Daftar & tanya Juklak", "Daftar & sungkun", "List & ask the Juklak")), tile("#/care", "🫶", L3("Kunjungan", "Kunjungan", "Visits"), "")]
    : [tile("#/calendar", "📅", L3("Jadwal Pelayanan", "Jadwal", "My duties"), mine.length ? `${mine.length} ${L3("tugas", "ulaon", "duties")}` : ""),
       tile("#/lit", "📜", L3("Naskah Liturgi", "Naskah Paragenda", "Liturgy script"), ""),
       tile("#/sunday", "📖", L3("Minggu Ini", "Minggu On", "This Sunday"), sv ? fmt(sv.service_date, { day: "numeric", month: "long" }) : ""),
       tile("#/library?s=BE", "🎵", L3("Buku Ende & KJ", "Buku Ende & KJ", "Hymn books"), ""),
       tile("#/prayer", "🙏", L3("Pokok Doa", "Tangiang", "Prayer requests"), ""), tile("#/care", "🫶", L3("Kunjungan", "Kunjungan", "Visits"), ""),
       tile("#/rpp", "⚖️", "RPP", ""), tile("#/chat/all", "💬", L3("Chat Jemaat", "Chat Ruas", "Church chat"), "")];
  return shell("#/home", `<div class="s-hello"><h1>Horas, ${esc(first)}!</h1><p>${esc(k === "pastor" ? L3("Selamat melayani, Inang Pendeta.", "Selamat marhobas, Inang Pandita.", "Blessings on your service, Pastor.") : L3("Selamat melayani, Amang/Inang Sintua.", "Selamat marhobas, Amang/Inang Sintua.", "Blessings on your service."))}</p></div>
    ${week}<div class="s-grid${k === "pastor" ? " pastor" : ""}">${tiles.join("")}</div>
    <button class="btn ghost block s-switch" data-act="viewFull">${esc(L3("Buka tampilan lengkap Sada", "Bukka tampilan lengkap", "Open the full Sada view"))}</button>`, {});
}
A.viewFull = () => { LS.set("fullView", true); location.hash = "#/home"; render(); toast(L3("Tampilan lengkap aktif. Untuk kembali ke tampilan sederhana, buka Lainnya.", "Tampilan lengkap. Asa mulak tu na sederhana, bukka Lainnya.", "Full view. Switch back from More.")); };
A.viewSimple = () => { LS.set("fullView", false); location.hash = "#/home"; render(); };

// ---------- RPP (YB 2026-10-30): the list, and questions answered from the Juklak RPP · Parhalado only ----------
const RPP = { list: null, tab: "list", q: "", busy: false };
R.rpp = () => {
  if (!isParhalado()) { location.replace("#/more"); return ""; }
  const qs = new URLSearchParams(location.hash.split("?")[1] || ""); RPP.tab = qs.get("t") || RPP.tab;
  const seg = (k, label) => `<a role="tab" aria-selected="${RPP.tab === k}" href="#/rpp?t=${k}">${label}</a>`;
  const head = `<h2 class="page-h">⚖️ RPP</h2><p class="lead">${esc(L3("Ruhut Parmahanion dohot Paminsangon · hanya untuk Parhalado.", "Ruhut Parmahanion dohot Paminsangon · holan tu Parhalado.", "Pastoral care and church discipline · Parhalado only."))}</p>
    <div class="seg" role="tablist" style="--gc:var(--brand)">${seg("list", "📋 " + esc(L3("Daftar", "Daftar", "List")))}${seg("ask", "💬 " + esc(L3("Tanya RPP", "Sungkun RPP", "Ask the RPP")))}</div>`;
  if (RPP.tab === "ask") {
    const hist = LS.get("rppHist", []) || [];
    return shell("#/more", `${head}
      <form class="form" data-form="rppAsk"><label>${esc(L3("Ceritakan kasusnya selengkap mungkin (tanpa batas panjang). Sebutkan fakta, bukan nama.", "Paboa ma kasusna.", "Describe the case as fully as you can (no length limit). Give facts, not names."))}
        <textarea name="q" rows="7" placeholder="${esc(L3("Contoh: Seorang anggota sidi menikah di catatan sipil tanpa pemberkatan gereja…", "Songon: …", "Example: A confirmed member married at the civil registry without a church blessing…"))}">${esc(RPP.q)}</textarea></label>
        <button class="btn primary block">⚖️ ${esc(L3("Periksa menurut Juklak RPP", "Ida sian Juklak RPP", "Check against the Juklak RPP"))}</button></form>
      <div id="rppAns">${RPP.last ? rppAnswer(RPP.last) : ""}</div>
      ${hist.length ? `<h3 class="sec-h">${esc(L3("Pertanyaan sebelumnya (di HP ini)", "Na salpu", "Earlier questions (on this phone)"))}</h3><div class="card">${hist.map((h, i) => `<button class="li" data-act="rppHist" data-i="${i}"><span class="grow"><b>${esc(h.q.slice(0, 80))}${h.q.length > 80 ? "…" : ""}</b><small>${esc(rppVerdict(h.a.verdict)[1])} · ${esc(fmt(h.at, { day: "numeric", month: "short" }))}</small></span>${ic("chev", "chev")}</button>`).join("")}</div>` : ""}
      <p class="small muted">${esc(L3("Jawaban dicari dari aturan di teks Juklak RPP HKBP (Dokumen Gereja), tanpa AI dan gratis. Ini bahan pertimbangan; keputusan tetap pada rapat Parhalado.", "Sian Juklak RPP HKBP. Keputusan di rapat Parhalado.", "Answers are matched from the rulings in the Juklak RPP HKBP text (Church Documents), free and without AI. They are guidance; the Parhalado meeting decides."))}</p>`, { back: "#/more", title: "RPP" });
  }
  setTimeout(async () => { const box = document.getElementById("rppList"); if (!box) return; try { RPP.list = await api.save("rpp_list", {}); } catch (e) { RPP.list = RPP.list || []; } rppPaint(); }, 0);
  return shell("#/more", `${head}
    <div class="row" style="gap:8px;margin:8px 0"><input type="search" id="rppFind" placeholder="${esc(L3("Cari nama…", "Lului goar…", "Search a name…"))}" autocomplete="off" style="flex:1"><button class="btn primary" data-act="rppEdit">${ic("plus")}</button></div>
    <div id="rppList">${skel(3)}</div>`, { back: "#/more", title: "RPP" });
};
function rppPaint() {
  const box = document.getElementById("rppList"); if (!box) return; const q = norm((document.getElementById("rppFind") || {}).value || "");
  const l = (RPP.list || []).filter((x) => !q || norm(x.name + " " + (x.reason || "") + " " + (x.stage || "")).includes(q));
  box.innerHTML = l.length ? `<div class="card">${l.map((x) => `<button class="li rpp-row" data-act="rppEdit" data-id="${x.id}"><span class="grow"><b>${esc(x.name)}</b><small>${esc([x.stage, x.reason].filter(Boolean).join(" · "))}${x.since ? " · " + esc(L3("sejak", "sian", "since")) + " " + esc(fmt(x.since, { day: "numeric", month: "short", year: "numeric" })) : ""}</small></span><span class="badge${x.status === "aktif" ? " warn" : ""}">${esc(x.status === "aktif" ? L3("Aktif", "Aktif", "Active") : L3("Selesai", "Nunga sae", "Ended"))}</span></button>`).join("")}</div>`
    : empty(q ? L3("Tidak ditemukan.", "Ndang dapot.", "Nothing found.") : L3("Belum ada nama dalam daftar RPP.", "Ndang adong goar.", "No names on the RPP list."), "lock");
}
document.addEventListener("input", (e) => { if (e.target && e.target.id === "rppFind") rppPaint(); });
A.rppEdit = (d) => {
  const x = d.id ? (RPP.list || []).find((y) => y.id === d.id) : {};
  sheet("⚖️ " + (d.id ? L3("Ubah", "Ubah", "Edit") : L3("Tambah nama", "Tambah goar", "Add a name")), `<form class="form" data-form="rppSave" data-id="${esc(d.id || "")}">
    <label>${esc(L3("Nama", "Goar", "Name"))}<input name="name" list="rppPeople" required value="${esc(x.name || "")}"></label><datalist id="rppPeople">${(D.people || []).map((p) => `<option value="${esc(p.name)}">`).join("")}</datalist>
    <label>${esc(L3("Tahap / sanksi", "Tingkatan", "Stage / sanction"))}<input name="stage" value="${esc(x.stage || "")}" placeholder="${esc(L3("mis. tahap pertama (menurut Juklak)", "", "e.g. first stage (per the Juklak)"))}"></label>
    <label>${esc(L3("Perkara", "Perkara", "Matter"))}<textarea name="reason" rows="3">${esc(x.reason || "")}</textarea></label>
    <div class="row two"><label>${esc(L3("Sejak", "Sian", "Since"))}<input type="date" name="since" value="${esc(x.since || "")}"></label><label>${esc(L3("Sampai", "Sahat tu", "Until"))}<input type="date" name="until" value="${esc(x.until || "")}"></label></div>
    <label>${esc(L3("Status", "Status", "Status"))}<select name="status"><option value="aktif"${x.status !== "selesai" ? " selected" : ""}>${esc(L3("Aktif", "Aktif", "Active"))}</option><option value="selesai"${x.status === "selesai" ? " selected" : ""}>${esc(L3("Selesai / dipulihkan", "Nunga sae", "Ended / restored"))}</option></select></label>
    <label>${esc(L3("Catatan pastoral", "Catatan", "Pastoral notes"))}<textarea name="notes" rows="3">${esc(x.notes || "")}</textarea></label>
    <button class="btn primary block">${esc(t("save"))}</button>${d.id ? `<button type="button" class="btn danger block" data-act="rppDel" data-id="${esc(d.id)}">${ic("trash")} ${esc(t("delete"))}</button>` : ""}</form>`);
};
F.rppSave = async (f) => { const p = (D.people || []).find((y) => y.name === f.name.value.trim());
  await api.save("rpp_save", { id: f.dataset.id || null, name: f.name.value.trim(), member_id: p ? p.id : null, stage: f.stage.value, reason: f.reason.value, since: f.since.value, until: f.until.value, status: f.status.value, notes: f.notes.value });
  closeSheet(); RPP.list = await api.save("rpp_list", {}); rppPaint(); toast(t("saved")); throw Object.assign(new Error("noRender"), { silent: true }); };
A.rppDel = async (d) => { await api.save("rpp_delete", { id: d.id }); closeSheet(); RPP.list = await api.save("rpp_list", {}); rppPaint(); };
const rppVerdict = (v) => (v === "info" ? ["ℹ️", L3("Informasi aturan", "Informasi", "About the rules"), "maybe"] : v === "ya" ? ["⚠️", L3("Ya, ini pelanggaran RPP", "Olo, on do pangalaosion RPP", "Yes, this breaches the RPP"), "yes"] : v === "tidak" ? ["✅", L3("Tidak, ini bukan pelanggaran RPP", "Ndang, ndada pangalaosion RPP", "No, this is not a breach of the RPP"), "no"] : ["❔", L3("Tergantung · perlu pertimbangan", "Tergantung", "It depends"), "maybe"]);
function rppAnswer(a) {
  const [ic2, label, cls] = rppVerdict(a.verdict);
  return `<article class="card rpp-ans ${cls}"><div class="rpp-v">${ic2} <b>${esc(label)}</b></div>${a.headline ? `<p class="rpp-h">${esc(a.headline)}</p>` : ""}
    ${(a.explanation || []).map((p) => `<p>${esc(p)}</p>`).join("")}
    ${(a.rules || []).length ? `<h4>📖 ${esc(L3("Dasar dari Juklak RPP", "Dasar sian Juklak", "Basis in the Juklak RPP"))}</h4>${a.rules.map((r) => `<div class="rpp-rule"><b>${esc(r.ref || "")}</b>${r.quote ? `<blockquote>“${esc(r.quote)}”</blockquote>` : ""}${r.meaning ? `<p>${esc(r.meaning)}</p>` : ""}</div>`).join("")}` : ""}
    ${(a.steps || []).length ? `<h4>🧭 ${esc(L3("Langkah Parhalado", "Langka ni Parhalado", "Steps for the Parhalado"))}</h4><ol>${a.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>` : ""}
    ${a.note ? `<p class="small muted">ℹ️ ${esc(a.note)}</p>` : ""}</article>`;
}
F.rppAsk = async (f) => {
  const q = f.q.value.trim(); if (q.length < 10) throw new Error(L3("Tuliskan kasusnya lebih lengkap.", "Paboa ma kasusna lengkap.", "Please describe the case more fully."));
  RPP.q = q; const box = document.getElementById("rppAns"); box.innerHTML = `<div class="card center pad">⏳ ${esc(L3("Mencari di Juklak RPP…", "Manglului di Juklak RPP…", "Searching the Juklak RPP…"))}</div>`;
  try { const a = await freeRpp(q); RPP.last = a; box.innerHTML = rppAnswer(a);
    const h = (LS.get("rppHist", []) || []).slice(0, 9); h.unshift({ q, a, at: new Date().toISOString() }); LS.set("rppHist", h); }
  catch (e) { box.innerHTML = `<p class="warn">${esc(errMsg(e))}</p>`; }
  throw Object.assign(new Error("noRender"), { silent: true });
};
A.rppHist = (d) => { const h = (LS.get("rppHist", []) || [])[+d.i]; if (!h) return; RPP.q = h.q; RPP.last = h.a; render(); };

// ---------- Tarombo: the family tree of the Batak margas, expandable (YB 2026-10-30) ----------
// Tarombo from the church's "Silsilah dan Tarombo Batak dari Si Raja Batak" (after W. Hutagalung and M.A. Marbun & I.M.T. Hutapea).
// [name, note, children]; a plain string is a marga.
const TAROMBO = ["Si Raja Batak", "Leluhur orang Batak, di Pusuk Buhit", [
  ["Guru Tatea Bulan", "Golongan Bulan · hula-hula · marga Lontung", [
    ["Raja Uti", "Si Raja Biak-biak / Raja Sigumeleng-geleng · tanpa keturunan", []],
    ["Tuan Sariburaja", "keturunannya: Pasaribu", [
      ["Si Raja Lontung", "Lontung Si Sia Marina · 7 putra, 2 putri (boru Sihombing & Simamora)", [
        ["Tuan Situmorang", "", ["Situmorang", "Lumban Pande", "Lumban Nahor", "Suhutnihuta", "Siringoringo", "Sitohang", "Rumapea", "Padang", "Solin"]],
        ["Sinaga Raja", "", ["Sinaga", "Simanjorang", "Simandalahi", "Barutu"]],
        ["Pandiangan", "", ["Pandiangan", "Samosir", "Pakpahan", "Gultom", "Sidari", "Sitinjak", "Harianja"]],
        ["Toga Nainggolan", "", ["Nainggolan", "Rumahombar", "Parhusip", "Lumban Tungkup", "Lumban Siantar", "Hutabalian", "Lumban Raja", "Pusuk", "Buaton", "Nahulae"]],
        ["Simatupang", "", ["Simatupang", "Togatorop", "Sianturi", "Siburian"]],
        ["Aritonang", "", ["Aritonang", "Ompu Sunggu", "Rajagukguk", "Simaremare"]],
        ["Siregar", "", ["Siregar", "Silo", "Dongaran", "Silali", "Siagian", "Ritonga", "Sormin"]]]],
      ["Si Raja Borbor", "dari Nai Margiring Laut · marga Borbor", [
        ["Datu Taladibabana", "generasi keenam, 6 putra", [
          ["Datu Dalu (Sahangmaima)", "", ["Pasaribu", "Batubara", "Habeahan", "Bondar", "Gorat", "Tinendang", "Tangkar", "Matondang", "Saruksuk", "Tarihoran", "Parapat", "Rangkuti"]],
          ["Sipahutar", "", ["Sipahutar"]], ["Harahap", "", ["Harahap"]], ["Tanjung", "", ["Tanjung"]],
          ["Datu Pulungan", "", ["Pulungan", "Lubis", "Hutasuhut"]], ["Simargolang", "", ["Imargolang"]]]]]],
      ["Si Raja Babiat", "di Mandailing", ["Bayoangin"]]]],
    ["Limbong Mulana", "", [["Limbong", "putra: Palu Onggang, Langgat Limbong", ["Limbong", "Sihole", "Habeahan"]]]],
    ["Sagala Raja", "", ["Sagala"]],
    ["Silau Raja", "", ["Malau", "Manik", ["Ambarita", "Lumban Pea · Lumban Pining", []], "Gurning"]]]],
  ["Raja Isombaon", "Golongan Matahari · boru · marga Sumba", [
    ["Tuan Sorimangaraja", "tinggal di Pusuk Buhit · 3 istri", [
      ["Nai Ambaton", "Tuan Sorba Djulu / Ompu Raja Nabolon · Parna · Ruhut Bongbong: keturunannya tidak saling menikah", [
        ["Simbolon Tua", "", ["Simbolon", "Tinambunan", "Tumanggor", "Maharaja", "Turutan", "Nahampun", "Pinayungan", "Berampu", "Pasi"]],
        ["Tamba Tua", "", ["Tamba", "Siallagan", "Tomok", "Sidabutar", "Sijabat", "Gusar", "Siadari", "Sidabolak", "Rumahorbo", "Napitu"]],
        ["Saragi Tua", "", ["Saragi", "Simalango", "Saing", "Simarmata", "Nadeak", "Sidabungke"]],
        ["Munte Tua", "", ["Munte", "Dalimunte", "Sitanggang", "Manihuruk", "Sidauruk", "Turnip", "Sitio", "Sigalingging"]]]],
      ["Nai Rasaon", "Tuan Sorba Jae / Raja Mangarerak", [
        ["Raja Mardopang", "", ["Sitorus", "Pane", "Sirait", "Butar-butar"]],
        ["Raja Mangatur", "Toga Manurung", ["Manurung"]]]],
      ["Nai Suanon", "Tuan Sorbadibanua · 8 putra · lebih dari 100 marga", [
        ["Si Bagot Ni Pohan", "", ["Pohan", "Tampubolon", "Barimbing", "Silaen", "Siahaan", "Simanjuntak", "Hutagaol", "Nasution", "Panjaitan", "Siagian", "Silitonga", "Sianipar", "Pardosi", "Simangunsong", "Marpaung", "Napitupulu", "Pardede"]],
        ["Si Paet Tua", "", ["Hutahaean", "Hutajulu", "Aruan", "Sibarani", "Sibuea", "Sarumpaet", "Pangaribuan", "Hutapea"]],
        ["Si Lahi Sabungan", "marga Silalahi", ["Silalahi", "Sihaloho", "Situngkir", "Sipangkar", "Sipayung", "Sirumasondi", "Rumasingap", "Depari", "Sidabutar", "Sidabariba", "Solia", "Sidebang", "Boliala", "Pintubatu", "Sigiro", "Tambunan", "Doloksaribu", "Sinurat", "Naiborhu", "Nadapdap", "Pagaraji", "Sunge", "Baruara", "Lumban Pea", "Lumban Gaol"]],
        ["Si Raja Oloan", "", ["Naibaho", "Ujung", "Bintang", "Manik", "Angkat", "Hutadiri", "Sinamo", "Capa", "Sihotang", "Hasugian", "Mataniari", "Lingga", "Bangkara", "Sinambela", "Dairi", "Sihite", "Sileang", "Simanullang"]],
        ["Si Raja Huta Lima", "", ["Maha", "Sambo", "Pardosi", "Sembiring Meliala"]],
        ["Si Raja Sumba", "dari Boru Sibasopaet", ["Simamora", "Rambe", "Purba", "Manalu", "Debataraja", "Girsang", "Tambak", "Siboro", "Sihombing", "Silaban", "Lumban Toruan", "Nababan", "Hutasoit", "Sitindaon", "Binjori"]],
        ["Si Raja Sobu", "dari Boru Sibasopaet", ["Sitompul", "Hasibuan", "Hutabarat", "Panggabean", "Hutagalung", "Hutatoruan", "Simorangkir", "Hutapea", "Lumban Tobing", "Mismis"]],
        ["Toga Naipospos", "dari Boru Sibasopaet", ["Marbun", "Lumban Batu", "Banjarnahor", "Lumban Gaol", "Meha", "Mungkur", "Saraan", "Sibagariang", "Hutauruk", "Simanungkalit", "Situmeang"]]]]]]]],
  ["Ompu Bada", "Sienemkodin · di tanah Dairi, bukan keturunan Si Raja Batak (menurut keturunannya)", ["Tendang", "Bunurea", "Manik", "Beringin", "Gajah", "Barasa"]]]];
// Dongan sapadan: margas bound by a pact (padan) treat each other as dongan sabutuha and do not intermarry.
const PADAN = [["Marbun", "Sihotang"], ["Panjaitan", "Simanullang"], ["Tampubolon", "Sitompul"], ["Sitorus", "Hutajulu"], ["Sitorus", "Hutahaean"], ["Sitorus", "Aruan"], ["Nahampun", "Situmorang"],
  ["Banjarnahor", "Manalu"], ["Lumban Batu", "Purba"], ["Lumban Gaol", "Debataraja"]];
const mnorm = (s) => norm(String(s || "").replace(/^(br\.?|boru)\s+/i, "")).replace(/[^a-z0-9]/g, "");
const TARO_INDEX = (() => { const idx = {}; const walk = (n, path) => { if (typeof n === "string") { (idx[mnorm(n)] = idx[mnorm(n)] || []).push(path); return; } const p = [...path, n[0]]; n[2].forEach((c) => walk(c, p)); }; walk(TAROMBO, []); return idx; })();
function taroFind(m) { const k = mnorm(m); if (!k) return null; if (TARO_INDEX[k]) return TARO_INDEX[k][0]; const hit = Object.keys(TARO_INDEX).find((x) => x === k.replace(/^lumban/, "") || "lumban" + x === k || x.endsWith(k) && k.length >= 4); return hit ? TARO_INDEX[hit][0] : null; }
function taroRel(a, b) {
  const pa = taroFind(a), pb = taroFind(b); if (!pa || !pb) return null;
  if (mnorm(a) === mnorm(b)) return { kind: "same", text: L3("Satu marga: dongan tubu (semarga). Saling menganggap saudara kandung dan tidak boleh saling menikah.", "Sada marga: dongan tubu. Ndang boi marsiolian.", "The same marga: dongan tubu. Treated as siblings; they do not marry each other."), pa, pb };
  const pad = PADAN.find(([x, y]) => [mnorm(x), mnorm(y)].includes(mnorm(a)) && [mnorm(x), mnorm(y)].includes(mnorm(b)));
  if (pad) return { kind: "padan", text: L3(`Marpadan (dongan sapadan): ${pad[0]} dan ${pad[1]} terikat janji leluhur, saling menganggap dongan sabutuha dan tidak saling menikah.`, `Marpadan: ${pad[0]} dohot ${pad[1]}.`, `Marpadan: ${pad[0]} and ${pad[1]} are bound by an ancestral pact; they count as dongan sabutuha and do not intermarry.`), pa, pb };
  let i = 0; while (i < pa.length && i < pb.length && pa[i] === pb[i]) i++; const lca = pa[i - 1];
  if (/Nai Ambaton/.test(lca)) return { kind: "parna", text: L3(`Sama-sama keturunan ${lca} (Parna). Menurut Ruhut Bongbong, sesama keturunan Nai Ambaton tidak saling menikah dan saling menganggap dongan tubu.`, `Pomparan ni ${lca}.`, `Both descend from ${lca} (Parna). By the Ruhut Bongbong they do not intermarry and count as dongan tubu.`), pa, pb, lca };
  if (i >= 4) return { kind: "close", text: L3(`Satu rumpun: sama-sama keturunan ${lca}. Biasanya disebut marhaha-maranggi (bersaudara). Untuk perkawinan, tanyakan tetua marga masing-masing.`, `Sada rumpun: pomparan ni ${lca}.`, `One family line: both descend from ${lca}, usually counted as marhaha-maranggi (brothers). Ask the marga elders about marriage.`), pa, pb, lca };
  return { kind: "far", text: L3(`Berbeda rumpun (leluhur bersama: ${lca}). Panggilan ditentukan oleh hubungan lewat ibu dan pernikahan (Dalihan Na Tolu).`, `Asing rumpun (${lca}).`, `Different family lines (common ancestor: ${lca}). How you address each other follows the mother's side and marriages (Dalihan Na Tolu).`), pa, pb, lca };
}
const taroPath = (p, m) => `<p class="taro-path">${p.map((x) => `<span>${esc(x)}</span>`).join(" › ")} › <b>${esc(m)}</b></p>`;
R.tarombo = () => {
  const countM = (n) => (typeof n === "string" ? 1 : n[2].reduce((s2, c) => s2 + countM(c), 0));
  // A family tree: a card per person, connector lines down to the children, tap to open or close. Margas under one parent sit together at the end of that branch.
  const node = (n, depth, line) => {
    const kids = n[2]; const margas = kids.filter((k) => typeof k === "string"), subs = kids.filter((k) => typeof k !== "string");
    const cls = `tt-n d${Math.min(depth, 4)}${line != null ? ` l${line % 3}` : ""}`;
    const head = `<span class="tt-t"><b>${esc(n[0])}</b>${n[1] ? `<small>${esc(n[1])}</small>` : ""}</span>`;
    if (!kids.length) return `<div class="${cls}" data-name="${esc(n[0])}"><div class="tt-card">${head}</div></div>`;
    const items = subs.map((c, i) => `<li>${node(c, depth + 1, depth === 0 ? i : line)}</li>`);
    if (margas.length) items.push(`<li><div class="tt-margas"><span class="tt-margas-h">${esc(L3("Marga", "Marga", "Margas"))} · ${margas.length}</span>${margas.map((m) => `<span class="tt-leaf taro-leaf" data-n="${esc(mnorm(m))}">${esc(m)}</span>`).join("")}</div></li>`);
    return `<details class="${cls}" data-name="${esc(n[0])}" data-def="${depth < 2 ? 1 : 0}"${depth < 2 ? " open" : ""}><summary class="tt-card">${head}<span class="tt-count">${countM(n)}</span><span class="tt-tog" aria-hidden="true"></span></summary>
      <ul class="tt-kids">${items.join("")}</ul></details>`; };
  return shell("#/more", `<h2 class="page-h">🌳 Tarombo</h2><p class="lead">${esc(L3("Silsilah marga Batak dari Si Raja Batak. Ketuk untuk membuka dan menutup cabang.", "Tarombo sian Si Raja Batak. Ketuk asa terbuka manang tertutup.", "The Batak margas from Si Raja Batak. Tap to open and close each branch."))}</p>
    <div class="taro-search">${ic("search")}<input type="search" id="taroFind" placeholder="${esc(L3("Cari marga…", "Lului marga…", "Find a marga…"))}" autocomplete="off" autocapitalize="off" spellcheck="false"><button type="button" class="taro-x" data-act="taroClear" aria-label="${esc(L3("Hapus", "Apus", "Clear"))}" hidden>✕</button></div>
    <div class="taro-tools"><button class="btn sm" data-act="taroAll" data-o="1">⊕ ${esc(L3("Buka semua", "Bukka sude", "Open all"))}</button><button class="btn sm" data-act="taroAll" data-o="0">⊖ ${esc(L3("Tutup semua", "Tutup sude", "Close all"))}</button></div>
    <div id="taroHit"></div>
    <div class="taro-tree tt">${node(TAROMBO, 0, null)}</div>
    <h3 class="sec-h">🤝 ${esc(L3("Dongan sapadan (marga yang terikat janji)", "Dongan sapadan", "Dongan sapadan (margas bound by a pact)"))}</h3>
    <div class="card"><p class="small">${esc(L3("“Togu urat ni bulu, toguan urat ni padang; togu nidok ni uhum, toguan nidok ni padan.” Marga yang marpadan saling menganggap dongan sabutuha dan tidak saling menikah:", "Togu urat ni bulu, toguan urat ni padang; togu nidok ni uhum, toguan nidok ni padan.", "“Strong are the roots of bamboo, stronger the roots of grass; strong is the word of law, stronger the word of a pact.” Margas bound by a pact count as dongan sabutuha and do not intermarry:"))}</p>
      <div class="chips">${PADAN.map(([a2, b2]) => `<span class="chip">${esc(a2)} ⇄ ${esc(b2)}</span>`).join("")}</div></div>
    <p class="small muted">${esc(L3("Sumber: “Silsilah dan Tarombo Batak dari Si Raja Batak” (menurut W. Hutagalung; M.A. Marbun & I.M.T. Hutapea). Tarombo dapat berbeda menurut keluarga; tanyakan tetua marga Anda.", "Sian buku tarombo.", "Source: “Silsilah dan Tarombo Batak dari Si Raja Batak” (after W. Hutagalung; M.A. Marbun & I.M.T. Hutapea). Family records may differ; ask your marga elders."))}</p>`,
    { back: "#/more", title: "Tarombo" });
};
const TARO_ALL = (() => { const s2 = new Set(); const w = (n) => (typeof n === "string" ? s2.add(n) : n[2].forEach(w)); w(TAROMBO); return [...s2].sort((a, b) => a.localeCompare(b)); })();
function taroReset() {
  document.querySelectorAll(".taro-leaf.hit").forEach((x) => x.classList.remove("hit"));
  document.querySelectorAll(".tt-n.on-path").forEach((x) => x.classList.remove("on-path"));
  document.querySelectorAll("details.tt-n").forEach((x) => (x.open = x.dataset.def === "1"));
  const hit = document.getElementById("taroHit"); if (hit) hit.innerHTML = "";
}
function taroShow(m) {
  taroReset(); const k = mnorm(m); const p = taroFind(m); if (!p) return false;
  const chips = [...document.querySelectorAll(".taro-tree .taro-leaf")];
  const chip = chips.find((c) => c.dataset.n === k) || chips.find((c) => c.dataset.n.endsWith(k) || k.endsWith(c.dataset.n));
  if (chip) { chip.classList.add("hit"); let el = chip.parentElement; while (el) { if (el.classList && el.classList.contains("tt-n")) { if (el.tagName === "DETAILS") el.open = true; el.classList.add("on-path"); } el = el.parentElement; } setTimeout(() => chip.scrollIntoView({ block: "center", behavior: "smooth" }), 80); }
  const name = chip ? chip.textContent : m; const hit = document.getElementById("taroHit");
  if (hit) hit.innerHTML = `<div class="taro-res"><div class="taro-res-h"><b>${esc(name)}</b><small>${esc(L3("Garis keturunan", "Tarombo", "Line of descent"))}</small></div><ol class="taro-steps">${p.map((x) => `<li>${esc(x)}</li>`).join("")}<li class="me">${esc(name)}</li></ol></div>`;
  return true;
}
document.addEventListener("input", (e) => { if (!e.target || e.target.id !== "taroFind") return; const v = e.target.value; const x = document.querySelector(".taro-x"); if (x) x.hidden = !v;
  const k = mnorm(v); if (!k) { taroReset(); return; }
  const exact = TARO_ALL.find((m) => mnorm(m) === k); if (exact) { taroShow(exact); return; }
  taroReset(); if (k.length < 2) return;
  const sug = TARO_ALL.filter((m) => mnorm(m).includes(k)).slice(0, 10); const hit = document.getElementById("taroHit");
  if (hit) hit.innerHTML = sug.length ? `<div class="taro-sug">${sug.map((m) => `<button class="taro-chip pick" data-act="taroPick" data-m="${esc(m)}">${esc(m)}</button>`).join("")}</div>` : `<p class="small muted taro-none">${esc(L3("Marga tidak ditemukan di tarombo ini.", "Marga ndang dapot.", "Marga not found in this tarombo."))}</p>`; });
A.taroPick = (d) => { const i = document.getElementById("taroFind"); if (i) { i.value = d.m; const x = document.querySelector(".taro-x"); if (x) x.hidden = false; i.blur(); } taroShow(d.m); };
A.taroClear = () => { const i = document.getElementById("taroFind"); if (i) i.value = ""; const x = document.querySelector(".taro-x"); if (x) x.hidden = true; taroReset(); window.scrollTo({ top: 0, behavior: "smooth" }); if (i) i.focus(); };
A.taroAll = (d) => document.querySelectorAll("details.tt-n").forEach((x) => (x.open = d.o === "1"));
// Partuturan reference: who calls whom, including in-laws (from published guides to Batak Toba kinship terms).
const TUTUR_REF = [
  ["Amang / Inang", "Ayah / ibu; sapaan hormat untuk laki-laki / perempuan yang lebih tua.", "Father / mother; a respectful address for older men / women."],
  ["Ompung", "Kakek atau nenek.", "Grandfather or grandmother."],
  ["Amangtua / Inangtua", "Abang ayah dan istrinya; kakak perempuan ibu dan suaminya.", "Father's elder brother and his wife; mother's elder sister and her husband."],
  ["Amanguda / Inanguda", "Adik laki-laki ayah dan istrinya; adik perempuan ibu dan suaminya.", "Father's younger brother and his wife; mother's younger sister and her husband."],
  ["Namboru / Amangboru", "Saudari ayah (atau perempuan semarga ayah) dan suaminya.", "Father's sister (or a woman of father's marga) and her husband."],
  ["Tulang / Nantulang", "Saudara laki-laki ibu (atau laki-laki semarga ibu) dan istrinya.", "Mother's brother (or a man of mother's marga) and his wife."],
  ["Haha / Anggi", "Kakak / adik yang sejenis kelamin.", "Elder / younger sibling of the same sex."],
  ["Ito (iboto)", "Saudara lawan jenis; juga sapaan sopan kepada lawan jenis.", "A sibling of the opposite sex; also a polite address to the opposite sex."],
  ["Pariban", "Bagi laki-laki: putri tulang. Bagi perempuan: putra namboru.", "For a man: his tulang's daughter. For a woman: her namboru's son."],
  ["Lae", "Laki-laki kepada ipar laki-laki, putra namboru, atau putra tulang.", "A man to his brother-in-law, his namboru's son or his tulang's son."],
  ["Tunggane", "Laki-laki kepada saudara laki-laki istrinya.", "A man to his wife's brother."],
  ["Eda", "Perempuan kepada ipar perempuan.", "A woman to her sister-in-law."],
  ["Amangbao / Inangbao", "Perempuan kepada ipar laki-laki / laki-laki kepada ipar perempuan.", "A woman to her brother-in-law / a man to his sister-in-law."],
  ["Simatua", "Mertua (simatua doli = bapak mertua, simatua boru = ibu mertua).", "Parents-in-law (simatua doli = father-in-law, simatua boru = mother-in-law)."],
  ["Hela", "Menantu laki-laki.", "Son-in-law."],
  ["Parumaen (maen)", "Menantu perempuan; juga putri ito (bagi perempuan) atau putri tunggane (bagi laki-laki).", "Daughter-in-law; also a sister's-brother's daughter."],
  ["Bere / Ibebere", "Anak saudari kita (laki-laki / perempuan); semua yang ber-tulang kepada kita.", "Our sister's children (male / female); all who call us tulang."],
  ["Pahompu", "Cucu.", "Grandchild."]];
function tuturRefHtml() { return `<details class="card tutur-ref"><summary><b>📚 ${esc(L3("Kamus partuturan: siapa memanggil siapa", "Kamus partuturan", "Guide: who calls whom"))}</b></summary>
  <div class="tref">${TUTUR_REF.map(([t1, idt, ent]) => `<div class="tref-r"><b>${esc(t1)}</b><span>${esc(lang === "en" ? ent : idt)}</span></div>`).join("")}</div></details>`; }
// ---------- Liturgi: the liturgist's script, by week (YB 2026-10-30) ----------
// In Jadwal for Parhalado (the pastor and the elders). Each service: welcome, songs (KJ / BN / BE, lyrics from the songbook library),
// the Agenda texts, readings (fetched from SABDA: TB / Toba), and "berdiri / duduk" cues (the congregation stands for the last verse of
// the song before the Votum, the Confession, the Creed and the closing prayers). Read as a script, shown as slides, edited in the workbench.
const isLit = () => !!D && !isGuest() && (D.me.is_admin || "parhalado" in (D.me.groups || {}));
const LIT = { list: null, cur: null };
const BOOKN = { KJ: "Kidung Jemaat", BE: "Buku Ende", BN: "Buku Nyanyian" };
async function litList(force) { if (LIT.list && !force) return LIT.list; try { const r = await api.save("lit_list", {}); LIT.list = Array.isArray(r) ? r : []; LS.set("litList", LIT.list); } catch (e) { const c = LS.get("litList", []); LIT.list = Array.isArray(c) ? c : []; } return LIT.list; }
async function litGet(id) { try { const x = await api.save("lit_get", { id }); LS.set("lit:" + id, x); return x; } catch (e) { const c = LS.get("lit:" + id, null); if (c) return c; throw e; } }
R.lit = (arg) => {
  if (!isLit()) { location.replace("#/calendar"); return ""; }
  const id = String(arg || "").split("?")[0];
  if (!id) {
    setTimeout(async () => { const box = document.getElementById("litBox"); if (!box) return; const l = await litList(true); const td = today();
      const row = (x) => `<a class="li${x.day < td ? " past" : ""}" href="#/lit/${x.id}"><span class="date-chip"><b>${esc(fmt(x.day, { day: "numeric" }))}</b><small>${esc(fmt(x.day, { month: "short" }))}</small></span><span class="grow"><b>${esc(x.name)}</b><small>📜 ${esc(x.liturgist || "–")} · ${esc(x.lang === "bt" ? "Batak" : "Indonesia")} · ${x.songs} ${esc(L3("lagu", "ende", "songs"))}${x.draft ? " · " + esc(L3("draf", "draf", "draft")) : ""}</small></span>${ic("chev", "chev")}</a>`;
      const up = l.filter((x) => x.day >= td), past = l.filter((x) => x.day < td).reverse().slice(0, 6);
      box.innerHTML = `${up.length ? `<div class="card">${up.map(row).join("")}</div>` : empty(L3("Belum ada naskah liturgi.", "Ndang adong.", "No liturgy scripts yet."), "book")}${past.length ? `<h3 class="sec-h">${esc(L3("Sebelumnya", "Na salpu", "Earlier"))}</h3><div class="card">${past.map(row).join("")}</div>` : ""}`; }, 0);
    return shell("#/calendar", `${schedHead("lit")}<button class="btn primary block" data-act="litAuto">📥 ${esc(L3("Buat dari Acara Ibadah (PDF bulanan)", "Bahen sian Acara Ibadah (PDF)", "Build from the order of service (monthly PDF)"))}</button><div id="litBox">${skel(4)}</div>`, {});
  }
  setTimeout(async () => { const box = document.getElementById("litBox"); if (!box) return;
    try { const x = await litGet(id); LIT.cur = x; await songsLoad(false); box.innerHTML = litScript(x); litReadings(x); } catch (e) { box.innerHTML = empty(errMsg(e), "book"); } }, 0);
  return shell("#/calendar", `<div id="litBox">${skel(5)}</div>`, { back: "#/lit", title: L3("Naskah Liturgis", "Naskah Paragenda", "Liturgist's script") });
};
const litSpeaker = /^(Liturgis|Jemaat|L\+J|L|J|Paragenda|Huria|Pendeta|Anak Sekolah Minggu|Semua|Doa|Martangiang)\s*:\s*(.*)$/;
const litResp = (who) => /^(Jemaat|J|Huria|L\+J|Semua)$/.test(who);
function litSong(it) {
  const x = (SONGS.list || []).find((y) => y.k === `${it.book}:${it.num}`); const out = [];
  const want = it.verses && it.verses.length ? it.verses : x ? Object.keys(x.v || {}).map(Number) : [];
  if (x) want.forEach((n) => { if (x.v[n]) out.push({ n, lines: x.v[n] }); if (x.r && x.r.length && x.v[n]) out.push({ n: "Reff", lines: x.r }); });
  if (!out.length && it.lines && it.lines.length) it.lines.forEach((l) => { const m = l.match(/^(\d+)\.\s*(.*)$/); out.push({ n: m ? +m[1] : "", lines: (m ? m[2] : l).split(" / ") }); });
  return { title: it.title || (x && x.t) || "", verses: out };
}
function litScript(x) {
  const lang = x.lang; const s = [];
  s.push(`<div class="lit-head"><span class="badge">${esc(fmt(x.day, { weekday: "long", day: "numeric", month: "long", year: "numeric" }))}</span><h2>${esc(x.name)}</h2>${x.topic ? `<p class="lit-topic">“${esc(x.topic)}”</p>` : ""}
    <p class="small muted">📜 ${esc(L3("Liturgis", "Paragenda", "Liturgist"))}: <b>${esc(x.liturgist || "–")}</b> · 🎤 ${esc(x.preacher || "–")}${x.resort && x.resort !== "SG" ? " (" + esc(x.resort) + ")" : ""}${x.warta ? " · 📣 " + esc(x.warta) : ""}</p>
    <div class="row two"><button class="btn primary" data-act="litDoc">📄 ${esc(L3("Naskah (Word)", "Naskah (Word)", "Script (Word)"))}</button><button class="btn primary" data-act="litSlides">📽 ${esc(L3("Slide", "Slide", "Slides"))}</button></div>
    <a class="btn block" href="#/litwb/${x.id}">✏️ ${esc(L3("Ubah di workbench", "Ubah", "Edit in the workbench"))}</a></div>`);
  let n = 0, offerNo = 0;
  x.items.forEach((it, i) => {
    if (it.t === "cue") { s.push(it.kind === "music" ? `<div class="lit-cue music">🎹 — ${esc(it.text)} —</div>` : `<div class="lit-cue ${it.kind}">${it.kind === "stand" ? "🧍" : "🪑"} ${esc(it.text)}</div>`); return; }
    if (it.t === "welcome") { s.push(`<section class="card lit-it welcome"><h3>👋 ${esc(it.title)}</h3>${it.lines.map((l) => litLine(l)).join("")}</section>`); return; }
    n++;
    if (it.t === "song") { if (it.offering) offerNo++; const g = litSong(it); const vs = it.verses && it.verses.length ? ": " + it.verses.join(", ") : "";
      s.push(`<section class="card lit-it song"><p class="say"><b>${esc(lang === "bt" ? "Paragenda" : "Liturgis")}:</b> “${esc(litInvite(x, it, offerNo))}”</p>${litOfferNotes(x, it, offerNo) ? `<p class="muted small"><i>${esc(litOfferNotes(x, it, offerNo))}</i></p>` : ""}<h3><span class="lit-n">${n}</span> 🎵 ${esc(lang === "bt" ? "Marende" : "Bernyanyi")} ${esc(it.book)} ${it.num}${esc(vs)}${g.title ? ` · <i>${esc(g.title)}</i>` : ""}${it.offering ? ` <span class="badge">${esc(L3("persembahan", "pelean", "offering"))}</span>` : ""}</h3>
        ${g.verses.length ? g.verses.map((v, k) => `${it.standLast && k === g.verses.length - 1 - (g.verses[g.verses.length - 1].n === "Reff" ? 1 : 0) ? `<div class="lit-cue stand">🧍 ${esc(lang === "bt" ? "Jongjong ma hamu saluhutna." : "Jemaat dipersilakan berdiri.")}</div>` : ""}<div class="lit-v"><b>${esc(v.n)}</b><div>${v.lines.map((l) => `<p>${esc(l)}</p>`).join("")}</div></div>`).join("")
          : `<p class="muted small">${esc(L3("Lirik belum ada di Sada.", "Lirik ndang adong dope.", "Lyrics not in Sada yet."))}</p>${it.standLast ? `<div class="lit-cue stand">🧍 ${esc(lang === "bt" ? "Jongjong ma hamu saluhutna (ayat parpudi)" : "Jemaat dipersilakan berdiri (ayat terakhir)")}</div>` : ""}`}</section>`); return; }
    if (it.t === "part") { s.push(`<section class="card lit-it"><h3><span class="lit-n">${n}</span> ${esc(it.title)}</h3>${it.lines.map((l) => litLine(l)).join("")}${it.after ? `<p class="muted small"><i>${esc(it.after)}</i></p>` : ""}</section>`); return; }
    if (it.t === "reading") { s.push(`<section class="card lit-it reading"><h3><span class="lit-n">${n}</span> 📖 ${esc(it.title)}${it.ref ? ": " + esc(it.ref) : ""}</h3>${(it.intro || []).map(litLine).join("")}<div class="lit-bible" data-i="${i}">${it.ref ? skel(2) : `<p class="muted small">${esc(L3("Nas belum diisi.", "Ndang diisi dope.", "Passage not set yet."))}</p>`}</div>${(it.close || []).map(litLine).join("")}</section>`); return; }
    if (it.t === "note") { s.push(`<section class="card lit-it note"><h3><span class="lit-n">${n}</span> ${esc(it.title)}</h3>${it.say ? `<p class="say"><b>${esc(lang === "bt" ? "Paragenda" : "Liturgis")}:</b> ${esc(it.say)}</p>` : ""}${it.text ? `<p class="muted">${esc(it.text)}</p>` : ""}</section>`); }
  });
  return s.join("");
}
function litLine(l) { if (/^§/.test(l)) return `<p class="sel">${esc(l.slice(1))}</p>`; const m = l.match(litSpeaker); if (m) return `<p class="${litResp(m[1]) ? "resp" : "say"}"><b>${esc(m[1])}:</b> ${esc(m[2])}</p>`; if (/^\(.*\)$/.test(l)) return `<p class="muted small"><i>${esc(l)}</i></p>`; return `<p>${esc(l)}</p>`; }
async function litPassage(ref, ver) {
  const fn = ver === "toba" ? "bbc" : "id"; const url = `${BIB_FN}?ref=${encodeURIComponent(ref)}&lang=${fn}`; const cache = await bibCache();
  try { const r = await fetch(url, { headers: { apikey: BIB_CFG.supabaseKey || "", authorization: "Bearer " + (BIB_CFG.supabaseKey || "") } }); const j = await r.json(); if (!r.ok || !j.verses) throw new Error(j.error || "error"); if (cache) await cache.put(url, new Response(JSON.stringify(j))); return j.verses; }
  catch (e) { const c = cache && await cache.match(url); if (c) return (await c.json()).verses; throw e; }
}
function litReadings(x) { document.querySelectorAll(".lit-bible[data-i]").forEach(async (el) => { const it = x.items[+el.dataset.i]; if (!it.ref) return;
  try { const vs = await litPassage(it.ref, it.ver); el.innerHTML = vs.map((v) => `<p><sup>${v.v}</sup>${esc(v.t)}</p>`).join(""); it._verses = vs; } catch (e) { el.innerHTML = `<p class="muted small">${esc(L3("Nas tidak dapat dimuat. Periksa koneksi internet.", "", "Couldn't load the passage (internet?)."))}</p>`; } }); }
// Slides: the liturgist's teleprompter for the projector or a tablet.
async function litDeck(x) {
  await songsLoad(false);
  for (const it of x.items) if (it.t === "reading" && it.ref && !it._verses) { try { it._verses = await litPassage(it.ref, it.ver); } catch (e) {} }
  const e = (v) => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const S = []; const slide = (cls, inner) => S.push(`<section class="dk-slide ${cls}"><div class="in">${inner}</div><footer>${e(x.name)} · ${e(fmt(x.day, { day: "numeric", month: "long" }))}</footer></section>`);
  const lineHtml = (l) => { if (/^§/.test(l)) return `<p class="sel">${e(l.slice(1))}</p>`; const m = l.match(litSpeaker); return m ? `<p class="${litResp(m[1]) ? "resp" : "say"}"><b>${e(m[1])}:</b> ${e(m[2])}</p>` : /^\(.*\)$/.test(l) ? `<p class="hint">${e(l)}</p>` : `<p>${e(l)}</p>`; };
  const pack = (lines, kick) => { const w = (l) => Math.max(1, Math.ceil(l.length / 46)); let cur = [], n = 0; const flush = () => { if (cur.length) slide("text", `<p class="kick">${e(kick)}</p><div class="tx">${cur.map(lineHtml).join("")}</div>`); cur = []; n = 0; };
    lines.filter(Boolean).forEach((l) => { if (n + w(l) > 7 && cur.length) flush(); cur.push(l); n += w(l); }); flush(); };
  const cue = (kind, text) => slide("cue " + kind, `<p class="big">${kind === "stand" ? "🧍" : "🪑"}</p><h1>${e(text)}</h1>`);
  slide("title", `<p class="kick">HKBP Singapore · ${e(fmt(x.day, { weekday: "long", day: "numeric", month: "long", year: "numeric" }))}</p><h1>${e(x.name)}</h1>${x.topic ? `<p class="sub">“${e(x.topic)}”</p>` : ""}<p class="meta">📜 ${e(x.liturgist || "")} · 🎤 ${e(x.preacher || "")}</p>`);
  let offerNo = 0;
  x.items.forEach((it) => {
    if (it.t === "cue" && it.kind === "music") return slide("title sub", `<h1>— ${e(it.text)} —</h1>`);
    if (it.t === "cue") return cue(it.kind, it.text);
    if (it.t === "welcome") return pack(it.lines, it.title);
    if (it.t === "song") { if (it.offering) offerNo++; const g = litSong(it); const vs = it.verses && it.verses.length ? ": " + it.verses.join(", ") : "";
      slide("song-t", `<p class="kick">${e(x.lang === "bt" ? "Marende" : "Bernyanyi")}${it.offering ? " · " + e(x.lang === "bt" ? "pelean" : "persembahan") : ""}</p><h1>${e(it.book)} ${it.num}${e(vs)}</h1>${g.title ? `<p class="sub">${e(g.title)}</p>` : ""}<p class="say1">“${e(litInvite(x, it, offerNo))}”</p>${litOfferNotes(x, it, offerNo) && offerNo === 1 ? `<p class="meta">${e(litOfferNotes(x, it, offerNo))}</p>` : ""}`);
      const lastIdx = g.verses.length - 1 - (g.verses.length && g.verses[g.verses.length - 1].n === "Reff" ? 1 : 0);
      if (it.standLast && !g.verses.length) cue("stand", x.lang === "bt" ? "Jongjong ma hamu saluhutna." : "Jemaat dipersilakan berdiri.");
      g.verses.forEach((v, k) => { if (it.standLast && k === lastIdx) cue("stand", x.lang === "bt" ? "Jongjong ma hamu saluhutna." : "Jemaat dipersilakan berdiri.");
        slide("lyric", `<p class="vn">${e(v.n)}</p><div class="ly">${v.lines.map((l) => `<p>${e(l)}</p>`).join("")}</div>`); }); return; }
    if (it.t === "part") { pack(it.lines, it.title); if (it.after) slide("title sub", `<p class="meta">${e(it.after)}</p>`); return; }
    if (it.t === "reading") { slide("title sub", `<p class="kick">${e(it.title)}</p><h1>${e(it.ref || "")}</h1>`); pack([...(it.intro || []), ...((it._verses || []).map((v) => v.v + ". " + v.t)), ...(it.close || [])], it.title + (it.ref ? " · " + it.ref : "")); return; }
    if (it.t === "note") return slide("title sub", `<h1>${e(it.title)}</h1>${it.say ? `<p class="say1">“${e(it.say)}”</p>` : ""}${it.text ? `<p class="sub">${e(it.text)}</p>` : ""}`);
  });
  const css = `*{box-sizing:border-box;margin:0}html,body{height:100%;background:#0b1022;font-family:Arial,"Helvetica Neue",sans-serif}
  .stage{position:fixed;inset:0;display:grid;place-items:center}.deck{position:relative;width:min(100vw,177.78vh);aspect-ratio:16/9;container-type:inline-size;overflow:hidden;background:radial-gradient(circle at 20% 10%,#1d2b5a,#0b1022 60%)}
  .dk-slide{position:absolute;inset:0;display:none;color:#f2efe6;padding:5cqw 7cqw 7cqw}.dk-slide.on{display:flex;animation:in .25s ease-out}@keyframes in{from{transform:translateX(1.5cqw)}to{transform:none}}
  .dk-slide .in{margin:auto 0;width:100%;max-height:100%;overflow:hidden}.dk-slide footer{position:absolute;left:0;right:0;bottom:2cqw;text-align:center;font-size:1.4cqw;letter-spacing:.14em;font-weight:700;opacity:.5}
  .kick{font-size:2cqw;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#d8b25e;margin-bottom:1.4cqw}.title .in,.song-t .in,.cue .in{text-align:center}.title h1,.song-t h1{font-size:6cqw;line-height:1.12;font-weight:900}.title.sub h1{font-size:5cqw}
  .sub{font-size:3cqw;margin-top:1.4cqw;opacity:.9;font-style:italic}.meta{font-size:2cqw;margin-top:2.4cqw;opacity:.75}
  .tx{font-size:3.3cqw}.tx p{font-size:1em;line-height:1.38;margin:0 0 .9cqw;font-weight:600}.tx p.say b{color:#d8b25e}.tx p.resp{background:rgba(216,178,94,.16);border-left:.6cqw solid #d8b25e;padding:.6cqw 1.2cqw;border-radius:.6cqw;font-weight:800}.tx p.resp b{color:#ffe29a}.tx p.hint{font-style:italic;opacity:.65;font-size:.8em}.tx p.sel{color:#a9c8ff}.say1{font-size:2.8cqw;margin-top:2cqw;font-weight:700;color:#ffe9b0;line-height:1.35}
  .cue{background:radial-gradient(circle at 50% 40%,#2b6b45,#0f2a1c)}.cue.sit{background:radial-gradient(circle at 50% 40%,#28406b,#0f1a2e)}.cue .big{font-size:10cqw;line-height:1}.cue h1{font-size:6cqw;font-weight:900;margin-top:1.5cqw}
  .lyric .in{display:flex;gap:4cqw;align-items:center}.lyric .vn{font-size:5cqw;font-weight:900;color:#d8b25e;min-width:10cqw;text-align:center}.lyric .ly p{font-size:4cqw;line-height:1.3;font-weight:700}
  .bar{position:fixed;right:12px;bottom:12px;display:flex;gap:8px;align-items:center;background:rgba(0,0,0,.55);color:#fff;border-radius:999px;padding:6px 10px;font:600 13px Arial;z-index:9;transition:opacity .3s}.bar button{border:0;background:rgba(255,255,255,.18);color:#fff;border-radius:999px;padding:6px 12px;font:700 13px Arial}body.idle .bar{opacity:0}`;
  const js = `(function(){var s=[].slice.call(document.querySelectorAll('.dk-slide')),i=0,c=document.getElementById('cnt');function fit(sl){var tx=sl.querySelector('.tx,.ly'),box=sl.querySelector('.in');if(!tx||!box)return;var f=100;tx.style.fontSize='';while(f>50&&box.scrollHeight>box.clientHeight+1){f-=5;tx.style.fontSize=f+'%'}}
  function go(n){i=Math.max(0,Math.min(s.length-1,n));s.forEach(function(x,k){x.classList.toggle('on',k===i)});c.textContent=(i+1)+' / '+s.length;fit(s[i])}go(0);window.addEventListener('resize',function(){fit(s[i])});
  document.addEventListener('keydown',function(e){if(['ArrowRight','PageDown',' ','Enter'].indexOf(e.key)>=0){go(i+1);e.preventDefault()}if(['ArrowLeft','PageUp','Backspace'].indexOf(e.key)>=0){go(i-1);e.preventDefault()}});
  document.querySelector('.deck').addEventListener('click',function(e){var r=this.getBoundingClientRect();go(i+(e.clientX-r.left>r.width/3?1:-1))});var x0=null;document.addEventListener('touchstart',function(e){x0=e.touches[0].clientX},{passive:true});document.addEventListener('touchend',function(e){if(x0==null)return;var d=e.changedTouches[0].clientX-x0;if(Math.abs(d)>50)go(i+(d<0?1:-1));x0=null},{passive:true});
  document.getElementById('prev').onclick=function(e){e.stopPropagation();go(i-1)};document.getElementById('next').onclick=function(e){e.stopPropagation();go(i+1)};document.getElementById('fs').onclick=function(e){e.stopPropagation();var d=document.documentElement;(d.requestFullscreen||d.webkitRequestFullscreen||function(){}).call(d)};
  var t;function wake(){document.body.classList.remove('idle');clearTimeout(t);t=setTimeout(function(){document.body.classList.add('idle')},2500)}['mousemove','touchstart','keydown'].forEach(function(n){document.addEventListener(n,wake,{passive:true})});wake()})();`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(x.name)}</title><style>${css}.xclose{position:fixed;top:max(10px,env(safe-area-inset-top));right:12px;z-index:20;border:0;border-radius:999px;background:rgba(180,35,24,.92);color:#fff;font:800 15px Arial;padding:9px 16px;box-shadow:0 4px 14px rgba(0,0,0,.35)}</style></head><body><button class="xclose" onclick="window.close()">✕ ${e(L3("Tutup", "Tutup", "Close"))}</button><div class="stage"><div class="deck">${S.join("")}</div></div><div class="bar"><button id="prev">‹</button><span id="cnt"></span><button id="next">›</button><button id="fs">⛶</button></div><script>${js}<\/script></body></html>`;
}
A.litSlides = async (d, btn) => { const x = LIT.cur; if (!x) return; const w = litOpenWin(L3("Menyiapkan slide", "Mamparade slide", "Preparing the slides"));
  if (!w) { toast(L3("Izinkan pop-up untuk Sada agar slide bisa dibuka di jendela baru.", "Izinkan pop-up.", "Allow pop-ups for Sada so the slides can open in a new window."), true); return; }
  const html = await busy(btn, () => litDeck(x)); w.document.open(); w.document.write(html); w.document.close(); };
A.litFull = () => { const f = document.querySelector("#litPrev iframe"); if (f) (f.requestFullscreen || f.webkitRequestFullscreen || function () {}).call(f); };
// ---------- Liturgist's guide in the church's own format (YB 2026-10-30) ----------
// "MEMIMPIN IBADAH MINGGU": A. Persiapan di ruang konsistori, B. Ibadah di atas mimbar; numbered parts, the liturgist's words in quotes,
// texts chosen from the Agenda and the Bible in blue, the congregation's responses highlighted, "duduk kembali" in bold.
// Opens in its own window (print or download as Word); the slides open in another window. Indonesian or Batak, as the service.
const litBookName = (b) => ({ KJ: "Kidung Jemaat", BE: "Buku Ende", BN: "Buku Nyanyian" })[b] || b;
function litVerses(vs, lang) {
  if (!vs || !vs.length) return ""; const a = vs.slice().sort((p, q) => p - q); const run = a.every((v, i) => !i || v === a[i - 1] + 1);
  if (a.length === 1) return (lang === "bt" ? "ayat " : "ayat ") + a[0];
  if (run) return lang === "bt" ? `ayat ${a[0]} sahat tu ayat ${a[a.length - 1]}` : `ayat ${a[0]} sampai ayat ${a[a.length - 1]}`;
  return "ayat " + a.slice(0, -1).join(", ") + (lang === "bt" ? " dohot " : " dan ") + a[a.length - 1];
}
function litInvite(x, it, offerNo) {
  const bt = x.lang === "bt"; const where = `${litBookName(it.book)} ${bt ? "nomor" : "nomor"} ${it.num}${it.verses && it.verses.length ? ", " + litVerses(it.verses, x.lang) : ""}`;
  const last = it.verses && it.verses.length ? it.verses[it.verses.length - 1] : null;
  if (it.offering && offerNo === 1) return bt ? `Marende ma hita sian ${where}, huhut pasahathon pelean parjolo sian inganta be.` : `Mari kita bernyanyi dari ${where}, sambil menyampaikan persembahan pertama dari tempat duduk kita.`;
  if (it.offering) return bt ? `Marende ma hita sian ${where}, huhut mamboan pelean paduahon tu jolo.` : `Mari kita bernyanyi dari ${where}, sambil membawa persembahan 2a dan 2b ke depan.`;
  const stand = it.standLast && last ? (bt ? ` Di ayat ${last}, jongjong ma hamu saluhutna.` : ` Pada ayat ke-${last}, jemaat kami undang untuk berdiri.`) : "";
  return (bt ? `Marende ma hita sian ${where}.` : `Mari kita memuji Tuhan dari ${where}.`) + stand;
}
function litOfferNotes(x, it, offerNo) {
  const bt = x.lang === "bt";
  if (it.offering && offerNo === 1) return bt ? "— Paragenda tuat sian mimbar, marganti dohot Parjamita —" : "— Liturgis turun dari mimbar bertukar dengan pengkhotbah —";
  if (it.offering && offerNo > 1) return bt ? "(Paragenda mangida pamunguan ni pelean. Molo nunga sae alai angka parhobas dope di dalan mamboan kantong pelean tu jolo, boi do jouon huria jongjong huhut mandoshon ayat na mangihut manang mulak tu ayat 1, hombar tu situasi.)" : "(Pemimpin akan melihat proses pengumpulan persembahan. Jika pengumpulan sudah selesai, namun petugas masih dalam perjalanan menuju ke depan membawa kantong persembahan, pemimpin ibadah dapat mengundang jemaat untuk berdiri sambil menyanyikan ayat berikutnya atau mengulangi ke ayat 1, sesuai kondisi.)";
  return "";
}
function litDocHtml(x) {
  const e = (v) => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const bt = x.lang === "bt"; const logo = new URL("icon-192.png", location.href).href; let n = 0, offerNo = 0;
  const line = (l) => { if (/^§/.test(l)) return `<p class="sel">“${e(l.slice(1))}”</p>`; const m = l.match(litSpeaker);
    if (m && litResp(m[1])) return `<p class="resp"><span class="hl">${e(m[1] === "L+J" ? (bt ? "Paragenda + Huria" : "L + Jemaat") : m[1])}: ${e(m[2])}</span></p>`;
    if (m) return `<p class="say">“${e(m[2])}”</p>`; if (/^\(.*\)$/.test(l)) return `<p class="dir">${e(l)}</p>`; return `<p class="body">${e(l)}</p>`; };
  const out = [];
  out.push(`<div class="head"><img src="${e(logo)}" alt=""><div><h1>${bt ? "MANGULAHON PARMINGGUON" : "MEMIMPIN IBADAH MINGGU"}</h1><p class="sub">${e(fmt(x.day, { weekday: "long", day: "numeric", month: "long", year: "numeric" }))} · ${e(x.name)}</p><p class="sec">A. ${bt ? "PARSIAPAN: DI KONSISTORI" : "PERSIAPAN: DI RUANG KONSISTORI"}</p></div></div>
    <ol class="prep"><li>${bt ? "Parsiapan ulaon: Parjamita" : "Koordinasi persiapan ibadah: Pengkhotbah"} (${e(x.preacher || "…")}), ${bt ? "Paragenda" : "Liturgis"} (${e(x.liturgist || "…")}), ${bt ? "Panjaha tingting" : "Pembaca warta"} (${e(x.warta || "…")}), ${bt ? "isi ni tingting, Pemain musik / operator music box, Song leader." : "isi warta jemaat, Pemain musik / operator music box, Song leader."}</li>
      <li>${bt ? "Marende sada ayat jala mangulahon tangiang laho tu parmingguon: Paragenda." : "Bernyanyi 1 ayat dan memimpin doa berangkat ibadah: Liturgis."}</li>
      <li>${bt ? "Barisan prosesi: Parjamita, Paragenda, parhobas na asing; dung marbunyi musik prosesi." : "Barisan prosesi: Pengkhotbah, Liturgis, petugas lainnya; sesudah musik prosesi berbunyi."}</li></ol>
    <p class="sec b">B. ${bt ? "PARMINGGUON: DI ATAS MIMBAR" : "IBADAH: DI ATAS MIMBAR"}</p>${x.topic ? `<p class="topic">${bt ? "Topik" : "Tema"}: “${e(x.topic)}”</p>` : ""}`);
  x.items.forEach((it) => {
    if (it.t === "welcome") { out.push(`<h2 class="u">${e(it.title)}</h2>${it.lines.map((l, k) => `<p class="say">${k === 0 ? "“" : ""}${e(l).replace(e("Minggu " + x.name), "Minggu <u>" + e(x.name) + "</u>")}${k === it.lines.length - 1 ? "”" : ""}</p>`).join("")}`); return; }
    if (it.t === "cue") { out.push(it.kind === "music" ? `<p class="music"><span class="hl">— ${bt ? "Musik" : "Musik"} —</span></p>` : `<p class="cue">${e(it.text)}</p>`); return; }
    n++;
    if (it.t === "song") { if (it.offering) offerNo++; const g = litSong(it); const vs = it.verses && it.verses.length ? ": " + it.verses.join(", ") : "";
      out.push(`<h2><span class="no">${n}.</span> <u>${bt ? "Marende" : "Bernyanyi"} (${e(it.book)} ${it.num}${e(vs)})${g.title ? " – " + e(g.title) : ""}${it.offering ? (offerNo === 1 ? (bt ? " (Pelean 1)" : " (Persembahan 1)") : (bt ? " (Pelean 2a dohot 2b)" : " (Persembahan 2a dan 2b)")) : ""}</u></h2>
        <p class="say ind">“${e(litInvite(x, it, offerNo))}”</p>${litOfferNotes(x, it, offerNo) ? `<p class="dir ind">${e(litOfferNotes(x, it, offerNo))}</p>` : ""}`); return; }
    if (it.t === "part") { out.push(`<h2><span class="no">${n}.</span> <u>${e(it.title)}</u></h2><div class="ind">${it.lines.map(line).join("")}${it.after ? `<p class="dir">${e(it.after)}</p>` : ""}</div>`); return; }
    if (it.t === "reading") { out.push(`<h2><span class="no">${n}.</span> <u>${e(it.title)}</u></h2><div class="ind">${(it.intro || []).map((l) => `<p class="say b">“${e((l.match(litSpeaker) || [0, 0, l])[2])}${it.ref ? (bt ? " Na tarsurat di " : " Yang diambil dari ") + e(it.ref) + ":" : ""}”</p>`).join("")}
        ${(it._verses || []).map((v) => `<p class="sel">${v.c ? v.c + ":" : ""}${v.v} ${e(v.t)}</p>`).join("") || (it.ref ? `<p class="sel">(${e(it.ref)})</p>` : `<p class="dir">(${bt ? "Nas dang diisi dope" : "Nas belum diisi"})</p>`)}
        ${(it.close || []).map((l) => `<p class="say b">“${e((l.match(litSpeaker) || [0, 0, l])[2])}”</p>`).join("")}</div>`); return; }
    if (it.t === "note") { out.push(`<h2><span class="no">${n}.</span> <u>${e(it.title)}</u></h2>${it.say ? `<p class="say ind">“${e(it.say)}”</p>` : ""}${it.text ? `<p class="dir ind">${e(it.text)}</p>` : ""}`); }
  });
  const css = `@page{size:A4;margin:2.5cm 2.2cm 1.5cm 2.9cm}body{font-family:Tahoma,Verdana,Arial,sans-serif;font-size:11pt;color:#111;line-height:1.35;max-width:760px;margin:0 auto;padding:24px}
  .head{display:flex;gap:16px;align-items:flex-start}.head img{width:64px;height:64px}.head h1{font-size:14pt;text-align:center;margin:6px 0 2px;letter-spacing:.02em;border-bottom:2px solid #111;padding-bottom:4px}.sub{text-align:center;margin:0 0 8px;color:#444;font-size:10pt}
  .sec{color:#1f5fa8;font-weight:400;margin:6px 0}.sec.b{margin-top:18px;font-weight:700}.topic{font-style:italic;margin:2px 0 10px}ol.prep{margin:4px 0 0 90px;padding-left:18px}ol.prep li{margin:2px 0}
  h2{font-size:11.5pt;margin:16px 0 4px;font-weight:700}h2 .no{display:inline-block;min-width:22px}h2.u{text-decoration:underline}u{text-decoration:underline}
  p{margin:0 0 6px}.ind,.say,.sel,.dir,.cue,.resp,.body{margin-left:28px}.ind .say,.ind .sel,.ind .dir,.ind .resp,.ind .body,.ind .cue{margin-left:0}.say{color:#111}.say.b{font-weight:700}.sel{color:#2f5f9e;text-align:justify}
  .dir{color:#444;font-style:italic}.cue{font-weight:700;margin-top:6px}.hl{background:#00ffff}.music{margin:10px 0 10px 28px}.resp{margin-top:4px}
  .bar{position:sticky;top:0;background:#f3f4f8;border-bottom:1px solid #ddd;padding:10px;display:flex;gap:8px;justify-content:flex-end;margin:-24px -24px 16px;z-index:5}.bar button.x{background:#b42318}.bar button{border:0;border-radius:10px;padding:8px 14px;font-weight:700;background:#2d2f7f;color:#fff;cursor:pointer}.bar button.alt{background:#fff;color:#2d2f7f;border:1px solid #2d2f7f}
  @media print{.bar{display:none}body{padding:0}}`;
  return { body: out.join(""), css, title: `Liturgi ${x.day} ${x.name}` };
}
function litOpenWin(title) { const w = window.open("", "_blank"); if (w) { w.document.write(`<!doctype html><meta charset="utf-8"><title>${title}</title><body style="font:16px Arial;padding:40px;color:#555">⏳ ${title}…</body>`); } return w; }
A.litDoc = async (d, btn) => {
  const x = LIT.cur; if (!x) return; const w = litOpenWin(L3("Menyiapkan naskah", "Mamparade naskah", "Preparing the script"));
  if (!w) { toast(L3("Izinkan pop-up untuk Sada agar naskah bisa dibuka di jendela baru.", "Izinkan pop-up.", "Allow pop-ups for Sada so the script can open in a new window."), true); return; }
  for (const it of x.items) if (it.t === "reading" && it.ref && !it._verses) { try { it._verses = await litPassage(it.ref, it.ver); } catch (e) {} }
  const doc = litDocHtml(x); const fname = `Liturgi ${x.day} ${x.name}`.replace(/[^\w\- .]+/g, "").slice(0, 80);
  const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${doc.title}</title><style>${doc.css.replace(/\.bar[^}]*}/g, "")}</style></head><body>${doc.body}</body></html>`;
  w.document.open(); w.document.write(`<!doctype html><html lang="${x.lang === "bt" ? "bbc" : "id"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${doc.title}</title><style>${doc.css}</style></head><body>
    <div class="bar"><button class="alt" onclick="window.print()">🖨 ${L3("Cetak / PDF", "Cetak", "Print / PDF")}</button><button id="dl">⬇ ${L3("Unduh Word", "Unduh Word", "Download Word")}</button><button class="x" onclick="window.close()" aria-label="Close">✕ ${L3("Tutup", "Tutup", "Close")}</button></div>${doc.body}
    <script>document.getElementById('dl').onclick=function(){var b=new Blob(['\\ufeff',${JSON.stringify(wordHtml).replace(/<\/script/gi, "<\\/script")}],{type:'application/msword'});var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=${JSON.stringify(fname + ".doc")};document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},1500)};<\/script></body></html>`);
  w.document.close();
};
// The workbench: edit the service (details, every part, songs, readings, cues), or copy it as a new week.
const LWB = { x: null };
R.litwb = (arg) => {
  if (!isLit()) { location.replace("#/calendar"); return ""; }
  const id = String(arg || "").split("?")[0];
  setTimeout(async () => { const box = document.getElementById("lwbBox"); if (!box) return;
    try { if (!LWB.x || LWB.x.id !== id) LWB.x = JSON.parse(JSON.stringify(await litGet(id))); box.innerHTML = lwbForm(); } catch (e) { box.innerHTML = empty(errMsg(e), "book"); } }, 0);
  return shell("#/calendar", `<div id="lwbBox">${skel(5)}</div>`, { back: "#/lit/" + id, title: L3("Workbench Liturgi", "Workbench", "Liturgy workbench") });
};
const LWB_T = { welcome: ["👋", "Kata sambutan"], song: ["🎵", "Nyanyian"], part: ["📜", "Bagian liturgi"], reading: ["📖", "Pembacaan Alkitab"], note: ["📌", "Catatan"], cue: ["🧍", "Berdiri / duduk"] };
function lwbForm() {
  const x = LWB.x; const f = (k, label, v, type) => `<label class="small">${esc(label)}<input class="lwb-m" data-k="${k}" ${type ? `type="${type}"` : ""} value="${esc(v || "")}"></label>`;
  const item = (it, i) => {
    const head = `<div class="row between" style="margin:0"><b>${LWB_T[it.t][0]} ${esc(LWB_T[it.t][1])}</b><span class="row" style="margin:0;gap:4px"><button class="icon-btn" data-act="lwbMove" data-i="${i}" data-d="-1">↑</button><button class="icon-btn" data-act="lwbMove" data-i="${i}" data-d="1">↓</button><button class="icon-btn danger" data-act="lwbDel" data-i="${i}">${ic("trash")}</button></span></div>`;
    const inp = (k, label, v, extra) => `<label class="small">${esc(label)}<input class="lwb-i" data-i="${i}" data-k="${k}" value="${esc(v == null ? "" : v)}" ${extra || ""}></label>`;
    const ta = (k, label, v, rows) => `<label class="small">${esc(label)}<textarea class="lwb-i" data-i="${i}" data-k="${k}" rows="${rows || 5}">${esc((v || []).join("\n"))}</textarea></label>`;
    let body = "";
    if (it.t === "song") body = `<div class="row" style="margin:0;gap:8px"><label class="small" style="flex:1">${esc(L3("Buku", "Buku", "Book"))}<select class="lwb-i" data-i="${i}" data-k="book">${["KJ", "BN", "BE"].map((b) => `<option${b === it.book ? " selected" : ""}>${b}</option>`).join("")}</select></label>${inp("num", "No.", it.num, 'inputmode="numeric" style="width:80px"')}${inp("verses", L3("Ayat (1-3, 5)", "Ayat", "Verses (1-3, 5)"), (it.verses || []).join(", "))}</div>
      <div class="row" style="margin:0;gap:14px"><label class="small"><input type="checkbox" class="lwb-c" data-i="${i}" data-k="standLast"${it.standLast ? " checked" : ""}> ${esc(L3("Berdiri di ayat terakhir", "Jongjong di ayat parpudi", "Stand for the last verse"))}</label><label class="small"><input type="checkbox" class="lwb-c" data-i="${i}" data-k="offering"${it.offering ? " checked" : ""}> ${esc(L3("Persembahan", "Pelean", "Offering"))}</label></div>`;
    else if (it.t === "reading") body = inp("title", L3("Judul", "Judul", "Title"), it.title) + inp("ref", L3("Nas (mis. Yohanes 3: 16-18)", "Nas", "Passage (e.g. John 3: 16-18)"), it.ref) + ta("intro", L3("Pengantar", "Pangantar", "Introduction"), it.intro, 2) + ta("close", L3("Penutup", "Panutup", "Closing"), it.close, 2);
    else if (it.t === "cue") body = `<select class="lwb-i" data-i="${i}" data-k="kind"><option value="stand"${it.kind === "stand" ? " selected" : ""}>🧍 ${esc(L3("Berdiri", "Jongjong", "Stand"))}</option><option value="sit"${it.kind === "sit" ? " selected" : ""}>🪑 ${esc(L3("Duduk", "Hundul", "Sit"))}</option></select>` + inp("text", L3("Teks", "Teks", "Text"), it.text);
    else if (it.t === "note") body = inp("title", L3("Judul", "Judul", "Title"), it.title) + inp("text", L3("Keterangan", "Keterangan", "Details"), it.text);
    else body = inp("title", L3("Judul", "Judul", "Title"), it.title) + ta("lines", L3("Teks (satu baris = satu paragraf; awali dengan “Liturgis:” / “Jemaat:”)", "Teks", "Text (one line per paragraph; start with “Liturgis:” / “Jemaat:”)"), it.lines, 7);
    return `<article class="card lwb-it" data-i="${i}">${head}${body}</article>`;
  };
  return `<div class="card lwb-meta">${f("name", L3("Nama Minggu", "Goar ni Minggu", "Sunday name"), x.name)}${f("day", L3("Tanggal", "Tanggal", "Date"), x.day, "date")}${f("topic", L3("Topik", "Topik", "Topic"), x.topic)}
      <div class="row two" style="margin:0">${f("liturgist", L3("Liturgis", "Paragenda", "Liturgist"), x.liturgist)}${f("preacher", L3("Pengkhotbah", "Parjamita", "Preacher"), x.preacher)}</div>
      <label class="small">${esc(L3("Bahasa", "Hata", "Language"))}<select class="lwb-m" data-k="lang"><option value="id"${x.lang === "id" ? " selected" : ""}>Indonesia</option><option value="bt"${x.lang === "bt" ? " selected" : ""}>Batak</option></select></label></div>
    ${x.items.map(item).join("")}
    <div class="row two"><select id="lwbAdd">${Object.entries(LWB_T).map(([k, v]) => `<option value="${k}">${v[0]} ${esc(v[1])}</option>`).join("")}</select><button class="btn" data-act="lwbAdd">${ic("plus")} ${esc(L3("Tambah", "Tambah", "Add"))}</button></div>
    <div class="row two sticky-actions"><button class="btn" data-act="lwbCopy">📄 ${esc(L3("Salin jadi minggu baru", "Salin", "Copy as a new week"))}</button><button class="btn primary" data-act="lwbSave">💾 ${esc(t("save"))}</button></div>`;
}
document.addEventListener("input", (e) => { const el = e.target; if (!el || !el.classList || !LWB.x) return;
  if (el.classList.contains("lwb-m")) LWB.x[el.dataset.k] = el.value;
  if (el.classList.contains("lwb-i")) { const it = LWB.x.items[+el.dataset.i]; const k = el.dataset.k;
    if (k === "lines" || k === "intro" || k === "close") it[k] = el.value.split("\n").map((l) => l.trim()).filter(Boolean);
    else if (k === "verses") it.verses = el.value.split(/[,+]/).flatMap((p) => { const r = p.split(/[-–]/).map((v) => parseInt(v, 10)).filter((v) => v > 0); return r.length === 2 && r[1] >= r[0] ? Array.from({ length: r[1] - r[0] + 1 }, (_, j) => r[0] + j) : r.slice(0, 1); });
    else if (k === "num") it.num = parseInt(el.value, 10) || ""; else it[k] = el.value; } });
document.addEventListener("change", (e) => { const el = e.target; if (!el || !el.classList || !LWB.x) return;
  if (el.classList.contains("lwb-c")) LWB.x.items[+el.dataset.i][el.dataset.k] = el.checked;
  if (el.tagName === "SELECT" && (el.classList.contains("lwb-i") || el.classList.contains("lwb-m"))) el.dispatchEvent(new Event("input", { bubbles: true })); });
const lwbRe = () => { const y = window.scrollY; const box = document.getElementById("lwbBox"); if (box) box.innerHTML = lwbForm(); window.scrollTo(0, y); };
A.lwbMove = (d) => { const a = LWB.x.items, i = +d.i, j = i + +d.d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; lwbRe(); };
A.lwbDel = (d) => { LWB.x.items.splice(+d.i, 1); lwbRe(); };
A.lwbAdd = () => { const k = (document.getElementById("lwbAdd") || {}).value || "song"; const lang = LWB.x.lang;
  LWB.x.items.push(k === "song" ? { t: "song", book: lang === "bt" ? "BE" : "KJ", num: "", verses: [] } : k === "cue" ? { t: "cue", kind: "stand", text: lang === "bt" ? "Jongjong ma hamu saluhutna." : "Jemaat dipersilakan berdiri." } : k === "reading" ? { t: "reading", title: "Epistel", ref: "", ver: lang === "bt" ? "toba" : "tb", intro: [], close: [] } : { t: k, title: LWB_T[k][1], lines: [], text: "" }); lwbRe(); };
A.lwbSave = async (d, btn) => { const x = LWB.x; x.items.forEach((it) => { if (it.t === "reading") it.ver = x.lang === "bt" ? "toba" : "tb"; delete it._verses; });
  try { const r = await busy(btn, () => api.save("lit_save", { ...x, draft: false })); x.id = r.id; LS.set("lit:" + r.id, null); toast(t("saved")); location.hash = "#/lit/" + r.id; } catch (e) { toast(errMsg(e), true); } };
A.lwbCopy = async (d, btn) => { const x = JSON.parse(JSON.stringify(LWB.x)); delete x.id; const nd = new Date(x.day + "T12:00:00Z"); nd.setUTCDate(nd.getUTCDate() + 7); x.day = nd.toISOString().slice(0, 10); x.name = x.name + " (" + L3("salinan", "salinan", "copy") + ")";
  x.items = x.items.filter((it) => it.t !== "song").map((it) => (it.t === "reading" ? { ...it, ref: "" } : it));
  try { const r = await busy(btn, () => api.save("lit_save", { ...x, draft: true })); LWB.x = null; toast(L3("Minggu baru dibuat. Isi lagu dan nasnya.", "Minggu baru.", "New week created. Add its songs and passages.")); location.hash = "#/litwb/" + r.id; } catch (e) { toast(errMsg(e), true); } };
try { document.head.insertAdjacentHTML("beforeend", `<style>
  .lit-head { margin: 4px 0 12px; } .lit-head h2 { margin: 8px 0 4px; font-size: 24px; line-height: 1.2; } .lit-topic { font-style: italic; margin: 0 0 6px; }
  .lit-it h3 { display: flex; gap: 8px; align-items: baseline; font-size: 16px; margin: 0 0 8px; } .lit-n { min-width: 24px; height: 24px; border-radius: 999px; background: var(--brand-soft); color: var(--brand); font-size: 12px; font-weight: 900; display: inline-grid; place-items: center; flex: none; }
  .lit-it p { margin: 0 0 .5em; line-height: 1.5; } .lit-it p.say b { color: var(--brand); } .lit-it p.resp { background: var(--brand-soft); border-left: 3px solid var(--gold); padding: 6px 10px; border-radius: 8px; font-weight: 700; }
  .lit-it.welcome { border-left: 4px solid var(--gold); } .lit-v { display: flex; gap: 12px; margin: 0 0 10px; } .lit-v > b { min-width: 34px; color: var(--brand); font-size: 13px; padding-top: 2px; } .lit-v p { margin: 0; }
  .lit-bible p { margin: 0 0 .35em; } .lit-bible sup { font-weight: 800; color: var(--brand); margin-right: 3px; }
  .lit-cue { margin: 6px 0; padding: 10px 14px; border-radius: 14px; font-weight: 800; text-align: center; background: #e7f6ec; color: #17633a; } .lit-cue.sit { background: #e8eef9; color: #284a86; } .lit-cue.music { background: #e0fbfb; color: #0b6b6b; } .lit-it p.sel { color: #2f5f9e; }
  .lwb-meta { display: grid; gap: 8px; } .lwb-it { display: grid; gap: 8px; } .lwb-it select, .lwb-meta select { width: 100%; }
  .li.past { opacity: .6; }
</style>`); } catch (e) {}

// ---------- Dokumen Gereja: church documents (YB 2026-10-30) ----------
// Church document text → sections (YB 2026-10-30): Agenda, Konfessi, Juklak RPP. Chapters (BAGIAN/BAB/BINDU/Pasal/Roman numerals/ALL CAPS)
// and subsections (A. / 1.) with their lines; the table of contents at the front is dropped (entries with no text under them).
function docFromText(text) {
  const unspace = (l) => l.replace(/\b(?:[A-Za-z] ){2,}[A-Za-z]{1,3}\b/g, (m) => m.replace(/ /g, "")).replace(/\s+([.,;:!?])/g, "$1");
  const raw = String(text || "").replace(/\r/g, "").replace(/[\u00a0\uf0b7\u2022]/g, " ").split("\n").map((l) => unspace(l.replace(/\s{2,}/g, " ").trim()));
  const isCaps = (l) => l.length <= 90 && !/[a-z]/.test(l) && /[A-Z]{3}/.test(l) && !/:\s*$/.test(l);   // "PELAYAN LITURGI :" is a speaker, not a heading
  const L1 = (l) => /^(BAGIAN|BAB|BINDU|PASAL|Pasal)\b/.test(l) && l.length < 90 || /^[IVXL]+\.\s+\S/.test(l) && isCaps(l);
  const L2 = (l) => /^[A-Z]\.\s+\S/.test(l) && isCaps(l) && l.length < 90 || /^\d{1,2}\.\s+\S/.test(l) && l.length < 64 && !/[.;,]$/.test(l) && !/\.\s+\S/.test(l.slice(3));   // "1. Title", not "1. Item. Sentence…"
  const toc = (l) => /\.{4,}/.test(l) || /\s\d{1,3}$/.test(l) && /^[IVXL]+\.|^[A-Z]\.\s|^\(/.test(l);
  const secs = []; let cur = null, last = null;
  const open = (title, level) => { cur = { title, level, lines: [] }; secs.push(cur); last = cur; };
  for (let i = 0; i < raw.length; i++) {
    const l = raw[i]; if (!l) { if (cur && cur.lines.length && cur.lines[cur.lines.length - 1] !== "") cur.lines.push(""); continue; }
    if (toc(l)) continue;
    if (L1(l)) { let title = l; while ((raw[i + 1] && isCaps(raw[i + 1]) && !L1(raw[i + 1]) && !L2(raw[i + 1])) || (raw[i + 1] === "" && raw[i + 2] && isCaps(raw[i + 2]) && !L1(raw[i + 2]) && !L2(raw[i + 2]) && /^(BAGIAN|BAB|BINDU)/.test(title))) { if (raw[i + 1] === "") i++; title += " " + raw[++i]; } open(title, 1); continue; }
    if (isCaps(l) && !/^[A-Z]\.\s/.test(l)) { if (cur && !cur.lines.some(Boolean) && cur.level === 1 && !/^[IVXL]+\.|^(BAGIAN|BAB|BINDU|PASAL|Pasal)/.test(cur.title)) { cur.title += " " + l; continue; } open(l, cur && cur.level === 1 && cur.lines.some(Boolean) ? 2 : 1); continue; }
    if (L2(l)) { const nx = raw.slice(i + 1).find((x) => x) || ""; if (/^[A-Z]\.\s/.test(l) || /^[A-ZÀ-Ý0-9“"(]/.test(nx)) { open(l, 2); continue; } }
    if (!cur) open("", 1);
    const p = cur.lines[cur.lines.length - 1];
    if (p && p !== "" && !/[.:;!?)”"»…]$/.test(p) && /^[a-z(“"]/.test(l) && !/^[a-z]\.\s/.test(l)) cur.lines[cur.lines.length - 1] = p + " " + l; else cur.lines.push(l);
  }
  // drop table-of-contents entries and empty headings; trim blank edges
  const out = secs.map((s) => ({ ...s, lines: s.lines.join("\n").replace(/^\n+|\n+$/g, "").replace(/\n{3,}/g, "\n\n").split("\n").filter((l, i, a) => !(l === "" && a[i - 1] === "")) }));
  // a heading with nothing under it is a table-of-contents entry when the same heading appears again later with text
  const later = (i) => out.slice(i + 1).some((x) => x.title === out[i].title && x.lines.some(Boolean));
  return out.filter((s, i) => (s.lines.some(Boolean) || (s.title && !later(i) && !/\s\d{1,3}$/.test(s.title) && out[i + 1] && out[i + 1].level === 2)) && (s.title || s.lines.some(Boolean)));
}
// Agenda (Batak), Agenda/Liturgi (Indonesia), Konfessi HKBP and Juklak RPP, imported by the admin from text files (📥 on the tile),
// read as books (chapters, sections, search, text size) and, for the two Agendas, shown as slides for the projector.
// The two Agendas are for Parhalado (the pastor and the elders) only; the server enforces that too.
const DOC_META = {
  "agenda-bt": { title: "Agenda HKBP", sub: ["Bahasa Batak", "Hata Batak", "Batak"], lang: "bt", restricted: true, slides: true, icon: "📘" },
  "agenda-id": { title: "Agenda / Liturgi", sub: ["Bahasa Indonesia", "Hata Indonesia", "Indonesian"], lang: "id", restricted: true, slides: true, icon: "📗" },
  "konfessi": { title: "Konfessi HKBP", sub: ["Pengakuan Iman HKBP 2023", "Panindangion Haporseaon", "Confession of Faith 2023"], lang: "bt", restricted: false, icon: "📕" },
  "juklak-rpp": { title: "Juklak RPP HKBP", sub: ["Ruhut Parmahanion dohot Paminsangon", "Ruhut Parmahanion", "Pastoral care and discipline guide"], lang: "bt", restricted: false, icon: "📙" },
};
const DOCS = { list: null, cache: {} };
const isParhalado = () => !!D && !isGuest() && "parhalado" in (D.me.groups || {});
async function docList(force) { if (DOCS.list && !force) return DOCS.list; const c = LS.get("docList", null); if (c && !force) DOCS.list = c; try { DOCS.list = (await api.save("doc_list", {})) || []; LS.set("docList", DOCS.list); } catch (e) { DOCS.list = DOCS.list || (c || []); } return DOCS.list; }
async function docLoad(slug, force) {
  if (DOCS.cache[slug] && !force) return DOCS.cache[slug];
  const c = LS.get("doc:" + slug, null); if (c && !force) { DOCS.cache[slug] = c; }
  try { const r = await api.save("doc_get", { slug }); DOCS.cache[slug] = r; LS.set("doc:" + slug, r); } catch (e) { if (!DOCS.cache[slug]) throw e; }
  return DOCS.cache[slug];
}
function docsHome() {
  setTimeout(() => docList(false).then(() => { const el = document.getElementById("docTiles"); if (el) el.innerHTML = docTiles(); }), 0);
  return shell("#/library", `<h2 class="page-h">📚 ${esc(L3("Dokumen Gereja", "Dokumen Huria", "Church documents"))}</h2>
    <h3 class="sec-h">${esc(L3("Alkitab & Nyanyian", "Bibel & Ende", "Bible & songbooks"))}</h3>
    <div class="doc-grid">
      ${tile("#/library?s=bible", "📖", L3("Alkitab", "Bibel", "Bible"), L3("TB · Toba · KJV, offline", "TB · Toba · KJV", "TB · Toba · KJV, offline"))}
      ${tile("#/library?s=KJ", "🎵", "Kidung Jemaat", L3("Nomor & judul", "Nomor & judul", "By number and title"))}
      ${tile("#/library?s=BE", "🎶", "Buku Ende", L3("Nomor & judul", "Nomor & judul", "By number and title"))}
      ${tile("#/library?s=BN", "🎼", "Buku Nyanyian", "HKBP")}
    </div>
    <h3 class="sec-h">${esc(L3("Buku gereja", "Buku ni huria", "Church books"))}</h3>
    <div class="doc-grid" id="docTiles">${docTiles()}</div>`, {});
}
const tile = (href, icon, title, sub, extra) => `<a class="doc-tile" href="${esc(href)}"><span class="doc-ic">${icon}</span><b>${esc(title)}</b><small>${esc(sub)}</small>${extra || ""}</a>`;
function docTiles() {
  const have = Object.fromEntries((DOCS.list || []).map((x) => [x.slug, x]));
  return Object.entries(DOC_META).filter(([slug, m]) => !m.restricted || isParhalado()).map(([slug, m]) => { const h = have[slug];
    const extra = `${m.restricted ? `<span class="doc-lock">🔒 Parhalado</span>` : ""}${D.me.is_admin ? `<button class="icon-btn doc-imp" data-act="docImport" data-slug="${slug}" aria-label="${esc(L3("Impor", "Impor", "Import"))}">📥</button>` : ""}`;
    return h ? tile("#/doc/" + slug, m.icon, m.title, L3(...m.sub) + ` · ${h.sections} ${L3("bagian", "bagian", "sections")}`, extra)
      : `<div class="doc-tile off"><span class="doc-ic">${m.icon}</span><b>${esc(m.title)}</b><small>${esc(L3(...m.sub))} · ${esc(L3("belum diimpor", "ndang diimpor dope", "not imported yet"))}</small>${extra}</div>`; }).join("");
}
R.doc = (arg) => {
  const slug = String(arg || "").split("?")[0]; const idx = new URLSearchParams(location.hash.split("?")[1] || "").get("i");
  const m = DOC_META[slug]; if (!m) return R.notFound();
  if (m.restricted && !isParhalado()) { location.replace("#/library"); return ""; }
  setTimeout(async () => { const box = document.getElementById("docBox"); if (!box) return;
    try { const doc = await docLoad(slug, false); box.innerHTML = idx == null ? docToc(doc, slug) : docSection(doc, slug, +idx); }
    catch (e) { box.innerHTML = empty(L3("Belum ada isi. Admin perlu mengimpornya dulu.", "Ndang adong isi.", "No content yet. The admin needs to import it first."), "book"); } }, 0);
  return shell("#/library", `<div id="docBox">${skel(4)}</div>`, { back: idx == null ? "#/library" : "#/doc/" + slug, title: m.title, sub: L3(...m.sub) });
};
function docToc(doc, slug) {
  const secs = doc.sections || [];
  return `<input type="search" id="docFind" data-slug="${slug}" placeholder="${esc(L3("Cari di buku ini…", "Lului di buku on…", "Search this book…"))}" autocomplete="off"><div id="docHits"></div>
    <div class="card doc-toc">${secs.map((x, i) => `<a class="li lv${x.level}" href="#/doc/${slug}?i=${i}"><span class="grow"><b>${esc(x.title || L3("(tanpa judul)", "", "(untitled)"))}</b></span>${ic("chev", "chev")}</a>`).join("")}</div>`;
}
document.addEventListener("input", (e) => { const el = e.target; if (!el || el.id !== "docFind") return; const doc = DOCS.cache[el.dataset.slug]; const box = document.getElementById("docHits"); if (!doc || !box) return;
  const q = norm(el.value); if (q.length < 2) { box.innerHTML = ""; return; }
  const hits = []; (doc.sections || []).forEach((x, i) => { const txt = x.lines.join("\n"); const k = norm(txt).indexOf(q); if (norm(x.title).includes(q) || k >= 0) hits.push({ i, x, snip: k >= 0 ? txt.slice(Math.max(0, k - 50), k + 90).replace(/\n/g, " ") : "" }); });
  box.innerHTML = hits.length ? `<div class="card">${hits.slice(0, 30).map((h) => `<a class="li" href="#/doc/${el.dataset.slug}?i=${h.i}"><span class="grow"><b>${esc(h.x.title)}</b><small>…${esc(h.snip)}…</small></span>${ic("chev", "chev")}</a>`).join("")}</div>` : `<p class="muted small">${esc(L3("Tidak ditemukan.", "Ndang dapot.", "Nothing found."))}</p>`; });
const SPEAK = /^([A-ZÀ-Ý][A-ZÀ-Ý .\/]{0,28}?|[A-Z][a-z]{0,12}(?: [A-Z][a-z]{0,12})?)\s*:\s*(.*)$/;
const docLine = (l) => { const m = l.match(SPEAK); if (m && m[1].length <= 30) return `<p class="say"><b>${esc(m[1].trim())}:</b> ${esc(m[2])}</p>`; return `<p>${esc(l)}</p>`; };
function docSection(doc, slug, i) {
  const secs = doc.sections || [], x = secs[i]; if (!x) return empty("–", "book"); const m = DOC_META[slug]; const fs = LS.get("docFs", 18);
  const parent = x.level === 2 ? secs.slice(0, i).reverse().find((y) => y.level === 1) : null;
  return `<div class="doc-head">${parent ? `<small class="muted">${esc(parent.title)}</small>` : ""}<h2>${esc(x.title)}</h2></div>
    <div class="doc-text" style="font-size:${fs}px">${x.lines.map((l) => (l ? docLine(l) : `<p class="gap"></p>`)).join("")}</div>
    <div class="row" style="margin-top:14px;gap:8px"><button class="btn" data-act="docFs" data-d="-1">A−</button><button class="btn" data-act="docFs" data-d="1">A+</button>${speakBtn(".doc-text")}</div>
    ${m.slides ? `<button class="btn primary block" data-act="docSlides" data-slug="${slug}" data-i="${i}">📽 ${esc(L3("Tampilkan sebagai slide", "Patuduhon slide", "Show as slides"))}</button>` : ""}
    <div class="row two"><a class="btn${i > 0 ? "" : " off"}" href="#/doc/${slug}?i=${Math.max(0, i - 1)}">‹ ${esc(L3("Sebelumnya", "Na parjolo", "Previous"))}</a><a class="btn${i < secs.length - 1 ? "" : " off"}" href="#/doc/${slug}?i=${Math.min(secs.length - 1, i + 1)}">${esc(L3("Berikutnya", "Na mangihut", "Next"))} ›</a></div>`;
}
A.docFs = (d) => { const v = Math.max(14, Math.min(32, LS.get("docFs", 18) + +d.d)); LS.set("docFs", v); const el = document.querySelector(".doc-text"); if (el) el.style.fontSize = v + "px"; };
// Slides for the projector: the chapter (with its sections) as 16:9 slides, at most 7 lines each, speakers in gold, the congregation's lines highlighted.
function docDeck(doc, i) {
  const secs = doc.sections || []; let a = i; while (a > 0 && secs[a].level === 2) a--; let b = a + 1; while (b < secs.length && secs[b].level === 2) b++;
  const e = (x) => String(x == null ? "" : x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const S = []; const slide = (cls, inner) => S.push(`<section class="dk-slide ${cls}"><div class="in">${inner}</div><footer>${e(doc.title)} · HKBP SINGAPORE</footer></section>`);
  slide("title", `<p class="kick">${e(doc.title)}</p><h1>${e(secs[a].title)}</h1>`);
  for (let k = a; k < b; k++) { const x = secs[k]; if (k > a) slide("title sub", `<p class="kick">${e(secs[a].title)}</p><h1>${e(x.title)}</h1>`);
    const w = (l) => Math.max(1, Math.ceil(l.length / 46)); const label = (l) => /:\s*$/.test(l) && l.length < 40;
    const chunks = []; let cur = [], n = 0;
    x.lines.filter(Boolean).forEach((l) => { if (n + w(l) > 7 && cur.length) { const keep = label(cur[cur.length - 1]) ? cur.pop() : null; if (cur.length) chunks.push(cur); cur = keep ? [keep] : []; n = keep ? w(keep) : 0; } cur.push(l); n += w(l); });
    if (cur.length) chunks.push(cur);
    chunks.forEach((ls) => slide("text", `<p class="kick">${e(x.title)}</p><div class="tx">${ls.map((l) => { const m = l.match(SPEAK); const resp = m && /^(J|JEMAAT|H|HURIA|RUAS|SEMUA|S|ALL)\b/i.test(m[1]); return m && m[1].length <= 30 ? `<p class="${resp ? "resp" : "say"}"><b>${e(m[1].trim())}:</b> ${e(m[2])}</p>` : `<p>${e(l)}</p>`; }).join("")}</div>`)); }
  const css = `*{box-sizing:border-box;margin:0}html,body{height:100%;background:#0b1022;font-family:Arial,"Helvetica Neue",sans-serif}
  .stage{position:fixed;inset:0;display:grid;place-items:center}.deck{position:relative;width:min(100vw,177.78vh);aspect-ratio:16/9;container-type:inline-size;overflow:hidden;background:radial-gradient(circle at 20% 10%,#1d2b5a,#0b1022 60%)}
  .dk-slide{position:absolute;inset:0;display:none;color:#f2efe6;padding:5cqw 7cqw 7cqw}.dk-slide.on{display:flex;animation:in .25s ease-out}@keyframes in{from{transform:translateX(1.5cqw)}to{transform:none}}
  .dk-slide .in{margin:auto 0;width:100%;max-height:100%;overflow:hidden}.dk-slide footer{position:absolute;left:0;right:0;bottom:2cqw;text-align:center;font-size:1.4cqw;letter-spacing:.14em;font-weight:700;opacity:.55}
  .kick{font-size:2cqw;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#d8b25e;margin-bottom:1.4cqw}.title .in{text-align:center}.title h1{font-size:6.5cqw;line-height:1.12;font-weight:900}.title.sub h1{font-size:5cqw}
  .tx{font-size:3.3cqw}.tx p{font-size:1em;line-height:1.38;margin:0 0 .9cqw;font-weight:600}.tx p.say b{color:#d8b25e}.tx p.resp{background:rgba(216,178,94,.16);border-left:.6cqw solid #d8b25e;padding:.6cqw 1.2cqw;border-radius:.6cqw;font-weight:800}.tx p.resp b{color:#ffe29a}
  .bar{position:fixed;right:12px;bottom:12px;display:flex;gap:8px;align-items:center;background:rgba(0,0,0,.55);color:#fff;border-radius:999px;padding:6px 10px;font:600 13px Arial;z-index:9;transition:opacity .3s}.bar button{border:0;background:rgba(255,255,255,.18);color:#fff;border-radius:999px;padding:6px 12px;font:700 13px Arial}body.idle .bar{opacity:0}`;
  const js = `(function(){var s=[].slice.call(document.querySelectorAll('.dk-slide')),i=0,c=document.getElementById('cnt');function fit(sl){var tx=sl.querySelector('.tx'),box=sl.querySelector('.in');if(!tx||!box)return;var f=100;tx.style.fontSize='';while(f>50&&box.scrollHeight>box.clientHeight+1){f-=5;tx.style.fontSize=f+'%'}}
  function go(n){i=Math.max(0,Math.min(s.length-1,n));s.forEach(function(x,k){x.classList.toggle('on',k===i)});c.textContent=(i+1)+' / '+s.length;fit(s[i])}go(0);window.addEventListener('resize',function(){fit(s[i])});
  document.addEventListener('keydown',function(e){if(['ArrowRight','PageDown',' ','Enter'].indexOf(e.key)>=0){go(i+1);e.preventDefault()}if(['ArrowLeft','PageUp','Backspace'].indexOf(e.key)>=0){go(i-1);e.preventDefault()}});
  document.querySelector('.deck').addEventListener('click',function(e){var r=this.getBoundingClientRect();go(i+(e.clientX-r.left>r.width/3?1:-1))});var x0=null;document.addEventListener('touchstart',function(e){x0=e.touches[0].clientX},{passive:true});document.addEventListener('touchend',function(e){if(x0==null)return;var d=e.changedTouches[0].clientX-x0;if(Math.abs(d)>50)go(i+(d<0?1:-1));x0=null},{passive:true});
  document.getElementById('prev').onclick=function(e){e.stopPropagation();go(i-1)};document.getElementById('next').onclick=function(e){e.stopPropagation();go(i+1)};document.getElementById('fs').onclick=function(e){e.stopPropagation();var d=document.documentElement;(d.requestFullscreen||d.webkitRequestFullscreen||function(){}).call(d)};
  var t;function wake(){document.body.classList.remove('idle');clearTimeout(t);t=setTimeout(function(){document.body.classList.add('idle')},2500)}['mousemove','touchstart','keydown'].forEach(function(n){document.addEventListener(n,wake,{passive:true})});wake()})();`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(doc.title)} · ${e(secs[a].title)}</title><style>${css}</style></head><body><div class="stage"><div class="deck">${S.join("")}</div></div><div class="bar"><button id="prev">‹</button><span id="cnt"></span><button id="next">›</button><button id="fs">⛶</button></div><script>${js}<\/script></body></html>`;
}
A.docSlides = async (d) => { const doc = await docLoad(d.slug, false); const html = docDeck(doc, +d.i);
  sheet("📽 " + L3("Slide", "Slide", "Slides"), `<div id="docPrev"></div><div class="row two" style="margin-top:10px"><button class="btn primary" data-act="docSlidesFull">⛶ ${esc(L3("Layar penuh", "Layar penuh", "Full screen"))}</button><button class="btn" data-act="closeSheet">${esc(L3("Tutup", "Tutup", "Close"))}</button></div><p class="small muted">${esc(L3("Ketuk sisi kanan/kiri atau gunakan panah. Di komputer: sambungkan proyektor lalu layar penuh.", "", "Tap right/left or use the arrows. On a computer, connect the projector and go full screen."))}</p>`);
  const f = tataIframe(html); f.style.cssText = "width:100%;aspect-ratio:16/9;border:0;border-radius:12px;background:#0b1022"; f.setAttribute("allowfullscreen", ""); document.getElementById("docPrev").appendChild(f); };
A.docSlidesFull = () => { const f = document.querySelector("#docPrev iframe"); if (f) (f.requestFullscreen || f.webkitRequestFullscreen || function () {}).call(f); };
A.docImport = (d) => {
  const m = DOC_META[d.slug]; if (!m) return;
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".txt,.pdf,text/plain,application/pdf";
  inp.onchange = async () => { const file = inp.files && inp.files[0]; if (!file) return;
    sheet("📥 " + m.title, `<p class="small muted">${esc(file.name)}</p><div class="rec-bar"><i id="impBar"></i></div><p class="small" id="impPct"></p>`);
    try { const text = /\.txt$/i.test(file.name) ? await file.text() : await pdfText(file, (p, n) => { const b = document.getElementById("impBar"); if (b) b.style.width = Math.round((p / n) * 100) + "%"; const e = document.getElementById("impPct"); if (e) e.textContent = `${p} / ${n}`; });
      const secs = docFromText(text); if (!secs.length || secs.reduce((n, x) => n + x.lines.filter(Boolean).length, 0) < 20) throw new Error(L3("Teks tidak dapat dibaca (berkas hasil scan?)", "Ndang terbaca.", "No readable text (a scanned file?)"));
      const l1 = secs.filter((x) => x.level === 1);
      DOCS.pending = { slug: d.slug, secs };
      sheet("📥 " + m.title, `<p>${esc(L3(`${l1.length} bab, ${secs.length - l1.length} bagian, ${secs.reduce((n, x) => n + x.lines.filter(Boolean).length, 0)} baris teks.`, `${l1.length} bab.`, `${l1.length} chapters, ${secs.length - l1.length} sections, ${secs.reduce((n, x) => n + x.lines.filter(Boolean).length, 0)} lines of text.`))}</p>
        <div class="chips imp-chips">${l1.slice(0, 60).map((x) => `<span class="chip on">${esc(x.title.slice(0, 40))}</span>`).join("")}</div>
        <button class="btn primary block" data-act="docImportSave">💾 ${esc(L3("Simpan ke Sada", "Simpan", "Save to Sada"))}</button><button class="btn ghost block" data-act="closeSheet">${esc(t("cancel"))}</button>`); }
    catch (e) { closeSheet(); toast(e.message || errMsg(e), true); } };
  inp.click();
};
A.docImportSave = async (d, btn) => { const p = DOCS.pending; if (!p) return; const m = DOC_META[p.slug];
  try { await busy(btn, () => api.save("doc_save", { slug: p.slug, title: m.title, lang: m.lang, restricted: m.restricted, sections: p.secs })); delete DOCS.cache[p.slug]; LS.set("doc:" + p.slug, null); await docList(true); closeSheet(); render(); toast(L3("Tersimpan.", "Tarsimpan.", "Saved.")); }
  catch (e) { toast(errMsg(e), true); } };
try { document.head.insertAdjacentHTML("beforeend", `<style>
  .doc-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 8px; } @media (min-width: 900px) { .doc-grid { grid-template-columns: repeat(4, 1fr); } }
  .doc-tile { position: relative; display: grid; gap: 4px; padding: 16px 14px 14px; border-radius: 20px; background: var(--surface); box-shadow: var(--shadow); text-decoration: none; color: inherit; min-height: 118px; align-content: start; }
  .doc-tile.off { opacity: .6; } .doc-ic { font-size: 30px; line-height: 1; margin-bottom: 4px; } .doc-tile b { font-size: 15.5px; line-height: 1.2; } .doc-tile small { color: var(--muted); font-size: 12px; line-height: 1.3; }
  .doc-lock { font-size: 11px; font-weight: 800; color: var(--gold); } .doc-imp { position: absolute; top: 10px; right: 10px; }
  .lib-back { display: inline-block; font-weight: 700; margin: 8px 0 4px; text-decoration: none; }
  .doc-toc .li.lv2 { padding-left: 34px; } .doc-toc .li.lv2 b { font-weight: 600; } .doc-toc .li.lv1 b { font-weight: 800; }
  .doc-head { margin: 6px 0 14px; } .doc-head h2 { margin: 2px 0 0; font-size: 22px; line-height: 1.2; }
  .doc-text { line-height: 1.55; } .doc-text p { margin: 0 0 .5em; } .doc-text p.gap { height: .6em; } .doc-text p.say b { color: var(--brand); }
  @media (min-width: 900px) { .doc-text { max-width: 780px; } }
</style>`); } catch (e) {}

// ---------- Import a songbook PDF (YB 2026-10-30) ----------
// Song book text → songs (YB 2026-10-30). Used by Sada's "Impor buku lagu"; tested here on the church's KJ.pdf.
function songsFromText(text, defBook) {
  // Headings: "KJ No. 363 : 1 – 2 “title”" (Tata Ibadah), "B.E. No. 103 TITLE BL. 80" / "BE. 393. TITLE" (Buku Ende), "BN 21 TITLE" (Buku Nyanyian)
  const HEAD = /\b(B\.\s*E|BUKU\s*ENDE|BE|PKJ|NKB|KJ|BN|KLB)\b\.?(?:\s*(?:No|NO|Nomor|Nr)\.?)*\s*(\d{1,4})/i;
  let t = String(text || "").replace(/\r/g, "").replace(/[\uf0b7\u2022\u25cf\u25aa]/g, "").replace(/[\u00a0\t]+/g, " ");
  t = t.replace(/([^\n])(?=\s*(?:\(\s*[KPJ]\s*\+\s*[KPJ]\s*\)|\d{1,2}\.\s*(?:\(\s*[KPJ]\s*\+\s*[KPJ]\s*\)\s*)?(?:Bernyanyi|Nyanyi(?:an)?\s+[Bb]ersama|Nyanyian\s+Sambutan|Nyanyan)|(?:Bernyanyi|Nyanyian\s+[Bb]ersama|Nyanyian\s+Sambutan|Nyanyan\s+Bersama)\b))/g, "$1\n");
  const lines = t.split("\n").map((l) => l.trim());
  const songs = [], seen = new Set(); let cur = null, mode = "v", vn = 0;
  const caps = (x) => (x && x === x.toUpperCase() && /[A-Z]{3}/.test(x) ? x.toLowerCase().replace(/(^|[\s(‘'"-])(\p{L})/gu, (m, a, c) => a + c.toUpperCase()) : x);
  const isCue = (l) => /^[.…·_\s]{4,}/.test(l) || /^\(?\s*(Jemaat|Persembahan|persembahan)/.test(l) || /^[.…]+\s*\(.*\)\s*$/.test(l) || /^`$/.test(l);
  const isInfo = (l) => /^\d\s*=\s*[A-G]/i.test(l) || /^Vers(i|e)?\s*\d+$/i.test(l) || /\((?:BL|BE|B\.E\.?|KJ|BN)\.?\s*No\.?\s*\d+[a-z]?\)\s*$/i.test(l) || /^BL\.?\s*\d+$/i.test(l) || /^\d{3}\s+[^-–\s]/.test(l);
  const finish = () => { if (!cur) return; const vs = cur.blocks.filter((b) => b.lines.length);
    if (vs.length === 1 && !vs[0].n && cur.nums.length > 1 && vs[0].lines.length % cur.nums.length === 0) { const per = vs[0].lines.length / cur.nums.length; const all = vs[0].lines; vs.splice(0, 1, ...cur.nums.map((n, k) => ({ n, lines: all.slice(k * per, (k + 1) * per) }))); }
    const key = cur.book + ":" + cur.num;
    if (vs.length && !seen.has(key)) { seen.add(key); const verses = {}; vs.forEach((b, i) => { let n = b.n || (cur.nums.length === vs.length ? cur.nums[i] : (cur.nums[0] || 1) + i); while (verses[n]) n++; verses[n] = b.lines; }); songs.push({ book: cur.book, num: cur.num, title: caps(cur.title), verses, reff: cur.reff }); } cur = null; };
  for (let i = 0; i < lines.length; i++) {
    let l = lines[i]; if (!l) continue;
    const h = l.match(HEAD);
    if (h && (h.index < 4 || /^\d{3}\s*[-–]\s*$/.test(l.slice(0, h.index)) || /(Bernyanyi|Nyanyi|Nyanyan|Sambutan|\(\s*[KPJ])/i.test(l.slice(0, h.index + 3))) && !/^\d{3}\s+[^-–\s]/.test(l) && !isInfo(l)) {
      finish(); let book = h[1].toUpperCase().replace(/[\s.]/g, ""); if (book === "BUKUENDE") book = "BE";
      const rest = l.slice(h.index + h[0].length); const vs = (rest.match(/^\s*:\s*([\d\s,\-–+dst]+)/) || [])[1] || "";
      const nums = []; vs.replace(/dst/g, "").split(/[,+]/).forEach((p) => { const r = p.split(/[-–]/).map((x) => parseInt(x, 10)).filter((x) => x > 0); if (r.length === 2 && r[1] >= r[0] && r[1] - r[0] < 30) for (let k = r[0]; k <= r[1]; k++) nums.push(k); else if (r.length === 1) nums.push(r[0]); });
      let title = (rest.match(/[“"”]\s*([^“"”]+?)\s*[”"“]/) || [])[1] || "";
      if (!title && !vs) title = rest.replace(/^[\s.:–-]+/, "").replace(/\s*\(?\s*(?:BL|BE|B\.E\.?)\.?\s*(?:No\.?)?\s*\d+\s*\)?\s*\.?$/i, "").replace(/[.\s]+$/, "").trim();
      if (!title && lines[i + 1] && /^[“"”]/.test(lines[i + 1])) { title = lines[i + 1].replace(/[“"”]/g, "").trim(); i++; }
      cur = { book: book || defBook, num: +h[2], nums, title: title.replace(/\s+/g, " ").trim(), blocks: [], reff: [] }; mode = "v"; vn = 0; continue;
    }
    if (cur && /^Vers(i|e)?\s*\d+$/i.test(l) && cur.blocks.some((x) => x.lines.length)) { mode = "stop"; continue; }   // a second version of the same song: keep the first
    if (!cur || isCue(l) || isInfo(l) || mode === "stop") continue;
    if (/^\(\s*[KPJ]\s*\+\s*[KPJ]\s*\)\s*:?$/.test(l)) continue;
    if (/^\d{1,2}$/.test(l)) { if (+l > vn && +l <= vn + 3) { vn = +l; cur.blocks.push({ n: vn, lines: [] }); mode = "v"; } continue; }   // a verse number on its own line, or a stray number
    l = l.replace(/\s*[.…]{3,}\s*\((?:Jemaat|Persembahan|persembahan)[^)]*\)\s*$/, "").trim(); if (!l) continue;
    const nextL = (lines.slice(i + 1).find((x) => x) || "");
    if (/^\d{1,2}\s*[.)]\s*(\(\s*[KPJ]\s*\+\s*[KPJ]\s*\))?\s*:?$/.test(l) && (HEAD.test(nextL) || /^\(\s*[KPJ]/.test(nextL))) continue;
    const vm = l.match(/^(\d{1,2})\s*[).]\s*\.?\s*(.*)$/) || (/^\d\s+[A-Z‘'’]/.test(l) && +l[0] === vn + 1 ? [l, l[0], l.slice(2)] : null);
    if (vm && +vm[1] <= 30) { vn = +vm[1]; cur.blocks.push({ n: vn, lines: [] }); mode = "v"; l = vm[2].trim(); if (!l) continue; }
    const rm = l.match(/^(?:Reff?|Refrein|Koor|Ref)\s*[:.]?\s*(.*)$/i);
    if (rm && /^(?:Reff?|Refrein|Koor|Ref)\b/i.test(l)) { const rest = rm[1].trim(); if (cur.reff.length || /^[.…\s]*$/.test(rest) || /(\.\.\.|…)\s*$/.test(rest)) { mode = "skip"; continue; } mode = "r"; if (rest) cur.reff.push(rest); continue; }
    if (mode === "skip") continue;
    if (mode === "r") { cur.reff.push(l); continue; }
    if (!cur.blocks.length) cur.blocks.push({ n: 0, lines: [] });
    cur.blocks[cur.blocks.length - 1].lines.push(l);
  }
  finish();
  return songs;
}

// Makers pick a PDF (or .txt) of songs; Sada reads its text in the app (pdf.js), finds every song (book, number, title, verses, Reff),
// shows what it found, and saves it to the library. Scanned books (pictures only) and sheet-music layouts can't be read this way.
const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
function pdfjsLoad() { if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib); return new Promise((ok, no) => { const sc = document.createElement("script"); sc.src = PDFJS + "pdf.min.js"; sc.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js"; ok(window.pdfjsLib); }; sc.onerror = () => no(new Error("pdf.js")); document.head.appendChild(sc); }); }
async function pdfText(file, onPage) {
  const lib = await pdfjsLoad(); const doc = await lib.getDocument({ data: await file.arrayBuffer() }).promise; let out = "";
  for (let p = 1; p <= doc.numPages; p++) { const tc = await (await doc.getPage(p)).getTextContent(); out += tc.items.map((it) => it.str + (it.hasEOL ? "\n" : "")).join("") + "\n"; if (onPage) onPage(p, doc.numPages); }
  return out;
}
const SIMP = { songs: [] };
A.songImport = (d) => {
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".pdf,.txt,application/pdf,text/plain";
  inp.onchange = async () => {
    const file = inp.files && inp.files[0]; if (!file) return;
    sheet("📥 " + L3("Membaca berkas", "Manjaha", "Reading the file"), `<p class="small muted">${esc(file.name)}</p><div class="rec-bar"><i id="impBar"></i></div><p class="small" id="impPct"></p>`);
    try {
      const text = /\.txt$/i.test(file.name) ? await file.text() : await pdfText(file, (p, n) => { const b = document.getElementById("impBar"); if (b) b.style.width = Math.round((p / n) * 100) + "%"; const e = document.getElementById("impPct"); if (e) e.textContent = `${p} / ${n}`; });
      const songs = songsFromText(text, d.book || "KJ").filter((x) => ["KJ", "BE", "BN"].includes(x.book));
      if (!songs.length) { sheet("📥 " + L3("Tidak ada lagu terbaca", "Ndang adong", "No songs could be read"), `<p>${esc(text.replace(/\s/g, "").length < 200 ? L3("Berkas ini berupa gambar hasil scan, jadi teksnya tidak bisa dibaca.", "Gambar scan.", "This file is scanned pictures, so its text can't be read.") : L3("Judul lagu (mis. “KJ No. 363 : 1 – 2”) tidak ditemukan. Berkas notasi/partitur juga tidak bisa dibaca.", "Ndang dapot judul.", "No song headings (e.g. “KJ No. 363 : 1 – 2”) were found. Sheet-music layouts can't be read either."))}</p><button class="btn block" data-act="closeSheet">OK</button>`); return; }
      SIMP.songs = songs; const have = new Set((SONGS.list || []).map((x) => x.k));
      const fresh = songs.filter((x) => !have.has(`${x.book}:${x.num}`)).length;
      sheet("📥 " + L3(`${songs.length} lagu ditemukan`, `${songs.length} ende`, `${songs.length} songs found`), `<p class="small muted">${esc(file.name)} · ${fresh} ${esc(L3("baru", "baru", "new"))}, ${songs.length - fresh} ${esc(L3("melengkapi lagu yang sudah ada", "manggenaphon", "add to existing songs"))}</p>
        <div class="chips imp-chips">${songs.map((x) => `<span class="chip${have.has(`${x.book}:${x.num}`) ? "" : " on"}">${esc(x.book)} ${x.num} · ${Object.keys(x.verses).length}${x.reff.length ? "+R" : ""}</span>`).join("")}</div>
        <button class="btn primary block" data-act="songImportSave">💾 ${esc(L3(`Simpan ${songs.length} lagu ke Sada`, "Simpan", `Save ${songs.length} songs to Sada`))}</button><button class="btn ghost block" data-act="closeSheet">${esc(t("cancel"))}</button>`);
    } catch (e) { closeSheet(); toast(L3("Berkas tidak bisa dibaca.", "Ndang boi dibaca.", "The file couldn't be read.") + " " + (e.message || ""), true); }
  };
  inp.click();
};
A.songImportSave = async (d, btn) => {
  const all = SIMP.songs.map((x) => ({ book: x.book, num: x.num, title: x.title, lang: (SONG_BOOKS[x.book] || [])[1] || "", verses: x.verses, reff: x.reff, source: "import" })); let saved = 0;
  try { await busy(btn, async () => { for (let i = 0; i < all.length; i += 25) { const r = await api.save("songs_upsert", { songs: all.slice(i, i + 25) }); saved += (r && r.saved) || 0; } });
    closeSheet(); await songsLoad(true); render(); toast(L3(`${saved} lagu tersimpan di Sada.`, `${saved} ende tarsimpan.`, `${saved} songs saved to Sada.`)); }
  catch (e) { toast(errMsg(e), true); }
};
try { document.head.insertAdjacentHTML("beforeend", `<style>.imp-chips { max-height: 40vh; overflow-y: auto; flex-wrap: wrap; margin: 8px 0 12px; } .imp-chips .chip { font-size: 12px; }</style>`); } catch (e) {}

// Passage search and the shared Sada library (YB 2026-10-30): a reference typed here is looked up once online (SABDA, through
// hkbp-bible) and then kept in Sada for everyone; Sada's collected chapters can be saved onto the phone in one go.
async function bibLibPaint(ver) {
  const el = document.getElementById("bibLib"); if (!el) return;
  try { const r = await api.save("bible_stats", { version: ver }); BIB.lib = BIB.lib || {}; BIB.lib[ver] = r.chapters || [];
    const n = BIB.lib[ver].length;
    el.innerHTML = `<div class="row between" style="margin:0;gap:10px"><span class="grow"><b>📚 ${n} ${esc(L3("pasal", "pasal", "chapters"))} ${esc(BIB_VERS[ver].short)} ${esc(L3("tersimpan di Sada", "di Sada", "kept in Sada"))}</b><small class="muted" style="display:block">${esc(L3("Jumlahnya bertambah setiap kali ada yang membaca atau mencari ayat.", "Tamba ganup adong na manjaha manang manglului ayat.", "Grows every time someone reads or searches."))}</small></span>${n ? `<button class="btn sm" data-act="bibLibSave">📥 ${esc(L3("Simpan ke HP", "Simpan", "Save to phone"))}</button>` : ""}</div>`;
  } catch (e) { el.innerHTML = `<small class="muted">${esc(L3("Perpustakaan Sada tidak dapat dibuka tanpa koneksi internet.", "", "Sada's library can't be reached without internet."))}</small>`; }
}
A.bibLibSave = async (d, btn) => {
  const ver = LS.get("bibVer", "tb"); const list = (BIB.lib && BIB.lib[ver]) || []; let ok = 0; btn.disabled = true;
  for (const name of list) { const m = name.match(/^(.*) (\d+)$/); const b = m ? BIB_ID.indexOf(m[1]) + 1 : 0; if (b > 0) { try { await bibChapter(ver, b, +m[2]); ok++; } catch (e) {} } btn.textContent = `📥 ${ok} / ${list.length}`; }
  btn.disabled = false; toast(L3(`${ok} pasal tersimpan di HP untuk offline.`, `${ok} pasal tarsimpan.`, `${ok} chapters saved on your phone for offline use.`));
};
F.bibSearch = async (f) => {
  const q = f.q.value.trim(); if (!q) return; const ver = LS.get("bibVer", "tb"); const box = document.getElementById("bibHit"); if (!box) return;
  box.innerHTML = skel(2); const show = (html) => { BIB.hit = html; const el = document.getElementById("bibHit"); if (el) el.innerHTML = html; };
  try {
    const fn = BIB_VERS[ver].kjv ? "id" : BIB_VERS[ver].fn;   // KJV: the reference is read by the server, the text comes from the phone
    const url = `${BIB_FN}?ref=${encodeURIComponent(q)}&lang=${fn}`;
    let j; const cache = await bibCache();
    try { const r = await fetch(url, { headers: { apikey: BIB_CFG.supabaseKey || "", authorization: "Bearer " + (BIB_CFG.supabaseKey || "") } }); j = await r.json(); if (!r.ok || !j.verses) throw Object.assign(new Error(j.error || "error"), { code: j.error });
      if (cache && !BIB_VERS[ver].kjv) await cache.put(url, new Response(JSON.stringify(j), { headers: { "content-type": "application/json" } })); }
    catch (e) { const c = cache && await cache.match(url); if (c) j = await c.json(); else throw e; }
    let verses = j.verses;
    if (BIB_VERS[ver].kjv) { const k = await kjvLoad(false); if (!k) throw Object.assign(new Error("kjv"), { code: "kjv" }); verses = verses.map((x) => ({ ...x, t: ((k[j.book_id - 1].chapters[x.c - 1]) || [])[x.v - 1] || "" })); }
    const ref = `${bibName(ver, j.book_id)} ${verses[0].c}:${verses[0].v}${verses.length > 1 ? "–" + (verses[verses.length - 1].c !== verses[0].c ? verses[verses.length - 1].c + ":" : "") + verses[verses.length - 1].v : ""}`;
    show(`<div class="card bib-res"><div class="row between" style="margin:0"><b>${esc(ref)}</b><span class="badge">${esc(BIB_VERS[ver].short)}</span></div>
      <div class="bib-text" style="font-size:${LS.get("bibFs", 19)}px">${verses.map((v) => `<p><sup>${v.c !== verses[0].c ? v.c + ":" : ""}${v.v}</sup>${esc(v.t)}</p>`).join("")}</div>
      <div class="row two"><button class="btn" data-act="bibCh" data-b="${j.book_id}" data-c="${verses[0].c}">📖 ${esc(L3("Buka pasal", "Bukka pasal", "Open the chapter"))}</button><a class="btn wa" href="${wa(`*${ref}* (${BIB_VERS[ver].short})\n${verses.map((v) => v.v + " " + v.t).join("\n")}`)}" target="_blank" rel="noopener">${ic("wa")} WhatsApp</a></div></div>`);
    if (!BIB_VERS[ver].kjv) bibLibPaint(ver);
  } catch (e) {
    show(`<p class="warn small">${esc(e.code === "bad_ref" ? L3("Ayat tidak dikenali. Contoh: Yoh 3:16, Mazmur 23, Roma 8:28-39.", "Ndang tartanda. Songon: Joh 3:16.", "Not recognised. For example: John 3:16, Psalm 23, Romans 8:28-39.") : e.code === "not_found" ? L3("Ayat tersebut tidak ditemukan.", "Ndang adong.", "That passage doesn't exist.") : e.code === "kjv" ? L3("Unduh KJV dulu (tombol di bawah).", "Unduh KJV.", "Download the KJV first (button below).") : L3("Tidak ada koneksi internet, dan ayat ini belum tersimpan.", "Ndang adong internet.", "No internet, and this passage isn't saved yet."))}</p>`);
  }
};
try { document.head.insertAdjacentHTML("beforeend", `<style>
  .bib-search { display: flex; gap: 8px; margin: 6px 0 8px; } .bib-search input { flex: 1; min-width: 0; } .bib-search .btn { flex: none; }
  .bib-res { border-left: 4px solid var(--brand); } .bib-res .bib-text { margin: 10px 0; } .bib-lib { margin-top: 12px; }
</style>`); } catch (e) {}

// ---------- Alkitab & Nyanyian: Bible and songbooks (YB 2026-10-30) ----------
// A bottom tab of its own. Alkitab: Terjemahan Baru, Bibel Toba and ESV are read chapter by chapter from SABDA (through hkbp-bible);
// every chapter read is kept on the phone (Cache Storage) so it opens offline next time, and a whole book can be saved for offline.
// The King James Version (public domain) can be downloaded in full for offline use.
// Songbooks (Kidung Jemaat, Buku Ende, others): the songs the church prints in its published Tata Ibadah and Sunday School slides,
// collected by makers' phones and merged verse by verse (hk_songs), plus songs makers add or correct; the whole library is kept offline.
const BIB_CFG = window.HKBP_CONFIG || {};
const BIB_FN = (BIB_CFG.supabaseUrl || "https://tbicfofdorwrupzlqgdm.supabase.co").replace(/\/$/, "") + "/functions/v1/hkbp-bible";
const KJV_URL = "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json";
const BIB_CACHE = "sada-bible-v1";
const BIB_ID = ["Kejadian", "Keluaran", "Imamat", "Bilangan", "Ulangan", "Yosua", "Hakim-hakim", "Rut", "1 Samuel", "2 Samuel", "1 Raja-raja", "2 Raja-raja", "1 Tawarikh", "2 Tawarikh", "Ezra", "Nehemia", "Ester", "Ayub", "Mazmur", "Amsal", "Pengkhotbah", "Kidung Agung", "Yesaya", "Yeremia", "Ratapan", "Yehezkiel", "Daniel", "Hosea", "Yoel", "Amos", "Obaja", "Yunus", "Mikha", "Nahum", "Habakuk", "Zefanya", "Hagai", "Zakharia", "Maleakhi",
  "Matius", "Markus", "Lukas", "Yohanes", "Kisah Para Rasul", "Roma", "1 Korintus", "2 Korintus", "Galatia", "Efesus", "Filipi", "Kolose", "1 Tesalonika", "2 Tesalonika", "1 Timotius", "2 Timotius", "Titus", "Filemon", "Ibrani", "Yakobus", "1 Petrus", "2 Petrus", "1 Yohanes", "2 Yohanes", "3 Yohanes", "Yudas", "Wahyu"];
const BIB_EN = ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Songs", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
  "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"];
const BIB_CH = [50, 40, 27, 36, 34, 24, 21, 4, 31, 24, 22, 25, 29, 36, 10, 13, 10, 42, 150, 31, 12, 8, 66, 52, 5, 48, 12, 14, 3, 9, 1, 4, 7, 3, 3, 3, 2, 14, 4, 28, 16, 24, 21, 28, 16, 16, 13, 6, 6, 4, 4, 5, 3, 6, 4, 3, 1, 13, 5, 5, 3, 5, 1, 1, 1, 22];
const BIB_VERS = { tb: { name: "Terjemahan Baru", short: "TB", fn: "id", en: false }, toba: { name: "Bibel Toba", short: "Toba", fn: "bbc", en: false }, kjv: { name: "King James Version", short: "KJV", kjv: true, en: true } };
const BIB = { kjv: null };
const bibName = (ver, b) => (BIB_VERS[ver].en ? BIB_EN : BIB_ID)[b - 1];
const bibUrl = (ver, b, c) => `${BIB_FN}?ref=${encodeURIComponent(BIB_ID[b - 1] + " " + c)}&lang=${BIB_VERS[ver].fn}`;
async function bibCache() { try { return "caches" in window ? await caches.open(BIB_CACHE) : null; } catch (e) { return null; } }
async function kjvLoad(download) {
  if (BIB.kjv) return BIB.kjv; const c = await bibCache(); let r = c && await c.match(KJV_URL);
  if (!r && download) { const f = await fetch(KJV_URL); if (!f.ok) throw new Error("download " + f.status); if (c) await c.put(KJV_URL, f.clone()); r = f; }
  if (!r) return null; const txt = (await r.text()).replace(/^\uFEFF/, ""); BIB.kjv = JSON.parse(txt); return BIB.kjv;
}
async function bibChapter(ver, b, c) {
  if (BIB_VERS[ver].kjv) { const k = await kjvLoad(false); if (!k) return { need: "kjv" }; return { verses: (k[b - 1].chapters[c - 1] || []).map((t0, i) => ({ v: i + 1, t: t0 })), offline: true }; }
  const url = bibUrl(ver, b, c); const cache = await bibCache();
  const cached = cache && await cache.match(url);
  try {
    const r = await fetch(url, { headers: { apikey: BIB_CFG.supabaseKey || "", authorization: "Bearer " + (BIB_CFG.supabaseKey || "") } });
    const j = await r.clone().json(); if (!r.ok || !j.verses) throw new Error(j.error || "error");
    if (cache) await cache.put(url, new Response(JSON.stringify(j), { headers: { "content-type": "application/json" } }));
    return { verses: j.verses.map((x) => ({ v: x.v, t: x.t })), offline: false, saved: true };
  } catch (e) { if (cached) { const j = await cached.json(); return { verses: j.verses.map((x) => ({ v: x.v, t: x.t })), offline: true, saved: true }; } throw e; }
}
// Songs
const SONG_BOOKS = { KJ: ["Kidung Jemaat", "id"], BE: ["Buku Ende", "bt"], PKJ: ["Pelengkap Kidung Jemaat", "id"], NKB: ["Nyanyikanlah Kidung Baru", "id"], BN: ["Buku Nyanyian", "id"], KLB: ["Kidung Ceria", "id"], SS: ["Lagu Sekolah Minggu", ""], EN: ["English hymns", "en"] };
const SONGS = { list: null, busy: false };
const canSongs = () => !!D && !isGuest() && (D.me.is_admin || isMMMaker() || !!D.ss_maker);
async function songsLoad(force) {
  if (SONGS.list && !force) return SONGS.list;
  const c = LS.get("songsLib", null); if (c && !force) SONGS.list = c.list;
  try { const l = await api.save("songs_list", {}); SONGS.list = l || []; LS.set("songsLib", { at: Date.now(), list: SONGS.list }); } catch (e) { if (!SONGS.list) SONGS.list = (c && c.list) || []; }
  return SONGS.list;
}
function songHead(head) {
  const m = String(head || "").match(/\b(B\.\s*E|BUKU\s*ENDE|BE|PKJ|NKB|KJ|BN|KLB)\b\.?\s*(?:No\.?|Nomor|Nr\.?)?\s*(\d{1,4})/i); if (!m) return null;
  let book = m[1].toUpperCase().replace(/[\s.]/g, ""); if (book === "BUKUENDE") book = "BE";
  const vs = (head.slice(m.index + m[0].length).match(/^\s*[:.]\s*([\d\s,\-–]+)/) || [])[1] || "";
  const nums = []; vs.split(/,/).forEach((p) => { const r = p.split(/[-–]/).map((x) => parseInt(x, 10)).filter((x) => x > 0); if (r.length === 2 && r[1] >= r[0] && r[1] - r[0] < 30) for (let i = r[0]; i <= r[1]; i++) nums.push(i); else if (r.length === 1) nums.push(r[0]); });
  const title = (head.match(/[“"]([^”"]+)[”"]/) || [])[1] || (head.split("·").slice(1).join("·") || "").trim();
  return { book, num: +m[2], nums, title: title.trim() };
}
function songBlocks(text) {
  const verses = [], reff = []; String(text || "").replace(/\r/g, "").split(/\n\s*\n/).forEach((blk) => { const ls = blk.split("\n").map((l) => l.trim()).filter(Boolean); if (!ls.length) return;
    if (/^reff?\s*:?$/i.test(ls[0]) || /^reff?\s*:/i.test(ls[0])) { const first = ls[0].replace(/^reff?\s*:?\s*/i, ""); const rl = [first, ...ls.slice(1)].filter(Boolean); if (!reff.length) reff.push(...rl); } else verses.push(ls); });
  return { verses, reff };
}
async function songsCollect(quiet) {
  if (!canSongs() || SONGS.busy || api.mode !== "remote") return 0; SONGS.busy = true; let added = 0;
  try {
    const done = new Set(LS.get("songsDone", []) || []); const out = [];
    for (const v of (D.services || []).filter((x) => x.id && !done.has("t:" + x.id)).slice(0, 20)) {
      try { const doc = new DOMParser().parseFromString(await tataHtml(v.id), "text/html");
        endeSongs(doc).forEach((x) => { const h = songHead(x.title); if (!h) return; const bl = x.verses && x.verses.length ? { verses: x.verses, reff: (x.reffs || [])[0] ? x.reffs[0].split("\n") : [] } : songBlocks(x.text);
          const nums = h.nums.length === bl.verses.length ? h.nums : bl.verses.map((_, i) => (h.nums[0] || 1) + i); const verses = {}; bl.verses.forEach((ls, i) => (verses[nums[i]] = ls));
          if (bl.verses.length) out.push({ book: h.book, num: h.num, title: h.title, lang: (SONG_BOOKS[h.book] || [])[1] || "", verses, reff: bl.reff, source: v.service_date || v.day || "" }); });
        done.add("t:" + v.id); } catch (e) {}
    }
    for (const dk of (D.ss_decks || []).filter((x) => !done.has("s:" + x.id)).slice(0, 10)) {
      try { const r = await api.save("ss_html", { deck_id: dk.id }); (r.sections || []).filter((x) => x.type === "song" && x.body).forEach((x) => { const h = songHead(x.extra || x.title); const bl = songBlocks(x.body); const verses = {}; bl.verses.forEach((ls, i) => (verses[i + 1] = ls));
          if (bl.verses.length) out.push(h ? { book: h.book, num: h.num, title: h.title || x.extra, lang: dk.lang, verses, reff: bl.reff, source: dk.day } : { book: "SS", title: (x.extra || x.title || "").slice(0, 120), lang: dk.lang, verses, reff: bl.reff, source: dk.day }); });
        done.add("s:" + dk.id); } catch (e) {}
    }
    for (let i = 0; i < out.length; i += 25) { const r = await api.save("songs_upsert", { songs: out.slice(i, i + 25) }); added += (r && r.saved) || 0; }
    LS.set("songsDone", [...done].slice(-400));
    if (added) { await songsLoad(true); if (!quiet) toast(L3(`${added} lagu diperbarui dari Tata Ibadah.`, `${added} ende.`, `${added} songs updated from the Tata Ibadah.`)); }
  } finally { SONGS.busy = false; }
  return added;
}
// Page
R.library = () => {
  const q = new URLSearchParams(location.hash.split("?")[1] || ""); let sec = q.get("s") || ""; if (!["bible", "KJ", "BE", "BN"].includes(sec)) sec = ""; LS.set("libSec", sec || "KJ");
  if (!sec) return docsHome();
  const seg = (k, label) => `<a role="tab" aria-selected="${sec === k}" href="#/library?s=${k}">${esc(label)}</a>`;
  const head = `<a class="lib-back" href="#/library">‹ ${esc(L3("Dokumen Gereja", "Dokumen Huria", "Church documents"))}</a><div class="seg lib-seg" role="tablist" style="--gc:var(--brand)">${seg("bible", L3("Alkitab", "Bibel", "Bible"))}${seg("KJ", "Kidung Jemaat")}${seg("BE", "Buku Ende")}${seg("BN", "Buku Nyanyian")}</div>`;
  if (sec === "bible") { setTimeout(bibPaint, 0); return shell("#/library", `${head}<div id="bibBox">${skel(3)}</div>`, {}); }
  setTimeout(async () => { await songsLoad(false); songListPaint(sec); songsCollect(true).then((n) => { if (n) songListPaint(sec); }); }, 0);
  return shell("#/library", `${head}
    <div class="row" style="gap:8px;margin:8px 0"><input type="search" id="songFind" placeholder="${esc(L3("Nomor atau judul lagu…", "Nomor manang goar ni ende…", "Song number or title…"))}" inputmode="search" autocomplete="off" style="flex:1">${canSongs() ? `<button class="btn" data-act="songImport" data-book="${sec}" aria-label="${esc(L3("Impor PDF", "Impor", "Import PDF"))}">📥</button><button class="btn" data-act="songEdit" data-book="${sec}" aria-label="${esc(L3("Tambah lagu", "Tambah", "Add a song"))}">${ic("plus")}</button>` : ""}</div>
    <div id="songList">${skel(4)}</div>
    <p class="small muted">${esc(L3("Lagu-lagu dikumpulkan dari Tata Ibadah dan slide Sekolah Minggu yang diterbitkan gereja, dan bertambah setiap minggu. Semua tersimpan di HP untuk offline.", "Ende sian Tata Ibadah.", "Songs are collected from the church's published Tata Ibadah and Sunday School slides and grow every week. All are kept on your phone for offline use."))}</p>`, {});
};
function songListPaint(sec) {
  const box = document.getElementById("songList"); if (!box) return;
  const qv = norm((document.getElementById("songFind") || {}).value || "");
  const list = (SONGS.list || []).filter((x) => x.b === sec).filter((x) => !qv || String(x.n) === qv || norm((x.t || "") + " " + Object.values(x.v || {}).flat().slice(0, 4).join(" ")).includes(qv));
  const numQ = /^\d{1,4}$/.test(qv) && !list.some((x) => String(x.n) === qv);
  const ask = numQ ? `<div class="card song-miss"><b>${esc((SONG_BOOKS[sec] || [sec])[0])} ${qv} ${esc(L3("belum ada di Sada", "ndang adong dope di Sada", "isn't in Sada yet"))}</b>
    <div class="row two"><a class="btn" href="https://www.google.com/search?q=${encodeURIComponent((SONG_BOOKS[sec] || [sec])[0] + " " + qv)}" target="_blank" rel="noopener">🔎 ${esc(L3("Cari di internet", "Lului di internet", "Search the internet"))}</a>${canSongs() ? `<button class="btn primary" data-act="songEdit" data-book="${sec}" data-num="${qv}">➕ ${esc(L3("Tambahkan ke Sada", "Tambahkon", "Add to Sada"))}</button>` : ""}</div></div>` : "";
  box.innerHTML = ask + (list.length ? `<div class="card song-list">${list.map((x) => { const first = (Object.values(x.v || {})[0] || [])[0] || "";
    return `<a class="li" href="#/song/${encodeURIComponent(x.k)}"><span class="song-no">${x.n != null ? x.n : "♪"}</span><span class="grow"><b>${esc(x.t || first || x.k)}</b><small>${esc(first)}</small></span>${ic("chev", "chev")}</a>`; }).join("")}</div>`
    : numQ ? "" : empty(qv ? L3("Tidak ditemukan.", "Ndang dapot.", "Nothing found.") : L3("Belum ada lagu di buku ini. Lagu muncul setelah dicetak di Tata Ibadah.", "Ndang adong dope.", "No songs in this book yet. Songs appear once they are printed in a Tata Ibadah."), "book"));
}
document.addEventListener("input", (e) => { if (e.target && e.target.id === "songFind") songListPaint(LS.get("libSec", "KJ")); });
R.song = (key) => {
  key = decodeURIComponent(key || ""); const fs = LS.get("songFs", 20);
  setTimeout(async () => { await songsLoad(false); const x = (SONGS.list || []).find((y) => y.k === key); const box = document.getElementById("songBox"); if (!box) return;
    if (!x) { box.innerHTML = empty(L3("Lagu tidak ditemukan.", "Ndang dapot.", "Song not found."), "book"); return; }
    const nums = Object.keys(x.v || {}).map(Number).sort((a, b) => a - b);
    box.innerHTML = `<div class="song-head"><span class="song-book">${esc((SONG_BOOKS[x.b] || [x.b])[0])}${x.n != null ? " · " + x.n : ""}</span><h2>${esc(x.t || "")}</h2></div>
      <div class="song-text" style="font-size:${fs}px">${nums.map((n, i) => `<div class="sv"><span class="svn">${n}</span><div>${x.v[n].map((l) => `<p>${esc(l)}</p>`).join("")}</div></div>${i === 0 && (x.r || []).length ? `<div class="sv reff"><span class="svn">Reff</span><div>${x.r.map((l) => `<p>${esc(l)}</p>`).join("")}</div></div>` : ""}`).join("")}</div>
      <div class="row two" style="margin-top:14px"><button class="btn" data-act="songFs" data-d="-2">A−</button><button class="btn" data-act="songFs" data-d="2">A+</button></div>
      ${x.b === "BE" ? `<button class="btn block" data-act="songMeaning" data-k="${esc(x.k)}">🎵 ${esc(L3("Arti setiap baris", "Lapatan", "The meaning of each line"))}</button>` : ""}
      ${canSongs() ? `<button class="btn ghost block" data-act="songEdit" data-k="${esc(x.k)}">✏️ ${esc(L3("Ubah lagu ini", "Ubah", "Edit this song"))}</button>` : ""}`; }, 0);
  return shell("#/library", `<div id="songBox">${skel(3)}</div>`, { back: "#/library", title: L3("Nyanyian", "Ende", "Songs") });
};
A.songFs = (d) => { const v = Math.max(14, Math.min(40, LS.get("songFs", 20) + +d.d)); LS.set("songFs", v); const el = document.querySelector(".song-text"); if (el) el.style.fontSize = v + "px"; };
A.songMeaning = (d) => { const x = (SONGS.list || []).find((y) => y.k === d.k); if (!x) return; const nums = Object.keys(x.v || {}).map(Number).sort((a, b) => a - b);
  endeShow(`BE ${x.n} ${x.t || ""}`, nums.map((n, i) => x.v[n].join("\n") + (i === 0 && (x.r || []).length ? "\n\nReff:\n" + x.r.join("\n") : "")).join("\n\n")); };
A.songEdit = (d) => {
  const x = d.k ? (SONGS.list || []).find((y) => y.k === d.k) : null; const book = x ? x.b : d.book || "KJ";
  const text = x ? Object.keys(x.v || {}).map(Number).sort((a, b) => a - b).map((n, i) => x.v[n].join("\n") + (i === 0 && (x.r || []).length ? "\n\nReff:\n" + x.r.join("\n") : "")).join("\n\n") : "";
  sheet(x ? "✏️ " + L3("Ubah lagu", "Ubah", "Edit song") : "➕ " + L3("Tambah lagu", "Tambah", "Add a song"), `<form class="form" data-form="song" data-k="${esc(x ? x.k : "")}">
    <div class="row two"><label>${esc(L3("Buku", "Buku", "Book"))}<select name="book">${["KJ", "BE", "BN"].map((k) => `<option value="${k}"${k === book ? " selected" : ""}>${esc(SONG_BOOKS[k][0])}</option>`).join("")}</select></label>
      <label>${esc(L3("Nomor", "Nomor", "Number"))}<input name="num" inputmode="numeric" value="${x && x.n != null ? x.n : d.num || ""}"></label></div>
    <label>${esc(L3("Judul", "Judul", "Title"))}<input name="title" value="${esc(x ? x.t || "" : "")}"></label>
    <label>${esc(L3("Lirik (baris kosong = bait baru, “Reff:” untuk reff, bait dimulai dari 1)", "Lirik", "Lyrics (blank line = new verse, “Reff:” for the refrain, verses start at 1)"))}<textarea name="text" rows="12">${esc(text)}</textarea></label>
    <button class="btn primary block">${esc(t("save"))}</button>${x ? `<button type="button" class="btn danger block" data-act="songDel" data-k="${esc(x.k)}">${ic("trash")} ${esc(t("delete"))}</button>` : ""}</form>`);
};
F.song = async (f) => {
  const bl = songBlocks(f.text.value); const verses = {}; bl.verses.forEach((ls, i) => (verses[i + 1] = ls));
  const num = parseInt(f.num.value, 10); const book = f.book.value;
  if (!bl.verses.length || (!num && !f.title.value.trim())) throw new Error(L3("Isi nomor atau judul, dan liriknya.", "Isi nomor dohot lirik.", "Fill in a number or title, and the lyrics."));
  if (f.dataset.k && f.dataset.k !== `${book}:${num || norm(f.title.value).slice(0, 60)}`) await api.save("song_delete", { key: f.dataset.k }).catch(() => {});
  await api.save("songs_upsert", { songs: [{ book, num: num || null, title: f.title.value.trim(), lang: (SONG_BOOKS[book] || [])[1] || "", verses, reff: bl.reff, replace: true }] });
  closeSheet(); await songsLoad(true); toast(t("saved")); render();
};
A.songDel = async (d) => { await api.save("song_delete", { key: d.k }); closeSheet(); await songsLoad(true); location.hash = "#/library"; };
// Bible view
async function bibPaint() {
  const box = document.getElementById("bibBox"); if (!box) return;
  let ver = LS.get("bibVer", lang === "en" ? "kjv" : lang === "bt" ? "toba" : "tb"); if (!BIB_VERS[ver]) { ver = lang === "en" ? "kjv" : "tb"; LS.set("bibVer", ver); }
  const b = LS.get("bibB", 19), c = LS.get("bibC", 23), fs = LS.get("bibFs", 19);
  const kjvReady = !!(await bibCache() && await (await bibCache()).match(KJV_URL));
  box.innerHTML = `<div class="chips bib-vers">${Object.entries(BIB_VERS).map(([k, v]) => `<button class="chip${k === ver ? " on" : ""}" data-act="bibVer" data-v="${k}">${esc(v.short)}${v.kjv && !kjvReady ? " ⬇" : ""}</button>`).join("")}</div>
    <form class="bib-search" data-form="bibSearch"><input name="q" type="search" placeholder="${esc(L3("Cari ayat: Yoh 3:16, Mazmur 23, Roma 8:28-39", "Lului ayat: Joh 3:16", "Find a passage: John 3:16, Psalm 23, Romans 8:28-39"))}" autocomplete="off" enterkeyhint="search"><button class="btn primary" aria-label="${esc(t("search"))}">${ic("search")}</button></form>
    <div id="bibHit"></div>
    <div class="bib-nav"><button class="icon-btn" data-act="bibGo" data-d="-1" aria-label="${esc(L3("Pasal sebelumnya", "Na parjolo", "Previous chapter"))}">‹</button><button class="bib-ref" data-act="bibPick">${esc(bibName(ver, b))} ${c} ▾</button><button class="icon-btn" data-act="bibGo" data-d="1" aria-label="${esc(L3("Pasal berikutnya", "Na mangihut", "Next chapter"))}">›</button></div>
    <div id="bibText" class="bib-text" style="font-size:${fs}px">${skel(4)}</div>
    <div class="row" style="margin-top:12px;gap:8px"><button class="btn" data-act="bibFs" data-d="-1">A−</button><button class="btn" data-act="bibFs" data-d="1">A+</button>${speakBtn("#bibText")}</div>
    ${BIB_VERS[ver].kjv ? "" : `<div class="card bib-lib" id="bibLib"><small class="muted">${esc(L3("Menghitung pasal di Sada…", "", "Counting chapters in Sada…"))}</small></div>`}
    ${BIB_VERS[ver].kjv ? "" : `<button class="btn ghost block" data-act="bibBook">📥 ${esc(L3(`Simpan seluruh ${bibName(ver, b)} untuk offline`, "Simpan offline", `Save all of ${bibName(ver, b)} for offline`))}</button>`}
    <p class="small muted">${esc(BIB_VERS[ver].name)} · ${esc(BIB_VERS[ver].kjv ? L3("domain publik, tersimpan di HP", "", "public domain, kept on your phone") : L3("dari alkitab.sabda.org; pasal yang dibaca tersimpan untuk offline", "", "from alkitab.sabda.org; chapters you read are kept for offline"))}</p>`;
  const tx = document.getElementById("bibText");
  const hitEl = document.getElementById("bibHit"); if (hitEl && BIB.hit) hitEl.innerHTML = BIB.hit;
  if (!BIB_VERS[ver].kjv) bibLibPaint(ver);
  try { const r = await bibChapter(ver, b, c);
    if (r.need === "kjv") { tx.innerHTML = `<div class="card center pad"><p>${esc(L3("King James Version bisa diunduh sekali (± 4 MB) lalu dibaca tanpa internet.", "", "The King James Version downloads once (about 4 MB), then works without internet."))}</p><button class="btn primary" data-act="bibKjv">⬇ ${esc(L3("Unduh KJV", "Unduh KJV", "Download the KJV"))}</button></div>`; return; }
    tx.innerHTML = `<h2 class="bib-h">${esc(bibName(ver, b))} ${c}${r.offline ? ` <span class="badge">${esc(L3("offline", "offline", "offline"))}</span>` : ""}</h2>` + r.verses.map((v) => `<p><sup>${v.v}</sup>${esc(v.t)}</p>`).join("");
  } catch (e) { tx.innerHTML = `<p class="warn">${esc(L3("Pasal ini belum tersimpan dan tidak ada koneksi internet.", "Ndang tarsimpan dope.", "This chapter isn't saved yet and there's no internet."))}</p>`; }
}
A.bibVer = (d) => { LS.set("bibVer", d.v); bibPaint(); };
A.bibFs = (d) => { const v = Math.max(14, Math.min(34, LS.get("bibFs", 19) + +d.d)); LS.set("bibFs", v); const el = document.getElementById("bibText"); if (el) el.style.fontSize = v + "px"; };
A.bibGo = (d) => { BIB.hit = null; let b = LS.get("bibB", 19), c = LS.get("bibC", 23) + +d.d; if (c < 1) { b = b > 1 ? b - 1 : 66; c = BIB_CH[b - 1]; } else if (c > BIB_CH[b - 1]) { b = b < 66 ? b + 1 : 1; c = 1; } LS.set("bibB", b); LS.set("bibC", c); bibPaint(); window.scrollTo(0, 0); };
A.bibPick = () => { const ver = LS.get("bibVer", "tb");
  const grid = (from, to) => `<div class="bib-books">${BIB_ID.slice(from, to).map((_, i) => `<button class="bib-bk" data-act="bibBk" data-b="${from + i + 1}">${esc(bibName(ver, from + i + 1))}</button>`).join("")}</div>`;
  sheet(L3("Pilih kitab", "Pilih buku", "Choose a book"), `<h3 class="sec-h">${esc(L3("Perjanjian Lama", "Padan Na Robi", "Old Testament"))}</h3>${grid(0, 39)}<h3 class="sec-h">${esc(L3("Perjanjian Baru", "Padan Na Imbaru", "New Testament"))}</h3>${grid(39, 66)}`); };
A.bibBk = (d) => { const b = +d.b, ver = LS.get("bibVer", "tb");
  sheet(bibName(ver, b), `<div class="bib-chs">${Array.from({ length: BIB_CH[b - 1] }, (_, i) => `<button class="bib-ch" data-act="bibCh" data-b="${b}" data-c="${i + 1}">${i + 1}</button>`).join("")}</div>`); };
A.bibCh = (d) => { BIB.hit = null; LS.set("bibB", +d.b); LS.set("bibC", +d.c); closeSheet(); bibPaint(); window.scrollTo(0, 0); };
A.bibKjv = async (d, btn) => { try { await busy(btn, () => kjvLoad(true)); toast(L3("KJV tersimpan untuk offline.", "Tarsimpan.", "The KJV is saved for offline use.")); bibPaint(); } catch (e) { toast(L3("Gagal mengunduh. Periksa koneksi internet.", "Gagal.", "Download failed. Check the internet."), true); } };
A.bibBook = async (d, btn) => { const ver = LS.get("bibVer", "tb"), b = LS.get("bibB", 19), n = BIB_CH[b - 1]; let ok = 0; btn.disabled = true;
  for (let c = 1; c <= n; c++) { try { await bibChapter(ver, b, c); ok++; } catch (e) {} btn.textContent = `📥 ${ok} / ${n}`; }
  btn.disabled = false; toast(L3(`${bibName(ver, b)}: ${ok} dari ${n} pasal tersimpan untuk offline.`, `${ok}/${n} tarsimpan.`, `${bibName(ver, b)}: ${ok} of ${n} chapters saved for offline.`)); bibPaint(); };
try { document.head.insertAdjacentHTML("beforeend", `<style>
  nav.tabs .in { grid-template-columns: repeat(6, 1fr); } nav.tabs a span { font-size: 11px; }
  .lib-seg { margin-top: 6px; } .bib-vers { margin: 10px 0 6px; flex-wrap: wrap; }
  .bib-nav { display: flex; align-items: center; gap: 8px; margin: 8px 0 4px; } .bib-ref { flex: 1; min-height: 46px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); color: var(--ink); font-size: 17px; font-weight: 800; }
  .bib-text { line-height: 1.65; } .bib-text p { margin: 0 0 .55em; } .bib-text sup { font-size: .6em; font-weight: 800; color: var(--brand); margin-right: .3em; } .bib-h { font-size: 1.15em; margin: 10px 0 12px; }
  .bib-books { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 6px; } .bib-bk { min-height: 40px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--ink); font-size: 13.5px; font-weight: 700; padding: 4px 6px; }
  .bib-chs { display: grid; grid-template-columns: repeat(auto-fill, minmax(48px, 1fr)); gap: 6px; } .bib-ch { height: 46px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--ink); font-weight: 800; }
  .song-miss { display: grid; gap: 10px; border-left: 4px solid var(--gold); } .song-no { min-width: 44px; height: 36px; border-radius: 10px; background: var(--brand-soft); color: var(--brand); font-weight: 900; display: grid; place-items: center; flex: none; }
  .song-head { margin: 8px 0 12px; } .song-book { font-size: 12.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--brand); } .song-head h2 { margin: 2px 0 0; font-size: 24px; }
  .song-text .sv { display: flex; gap: 14px; margin: 0 0 18px; } .song-text .svn { min-width: 30px; font-weight: 900; color: var(--brand); font-size: .9em; padding-top: .1em; }
  .song-text .sv p { margin: 0; line-height: 1.45; } .song-text .reff { background: var(--brand-soft); border-radius: 14px; padding: 12px 14px; } .song-text .reff .svn { font-size: .7em; letter-spacing: .1em; text-transform: uppercase; }
  @media (min-width: 900px) { .bib-text, .song-text { max-width: 780px; } }
</style>`); } catch (e) {}

// ---------- Access & views (YB 2026-10-30, Yosafat only) ----------
// Every category, service section and office with its members and their roles; tap 👁 to see Sada exactly as that member does
// (the server sends their real data). While viewing, nothing can be saved; the banner's Keluar returns to your own view.
const VIEWAS = { on: false, orig: null, api: null, data: null, name: "" };
const ROLE_NAMES = { chair: "Ketua", maker: "Maker", tmaker: "Teacher Maker", teacher: "Guru", ychair: "Ketua", ytreasurer: "Bendahara", ysecretary: "Sekretaris", member: "Anggota" };
const KIND_NAMES = { sermon: ["Kategorial", "Kategorial", "Categories"], service: ["Seksi pelayanan", "Seksi", "Service sections"], office: ["Kantor / jabatan", "Jabatan", "Offices"] };
R.access = () => {
  if (!isYB()) { location.replace("#/more"); return ""; }
  const people = (D.people || []).slice().sort((a, b) => a.name.localeCompare(b.name));
  const roleOrder = (r) => ["chair", "ychair", "maker", "tmaker", "ytreasurer", "ysecretary", "teacher", "member"].indexOf(r) + 1 || 9;
  const row = (p, r) => `<div class="li acc-p" data-n="${esc(norm(p.name + " " + (p.alias || "")))}">${avatarOf(p)}<span class="grow"><b>${esc(p.name)}</b>${r ? `<small><span class="badge${r !== "member" ? " gold" : ""}">${esc(ROLE_NAMES[r] || r)}</span></small>` : ""}</span><button class="icon-btn" data-act="viewAs" data-id="${p.id}" aria-label="${esc(L3("Lihat sebagai", "Ida songon", "View as"))} ${esc(p.name)}">👁</button></div>`;
  const kinds = ["sermon", "service", "office"].map((k) => {
    const gs = (D.groups || []).filter((g) => g.kind === k); if (!gs.length) return "";
    return `<h3 class="sec-h">${esc(L3(...KIND_NAMES[k]))}</h3><div class="acc-grid">${gs.map((g) => {
      const ms = people.filter((p) => g.id in (p.groups || {})).sort((a, b) => roleOrder(a.groups[g.id]) - roleOrder(b.groups[g.id]) || a.name.localeCompare(b.name));
      const lead = ms.filter((p) => p.groups[g.id] !== "member").length;
      return `<details class="card acc-g" style="--gc:${g.color || "var(--brand)"}"><summary>${gIcon(g)}<span class="grow"><b>${esc(gname(g))}</b><small>${ms.length} ${esc(L3("anggota", "ruas", "members"))} · ${lead} ${esc(L3("pengurus/maker", "pengurus", "leaders/makers"))}</small></span></summary>
        ${ms.length ? ms.map((p) => row(p, p.groups[g.id])).join("") : `<p class="muted small">${esc(L3("Belum ada anggota.", "Ndang adong.", "No members yet."))}</p>`}</details>`; }).join("")}</div>`;
  }).join("");
  const none = people.filter((p) => !Object.keys(p.groups || {}).length);
  return shell("#/more", `<h2 class="page-h">🔐 ${esc(L3("Akses & tampilan", "Akses", "Access & views"))}</h2>
    <p class="lead">${esc(L3("Buka kategori atau seksi untuk melihat siapa anggotanya dan perannya. Ketuk 👁 untuk melihat Sada persis seperti yang dilihat anggota itu (data aslinya dari server). Selama melihat, tidak ada yang bisa disimpan.", "Ida songon ruas.", "Open a category or section to see its members and roles. Tap 👁 to see Sada exactly as that member sees it (their real data from the server). While viewing, nothing can be saved."))}</p>
    <input type="search" id="accFind" placeholder="${esc(L3("Cari anggota…", "Lului…", "Find a member…"))}" autocomplete="off">
    <div class="card acc-hits" id="accHits" hidden></div>
    ${kinds}
    ${none.length ? `<h3 class="sec-h">${esc(L3("Tanpa kategori", "Ndang adong", "In no group"))}</h3><div class="card">${none.map((p) => row(p, "")).join("")}</div>` : ""}`,
    { back: "#/more", title: L3("Akses & tampilan", "Akses", "Access & views") });
};
document.addEventListener("input", (e) => { if (!e.target || e.target.id !== "accFind") return; const q = norm(e.target.value); const box = document.getElementById("accHits"); if (!box) return;
  if (!q) { box.hidden = true; box.innerHTML = ""; return; }
  const seen = new Set(); const hits = [...document.querySelectorAll(".acc-g .acc-p, .acc-p")].filter((el) => el.dataset.n.includes(q) && !seen.has(el.querySelector("[data-act=viewAs]").dataset.id) && seen.add(el.querySelector("[data-act=viewAs]").dataset.id));
  box.hidden = false; box.innerHTML = hits.slice(0, 12).map((el) => el.outerHTML).join("") || `<p class="muted small">–</p>`; });
A.viewAs = async (d, btn) => {
  try {
    const real = VIEWAS.on ? VIEWAS.api : api;
    const data = await busy(btn, () => real.save("view_as", { member_id: d.id }));
    if (!data || !data.me) throw new Error("not_found");
    if (!VIEWAS.on) { VIEWAS.orig = D; VIEWAS.api = api; }
    VIEWAS.on = true; VIEWAS.data = data; VIEWAS.name = data.me.name;
    const readOnly = new Set(["save", "del", "pushSave", "setPassword", "membersUpsert", "settingsSave", "logout", "upload", "rosterSave"]);
    api = new Proxy(VIEWAS.api, { get(t, k) {
      if (k === "data") return () => Promise.resolve(VIEWAS.data);
      if (k === "ping") return () => Promise.resolve();
      if (k === "save") return (kind, body) => (["chat_list", "ss_html", "ai_get"].includes(kind) ? t.save(kind, body) : Promise.reject(Object.assign(new Error(L3("Mode lihat saja: perubahan tidak dapat disimpan.", "Ida sambing.", "View-only: nothing can be saved.")), { viewOnly: true })));
      if (readOnly.has(k)) return () => Promise.reject(Object.assign(new Error(L3("Mode lihat saja: perubahan tidak dapat disimpan.", "Ida sambing.", "View-only: nothing can be saved.")), { viewOnly: true }));
      const v = t[k]; return typeof v === "function" ? v.bind(t) : v; } });
    D = data; viewAsBar(); closeSheet(); location.hash = "#/home"; render();
  } catch (e) { toast(e.message || errMsg(e), true); }
};
A.viewAsExit = () => { if (!VIEWAS.on) return; api = VIEWAS.api; D = VIEWAS.orig; Object.assign(VIEWAS, { on: false, orig: null, api: null, data: null, name: "" }); viewAsBar(); location.hash = "#/access"; render(); refresh().then(render).catch(() => {}); };
function viewAsBar() {
  let el = document.getElementById("viewAsBar");
  if (!VIEWAS.on) { if (el) el.remove(); document.body.classList.remove("viewing-as"); return; }
  if (!el) { el = document.createElement("div"); el.id = "viewAsBar"; document.body.appendChild(el); }
  document.body.classList.add("viewing-as");
  el.innerHTML = `<span>👁 ${esc(L3("Melihat sebagai", "Ida songon", "Viewing as"))} <b>${esc(VIEWAS.name)}</b></span><button data-act="viewAsExit">${esc(L3("Keluar", "Kaluar", "Exit"))}</button>`;
}
try { document.head.insertAdjacentHTML("beforeend", `<style>
  .acc-grid { display: grid; gap: 10px; } @media (min-width: 900px) { .acc-grid { grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); align-items: start; } }
  .acc-g { padding: 0; overflow: hidden; border-left: 5px solid var(--gc); } .acc-g summary { display: flex; align-items: center; gap: 12px; padding: 14px 16px; cursor: pointer; list-style: none; }
  .acc-g summary::-webkit-details-marker { display: none; } .acc-g summary small { display: block; color: var(--muted); } .acc-g > .li, .acc-g > p { padding-left: 16px; padding-right: 16px; }
  .acc-g .gicon { width: 38px; height: 38px; border-radius: 12px; background: var(--gc); color: #fff; display: grid; place-items: center; flex: none; }
  #accFind { margin: 4px 0 10px; } .acc-hits { margin-bottom: 12px; }
  #viewAsBar { position: fixed; left: 50%; transform: translateX(-50%); top: max(8px, env(safe-area-inset-top)); z-index: 190; display: flex; align-items: center; gap: 12px; background: #b45309; color: #fff; border-radius: 999px; padding: 8px 8px 8px 16px; font-size: 14px; box-shadow: 0 8px 24px rgba(0, 0, 0, .3); max-width: calc(100vw - 24px); }
  #viewAsBar span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } #viewAsBar button { border: 0; border-radius: 999px; background: #fff; color: #b45309; font-weight: 800; padding: 6px 14px; flex: none; }
  body.viewing-as header.top { padding-top: calc(48px + env(safe-area-inset-top)); }
</style>`); } catch (e) {}
try { document.head.insertAdjacentHTML("beforeend", `<style>
  .cat-links { margin-top: 16px; } .cat-link { display: grid; gap: 2px; padding: 14px 16px; text-decoration: none; color: inherit; border-left: 4px solid var(--gc, var(--brand)); margin: 0; }
  .cat-link b { font-size: 15.5px; } .cat-link small { color: var(--muted); font-size: 12.5px; line-height: 1.3; }
</style>`); } catch (e) {}

// Push notifications are required in the installed app (YB 2026-10-30). Installed Sada (Home Screen / desktop app) without
// notifications allowed shows only this screen: one big button to turn them on. If they were blocked, how to switch them back on.
// It checks again whenever Sada comes back to the front, so it disappears by itself once notifications are on.
// (Sada in an ordinary browser tab is not blocked; on iPhone, notifications only exist in the installed app.)
const pushGateOn = () => standalone() && "Notification" in window && Notification.permission !== "granted";
function pushGate() {
  let el = document.getElementById("pushGate");
  if (!pushGateOn()) { if (el) { el.remove(); document.body.classList.remove("gated-push"); } return; }
  const denied = Notification.permission === "denied";
  const html = `<div class="pg-card"><img class="pg-logo" src="icon-192.png" alt="" onerror="this.remove()">
    <h1>${esc(L3("Nyalakan notifikasi", "Pasangkon notifikasi", "Turn on notifications"))}</h1>
    <p>${esc(L3("Sada HKBPS memakai notifikasi untuk jadwal pelayanan, renungan harian, ulang tahun, rapat dan chat. Nyalakan untuk memakai aplikasi.", "Sada mamakke notifikasi. Pasangkon asa boi mamakke.", "Sada HKBPS uses notifications for service duties, daily devotions, birthdays, meetings and chat. Turn them on to use the app."))}</p>
    ${denied ? `<div class="pg-steps"><b>${esc(L3("Notifikasi sedang diblokir. Nyalakan di sini:", "Diblokir. Pasangkon di:", "Notifications are blocked. Turn them on here:"))}</b>
        <p><b>iPhone:</b> ${esc(L3("Pengaturan → Notifikasi → Sada HKBPS → Izinkan Notifikasi", "Pengaturan → Notifikasi → Sada HKBPS", "Settings → Notifications → Sada HKBPS → Allow Notifications"))}</p>
        <p><b>Android:</b> ${esc(L3("Pengaturan → Aplikasi → Sada HKBPS → Notifikasi → Izinkan", "Pengaturan → Aplikasi → Sada HKBPS", "Settings → Apps → Sada HKBPS → Notifications → Allow"))}</p>
        <p><b>${esc(L3("Komputer", "Komputer", "Computer"))}:</b> ${esc(L3("ikon gembok di samping alamat → Notifikasi → Izinkan", "gembok → Notifikasi", "lock icon next to the address → Notifications → Allow"))}</p></div>
      <button class="pg-btn" data-act="pushGateCheck">${esc(L3("Sudah, periksa lagi", "Nunga, ida muse", "Done, check again"))}</button>`
      : `<button class="pg-btn" data-act="pushGateOn">🔔 ${esc(L3("Nyalakan notifikasi", "Pasangkon notifikasi", "Turn on notifications"))}</button>`}</div>`;
  if (!el) { el = document.createElement("div"); el.id = "pushGate"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); document.body.appendChild(el); document.body.classList.add("gated-push"); }
  if (el.dataset.state !== (denied ? "denied" : "default") + lang) { el.dataset.state = (denied ? "denied" : "default") + lang; el.innerHTML = html; }
}
A.pushGateOn = async (d, btn) => { btn.disabled = true; try { await enableNotifications(btn); } finally { btn.disabled = false; } pushGate(); };
A.pushGateCheck = () => { pushGate(); if (pushGateOn()) toast(L3("Notifikasi masih mati.", "Ndang hidup dope.", "Notifications are still off."), true); };
document.addEventListener("visibilitychange", () => { if (!document.hidden) pushGate(); });
setInterval(pushGate, 3000); setTimeout(pushGate, 300);
try { document.head.insertAdjacentHTML("beforeend", `<style>
  #pushGate { position: fixed; inset: 0; z-index: 200; display: grid; place-items: center; padding: max(24px, env(safe-area-inset-top)) 22px max(24px, env(safe-area-inset-bottom)); background: linear-gradient(160deg, var(--brand), #0b1022); color: #fff; overflow-y: auto; }
  .pg-card { width: 100%; max-width: 440px; text-align: center; display: grid; gap: 14px; justify-items: center; }
  .pg-logo { width: 84px; height: 84px; border-radius: 22px; background: #fff; box-shadow: 0 10px 30px rgba(0, 0, 0, .3); }
  #pushGate h1 { font-size: 28px; line-height: 1.15; margin: 4px 0 0; } #pushGate p { margin: 0; line-height: 1.45; opacity: .92; }
  .pg-btn { width: 100%; min-height: 64px; border: 0; border-radius: 20px; background: #fff; color: var(--brand); font-size: 20px; font-weight: 900; box-shadow: 0 12px 30px rgba(0, 0, 0, .3); margin-top: 6px; }
  .pg-btn:disabled { opacity: .7; }
  .pg-steps { text-align: left; background: rgba(255, 255, 255, .12); border-radius: 16px; padding: 14px 16px; display: grid; gap: 6px; font-size: 14.5px; width: 100%; }
  body.gated-push { overflow: hidden; }
</style>`); } catch (e) {}

// Notifications on for everyone (YB 2026-10-30). Phones only allow notifications after the person taps "Allow", so:
// once allowed, the app keeps them on by itself (ensurePush on every open); not decided yet, a one-tap request on opening,
// at most once a day; on an iPhone in Safari, a reminder to add Sada to the Home Screen first (once a day);
// blocked, how to switch them back on in Settings (once a week).
function notifyNeeded() {
  if (!D || isGuest() || api.mode !== "remote" || pushGateOn()) return false;
  const ios = /iP(hone|ad)/.test(navigator.userAgent);
  if (!("Notification" in window)) return ios && !standalone() && LS.get("notifyAskedDay") !== today();
  if (Notification.permission === "granted") return false;
  if (Notification.permission === "denied") return Date.now() - (LS.get("notifyDeniedAt", 0) || 0) > 7 * 864e5;
  return LS.get("notifyAskedDay") !== today();
}
function notifyPrompt() {
  const ios = /iP(hone|ad)/.test(navigator.userAgent);
  if (!("Notification" in window)) { LS.set("notifyAskedDay", today());
    return sheet("🔔 " + L3("Pasang Sada di HP", "Pasang Sada", "Install Sada on your phone"), `<p>${esc(L3("Agar dapat menerima notifikasi (jadwal pelayanan, renungan, ulang tahun, chat), pasang Sada di Layar Utama:", "Asa dapot notifikasi, pasang Sada:", "To get notifications (duties, devotions, birthdays, chat), add Sada to your Home Screen:"))}</p>
      <ol class="small"><li>${esc(L3("Ketuk tombol Bagikan (kotak dengan panah) di Safari", "Ketuk Bagikan", "Tap the Share button (square with an arrow) in Safari"))}</li><li>${esc(L3("Pilih “Tambahkan ke Layar Utama”", "Pilih “Add to Home Screen”", "Choose “Add to Home Screen”"))}</li><li>${esc(L3("Buka Sada dari ikon baru itu dan izinkan notifikasi", "Bukka sian ikon", "Open Sada from the new icon and allow notifications"))}</li></ol>
      <button class="btn primary block" data-act="closeSheet">${esc(L3("Mengerti", "Olo", "Got it"))}</button>`); }
  if (Notification.permission === "denied") { LS.set("notifyDeniedAt", Date.now());
    return sheet("🔕 " + L3("Notifikasi diblokir", "Notifikasi diblokir", "Notifications are blocked"), `<p>${esc(L3("Anda tidak akan menerima jadwal pelayanan, renungan dan pengumuman. Untuk menyalakannya lagi:", "Asa dipasangkon muse:", "You won't get duty reminders, devotions or announcements. To switch them back on:"))}</p>
      <p class="small"><b>iPhone:</b> ${esc(L3("Pengaturan → Notifikasi → Sada HKBPS → Izinkan Notifikasi", "Pengaturan → Notifikasi → Sada HKBPS", "Settings → Notifications → Sada HKBPS → Allow Notifications"))}<br><b>Android / ${esc(L3("komputer", "komputer", "computer"))}:</b> ${esc(L3("ketuk ikon gembok di samping alamat situs → Notifikasi → Izinkan", "gembok → Notifikasi → Izinkan", "tap the lock icon next to the address → Notifications → Allow"))}</p>
      <button class="btn primary block" data-act="closeSheet">${esc(L3("Mengerti", "Olo", "Got it"))}</button>`); }
  LS.set("notifyAskedDay", today());
  sheet("🔔 " + t("notifyAskTitle"), `<p class="muted">${esc(t("notifyAskBody"))}</p><button class="btn primary block" data-act="notifyNow">${ic("bell")} ${esc(L3("Nyalakan notifikasi", "Pasangkon notifikasi", "Turn on notifications"))}</button>
    <button class="btn ghost block" data-act="closeSheet">${esc(L3("Nanti saja", "Annon", "Later"))}</button>`);
}

// ---------- Computer layout (YB 2026-10-30) ----------
// From 900px wide Sada uses the side rail (index.html). These rules make the pages use a computer screen well: a wider centred page,
// cards and tiles in columns, chat in a centred column, the Sunday School workbench with a live preview beside the editor.
// Phones are not affected.
try { document.head.insertAdjacentHTML("beforeend", `<style>
  @media (min-width: 900px) {
    #view { max-width: 1180px; margin-left: calc(84px + env(safe-area-inset-left) + max(0px, (100vw - 84px - 1180px) / 2)); margin-right: auto; padding-left: 28px; padding-right: 28px; }
    body { font-size: 16px; }
    .page-h { font-size: 30px; }
    .lead { max-width: 760px; }
    .glist { grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 12px; }
    .gcards { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
    .gcards > * { margin: 0 !important; }
    .rr-list { grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); }
    .seg, .sched-seg { max-width: 640px; }
    .search-top, .search-entry { max-width: 760px; }
    .ghero { border-radius: 26px; }
    .card.meet, .card.prayer, .card.grief, .card.wishes { max-width: 900px; }
    .fx-card { max-width: 640px; } .fx-chips { flex-wrap: wrap; overflow: visible; } #fxList { max-width: 640px; }
    .chat { max-width: 860px; margin: 0 auto; padding-bottom: 110px; }
    .ch-online { max-width: 860px; margin-left: auto; margin-right: auto; }
    .ch-bar { left: calc(84px + env(safe-area-inset-left)); bottom: 0; padding-bottom: calc(12px + env(safe-area-inset-bottom)); }
    .ch-bar > * { width: 100%; max-width: 860px; margin-left: auto; margin-right: auto; }
    .live-body { max-width: 1000px; margin: 0 auto; }
    .tata-frame, #ssBox iframe { max-height: calc(100vh - 220px); }
    .sheet-card { max-width: 720px; }
    .nowcard { max-width: 760px; }
    .tbl-wrap { max-width: 100%; }
  }
  @media (min-width: 1100px) {
    .ssw-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); gap: 24px; align-items: start; }
    .ssw-live { position: sticky; top: 76px; }
    .ssw-edit .sticky-actions { position: static; }
  }
  @media (max-width: 1099px) { .ssw-live { display: none; } }
</style>`); } catch (e) {}


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
      : empty(L3("Belum ada slide Sekolah Minggu.", "Ndang adong.", "No Sunday School slides yet."), "screen")}`;
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
  setTimeout(() => sswLive(true), 0);
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
    ${secs ? `<div class="ssw-grid"><div class="ssw-edit">${secs.map(field).join("")}
      <div class="row two"><select id="sswAdd">${typeOpt("song")}</select><button class="btn" data-act="sswAdd">${ic("plus")} ${esc(L3("Tambah bagian", "Tambah", "Add section"))}</button></div>
      <div class="row two sticky-actions"><button class="btn" data-act="sswPreview">👁 ${esc(L3("Pratinjau", "Ida", "Preview"))}</button><button class="btn primary" data-act="sswPublish">🚀 ${esc(L3("Terbitkan", "Terbitkan", "Publish"))}</button></div></div><aside class="ssw-live"><p class="small muted">👁 ${esc(L3("Pratinjau langsung", "Pratinjau", "Live preview"))} · ${esc(L3("klik slide atau gunakan panah", "", "click the slide or use the arrows"))}</p><div id="sswLive"></div></aside></div>`
      : `<button class="btn block" data-act="sswBlank">${esc(L3("Atau mulai dari template kosong", "Template kosong", "Or start from an empty template"))}</button>`}`,
    { back: "#/g/sekolah-minggu?tab=slides", title: L3("Workbench Sekolah Minggu", "Workbench", "Sunday School workbench"), sub: SS_LANGS[SSW.lang] });
};
const sswRe = () => { ssSave(); const y = window.scrollY; render(); setTimeout(() => { window.scrollTo(0, y); sswLive(true); }, 0); };
// Live preview beside the editor on a computer (wide screens only); it redraws a moment after you stop typing.
let SSW_T = null;
function sswLive(now) {
  clearTimeout(SSW_T);
  SSW_T = setTimeout(() => { const box = document.getElementById("sswLive"); if (!box || !SSW.secs || !matchMedia("(min-width: 1100px)").matches) return;
    const f = tataIframe(ssRender(SSW.lang, SSW.day, SSW.secs)); f.style.cssText = "width:100%;aspect-ratio:16/9;border:0;border-radius:14px;background:#0b1022;box-shadow:var(--shadow)"; box.innerHTML = ""; box.appendChild(f); }, now ? 50 : 700);
}
A.sswLang = (d) => { SSW.lang = d.l; LS.set("sswLang", d.l); const dr = LS.get(ssKey(), null); SSW.secs = dr && dr.secs ? dr.secs : null; render(); };
A.sswBlank = () => { SSW.secs = ssTemplate(SSW.lang); sswRe(); };
A.sswAdd = () => { const tp = (document.getElementById("sswAdd") || {}).value || "song"; SSW.secs.push({ type: tp, title: SS_NAMES[SSW.lang][tp], extra: "", body: "" }); sswRe(); };
A.sswDel = (d) => { SSW.secs.splice(+d.i, 1); sswRe(); };
A.sswMove = (d) => { const i = +d.i, j = i + +d.d; if (j < 0 || j >= SSW.secs.length) return; [SSW.secs[i], SSW.secs[j]] = [SSW.secs[j], SSW.secs[i]]; sswRe(); };
A.sswImg = (d) => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.multiple = true;
  inp.onchange = async () => { const sec = SSW.secs[+d.i]; sec.images = sec.images || []; for (const f of inp.files) { try { sec.images.push(await resizeImage(f, 1600, 0.8)); } catch (e) {} } sswRe(); }; inp.click(); };
A.sswImgDel = (d) => { const sec = SSW.secs[+d.i]; (sec.images || []).splice(+d.k, 1); sswRe(); };
document.addEventListener("input", (e) => { const el = e.target; if (!el || !el.classList) return;
  if (el.classList.contains("ssw-in") && SSW.secs) { SSW.secs[+el.dataset.i][el.dataset.k] = el.value; ssSave(); sswLive(false); }
  if (el.id === "sswDay" && el.value) { SSW.day = el.value; } });
document.addEventListener("change", (e) => { const el = e.target; if (el && el.classList && el.classList.contains("ssw-type") && SSW.secs) { SSW.secs[+el.dataset.i].type = el.value; sswRe(); } });
A.sswImport = async (d, btn) => {
  try {
    if (d.src === "sada") {
      const prev = (D.ss_decks || []).find((x) => x.lang === SSW.lang); if (!prev) throw new Error(L3("Belum ada slide Sada dalam bahasa ini.", "Ndang adong.", "No Sada deck in this language yet."));
      const r = await busy(btn, () => api.save("ss_html", { deck_id: prev.id })); if (!r || !r.sections) throw new Error("no_sections");
      SSW.secs = r.sections.map((x) => ({ ...x }));
    } else {
      const ls = await busy(btn, () => ssCall({ op: "list" }));
      const when = (n) => { const m = String(n).match(/(\d{1,2})\s*([A-Za-z]+)\s*(\d{4})/); if (!m) return ""; const mi = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(m[2].slice(0, 3).toLowerCase()); return mi < 0 ? "" : `${m[3]}-${String(mi + 1).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`; };
      const deck = (ls.decks || []).filter((x) => x.lang === SSW.lang && !/^copy of/i.test(x.name)).map((x) => ({ ...x, d: when(x.name) })).sort((a, b) => b.d.localeCompare(a.d))[0];
      if (!deck) throw new Error(L3("Tidak ada deck bahasa ini di folder Drive.", "Ndang adong.", "No deck in this language in the Drive folder."));
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
  fit("fxOut"); fit("fxAmt"); set("fxRate", isFinite(rate) ? `1 ${from} = ${fxFmt(rate, to)} ${to}` : L3("Kurs belum tersedia. Periksa koneksi internet.", "Kurs ndang adong dope.", "Rates not available yet, check the internet."));
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
  sheet("✏️ " + L3("Pesan baru", "Pesan baru", "New message"), `<input type="search" id="dmFind" placeholder="${esc(L3("Cari nama…", "Lului goar…", "Search a name…"))}" autocomplete="off" style="margin-bottom:8px">
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

// ---------- Video and voice calls from Chat (YB 2026-10-31) ----------
// 📹 and 📞 in a chat's header. In a private chat it rings the other person (a push, and a ringing screen while
// Sada is open); in the Makers or Everyone room it starts a group call (up to 8 people) that others join from the bar.
// The phones send video straight to each other (WebRTC, works in Safari on iPhone and Chrome on Android);
// the server (hk_call in backend/sql/hk_call.sql) only passes the connection notes and keeps who is in the call.
const CALL_SVG = {
  video: '<rect x="2.5" y="6" width="13" height="12" rx="3"/><path d="M15.5 10.5 21 7.5v9l-5.5-3"/>',
  voice: '<path d="M5 3.5h3.2l1.6 4.2-2.2 1.5a11 11 0 0 0 5.2 5.2l1.5-2.2 4.2 1.6V17a3 3 0 0 1-3.3 3A16.5 16.5 0 0 1 2 7.3 3 3 0 0 1 5 3.5z"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  micoff: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M3 3l18 18"/>',
  camoff: '<rect x="2.5" y="6" width="13" height="12" rx="3"/><path d="M15.5 10.5 21 7.5v9l-5.5-3M2 2l20 20"/>',
  flip: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><path d="M9 12.5a3 3 0 0 1 5.2-2M15 13.5a3 3 0 0 1-5.2 2M14.5 8.5v2h-2M9.5 17.5v-2h2"/>',
  end: '<path d="M2.5 13.5c5.4-4.6 13.6-4.6 19 0l-2.3 2.8-3.7-1.4v-2.6a10 10 0 0 0-7 0v2.6l-3.7 1.4z"/>',
};
const cic = (n) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CALL_SVG[n]}</svg>`;
let CALL_SRV = null;   // false while the server has no hk_call yet: the buttons stay hidden
const callOk = () => CALL_SRV !== false && !!D && !isGuest() && api.mode === "remote" && !!api.call && !!window.RTCPeerConnection && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
const callRoomOf = () => { const m = location.hash.match(/^#\/chat\/((dm:[0-9a-f-]{36}:[0-9a-f-]{36})|makers|all|g:[\w-]+)(?:$|[?/])/); return m ? m[1] : null; };
let CALL = null;       // the call this phone is in
let RING = null;       // an incoming call on screen: { id, room, name, caller_id, video, group }
const RING_SKIP = new Set();   // calls this phone already declined or answered
let CALL_LIVE = [];    // group calls going on in rooms I can see
// In a chat room's header (shell): voice and video buttons.
function callHead() {
  const room = callRoomOf(); if (!room || !callOk()) return "";
  return `<span class="call-hd"><button class="icon-btn" data-act="callStart" data-room="${esc(room)}" data-video="0" aria-label="${esc(L3("Telepon suara", "Telepon suara", "Voice call"))}">${cic("voice")}</button><button class="icon-btn" data-act="callStart" data-room="${esc(room)}" data-video="1" aria-label="${esc(L3("Panggilan video", "Telepon video", "Video call"))}">${cic("video")}</button></span>`;
}
const callPerson = (id, name) => (D.people || []).find((p) => p.id === id) || { id, name };
const callErr = (e) => {
  const n = e && e.name; const c = (e && (e.code || e.message)) || "";
  if (n === "NotAllowedError" || n === "SecurityError") return L3("Izinkan kamera dan mikrofon untuk Sada (Pengaturan HP › Sada / Safari / Chrome), lalu coba lagi.", "Loas kamera dohot mikrofon tu Sada, jala coba muse.", "Allow the camera and microphone for Sada (phone Settings › Sada / Safari / Chrome), then try again.");
  if (n === "NotFoundError" || n === "NotReadableError") return L3("Kamera atau mikrofon tidak dapat dipakai. Tutup aplikasi lain yang memakainya.", "Kamera manang mikrofon ndang boi dipangke.", "The camera or microphone can't be used. Close other apps that use it.");
  if (/call_ended/.test(c)) return L3("Panggilan sudah berakhir.", "Nunga sae telepon i.", "The call has ended.");
  if (/call_full/.test(c)) return L3("Panggilan penuh (maks. 8 orang).", "Nunga gok (8 halak).", "The call is full (8 people at most).");
  if (/too_fast/.test(c)) return L3("Terlalu cepat, tunggu sebentar.", "Hatop hian, paima jolo.", "Too fast, wait a moment.");
  return errMsg(e);
};

// ---- sounds: a soft ring for incoming calls, a ringback tone while calling ----
let callAC = null;
function callTone(kind) {
  callToneStop();
  try {
    callAC = callAC || new (window.AudioContext || window.webkitAudioContext)(); if (callAC.state === "suspended") callAC.resume().catch(() => {});
    const beep = () => { if (!callAC) return; const o = callAC.createOscillator(), g = callAC.createGain(); o.connect(g); g.connect(callAC.destination);
      const t0 = callAC.currentTime; o.frequency.value = kind === "ring" ? 880 : 440; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(kind === "ring" ? 0.18 : 0.08, t0 + 0.03);
      g.gain.setValueAtTime(kind === "ring" ? 0.18 : 0.08, t0 + (kind === "ring" ? 0.9 : 1.2)); g.gain.linearRampToValueAtTime(0, t0 + (kind === "ring" ? 1 : 1.3)); o.start(t0); o.stop(t0 + 1.4); };
    beep(); callTone.h = setInterval(beep, kind === "ring" ? 2200 : 3500);
  } catch (e) {}
  if (kind === "ring" && navigator.vibrate) { try { navigator.vibrate([700, 500, 700]); callTone.v = setInterval(() => navigator.vibrate([700, 500, 700]), 2200); } catch (e) {} }
}
function callToneStop() { clearInterval(callTone.h); clearInterval(callTone.v); callTone.h = callTone.v = null; try { navigator.vibrate && navigator.vibrate(0); } catch (e) {} }

// ---- the call screen ----
function callLayer() {
  let el = document.getElementById("callUi");
  if (!el) { el = document.createElement("div"); el.id = "callUi"; el.className = "call-ui"; document.body.appendChild(el); }
  return el;
}
function callPaint() {
  const el = callLayer();
  if (RING && !CALL) {
    const p = callPerson(RING.caller_id, RING.name);
    el.hidden = false; el.className = "call-ui ringing";
    el.innerHTML = `<div class="call-ring"><div class="call-av">${avatarOf(p, "xl")}</div><b class="call-name">${esc(RING.group ? (RING.title || "") : p.name)}</b>
      <small>${esc(RING.group ? L3("Panggilan grup sedang berlangsung", "Telepon grup tengah masa", "Group call going on") + (RING.names ? " · " + RING.names : "") : RING.video ? L3("Panggilan video masuk…", "Telepon video ro…", "Incoming video call…") : L3("Panggilan suara masuk…", "Telepon suara ro…", "Incoming voice call…"))}</small>
      <div class="call-ans"><button class="call-btn end" data-act="callDecline" aria-label="${esc(L3("Tolak", "Tolak", "Decline"))}">${cic("end")}<span>${esc(RING.group ? L3("Nanti", "Annon", "Not now") : L3("Tolak", "Tolak", "Decline"))}</span></button>
      <button class="call-btn ok" data-act="callAnswer" aria-label="${esc(L3("Jawab", "Alusi", "Answer"))}">${cic(RING.video ? "video" : "voice")}<span>${esc(RING.group ? L3("Gabung", "Masuk", "Join") : L3("Jawab", "Alusi", "Answer"))}</span></button></div></div>`;
    return;
  }
  if (!CALL) { el.hidden = true; el.innerHTML = ""; return; }
  el.hidden = false; el.className = "call-ui" + (CALL.min ? " min" : "") + (CALL.video ? "" : " audio");
  const peers = Object.entries(CALL.pcs);
  const title = CALL.dm ? callPerson(CALL.dm, CALL.dmName).name : CALL.title;
  const status = CALL.status || (peers.length ? "" : CALL.dm ? (CALL.answered ? L3("Menyambungkan…", "Manyambung…", "Connecting…") : L3("Memanggil…", "Mamio…", "Calling…")) : L3("Menunggu yang lain bergabung…", "Mamaima na asing…", "Waiting for others to join…"));
  el.innerHTML = `<div class="call-top"><button class="icon-btn" data-act="callMin" aria-label="${esc(L3("Kecilkan", "Kecilhon", "Minimise"))}">${ic("back")}</button><span class="grow"><b>${esc(title)}</b><small id="callStat">${esc(status || callClock())}</small></span></div>
    <div class="call-grid n${Math.min(peers.length, 8)}" id="callGrid"></div>
    ${CALL.video ? `<video id="callMe" class="call-me${CALL.camOff ? " off" : ""}${CALL.facing === "environment" ? " back" : ""}" autoplay playsinline muted></video>` : ""}
    <div class="call-bar"><button class="call-btn${CALL.muted ? " on" : ""}" data-act="callMute" aria-label="${esc(L3("Bisukan", "Bisuhon", "Mute"))}">${cic(CALL.muted ? "micoff" : "mic")}</button>
      ${CALL.video ? `<button class="call-btn${CALL.camOff ? " on" : ""}" data-act="callCam" aria-label="${esc(L3("Kamera", "Kamera", "Camera"))}">${cic(CALL.camOff ? "camoff" : "video")}</button><button class="call-btn" data-act="callFlip" aria-label="${esc(L3("Balik kamera", "Balik kamera", "Flip camera"))}">${cic("flip")}</button>` : ""}
      <button class="call-btn end" data-act="callEnd" aria-label="${esc(L3("Akhiri", "Sae", "End call"))}">${cic("end")}</button></div>
    <button class="call-pill" data-act="callMax">${cic(CALL.video ? "video" : "voice")} <span>${esc(title)}</span> <b id="callPillT">${esc(callClock())}</b></button>`;
  const grid = el.querySelector("#callGrid");
  if (!peers.length) grid.innerHTML = `<div class="call-wait">${CALL.dm ? avatarOf(callPerson(CALL.dm, CALL.dmName), "xl") : `<span class="call-wait-ic">${cic(CALL.video ? "video" : "voice")}</span>`}</div>`;
  for (const [, x] of peers) { grid.appendChild(x.tile); const v = x.tile.querySelector("video"); if (v.srcObject) v.play().catch(() => {}); }
  const me = el.querySelector("#callMe"); if (me && CALL.local) { me.srcObject = CALL.local; me.play().catch(() => {}); }
}
function callClock() { if (!CALL || !CALL.t0) return ""; const s = Math.floor((Date.now() - CALL.t0) / 1000); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
setInterval(() => { if (!CALL || !CALL.t0) return; const a = document.getElementById("callStat"), b = document.getElementById("callPillT"); if (a && !CALL.status) a.textContent = callClock(); if (b) b.textContent = callClock(); }, 1000);
function callTile(id, name) {
  const t0 = document.createElement("div"); t0.className = "call-tile wait";
  const p = callPerson(id, name);
  t0.innerHTML = `<video autoplay playsinline></video><span class="call-tav">${avatarOf(p, "xl")}</span><span class="call-tname">${esc(p.name || name || "")}</span><span class="call-tst"></span>`;
  return t0;
}

// ---- WebRTC: one connection to each other person (a mesh; fine for small calls) ----
async function callMedia(video) {
  return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: video ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } } : false });
}
const callSig = (to, kind, data) => api.call("sig", { id: CALL.id, to, kind, data }).catch(() => {});
function callGathered(pc) {
  return new Promise((res) => { if (pc.iceGatheringState === "complete") return res();
    const done = () => { if (pc.iceGatheringState === "complete") { pc.removeEventListener("icegatheringstatechange", done); res(); } };
    pc.addEventListener("icegatheringstatechange", done); setTimeout(res, 2500); });
}
// Backup relay (YB 2026-10-31): some phone and office networks block direct phone-to-phone video. Every call also
// carries a free relay server (Open Relay by Metered, ports 80/443, TCP and TLS too). The phones only use it when a
// direct link can't be made, so nobody has to do anything. If a call still drops, it reconnects by itself, the second
// time through the relay only. Extra or paid relays (e.g. Cloudflare) can be added in hk_settings 'call_ice'.
async function callRelay() {
  try {
    const user = (Math.floor(Date.now() / 1000) + 6 * 3600) + ":sada";
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("openrelayprojectsecret"), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
    const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(user)));
    const credential = btoa(String.fromCharCode(...sig)); const h = "staticauth.openrelay.metered.ca";
    return [{ urls: [`turn:${h}:80`, `turn:${h}:80?transport=tcp`, `turn:${h}:443?transport=tcp`, `turns:${h}:443?transport=tcp`], username: user, credential }];
  } catch (e) { return []; }
}
function callPc(id, name, relay) {
  const old = CALL.pcs[id]; if (old) { try { old.pc.close(); } catch (e) {} }
  const pc = new RTCPeerConnection({ iceServers: CALL.ice || [], iceTransportPolicy: relay ? "relay" : "all" });
  const x = { pc, name, tile: old ? old.tile : callTile(id, name), sent: false, queue: [], miss: 0, born: Date.now(), tries: old ? old.tries : 0, relay: !!relay };
  CALL.pcs[id] = x;
  CALL.local.getTracks().forEach((tr) => pc.addTrack(tr, CALL.local));
  pc.ontrack = (e) => { const v = x.tile.querySelector("video"); const s = e.streams[0] || new MediaStream([e.track]); if (v.srcObject !== s) { v.srcObject = s; v.play().catch(() => {}); }
    if (e.track.kind === "video") { x.tile.classList.add("has-v"); e.track.onmute = () => x.tile.classList.remove("has-v"); e.track.onunmute = () => x.tile.classList.add("has-v"); } };
  // candidates found after the offer/answer went out are sent on their own
  pc.onicecandidate = (e) => { if (e.candidate && x.sent) callSig(id, "ice", e.candidate.toJSON()); };
  pc.onconnectionstatechange = () => {
    const st = pc.connectionState; const s = x.tile.querySelector(".call-tst");
    x.tile.classList.toggle("wait", st !== "connected");
    if (st === "connected") { if (!CALL.t0) CALL.t0 = Date.now(); CALL.status = ""; callToneStop(); if (s) s.textContent = ""; const a = document.getElementById("callStat"); if (a) a.textContent = callClock(); }
    else if (s) s.textContent = st === "failed" ? L3("Tidak tersambung", "Ndang tarsambung", "Can't connect") : st === "disconnected" ? L3("Sinyal lemah…", "Sinyal lemah…", "Weak signal…") : L3("Menyambungkan…", "Manyambung…", "Connecting…");
    // reconnect by itself: a weak signal gets 6 seconds to come back, a failed link is redone (up to 3 times, through the relay)
    clearTimeout(x.fix);
    if (st === "failed" || st === "disconnected") x.fix = setTimeout(() => callRedo(id, x), st === "failed" ? 300 : 6000);
  };
  return x;
}
function callRedo(id, x) {
  if (!CALL || CALL.pcs[id] !== x || ["connected", "new", "connecting"].includes(x.pc.connectionState) || x.tries >= 3) return;
  x.tries++; const s = x.tile.querySelector(".call-tst"); if (s) s.textContent = L3("Menyambungkan ulang…", "Manyambung muse…", "Reconnecting…");
  if (CALL.me > id) callOffer(id, x.name, true).catch(() => {}); else callSig(id, "redo", {});
}
async function callOffer(id, name, relay) {
  const x = callPc(id, name, relay); callPaint();
  const o = await x.pc.createOffer(); await x.pc.setLocalDescription(o); await callGathered(x.pc);
  x.sent = true; await callSig(id, "offer", { sdp: x.pc.localDescription.sdp, relay: !!relay });
}
async function callOnSig(s) {
  const id = s.from; let x = CALL.pcs[id]; const name = (CALL.names && CALL.names[id]) || "";
  if (s.kind === "offer") {
    if (x && x.pc.signalingState === "have-local-offer" && CALL.me > id) return;   // both offered at once: the larger id keeps its own offer
    x = callPc(id, name, s.data.relay); callPaint();
    await x.pc.setRemoteDescription({ type: "offer", sdp: s.data.sdp });
    for (const c of x.queue) await x.pc.addIceCandidate(c).catch(() => {}); x.queue = [];
    const a = await x.pc.createAnswer(); await x.pc.setLocalDescription(a); await callGathered(x.pc);
    x.sent = true; await callSig(id, "answer", { sdp: x.pc.localDescription.sdp });
  } else if (s.kind === "answer") {
    if (x && x.pc.signalingState === "have-local-offer") { await x.pc.setRemoteDescription({ type: "answer", sdp: s.data.sdp }); for (const c of x.queue) await x.pc.addIceCandidate(c).catch(() => {}); x.queue = []; }
  } else if (s.kind === "redo" && x && CALL.me > id) {
    if (x.tries < 3) { x.tries++; await callOffer(id, name || x.name, true); }
  } else if (s.kind === "ice" && x) {
    if (x.pc.remoteDescription) await x.pc.addIceCandidate(s.data).catch(() => {}); else x.queue.push(s.data);
  }
}
async function callBegin(res, video) {
  CALL.after = res.after || 0; CALL.id = res.call.id; CALL.room = res.call.room; CALL.me = res.me; CALL.ice = (Array.isArray(res.ice) ? res.ice : []).concat(await callRelay()); CALL.answered = !!res.call.answered_at || res.call.caller_id !== res.me;
  CALL.names = {}; (res.peers || []).forEach((p) => (CALL.names[p.id] = p.name));
  if (CALL.room.startsWith("dm:")) { CALL.dm = CALL.room.slice(3).split(":").find((x) => x !== res.me); CALL.dmName = res.call.caller_id === res.me ? "" : res.call.caller_name; }
  else CALL.title = (chatRooms().find((r) => r.id === CALL.room) || {}).name || "Chat";
  RING_SKIP.add(CALL.id);
  try { CALL.lock = navigator.wakeLock && await navigator.wakeLock.request("screen"); } catch (e) {}
  if (!res.peers || !res.peers.length) { if (CALL.dm && !CALL.answered) callTone("back"); }
  callPaint();
  for (const p of res.peers || []) callOffer(p.id, p.name).catch((e) => console.warn(e));
  callLoop();
}
async function callLoop() {
  const me = CALL; if (!me) return;
  try {
    const r = await api.call("poll", { id: me.id, after: me.after || 0 }); if (CALL !== me) return;
    (r.peers || []).forEach((p) => (me.names[p.id] = p.name));
    for (const s of r.sig || []) { me.after = Math.max(me.after || 0, s.id); try { await callOnSig(s); } catch (e) { console.warn(e); } }
    if (r.answered && !me.answered) { me.answered = true; callToneStop(); me.status = L3("Menyambungkan…", "Manyambung…", "Connecting…"); callPaint(); }
    // people who left
    const here = new Set((r.peers || []).map((p) => p.id)); let gone = false;
    for (const [id, x] of Object.entries(me.pcs)) { if (here.has(id)) x.miss = 0; else if (++x.miss >= 2 && Date.now() - x.born > 4000) { try { x.pc.close(); } catch (e) {} delete me.pcs[id]; gone = true; } }
    if (gone) callPaint();
    if (r.ended || (me.dm && r.declined)) return callStop(r.declined && !me.t0 ? L3("Panggilan ditolak.", "Ditolak.", "Call declined.") : me.t0 ? L3("Panggilan selesai.", "Nunga sae.", "Call ended.") : L3("Tidak dijawab.", "Ndang dialusi.", "No answer."), true);
    if (me.dm && me.t0 && !Object.keys(me.pcs).length) return callStop(L3("Panggilan selesai.", "Nunga sae.", "Call ended."));
  } catch (e) { if (CALL !== me) return; if (e && e.code === "not_allowed") return callStop(callErr(e), true); }
  if (CALL === me) me.loop = setTimeout(callLoop, document.hidden ? 2000 : 1000);
}
async function callStop(msg, already) {
  const me = CALL; if (!me) return; CALL = null; clearTimeout(me.loop); callToneStop();
  for (const x of Object.values(me.pcs)) { try { x.pc.close(); } catch (e) {} }
  if (me.local) me.local.getTracks().forEach((tr) => tr.stop());
  try { me.lock && me.lock.release(); } catch (e) {}
  callPaint(); callBar();
  if (me.id && !already) api.call("leave", { id: me.id }).catch(() => {});
  if (msg) toast(msg);
  if (callRoomOf() === me.room && typeof chatLoad === "function") setTimeout(() => chatLoad(false).catch(() => {}), 800);
}
async function callGo(op, d, video) {
  if (CALL) { CALL.min = false; callPaint(); return; }
  if (!callOk()) return toast(L3("Panggilan tidak didukung di perangkat ini.", "Ndang boi di HP on.", "Calls aren't supported on this device."), true);
  CALL = { pcs: {}, video, facing: "user", status: op === "start" ? L3("Memanggil…", "Mamio…", "Calling…") : L3("Menyambungkan…", "Manyambung…", "Connecting…") };
  const mine = CALL; callPaint();
  try {
    mine.local = await callMedia(video); if (CALL !== mine) { mine.local.getTracks().forEach((tr) => tr.stop()); return; }
    callPaint();
    const res = await api.call(op, d); if (CALL !== mine) { if (res && res.call) api.call("leave", { id: res.call.id }).catch(() => {}); mine.local.getTracks().forEach((tr) => tr.stop()); return; }
    if (op === "start") CALL.status = (res.peers || []).length ? L3("Menyambungkan…", "Manyambung…", "Connecting…") : "";
    else CALL.status = (res.peers || []).length ? L3("Menyambungkan…", "Manyambung…", "Connecting…") : "";
    CALL.video = res.call.video && video; if (!CALL.video) mine.local.getVideoTracks().forEach((tr) => { tr.stop(); mine.local.removeTrack(tr); });
    await callBegin(res, video);
  } catch (e) { console.warn(e); if (CALL === mine) { if (mine.local) mine.local.getTracks().forEach((tr) => tr.stop()); CALL = null; callPaint(); } toast(callErr(e), true); }
}
A.callStart = (d) => {
  const video = d.video === "1"; const live = CALL_LIVE.find((x) => x.room === d.room);
  callGo(live ? "join" : "start", live ? { id: live.id } : { room: d.room, video }, live ? live.video && video : video);
};
A.callJoin = (d) => { const live = CALL_LIVE.find((x) => x.id === d.id); callGo("join", { id: d.id }, live ? live.video : true); };
A.callAnswer = () => { const r = RING; if (!r) return; RING = null; callToneStop(); RING_SKIP.add(r.id); callGo("join", { id: r.id }, r.video); if (callRoomOf() !== r.room) location.hash = "#/chat/" + r.room; };
A.callDecline = () => { const r = RING; if (!r) return; RING = null; callToneStop(); RING_SKIP.add(r.id); callPaint(); if (!r.group) api.call("decline", { id: r.id }).catch(() => {}); };
A.callEnd = () => callStop(L3("Panggilan selesai.", "Nunga sae.", "Call ended."));
A.callMin = () => { if (CALL) { CALL.min = true; callPaint(); } };
A.callMax = () => { if (CALL) { CALL.min = false; callPaint(); } };
A.callMute = () => { if (!CALL || !CALL.local) return; CALL.muted = !CALL.muted; CALL.local.getAudioTracks().forEach((tr) => (tr.enabled = !CALL.muted)); callPaint(); };
A.callCam = () => { if (!CALL || !CALL.local) return; CALL.camOff = !CALL.camOff; CALL.local.getVideoTracks().forEach((tr) => (tr.enabled = !CALL.camOff)); callPaint(); };
A.callFlip = async () => {
  if (!CALL || !CALL.local || !CALL.video) return; const me = CALL; const facing = me.facing === "user" ? "environment" : "user";
  const old = me.local.getVideoTracks()[0];
  try {
    if (old) old.stop();   // iPhone can only open one camera at a time
    const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 640 }, height: { ideal: 480 } } });
    const tr = s.getVideoTracks()[0]; tr.enabled = !me.camOff;
    if (old) me.local.removeTrack(old); me.local.addTrack(tr); me.facing = facing;
    for (const x of Object.values(me.pcs)) { const snd = x.pc.getSenders().find((q) => q.track && q.track.kind === "video"); if (snd) await snd.replaceTrack(tr).catch(() => {}); }
    if (CALL === me) callPaint();
  } catch (e) { toast(callErr(e), true); }
};

// ---- ringing and the "group call going on" bar ----
async function callRing() {
  if (!callOk() || document.hidden) return;
  let r; try { r = await api.call("ring", {}); } catch (e) { if (e && e.code === "server" && CALL_SRV === null) { CALL_SRV = false; document.querySelectorAll(".call-hd").forEach((x) => x.remove()); } return; }
  if (!CALL_SRV) { CALL_SRV = true; if (callRoomOf() && !document.querySelector(".call-hd")) { const h = document.querySelector("header.top .langs"); if (h) h.insertAdjacentHTML("beforebegin", callHead()); } }
  CALL_LIVE = r.live || []; callBar();
  const inc = (r.ring || []).find((x) => !RING_SKIP.has(x.id));
  if (CALL) return;
  if (inc && (!RING || RING.id !== inc.id)) { RING = inc; callPaint(); callTone("ring"); }
  else if (!inc && RING && !RING.group) { RING = null; callToneStop(); callPaint(); }
}
setInterval(() => { callRing().catch(() => {}); }, 4000); setTimeout(() => callRing().catch(() => {}), 1500);
document.addEventListener("visibilitychange", () => { if (!document.hidden) callRing().catch(() => {}); });
function callBar() {
  let el = document.getElementById("callBar"); const room = callRoomOf();
  const live = room && !room.startsWith("dm:") && CALL_LIVE.find((x) => x.room === room && !(CALL && CALL.id === x.id));
  if (!live) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement("div"); el.id = "callBar"; el.className = "call-live"; document.body.appendChild(el); }
  const names = (live.names || []).join(", ");
  el.innerHTML = `<i class="live-dot"></i><span class="grow"><b>${esc(live.video ? L3("Panggilan video grup", "Telepon video grup", "Group video call") : L3("Panggilan suara grup", "Telepon suara grup", "Group voice call"))}</b><small>${esc(names)}</small></span><button class="btn sm primary" data-act="callJoin" data-id="${esc(live.id)}">${esc(L3("Gabung", "Masuk", "Join"))}</button>`;
}
window.addEventListener("hashchange", () => setTimeout(callBar, 50));
// Opening a call from its notification (#/call/<id>): ring screen for a private call, join screen for a group call.
R.call = (id) => {
  setTimeout(async () => {
    try {
      const r = await api.call("peek", { id }); const c = r.call;
      location.replace("#/chat/" + c.room);
      if (!r.live) return toast(L3("Panggilan sudah berakhir.", "Nunga sae telepon i.", "The call has ended."));
      if (CALL && CALL.id === c.id) return;
      if (c.room.startsWith("dm:")) { if (RING_SKIP.has(c.id)) return; RING = { id: c.id, room: c.room, name: c.caller_name, caller_id: c.caller_id, video: c.video }; }
      else RING = { id: c.id, room: c.room, name: c.caller_name, caller_id: c.caller_id, video: c.video, group: true, title: (chatRooms().find((x) => x.id === c.room) || {}).name || "Chat" };
      callPaint(); if (!RING.group) callTone("ring");
    } catch (e) { toast(callErr(e), true); location.replace("#/chat"); }
  }, 0);
  return shell("#/chat", skel(3), { back: "#/chat", title: "Chat" });
};
try { document.head.insertAdjacentHTML("beforeend", `<style>
  .call-hd { display: flex; gap: 2px; flex: none; margin-left: auto; } .call-hd .icon-btn { color: var(--brand); }
  header.top:has(.call-hd) > .langs { display: none; }
  .call-ui { position: fixed; inset: 0; z-index: 200; background: #0b1022; color: #fff; display: flex; flex-direction: column; padding: env(safe-area-inset-top) 0 env(safe-area-inset-bottom); }
  .call-ui[hidden] { display: none; }
  .call-ui .icon-btn { color: #fff; background: rgba(255,255,255,.12); }
  .call-top { display: flex; align-items: center; gap: 12px; padding: 12px 16px; z-index: 2; } .call-top .grow { flex: 1; min-width: 0; } .call-top b { display: block; font-size: 17px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .call-top small { opacity: .75; font-variant-numeric: tabular-nums; }
  .call-grid { flex: 1; min-height: 0; display: grid; gap: 6px; padding: 0 6px; grid-template-columns: 1fr; grid-auto-rows: 1fr; }
  .call-grid.n2 { grid-template-rows: 1fr 1fr; } .call-grid.n3, .call-grid.n4 { grid-template-columns: 1fr 1fr; } .call-grid.n5, .call-grid.n6, .call-grid.n7, .call-grid.n8 { grid-template-columns: 1fr 1fr; }
  @media (min-width: 900px) { .call-grid.n2 { grid-template-rows: 1fr; grid-template-columns: 1fr 1fr; } .call-grid.n5, .call-grid.n6, .call-grid.n7, .call-grid.n8 { grid-template-columns: 1fr 1fr 1fr; } }
  .call-tile { position: relative; border-radius: 18px; overflow: hidden; background: #1b2140; display: grid; place-items: center; min-height: 0; }
  .call-tile video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; } .call-tile.has-v video { opacity: 1; }
  .call-ui.audio .call-tile video { opacity: 0 !important; }
  .call-tav .avatar.xl, .call-ring .avatar.xl, .call-wait .avatar.xl { width: 96px; height: 96px; font-size: 34px; } .call-tile.has-v .call-tav { visibility: hidden; }
  .call-tname { position: absolute; left: 10px; bottom: 8px; font-size: 13px; font-weight: 700; background: rgba(0,0,0,.45); padding: 3px 9px; border-radius: 99px; }
  .call-tst { position: absolute; top: 10px; left: 0; right: 0; text-align: center; font-size: 13px; opacity: .85; }
  .call-wait { display: grid; place-items: center; } .call-wait-ic svg { width: 64px; height: 64px; opacity: .5; }
  .call-me { position: absolute; right: 14px; top: calc(70px + env(safe-area-inset-top)); width: 104px; height: 140px; object-fit: cover; border-radius: 14px; background: #222; box-shadow: 0 6px 20px rgba(0,0,0,.5); transform: scaleX(-1); z-index: 3; }
  .call-me.back { transform: none; } .call-me.off { opacity: .25; }
  .call-bar { display: flex; justify-content: center; gap: 18px; padding: 16px 16px 20px; }
  .call-btn { width: 60px; height: 60px; border-radius: 50%; border: 0; background: rgba(255,255,255,.16); color: #fff; display: grid; place-items: center; position: relative; }
  .call-btn svg { width: 28px; height: 28px; } .call-btn.on { background: #fff; color: #0b1022; } .call-btn.end { background: #e5484d; } .call-btn.ok { background: #22a35a; }
  .call-btn span { position: absolute; top: 68px; font-size: 13px; white-space: nowrap; }
  .call-ring { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center; padding: 24px; }
  .call-ring .call-name { font-size: 26px; } .call-ring small { opacity: .8; font-size: 15px; }
  .call-ring .call-av { animation: callPulse 1.6s infinite; border-radius: 50%; margin-bottom: 8px; }
  @keyframes callPulse { 0% { box-shadow: 0 0 0 0 rgba(34,163,90,.6); } 70% { box-shadow: 0 0 0 26px rgba(34,163,90,0); } 100% { box-shadow: 0 0 0 0 rgba(34,163,90,0); } }
  .call-ans { display: flex; gap: 90px; margin-top: 70px; padding-bottom: 30px; } .call-ans .call-btn { width: 70px; height: 70px; }
  .call-pill { display: none; }
  .call-ui.min { inset: auto 12px calc(84px + env(safe-area-inset-bottom)) auto; background: transparent; padding: 0; }
  .call-ui.min > *:not(.call-pill) { display: none; }
  .call-ui.min .call-pill { display: flex; align-items: center; gap: 8px; border: 0; border-radius: 99px; padding: 10px 16px; background: #22a35a; color: #fff; font-weight: 700; box-shadow: 0 8px 22px rgba(0,0,0,.3); max-width: 70vw; }
  .call-pill svg { width: 20px; height: 20px; flex: none; } .call-pill span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .call-pill b { font-variant-numeric: tabular-nums; }
  .call-live { position: fixed; z-index: 40; left: 12px; right: 12px; top: calc(66px + env(safe-area-inset-top)); max-width: 836px; margin: 0 auto; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 16px; background: var(--surface, #fff); border: 2px solid #ef4444; box-shadow: 0 8px 22px rgba(20,22,70,.18); }
  .call-live .grow { flex: 1; min-width: 0; } .call-live b { display: block; font-size: 14.5px; } .call-live small { color: var(--muted); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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
    <h3 class="sec-h">${esc(L3("Akan datang", "Naeng ro", "Upcoming"))}</h3>${next.length ? next.map((x) => row(x, "next")).join("") : `<p class="muted small">${esc(L3("Belum ada rapat terjadwal.", "Ndang adong.", "No meetings scheduled."))}</p>`}
    ${past.length ? `<h3 class="sec-h">${esc(L3("Sebelumnya", "Na salpu", "Earlier"))}</h3>${past.map((x) => row(x, "past")).join("")}` : ""}
    <p class="small muted">${esc(L3("Rapat berjalan di Jitsi Meet (meet.jit.si) di browser atau aplikasi Jitsi. Orang pertama yang masuk menjadi moderator dan diminta masuk dengan Google/GitHub sekali; peserta lain tidak perlu akun.", "", "Meetings run on Jitsi Meet (meet.jit.si) in the browser or the Jitsi app. The first person in becomes the moderator and is asked to sign in with Google/GitHub once; others need no account."))}</p>`,
    {});
};
A.meetNew = (d) => {
  const auds = meetAudiences(); const now = d.now === "1";
  const local = new Date(Date.now() + 8 * 3600e3 + 3600e3); const dt = local.toISOString().slice(0, 13) + ":00";
  sheet(now ? "⚡ " + L3("Mulai rapat sekarang", "Mulai rapat", "Start a meeting now") : "🗓 " + L3("Jadwalkan rapat", "Jadwalhon rapat", "Schedule a meeting"), `<form class="form" data-form="meet" data-now="${now ? 1 : 0}">
    <label>${esc(L3("Judul", "Judul", "Title"))}<input name="title" required maxlength="120" placeholder="${esc(L3("Rapat Multimedia", "Rapat", "Multimedia meeting"))}"></label>
    <label>${esc(L3("Undang", "Undang", "Invite"))}<select name="aud">${auds.map(([a, g, label], i) => `<option value="${a}|${g}"${i === 0 ? " selected" : ""}>${esc(label)}</option>`).join("")}</select></label>
    ${now ? "" : `<label>${esc(L3("Mulai", "Mulai", "Starts"))}<input type="datetime-local" name="at" value="${dt}" required></label>`}
    <label>${esc(L3("Durasi", "Durasi", "Length"))}<select name="minutes">${[30, 45, 60, 90].map((m) => `<option value="${m}"${m === 60 ? " selected" : ""}>${m} min</option>`).join("")}</select></label>
    <p class="small muted">${esc(L3("Maksimal 90 menit per rapat. Yang diundang mendapat notifikasi; rapat terjadwal masuk kalender dengan pengingat 10 menit sebelumnya.", "Maksimal 90 menit.", "Up to 90 minutes per meeting. Invitees get a push; a scheduled meeting goes into the calendar with a reminder 10 minutes before."))}</p>
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
    L3("Gabung", "Masuk", "Join"), L3(`Sedang berlangsung · ${mt.by}. Ketuk untuk bergabung.`, "Tengah masa · ketuk asa bongot.", `On now · ${mt.by}. Tap to join.`), true);
  if (D.live && D.live.service_id) return card("#/live", "Sada HKBPS", L3("Ibadah sedang berlangsung", "Parmingguon tengah masa", "The service is on"), `<i class="live-dot"></i> LIVE`,
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
// Dukacita support, pastoral care nudge (opt-in), and free roster drafts and discussion questions.

const busySheet = (title, text) => sheet(title, `<div class="center pad">${skel(3)}<p class="muted small">${esc(text)}</p></div>`);

// More: one place for the community features.
function communityMenu() {
  if (isGuest()) return "";
  const elder = "parhalado" in (D.me.groups || {});   // Time for a visit: Parhalado only (the pastor and the elders)
  const it = (href, icon, title, sub) => `<a class="li" href="${href}">${ic(icon)}<span class="grow"><b>${title}</b><small>${esc(sub)}</small></span>${ic("chev", "chev")}</a>`;
  return (isYB() ? it("#/access", "lock", "🔐 " + esc(L3("Akses & tampilan", "Akses", "Access & views")), L3("Periksa setiap kategori dan seksi, dan lihat Sada sebagai anggota mana pun", "Ida songon ruas", "Check every category and section, and see Sada as any member")) : "")
    + it("#/fx", "coins", "💱 " + esc(L3("Kurs", "Kurs", "Exchange rates")), L3("Konversi mata uang, kurs terbaru", "Kurs hepeng", "Currency converter, latest rates"))
    + it("#/tutur", "people", "🤝 Partuturan", L3("Cara saling menyapa menurut Dalihan Na Tolu", "Partuturan Dalihan Na Tolu", "How to address each other (Dalihan Na Tolu)"))
    + it("#/tarombo", "people", "🌳 Tarombo", L3("Silsilah marga Batak dari Si Raja Batak", "Tarombo sian Si Raja Batak", "The Batak marga tree from Si Raja Batak"))
    + (isParhalado() ? it("#/rpp", "lock", "⚖️ RPP", L3("Daftar RPP dan tanya Juklak (Parhalado)", "Daftar RPP dohot sungkun Juklak", "RPP list and ask the Juklak (Parhalado)")) : "")
    + ((isPastor() || isPlainElder()) && LS.get("fullView", false) ? `<button class="li" data-act="viewSimple"><span class="grow"><b>🪟 ${esc(L3("Kembali ke tampilan sederhana", "Mulak tu tampilan na sederhana", "Back to the simple view"))}</b></span>${ic("chev", "chev")}</button>` : "")
    + it("#/ende", "book", "🎵 Buku Ende", L3("Arti setiap baris lagu", "Lapatan ni ende", "The meaning of every hymn line"))
    + it("#/sunday", "calendar", "📅 " + L3("Minggu Ini", "Minggu On", "This Sunday"), L3("Tata Ibadah, lagu, nas dan live", "Tata Ibadah, ende, turpuk, live", "Tata Ibadah, songs, readings and live"))
    + `<button class="li" data-act="textSize">${ic("textsize")}<span class="grow"><b>🔠 ${esc(L3("Ukuran teks", "Balga ni surat", "Text size"))}</b><small>${esc(L3("Perbesar huruf di seluruh Sada", "Pabalga surat", "Make the text larger everywhere"))}</small></span>${ic("chev", "chev")}</button>`
    + (D.me.is_admin ? it("#/usage", "chart", "📊 " + L3("Pemakaian fitur", "Pamakean fitur", "Feature usage"), L3("Fitur mana yang benar-benar dipakai jemaat", "Fitur na dipake", "Which features members actually use")) : "")
    + it("#/stories", "mic", "🎙️ Turi-turian", L3("Cerita orang tua, direkam untuk generasi muda", "Turi-turian ni natua-tua", "Elders' stories, recorded for the young"))
    + (("pelaut" in (D.me.groups || {})) ? it("#/voyage", "globe", "🚢 Pelaut", L3("Mode berlayar dan paket offline", "Mode marlayar", "Voyage mode and offline pack")) : "")
    + it("#/grief", "heart", "🕊️ Dukacita", L3("Dukung keluarga yang berduka", "Apuli na marsak", "Support a grieving family"))
    + (elder ? it("#/care", "bell", "🫶 " + esc(L3("Perlu dikunjungi", "Ingkon dikunjungi", "Time for a visit")), L3("Jemaat yang lama tidak hadir (hanya sintua)", "Ruas na leleng so ro", "Members not seen for a while (elders only)")) : "")
    + `<label class="li care-opt"><input type="checkbox" data-act-change="careOptin" ${D.care_optin ? "checked" : ""}><span class="grow"><b>${esc(L3("Sintua boleh menghubungi saya", "Sintua boi manghubungi au", "Elders may check on me"))}</b><small>${esc(L3("Jika saya lama tidak hadir atau membuka aplikasi", "Molo leleng ndang ro", "If I haven't been at church or in the app for a while"))}</small></span></label>`;
}
A.careOptin = async (d, el) => { const on = el.checked; try { await api.save("care_optin", { on }); D.care_optin = on; toast(on ? L3("Terima kasih. Sintua akan menyapa bila Anda lama tidak hadir.", "Mauliate.", "Thank you. The elders will check on you if you're away a while.") : t("saved")); } catch (e) { el.checked = !on; toast(errMsg(e), true); } };

// 1. Partuturan: how two people address each other (a general guide following Dalihan Na Tolu).
R.tutur = () => {
  const mg = (n, v) => `<input name="${n}" list="margaList" autocomplete="off" placeholder="Simanjuntak, Hutabarat…" value="${esc(v || "")}">`;
  const MARGA = ["Simanjuntak", "Hutabarat", "Sihombing", "Panjaitan", "Siburian", "Gultom", "Hutasoit", "Manik", "Tobing", "Lumbantobing", "Nainggolan", "Silitonga", "Sianturi", "Butarbutar", "Pasaribu", "Situmorang", "Lubis", "Purba", "Limbong", "Sirait", "Sitompul", "Siregar", "Simatupang", "Napitupulu", "Pardede", "Marpaung", "Silalahi", "Sinaga", "Simbolon", "Sitorus", "Tampubolon", "Hutagalung", "Hutapea", "Siahaan", "Manurung", "Panggabean", "Bangun", "Matondang"];
  const me = (D.me.name || "").split(" ").slice(-1)[0];
  return shell("#/more", `<h2 class="page-h">🤝 Partuturan</h2><p class="lead">${esc(L3("Masukkan marga Anda dan marga orang itu (serta boru ibu kalian). Sada memberi panggilan yang lazim menurut Dalihan Na Tolu.", "Bahen margam dohot marga ni ibana.", "Enter your marga and theirs (and your mothers' boru). Sada suggests the usual term of address under Dalihan Na Tolu."))}</p>
    <datalist id="margaList">${MARGA.map((x) => `<option value="${x}">`).join("")}</datalist>
    <form class="card form" data-form="tutur">
      <div class="row2"><label>${esc(L3("Saya", "Ahu", "Me"))}<select name="g1"><option value="m">${esc(L3("Laki-laki", "Baoa", "Male"))}</option><option value="f">${esc(L3("Perempuan", "Boru-boru", "Female"))}</option></select></label>
        <label>${esc(L3("Dia", "Ibana", "Them"))}<select name="g2"><option value="m">${esc(L3("Laki-laki", "Baoa", "Male"))}</option><option value="f">${esc(L3("Perempuan", "Boru-boru", "Female"))}</option></select></label></div>
      <div class="row2"><label>${esc(L3("Marga saya", "Margangku", "My marga"))}${mg("m1", (D.me.name || "").trim().split(/\s+/).length > 1 ? me : "")}</label><label>${esc(L3("Marga atau boru dia", "Marga / boru ni ibana", "Their marga / boru"))}${mg("m2")}</label></div>
      <div class="row2"><label>${esc(L3("Boru ibu saya", "Boru ni inang", "My mother's boru"))}${mg("b1")}</label><label>${esc(L3("Boru ibu dia", "Boru ni inangna", "Their mother's boru"))}${mg("b2")}</label></div>
      <label>${esc(L3("Generasinya dibandingkan saya", "Generasi", "Their generation"))}<select name="gen"><option value="up">${esc(L3("Satu generasi di atas (seperti orang tua)", "Di ginjang", "One above (like a parent)"))}</option><option value="same" selected>${esc(L3("Sebaya", "Sapangkat", "Same generation"))}</option><option value="down">${esc(L3("Satu generasi di bawah (seperti anak)", "Di toru", "One below (like a child)"))}</option></select></label>
      <label>${esc(L3("Lebih tua? (generasi di atas: dibandingkan ayah/ibu Anda dari pihak itu · sebaya: dibandingkan Anda)", "Umbalga? (di ginjang: sian ama/inangmu · sapangkat: sian ho)", "Older? (generation above: than your father/mother on that side · same generation: than you)"))}<select name="old"><option value="y">${esc(L3("Ya, lebih tua", "Olo", "Yes, older"))}</option><option value="n">${esc(L3("Tidak, lebih muda", "Ndang", "No, younger"))}</option><option value="u">${esc(L3("Tidak tahu", "Ndang huboto", "Not sure"))}</option></select></label>
      <button class="btn primary block">${esc(L3("Lihat panggilan", "Ida", "Show the term"))}</button></form>
    <div id="tuturRes"></div>${tuturRefHtml()}`, { back: "#/more", title: "Partuturan" });
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
  const tr = taroRel(i.m1, i.m2), tb = i.b1 && i.b2 ? taroRel(i.b1, i.b2) : null;
  document.getElementById("tuturRes").innerHTML = `<article class="card tutur-res"><p class="small muted">${esc(L3("Panggil dia", "Dok ma ibana", "Call them"))}</p><h2>${esc(term)}</h2><p>${esc(why)}</p>
    ${tr ? `<div class="taro-box"><b>🌳 ${esc(L3("Menurut tarombo", "Sian tarombo", "By the tarombo"))}</b><p>${esc(tr.text)}</p>${taroPath(tr.pa, i.m1)}${taroPath(tr.pb, i.m2)}</div>` : ""}
    ${tb && tb.kind !== "far" ? `<div class="taro-box"><b>🌳 ${esc(L3("Marga ibu kalian", "Marga ni inang", "Your mothers' margas"))}</b><p>${esc(tb.text)}</p></div>` : ""}
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
  const verses = HYMN.asText(title, text.trim()).split(/\n\s*\n/).map((v) => v.trim()).filter(Boolean);
  el.innerHTML = `<article class="card ende-res"><h3>${esc(title || "Buku Ende")}</h3>${verses.map((v) => `<div class="ende-v">${v.split("\n").map((l) => `<p>${esc(l)}</p>`).join("")}
      <div class="row" style="gap:6px"><a class="btn sm" href="${gtr(v, "id")}" target="_blank" rel="noopener">🇮🇩 ${esc(L3("Artinya", "Lapatanna", "Meaning"))}</a><a class="btn sm" href="${gtr(v, "en")}" target="_blank" rel="noopener">🇬🇧 English</a></div></div>`).join("")}
    <p class="small muted">${esc(L3("Arti dibuka di Google Translate (gratis, mendukung Bahasa Batak Toba). Terjemahan mesin, bukan terjemahan resmi.", "Lapatan sian Google Translate.", "Meanings open in Google Translate (free, it supports Batak Toba). Machine translation, not an official one."))}</p></article>`;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
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
    ${list.length ? `<div class="card">${list.map((x) => `<div class="li story"><button class="icon-btn" data-act="storyPlay" data-id="${x.id}" aria-label="Play">▶</button><span class="grow"><b>${esc(x.title)}</b><small>${esc([x.speaker, x.by, x.seconds ? Math.floor(x.seconds / 60) + ":" + String(x.seconds % 60).padStart(2, "0") : "", fmt(x.at, { day: "numeric", month: "short" })].filter(Boolean).join(" · "))}</small><span class="story-audio" id="sa${x.id}"></span></span>${x.mine || D.me.is_admin ? `<button class="icon-btn danger" data-act="del" data-kind="story" data-id="${x.id}" aria-label="${esc(t("delete"))}">${ic("trash")}</button>` : ""}</div>`).join("")}</div>` : empty(L3("Belum ada cerita. Jadilah yang pertama merekam!", "Ndang adong.", "No stories yet. Be the first to record one!"), "mic")}`,
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
  const st = document.getElementById("recState"); if (st) st.textContent = L3("Dengarkan, lalu beri judul dan simpan.", "Tangihon ma, dungi bahen judulna jala simpan.", "Listen back, then give it a title and save.");
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
  return `<a class="card live-banner" href="#/live"><span class="live-dot"></span><span class="grow"><b>${esc(L3("Ibadah sedang berlangsung", "Parmingguon tengah masa", "The service is on now"))}</b><small>${esc(L3("Ikuti slide live di HP Anda, huruf besar", "Ihuthon live", "Follow the slides live on your phone, in large text"))}</small></span>${ic("chev", "chev")}</a>`;
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
  sheet(title, `<form class="form" data-form="griefhelp" data-id="${esc(d.id)}" data-k="${k}">${k === "msg" ? `<label>${esc(L3("Pesan Anda untuk keluarga", "Pesan", "Your message to the family"))}<textarea name="body" rows="3" maxlength="500" required>${esc(L3("Turut berduka cita. Kiranya Tuhan menghibur dan menguatkan keluarga.", "Hami pe turut marsak roha. Sai diapuli Tuhan ma hamu.", "Our deepest sympathy. May the Lord comfort and strengthen your family."))}</textarea></label>` : `<label>${esc(t("f_date"))}<input type="date" name="day" value="${addDays(today(), 1)}" required></label><label>${esc(t("f_note"))}<input name="body" maxlength="200"></label>`}
    <button class="btn primary block">${esc(L3("Kirim", "Kirim", "Send"))}</button></form>`);
};
F.griefhelp = async (f) => { await api.save("grief_help", { grief_id: +f.dataset.id, kind: f.dataset.k, day: f.day ? f.day.value : null, body: f.body ? f.body.value.trim() : "" }); closeSheet(); await refresh(); toast(L3("Terkirim ke keluarga.", "", "Sent to the family.")); };
A.griefCover = async (d) => { try { const r = await api.save("swap", { group_id: d.g, label: fmtDay(d.day), jobs: d.jobs, note: L3("Keluarga sedang berduka.", "Keluarga on marsak roha.", "The family is grieving."), who: d.who, free: "", url: rosterHome(d.g, d.day.slice(0, 7)) }); toast(L3(`Para makers sudah diberi tahu (${r.told || 0}).`, "", `Makers told (${r.told || 0}).`)); } catch (e) { toast(errMsg(e), true); } };
A.griefClose = async (d) => { try { await api.save("grief_close", { grief_id: +d.id }); await refresh(); render(); } catch (e) { toast(errMsg(e), true); } };

// 7. Time for a visit (elders only): members who opted in and haven't been seen in church or the app for 3 weeks.
R.care = () => {
  if (!("parhalado" in (D.me.groups || {}))) { location.replace("#/more"); return ""; }
  const list = D.care || [];
  setTimeout(visitsPaint, 0);
  return shell("#/more", `<h2 class="page-h">🫶 ${esc(L3("Perlu dikunjungi", "Ingkon dikunjungi", "Time for a visit"))}</h2><p class="lead">${esc(L3("Jemaat yang memilih “Sintua boleh menghubungi saya” dan belum terlihat di gereja atau aplikasi selama 3 minggu. Hanya sintua yang melihat daftar ini.", "", "Members who chose “Elders may check on me” and haven't been seen at church or in the app for 3 weeks. Only elders see this list."))}</p>
    ${list.length ? `<div class="card">${list.map((p) => `<div class="li" data-mid="${p.id}">${avatarOf(p)}<span class="grow"><b>${esc(p.name)}</b><span class="visit-h"></span><small>${esc(L3("Terakhir di aplikasi", "Aplikasi", "Last in the app"))}: ${esc(p.seen ? fmt(p.seen, { day: "numeric", month: "short" }) : "–")} · ${esc(L3("di gereja", "gareja", "at church"))}: ${esc(p.church ? fmt(p.church, { day: "numeric", month: "short" }) : "–")}</small></span>${p.phone ? `<a class="icon-btn wa" href="${wa(L3(`Syalom ${firstName(p.name)}, apa kabar? Kami merindukan Anda di ibadah. Tuhan memberkati.`, `Horas ${firstName(p.name)}!`, `Hello ${firstName(p.name)}, how are you? We miss you at church. God bless.`), p.phone)}" target="_blank" rel="noopener" aria-label="WhatsApp">${ic("wa")}</a><a class="icon-btn" href="tel:+65${esc(p.phone)}" aria-label="Call">📞</a>` : ""}<button class="icon-btn" data-act="visitAdd" data-id="${p.id}" aria-label="Catat">📝</button></div>`).join("")}</div>` : empty(L3("Semua yang memilih untuk disapa masih aktif. Puji Tuhan!", "", "Everyone who opted in has been around recently. Praise God!"), "heart")}`,
    { back: "#/more", title: L3("Perlu dikunjungi", "Ingkon dikunjungi", "Time for a visit") });
};

// 8. Fair roster draft (free, on the phone): Sada spreads the month's duties fairly; the makers check, then save.
A.rosterDraft = async (d) => {
  const gid = d.g, ym = d.m; const g = G(gid); const old = manualRoster(gid, ym);
  const sundays = []; for (let x = ym + "-01"; x.slice(0, 7) === ym; x = addDays(x, 1)) if (new Date(x + "T12:00:00Z").getUTCDay() === 0) sundays.push(x);
  const jobs = old ? old.table_json[0].rows[0].slice(1).filter(Boolean) : (ROSTER_JOBS[gid] || ["Petugas"]);
  const people = (D.people || []).filter((p) => gid in (p.groups || {})).map((p) => p.name);
  if (!people.length) { toast(L3("Belum ada anggota di seksi ini.", "", "No members in this section yet."), true); return; }
  const load = {}; const since = addDays(today(), -92);
  (D.rosters || []).filter((r) => r.group_id === gid).forEach((r) => (r.table_json || []).forEach((tb) => (tb.rows || []).slice(1).forEach((row) => { const iso = rowDate(row, r.month); if (!iso || iso < since) return; people.forEach((n) => { if (row.some((c, j) => j && hit(c, myNames({ name: n })))) load[n] = (load[n] || 0) + 1; }); })));
  const busyMap = {}; sundays.forEach((s0) => { const away = [...(D.voyages || []).filter((v) => v.start <= s0 && v.end >= s0).map((v) => v.name), ...(D.grief || []).map((x) => x.family)]; if (away.length) busyMap[s0] = away; });
  // Nobody already serving in another section or category that Sunday (YB 2026-10-31); the server checks the rest on save.
  (D.rosters || []).filter((r) => r.group_id !== gid).forEach((r) => (r.table_json || []).forEach((tb) => (tb.rows || []).slice(1).forEach((row) => { const iso = rowDate(row, r.month); if (!iso || !sundays.includes(iso)) return; const hd = (tb.rows || [])[0] || []; people.forEach((n) => { if (row.some((c, j) => j && !(r.group_id === "multimedia" && /slide/i.test(hd[j] || "") && (D.people || []).some((pp) => (pp.is_admin || ["maker", "chair"].includes((pp.groups || {}).multimedia)) && hit(c, myNames(pp)))) && hit(c, myNames({ name: n })))) (busyMap[iso] = busyMap[iso] || []).push(n); }); })));
  const keep = {}; if (old) { const head = old.table_json[0].rows[0]; old.table_json[0].rows.slice(1).forEach((row) => { const iso = rowDate(row, ym); if (!iso) return; head.forEach((h, j) => { if (j && row[j]) (keep[iso] = keep[iso] || {})[h] = row[j]; }); }); }
  busySheet("✨ " + L3("Draf roster", "Draf roster", "Roster draft"), L3("Menyusun roster yang adil…", "Manyusun roster…", "Drafting a fair roster…"));
  try {
    const r = localRoster({ sundays, jobs, people, load, busy: busyMap, keep });
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
  busySheet("✨ " + gname(g), L3("Menyiapkan bahan diskusi…", "Mamparade bahan diskusi…", "Preparing the discussion…"));
  try {
    const doc = new DOMParser().parseFromString(await tataHtml(v.id), "text/html");
    const text = [...doc.querySelectorAll("section.pg")].map((x) => x.textContent.replace(/\s+\n/g, "\n").trim()).join("\n\n").slice(0, 14000);
    const hint = { "sekolah-minggu": "children aged 4-12, very simple, playful", remaja: "teenagers 13-17", naposo: "young adults", ama: "fathers", ina: "mothers", pelaut: "sailors and workers far from home" }[d.g] || "adults";
    const r = localQuestions({ category: gname(g), text, lang, hint });
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
  const order = () => navTabs().map((x) => x[1]);
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
    #view > main.from-right { animation: slideFromRight .24s ease-out backwards; }
    #view > main.from-left { animation: slideFromLeft .24s ease-out backwards; }
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

// Profile photo: tap your picture on More. Category and section pictures: tap the big picture at the top of its page.
// YB 2026-10-31: pick one from the phone's photo library or take a new one with the camera. Stored (square, small JPEG) on the server.
// Up to 2 pictures are kept for each member, category and section: the one shown and the one before it. A new picture
// replaces the older saved one; "Use this" switches back; "Remove" takes the shown one away (the saved one, if any, takes its place).
const picOk = (gid) => !gid || (!isGuest() && (isAdmin() || canEdit(gid) || canRoster(gid)));
const picCur = (gid) => (gid ? (D.group_photos || {})[gid] : (D.photos || {})[D.me.id]) || null;
function picSet(gid, v) { const k = gid ? "group_photos" : "photos", id = gid || D.me.id; D[k] = { ...(D[k] || {}) }; if (v) D[k][id] = v; else delete D[k][id]; }
const picSave = (gid, d) => api.save(gid ? "group_photo" : "photo", gid ? { group_id: gid, ...d } : d);
const PIC = { g: null, prev: null };
const gIcon = (g, cls = "") => { const ph = g && D && D.group_photos && D.group_photos[g.id]; return `<span class="gicon${cls ? " " + cls : ""}${ph ? " has-ph" : ""}">${ph ? `<img src="${esc(ph)}" alt="">` : ic((g && g.icon) || "people")}</span>`; };
// The big picture at the top of a category or section page: a button for whoever may change it.
const heroPic = (g) => (picOk(g.id) ? `<button class="gpic-btn" data-act="photoPick" data-g="${esc(g.id)}" aria-label="${esc(L3("Ganti gambar", "Ganti gambar", "Change picture"))}">${gIcon(g, "xl")}<i class="avatar-edit">${ic("camera")}</i></button>` : gIcon(g, "xl"));
function picSavedHtml() {
  const gid = PIC.g, cur = picCur(gid), prev = PIC.prev; if (!cur && !prev) return "";
  const one = (src, shown) => `<div class="pic-saved-i${shown ? " on" : ""}"><img src="${esc(src)}" alt=""><small>${esc(shown ? L3("Ditampilkan", "Ditampilkan", "Shown") : L3("Tersimpan", "Tersimpan", "Saved"))}</small>${shown ? "" : `<span class="row"><button class="btn sm primary" data-act="picUse">${esc(L3("Pakai", "Pake", "Use this"))}</button><button class="btn sm danger" data-act="picDrop" aria-label="${esc(L3("Hapus", "Hapus", "Remove"))}">${ic("trash")}</button></span>`}</div>`;
  return `<h4 class="sec-h">${esc(L3("Gambar tersimpan (maks. 2)", "Gambar na tersimpan (maks. 2)", "Saved pictures (up to 2)"))}</h4>
    <div class="pic-saved">${cur ? one(cur, true) : ""}${prev ? one(prev, false) : ""}</div>
    <p class="small muted">${esc(L3("Sada menyimpan 2 gambar terakhir. Gambar baru menggantikan yang lebih lama.", "Sada manyimpan 2 gambar na parpudi. Gambar na imbaru manggantihon na robi.", "Sada keeps the last 2 pictures. A new one replaces the older saved one."))}</p>`;
}
const picPaint = () => { const el = document.getElementById("picSaved"); if (el) el.innerHTML = picSavedHtml(); };
A.photoPick = async (d) => {
  const gid = (d && d.g) || null; if (!picOk(gid)) return;
  const g = gid ? G(gid) : null; PIC.g = gid; PIC.prev = null; const has = !!picCur(gid);
  sheet(g ? gname(g) : L3("Foto profil", "Foto profil", "Profile photo"), `<div class="pf-prev"${g ? ` style="--gc:${g.color}"` : ""}>${g ? gIcon(g, "xl") : avatarOf(D.me, "xl")}</div><div class="stack">
    <button class="opt-card" data-act="photoNew" data-src="camera">${ic("camera")}<span><b>${esc(L3("Ambil foto", "Buat foto", "Take a photo"))}</b><small>${esc(L3("Pakai kamera ponsel", "Pake kamera", "Use the phone's camera"))}</small></span>${ic("chev", "chev")}</button>
    <button class="opt-card" data-act="photoNew" data-src="library">${ic("gallery")}<span><b>${esc(L3("Pilih dari galeri", "Pilih sian galeri", "Choose from library"))}</b><small>${esc(L3("Foto yang sudah ada di ponsel", "Foto na adong di ponsel", "A photo already on your phone"))}</small></span>${ic("chev", "chev")}</button>
    ${has ? `<button class="opt-card" data-act="photoRemove">${ic("trash")}<span><b>${esc(L3("Hapus foto", "Hapus foto", "Remove photo"))}</b></span>${ic("chev", "chev")}</button>` : ""}</div><div id="picSaved">${picSavedHtml()}</div>`);
  try { const r = await api.save("photo_saved", gid ? { group_id: gid } : {}); if (PIC.g === gid) { PIC.prev = (r && r.prev) || null; picPaint(); } } catch (e) { /* older server or demo: only the shown picture */ }
};
A.photoNew = (d) => {
  const gid = PIC.g; closeSheet(); const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*";
  if (d && d.src === "camera") inp.setAttribute("capture", gid ? "environment" : "user");
  inp.onchange = async () => { const f = inp.files[0]; if (!f) return;
    try { let data = await resizeImage(f, 256, 0.82, true); if (data.length > 78000) data = await resizeImage(f, 192, 0.7, true);
      await picSave(gid, { photo: data }); picSet(gid, data); toast(t("saved")); render(); } catch (e) { toast(errMsg(e), true); } };
  inp.click();
};
A.photoRemove = async () => { const gid = PIC.g, prev = PIC.prev; closeSheet(); try { await picSave(gid, { photo: "" }); picSet(gid, prev); render(); } catch (e) { toast(errMsg(e), true); } };
A.picUse = async () => { const gid = PIC.g, prev = PIC.prev, cur = picCur(gid); if (!prev) return;
  try { await picSave(gid, { use: "prev" }); picSet(gid, prev); PIC.prev = cur; closeSheet(); toast(t("saved")); render(); } catch (e) { toast(errMsg(e), true); } };
A.picDrop = async () => { const gid = PIC.g; try { await picSave(gid, { drop: "prev" }); PIC.prev = null; picPaint(); } catch (e) { toast(errMsg(e), true); } };

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
  // iPhone opens the keyboard only from a tap: focus here only when the tap that opened this page focused the stand-in field (or on a computer)
  setTimeout(() => { const i = document.getElementById("searchIn"); if (!i) return; searchRun(i.value);
    const px = document.getElementById("kbProxy"); const touch = matchMedia("(pointer: coarse)").matches;
    if (!touch || (px && document.activeElement === px)) { i.focus({ preventScroll: true }); try { i.setSelectionRange(i.value.length, i.value.length); } catch (e) {} }
    if (px) px.remove(); }, 0);
  return shell("#/home", `<div class="sx-top"><div class="sx-box">${ic("search")}<input id="searchIn" type="search" enterkeyhint="search" autocomplete="off" placeholder="${esc(L3("Cari anggota, lagu, dokumen, acara…", "Lului ruas, ende, dokumen…", "Search members, songs, documents, events…"))}" value="${esc(LS.get("lastQ", "") || "")}"><button class="sx-x" data-act="sxClear" aria-label="Clear">✕</button></div><div class="sx-chips" id="sxChips"></div></div><div id="searchRes"></div>`,
    { back: "#/home", title: L3("Cari", "Lului", "Search") });
};
function searchRun(q) {
  LS.set("lastQ", q); const el = document.getElementById("searchRes"); if (!el) return;
  const n = norm(q); const xb = document.querySelector(".sx-x"); if (xb) xb.hidden = !q;
  if (n.length < 2) { DEEP.n++; el.innerHTML = sxEmpty(); const ch = document.getElementById("sxChips"); if (ch) ch.innerHTML = ""; return; }
  const has = (x) => norm(x || "").includes(n); const digits = q.replace(/\D/g, "");
  // "call Samuel", "video call Samuel", "telepon Samuel": find Samuel, with the call buttons on the row
  const callQ = q.match(/^\s*(?:video\s*call|voice\s*call|vc|call|telepon|telpon|panggil|hubungi)\s+(.{2,})$/i); const pn = callQ ? norm(callQ[1]) : n; const hasP = (x) => norm(x || "").includes(pn);
  const people = (D.people || []).filter((p) => hasP(p.name) || hasP(p.alias) || (digits.length >= 3 && (p.phone || "").includes(digits))).slice(0, 20);
  const feats = sxFeatFind(q); const canCall = callOk();
  const groups = (D.groups || []).filter((g) => canSee(g) && has(gname(g)));
  const evs = (D.events || []).filter((e) => has(e.title) || has(e.place) || has(e.notes)).slice(0, 15);
  const files = (D.files || []).filter((f) => has(f.title) || has(f.file_name) || has(f.note)).slice(0, 15);
  const posts = (D.posts || []).filter((p) => !["warta", "finance"].includes(p.kind) && (has(p.title) || has(p.body))).slice(0, 10);
  const lines = []; (D.rosters || []).forEach((r) => (r.table_json || []).forEach((tb) => { const rows = tb.rows || []; const head = rows[0] || []; rows.slice(1).forEach((row) => { if (row.some((c, j) => j && has(c))) lines.push({ r, row, head }); }); }));
  const sec = (title, html) => (html ? `<h3 class="sec-h">${esc(title)}</h3><div class="card">${html}</div>` : "");
  const featSec = feats.length ? `<h3 class="sec-h">${esc(L3("Fitur", "Fitur", "Features"))}</h3><div class="card deep-card">${sxFeatRows(feats, callQ ? "" : q)}</div>` : "";
  const memActs = (p) => p.id === D.me.id ? "" : `<span class="sx-mem-acts">${canCall ? `<button class="icon-btn" data-act="sxCall" data-id="${esc(p.id)}" data-video="0" aria-label="${esc(L3("Telepon suara", "Telepon suara", "Voice call"))}">${cic("voice")}</button><button class="icon-btn" data-act="sxCall" data-id="${esc(p.id)}" data-video="1" aria-label="${esc(L3("Panggilan video", "Telepon video", "Video call"))}">${cic("video")}</button>` : ""}<a class="icon-btn" href="#/chat/${esc(dmRoom(p.id))}" aria-label="${esc(L3("Kirim pesan", "Kirim pesan", "Message"))}">${ic("chat")}</a>${p.phone ? `<a class="icon-btn wa" href="${wa("", p.phone)}" target="_blank" rel="noopener" aria-label="WhatsApp">${ic("wa")}</a>` : ""}</span>`;
  const memSec = sec(L3("Anggota", "Ruas", "Members"), people.map((p) => `<div class="li">${avatarOf(p)}<span class="grow"><b>${esc(p.name)}</b><small>${esc([fmtPhone(p.phone), ...Object.keys(p.groups || {}).map((g) => gname(G(g))).filter(Boolean)].filter(Boolean).join(" · "))}</small></span>${memActs(p)}</div>`).join(""));
  const out = (callQ ? memSec + featSec : featSec + memSec)
    + (groups.length ? `<h3 class="sec-h">${esc(t("tab_groups"))}</h3><div class="glist">${groups.map((g) => groupTile(g, esc(t(g.kind === "service" ? "kindService" : "kindSermon")))).join("")}</div>` : "")
    + sec(L3("Acara", "Ulaon", "Events"), evs.map(eventRow).join(""))
    + sec(L3("Roster", "Roster", "Rosters"), lines.slice(0, 15).map(({ r, row, head }) => `<a class="li" href="${rosterHome(r.group_id, r.month)}"><span class="grow"><b>${esc(gname(G(r.group_id)))} · ${esc(row[0] || "")}</b><small>${esc(row.map((c, j) => (j && c ? `${head[j] || ""}: ${c}` : "")).filter(Boolean).join(" · "))}</small></span>${ic("chev", "chev")}</a>`).join(""))
    + sec(L3("File & video", "File & video", "Files & videos"), files.map((f) => `<div class="li"><span class="ftype">${f.link ? "▶" : esc(fileKind(f).toUpperCase())}</span><span class="grow"><b>${esc(f.title || f.file_name)}</b><small>${esc(gname(G(f.group_id)))}${f.day ? " · " + esc(fmtDay(f.day)) : ""}</small></span>${f.link ? `<a class="icon-btn" href="${esc(f.link)}" target="_blank" rel="noopener" aria-label="Video">${ic("screen")}</a>` : `<button class="icon-btn" data-act="openOffFile" data-id="${f.id}" aria-label="${esc(t("openOriginal"))}">${ic("file")}</button>`}</div>`).join(""))
    + sec(L3("Kiriman", "Kiriman", "Posts"), posts.map((p) => `<a class="li" href="#/g/${p.group_id}?tab=${p.kind === "sermon" ? "sermon" : "news"}"><span class="grow"><b>${esc(p.title || "")}</b><small>${esc(gname(G(p.group_id)))} · ${esc(String(p.body || "").slice(0, 70))}</small></span>${ic("chev", "chev")}</a>`).join(""));
  el.innerHTML = out + `<div id="searchDeep"></div>`; sxDecorate();
  clearTimeout(searchRun._t); searchRun._t = setTimeout(() => deepSearch(q), 250);
}
document.addEventListener("input", (e) => { if (e.target && e.target.id === "searchIn") searchRun(e.target.value); });

// ---------- Search finds app features too (YB 2026-10-31): "video call", "voice note", "profile photo", "daily verse", "Tarombo"…
// Each feature opens straight from the result. A call feature picks a person and starts the call; member results get call buttons.
// [id, emoji, [id, bt, en] title, [id, bt, en] subtitle, extra search words, where it goes (#/route or A.<action>), who sees it]
const SX_FEATS = () => [
  ["vcall", "📹", ["Panggilan video", "Telepon video", "Video call"], ["Pilih orang, lalu panggil", "Pilih jolma", "Pick a person and call"], "vc video call videocall facetime panggil telepon telpon kamera", "act:sxCallPick:1", () => callOk()],
  ["acall", "📞", ["Panggilan suara", "Telepon suara", "Voice call"], ["Pilih orang, lalu panggil", "Pilih jolma", "Pick a person and call"], "call phone telepon telpon panggil suara audio", "act:sxCallPick:0", () => callOk()],
  ["chat", "💬", ["Chat", "Chat", "Chat"], ["Grup dan pesan pribadi", "Grup dohot pesan", "Group chat and private messages"], "pesan message messages chat inbox obrolan", "#/chat", () => true],
  ["dm", "✏️", ["Pesan pribadi baru", "Pesan baru", "New private message"], ["Kirim pesan ke satu orang", "Kirim pesan", "Message one person"], "dm pm private pribadi japri pesan message baru new", "act:dmNew", () => true],
  ["vnote", "🎤", ["Pesan suara", "Pesan suara", "Voice note"], ["Buka Chat, lalu tekan 🎤 untuk merekam", "Bukka Chat, tekan 🎤", "Open Chat, then tap 🎤 to record"], "voice note voicenote vn rekam record audio suara pesan mic mikrofon", "#/chat", () => canVoice()],
  ["photo", "🖼️", ["Foto profil", "Foto profil", "Profile photo"], ["Ambil atau ganti foto Anda", "Ganti foto", "Take or change your photo"], "profile photo picture avatar foto gambar selfie profil", "act:photoPick", () => true],
  ["bread", "🍞", ["Ayat & renungan harian", "Ayat dohot renungan", "Daily verse & daily bread"], ["Ayat hari ini dan renungannya", "Ayat ari on", "Today's verse and reading"], "daily verse bread renungan harian ayat hari ini verse of the day devotion", "#/bread", () => true],
  ["sunday", "📅", ["Minggu Ini", "Minggu On", "This Sunday"], ["Tata Ibadah, lagu, nas dan live", "Tata Ibadah, ende, live", "Service order, songs, readings, live"], "minggu sunday ibadah service kebaktian", "#/sunday", () => true],
  ["tata", "📖", ["Tata Ibadah", "Tata Ibadah", "Service order"], ["Urutan ibadah Minggu", "Tata Ibadah", "The Sunday order of service"], "tata ibadah acara kebaktian liturgy order service", "#/tata", () => true],
  ["live", "🔴", ["Ikuti live", "Ihuthon live", "Follow live"], ["Ikuti ibadah yang sedang berlangsung", "Ihuthon live", "Follow the service as it happens"], "live siaran langsung stream", "#/live", () => true],
  ["library", "🎵", ["Alkitab & nyanyian", "Bibel dohot ende", "Bible & hymns"], ["KJ, Buku Ende, Buku Nyanyian, Alkitab", "KJ, BE, BN, Bibel", "KJ, BE, BN and the Bible"], "alkitab bible bibel lagu song songs hymn hymns nyanyian ende kj be bn kidung", "#/library", () => true],
  ["ende", "🎶", ["Arti Buku Ende", "Lapatan ni ende", "Buku Ende meanings"], ["Arti setiap baris lagu", "Lapatan ende", "The meaning of every hymn line"], "buku ende arti meaning lapatan translate", "#/ende", () => true],
  ["calendar", "🗓", ["Warnasari & acara", "Warnasari", "Calendar & events"], ["Acara gereja dan kategorial", "Ulaon", "Church and category events"], "warnasari kalender calendar acara event events agenda jadwal", "#/calendar", () => true],
  ["serve", "📋", ["Roster pelayanan", "Roster", "Service roster"], ["Siapa bertugas kapan", "Ise marhobas", "Who serves when"], "roster jadwal tugas duty duties pelayanan serve schedule", "#/serve", () => true],
  ["meet", "🖥", ["Rapat", "Rapat", "Meetings"], ["Rapat online dan tautan", "Rapat", "Online meetings and links"], "rapat meeting meetings zoom meet online", "#/meet", () => true],
  ["groups", "👥", ["Kategorial", "Kategorial", "Categories"], ["Sekolah Minggu, Remaja, Naposo, Ina, Ama…", "Kategorial", "Sunday School, Teens, Youth, Ina, Ama…"], "kategorial categories groups kelompok remaja naposo ina ama sekolah minggu pelaut", "#/groups", () => true],
  ["people", "🎂", ["Anggota & ulang tahun", "Ruas dohot ulang tahun", "Members & birthdays"], ["Daftar anggota dan ulang tahun", "Ruas", "Member list and birthdays"], "anggota members member birthday birthdays ulang tahun ultah jemaat", "#/people", () => true],
  ["prayer", "🙏", ["Pokok doa", "Pokok tangiang", "Prayer requests"], ["Bagikan dan ikut mendoakan", "Tangianghon", "Share and pray together"], "doa prayer pray tangiang pokok", "#/prayer", () => true],
  ["elders", "📰", ["Kabar Parhalado", "Barita Parhalado", "Elders' updates"], ["Kabar dari parhalado", "Barita", "News from the elders"], "kabar parhalado elders updates news sintua", "#/elders", () => true],
  ["berita", "📣", ["Berita Pelayanan", "Berita Pelayanan", "Service news"], ["Pengumuman gereja", "Barita", "Church announcements"], "berita pelayanan news announcement pengumuman warta", "#/berita", () => true],
  ["tarombo", "🌳", ["Tarombo", "Tarombo", "Tarombo"], ["Silsilah marga Batak", "Tarombo marga", "The Batak marga tree"], "tarombo silsilah marga family tree", "#/tarombo", () => true],
  ["tutur", "🤝", ["Partuturan", "Partuturan", "Partuturan"], ["Cara saling menyapa (Dalihan Na Tolu)", "Partuturan", "How to address each other"], "partuturan tutur dalihan na tolu address kinship sapaan", "#/tutur", () => true],
  ["stories", "🎙️", ["Turi-turian", "Turi-turian", "Elders' stories"], ["Cerita orang tua yang direkam", "Turi-turian", "Recorded stories from the elders"], "turi turian stories story cerita rekaman", "#/stories", () => true],
  ["grief", "🕊️", ["Dukacita", "Dukacita", "Grief support"], ["Dukung keluarga yang berduka", "Apuli na marsak", "Support a grieving family"], "dukacita grief duka mourning funeral meninggal", "#/grief", () => true],
  ["fx", "💱", ["Kurs", "Kurs", "Exchange rates"], ["Konversi mata uang", "Kurs", "Currency converter"], "kurs exchange rate currency sgd idr rupiah dollar", "#/fx", () => true],
  ["textsize", "🔠", ["Ukuran teks", "Balga ni surat", "Text size"], ["Perbesar huruf", "Pabalga surat", "Make the text larger"], "text size ukuran huruf font besar larger zoom", "act:textSize", () => true],
  ["notify", "🔔", ["Notifikasi", "Notifikasi", "Notifications"], ["Nyalakan pemberitahuan", "Notifikasi", "Turn on notifications"], "notifikasi notification notifications push bell pemberitahuan", "act:notify", () => true],
  ["install", "📲", ["Pasang di HP", "Pasang", "Install the app"], ["Tambahkan ke layar utama", "Pasang", "Add to the home screen"], "install pasang home screen layar utama aplikasi app", "act:install", () => true],
  ["profile", "🧾", ["Profil saya", "Profil", "My profile"], ["Kategori saya", "Kategori", "My categories"], "profil profile kategori status menikah married", "act:profile", () => profileOn()],
  ["lang_id", "🇮🇩", ["Bahasa Indonesia", "Bahasa Indonesia", "Bahasa Indonesia"], ["Ganti bahasa", "Ganti hata", "Change the language"], "bahasa language indonesia", "act:lang:id", () => true],
  ["lang_bt", "🗣", ["Bahasa Batak", "Hata Batak", "Batak language"], ["Ganti bahasa", "Ganti hata", "Change the language"], "bahasa language batak toba hata", "act:lang:bt", () => true],
  ["lang_en", "🇬🇧", ["English", "English", "English"], ["Ganti bahasa", "Ganti hata", "Change the language"], "bahasa language english inggris", "act:lang:en", () => true],
  ["voyage", "🚢", ["Mode berlayar", "Mode marlayar", "Voyage mode"], ["Paket offline untuk pelaut", "Pelaut", "Offline pack for seafarers"], "pelaut voyage ship kapal offline seafarer", "#/voyage", () => "pelaut" in (D.me.groups || {})],
  ["care", "🫶", ["Perlu dikunjungi", "Ingkon dikunjungi", "Time for a visit"], ["Jemaat yang lama tidak hadir", "Ruas na leleng so ro", "Members not seen for a while"], "kunjungan visit care pastoral", "#/care", () => "parhalado" in (D.me.groups || {})],
  ["rpp", "⚖️", ["RPP", "RPP", "RPP"], ["Daftar RPP dan tanya Juklak", "RPP", "RPP list and the Juklak"], "rpp juklak disiplin discipline", "#/rpp", () => isParhalado()],
  ["lit", "📜", ["Naskah Liturgi", "Naskah Paragenda", "Liturgy scripts"], ["Untuk liturgis", "Paragenda", "For the liturgist"], "liturgi liturgy liturgis paragenda naskah script", "#/lit", () => isLit()],
  ["sswb", "🧒", ["Workbench Sekolah Minggu", "Workbench SM", "Sunday School workbench"], ["Slide pelajaran", "Slide", "Lesson slides"], "sekolah minggu sunday school workbench slides", "#/sswb", () => !!D.ss_maker],
  ["office", "🔒", ["Kantor gereja", "Kantor", "Church office"], ["Sekretaris, Bendahara, Ketua", "Kantor", "Secretary, Treasurer, Chairman"], "kantor office sekretaris secretary bendahara treasurer ketua chairman warta", "#/o/secretary", () => isOffice() && manage()],
  ["password", "🔑", ["Ganti kata sandi", "Ganti sandi", "Change password"], ["", "", ""], "password kata sandi sandi pin", "act:password", () => manage()],
  ["checkinqr", "📷", ["QR Check-in", "QR Check-in", "QR check-in"], ["QR pintu gereja dan kehadiran", "QR", "Door QR and attendance"], "qr checkin check in kehadiran attendance absen", "#/checkinqr", () => D.me.is_admin && manage()],
  ["usage", "📊", ["Pemakaian fitur", "Pamakean fitur", "Feature usage"], ["Fitur yang dipakai jemaat", "Fitur", "Which features members use"], "usage pemakaian statistik stats analytics", "#/usage", () => !!D.me.is_admin],
  ["appstatus", "📶", ["Status aplikasi", "Status aplikasi", "App status"], ["Siapa sudah masuk dan notifikasi", "Status", "Who signed in, installed, notifications"], "app status aplikasi signed in masuk install", "#/appstatus", () => isAdmin() && isYB()],
  ["access", "🔐", ["Akses & tampilan", "Akses", "Access & views"], ["Periksa kategori dan lihat sebagai anggota", "Akses", "Check categories, view as any member"], "akses access views roles peran", "#/access", () => isYB()],
  ["settings", "⚙️", ["Pengaturan", "Pengaturan", "Settings"], ["", "", ""], "settings pengaturan setting config", "act:settings", () => isYB() && manage()],
];
// every word typed must appear in the feature's names or search words, in any of the three languages
function sxFeatFind(q) {
  const words = norm(q).split(" ").filter(Boolean); if (!words.length || isGuest()) return [];
  return SX_FEATS().filter((f) => { try { if (!f[6]()) return false; } catch (e) { return false; }
    const hay = " " + norm([...f[2], ...f[3], f[4]].join(" ")) + " "; return words.every((w) => hay.includes(" " + w) || (w.length >= 4 && hay.includes(w))); }).slice(0, 8);
}
function sxFeatRows(list, q) {
  return list.map((f) => { const [kind, a, b] = f[5].split(":"); const title = deepMark(L3(...f[2]), norm(q)); const sub = L3(...f[3]);
    const inner = `<span class="sx-lead">${f[1]}</span><span class="grow"><i class="sx-kick">${esc(L3("Fitur", "Fitur", "Feature"))}</i><b class="sx-t">${title}</b>${sub ? `<small class="sx-s">${esc(sub)}</small>` : ""}</span>${ic("chev", "chev")}`;
    return kind === "act" ? `<button class="li deep-li" data-act="sxFeat" data-id="${f[0]}">${inner}</button>` : `<a class="li deep-li" href="${esc(f[5])}">${inner}</a>`; }).join("");
}
A.sxFeat = (d, el) => { const f = SX_FEATS().find((x) => x[0] === d.id); if (!f) return; sxHistAdd((document.getElementById("searchIn") || {}).value);
  const [, a, b] = f[5].split(":"); if (a === "lang") return A.lang({ l: b }); if (a === "sxCallPick") return A.sxCallPick({ video: b });
  if (a === "notify") return A.notify(d, el); if (A[a]) A[a](d, el); };
// Pick a person, then the call starts at once and their private chat opens behind it.
A.sxCallPick = (d) => {
  const video = d.video === "1"; const people = (D.people || []).filter((p) => p.id !== D.me.id).sort((a, b) => a.name.localeCompare(b.name));
  sheet((video ? "📹 " : "📞 ") + (video ? L3("Panggilan video", "Telepon video", "Video call") : L3("Panggilan suara", "Telepon suara", "Voice call")), `<input type="search" id="callFind" placeholder="${esc(L3("Cari nama…", "Lului goar…", "Search a name…"))}" autocomplete="off" style="margin-bottom:8px">
    <div class="card call-pick">${people.map((p) => `<button class="li" data-act="sxCall" data-id="${esc(p.id)}" data-video="${video ? 1 : 0}" data-n="${esc(norm(p.name + " " + (p.alias || "")))}">${avatarOf(p)}<span class="grow"><b>${esc(p.name)}</b><small>${esc(seenText(p.id))}</small></span><span class="icon-btn sx-callic">${cic(video ? "video" : "voice")}</span></button>`).join("")}</div>`);
  setTimeout(() => { const i = document.getElementById("callFind"); if (i) i.focus(); }, 50);
};
document.addEventListener("input", (e) => { if (e.target && e.target.id === "callFind") { const q = norm(e.target.value); document.querySelectorAll(".call-pick .li").forEach((a) => (a.style.display = !q || a.dataset.n.includes(q) ? "" : "none")); } });
// start the call inside the tap (phones only allow the camera and microphone from a tap), then open the chat with that person
A.sxCall = (d) => { const p = (D.people || []).find((x) => x.id === d.id); if (!p || p.id === D.me.id) return; const room = dmRoom(p.id);
  if (document.getElementById("sheet") && typeof closeSheet === "function") closeSheet();
  sxHistAdd((document.getElementById("searchIn") || {}).value); A.callStart({ room, video: d.video }); location.hash = "#/chat/" + room; };
try { document.head.insertAdjacentHTML("beforeend", `<style>
  .sx-card .li .icon-btn + .icon-btn { margin-left: -4px; } .sx-callic { pointer-events: none; color: var(--brand); }
  .sx-mem-acts { display: flex; gap: 2px; flex: none; } .sx-mem-acts .icon-btn { width: 38px; height: 38px; }
</style>`); } catch (e) {}

// "This Sunday" on Home: the Tata Ibadah, your duty, who serves in each section, and that day's events.
function thisSundayCard() {
  if (isGuest()) return "";
  const sun = nextSunday(); const tata = (D.services || []).find((v) => v.service_date === sun);
  const mine = duties().filter((d) => d.date === sun);
  const serving = [];
  (D.rosters || []).forEach((r) => { if (r.file_name || r.link) return; const tb = (r.table_json || [])[0]; if (!tb) return; const rows = tb.rows || []; const head = rows[0] || [];
    rows.slice(1).forEach((row) => { if (rowDate(row, r.month) !== sun) return; const jobs = head.map((h, j) => [h, row[j]]).slice(1).filter(([h, w]) => h && w); if (jobs.length) serving.push({ g: G(r.group_id), jobs }); }); });
  const evs = (D.events || []).filter((e) => sgParts(e.starts_at).date === sun);
  return `<article class="card sunday"><div class="sun-head"><div class="sun-kick">⛪ ${esc(L3("Minggu ini", "Minggu on", "This Sunday"))}<small>${esc(fmt(sun, { weekday: "long", day: "numeric", month: "long" }))}</small></div><a class="sun-open" href="#/sunday">${esc(L3("Buka", "Bukka", "Open"))} ${ic("chev")}</a></div>
    <div class="sun-acts">${tata ? `<a href="#/tata/${tata.id}"><span>📖</span>${esc(L3("Tata Ibadah", "Tata Ibadah", "Order of service"))}</a>` : `<span class="off"><span>📖</span>${esc(L3("Tata Ibadah", "Tata Ibadah", "Order of service"))}</span>`}<a href="#/sunday"><span>🎵</span>${esc(L3("Lagu & Nas", "Ende & Turpuk", "Songs & readings"))}</a><a href="#/live"><span>🔴</span>Live</a></div>
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
  return (r.going || r.maybe ? ` · ✓ ${r.going}${r.maybe ? " · ? " + r.maybe : ""}` : "") + (r.mine ? ` · ${r.mine === "going" ? L3("Anda hadir", "Ro ho", "You're going") : r.mine === "maybe" ? L3("Mungkin", "Ra", "Maybe") : L3("Tidak hadir", "Ndang ro", "Not going")}` : "");
}
function rsvpBlock(e) {
  if (isGuest() || new Date(e.starts_at) < Date.now()) return ""; const r = rsvpOf(e);
  const b = (st, icon, label) => `<button type="button" class="rsvp-btn${r.mine === st ? " on" : ""}" data-act="rsvp" data-id="${e.id}" data-s="${st}"><span>${icon} ${esc(label)}</span><b>${r[st] || 0}</b></button>`;
  const who = (r.who || []).filter((x) => x.s === "going").map((x) => x.n);
  return `<div class="rsvp"><p class="small muted">${esc(L3("Apakah Anda hadir?", "Ro do ho?", "Are you coming?"))}</p><div class="rsvp-row">${b("going", "✓", L3("Hadir", "Ro", "Going"))}${b("maybe", "?", L3("Mungkin", "Ra", "Maybe"))}${b("no", "✕", L3("Tidak", "Ndang", "Can't"))}</div>${who.length ? `<p class="small muted">✓ ${esc(who.join(", "))}</p>` : ""}</div>`;
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
    <p class="lead">${esc(L3("Bagikan permohonan doa. Jemaat dapat ikut mendoakan, dan para sintua melihat semua permohonan.", "Bagi pangidoan tangiang. Ruas boi rap martangiang, jala sintua mamereng sude.", "Share a prayer request. Others can pray along, and the elders see every request."))}</p>
    <form class="card form" data-form="prayer"><label>${esc(L3("Permohonan doa", "Pangidoan", "Your request"))}<textarea name="body" rows="3" maxlength="1000" required></textarea></label>
      <label class="check"><input type="checkbox" name="anon"> ${esc(L3("Tanpa nama (sintua tetap melihat nama Anda)", "Ndang marhite goar (alai sintua mamereng goarmu)", "Without my name (the elders still see it)"))}</label>
      <button class="btn primary block">${ic("plus")} ${esc(L3("Kirim", "Kirim", "Post"))}</button></form>
    ${list.length ? list.map((p) => `<article class="card prayer${p.answered ? " done" : ""}"><div class="meta">${esc(p.name || L3("Anonim", "Anonim", "Anonymous"))}${p.anon && p.name ? " · " + esc(L3("tanpa nama", "anonim", "anonymous")) : ""} · ${esc(fmt(p.at, { day: "numeric", month: "short" }))}${p.answered ? ` · <span class="badge chair">✓ ${esc(L3("Terjawab", "Dialusi", "Answered"))}</span>` : ""}</div>
      <p class="pre">${esc(p.body)}</p>
      <div class="row between"><button class="btn sm${p.i_prayed ? " primary" : ""}" data-act="pray" data-id="${p.id}">🙏 ${esc(p.i_prayed ? L3("Sudah didoakan", "Nunga ditangianghon", "Prayed") : L3("Saya mendoakan", "Hutangianghon", "I prayed"))} · ${p.prayed}</button>
        ${p.mine || elder ? `<span class="row" style="margin:0"><button class="btn sm ghost" data-act="prayerDone" data-id="${p.id}" aria-label="${esc(L3("Terjawab", "Dialusi", "Answered"))}">✓</button><button class="btn sm danger" data-act="del" data-kind="prayer" data-id="${p.id}" aria-label="${esc(t("delete"))}">${ic("trash")}</button></span>` : ""}</div></article>`).join("")
      : empty(L3("Belum ada pokok doa.", "Ndang adong.", "No prayer requests yet."), "heart")}`, { back: "#/more", title: L3("Pokok Doa", "Pokok Tangiang", "Prayer requests") });
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
  <label>${esc(L3("Ucapan Anda", "Ucapanmu", "Your wish"))}<textarea name="body" rows="3" maxlength="300" required>${esc(L3(`Selamat ulang tahun, ${d.name}! Tuhan Yesus memberkati.`, `Selamat ari tubu, ${d.name}! Tuhanta mangaramoti.`, `Happy birthday, ${d.name}! God bless us.`))}</textarea></label>
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
  if (isGuest()) { LS.set("afterLogin", location.hash); return shell("#/home", `<div class="card center pad"><h2>👋 Check-in</h2><p class="muted">${esc(L3("Silakan masuk dulu agar kehadiran Anda tercatat.", "Bongot jolo.", "Sign in first, then you're checked in."))}</p><button class="btn primary" data-act="signIn">${ic("lock")} ${esc(t("signIn"))}</button></div>`, { title: "Check-in" }); }
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
    ${days.length ? `<div class="tbl-wrap"><table class="tbl"><tr><th>${esc(t("f_date"))}</th>${CATS.map((c) => `<th>${esc(c)}</th>`).join("")}<th>Total</th></tr>${days.map((d) => { const c = att[d]; const tot = Object.values(c).reduce((a, b) => a + b, 0); return `<tr><td>${esc(fmt(d, { day: "numeric", month: "short" }))}</td>${CATS.map((k) => `<td>${c[k] || ""}</td>`).join("")}<td><b>${tot}</b></td></tr>`; }).join("")}</table></div>` : `<p class="muted small">${esc(L3("Belum ada check-in.", "Ndang adong.", "No check-ins yet."))}</p>`}`,
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
  #view > main { animation: pageIn .22s ease-out backwards; }
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
  .ch-voice { display: flex; align-items: center; gap: 10px; min-width: 190px; }
  .ch-voice button { width: 38px; height: 38px; flex: none; border-radius: 50%; border: 0; display: grid; place-items: center; background: var(--brand); color: #fff; font-size: 15px; }
  .ch-msg.mine .ch-voice button { background: #fff; color: var(--brand); }
  .ch-vbar { flex: 1; height: 6px; border-radius: 99px; background: color-mix(in srgb, currentColor 22%, transparent); overflow: hidden; }
  .ch-vbar i { display: block; height: 100%; width: 0; background: currentColor; border-radius: 99px; }
  .ch-voice small { font-variant-numeric: tabular-nums; font-size: 12.5px; opacity: .85; min-width: 34px; text-align: right; }
  .ch-rec { display: flex; align-items: center; gap: 10px; padding: 4px 4px 4px 12px; border-radius: 24px; background: var(--surface); border: 1px solid var(--line); }
  .ch-rec[hidden], .ch-pend[hidden] { display: none; } .ch-bar textarea, .ch-bar .ch-row { min-width: 0; }
  .ch-rec .dot { width: 12px; height: 12px; border-radius: 50%; background: #e5484d; animation: chRec 1s infinite; }
  .ch-rec b { font-variant-numeric: tabular-nums; } .ch-rec .grow { color: var(--muted); font-size: 13px; }
  @keyframes chRec { 50% { opacity: .25; } }
  .ch-rxs { display: flex; gap: 4px; flex-wrap: wrap; }
  .ch-rx { border: 1px solid var(--line); background: var(--surface); border-radius: 999px; padding: 1px 8px; font-size: 13px; font-weight: 700; color: var(--ink); }
  .ch-rx.me { border-color: var(--brand); background: color-mix(in srgb, var(--brand) 12%, var(--surface)); }
  .ch-acts { display: flex; gap: 4px; flex-wrap: wrap; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 4px; box-shadow: var(--shadow-lg); }
  .ch-acts button { border: 0; background: transparent; font-size: 18px; padding: 4px 6px; border-radius: 10px; }
  .ch-acts button:nth-last-child(-n+2) { font-size: 13px; font-weight: 700; color: var(--brand); }
  .ch-time { font-size: 11.5px; color: var(--muted); padding: 0 8px; }
  .ch-msg.has-av { position: relative; padding-left: 40px; max-width: calc(82% + 40px); }
  .ch-msg.ch-head { margin-top: 6px; }
  .ch-av { position: absolute; left: 0; top: 20px; }
  .ch-av .avatar { width: 32px; height: 32px; font-size: 12px; }
  .ch-av .pres { width: 10px; height: 10px; border-width: 2px; }
  .pf-prev { display: grid; place-items: center; margin: 4px 0 14px; }
  .avatar.xl { width: 112px; height: 112px; font-size: 36px; }
  .avatar.xl .pres { display: none; }
  .pf-photo { display: inline-flex; align-items: center; gap: 6px; margin-top: 6px; }
  .pf-photo .ic { width: 15px; height: 15px; }
  .gicon.has-ph { overflow: hidden; padding: 0; background: var(--surface); }
  .gicon.has-ph img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .gpic-btn { position: relative; border: 0; background: none; padding: 0; border-radius: 20px; flex: none; cursor: pointer; }
  .gpic-btn .avatar-edit { right: -4px; bottom: -4px; }
  .pf-prev .gicon.xl { width: 112px; height: 112px; border-radius: 28px; background: color-mix(in srgb, var(--gc, var(--brand)) 14%, var(--surface)); color: var(--gc, var(--brand)); }
  .pf-prev .gicon.xl .ic { width: 52px; height: 52px; }
  .pic-saved { display: flex; gap: 14px; flex-wrap: wrap; margin: 6px 0; }
  .pic-saved-i { display: grid; gap: 6px; justify-items: center; align-content: start; }
  .pic-saved-i img { width: 84px; height: 84px; border-radius: 18px; object-fit: cover; border: 2px solid var(--line); }
  .pic-saved-i.on img { border-color: var(--brand); }
  .pic-saved-i .row { gap: 6px; }
  .ch-ghead { display: flex; align-items: center; justify-content: center; gap: 10px; margin: 8px 0 0; }
  .ch-ghead .gicon { width: 36px; height: 36px; border-radius: 12px; }
  .ch-online { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 12.5px; color: var(--muted); margin: 6px 0 0; min-height: 18px; }
  .ch-online i { width: 9px; height: 9px; border-radius: 50%; background: #22c55e; display: inline-block; }
  .ch-bar { position: fixed; left: 0; right: 0; bottom: calc(66px + env(safe-area-inset-bottom)); z-index: 19; display: grid; gap: 6px; padding: 8px max(12px, env(safe-area-inset-left)); isolation: isolate; border-top: 1px solid var(--line); }
  .ch-bar::before { content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none; background: color-mix(in srgb, var(--bg) 92%, transparent); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); } /* blur behind the bar, not on it, so iPhone text stays sharp */
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
const seenText = (id) => { if (isLive(id)) return L3("Sedang aktif", "Adong di aplikasi", "Live now"); const t0 = seenAt(id); if (!t0) return L3("Belum aktif", "Ndang adong", "Not seen yet");
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
  ...chatGroupRooms(),
];
// Category chats (YB 2026-10-31): one room per category or section you belong to (the admin sees all).
// The server decides who may use which: hk_data lists them in chat_last as "g:<group id>".
function chatGroupRooms() {
  if (!D || !D.chat_last || isGuest()) return [];
  const KO = { sermon: 1, service: 2, office: 3 };
  return Object.keys(D.chat_last).filter((k) => k.startsWith("g:")).map((k) => G(k.slice(2))).filter(Boolean)
    .sort((x, y) => (KO[x.kind] || 9) - (KO[y.kind] || 9) || (x.sort || 0) - (y.sort || 0))
    .map((g) => ({ id: "g:" + g.id, name: gname(g), sub: g.kind === "sermon" ? L3("Kategorial", "Kategorial", "Category") : g.kind === "office" ? L3("Kantor", "Kantor", "Office") : L3("Seksi pelayanan", "Seksi", "Service section"), color: g.color, icon: g.icon, gid: g.id, group: true }));
}
const REACTS = ["🙏", "❤️", "👍", "😂", "🎉"];
let CH = { room: null, msgs: [], last: 0, timer: null, sending: false, reacts: {}, sel: null, reply: null, image: null };
// Unread: the newest message id per room (from the app data) against the last one this phone showed.
function chatSeen() { let s = LS.get("chatSeen", null); if (!s) { s = { ...((D && D.chat_last) || {}) }; LS.set("chatSeen", s); } return s; }
function markChatSeen(room, id) { const s = chatSeen(); if (id && (s[room] || 0) < id) { s[room] = id; LS.set("chatSeen", s); } }
const chatUnread = (room) => !!D && !isGuest() && (String(room).startsWith("dm:") ? ((D.dms || []).find((x) => x.room === room) || {}).unread > 0 : ((D.chat_last && D.chat_last[room]) || 0) > (chatSeen()[room] || 0));
const dmUnread = () => (D && D.dms ? D.dms.reduce((n, x) => n + (x.unread || 0), 0) : 0);
function chatHtml() {
  if (!CH.msgs.length) return empty(L3("Belum ada pesan. Mulai percakapan!", "Ndang adong pesan. Mulai ma!", "No messages yet. Start the conversation!"), "people");
  let lastDay = ""; const me = D.me.name;
  return CH.msgs.map((m) => {
    const mine = m.member_id === D.me.id; const day = sgParts(m.at).date;
    const sep = day !== lastDay ? `<div class="ch-day">${esc(day === today() ? t("today") : fmt(day, { weekday: "long", day: "numeric", month: "long" }))}</div>` : ""; lastDay = day;
    const rx = CH.reacts[m.id] || {}; const sel = CH.sel === m.id;
    const chips = Object.keys(rx).map((e) => `<button class="ch-rx${rx[e].includes(me) ? " me" : ""}" data-act="chatReact" data-id="${m.id}" data-e="${e}" title="${esc(rx[e].join(", "))}">${e} ${rx[e].length}</button>`).join("");
    const dm = String(CH.room || "").startsWith("dm:"); const lastMine = dm && mine && !CH.msgs.slice(CH.msgs.indexOf(m) + 1).some((x) => x.member_id === D.me.id);
    const seen = lastMine ? `<small class="ch-seen">${CH.otherRead >= m.id ? "✓✓ " + esc(L3("Dilihat", "Dibereng", "Seen")) : "✓ " + esc(L3("Terkirim", "Tarkirim", "Sent"))}</small>` : "";
    // Profile photo beside other people's messages (YB 2026-10-31): photo + name on the first message of a run, a gap under it after that.
    const prev = CH.msgs[CH.msgs.indexOf(m) - 1]; const head = !!sep || !prev || prev.member_id !== m.member_id;
    const av = !mine && !dm; const who = (D.people || []).find((q) => q.id === m.member_id) || { id: m.member_id, name: m.name };
    return `${sep}<div class="ch-msg${mine ? " mine" : ""}${sel ? " sel" : ""}${av ? " has-av" : ""}${av && head ? " ch-head" : ""}">${av && head ? `<span class="ch-av">${avatarOf(who)}</span><b class="ch-name">${esc(m.name || "")}</b>` : ""}
      <div class="ch-bubble" data-act="chatMsg" data-id="${m.id}">${m.reply ? `<span class="ch-quote"><b>${esc(m.reply.name || "")}</b>${esc(m.reply.body || "")}</span>` : ""}${m.image ? `<img class="ch-img" src="${esc(m.image)}" alt="" data-act="chatImg" data-id="${m.id}">` : ""}${m.has_audio ? chatVoiceHtml(m) : ""}${m.body ? `<span>${esc(m.body).replace(/\n/g, "<br>")}</span>` : ""}${!m.body && !m.image && !m.has_audio ? `<span class="muted small">🗂️ ${esc(L3("Berkas dihapus setelah bulannya berakhir", "Berkas nunga dihapus dung bulanna", "File removed after its month"))}</span>` : ""}</div>
      ${chips ? `<div class="ch-rxs">${chips}</div>` : ""}
      ${sel ? `<div class="ch-acts">${REACTS.map((e) => `<button data-act="chatReact" data-id="${m.id}" data-e="${e}">${e}</button>`).join("")}<button data-act="chatReply" data-id="${m.id}">↩︎ ${esc(L3("Balas", "Balas", "Reply"))}</button>${mine || D.me.is_admin ? `<button data-act="chatDel" data-id="${m.id}">${esc(t("delete"))}</button>` : ""}</div>` : ""}
      <small class="ch-time">${esc(fmtTime(m.at))}</small>${seen}</div>`;
  }).join("");
}
function chatPaint(scroll) { const box = document.getElementById("chatBox"); if (!box) return; const atEnd = window.innerHeight + window.scrollY >= document.body.scrollHeight - 120; box.innerHTML = chatHtml(); if (scroll || atEnd) window.scrollTo(0, document.body.scrollHeight); }
function chatPending() {
  const el = document.getElementById("chReply"); if (!el) return;
  const bits = [];
  if (CH.reply) bits.push(`<span class="grow">↩︎ <b>${esc(CH.reply.name || "")}</b> ${esc(String(CH.reply.body || (CH.reply.has_audio ? "🎤 " + L3("Pesan suara", "Pesan suara", "Voice note") : CH.reply.image ? "📷" : "🗂️")).slice(0, 60))}</span>`);
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
  if (!room) return shell("#/chat", `<h2 class="page-h">💬 Chat</h2><p class="lead">${esc(L3("Percakapan dua arah. Ketuk salah satu ruang untuk membukanya.", "Marhata dua arah. Ketuk sada ruang asa terbuka.", "Two-way conversations. Tap a room to open it."))}</p>
    <div class="glist">${rooms.map((r, i) => `${r.group && !rooms[i - 1].group ? `</div><h3 class="sec-h">${esc(L3("Kategorial & seksi", "Kategorial & seksi", "Categories & sections"))}</h3><div class="glist">` : ""}<a class="gtile" href="#/chat/${r.id}" style="--gc:${r.color || (r.id === "makers" ? "var(--gold)" : "var(--brand)")}">${r.gid ? gIcon(G(r.gid)) : `<span class="gicon">${ic(r.icon || (r.id === "makers" ? "gear" : "people"))}</span>`}<span class="gname"><b>${esc(r.name)}</b><small>${esc(r.sub)}</small></span>${newBadge(chatUnread(r.id))}${ic("chev", "chev")}</a>`).join("")}</div>
    <div class="row between" style="margin:18px 0 6px"><h3 class="sec-h" style="margin:0">${esc(L3("Pesan pribadi", "Pesan pribadi", "Private messages"))}</h3><button class="btn sm primary" data-act="dmNew">✏️ ${esc(L3("Pesan baru", "Pesan baru", "New message"))}</button></div>
    ${(D.dms || []).length ? `<div class="card dm-list">${D.dms.map((x) => { const p = (D.people || []).find((q) => q.id === x.other) || { id: x.other, name: x.name };
      return `<a class="li${x.unread ? " unread" : ""}" href="#/chat/${esc(x.room)}">${avatarOf(p)}<span class="grow"><b>${esc(x.name || "")}</b><small>${x.last_mine ? esc(L3("Anda: ", "Ho: ", "You: ")) : ""}${esc(x.last || "")}</small></span><span class="dm-meta"><small>${esc(sgParts(x.at).date === today() ? fmtTime(x.at) : fmt(x.at, { day: "numeric", month: "short" }))}</small>${x.unread ? `<b class="dm-n">${x.unread}</b>` : ""}</span></a>`; }).join("")}</div>`
      : `<p class="muted small">${esc(L3("Belum ada pesan pribadi. Ketuk “Pesan baru” untuk mengirim pesan ke seorang anggota.", "Ndang adong.", "No private messages yet. Tap “New message” to write to a member."))}</p>`}`);
  let rm = rooms.find((r) => r.id === room);
  if (!rm && String(room).startsWith("dm:")) { const oid = room.slice(3).split(":").find((x) => x !== D.me.id); const op = (D.people || []).find((p) => p.id === oid);
    if (op && room === dmRoom(oid)) rm = { id: room, name: op.name, sub: seenText(oid), dm: oid }; }
  if (!rm) return R.notFound();
  if (CH.room !== room) { CH.room = room; CH.msgs = []; CH.last = 0; CH.reacts = {}; CH.sel = null; CH.reply = null; CH.image = null; CH.otherRead = 0; voiceStop(); }
  clearInterval(CH.timer);
  CH.timer = setInterval(() => { if (!new RegExp("^#/chat/" + CH.room + "\\b").test(location.hash)) { clearInterval(CH.timer); return; } if (!document.hidden) chatLoad(false).catch(() => {}); }, 4000);
  setTimeout(() => { chatPending(); chatLoad(true).catch((e) => toast(errMsg(e), true)); }, 0);
  return shell("#/chat", `${rm.gid && G(rm.gid) ? `<div class="ch-ghead" style="--gc:${G(rm.gid).color}">${gIcon(G(rm.gid))}<b>${esc(rm.name)}</b></div>` : ""}<p class="ch-online" id="chOnline"></p><div id="chatBox" class="chat">${CH.msgs.length ? chatHtml() : skel(4)}</div>
    <div class="ch-bar"><div class="ch-pend" id="chReply" hidden></div><div class="ch-rec" id="chRec" hidden></div><div class="ch-row"><button class="icon-btn" data-act="chatPhoto" aria-label="${esc(L3("Kirim foto", "Kirim foto", "Send a photo"))}">${ic("camera")}</button>
      <textarea id="chatIn" rows="1" maxlength="1000" placeholder="${esc(L3("Tulis pesan…", "Surathon pesan…", "Write a message…"))}"></textarea>${canVoice() ? `<button class="icon-btn ch-mic" data-act="chatMic" aria-label="${esc(L3("Rekam pesan suara", "Rekam pesan suara", "Record a voice note"))}">${ic("mic")}</button>` : ""}<button class="btn primary" data-act="chatSend" aria-label="${esc(L3("Kirim", "Kirim", "Send"))}">➤</button></div></div>`,
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
// ---------- Voice notes in chat (YB 2026-10-31) ----------
// Tap 🎤 to record (up to 2 minutes), ➤ sends, ✕ throws it away. The note is saved on the server with the message, so it can be
// played later; the sound itself is only downloaded when someone taps ▶. Phones record AAC (.m4a) where they can,
// because every iPhone and Android plays it; older Androids fall back to Opus.
const VOICE_MAX = 120000;
const canVoice = () => !!(window.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
const voiceTime = (ms) => { const s = Math.max(0, Math.round((ms || 0) / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
const VOICE = { rec: null, stream: null, chunks: [], start: 0, tick: null, audio: null, playing: null, cache: {}, raf: null };
function chatVoiceHtml(m) {
  const on = VOICE.playing === m.id;
  return `<span class="ch-voice" data-vid="${m.id}"><button data-act="chatPlay" data-id="${m.id}" aria-label="${esc(on ? L3("Jeda", "Jeda", "Pause") : L3("Putar pesan suara", "Putar pesan suara", "Play voice note"))}">${on ? "❚❚" : "▶"}</button><span class="ch-vbar"><i></i></span><small>${esc(voiceTime(m.audio_ms))}</small></span>`;
}
function voiceStrip() {
  const rec = document.getElementById("chRec"), row = document.querySelector(".ch-bar .ch-row"); if (!rec || !row) return;
  const on = !!VOICE.rec; rec.hidden = !on; row.style.display = on ? "none" : "";
  if (on) rec.innerHTML = `<i class="dot"></i><b id="chRecT">0:00</b><span class="grow">${esc(L3("Merekam… maks. 2 menit", "Mangrekam… maks. 2 menit", "Recording… up to 2 min"))}</span>
    <button class="icon-btn" data-act="chatMicCancel" aria-label="${esc(t("cancel"))}">${ic("x")}</button><button class="btn primary" data-act="chatMicSend" aria-label="${esc(L3("Kirim", "Kirim", "Send"))}">➤</button>`;
}
function voiceStop() {   // stops recording (nothing is sent) and playback
  if (VOICE.rec) { VOICE.rec.onstop = null; try { VOICE.rec.stop(); } catch (e) {} }
  if (VOICE.stream) VOICE.stream.getTracks().forEach((tr) => tr.stop());
  clearInterval(VOICE.tick); VOICE.rec = null; VOICE.stream = null; VOICE.chunks = [];
  if (VOICE.audio) { VOICE.audio.pause(); } VOICE.playing = null; cancelAnimationFrame(VOICE.raf);
  voiceStrip();
}
A.chatMic = async () => {
  if (VOICE.rec || !canVoice()) return;
  if (VOICE.audio) { VOICE.audio.pause(); VOICE.playing = null; chatPaint(false); }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch (e) { toast(L3("Izinkan mikrofon untuk Sada di pengaturan HP.", "Loas mikrofon tu Sada di pengaturan HP.", "Allow the microphone for Sada in your phone's settings."), true); return; }
  const type = ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/aac", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find((x) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(x));
  let rec; try { rec = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 48000 } : { audioBitsPerSecond: 48000 }); } catch (e) { rec = new MediaRecorder(stream); }
  VOICE.rec = rec; VOICE.stream = stream; VOICE.chunks = []; VOICE.start = Date.now();
  rec.ondataavailable = (e) => { if (e.data && e.data.size) VOICE.chunks.push(e.data); };
  rec.start(); voiceStrip();
  VOICE.tick = setInterval(() => { const ms = Date.now() - VOICE.start; const el = document.getElementById("chRecT"); if (el) el.textContent = voiceTime(ms);
    if (ms >= VOICE_MAX) { const b = document.querySelector('[data-act="chatMicSend"]'); if (b) A.chatMicSend(b.dataset, b); }
    if (!/^#\/chat\//.test(location.hash)) voiceStop(); }, 250);
};
A.chatMicCancel = () => voiceStop();
A.chatMicSend = (d, btn) => {
  const rec = VOICE.rec; if (!rec || CH.sending) return;
  const ms = Math.min(VOICE_MAX, Date.now() - VOICE.start); const room = CH.room; if (btn) btn.disabled = true;
  rec.onstop = async () => {
    const chunks = VOICE.chunks; const type = (rec.mimeType || (chunks[0] && chunks[0].type) || "audio/mp4");
    if (VOICE.stream) VOICE.stream.getTracks().forEach((tr) => tr.stop()); clearInterval(VOICE.tick); VOICE.rec = null; VOICE.stream = null; VOICE.chunks = []; voiceStrip();
    if (ms < 700 || !chunks.length) { toast(L3("Terlalu pendek. Ketuk 🎤 lalu bicara.", "Pandok hian.", "Too short. Tap 🎤 and speak."), true); return; }
    const blob = new Blob(chunks, { type: type.split(";")[0] });
    const data = await new Promise((ok, no) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result)); fr.onerror = no; fr.readAsDataURL(blob); });
    const audio = data.replace(/^data:[^;,]*/, "data:" + type.split(";")[0]);
    if (audio.length > 2900000) { toast(L3("Pesan suara terlalu besar.", "Balga hian.", "The voice note is too big."), true); return; }
    CH.sending = true;
    try {
      const m = await api.save("chat", { room, body: "", reply_to: CH.reply ? CH.reply.id : null, audio, audio_ms: ms });
      CH.reply = null; chatPending();
      if (m && m.id) { VOICE.cache[m.id] = URL.createObjectURL(blob); if (CH.room === room && !CH.msgs.some((x) => x.id === m.id)) { CH.msgs.push(m); CH.last = Math.max(CH.last, m.id); markChatSeen(CH.room, CH.last); } }
      chatPaint(true);
    } catch (e) { toast(e && /too_fast/.test(e.message || e.code || "") ? L3("Terlalu cepat, tunggu sebentar.", "Hatop hian, paima jolo.", "Too fast, wait a moment.") : errMsg(e), true); }
    finally { CH.sending = false; }
  };
  rec.stop();
};
// Playing: the <audio> is started inside the tap (iPhones only allow sound that starts from a tap), then gets the sound once it has downloaded.
const SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
window.addEventListener("hashchange", () => { if (!/^#\/chat\//.test(location.hash) && (VOICE.rec || VOICE.playing != null)) voiceStop(); });
function voicePaintPos() {
  const a = VOICE.audio, id = VOICE.playing; if (!a || id == null) return;
  const m = CH.msgs.find((x) => x.id === id); const box = document.querySelector(`.ch-voice[data-vid="${id}"]`);
  if (box) { const dur = isFinite(a.duration) && a.duration > 0 ? a.duration * 1000 : (m && m.audio_ms) || 1; const at = a.currentTime * 1000;
    box.querySelector("i").style.width = Math.min(100, (at / dur) * 100) + "%"; box.querySelector("small").textContent = voiceTime(at); }
  VOICE.raf = requestAnimationFrame(voicePaintPos);
}
A.chatPlay = async (d) => {
  const id = +d.id; const room = CH.room;
  if (!VOICE.audio) { VOICE.audio = new Audio(); VOICE.audio.preload = "auto"; VOICE.audio.setAttribute("playsinline", ""); VOICE.audio.onended = () => { VOICE.playing = null; cancelAnimationFrame(VOICE.raf); chatPaint(false); }; }
  const a = VOICE.audio;
  if (VOICE.playing === id) { a.pause(); VOICE.playing = null; cancelAnimationFrame(VOICE.raf); chatPaint(false); return; }
  a.pause(); cancelAnimationFrame(VOICE.raf); VOICE.playing = id; chatPaint(false);
  if (!VOICE.cache[id]) { a.src = SILENT; a.play().catch(() => {}); }   // unlocks sound on iPhone while the note downloads
  try {
    if (!VOICE.cache[id]) {
      const r = await api.save("chat_audio", { room, id }); if (!r || !r.audio) throw new Error(L3("Pesan suara tidak ditemukan.", "Ndang dapot.", "Voice note not found."));
      const bin = atob(r.audio.split(",")[1]); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      VOICE.cache[id] = URL.createObjectURL(new Blob([u8], { type: r.audio.slice(5, r.audio.search(/[;,]/)) }));
    }
    if (VOICE.playing !== id) return;
    a.src = VOICE.cache[id]; await a.play(); voicePaintPos();
  } catch (e) {
    if (VOICE.playing === id) { VOICE.playing = null; chatPaint(false); }
    toast(e && e.name === "NotSupportedError" ? L3("HP ini tidak bisa memutar pesan suara ini. Perbarui iOS/Android.", "HP on ndang boi mamutar.", "This phone can't play this voice note. Please update iOS/Android.") : errMsg(e), true);
  }
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
    <div class="pick-list">${D.groups.filter((g) => g.kind === "service").map((g) => `<label class="pick" style="--gc:${g.color}"><input type="checkbox" name="sv" value="${esc(g.id)}" ${sv.includes(g.id) ? "checked" : ""}>${gIcon(g)}<b>${esc(gname(g))}</b><i class="tick">${ic("check")}</i></label>`).join("")}</div>
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
  if (isMMMaker()) setTimeout(() => liveCodePaint(), 0);
  return shell("#/serve", `
    <div class="tata-view"><div class="tata-frame" data-tata="${v.id}"><span class="spin"></span></div></div>
    <p class="small muted center">${esc(t("tataRotate"))}</p>
    ${isMMMaker() ? `<button class="btn block${LIVE.on === v.id ? " primary" : ""}" data-act="liveToggle" data-id="${v.id}">📡 ${esc(LIVE.on === v.id ? L3("Siaran live aktif · ketuk untuk berhenti", "Siaran live · ketuk asa mansai", "Live to members' phones · tap to stop") : L3("Siarkan slide ke HP jemaat", "Siarhon slide tu HP ruas", "Broadcast slides to members' phones"))}</button>` : ""}
    ${isMMMaker() ? `<div class="card live-code"><span class="grow"><b>📡 ${esc(L3("Kode live (file lama)", "Kode live (file na robi)", "Live code (older files)"))}: <span id="liveCode">······</span></b><small>${esc(L3("File dari workbench sekarang live otomatis: buka file di laptop gereja pada hari ibadah (06.00–14.00) lalu pindah slide, tanpa kode. Kode ini hanya untuk file lama.", "File sian workbench live otomatis di ari parmingguon. Kode on holan tu file na robi.", "Files from the workbench now go live by themselves: open the file on the church laptop on the service day (06:00–14:00) and move a slide, no code needed. This code is only for older files."))}</small></span><button class="btn sm" data-act="liveCodeNew">${esc(L3("Ganti", "Ganti", "Change"))}</button></div>` : ""}
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
// The daily bread source as a readable label (the raw key "src_verse" showed under More; YB 2026-10-31). Same choice as breadSetup.
function breadSrcLabel() {
  const v = (D.settings || {}).bread_source || ""; const src = /^claude/.test(v) || !v ? "verse" : v;
  return src === "elders" ? L3("Hanya ditulis sintua", "Sian sintua sambing", "Written by elders only") : L3("Ayat Harian otomatis", "Ayat siganup ari", "Automatic verse of the day");
}
A.breadSetup = () => {
  if (!$("#sheet").hidden && $("#sheet [data-form=breadsetup]")) return;
  const st = D.settings || {}; const cur = /^claude/.test(st.bread_source || "") || !st.bread_source ? "verse" : st.bread_source; const hr = +(st.bread_hour ?? 6); const bl = st.bread_lang || lang;
  const senders = Array.isArray(st.wa_senders) ? st.wa_senders : [me().id];
  const elders = D.people.filter((p) => p.is_admin || "parhalado" in (p.groups || {}) || p.id === me().id);
  sheet(t("bs_title"), `<form class="form" data-form="breadsetup">
    <p class="muted">${esc(t("bs_lead"))}</p>
    <fieldset class="opts"><legend>${esc(t("bs_source"))}</legend>
      ${[["verse", L3("Ayat Harian otomatis (gratis)", "Ayat siganup ari (otomatis)", "Automatic verse of the day (free)"), L3("Bila belum ada renungan dari sintua, Sada mengirim ayat pilihan (TB / Toba) dengan doa singkat.", "Molo dang adong sian sintua, Sada mangirim ayat.", "If no elder has written one, Sada sends a chosen verse (TB / Toba) with a short prayer.")], ["elders", L3("Hanya ditulis sintua", "Sian sintua sambing", "Written by elders only"), L3("Renungan dikirim hanya bila sintua menuliskannya.", "Holan molo ditulis sintua.", "Sent only when an elder writes one.")]].map(([v, a1, b1]) => `<label class="opt"><input type="radio" name="source" value="${v}" ${cur === v ? "checked" : ""}><span><b>${esc(a1)}</b><small>${esc(b1)}</small></span></label>`).join("")}
    </fieldset>
    <div class="row two"><label>${esc(t("bs_lang"))}<select name="blang">${["id", "bt"].map((l) => `<option value="${l}" ${l === bl ? "selected" : ""}>${esc(t("lang_" + l))}</option>`).join("")}</select></label>
      <label>${esc(t("bs_time"))}<select name="bhour">${[4, 5, 6, 7, 8, 9].map((h) => `<option value="${h}" ${h === hr ? "selected" : ""}>${String(h).padStart(2, "0")}:00</option>`).join("")}</select></label></div>
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
  // no key needed: the verse of the day is free
  const link = f.walink.value.trim();
  if (link && !/^https:\/\/(chat\.whatsapp\.com|wa\.me|whatsapp\.com)\//.test(link)) throw new S.AppError("bad_wa_link");
  await api.settingsSave({ bread_source: source, bread_lang: f.blang.value, bread_hour: +f.bhour.value, wa_group_link: link, wa_senders: [...f.querySelectorAll("[name=sender]:checked")].map((x) => x.value), setup_done: true });
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
  const list = (kind) => cats.filter((g) => g.kind === kind).map((g) => `<button class="gtile" data-act="evPick" data-g="${g.id}" style="--gc:${g.color}">${gIcon(g)}<span class="gname"><b>${esc(gname(g))}</b></span>${ic("chev", "chev")}</button>`).join("");
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
A.breadLang = (d) => { LS.set("breadLang", d.l); render(); };
A.copyBread = async (d) => { const b = D.bread.find((x) => x.day === d.day); try { await navigator.clipboard.writeText(breadText(b)); toast(t("copied")); } catch { toast(t("err_server"), true); } };
A.genOne = async (d, btn) => {
  const f = btn.closest("form");
  await busy(btn, async () => {
    try { const r = await claudeBread(f.day.value, f.glang.value, D.bread.slice(0, 30).map((b) => b.verse).filter(Boolean)); f.verse.value = r.verse || ""; f.title.value = r.title || ""; f.body.value = r.body || ""; toast(t("genDone")); }
    catch (e) { toast(errMsg(e), true); }
  });
};
A.genWeek = async (d, btn) => {
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
    const f = el.querySelector("form"); rrFill(f); rrCheckNow(f); f.day.addEventListener("change", () => { rrFill(f); rrCheckNow(f); });
    f.addEventListener("input", (e) => { if (e.target.matches("[name=who], [name=job]")) rrCheckSoon(f); });
  });
};
A.rrAdd = (d, btn) => { const box = btn.closest("form").querySelector(".rr-rows"); box.insertAdjacentHTML("beforeend", rrRow()); box.lastElementChild.querySelector("input").focus(); };
A.rrRm = (d, btn) => { const r = btn.closest(".rr-row"); if (!r) return; const f = r.closest("form"); const nx = r.nextElementSibling; if (nx && nx.classList.contains("rr-clash")) nx.remove(); r.remove(); if (f && f.dataset.form === "rosterday") rrCheckSoon(f); };
// The month's table with this form's Sunday put in (used by the live check and by Save).
function rrBuild(f) {
  const gid = f.dataset.g; const day = f.day.value; if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const pairs = [...f.querySelectorAll(".rr-row")].map((r) => [r.querySelector("[name=job]").value.trim(), r.querySelector("[name=who]").value.trim()]).filter(([j]) => j);
  const ym = day.slice(0, 7); const old = manualRoster(gid, ym);
  const head = old ? old.table_json[0].rows[0].slice() : [L3("Tanggal", "Tanggal", "Date")];
  pairs.forEach(([j]) => { if (!head.slice(1).some((h) => norm(h) === norm(j))) head.push(j); });
  const pad = (r) => head.map((_, i) => r[i] || "");
  const others = old ? old.table_json[0].rows.slice(1).filter((x) => rowDate(x, ym) !== day).map(pad) : [];
  const mine = head.map((h, i) => (i === 0 ? rDateCell(day) : (pairs.find(([j]) => norm(j) === norm(h)) || [, ""])[1]));
  const rows = [...others, mine].sort((a, b) => (rowDate(a, ym) || "").localeCompare(rowDate(b, ym) || ""));
  return { gid, day, ym, old, head, rows, pairs };
}
// No double booking (YB 2026-10-31): one person, one duty per date, across every category, section and roster.
// The server does the matching ("Helmi S" = "St. Helmi Sihombing"), sees every roster, and refuses a save that clashes.
function clashLine(c) {
  const g = G(c.group_id); const where = g ? gname(g) : lang === "en" ? c.group_en || c.group : c.group || c.group_en;
  const day = fmt(c.day, { weekday: "short", day: "numeric", month: "short" });
  return L3(`${c.who} sudah bertugas ${day} di ${where}${c.other_job ? " (" + c.other_job + ")" : ""}.`,
    `${c.who} nunga marhobas ${day} di ${where}${c.other_job ? " (" + c.other_job + ")" : ""}.`,
    `${c.who} is already serving on ${day} in ${where}${c.other_job ? " (" + c.other_job + ")" : ""}.`);
}
function clashText(list) {
  const lines = [...new Set((list || []).map(clashLine))];
  if (!lines.length) return L3("Ada nama yang sudah bertugas di tempat lain pada tanggal yang sama.", "Adong goar na nunga marhobas di inganan na asing di tanggal na sarupa.", "Someone here is already serving somewhere else on the same date.");
  return lines.slice(0, 3).join(" ") + (lines.length > 3 ? ` (+${lines.length - 3})` : "") + " " + L3("Pilih orang lain.", "Pillit ma na asing.", "Please choose someone else.");
}
const RR_CHECK = { t: 0, n: 0 };
function rrCheckSoon(f) { clearTimeout(RR_CHECK.t); RR_CHECK.t = setTimeout(() => rrCheckNow(f), 350); }
// Asks the server, then marks each clashing name in the form and holds the Save button. Returns the clashes,
// or null when the check could not run (offline, or a server without it): then the save itself still checks.
async function rrCheckNow(f) {
  const b = rrBuild(f); const n = ++RR_CHECK.n; if (!b) return rrPaint(f, []);
  if (!b.pairs.some(([, w]) => w)) return rrPaint(f, []);
  let list;
  try { list = await api.save("roster_check", { id: b.old ? b.old.id : undefined, group_id: b.gid, month: b.ym, table_json: [{ name: monthName(b.ym), rows: [b.head, ...b.rows] }] }); }
  catch (e) { return null; }
  if (n !== RR_CHECK.n || !f.isConnected) return null;
  return rrPaint(f, (Array.isArray(list) ? list : []).filter((c) => c.day === b.day));
}
function rrPaint(f, list) {
  f.querySelectorAll(".rr-clash").forEach((x) => x.remove());
  f.querySelectorAll(".rr-row [name=who]").forEach((x) => { x.removeAttribute("aria-invalid"); x.style.borderColor = ""; });
  list.forEach((c) => {
    const row = [...f.querySelectorAll(".rr-row")].find((r) => norm(r.querySelector("[name=job]").value) === norm(c.job)); if (!row) return;
    const inp = row.querySelector("[name=who]"); inp.setAttribute("aria-invalid", "true"); inp.style.borderColor = "#dc2626";
    let box = row.nextElementSibling; if (!box || !box.classList.contains("rr-clash")) { row.insertAdjacentHTML("afterend", `<p class="small rr-clash" role="alert" style="color:#dc2626;margin:-2px 0 8px"></p>`); box = row.nextElementSibling; }
    const line = "⚠ " + clashLine(c); if (!box.textContent.includes(line.slice(2))) box.textContent += (box.textContent ? " " : "") + line;
  });
  const save = f.querySelector("button.primary"); if (save) { save.disabled = list.length > 0; save.title = list.length ? clashText(list) : ""; }
  return list;
}
F.rosterday = async (f) => {
  const b = rrBuild(f); if (!b) throw new S.AppError("bad_date");
  const { gid, day, ym, old, head, rows, pairs } = b;
  if (!pairs.some(([, w]) => w)) { toast(L3("Isi minimal satu nama.", "Isi ma nang sada goar.", "Fill in at least one name."), true); return; }
  const clash = await rrCheckNow(f); if (clash && clash.length) { toast(clashText(clash), true); return; }
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
const pushDate = (iso) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "long", day: "numeric", month: "short" }).format(new Date(iso + "T12:00:00+08:00"));
function rosterNotifyList(gid, tables, ym, onlyIso) {
  const g = G(gid) || {}; const out = [];
  D.people.filter((p) => p.id).forEach((p) => {
    const names = myNames(p); if (!names.length) return; const lines = [];
    (tables || []).forEach((tb) => {
      const rows = tb.rows || []; const hi = Math.max(0, rows.findIndex((r) => r.filter(Boolean).length >= 2)); const head = rows[hi] || [];
      rows.forEach((row, i) => {
        if (i <= hi) return; const iso = rowDate(row, ym); if (onlyIso && iso !== onlyIso) return;
        const jobs = row.map((c, j) => (hit(c, names) && head[j] && head[j] !== c ? head[j] : null)).filter(Boolean);
        if (jobs.length || row.some((c) => hit(c, names))) lines.push(`${iso ? pushDate(iso) : row.filter(Boolean)[0] || ""}${jobs.length ? " · " + jobs.join(", ") : ""}`);
      });
    });
    if (lines.length) out.push({ member: p.id, title: `📅 ${g.name_en || g.name_id || gname(g)} roster`, body: "You're serving:\n" + lines.slice(0, 8).join("\n") });   // push text in English (YB 2026-10-31)
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
  if (!isYB()) return; // Settings is for YB only (YB 2026-10-28)
  const o = LS.get("cfg.override", {}) || {};
  sheet(t("settings"), `<form class="form" data-form="settings">
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
  q(".pc-pw").hidden = kind !== "maker"; if (kind === "maker" && typeof pkPwBtn === "function") pkPwBtn(q(".pk-pw"), S.phone8(f.phone.value)); q(".pc-new").hidden = kind !== "maker_new"; q(".pc-forgot").hidden = kind !== "maker"; q(".pc-reg").hidden = q(".pc-browse").hidden = kind !== "unknown"; q(".pc-note").hidden = !!kind;
  q(".pc-hint").textContent = kind ? t("pc_" + kind) : "";
  q(".pc-btn").textContent = t(kind === "maker_new" ? "firstPwBtn" : kind === "unknown" ? "pcRegister" : "signIn");
  q(".pc-btn").closest("button").disabled = !kind; // the submit button, not the Face ID one above it
  const focus = kind === "maker" ? f.pw : kind === "maker_new" ? f.npw : kind === "unknown" ? f.rname : null; if (focus) setTimeout(() => focus.focus(), 50);
}
async function pcCheck(f) {
  const ph = S.phone8(f.phone.value);
  if (!validPhone(ph)) { pcShow(f, ""); return ""; }
  if (f.dataset.kphone === ph && f.dataset.kind) return f.dataset.kind;
  const kind = await api.phoneCheck(ph);
  if (S.phone8(f.phone.value) === ph) {
    pcShow(f, kind);
    // No password needed: sign in straight away once the number is filled in (YB 2026-10-31). Once per number.
    if (kind === "member" && f.dataset.auto !== ph && f.isConnected) { f.dataset.auto = ph; f.requestSubmit(); }
  }
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
  if (typeof pkOffer === "function" && pkOffer()) return; // Face ID / fingerprint offer first; it asks for notifications after (passkey.js)
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
  LS.set("claudeKey", null);   // no Claude key any more (YB 2026-10-31: free versions only)
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
    <section class="ghero slim" style="--gc:${g.color}">${heroPic(g)}
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
  const wf = $("#warta-form .wfin"); if (wf) { wf.outerHTML = wFinBox($("#warta-form").dataset.day); wFinSync($("#warta-form")); }
};

// Receipt scan (YB 2026-10-29): the treasurer takes a photo (or picks a screenshot) of the receipt; Claude reads the SGD amounts,
// they go into the SGD fields of the Warta Keuangan for the coming Sunday (the Warta date), it is saved, and only the
// Secretary and the Chairman get a push that the money parts were updated. Other currencies and other parts stay as they were.
A.finScan = (d) => {
  const sun = (d && d.day) || nextSunday();
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*";
  inp.onchange = async () => {
    const file = inp.files && inp.files[0]; if (!file) return;
    busySheet("📷 " + L3("Membaca struk", "Manjaha struk", "Reading the receipt"), L3("Membaca jumlah SGD di HP Anda… (pertama kali agak lama)", "Manjaha jumlah SGD…", "Reading the SGD amounts on your phone… (slower the first time)"));
    try {
      let img = await resizeImage(file, 1600, 0.82); if (img.length > 900000) img = await resizeImage(file, 1200, 0.72);
      const p = finFor(sun); const prevSun = addDays(sun, -7);
      const x = p ? finParse(p.body) : { date: fmtID(prevSun), secs: [] };
      FIN_DEFAULT.forEach((df, i) => { if (!x.secs[i]) x.secs[i] = { ...df, items: [] }; });
      if (!x.secs[0].items.length) x.secs[0].items = FIN_A.map((name) => ({ name, amts: [] }));
      const names = [...new Set([...x.secs[0].items.map((r) => r.name).filter(Boolean), ...FIN_A])];
      const r = await ocrReceipt(img, names);
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
  return wartaFresh(day);
}
// A new Warta: defaults, the parts carried over from the previous one, then everything the app knows.
function wartaFresh(day) {
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
  // The service team always comes from the online roster, read again each time the page opens.
  setTimeout(() => A.wRoster({ quiet: 1 }), 400);
  const sec = (title, inner, open) => `<details class="card wsec"${open ? " open" : ""}><summary><b>${esc(title)}</b></summary>${inner}</details>`;
  return shell("#/home", `
    <div class="card"><p class="small muted">${esc(t("wartaFormLead"))}</p>
      ${can ? `<button class="btn primary block" data-act="wImpAll">${ic("upload")} ${esc(t("w_upAll"))}</button>
      <p class="small muted" style="margin:6px 2px 10px">${esc(t("w_upAllHint"))}</p>` : ""}
      <div class="row two"><button class="btn" data-act="wartaPreview">${ic("screen")} ${esc(t("preview"))}</button><button class="btn" data-act="wartaRefill">${ic("check")} ${esc(t("wartaRefill"))}</button></div>
      ${can ? `<button type="button" class="btn block danger w-clear" data-act="wartaClear" style="margin-top:8px">${ic("trash")} ${esc(t("w_clear"))}</button>` : ""}</div>
    <form class="form" id="warta-form" data-form="warta" data-day="${day}">
      ${sec(t("w_head"), `${can ? `<div class="row two w-secup"><button type="button" class="btn sm primary" data-act="wImp" data-f="@all">${ic("upload")} ${esc(t("w_upEvery"))}</button></div>` : ""}${wIn0("minggu", "Minggu", W.minggu, "Tata Ibadah")}${wIn0("theme", t("w_theme"), W.theme, "Tata Ibadah")}${wIn0("verse", t("f_verse"), W.verse, "Tata Ibadah")}
        ${wTime("timeThis", t("w_timeThis"), W.timeThis)}${wTime("timeNext", t("w_timeNext"), W.timeNext)}${wTimeList()}`, true)}
      ${sec(t("w_renungan"), `<p class="small muted">${esc(t("w_renHint"))}</p>${can ? wSecUp("@ren", `<button type="button" class="btn sm" data-act="wFromBread">${ic("bread")} ${esc(t("w_fromBread"))}</button>`) : ""}${wIn0("renTitle", t("w_renTitle"), W.renTitle, t("bread"))}${wIn0("renVerse", t("f_verse"), W.renVerse, t("bread"))}${wTa0("renungan", t("w_renunganBody"), W.renungan, 12, t("bread"))}${wIn0("renunganBy", t("w_by"), W.renunganBy)}`, !W.renungan)}
      ${sec(t("birthdays"), `${wTa("bdays", t("w_bdays"), W.bdays, 4, t("src_bdays"))}${wTa("bdayVerse", t("w_verseGift"), W.bdayVerse, 2)}${wTa("anniv", t("w_anniv"), W.anniv, 3)}${wTa("annivVerse", t("w_verseGift"), W.annivVerse, 2)}`)}
      ${sec("Warta Keuangan", `${wFinBox(day)}${wFinText(W)}`, !wFinVal(W))}
      ${sec(t("w_team"), `<label>${wLab("rosterLink", t("w_rosterLink"))}<input name="rosterLink" type="url" inputmode="url" placeholder="https://docs.google.com/spreadsheets/…" value="${esc(W.rosterLink || "")}"></label>
        <p class="small muted">${esc(t("w_rosterHint"))}</p>
        <button type="button" class="btn block" data-act="wRoster">${ic("check")} ${esc(t("w_rosterRead"))}</button>
        <div class="tbl-wrap"><table class="tbl wteam"><tr><th></th><th>${esc(fmtID(day))}</th><th>${esc(fmtID(addDays(day, 7)))}</th></tr>
        ${W.team.map(([r, a, b], i) => wTeamRow(i, r, a, b)).join("")}</table></div>
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
  return `<div class="wfin">${p ? `<p class="small"><b>${esc(t("finFrom", p.author_name || t("treasurer")))}</b></p>` : `<div class="notice warn">${ic("bell")} <span>${esc(t("finMissing", fmtID(day)))}</span></div>`}
    <div class="row two"><button type="button" class="btn" data-act="wAskFin">${ic("wa")} ${esc(t("finAsk"))}</button>${canUpload("treasurer") ? `<button type="button" class="btn" data-act="financeForm" data-day="${day}">${ic("edit")} ${esc(t(p ? "financeEdit" : "financeNew"))}</button>` : `<button type="button" class="btn" data-act="wFinReload">${ic("check")} ${esc(t("finReload"))}</button>`}</div></div>`;
}
// The finance text itself: the treasurer's entry, which the secretary can also type or change by hand.
const wFinVal = (W) => (W.finManual ? W.finance : ((finFor(W.day) || {}).body || W.finance || "")) || "";
const wFinText = (W) => `<label>${wPlainLab(t("w_finText"))}<textarea name="finance" rows="10" data-auto="${W.finManual ? 0 : 1}">${esc(wFinVal(W))}</textarea></label><p class="small muted">${esc(t("w_finHint"))}</p>`;
// Treasurer's entry arrived or changed: copy it in, unless the secretary typed their own.
function wFinSync(f) { const ta = f && f.finance; if (!ta || (ta.dataset.auto === "0" && ta.value.trim())) return; const b = (finFor(f.dataset.day) || {}).body || ""; if (b) { ta.value = b; ta.dataset.auto = "1"; } }
// Service team rows are read-only: they come from the online roster.
const wTeamRow = (i, r, a, b) => `<tr><th><input name="tr${i}" value="${esc(r)}" readonly tabindex="-1"></th><td><input name="ta${i}" value="${esc(a)}" readonly tabindex="-1"></td><td><input name="tb${i}" value="${esc(b)}" readonly tabindex="-1"></td></tr>`;
document.addEventListener("input", (e) => { if (e.target.name === "finance" && e.target.closest && e.target.closest("#warta-form")) e.target.dataset.auto = "0"; });
A.wAskFin = () => {
  const f = $("#warta-form"); const day = f ? f.dataset.day : nextSunday();
  const tr = holders("treasurer").find((p) => p.phone); const url = location.href.split("#")[0] + "#/o/treasurer";
  window.open(wa(t("finAskMsg", fmtID(day), url), tr && tr.phone), "_blank", "noopener");
};
A.wFinReload = async () => { await refresh(); const f = $("#warta-form"); if (!f) return; const box = f.querySelector(".wfin"); if (box) box.outerHTML = wFinBox(f.dataset.day); wFinSync(f); toast(finFor(f.dataset.day) ? t("finArrived") : t("finStillMissing"), !finFor(f.dataset.day)); };
const W_FIELDS = ["minggu", "theme", "verse", "timeThis", "timeNext", "renTitle", "renVerse", "renungan", "renunganBy", "rosterLink", "bdays", "bdayVerse", "anniv", "annivVerse", "berita", "jadwalTitle", "jadwal", "doa", "info", "attDate", "org", "resort", "address", "email", "closing"];
function wartaCollect(f) {
  const W = { ...R.warta._W }; delete W._id;
  W_FIELDS.forEach((k) => { if (f[k]) W[k] = f[k].value.trim(); });
  W.att = [0, 1, 2, 3, 4].map((i) => (f["att" + i] ? f["att" + i].value.trim() : ""));
  W.team = []; for (let i = 0; f["tr" + i]; i++) if (f["tr" + i].value.trim()) W.team.push([f["tr" + i].value.trim(), f["ta" + i].value.trim(), f["tb" + i].value.trim()]);
  W.day = f.dataset.day;
  if (f.finance) { W.finance = f.finance.value.trim(); W.finManual = f.finance.dataset.auto === "0"; } else { W.finance = (finFor(W.day) || {}).body || ""; W.finManual = false; }
  return W;
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
  // Parts carried over from last week (or the defaults) come back where the box is empty, e.g. after Clear all.
  const fr = wartaFresh(W.day); W_FIELDS.forEach((k) => { if (f[k] && !f[k].value.trim() && fr[k]) f[k].value = fr[k]; });
  if (f.attDate && !f.attDate.value.trim()) f.attDate.value = fr.attDate || fmtID(addDays(W.day, -7));
  (fr.att || []).forEach((n, i) => { if (f["att" + i] && !f["att" + i].value.trim() && n) f["att" + i].value = n; });
  if (f.finance && a.finance) { f.finance.value = a.finance; f.finance.dataset.auto = "1"; }
  wTimeSync(f);
  a.team.forEach(([, x, y], i) => { if (f["ta" + i] && x) f["ta" + i].value = x; if (f["tb" + i] && y) f["tb" + i].value = y; });
  toast(t("wartaRefilled"));
};
// Clear all (tap twice): empties every box the secretary fills. The service team is read again from the online roster.
A.wartaClear = (d, btn) => {
  if (btn.dataset.sure !== "1") { btn.dataset.sure = "1"; btn.classList.add("sure"); btn.innerHTML = `${ic("trash")} ${esc(t("w_clearSure"))}`; setTimeout(() => { if (btn.isConnected) { btn.dataset.sure = ""; btn.classList.remove("sure"); btn.innerHTML = `${ic("trash")} ${esc(t("w_clear"))}`; } }, 4000); return; }
  btn.dataset.sure = ""; btn.classList.remove("sure"); btn.innerHTML = `${ic("trash")} ${esc(t("w_clear"))}`;
  const f = $("#warta-form"); if (!f) return;
  W_FIELDS.filter((k) => k !== "rosterLink").forEach((k) => { if (f[k]) f[k].value = ""; });
  f.querySelectorAll("[data-tp]").forEach((x) => (x.value = ""));
  for (let i = 0; i < 5; i++) if (f["att" + i]) f["att" + i].value = "";
  if (f.finance) { f.finance.value = ""; f.finance.dataset.auto = "0"; }
  for (let i = 0; f["ta" + i]; i++) { f["ta" + i].value = ""; f["tb" + i].value = ""; }
  LS.set("draft:warta:" + f.dataset.day, null);
  wAutoFlush(true); A.wRoster({ quiet: 1 }).then(() => wAutoFlush(true));
  toast(t("w_cleared"));
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
    if (!f["tr" + i]) { tb.insertAdjacentHTML("beforeend", wTeamRow(i, r, "", "")); }
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
      if (!f[k]) return; f[k].value = v; if (k === "finance") f.finance.dataset.auto = "0"; if (L[k] && !done.includes(L[k])) done.push(L[k]);
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

// ---------- Face ID / fingerprint sign-in ----------
// Face ID / fingerprint sign-in (YB 2026-10-31). Uses passkeys (WebAuthn): iPhone asks for Face ID (or Touch ID),
// Android for face unlock or the fingerprint. The face or fingerprint never leaves the phone; the phone signs a
// one-time challenge and the edge function hkbp-passkey checks it, then hands out a normal 10-year session.
// Server side: backend/edge/hkbp-passkey. Tables hk_passkeys, hk_passkey_challenges.
(() => {
  const CFG = window.HKBP_CONFIG || {};
  const FN = (CFG.supabaseUrl || "").replace(/\/$/, "") + "/functions/v1/hkbp-passkey";
  const ua = navigator.userAgent;
  const IOS = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const ANDROID = /Android/.test(ua);
  // What the phone calls it, in the member's language.
  const bio = () => IOS ? "Face ID" : ANDROID ? L3("sidik jari / wajah", "sidik jari / bohi", "fingerprint / face") : L3("Face ID / sidik jari", "Face ID / sidik jari", "Face ID / fingerprint");
  const fillTxt = () => L3("Isi nomor HP dengan ", "Isi nomor HP pake ", "Fill in my number with ") + bio();
  const device = () => IOS ? (/iPad/.test(ua) ? "iPad" : "iPhone") : ANDROID ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Browser";

  let ok = null, srv = false; // does this phone have Face ID / fingerprint for websites? is the sign-in service up?
  const okP = (async () => {
    try { ok = !!(window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); }
    catch { ok = false; }
    if (ok && CFG.supabaseUrl) srv = await fetch(FN, { method: "POST", headers: { "content-type": "application/json" }, body: '{"action":"ping"}' }).then((r) => r.ok, () => false);
    if (srv && D && /^#\/more/.test(location.hash)) try { render(); } catch {} // show the Profile menu entry
    return ok;
  })();
  const usable = () => ok && srv && api.mode === "remote" && !!CFG.supabaseUrl;

  const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0)).buffer;
  class PkError extends Error { constructor(code) { super(code); this.code = code; } }

  async function call(body) {
    let r;
    try { r = await fetch(FN, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); }
    catch { throw new PkError("offline"); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new PkError(j.error || "server");
    return j;
  }
  const msg = (e) => {
    const c = (e && (e.code || e.name)) || "";
    if (c === "NotAllowedError" || c === "AbortError") return L3("Dibatalkan.", "Dibatalkan.", "Cancelled.");
    if (c === "InvalidStateError") return L3("Face ID sudah aktif di HP ini.", "Face ID nunga aktif di HP on.", "Already turned on on this phone.");
    if (c === "no_passkey") return L3("Kunci ini tidak terhubung lagi. Masuk dengan nomor HP, lalu aktifkan lagi di Profil.", "Kunci on ndang tarhubung be. Bongot ma pake nomor HP, dungi aktifhon muse di Profil.", "This key isn't linked any more. Sign in with your phone number, then turn it on again in Profile.");
    if (c === "expired") return L3("Waktu habis. Coba lagi.", "Nunga lewat tingkina. Coba muse.", "That took too long. Please try again.");
    if (c === "offline") return typeof t === "function" ? t("err_offline") : "Offline";
    return L3("Tidak berhasil. Coba lagi atau masuk dengan nomor HP.", "Ndang boi. Coba muse manang bongot pake nomor HP.", "That didn't work. Try again or sign in with your phone number.");
  };

  // The phone wants the Face ID prompt to follow the tap straight away (iPhone is strict about this),
  // so the challenge is fetched before the tap and kept for a few minutes.
  const pre = { login: null, reg: null };
  const fresh = (p) => p && Date.now() - p.at < 240e3;
  async function prefetch(kind) {
    const j = await call(kind === "login" ? { action: "login_options" } : { action: "reg_options", token: api.token });
    pre[kind] = { at: Date.now(), ...j };
    return pre[kind];
  }
  async function take(kind) { const p = fresh(pre[kind]) ? pre[kind] : await prefetch(kind); pre[kind] = null; return p; }

  // ---- sign in ----
  async function login(btn) {
    const p = await take("login");
    const o = p.options;
    const cred = await navigator.credentials.get({ publicKey: {
      challenge: unb64u(o.challenge), rpId: o.rpId, timeout: o.timeout, userVerification: "required",
      // Only this phone's own key, so the phone goes straight to Face ID (no QR code / security key screen).
      allowCredentials: [{ type: "public-key", id: unb64u(LS.get("pk.id")), transports: ["internal"] }],
    } });
    const r = cred.response;
    const res = await busy(btn, () => call({ action: "login_verify", cid: p.cid, response: {
      id: cred.id, rawId: b64u(cred.rawId), type: cred.type, clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {},
      authenticatorAttachment: cred.authenticatorAttachment || undefined,
      response: { clientDataJSON: b64u(r.clientDataJSON), authenticatorData: b64u(r.authenticatorData), signature: b64u(r.signature), userHandle: r.userHandle ? b64u(r.userHandle) : undefined },
    } }));
    LS.set("pk.on", 1); LS.set("pk.offered", 1); LS.set("pk.phone", res.phone);
    // A Maker: Face ID stands in for the password, so the service starts the sign-in itself (YB 2026-10-31).
    if (res.token) { api.setToken(res.token); LS.set("remote.phone", res.phone); D = null; await refresh(); afterSignIn(); backAfterLogin(); localReminders(); return; }
    // Everyone else: Face ID fills in the saved phone number and signing in goes on as usual.
    const f = document.querySelector('form[data-form="login"]'); if (!f) return;
    f.phone.value = res.phone; f.phone.dispatchEvent(new Event("input", { bubbles: true }));
    // pcCheck signs a member in straight away; a Maker's password box opens instead, since they still type it.
    const kind = await pcCheck(f).catch(() => "");
    if (kind !== "member") toast(L3("Nomor HP Anda sudah diisi.", "Nomor HP mu nunga diisi.", "Your phone number is filled in."));
  }
  // Next to a Maker's password box: "Use Face ID instead", when this phone's Face ID belongs to the number typed.
  window.pkPwBtn = (b, ph) => {
    const on = usable() && LS.get("pk.id") && LS.get("pk.phone") === ph;
    b.hidden = !on; if (on) b.innerHTML = `${ic("lock")} ${esc(L3("Atau pakai ", "Manang pake ", "Or use ") + bio())}`;
  };
  A.pkLogin = async (d, btn) => {
    try { await login(btn); }
    catch (e) { toast(msg(e), e.name !== "NotAllowedError"); prefetch("login").catch(() => {}); }
  };

  function fillSlot(el) {
    el.dataset.pk = "1";
    okP.then(() => {
      if (!usable() || api.hasSession() || !LS.get("pk.id")) return; // only once Face ID was turned on on this phone (YB 2026-10-31)
      prefetch("login").then(() => {
        el.innerHTML = `<button type="button" class="btn block pk-btn" data-act="pkLogin">${ic("lock")} ${esc(fillTxt())}</button>
          <p class="small muted center pk-or">${esc(L3("atau ketik nomor HP Anda", "manang ketik nomor HP mu", "or type your phone number"))}</p>`;
        clearInterval(fillSlot.h); fillSlot.h = setInterval(() => { if (!el.isConnected) return clearInterval(fillSlot.h); prefetch("login").catch(() => {}); }, 200e3);
      }).catch(() => {}); // the sign-in service isn't reachable: keep the phone-number sign-in only
    });
  }
  new MutationObserver(() => { const el = document.querySelector(".pk-slot:not([data-pk])"); if (el) fillSlot(el); }).observe(document.body, { childList: true, subtree: true });
  { const el = document.querySelector(".pk-slot:not([data-pk])"); if (el) fillSlot(el); }

  // ---- turn on / manage (Profile) ----
  window.pkMenuItem = () => {
    if (!usable() || typeof isGuest === "function" && isGuest()) return "";
    const on = LS.get("pk.on");
    return `<button class="li" data-act="pkManage">${ic("lock")}<span class="grow"><b>${esc(fillTxt())}</b><small>${esc(on ? L3("Aktif di HP ini", "Aktif di HP on", "On for this phone") : L3("Tidak perlu mengetik nomor HP saat masuk", "Ndang pola mangetik nomor HP", "No need to type your number when signing in"))}</small></span>${ic("chev", "chev")}</button>`;
  };
  async function register(btn) {
    const p = await take("reg");
    const o = p.options;
    const cred = await navigator.credentials.create({ publicKey: {
      ...o, challenge: unb64u(o.challenge), user: { ...o.user, id: unb64u(o.user.id) },
      excludeCredentials: (o.excludeCredentials || []).map((c) => ({ ...c, id: unb64u(c.id) })),
    } });
    const r = cred.response;
    await busy(btn, () => call({ action: "reg_verify", token: api.token, cid: p.cid, device: device(), response: {
      id: cred.id, rawId: b64u(cred.rawId), type: cred.type, clientExtensionResults: cred.getClientExtensionResults ? cred.getClientExtensionResults() : {},
      authenticatorAttachment: cred.authenticatorAttachment || undefined,
      response: { clientDataJSON: b64u(r.clientDataJSON), attestationObject: b64u(r.attestationObject), transports: r.getTransports ? r.getTransports() : undefined },
    } }));
    LS.set("pk.on", 1); LS.set("pk.offered", 1); LS.set("pk.id", cred.id); try { LS.set("pk.phone", S.phone8(me().phone)); } catch {}
  }
  const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
  const doneTxt = () => L3(`${cap(bio())} aktif. Lain kali tekan "${fillTxt()}".`, `${cap(bio())} nunga aktif.`, `${cap(bio())} is on. Next time tap "${fillTxt()}".`);
  A.pkAdd = async (d, btn) => {
    try { await register(btn); closeSheet(); toast(doneTxt()); if (d.next) setTimeout(pkNext, 700); else render(); }
    catch (e) { toast(msg(e), e.name !== "NotAllowedError"); prefetch("reg").catch(() => {}); }
  };
  A.pkManage = async () => {
    sheet(fillTxt(), `<div class="center pad">${skel(2)}</div>`);
    let keys = [];
    try { [{ keys }] = await Promise.all([call({ action: "list", token: api.token }), prefetch("reg")]); }
    catch (e) { closeSheet(); toast(msg(e), true); return; }
    const fmtD = (s) => s ? new Date(s).toLocaleDateString(lang === "en" ? "en-GB" : "id-ID", { day: "numeric", month: "short", year: "numeric" }) : "";
    sheet(fillTxt(), `
      <p class="muted">${esc(L3(`Saat masuk, ${bio()} mengisi nomor HP Anda yang tersimpan. Makers tetap mengetik kata sandi. Wajah dan sidik jari Anda tetap di HP, tidak dikirim ke mana pun.`, `Tingki bongot, ${bio()} mangisi nomor HP mu. Makers tetap mangetik kata sandi. Bohi dohot sidik jarimu tetap di HP.`, `When you sign in, ${bio()} fills in your saved phone number. Makers still type their password. Your face and fingerprint stay on your phone and are never sent anywhere.`))}</p>
      <button class="btn primary block" data-act="pkAdd">${ic("lock")} ${esc(L3("Aktifkan di HP ini", "Aktifhon di HP on", "Turn on for this phone"))}</button>
      ${keys.length ? `<h4>${esc(L3("HP yang sudah aktif", "HP na nunga aktif", "Phones that are on"))}</h4><div class="menu card">${keys.map((k) => `<div class="li">${ic("phone")}<span class="grow"><b>${esc(k.device || "—")}</b><small>${esc(L3("Sejak ", "Sian ", "Since ") + fmtD(k.created_at))}${k.last_used ? esc(" · " + L3("terakhir ", "parpudi ", "last used ") + fmtD(k.last_used)) : ""}</small></span><button class="btn sm ghost" data-act="pkDel" data-id="${esc(k.id)}">${esc(L3("Hapus", "Apus", "Remove"))}</button></div>`).join("")}</div>` : ""}`);
  };
  A.pkDel = async (d, btn) => {
    if (!confirm(L3("Hapus Face ID / sidik jari untuk HP ini?", "Apus?", "Remove sign-in with this phone?"))) return;
    await busy(btn, () => call({ action: "remove", token: api.token, id: d.id }));
    if (d.id === LS.get("pk.id")) { LS.set("pk.on", null); LS.set("pk.id", null); }
    toast(L3("Dihapus.", "Nunga diapus.", "Removed.")); A.pkManage();
  };

  // Right after a normal sign-in, offer it once (then the notification question, as before).
  function pkNext() {
    if ("Notification" in window && Notification.permission === "default") sheet(t("notifyAskTitle"), `<p class="muted">${esc(t("notifyAskBody"))}</p><button class="btn primary block" data-act="notifyNow">${ic("bell")} ${esc(t("notifyAskTitle"))}</button>`);
  }
  A.pkLater = (d) => { closeSheet(); if (d.next) setTimeout(pkNext, 400); };
  window.pkOffer = (quiet) => {
    if (!usable() || LS.get("pk.on") || LS.get("pk.offered") || !api.hasSession()) return false;
    LS.set("pk.offered", 1);
    setTimeout(() => {
      if (quiet && (!document.querySelector("#sheet")?.hidden || /^#\/login/.test(location.hash))) return;
      prefetch("reg").then(() => sheet(L3("Masuk lebih cepat?", "Bongot lobi hatop?", "Faster sign-in?"), `
        <p class="muted">${esc(L3(`Lain kali ${bio()} mengisi nomor HP Anda, tidak perlu mengetik.`, `Sogot ${bio()} mangisi nomor HP mu, ndang pola mangetik.`, `Next time, ${bio()} fills in your phone number so you don't have to type it.`))}</p>
        <button class="btn primary block" data-act="pkAdd"${quiet ? "" : ` data-next="1"`}>${ic("lock")} ${esc(L3("Pakai ", "Pake ", "Use ") + bio())}</button>
        <button class="btn block ghost" data-act="pkLater"${quiet ? "" : ` data-next="1"`}>${esc(L3("Nanti saja", "Annon ma", "Not now"))}</button>`)).catch(() => { if (!quiet) pkNext(); });
    }, quiet ? 0 : 600);
    return true;
  };
  // Members who are already signed in see the offer once, a few seconds after opening the app from the home screen.
  addEventListener("load", () => setTimeout(() => okP.then(() => {
    try { if (standalone() && D && !isGuest()) pkOffer(true); } catch {}
  }), 5000));
})();
})();
