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
  // Office categories: only the office holders (set by the admin by phone number) and the admin see them.
  ["secretary", "office", "Sekretaris", "Sekretaris", "Secretary", "#334155", "file", 21],
  ["treasurer", "office", "Bendahara", "Bendahara", "Treasurer", "#15803d", "coins", 22],
  ["chairman", "office", "Ketua", "Ketua", "Chairman", "#9f1239", "gavel", 23],
].map(([id, kind, name_id, name_bt, name_en, color, icon, sort]) => ({ id, kind, name_id, name_bt, name_en, color, icon, sort }));

// Categories run by teachers (Teacher Makers and Teachers), see hk__teach in backend/schema.sql.
const TEACH = ["naposo", "sekolah-minggu"];

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
    db.polls = db.polls || []; db.votes = db.votes || [];
    db.birthdays = db.birthdays || []; db.settings = db.settings || {}; db.services = db.services || []; db.files = db.files || [];
    for (const g of DEFAULT_GROUPS) if (g.kind === "office" && !db.groups.some((x) => x.id === g.id)) db.groups.push({ ...g });
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
  poster(m, gid) { return this.teach(gid) ? m.is_admin || (m.groups || {})[gid] === "tmaker" : this.chair(m, gid); },
  teacher: (m, gid) => m.is_admin || ["tmaker", "teacher"].includes((m.groups || {})[gid]),
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
  async login(phone, pw) {
    const db = await this.load(); const h = await sha(pw);
    const m = db.members.find((x) => x.phone === phone8(phone));
    if (m && !m.pass_hash && !pw && !m.is_admin && !Object.entries(m.groups || {}).some(([g, r]) => r !== "member" || g === "parhalado" || (db.groups.find((x) => x.id === g) || {}).kind === "office")) { LS.set("local.me", m.id); return; }
    if (m && !m.pass_hash) throw new AppError("needs_password");
    if (!m || m.pass_hash !== h) throw new AppError("bad_login");
    LS.set("local.me", m.id);
  },
  async firstPassword(phone, pw) {
    const db = await this.load(); const m = db.members.find((x) => x.phone === phone8(phone));
    if (!m || m.pass_hash) throw new AppError("bad_login");
    if ((pw || "").length < 6) throw new AppError("short_password");
    m.pass_hash = await sha(pw); await this.commit(); LS.set("local.me", m.id);
  },
  async logout() { LS.set("local.me", null); },
  async setPassword(oldPw, newPw) {
    const m = await this.me();
    if ((newPw || "").length < 6) throw new AppError("short_password");
    if (m.pass_hash !== await sha(oldPw)) throw new AppError("bad_login");
    m.pass_hash = await sha(newPw); await this.commit();
  },
  // Before signing in: the same public parts as hk_public() in backend/schema.sql.
  async publicData() {
    const db = await this.load(); const today = sgToday(); const svc = (gid) => { const g = db.groups.find((x) => x.id === gid); return !!g && g.kind === "service"; };
    return {
      me: null, posts: [], people: [], birthdays: [], files: [], polls: [],
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
    const chairOf = Object.entries(m.groups || {}).filter(([, r]) => r === "chair" || r === "tmaker").map(([g]) => g);
    const since = new Date(Date.now() - 180 * 864e5).toISOString();
    const off = this.office(m); const hide = off ? [] : this.officeIds();
    const strip = (gs) => Object.fromEntries(Object.entries(gs || {}).filter(([k]) => !hide.includes(k)));
    return {
      me: { id: m.id, name: m.name, alias: m.alias, phone: m.phone, dob: m.dob, wed: m.wed || null, is_admin: m.is_admin, groups: m.groups, wa_optin: m.wa_optin },
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
      polls: db.polls.filter((p) => this.sees(m, p.group_id) && p.created_at > since && (p.status !== "draft" || this.teacher(m, p.group_id))).map((p) => {
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
    } else if (kind === "roster") {
      if (!this.chair(m, gid)) deny();
      res = upsert(db.rosters, { id: d.id || uid(), group_id: gid, month: d.month, title: d.title, file_name: d.file_name, mime: d.mime, file_b64: d.file_b64 || null, link: d.link || null, table_json: d.table_json || null, text_content: d.text_content || "", author_name: m.name, created_at: now });
    } else if (kind === "bread") {
      if (!this.elder(m)) deny();
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
    else if ((kind === "bread" || kind === "update" || kind === "birthday") && !this.elder(m)) deny();
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
      const keep = ex ? Object.fromEntries(Object.entries(ex.groups || {}).filter(([g, v]) => this.officeIds().includes(g) || v === "tmaker" || v === "teacher")) : {};
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
    if (!["", "tmaker", "teacher"].includes(role || "")) throw new AppError("unknown_kind");
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
    if (!p || p.status !== "open" || !this.sees(m, p.group_id)) throw new AppError("not_allowed");
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
    const m = await this.me(); if (!(m.is_admin || ["chair", "tmaker"].includes((m.groups || {})[gid]))) throw new AppError("not_allowed");
    const l = String(link || "").trim() || null; if (l && !/^https:\/\/(chat\.whatsapp\.com|wa\.me|whatsapp\.com)\//.test(l)) throw new AppError("bad_link");
    const g = this.dbo.groups.find((x) => x.id === gid); if (g) g.wa_link = l; await this.commit();
  },
  async calToken() { throw new AppError("demo_only"); }, // a calendar feed needs the shared database
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
      const code = ((j && j.message) || "").match(/not_signed_in|bad_login|needs_password|not_allowed|short_password|file_too_big|unknown_kind|bad_phone|need_name/);
      if (code && code[0] === "not_signed_in") LS.set("remote.token", null);
      throw new AppError(code ? code[0] : "server");
    }
    return j;
  },
  get token() { return LS.get("remote.token"); },
  hasSession() { return !!this.token; },
  async needsSetup() { return false; },
  async login(phone, pw) { const r = await this.rpc("hk_login", { p_phone: phone, p_password: pw }); LS.set("remote.token", r.token); },
  async firstPassword(phone, pw) { const r = await this.rpc("hk_first_password", { p_phone: phone, p_password: pw }); LS.set("remote.token", r.token); },
  async logout() { const t = this.token; LS.set("remote.token", null); LS.set("remote.cache", null); try { await this.rpc("hk_logout", { p_token: t }); } catch {} },
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
  calUrl(tok) { return `${this.cfg.supabaseUrl}/functions/v1/hkbp-cal?t=${tok}`; },
  pushSave(sub) { return this.rpc("hk_push_save", { p_token: this.token, p_sub: sub }); },
};

function pick() {
  const base = window.HKBP_CONFIG || {};
  const over = LS.get("cfg.override", null) || {};
  const cfg = { ...base, ...Object.fromEntries(Object.entries(over).filter(([, v]) => v)) };
  if (cfg.supabaseUrl && cfg.supabaseKey) { Remote.cfg = cfg; return Remote; }
  return Local;
}

window.HKBP_STORE = { pick, LS, phone8, sgToday, AppError, DEFAULT_GROUPS, uid, TEACH };
})();
