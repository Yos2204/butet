// Data layer. Two modes with the same calls:
//  - remote: a shared Supabase database (everyone sees the same data, real logins and roles)
//  - local: everything stays on this phone (demo / trying the app before the database is set up)
// The role rules in Local mirror backend/schema.sql. Keep them in step.
(() => {
"use strict";
const LS = {
  get(k, d) { try { const v = localStorage.getItem("hkbp." + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { if (v == null) localStorage.removeItem("hkbp." + k); else localStorage.setItem("hkbp." + k, JSON.stringify(v)); } catch {} },
};
const phone8 = (p) => { const d = String(p || "").replace(/\D/g, ""); return d.length === 10 && d.startsWith("65") ? d.slice(2) : d; };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
const sgToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(new Date());

const DEFAULT_GROUPS = [
  ["sekolah-minggu", "sermon", "Sekolah Minggu", "Sikola Minggu", "Sunday School", "#e8913a", "child", 1],
  ["naposo", "sermon", "Naposobulung (Pemuda)", "Naposobulung", "Youth", "#4f6bed", "spark", 2],
  ["ina", "sermon", "Ina (Kaum Ibu)", "Parompuan / Ina", "Mothers", "#c94f8a", "heart", 3],
  ["ama", "sermon", "Ama (Kaum Bapak)", "Ama", "Fathers", "#1f8a70", "shield", 4],
  ["pelaut", "sermon", "Pelaut & Pekerja", "Parlayar dohot Pangula", "Sailors & Workers", "#2a7fb8", "anchor", 5],
  ["multimedia", "service", "Multimedia", "Multimedia", "Multimedia", "#7c5cff", "screen", 11],
  ["jemaat", "service", "Jemaat", "Ruas", "Congregation", "#0f766e", "people", 12],
  ["parhalado", "service", "Parhalado (Penatua & Pendeta)", "Parhalado", "Elders & Pastor", "#8b5a2b", "book", 13],
  ["band", "service", "Band", "Band", "Band", "#e11d48", "drum", 14],
  ["song-leader", "service", "Song Leader", "Song Leader", "Song Leader", "#ca8a04", "mic", 15],
  ["musik", "service", "Pemusik", "Pargonsi / Pemusik", "Musicians", "#0891b2", "note", 16],
].map(([id, kind, name_id, name_bt, name_en, color, icon, sort]) => ({ id, kind, name_id, name_bt, name_en, color, icon, sort }));

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
const Local = {
  mode: "local",
  async load() {
    let db = await idb.get("db");
    if (!db) db = { groups: DEFAULT_GROUPS.slice(), members: [], posts: [], rosters: [], bread: [], updates: [], events: [], outbox: [] };
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
  sees(m, gid) { if (!gid || this.elder(m) || gid in (m.groups || {})) return true; const g = this.dbo.groups.find((x) => x.id === gid); return !!g && g.kind === "service"; },
  async needsSetup() { const db = await this.load(); return !db.members.some((m) => m.is_admin); },
  async setupAdmin(name, phone, pw) {
    const db = await this.load();
    db.members.push({ id: uid(), name, phone: phone8(phone), dob: null, pass_hash: await sha(pw), is_admin: true, groups: { parhalado: "chair" }, wa_optin: false });
    await this.commit();
  },
  hasSession() { return !!LS.get("local.me"); },
  async login(phone, pw) {
    const db = await this.load(); const h = await sha(pw);
    const m = db.members.find((x) => x.phone === phone8(phone));
    if (!m || !m.pass_hash || m.pass_hash !== h) throw new AppError("bad_login");
    LS.set("local.me", m.id);
  },
  async logout() { LS.set("local.me", null); },
  async setPassword(oldPw, newPw) {
    const m = await this.me();
    if ((newPw || "").length < 4) throw new AppError("short_password");
    if (m.pass_hash !== await sha(oldPw)) throw new AppError("bad_login");
    m.pass_hash = await sha(newPw); await this.commit();
  },
  async data() {
    const m = await this.me(); const db = this.dbo; const el = this.elder(m); const today = sgToday();
    const chairOf = Object.entries(m.groups || {}).filter(([, r]) => r === "chair").map(([g]) => g);
    return {
      me: { id: m.id, name: m.name, alias: m.alias, phone: m.phone, dob: m.dob, is_admin: m.is_admin, groups: m.groups, wa_optin: m.wa_optin },
      groups: db.groups.slice().sort((a, b) => a.sort - b.sort),
      posts: db.posts.filter((p) => this.sees(m, p.group_id)).sort((a, b) => b.created_at.localeCompare(a.created_at)),
      rosters: db.rosters.map(({ file_b64, ...r }) => ({ ...r, has_file: !!file_b64 })).sort((a, b) => b.month.localeCompare(a.month) || b.created_at.localeCompare(a.created_at)),
      bread: db.bread.filter((b) => el || b.day <= today).sort((a, b) => b.day.localeCompare(a.day)),
      updates: db.updates.filter((u) => u.audience === "all" || el).sort((a, b) => (b.pinned - a.pinned) || b.created_at.localeCompare(a.created_at)),
      events: db.events.filter((e) => this.sees(m, e.group_id)).sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
      people: db.members.map((x) => ({
        id: x.id, name: x.name, alias: x.alias || null, bday: x.dob ? x.dob.slice(5) : null, groups: x.groups, is_admin: x.is_admin,
        phone: m.is_admin || chairOf.some((g) => g in (x.groups || {})) ? x.phone : null,
        dob: m.is_admin ? x.dob : null, wa_optin: m.is_admin ? x.wa_optin : null, has_password: m.is_admin ? !!x.pass_hash : null,
      })).sort((a, b) => a.name.localeCompare(b.name)),
    };
  },
  async rosterFile(id) { await this.me(); const r = this.dbo.rosters.find((x) => x.id === id); return r ? { file_b64: r.file_b64, mime: r.mime, file_name: r.file_name } : null; },
  async save(kind, d) {
    const m = await this.me(); const db = this.dbo; const now = new Date().toISOString(); const gid = d.group_id || null;
    const deny = () => { throw new AppError("not_allowed"); };
    const upsert = (list, row, key = "id") => { const i = list.findIndex((x) => x[key] === row[key]); if (i >= 0) list[i] = { ...list[i], ...row }; else list.push(row); return i >= 0 ? list[i] : row; };
    let res;
    if (kind === "post") {
      if (!this.chair(m, gid)) deny();
      res = upsert(db.posts, { id: d.id || uid(), group_id: gid, kind: d.kind || "news", title: d.title, verse: d.verse, body: d.body, day: d.day || null, author_name: m.name, created_at: d.created_at || now });
    } else if (kind === "roster") {
      if (!this.chair(m, gid)) deny();
      res = upsert(db.rosters, { id: d.id || uid(), group_id: gid, month: d.month, title: d.title, file_name: d.file_name, mime: d.mime, file_b64: d.file_b64 || null, link: d.link || null, table_json: d.table_json || null, text_content: d.text_content || "", author_name: m.name, created_at: now });
    } else if (kind === "bread") {
      if (!this.elder(m)) deny();
      res = upsert(db.bread, { day: d.day, verse: d.verse, title: d.title, body: d.body, author_name: m.name, updated_at: now }, "day");
    } else if (kind === "update") {
      if (!this.elder(m)) deny();
      res = upsert(db.updates, { id: d.id || uid(), title: d.title, body: d.body, audience: d.audience || "all", pinned: !!d.pinned, author_name: m.name, created_at: d.created_at || now });
    } else if (kind === "event") {
      if (!(this.elder(m) || (gid && this.chair(m, gid)))) deny();
      res = upsert(db.events, { id: d.id || uid(), group_id: gid, title: d.title, starts_at: d.starts_at, ends_at: d.ends_at || null, place: d.place, notes: d.notes, remind_min: +d.remind_min || 1440, author_name: m.name, created_at: now });
    } else if (kind === "group") {
      if (!m.is_admin) deny();
      res = upsert(db.groups, { id: d.id, kind: d.kind || "service", name_id: d.name_id, name_bt: d.name_bt, name_en: d.name_en, color: d.color || "#475569", icon: d.icon || "star", sort: d.sort || 50 });
    } else throw new AppError("unknown_kind");
    await this.commit(); return res;
  },
  async del(kind, id) {
    const m = await this.me(); const db = this.dbo; const deny = () => { throw new AppError("not_allowed"); };
    const lists = { post: "posts", roster: "rosters", bread: "bread", update: "updates", event: "events", group: "groups", member: "members" };
    const key = kind === "bread" ? "day" : "id"; const list = db[lists[kind]]; if (!list) throw new AppError("unknown_kind");
    const row = list.find((x) => x[key] === id); if (!row) return;
    if ((kind === "post" || kind === "roster") && !this.chair(m, row.group_id)) deny();
    if ((kind === "bread" || kind === "update") && !this.elder(m)) deny();
    if (kind === "event" && !(this.elder(m) || (row.group_id && this.chair(m, row.group_id)))) deny();
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
      const row = { name: r.name, alias: r.alias || null, phone: ph, dob: r.dob || (ex && ex.dob) || null, is_admin: ex && ex.id === m.id ? true : !!r.is_admin, groups: r.groups || {}, wa_optin: !!r.wa_optin };
      if (r.password) row.pass_hash = await sha(r.password);
      if (ex) Object.assign(ex, row); else this.dbo.members.push({ id: uid(), pass_hash: null, ...row });
      n++;
    }
    await this.commit(); return n;
  },
  async pushSave() { /* no server in local mode: reminders show when the app is opened */ },
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
      const code = ((j && j.message) || "").match(/not_signed_in|bad_login|bad_code|not_allowed|short_password|file_too_big|unknown_kind/);
      if (code && code[0] === "not_signed_in") LS.set("remote.token", null);
      throw new AppError(code ? code[0] : "server");
    }
    return j;
  },
  get token() { return LS.get("remote.token"); },
  hasSession() { return !!this.token; },
  async needsSetup() { return false; },
  async login(phone, pw) { const r = await this.rpc("hk_login", { p_phone: phone, p_password: pw }); LS.set("remote.token", r.token); },
  async claim(phone, code, pw) { const r = await this.rpc("hk_claim", { p_phone: phone, p_code: code, p_password: pw }); LS.set("remote.token", r.token); },
  async logout() { const t = this.token; LS.set("remote.token", null); LS.set("remote.cache", null); try { await this.rpc("hk_logout", { p_token: t }); } catch {} },
  async setPassword(o, n) { return this.rpc("hk_set_password", { p_token: this.token, p_old: o, p_new: n }); },
  async data() {
    try { const d = await this.rpc("hk_data", { p_token: this.token }); LS.set("remote.cache", d); return d; }
    catch (e) { const c = LS.get("remote.cache"); if (e.code === "offline" && c) return { ...c, offline: true }; throw e; }
  },
  rosterFile(id) { return this.rpc("hk_roster_file", { p_token: this.token, p_id: id }); },
  save(kind, d) { return this.rpc("hk_save", { p_token: this.token, p_kind: kind, p_data: d }); },
  del(kind, id) { return this.rpc("hk_remove", { p_token: this.token, p_kind: kind, p_id: String(id) }); },
  membersUpsert(rows) { return this.rpc("hk_members_upsert", { p_token: this.token, p_rows: rows }); },
  pushSave(sub) { return this.rpc("hk_push_save", { p_token: this.token, p_sub: sub }); },
};

function pick() {
  const base = window.HKBP_CONFIG || {};
  const over = LS.get("cfg.override", null) || {};
  const cfg = { ...base, ...Object.fromEntries(Object.entries(over).filter(([, v]) => v)) };
  if (cfg.supabaseUrl && cfg.supabaseKey) { Remote.cfg = cfg; return Remote; }
  return Local;
}

window.HKBP_STORE = { pick, LS, phone8, sgToday, AppError, DEFAULT_GROUPS, uid };
})();
