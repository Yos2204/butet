// Data layer. Two modes with the same calls:
//  - remote: a shared Supabase database (everyone sees the same data, real logins and roles)
//  - local: everything stays on this phone (demo / trying the app before the database is set up)
// The role rules in Local mirror backend/schema.sql. Keep them in step.
(() => {
"use strict";
// YB (owner) chose to sign in without a password (2026-10-26); every other Maker keeps theirs.
const LS = {
  get(k, d) { try { const v = localStorage.getItem("hkbp." + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { if (v == null) localStorage.removeItem("hkbp." + k); else localStorage.setItem("hkbp." + k, JSON.stringify(v)); } catch {} },
};
// Cookie copy of the sign-in token: if the browser drops localStorage (iPhone clears it for sites not on the Home Screen), the token comes back from here.
const CK = {
  get(n) { try { const m = document.cookie.match(new RegExp("(?:^|; )" + n + "=([^;]*)")); return m ? decodeURIComponent(m[1]) : null; } catch { return null; } },
  set(n, v) { try { document.cookie = `${n}=${v == null ? "" : encodeURIComponent(v)}; max-age=${v == null ? 0 : 34560000}; path=${location.pathname.replace(/[^/]*$/, "")}; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`; } catch {} },
};
const pwIsPhone = (pw, phone) => /^[+0-9 ()-]+$/.test(pw || "") && phone8(pw) === phone;
const phone8 = (p) => { const d = String(p || "").replace(/\D/g, ""); return d.length === 10 && d.startsWith("65") ? d.slice(2) : d; };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
const sgToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(new Date());

const DEFAULT_GROUPS = [
  ["sekolah-minggu", "sermon", "Sekolah Minggu", "Sikola Minggu", "Sunday School", "#e8913a", "child", 1],
  ["remaja", "sermon", "Remaja", "Remaja", "Teens", "#9333ea", "star", 2],
  ["naposo", "sermon", "Naposobulung (Pemuda)", "Naposobulung", "Youth", "#4f6bed", "spark", 3],
  ["ina", "sermon", "Ina (Kaum Perempuan)", "Parompuan / Ina", "Mothers", "#c94f8a", "heart", 4],
  ["ama", "sermon", "Ama (Kaum Bapak)", "Ama", "Fathers", "#1f8a70", "shield", 5],
  ["pelaut", "sermon", "Pelaut & Pekerja", "Parlayar dohot Pangula", "Sailors & Workers", "#2a7fb8", "anchor", 6],
  ["multimedia", "service", "Multimedia", "Multimedia", "Multimedia", "#7c5cff", "screen", 11],
  ["jemaat", "service", "Jemaat", "Ruas", "Congregation", "#0f766e", "people", 12],
  ["parhalado", "service", "Parhalado (Penatua & Pendeta)", "Parhalado", "Elders & Pastor", "#8b5a2b", "book", 13],
  ["band", "service", "ReNa Band", "ReNa Band", "ReNa Band", "#e11d48", "drum", 14],
  ["song-leader", "service", "Song Leader", "Song Leader", "Song Leader", "#ca8a04", "mic", 15],
  ["musik", "service", "Pemusik", "Pargonsi / Pemusik", "Musicians", "#0891b2", "note", 16],
  ["koor", "service", "Koor", "Koor", "Koor", "#be185d", "mic", 17],
  // Office categories: only the office holders (set by the admin by phone number) and the admin see them.
  ["secretary", "office", "Sekretaris", "Sekretaris", "Secretary", "#334155", "file", 21],
  ["treasurer", "office", "Bendahara", "Bendahara", "Treasurer", "#15803d", "coins", 22],
  ["chairman", "office", "Ketua", "Ketua", "Chairman", "#9f1239", "gavel", 23],
].map(([id, kind, name_id, name_bt, name_en, color, icon, sort]) => ({ id, kind, name_id, name_bt, name_en, color, icon, sort }));

// Categories run by teachers (Teacher Makers and Teachers), see hk__teach in backend/schema.sql.
const TEACH = ["naposo", "sekolah-minggu", "remaja", "ama", "ina", "pelaut"];
// Makers (may post) in teacher-run categories. In Youth they are the Youth Chair, Treasurer and Secretary (YB 2026-10-25).
const MAKERS = ["tmaker", "ychair", "ytreasurer", "ysecretary"];

class AppError extends Error { constructor(code) { super(code); this.code = code; } }

// ---------- tiny IndexedDB wrapper (rosters can be a few MB, too big for localStorage) ----------
const idb = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => {
      const r = indexedDB.open("hkbp-local", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => { this.db = r.result; res(this.db); };
      r.onerror = () => rej(r.error);
    });
  },
  async get(k) { const db = await this.open(); return new Promise((res, rej) => { const q = db.transaction("kv").objectStore("kv").get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); },
  async set(k, v) { const db = await this.open(); return new Promise((res, rej) => { const tx = db.transaction("kv", "readwrite"); tx.objectStore("kv").put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); },
};
async function sha(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("hkbp-sg|" + s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// ---------- Local mode ----------
// ---------- no double booking (mirrors hk__roster_clash in backend/sql/roster_clash_helpers.sql) ----------
const RC_TITLES = /^(st|pdt|cst|sintua|bapak|bpk|ibu|bu|pak|kak|bang|ev|dr|br|amang|inang|pnt|guru|mr|mrs|ms|sdr|sdri)$/;
const rcPn = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter((w) => w && !RC_TITLES.test(w)).join(" ");
function rcSame(a, b) {
  const x = a.split(" "), y = b.split(" "); if (!a || !b || x[0] !== y[0] || x[0].length < 2) return false;
  for (let i = 1; i < Math.min(x.length, y.length); i++) if (!(y[i].startsWith(x[i]) || x[i].startsWith(y[i]))) return false;
  return true;
}
const RC_MON = { jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12 };
function rcDate(c, ym) {
  c = String(c == null ? "" : c); if (!/\d/.test(c)) return null;
  let m = c.match(/(20\d{2})-(\d{2})-(\d{2})/); if (m) return m[0];
  m = c.toLowerCase().match(/(?:^|[^0-9a-z])(\d{1,2})[\s\/.-]+(\d{1,2}|jan|feb|mar|apr|mei|may|jun|jul|agu|aug|sep|okt|oct|nov|des|dec)[a-z]*(?:[\s\/.-]+(\d{2,4}))?/); if (!m) return null;
  const d = +m[1], mo = /^\d+$/.test(m[2]) ? +m[2] : RC_MON[m[2]]; let y = m[3] ? +m[3] : +(ym || new Date().toISOString()).slice(0, 4); if (y < 100) y += 2000;
  if (!mo || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
const RC_SKIP = /(tanggal|date|hari|bahasa|language|nama minggu|asal|tema|theme|ayat|nas\b|bacaan|catatan|note|keterangan|pengumuman|latihan|practi[cs]e|rehearsal|gladi)/;
const RC_PRACTICE = /(latihan|practi[cs]e|rehearsal|gladi)/i;   // practices may overlap other rosters (YB 2026-10-31)
function rosterSlots(tj, ym) {
  const out = [];
  (Array.isArray(tj) ? tj : []).forEach((tb) => {
    const rows = (tb && tb.rows) || []; if (rows.length < 2 || RC_PRACTICE.test((tb && tb.name) || "")) return;
    const hi = Math.max(0, rows.findIndex((r) => Array.isArray(r) && r.filter((c) => String(c == null ? "" : c).trim()).length >= 2)); const hd = rows[hi] || [];
    rows.slice(hi + 1).forEach((rw) => {
      if (!Array.isArray(rw)) return; let day = null; for (const c of rw) { day = rcDate(c, ym); if (day) break; } if (!day || rw.some((c, k) => RC_PRACTICE.test(String(c == null ? "" : c)) || (String(c == null ? "" : c).trim() && RC_PRACTICE.test(String(hd[k] == null ? "" : hd[k]))))) return;
      rw.forEach((cell, j) => {
        const h = String(hd[j] == null ? "" : hd[j]); cell = String(cell == null ? "" : cell);
        if (!cell.trim() || rcDate(cell, ym) || RC_SKIP.test(h.toLowerCase())) return;
        cell.split(/\s*(?:,|;|\/|&|\+|·|•|\n|\s+dan\s+|\s+and\s+)\s*/i).forEach((ch) => { const pn = rcPn(ch); if (pn.split(" ")[0].length < 2 || /^\d/.test(pn)) return; out.push({ day, job: h, who: ch.trim(), pn }); });
      });
    });
  });
  return out;
}
function rosterClash(rosters, groups, rid, gid, tj, ym, members) {
  // A Multimedia Maker on a Multimedia slides job may be double-booked (YB 2026-11-01); slides people who are not Makers may not.
  const mk = (members || []).filter((m) => !m.removed_at && (m.is_admin || ["maker", "chair"].includes((m.groups || {}).multimedia)));
  const isMk = (pn) => mk.some((m) => rcSame(rcPn(m.name), pn) || String(m.alias || "").split(/[,;\/]/).some((a) => rcSame(rcPn(a), pn)));
  const slideOk = (g, s) => g === "multimedia" && /slide/i.test(s.job) && isMk(s.pn);
  const nw = rosterSlots(tj, ym).filter((s) => !slideOk(gid, s)); const self = rosters.find((r) => r.id === rid && r.group_id === gid);
  const od = self ? rosterSlots(self.table_json, self.month) : [];
  const fresh = nw.filter((n) => !od.some((o) => o.day === n.day && o.job === n.job && o.pn === n.pn));
  const sh = (k) => { const d = new Date((ym || "2000-01") + "-15T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() + k); return d.toISOString().slice(0, 7); };
  const months = [sh(-1), ym, sh(1)]; const out = []; const seen = new Set();
  const add = (f, g, o) => { const k = [f.day, f.job, f.who, g, o.job, o.who].join("|"); if (seen.has(k)) return; seen.add(k); const G = groups.find((x) => x.id === g) || {}; out.push({ day: f.day, job: f.job, who: f.who, group_id: g, group: G.name_id || g, group_en: G.name_en || G.name_id || g, other_job: o.job, other_who: o.who }); };
  rosters.filter((r) => !r.removed_at && r.table_json && r.id !== rid && months.includes(r.month)).forEach((r) => rosterSlots(r.table_json, r.month).filter((o) => !slideOk(r.group_id, o)).forEach((o) => fresh.forEach((f) => { if (o.day === f.day && rcSame(f.pn, o.pn)) add(f, r.group_id, o); })));
  fresh.forEach((f) => nw.forEach((n) => { if (n.day === f.day && n.job !== f.job && rcSame(f.pn, n.pn)) add(f, gid, n); }));
  return out.sort((a, b) => a.day.localeCompare(b.day) || a.who.localeCompare(b.who)).slice(0, 40);
}

const Local = {
  mode: "local",
  async load() {
    let db = await idb.get("db");
    if (!db) db = { groups: DEFAULT_GROUPS.slice(), members: [], posts: [], rosters: [], bread: [], updates: [], events: [], outbox: [] };
    db.polls = db.polls || []; db.votes = db.votes || [];
    db.birthdays = db.birthdays || []; db.settings = db.settings || {}; db.services = db.services || []; db.files = db.files || [];
    for (const g of DEFAULT_GROUPS) if ((g.kind === "office" || g.id === "remaja") && !db.groups.some((x) => x.id === g.id)) db.groups.push({ ...g });
    for (const g of db.groups) { const d = DEFAULT_GROUPS.find((x) => x.id === g.id); if (d && d.kind === "sermon") { g.sort = d.sort; if (g.id === "ina") g.name_id = d.name_id; } }
    this.dbo = db; return db;
  },
  async commit() { await idb.set("db", this.dbo); },
  async me() {
    const db = await this.load(); const id = LS.get("local.me");
    const m = db.members.find((x) => x.id === id);
    if (!m) throw new AppError("not_signed_in");
    return m;
  },
  chair: (m, gid) => m.is_admin || (m.groups || {})[gid] === "chair",
  elder: (m) => m.is_admin || "parhalado" in (m.groups || {}),
  // Youth and Sunday School: Teacher Makers post; teachers read and open polls (hk__teach / hk__poster / hk__teacher).
  teach: (gid) => TEACH.includes(gid),
  poster(m, gid) { return this.teach(gid) ? m.is_admin || MAKERS.includes((m.groups || {})[gid]) : this.chair(m, gid); },
  teacher: (m, gid) => m.is_admin || [...MAKERS, "teacher"].includes((m.groups || {})[gid]),
  office(m) { return m.is_admin || this.dbo.groups.some((g) => g.kind === "office" && g.id in (m.groups || {})); },
  officeIds() { return this.dbo.groups.filter((g) => g.kind === "office").map((g) => g.id); },
  sees(m, gid) { const og = this.dbo.groups.find((x) => x.id === gid); if (og && og.kind === "office") return this.office(m); if (!gid || this.elder(m) || gid in (m.groups || {})) return true; const g = this.dbo.groups.find((x) => x.id === gid); return !!g && g.kind === "service"; },
  async needsSetup() { const db = await this.load(); return !db.members.some((m) => m.is_admin); },
  async setupAdmin(name, phone, pw) {
    const db = await this.load();
    db.members.push({ id: uid(), name, phone: phone8(phone), dob: null, pass_hash: await sha(pw), is_admin: true, groups: { parhalado: "chair" }, wa_optin: false });
    await this.commit();
  },
  hasSession() { return !!LS.get("local.me"); },
  // Same rules as hk__leader / hk_phone_check / hk_login in backend/schema.sql.
  isMaker(db, m) { return !!m.is_admin || Object.entries(m.groups || {}).some(([g, r]) => r !== "member" || g === "parhalado" || (db.groups.find((x) => x.id === g) || {}).kind === "office"); },
  async phoneCheck(phone) {
    const db = await this.load(); const m = db.members.find((x) => x.phone === phone8(phone));
    if (!m) return "unknown"; if (!this.isMaker(db, m)) return "member"; return m.pass_hash ? "maker" : "maker_new";
  },
  async login(phone, pw) {
    const db = await this.load(); const h = await sha(pw);
    const m = db.members.find((x) => x.phone === phone8(phone));
    if (m && !pw && (!this.isMaker(db, m))) { LS.set("local.me", m.id); return {}; }
    if (m && !m.pass_hash) throw new AppError("needs_password");
    if (!m || m.pass_hash !== h) throw new AppError("bad_login");
    LS.set("local.me", m.id);
    return { must_change: this.isMaker(db, m) && pwIsPhone(pw, m.phone) };
  },
  async firstPassword(phone, pw) {
    const db = await this.load(); const m = db.members.find((x) => x.phone === phone8(phone));
    if (!m || m.pass_hash) throw new AppError("bad_login");
    if ((pw || "").length < 6) throw new AppError("short_password");
    if (pwIsPhone(pw, m.phone)) throw new AppError("pw_is_phone");
    m.pass_hash = await sha(pw); await this.commit(); LS.set("local.me", m.id);
  },
  async register(phone, name) {
    const db = await this.load(); const ph = phone8(phone); const nm = String(name || "").replace(/\s+/g, " ").trim();
    if (!/^\d{8,15}$/.test(ph)) throw new AppError("bad_phone");
    if (nm.length < 2 || nm.length > 80) throw new AppError("bad_name");
    if (db.members.some((x) => x.phone === ph)) throw new AppError("bad_login");
    const m = { id: uid(), name: nm, phone: ph, groups: {}, is_admin: false, pass_hash: null, self_reg: new Date().toISOString() };
    db.members.push(m); await this.commit(); LS.set("local.me", m.id);
  },
  async logout() { LS.set("local.me", null); },
  async setPassword(oldPw, newPw) {
    const m = await this.me();
    if ((newPw || "").length < 6) throw new AppError("short_password");
    if (m.pass_hash !== await sha(oldPw)) throw new AppError("bad_login");
    if (pwIsPhone(newPw, m.phone)) throw new AppError("pw_is_phone");
    m.pass_hash = await sha(newPw); await this.commit();
  },
  // Before signing in: the same public parts as hk_public() in backend/schema.sql.
  // Same as 'celebrations' in hk_public(): today's birthdays and wedding anniversaries (name, kind, day only).
  celebrations(db, today) {
    const t0 = new Date(today + "T12:00:00Z"); const n = 0; const days = [];
    for (let i = 0; i <= n; i++) { const d = new Date(t0); d.setUTCDate(d.getUTCDate() + i); days.push(d.toISOString().slice(0, 10)); }
    const src = [...db.members.filter((m) => m.dob).map((m) => [m.name, m.dob, "bday"]), ...db.birthdays.map((b) => [b.name, b.dob, "bday"]), ...db.members.filter((m) => m.wed).map((m) => [m.name, m.wed, "wed"])];
    const seen = new Set(); const out = [];
    for (const day of days) for (const [name, date, kind] of src) {
      const k = name.toLowerCase() + kind + date.slice(5); if (date.slice(5) !== day.slice(5) || seen.has(k)) continue; seen.add(k); out.push({ name, kind, day });
    }
    return out.sort((a, b) => a.day.localeCompare(b.day) || a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
  },
  async publicData() {
    const db = await this.load(); const today = sgToday(); const svc = (gid) => { const g = db.groups.find((x) => x.id === gid); return !!g && g.kind === "service"; };
    return {
      me: null, posts: [], people: [], birthdays: [], files: [], polls: [],
      celebrations: this.celebrations(db, today),
      groups: db.groups.filter((g) => g.kind !== "office").sort((a, b) => a.sort - b.sort),
      rosters: db.rosters.filter((r) => svc(r.group_id)).map(({ file_b64, ...r }) => ({ ...r, has_file: !!file_b64 })).sort((a, b) => b.month.localeCompare(a.month) || b.created_at.localeCompare(a.created_at)),
      bread: db.bread.filter((b) => b.day <= today).sort((a, b) => b.day.localeCompare(a.day)),
      updates: db.updates.filter((u) => u.audience === "all").sort((a, b) => (b.pinned - a.pinned) || b.created_at.localeCompare(a.created_at)),
      events: db.events.filter((e) => !e.group_id || svc(e.group_id)).sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
      services: db.services.map(({ html, ...v }) => ({ ...v, size: html.length })).sort((a, b) => (b.service_date || "").localeCompare(a.service_date || "") || b.created_at.localeCompare(a.created_at)),
      settings: (({ claude_key, wa_senders, ...rest }) => rest)(db.settings),
    };
  },
  async data() {
    if (!this.hasSession()) return this.publicData();
    const m = await this.me(); const db = this.dbo; const el = this.elder(m); const today = sgToday();
    const chairOf = Object.entries(m.groups || {}).filter(([, r]) => r === "chair" || MAKERS.includes(r)).map(([g]) => g);
    const since = new Date(Date.now() - 180 * 864e5).toISOString();
    const off = this.office(m); const hide = off ? [] : this.officeIds();
    const strip = (gs) => Object.fromEntries(Object.entries(gs || {}).filter(([k]) => !hide.includes(k)));
    return {
      me: { id: m.id, name: m.name, alias: m.alias, phone: m.phone, dob: m.dob, wed: m.wed || null, is_admin: m.is_admin, groups: m.groups, wa_optin: m.wa_optin, profile: m.profile || null },
      groups: db.groups.filter((g) => g.kind !== "office" || off).sort((a, b) => a.sort - b.sort),
      posts: db.posts.filter((p) => this.sees(m, p.group_id)).sort((a, b) => b.created_at.localeCompare(a.created_at)),
      rosters: db.rosters.filter((r) => this.sees(m, r.group_id)).map(({ file_b64, ...r }) => ({ ...r, has_file: !!file_b64 })).sort((a, b) => b.month.localeCompare(a.month) || b.created_at.localeCompare(a.created_at)),
      bread: db.bread.filter((b) => el || off || b.day <= today).sort((a, b) => b.day.localeCompare(a.day)),
      updates: db.updates.filter((u) => u.audience === "all" || el).sort((a, b) => (b.pinned - a.pinned) || b.created_at.localeCompare(a.created_at)),
      events: db.events.filter((e) => this.sees(m, e.group_id)).sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
      people: db.members.map((x) => ({
        id: x.id, name: x.name, alias: x.alias || null, bday: x.dob ? x.dob.slice(5) : null, anniv: x.wed ? x.wed.slice(5) : null, groups: strip(x.groups), is_admin: x.is_admin,
        phone: m.is_admin || chairOf.some((g) => g in (x.groups || {})) ? x.phone : null,
        dob: m.is_admin ? x.dob : null, wed: m.is_admin ? x.wed || null : null, wa_optin: m.is_admin ? x.wa_optin : null, has_password: m.is_admin ? !!x.pass_hash : null,
      })).sort((a, b) => a.name.localeCompare(b.name)),
      polls: db.polls.filter((p) => this.teacher(m, p.group_id) && p.created_at > since).map((p) => {
        const vs = db.votes.filter((v) => v.poll_id === p.id); const mine = vs.find((v) => v.member_id === m.id);
        return { ...p, mine: mine ? mine.choices : null, voters: vs.length,
          counts: this.teacher(m, p.group_id) || p.status === "closed" || mine ? p.options.map((_, i) => vs.filter((v) => v.choices.includes(i)).length) : null };
      }).sort((a, b) => b.created_at.localeCompare(a.created_at)),
      services: db.services.map(({ html, ...v }) => ({ ...v, size: html.length })).sort((a, b) => (b.service_date || "").localeCompare(a.service_date || "") || b.created_at.localeCompare(a.created_at)),
      birthdays: db.birthdays.map((b) => ({ id: b.id, name: b.name, bday: b.dob.slice(5), year: b.year_known ? +b.dob.slice(0, 4) : null, note: b.note || null })).sort((a, b) => a.bday.localeCompare(b.bday)),
      files: off ? db.files.map(({ file_b64, ...f }) => f).sort((a, b) => b.created_at.localeCompare(a.created_at)) : [],
      settings: { ...(({ claude_key, ...rest }) => rest)(db.settings), claude_key_set: !!db.settings.claude_key },
    };
  },
  async file(id) { const m = await this.me(); if (!this.office(m)) throw new AppError("not_allowed"); const f = this.dbo.files.find((x) => x.id === id); return f ? { file_b64: f.file_b64, mime: f.mime, file_name: f.file_name } : null; },
  async rosterFile(id) { await this.load(); const r = this.dbo.rosters.find((x) => x.id === id); return r ? { file_b64: r.file_b64, mime: r.mime, file_name: r.file_name } : null; },
  async save(kind, d) {
    const m = await this.me(); const db = this.dbo; const now = new Date().toISOString(); const gid = d.group_id || null;
    const deny = () => { throw new AppError("not_allowed"); };
    const upsert = (list, row, key = "id") => { const i = list.findIndex((x) => x[key] === row[key]); if (i >= 0) list[i] = { ...list[i], ...row }; else list.push(row); return i >= 0 ? list[i] : row; };
    let res;
    if (kind === "post") {
      if (!this.poster(m, gid)) deny();
      res = upsert(db.posts, { id: d.id || uid(), group_id: gid, kind: d.kind || "news", title: d.title, verse: d.verse, body: d.body, day: d.day || null, author_name: m.name, created_at: d.created_at || now });
    } else if (kind === "roster_check") {
      if (!this.chair(m, gid)) deny();
      return rosterClash(db.rosters, db.groups, d.id, gid, d.table_json, d.month, db.members);
    } else if (kind === "roster") {
      if (!this.chair(m, gid)) deny();
      const clash = rosterClash(db.rosters, db.groups, d.id, gid, d.table_json, d.month, db.members);
      if (clash.length) { const e = new AppError("roster_clash"); e.clash = clash; throw e; }
      res = upsert(db.rosters, { id: d.id || uid(), group_id: gid, month: d.month, title: d.title, file_name: d.file_name, mime: d.mime, file_b64: d.file_b64 || null, link: d.link || null, table_json: d.table_json || null, text_content: d.text_content || "", author_name: m.name, created_at: now });
    } else if (kind === "bread") {
      if (!this.chair(m, "parhalado")) deny(); // only Elders Makers (and the admin) write the daily bread
      res = upsert(db.bread, { day: d.day, verse: d.verse, title: d.title, body: d.body, author_name: m.name, updated_at: now }, "day");
    } else if (kind === "update") {
      const berita = d.kind === "berita"; // Berita Pelayanan: only the Secretary (and the admin) posts it
      if (berita ? !this.chair(m, "secretary") : !this.elder(m)) deny();
      res = upsert(db.updates, { id: d.id || uid(), kind: berita ? "berita" : "update", day: d.day || null, title: d.title, body: d.body, audience: berita ? "all" : d.audience || "all", pinned: !!d.pinned, author_name: m.name, created_at: d.created_at || now });
    } else if (kind === "event") {
      if (!(this.teach(gid) ? this.poster(m, gid) : this.elder(m) || (gid && this.chair(m, gid))) || (gid && !this.sees(m, gid))) deny();
      res = upsert(db.events, { id: d.id || uid(), group_id: gid, title: d.title, starts_at: d.starts_at, ends_at: d.ends_at || null, place: d.place, notes: d.notes, remind_min: +d.remind_min || 1440, author_name: m.name, created_at: now });
    } else if (kind === "poll") {
      if (!this.poster(m, gid)) deny();
      if (!Array.isArray(d.options) || d.options.length < 2 || d.options.length > 12 || !String(d.question || "").trim()) throw new AppError("unknown_kind");
      const old = d.id && db.polls.find((x) => x.id === d.id);
      if (old && (old.group_id !== gid || db.votes.some((v) => v.poll_id === old.id))) return old;
      res = upsert(db.polls, { id: d.id || uid(), group_id: gid, question: String(d.question).trim(), options: d.options, multi: !!d.multi, status: old ? old.status : d.status === "open" ? "open" : "draft", author_name: old ? old.author_name : m.name, created_at: old ? old.created_at : now, opened_by: old ? old.opened_by : null, opened_at: old ? old.opened_at : null });
    } else if (kind === "service") {
      if (!this.maker(m)) deny();
      res = upsert(db.services, { id: d.id || uid(), service_date: d.service_date || null, title: d.title, html: d.html, author_name: m.name, created_at: now });
      res = (({ html, ...r }) => r)(res);
    } else if (kind === "file") {
      const g = db.groups.find((x) => x.id === gid);
      if (!g || g.kind !== "office" || !(m.is_admin || gid in (m.groups || {}))) deny();
      if ((d.file_b64 || "").length > 14000000) throw new AppError("file_too_big");
      res = { id: uid(), group_id: gid, title: d.title, note: d.note || null, file_name: d.file_name, mime: d.mime, file_b64: d.file_b64, size: d.size, author_name: m.name, created_at: now };
      db.files.push(res); res = (({ file_b64, ...r }) => r)(res);
    } else if (kind === "birthday") {
      if (!this.elder(m)) deny();
      res = upsert(db.birthdays, { id: d.id || uid(), name: d.name, dob: d.dob, year_known: d.year_known !== false, note: d.note || null, author_name: m.name });
    } else if (kind === "group") {
      if (!m.is_admin) deny();
      res = upsert(db.groups, { id: d.id, kind: d.kind || "service", name_id: d.name_id, name_bt: d.name_bt, name_en: d.name_en, color: d.color || "#475569", icon: d.icon || "star", sort: d.sort || 50 });
    } else throw new AppError("unknown_kind");
    await this.commit(); return res;
  },
  async del(kind, id) {
    const m = await this.me(); const db = this.dbo; const deny = () => { throw new AppError("not_allowed"); };
    const lists = { poll: "polls", post: "posts", roster: "rosters", bread: "bread", update: "updates", event: "events", group: "groups", member: "members", birthday: "birthdays", service: "services", file: "files" };
    const key = kind === "bread" ? "day" : "id"; const list = db[lists[kind]]; if (!list) throw new AppError("unknown_kind");
    const row = list.find((x) => x[key] === id); if (!row) return;
    if ((kind === "post" || kind === "poll") && !this.poster(m, row.group_id)) deny();
    if (kind === "roster" && !this.chair(m, row.group_id)) deny();
    if (kind === "update" && row.kind === "berita") { if (!this.chair(m, "secretary")) deny(); }
    else if (kind === "bread") { if (!this.chair(m, "parhalado")) deny(); }
    else if ((kind === "update" || kind === "birthday") && !this.elder(m)) deny();
    if (kind === "service" && !this.maker(m)) deny();
    if (kind === "file" && !(m.is_admin || row.group_id in (m.groups || {}))) deny();
    if (kind === "event" && !(this.teach(row.group_id) ? this.poster(m, row.group_id) : this.elder(m) || (row.group_id && this.chair(m, row.group_id)))) deny();
    if ((kind === "group" || kind === "member") && !m.is_admin) deny();
    if (kind === "member" && id === m.id) deny();
    db[lists[kind]] = list.filter((x) => x !== row); await this.commit();
  },
  async membersUpsert(rows) {
    const m = await this.me(); if (!m.is_admin) throw new AppError("not_allowed");
    let n = 0;
    for (const r of rows) {
      const ph = phone8(r.phone); if (ph.length !== 8) continue;
      const ex = this.dbo.members.find((x) => x.phone === ph);
      // Office and teacher roles are only given in the app, so a member list upload keeps them.
      const keep = ex ? Object.fromEntries(Object.entries(ex.groups || {}).filter(([g, v]) => this.officeIds().includes(g) || MAKERS.includes(v) || v === "teacher")) : {};
      const row = { name: r.name, alias: r.alias || null, phone: ph, dob: r.dob || (ex && ex.dob) || null, wed: r.wed || (ex && ex.wed) || null, is_admin: ex && ex.id === m.id ? true : !!r.is_admin, groups: { ...(r.groups || {}), ...keep }, wa_optin: !!r.wa_optin };
      if (r.password) row.pass_hash = await sha(r.password);
      if (ex) Object.assign(ex, row); else this.dbo.members.push({ id: uid(), pass_hash: null, ...row });
      n++;
    }
    await this.commit(); return n;
  },
  async birthdaysImport(rows) {
    const m = await this.me(); if (!this.elder(m)) throw new AppError("not_allowed");
    const out = { members: 0, added: 0, skipped: 0 }; const low = (x) => String(x || "").trim().toLowerCase();
    for (const r of rows) {
      if (!r.name || !r.dob) { out.skipped++; continue; }
      const ph = phone8(r.phone);
      let mem = ph.length === 8 ? this.dbo.members.find((x) => x.phone === ph) : null;
      if (!mem) { const same = this.dbo.members.filter((x) => low(x.name) === low(r.name)); if (same.length === 1 && !same[0].dob) mem = same[0]; }
      if (mem) { if (!mem.dob || r.year_known !== false) mem.dob = r.dob; out.members++; }
      else if (this.dbo.birthdays.some((b) => low(b.name) === low(r.name) && b.dob.slice(5) === r.dob.slice(5))) out.skipped++;
      else { this.dbo.birthdays.push({ id: uid(), name: r.name.trim(), dob: r.dob, year_known: r.year_known !== false, author_name: m.name }); out.added++; }
    }
    await this.commit(); return out;
  },
  maker(m) { return m.is_admin || ["maker", "chair"].includes((m.groups || {}).multimedia); },
  async serviceHtml(id) { await this.load(); const v = this.dbo.services.find((x) => x.id === id); return v ? v.html : null; },
  async setRole(phone, group, role, name) {
    const m = await this.me(); if (!m.is_admin) throw new AppError("not_allowed");
    const ph = phone8(phone); if (!/^[3689]\d{7}$/.test(ph)) throw new AppError("bad_phone");
    let x = this.dbo.members.find((y) => y.phone === ph);
    if (!x) { if (!(name || "").trim()) throw new AppError("need_name"); x = { id: uid(), name: name.trim(), phone: ph, dob: null, pass_hash: null, is_admin: false, groups: {}, wa_optin: false }; this.dbo.members.push(x); }
    x.groups = { ...(x.groups || {}) }; if (role) x.groups[group] = role; else delete x.groups[group];
    await this.commit(); return { id: x.id, name: x.name, phone: x.phone, groups: x.groups };
  },
  async setTeacher(phone, group, role, name) {
    const m = await this.me(); if (!this.teach(group) || !this.poster(m, group)) throw new AppError("not_allowed");
    const ph = phone8(phone); if (!/^[3689]\d{7}$/.test(ph)) throw new AppError("bad_phone");
    if (!["", ...MAKERS, "teacher"].includes(role || "")) throw new AppError("unknown_kind");
    let x = this.dbo.members.find((y) => y.phone === ph);
    if (!x) { if (!(name || "").trim()) throw new AppError("need_name"); x = { id: uid(), name: name.trim(), phone: ph, dob: null, pass_hash: null, is_admin: false, groups: {}, wa_optin: false }; this.dbo.members.push(x); }
    x.groups = { ...(x.groups || {}), [group]: role || "member" };
    await this.commit(); return { id: x.id, name: x.name, phone: x.phone, groups: x.groups };
  },
  async pollState(id, status) {
    const m = await this.me(); const p = this.dbo.polls.find((x) => x.id === id);
    if (!p || !this.teacher(m, p.group_id) || !["open", "closed"].includes(status)) throw new AppError("not_allowed");
    p.status = status; if (status === "open") { p.opened_by = m.name; p.opened_at = new Date().toISOString(); }
    await this.commit();
  },
  async vote(id, choices) {
    const m = await this.me(); const p = this.dbo.polls.find((x) => x.id === id);
    if (!p || p.status !== "open" || !this.teacher(m, p.group_id)) throw new AppError("not_allowed");
    const c = [...new Set((choices || []).map(Number))];
    if (!c.length || (!p.multi && c.length !== 1) || c.some((i) => !(i >= 0 && i < p.options.length))) throw new AppError("unknown_kind");
    this.dbo.votes = this.dbo.votes.filter((v) => !(v.poll_id === id && v.member_id === m.id)); this.dbo.votes.push({ poll_id: id, member_id: m.id, choices: c });
    await this.commit();
  },
  async settingsSave(o) {
    const m = await this.me(); if (!m.is_admin) throw new AppError("not_allowed");
    const keys = ["bread_source", "bread_lang", "bread_hour", "wa_group_link", "wa_senders", "setup_done", "claude_key"];
    for (const k of keys) if (k in o && !(k === "claude_key" && !o[k])) this.dbo.settings[k] = o[k];
    await this.commit();
  },
  async groupWaLink(gid, link) {
    const m = await this.me(); if (!(m.is_admin || ["chair", ...MAKERS].includes((m.groups || {})[gid]))) throw new AppError("not_allowed");
    const l = String(link || "").trim() || null; if (l && !/^https:\/\/(chat\.whatsapp\.com|wa\.me|whatsapp\.com)\//.test(l)) throw new AppError("bad_link");
    const g = this.dbo.groups.find((x) => x.id === gid); if (g) g.wa_link = l; await this.commit();
  },
  async profileSave(p) {
    const m = await this.me(); const v = {};
    for (const k of ["married", "male", "pelaut", "confirmed"]) if (k in p) v[k] = !!p[k];
    if ("serve" in p) v.serve = this.dbo.groups.filter((g) => g.kind === "service" && (p.serve || []).includes(g.id)).sort((a, b) => a.sort - b.sort).map((g) => g.id); if ("serve" in p) v.serve_ym = sgToday().slice(0, 7);
    m.profile = { ...(m.profile || {}), ...v, at: new Date().toISOString() }; await this.commit(); return m.profile;
  },
  async calToken() { throw new AppError("demo_only"); }, // a calendar feed needs the shared database
  async pushSave() { /* no server in local mode: reminders show when the app is opened */ },
  async ping(installed) { const m = await this.me(); m.app_seen = new Date().toISOString(); m.app_installed = !!(m.app_installed || installed); await this.commit(); },
  async phoneTries() { const m = await this.me(); if (!m.is_admin) throw new AppError("not_allowed"); return []; },
  async appStatus() {
    const m = await this.me(); if (!m.is_admin) throw new AppError("not_allowed");
    return this.dbo.members.filter((x) => !x.removed_at).map((x) => ({ id: x.id, name: x.name, phone: x.phone, signed_in: !!x.app_seen, last_seen: x.app_seen || null, installed: !!x.app_installed, self_reg: x.self_reg || null, notif: false })).sort((a, b) => a.name.localeCompare(b.name));
  },
};

// ---------- Remote mode (Supabase, see backend/schema.sql) ----------
const Remote = {
  mode: "remote",
  cfg: null,
  async rpc(fn, args) {
    const c = this.cfg;
    let res;
    try {
      res = await fetch(`${c.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${fn}`, {
        method: "POST", headers: { "content-type": "application/json", apikey: c.supabaseKey, authorization: "Bearer " + c.supabaseKey },
        body: JSON.stringify(args || {}),
      });
    } catch { throw new AppError("offline"); }
    const txt = await res.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch {}
    if (!res.ok) {
      const code = ((j && j.message) || "").match(/not_signed_in|bad_login|needs_password|not_allowed|short_password|pw_is_phone|file_too_big|unknown_kind|bad_phone|need_name|call_ended|call_full|too_fast/);
      if (code && code[0] === "not_signed_in") {
        this.setToken(null);
        // Session gone (expired or cleared): sign the remembered number in again without asking when the account needs no password, then retry once.
        const ph = LS.get("remote.phone");
        if (ph && fn !== "hk_login" && args && "p_token" in args && !this._relog) {
          this._relog = true;
          try { const r = await this.rpc("hk_login", { p_phone: ph, p_password: "" }); this.setToken(r.token); return await this.rpc(fn, Object.assign({}, args, { p_token: r.token })); }
          catch {} finally { this._relog = false; }
        }
      }
      // A roster that puts someone on two duties on one date: the server lists where (YB 2026-10-31).
      if (/roster_clash/.test((j && j.message) || "")) { const e = new AppError("roster_clash"); try { e.clash = JSON.parse(j.details || "[]"); } catch { e.clash = []; } throw e; }
      throw new AppError(code ? code[0] : "server");
    }
    return j;
  },
  get token() { let t = LS.get("remote.token"); if (!t) { t = CK.get("hkbp_t"); if (t) LS.set("remote.token", t); } return t; },
  setToken(t) { LS.set("remote.token", t); CK.set("hkbp_t", t); },
  hasSession() { return !!this.token; },
  async needsSetup() { return false; },
  async login(phone, pw) { const r = await this.rpc("hk_login", { p_phone: phone, p_password: pw }); this.setToken(r.token); LS.set("remote.phone", phone); return r; },
  async phoneCheck(phone) { return this.rpc("hk_phone_check", { p_phone: phone }); },
  async register(phone, name) { const r = await this.rpc("hk_register", { p_phone: phone, p_name: name }); this.setToken(r.token); LS.set("remote.phone", phone); },
  async firstPassword(phone, pw) { const r = await this.rpc("hk_first_password", { p_phone: phone, p_password: pw }); this.setToken(r.token); LS.set("remote.phone", phone); },
  async logout() { const t = this.token; this.setToken(null); LS.set("remote.phone", null); LS.set("remote.cache", null); try { await this.rpc("hk_logout", { p_token: t }); } catch {} },
  async setPassword(o, n) { return this.rpc("hk_set_password", { p_token: this.token, p_old: o, p_new: n }); },
  async data() {
    if (!this.token) return this.publicData();
    try { const d = await this.rpc("hk_data", { p_token: this.token }); LS.set("remote.cache", d); return d; }
    catch (e) {
      const c = LS.get("remote.cache"); if (e.code === "offline" && c) return { ...c, offline: true };
      if (e.code === "not_signed_in") return this.publicData(); // the sign-in ran out: show the public parts
      throw e;
    }
  },
  // Before signing in (see hk_public in backend/schema.sql).
  async publicData() {
    try { const d = await this.rpc("hk_public", {}); LS.set("remote.pubcache", d); return d; }
    catch (e) { const c = LS.get("remote.pubcache"); if (e.code === "offline" && c) return { ...c, offline: true }; throw e; }
  },
  file(id) { return this.rpc("hk_file", { p_token: this.token, p_id: id }); },
  rosterFile(id) { return this.rpc("hk_roster_file", { p_token: this.token, p_id: id }); },
  save(kind, d) { return this.rpc("hk_save", { p_token: this.token, p_kind: kind, p_data: d }); },
  del(kind, id) { return this.rpc("hk_remove", { p_token: this.token, p_kind: kind, p_id: String(id) }); },
  membersUpsert(rows) { return this.rpc("hk_members_upsert", { p_token: this.token, p_rows: rows }); },
  birthdaysImport(rows) { return this.rpc("hk_birthdays_import", { p_token: this.token, p_rows: rows }); },
  settingsSave(o) { return this.rpc("hk_settings_save", { p_token: this.token, p_data: o }); },
  serviceHtml(id) { return this.rpc("hk_service_html", { p_token: this.token, p_id: id }); },
  setRole(phone, group, role, name) { return this.rpc("hk_set_role", { p_token: this.token, p_phone: phone, p_group: group, p_role: role, p_name: name || null }); },
  setTeacher(phone, group, role, name) { return this.rpc("hk_set_teacher", { p_token: this.token, p_phone: phone, p_group: group, p_role: role, p_name: name || null }); },
  pollState(id, status) { return this.rpc("hk_poll_state", { p_token: this.token, p_id: id, p_status: status }); },
  vote(id, choices) { return this.rpc("hk_vote", { p_token: this.token, p_id: id, p_choices: choices }); },
  groupWaLink(gid, link) { return this.rpc("hk_group_walink", { p_token: this.token, p_group: gid, p_link: link || null }); },
  calToken() { return this.rpc("hk_cal_token", { p_token: this.token }); },
  profileSave(p) { return this.rpc("hk_profile_save", { p_token: this.token, p }); },
  calUrl(tok) { return `${this.cfg.supabaseUrl}/functions/v1/hkbp-cal?t=${tok}`; },
  pushSave(sub) { return this.rpc("hk_push_save", { p_token: this.token, p_sub: sub }); },
  call(op, d) { return this.rpc("hk_call", { p_token: this.token, p_op: op, p_data: d || {} }); },
  ping(installed) { return this.rpc("hk_ping", { p_token: this.token, p_installed: !!installed }); },
  appStatus() { return this.rpc("hk_app_status", { p_token: this.token }); },
  phoneTries() { return this.rpc("hk_phone_tries_list", { p_token: this.token }); },
};

function pick() {
  const base = window.HKBP_CONFIG || {};
  const over = LS.get("cfg.override", null) || {};
  const cfg = { ...base, ...Object.fromEntries(Object.entries(over).filter(([, v]) => v)) };
  if (cfg.supabaseUrl && cfg.supabaseKey) { Remote.cfg = cfg; return Remote; }
  return Local;
}

window.HKBP_STORE = { pick, LS, phone8, sgToday, AppError, DEFAULT_GROUPS, uid, TEACH, MAKERS, rosterClash };
})();
