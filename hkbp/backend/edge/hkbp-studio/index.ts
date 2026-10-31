// Studio booking reminders -> push to the band (YB 2026-10-28).
// A Google Apps Script in YB's Gmail finds new "Booking Reminder" emails from Tonehouse Studios and posts them here
// with the private studio_key. This reads the date, time and place, looks up who is on ReNa Band's roster for that Sunday,
// and queues one push for each of them (hk_outbox; the queue sends right away). With no roster for that date, the whole band is told.
// Each email is handled once (hk_sent key studio:<message id>). With "dry": true it only reports what it would send.
const E = Deno.env.toObject();
const BASE = (E.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = E.SUPABASE_SERVICE_ROLE_KEY || "";
const H = { apikey: KEY, authorization: "Bearer " + KEY, "content-type": "application/json" };
const GROUP = "band";

async function db(path: string, opt: RequestInit = {}) {
  const r = await fetch(`${BASE}/rest/v1/${path}`, { ...opt, headers: { ...H, ...(opt.headers || {}) } });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
const claim = async (key: string) =>
  (await db("hk_sent", { method: "POST", headers: { Prefer: "return=representation,resolution=ignore-duplicates" }, body: JSON.stringify({ key }) })).length > 0;

// ---- roster reading: the same rules as the app and hkbp-notify ----
const normN = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12 };
const DATE_RE = /\b(\d{1,2})[\s\/.-]+(\d{1,2}|jan\w*|feb\w*|mar\w*|apr\w*|mei|may|jun\w*|jul\w*|agu\w*|aug\w*|sep\w*|okt\w*|oct\w*|nov\w*|des\w*|dec\w*)(?:[\s\/.-]+(\d{2,4}))?/i;
function rowDate(row: string[], ym: string) {
  for (const c of row) {
    const iso = String(c).match(/\b(20\d{2})-(\d{2})-(\d{2})\b/); if (iso) return iso[0];
    const m = String(c).match(DATE_RE); if (!m) continue;
    const day = +m[1]; const mon = /^\d+$/.test(m[2]) ? +m[2] : MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (!mon || day < 1 || day > 31 || mon > 12) continue;
    let y = m[3] ? +m[3] : +ym.slice(0, 4); if (y < 100) y += 2000;
    return `${y}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
}
function namesOf(p: any, all: any[]) {
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

// ---- reading the email ----
const EN_MONTHS: Record<string, number> = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
function parse(subject: string, body: string) {
  const text = `${subject}\n${body}`.replace(/\r/g, "");
  const m = text.match(/(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day,\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (!m || !EN_MONTHS[m[1].toLowerCase()]) return null;
  const day = `${m[3]}-${String(EN_MONTHS[m[1].toLowerCase()]).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  const start = `${m[4].padStart(2, "0")}:${m[5]}`;
  const dur = text.match(/\((\d+)\s*hours?(?:\s+(\d+)\s*minutes?)?\)|\((\d+)\s*minutes?\)/i);
  const mins = dur ? (dur[1] ? +dur[1] * 60 + +(dur[2] || 0) : +(dur[3] || 0)) : 0;
  let end = "";
  if (mins) { const t = +m[4] * 60 + +m[5] + mins; end = `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; }
  const where = (body.match(/Where\s*[:\n]?\s*(.+)/i) || [])[1] || "";
  const what = (body.match(/What\s*[:\n]?\s*(.+)/i) || [])[1] || (subject.match(/Reminder:\s*(.+?)\s+is on/i) || [])[1] || "";
  return { day, start, end, where: where.replace(/\s+/g, " ").trim().slice(0, 120), what: what.replace(/\s+/g, " ").trim().slice(0, 80) };
}
const dayLabel = (iso: string) => new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Singapore", weekday: "long", day: "numeric", month: "long" }).format(new Date(iso + "T12:00:00+08:00"));

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response("ok");
    const p = await req.json().catch(() => ({}));
    const [s] = await db("hk_settings?select=value&key=eq.studio_key");
    if (!s || !p.key || p.key !== s.value) return new Response("forbidden", { status: 403 });
    const b = parse(String(p.subject || ""), String(p.body || ""));
    if (!b) return Response.json({ ok: false, reason: "no date found in the email" });
    if (!p.dry && p.id && !(await claim("studio:" + String(p.id).slice(0, 80)))) return Response.json({ ok: true, reason: "already handled" });

    const members = await db("hk_members?select=id,name,alias,groups&removed_at=is.null");
    const rosters = await db(`hk_rosters?select=month,table_json&group_id=eq.${GROUP}&month=eq.${b.day.slice(0, 7)}&removed_at=is.null`);
    const who = new Map<string, string[]>();
    for (const r of rosters || []) for (const tb of r.table_json || []) {
      const rows: string[][] = tb.rows || []; const hi = Math.max(0, rows.findIndex((x) => x.filter(Boolean).length >= 2)); const head = rows[hi] || [];
      rows.forEach((row, i) => {
        if (i <= hi || rowDate(row, r.month) !== b.day) return;
        for (const m of members) {
          const names = namesOf(m, members);
          const jobs = row.map((c, j) => (j && hitN(c, names) && head[j] && head[j] !== c ? head[j] : null)).filter(Boolean) as string[];
          if (jobs.length) who.set(m.id, [...(who.get(m.id) || []), ...jobs]);
        }
      });
    }
    const when = `${dayLabel(b.day)} · ${b.start}${b.end ? "–" + b.end : ""}`;
    const base = `${when}${b.where ? "\n📍 " + b.where : ""}\nTonehouse Studios`;
    const title = "🎸 Latihan Studio ReNa Band";
    const name = (id: string) => (members.find((m: any) => m.id === id) || {}).name;
    const rows = who.size
      ? [...who.entries()].map(([id, jobs]) => ({ audience: "member:" + id, title, body: `${base}\nAnda: ${[...new Set(jobs)].join(", ")}`, url: `#/s/${GROUP}?m=${b.day.slice(0, 7)}` }))
      : [{ audience: "group:" + GROUP, title, body: base, url: `#/s/${GROUP}?m=${b.day.slice(0, 7)}` }];
    const report = { day: b.day, start: b.start, end: b.end, where: b.where, notified: who.size ? [...who.keys()].map(name) : "the whole band (no roster for that date)", message: { title, body: rows[0].body } };
    if (p.dry) return Response.json({ ok: true, dry: true, ...report });
    await db("hk_outbox", { method: "POST", body: JSON.stringify(rows) });
    return Response.json({ ok: true, ...report });
  } catch (e) { console.error(e); return Response.json({ ok: false, error: (e as Error).message }, { status: 500 }); }
});
