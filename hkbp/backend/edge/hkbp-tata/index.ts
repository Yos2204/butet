// Tata Ibadah watcher (YB 2026-10-27): "keep a lookout at my Google Drive for the coming Sunday's Tata Ibadah; every time it changes,
// make the HTML slides from the workbench, send the file to the chairman on WhatsApp, and push-notify all Multimedia makers."
// YB 2026-10-29: a new Drive timestamp also counts as a change (not only new content), and the push goes to that Sunday's
// slide maker(s) from the Multimedia roster (the "Slides" column); with no roster for that Sunday, to all Multimedia makers as before.
//
// The slides are made by the real workbench page in a headless browser, which runs in GitHub Actions every 15 minutes
// (.github/workflows/tata-watch.yml + tools/tata-watch/watch.mjs). That job talks to this function:
//   POST {op: "poll"}                                   -> {changed, file, sunday, hash}   the coming Sunday's file in the church Drive folder,
//                                                                                          downloaded and hashed; changed = not the hash we published last
//   POST {op: "file", id}                               -> the file itself (header x-name)
//   POST {op: "publish", id, hash, name, sunday, html}  -> publishes the slides in Sada (hk_services, shown at #/tata), asks hkbp-wa to send the
//                                                          file to the chairman, queues a push to the slide maker(s), remembers the hash
// Who may call: the GitHub Actions job, proven by GitHub's own signed job token (OIDC, header x-github-token, audience "hkbp-tata",
// repository Yos2204/butet on main), or the database / another function with x-cron-key = hk_settings cron_key. No secret is copied anywhere.
// The watcher's state is hk_settings tata_watch = {key, id, name, hash, sunday, service_id, at}; every step is logged in hk_wa_log.
import * as jose from "npm:jose@5.9.6";

const E = Deno.env.toObject();
const BASE = (E.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = E.SUPABASE_SERVICE_ROLE_KEY || "";
const REPO = E.TATA_WATCH_REPO || "Yos2204/butet";
const H = { apikey: KEY, authorization: "Bearer " + KEY, "content-type": "application/json" };
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-github-token, x-cron-key", "access-control-allow-methods": "POST, OPTIONS", "access-control-expose-headers": "x-name" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "content-type": "application/json" } });
const unent = (s: string) => s.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
const MONTHS_ID = ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember"];
const MONTHS_EN = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

async function setting(key: string): Promise<unknown> {
  const r = await fetch(`${BASE}/rest/v1/hk_settings?key=eq.${key}&select=value`, { headers: H });
  const rows = r.ok ? await r.json() : []; return rows[0] && rows[0].value;
}
async function setSetting(key: string, value: unknown) {
  const r = await fetch(`${BASE}/rest/v1/hk_settings`, { method: "POST", headers: { ...H, prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }) });
  if (!r.ok) throw new Error("setting_" + r.status + " " + await r.text());
}
async function log(ok: boolean, step: string, detail?: unknown, file?: string, to?: string) {
  try { await fetch(`${BASE}/rest/v1/hk_wa_log`, { method: "POST", headers: H, body: JSON.stringify({ ok, step, detail: detail == null ? null : String(typeof detail === "string" ? detail : JSON.stringify(detail)).slice(0, 2000), file: file || null, to_phone: to || null }) }); } catch (e) { console.warn("log", e); }
}

// --- who is calling -----------------------------------------------------------------------------------------------------------
const JWKS = jose.createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));
async function fromGitHub(req: Request): Promise<string> {
  const tok = req.headers.get("x-github-token") || "";
  if (!tok) return "";
  try {
    const { payload } = await jose.jwtVerify(tok, JWKS, { issuer: "https://token.actions.githubusercontent.com", audience: "hkbp-tata" });
    if (payload.repository !== REPO) return "";
    if (payload.ref !== "refs/heads/main") return "";
    return `github:${payload.workflow || "?"}#${payload.run_id || "?"}`;
  } catch (e) { console.warn("oidc", (e as Error).message); return ""; }
}
async function fromCron(req: Request): Promise<string> {
  const k = String((await setting("cron_key")) || "");
  return k && req.headers.get("x-cron-key") === k ? "cron" : "";
}

