// HKBP Singapore calendar feed, as a Supabase Edge Function.
// Each member gets a private link (?t=<their calendar code>, made in the app). A phone calendar that subscribes to it
// shows every general event plus the events of the member's own categories, and updates by itself when events change.
const E = Deno.env.toObject();
const BASE = (E.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = E.SUPABASE_SERVICE_ROLE_KEY || "";

const esc = (s: string) => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
// Lines longer than 75 bytes are folded, as the calendar format asks.
const fold = (l: string) => { const out: string[] = []; let s = l; while (s.length > 74) { out.push(s.slice(0, 74)); s = " " + s.slice(74); } out.push(s); return out.join("\r\n"); };

Deno.serve(async (req) => {
  const t = new URL(req.url).searchParams.get("t") || "";
  if (!/^[0-9a-f]{20,64}$/.test(t)) return new Response("not found", { status: 404 });
  const r = await fetch(`${BASE}/rest/v1/rpc/hk_cal_feed`, { method: "POST", headers: { apikey: KEY, authorization: "Bearer " + KEY, "content-type": "application/json" }, body: JSON.stringify({ p_cal: t }) });
  if (!r.ok) { console.error(await r.text()); return new Response("error", { status: 500 }); }
  const events = await r.json();
  if (!Array.isArray(events)) return new Response("not found", { status: 404 });
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//HKBP Singapore//Sada HKBPS//ID", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:Sada HKBPS", "X-WR-TIMEZONE:Asia/Singapore", "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H"];
  for (const e of events) {
    const end = e.ends_at || new Date(Date.parse(e.starts_at) + 2 * 3600e3).toISOString();
    L.push("BEGIN:VEVENT", `UID:${e.id}@hkbp-singapore`, `DTSTAMP:${stamp(e.updated || e.starts_at)}`, `DTSTART:${stamp(e.starts_at)}`, `DTEND:${stamp(end)}`,
      `SUMMARY:${esc(e.title)}`, `DESCRIPTION:${esc([e.group, e.notes].filter(Boolean).join("\n"))}`);
    if (e.place) L.push(`LOCATION:${esc(e.place)}`);
    if (e.remind_min > 0) L.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.title)}`, `TRIGGER:-PT${e.remind_min}M`, "END:VALARM");
    L.push("END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return new Response(L.map(fold).join("\r\n") + "\r\n", { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "max-age=900" } });
});