// --- the church Drive folder (same reading as hkbp-drive: shared "anyone with the link", read through the embedded folder view) ---
type DFile = { id: string; name: string; kind: string; modified: string };
async function list(folder: string): Promise<DFile[]> {
  const r = await fetch(`https://drive.google.com/embeddedfolderview?id=${folder}`, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error("drive_" + r.status);
  const html = await r.text(); const out: DFile[] = [];
  const re = /<div class="flip-entry" id="entry-([\w-]+)"[\s\S]*?<a href="([^"]+)"[\s\S]*?<div class="flip-entry-title">([\s\S]*?)<\/div>(?:[\s\S]*?<div class="flip-entry-last-modified"><div>([\s\S]*?)<\/div>)?/g;
  let m; while ((m = re.exec(html))) {
    const href = unent(m[2]); const kind = /docs\.google\.com\/document/.test(href) ? "gdoc" : /\/folders\//.test(href) ? "folder" : "file";
    if (kind !== "folder") out.push({ id: m[1], name: unent(m[3]).trim(), kind, modified: unent(m[4] || "").trim() });
  }
  return out;
}
const fileUrl = (f: DFile) => f.kind === "gdoc" ? `https://docs.google.com/document/d/${f.id}/export?format=docx` : `https://drive.usercontent.google.com/download?id=${f.id}&export=download&confirm=t`;
const fileName = (f: DFile) => f.kind === "gdoc" ? f.name + ".docx" : f.name;

// --- the coming Sunday, Singapore time, and which file is for it (same scoring as the workbench's sundayScore) --------------------
function sgToday(): Date {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const g = (k: string) => +p.find((x) => x.type === k)!.value;
  return new Date(Date.UTC(g("year"), g("month") - 1, g("day")));
}
function nextSunday(): Date { const d = sgToday(); d.setUTCDate(d.getUTCDate() + (7 - d.getUTCDay()) % 7); return d; }
const iso = (d: Date) => d.toISOString().slice(0, 10);
// The push is in English (YB 2026-10-31); the service title in Sada keeps the Indonesian date.
const enLabel = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(s + "T00:00:00Z")) : "";
const label = (d: Date) => `Minggu, ${d.getUTCDate()} ${MONTHS_ID[d.getUTCMonth()].replace(/^./, (c) => c.toUpperCase())} ${d.getUTCFullYear()}`;
function sundayScore(name: string, sun: Date): number {
  const n = name.toLowerCase().replace(/[_]+/g, " "), d = sun.getUTCDate(), m = sun.getUTCMonth() + 1, y = sun.getUTCFullYear();
  const dd = String(d).padStart(2, "0"), mm = String(m).padStart(2, "0"), yy = String(y).slice(2);
  let s = 0;
  const dayRe = new RegExp("(^|\\D)0?" + d + "(\\D|$)");
  const monthWord = new RegExp(MONTHS_ID[m - 1].slice(0, 3) + "|" + MONTHS_EN[m - 1].slice(0, 3));
  if (dayRe.test(n) && monthWord.test(n)) s += 10;
  for (const p of [dd + mm + y, dd + mm + yy, y + mm + dd, yy + mm + dd]) if (n.indexOf(p) >= 0) s += 10;
  if (new RegExp("(^|\\D)0?" + d + "[-./ ]0?" + m + "([-./ ](" + y + "|" + yy + "))?(\\D|$)").test(n)) s += 10;
  if (/tata\s*-?\s*ibadah|acara\s*ibadah|liturgi|kebaktian|minggu/.test(n)) s += 3;
  return s;
}
async function pick(): Promise<{ sun: Date; f: DFile | null; files: DFile[] }> {
  const folder = await setting("tata_drive_folder");
  if (typeof folder !== "string" || !/^[\w-]{10,}$/.test(folder)) throw new Error("no_folder");
  const sun = nextSunday();
  const files = (await list(folder)).filter((f) => /\.(pdf|docx?)$/i.test(f.name) || f.kind === "gdoc");
  const scored = files.map((f, i) => ({ f, s: sundayScore(f.name, sun), i })).sort((a, b) => (b.s - a.s) || (a.i - b.i));
  // only a file that names this Sunday counts; otherwise there is nothing to watch yet
  return { sun, f: scored.length && scored[0].s >= 10 ? scored[0].f : null, files };
}
async function download(f: DFile): Promise<{ bytes: Uint8Array; type: string }> {
  const r = await fetch(fileUrl(f), { redirect: "follow", headers: { "user-agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error("download_" + r.status);
  return { bytes: new Uint8Array(await r.arrayBuffer()), type: r.headers.get("content-type") || "application/octet-stream" };
}
async function sha256(b: Uint8Array): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", b))].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// --- that Sunday's slide maker(s) from the Multimedia roster (same reading rules as the app) ---------------------------------------
const normN = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const RMONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12 };
const DATE_RE = /\b(\d{1,2})[\s\/.-]+(\d{1,2}|jan\w*|feb\w*|mar\w*|apr\w*|mei|may|jun\w*|jul\w*|agu\w*|aug\w*|sep\w*|okt\w*|oct\w*|nov\w*|des\w*|dec\w*)(?:[\s\/.-]+(\d{2,4}))?/i;
function rowDate(row: string[], ym: string) {
  for (const c of row) {
    const isoM = String(c).match(/\b(20\d{2})-(\d{2})-(\d{2})\b/); if (isoM) return isoM[0];
    const m = String(c).match(DATE_RE); if (!m) continue;
    const day = +m[1]; const mon = /^\d+$/.test(m[2]) ? +m[2] : RMONTHS[m[2].slice(0, 3).toLowerCase()];
    if (!mon || day < 1 || day > 31 || mon > 12) continue;
    let y = m[3] ? +m[3] : +ym.slice(0, 4); if (y < 100) y += 2000;
    return `${y}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
}
function namesOf(p: { name: string; alias?: string }, all: { name: string }[]) {
  const out = new Set<string>(); const full = normN(p.name); if (full) out.add(full);
  const toks = full.split(" ").filter((x) => !/^(pdt|st|sintua|bapak|ibu|kak|bang|ev|dr|br)$/.test(x));
  if (toks.length >= 2) out.add(toks.slice(0, 2).join(" "));
  const uniq = (w: string) => all.filter((q) => normN(q.name).split(" ").includes(w)).length <= 1;
  if (toks[0] && toks[0].length >= 3 && uniq(toks[0])) out.add(toks[0]);
  const last = toks[toks.length - 1]; if (toks.length >= 2 && last.length >= 3 && uniq(last)) out.add(last);
  String(p.alias || "").split(/[,;\/]/).map(normN).filter((x) => x.length >= 3).forEach((a) => out.add(a));
  return [...out];
}
const hitN = (cell: string, names: string[]) => { const c = " " + normN(cell) + " "; return names.some((n) => c.includes(" " + n + " ")); };
async function slideMakers(sundayIso: string): Promise<{ id: string; name: string }[]> {
  const rs = await fetch(`${BASE}/rest/v1/hk_rosters?select=month,table_json&group_id=eq.multimedia&month=eq.${sundayIso.slice(0, 7)}&removed_at=is.null`, { headers: H });
  const rosters = rs.ok ? await rs.json() : [];
  const ms = await fetch(`${BASE}/rest/v1/hk_members?select=id,name,alias&removed_at=is.null`, { headers: H });
  const members = ms.ok ? await ms.json() : [];
  const out = new Map<string, string>();
  for (const r of rosters) for (const tb of r.table_json || []) {
    const rows: string[][] = tb.rows || []; const hi = Math.max(0, rows.findIndex((x) => x.filter(Boolean).length >= 2)); const head = rows[hi] || [];
    const cols = head.map((h, j) => (j && /slide/i.test(String(h || "")) ? j : -1)).filter((j) => j > 0);
    if (!cols.length) continue;
    rows.forEach((row, i) => {
      if (i <= hi || rowDate(row, r.month) !== sundayIso) return;
      for (const m of members) { const names = namesOf(m, members); if (cols.some((j) => hitN(row[j] || "", names))) out.set(m.id, m.name); }
    });
  }
  return [...out.entries()].map(([id, name]) => ({ id, name }));
}

// --- the three operations ---------------------------------------------------------------------------------------------------------
type Watch = { key?: string; id?: string; name?: string; hash?: string; sunday?: string; service_id?: string; at?: string; modified?: string };

async function poll() {
  const { sun, f } = await pick();
  const sunday = { iso: iso(sun), label: label(sun) };
  if (!f) return json({ changed: false, reason: "no_file_for_sunday", sunday });
  const { bytes } = await download(f);
  const content = await sha256(bytes);
  // The Drive timestamp is part of the version: saving the file again (a new timestamp) also makes new slides.
  const stamp = f.modified ? (await sha256(new TextEncoder().encode(f.modified))).slice(0, 8) : "";
  const hash = stamp ? `${content}.${stamp}` : content;
  const key = `${f.id}:${hash}`;
  const w = ((await setting("tata_watch")) || {}) as Watch;
  // One-time switch-over: the file published before timestamps counted is not re-sent, only remembered with its timestamp.
  if (w.key === `${f.id}:${content}` && !w.modified) { await setSetting("tata_watch", { ...w, key, hash, modified: f.modified }); return json({ changed: false, reason: "switched_to_timestamps", sunday }); }
  const changed = w.key !== key;
  if (changed) await log(true, "tata_poll", { id: f.id, name: f.name, modified: f.modified, hash: hash.slice(0, 12), was: (w.key || "").slice(-12) }, fileName(f));
  return json({ changed, file: { id: f.id, name: fileName(f), kind: f.kind, modified: f.modified }, sunday, hash, size: bytes.length });
}

async function file(id: string) {
  const { files } = await pick();
  const f = files.find((x) => x.id === id);
  if (!f) return json({ error: "not_in_folder" }, 404);
  const { bytes, type } = await download(f);
  return new Response(bytes, { headers: { ...CORS, "content-type": type, "x-name": encodeURIComponent(fileName(f)) } });
}

async function publish(b: Record<string, unknown>, who: string) {
  const id = String(b.id || ""), hash = String(b.hash || ""), name = String(b.name || ""), html = String(b.html || "");
  const sunday = (b.sunday || {}) as { iso?: string; label?: string };
  if (!id || !hash || !html || !sunday.iso) return json({ error: "bad_request" }, 400);
  if (html.length > 9_000_000) return json({ error: "file_too_big" }, 413);
  const w = ((await setting("tata_watch")) || {}) as Watch;
  const key = `${id}:${hash}`;
  if (w.key === key && w.service_id) return json({ ok: true, already: true, service_id: w.service_id });
  // 1. the slides in Sada: one service per Sunday made by the watcher, replaced in place when the file changes again
  const title = `Tata Ibadah · ${sunday.label || sunday.iso}`;
  const row = { service_date: sunday.iso, title, html, author_name: "Multimedia · autopilot" };
  let serviceId = "";
  if (w.service_id && w.sunday === sunday.iso) {
    const r = await fetch(`${BASE}/rest/v1/hk_services?id=eq.${w.service_id}&select=id`, { method: "PATCH", headers: { ...H, prefer: "return=representation" }, body: JSON.stringify({ ...row, removed_at: null }) });
    const rows = r.ok ? await r.json() : [];
    if (rows.length) serviceId = rows[0].id;
  }
  if (!serviceId) {
    const r = await fetch(`${BASE}/rest/v1/hk_services?select=id`, { method: "POST", headers: { ...H, prefer: "return=representation" }, body: JSON.stringify(row) });
    if (!r.ok) { const t = await r.text(); await log(false, "tata_publish", t.slice(0, 300), name); return json({ error: "publish_" + r.status, detail: t.slice(0, 300) }, 502); }
    serviceId = (await r.json())[0].id;
  }
  const modified = (b.file && (b.file as { modified?: string }).modified) || w.modified || "";
  await setSetting("tata_watch", { key, id, name, hash, sunday: sunday.iso, service_id: serviceId, at: new Date().toISOString(), by: who, modified: modified || "seen" });
  await log(true, "tata_publish", { service_id: serviceId, sunday: sunday.iso, bytes: html.length, by: who }, name);
  // 2. the file to the chairman (hkbp-wa does the WhatsApp part and logs its own result); force = a changed file goes again even on the same day
  let wa: unknown = null;
  try {
    const r = await fetch(`${BASE}/functions/v1/hkbp-wa`, { method: "POST", headers: { ...H, "x-cron-key": String((await setting("cron_key")) || "") }, body: JSON.stringify({ id, sunday: sunday.label, force: true }) });
    wa = { status: r.status, ...(await r.json().catch(() => ({}))) };
  } catch (e) { wa = { error: String((e as Error).message || e) }; }
  // 3. the push: to that Sunday's slide maker(s) on the Multimedia roster; with no roster for that Sunday, to all Multimedia makers
  const sendTo = (await setting("tata_send_to")) as { name?: string } | null;
  const waOk = !!(wa && (wa as { ok?: boolean }).ok);
  const waLine = waOk ? "Sent to " + ((sendTo && sendTo.name) || "the chairman") + " on WhatsApp ✓" : "Not sent on WhatsApp yet (see the log)";
  const title2 = `⛪ New Tata Ibadah · ${enLabel(sunday.iso) || sunday.label}`;
  let makers: { id: string; name: string }[] = [];
  try { makers = await slideMakers(sunday.iso); } catch (e) { console.warn("roster", e); }
  const rows = makers.length
    ? makers.map((p) => ({ audience: "member:" + p.id, title: title2, body: `You're on Slides this Sunday. The slides are ready, tap to view them.\n${name}\n${waLine}`, url: `#/tata/${serviceId}` }))
    : [{ audience: "makers:multimedia", title: title2, body: `${name}\n${waLine} · tap to view the slides.`, url: `#/tata/${serviceId}` }];
  await fetch(`${BASE}/rest/v1/hk_outbox`, { method: "POST", headers: H, body: JSON.stringify(rows) });
  await log(true, "tata_push", { to: makers.length ? makers.map((p) => p.name) : "all Multimedia makers (no roster for that Sunday)" }, name);
  return json({ ok: true, service_id: serviceId, wa, push_to: makers.length ? makers.map((p) => p.name) : "makers:multimedia" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const who = (await fromGitHub(req)) || (await fromCron(req));
    if (!who) return json({ error: "not_allowed" }, 403);
    const b = await req.json().catch(() => ({})) as Record<string, unknown>;
    const op = String(b.op || "poll");
    if (op === "poll") return await poll();
    if (op === "file") return await file(String(b.id || ""));
    if (op === "publish") return await publish(b, who);
    if (op === "who") return json({ sunday: String(b.sunday || ""), slide_makers: await slideMakers(String(b.sunday || "")) });
    return json({ error: "unknown_op" }, 400);
  } catch (e) { console.error(e); await log(false, "tata_error", String((e as Error).message || e)); return json({ error: String((e as Error).message || e) }, 500); }
});
