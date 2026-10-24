// HKBP Singapore notification job, as a Supabase Edge Function.
// The database calls it every 15 minutes (pg_cron + pg_net, see schema.sql), so nothing has to be set up in GitHub.
// It sends phone notifications (Web Push):
//  - daily bread at the hour the admin chose in the setup pop-up (default 06:00 Singapore time),
//    drafted by Claude when the admin chose that and no elder wrote one;
//    the members picked as WhatsApp senders also get a "tap to post it in the WhatsApp group" notification
//  - 08:00: birthday and wedding-anniversary wishes to the member, a "today in your category" notice to the rest of the category,
//    and to each category leader a "tap to send the wishes to the WhatsApp group" notification
//  - event reminders at each event's reminder time, to the event's category (or the whole church)
//  - announcements queued from the app ("notify members now")
// Every message is logged in hk_sent, so nothing is sent twice even if a run repeats.
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase. Everything else lives in the locked hk_settings table:
// the push keys are created by this job on its first run (the app reads only the public one), cron_key is created by the
// database, and the Claude API key is saved by the admin in the app. Nobody has to copy a secret anywhere.
import webpush from "npm:web-push@3.6.7";
import Anthropic from "npm:@anthropic-ai/sdk";

const E = Deno.env.toObject();
const BASE = (E.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = E.SUPABASE_SERVICE_ROLE_KEY || "";
const H = { apikey: KEY, authorization: "Bearer " + KEY, "content-type": "application/json" };
const BDAY_HOUR = 8;

async function db(path: string, opt: RequestInit = {}) {
  const r = await fetch(`${BASE}/rest/v1/${path}`, { ...opt, headers: { ...H, ...(opt.headers || {}) } });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
// Claim a message key; false means it was already sent.
const claim = async (key: string) =>
  (await db("hk_sent", { method: "POST", headers: { Prefer: "return=representation,resolution=ignore-duplicates" }, body: JSON.stringify({ key }) })).length > 0;

async function run(S: Record<string, any>) {
  const sg = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(new Date());
  const part = (k: string) => sg.find((p) => p.type === k)!.value;
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  const hour = +part("hour") % 24;
  const addDays = (iso: string, n: number) => new Date(Date.parse(iso + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);

  const source = S.bread_source || "elders";            // claude_daily | claude_week | elders
  const breadHour = +(S.bread_hour ?? 6);
  const breadLang = S.bread_lang || "id";
  const senders: string[] = Array.isArray(S.wa_senders) ? S.wa_senders : [];

  if (!S.vapid_public || !S.vapid_private) {
    const k = webpush.generateVAPIDKeys();
    await db("hk_settings", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify([{ key: "vapid_public", value: k.publicKey }, { key: "vapid_private", value: k.privateKey }]) });
    const fresh = Object.fromEntries((await db("hk_settings?select=key,value&key=in.(vapid_public,vapid_private)")).map((r: any) => [r.key, r.value]));
    S.vapid_public = fresh.vapid_public; S.vapid_private = fresh.vapid_private;
  }
  const pushOn = !!(S.vapid_public && S.vapid_private);
  if (pushOn) webpush.setVapidDetails("mailto:admin@hkbp-singapore.org", S.vapid_public, S.vapid_private);

  const members = await db("hk_members?select=id,name,alias,phone,dob,wed,is_admin,groups&removed_at=is.null");
  const subs = await db("hk_push?select=endpoint,member_id,sub&revoked=is.false");
  const audience = (a: string) => {
    if (a === "all") return members;
    if (a === "elders") return members.filter((m: any) => m.is_admin || "parhalado" in (m.groups || {}));
    if (a.startsWith("group:")) { const g = a.slice(6); return members.filter((m: any) => g in (m.groups || {})); }
    if (a.startsWith("member:")) return members.filter((m: any) => m.id === a.slice(7));
    return [];
  };
  let sent = 0;
  // web-push builds the encrypted request; fetch sends it (Deno has no node https agent).
  async function push(people: any[], payload: Record<string, unknown>) {
    if (!pushOn) return;
    const ids = new Set(people.map((m) => m.id));
    for (const s of subs.filter((x: any) => ids.has(x.member_id))) {
      try {
        const d = webpush.generateRequestDetails(s.sub, JSON.stringify(payload), { TTL: 6 * 3600 });
        const r = await fetch(d.endpoint, { method: d.method, headers: d.headers as Record<string, string>, body: d.body });
        if (r.status === 404 || r.status === 410) await db(`hk_push?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: "PATCH", body: JSON.stringify({ revoked: true }) });
        else if (r.ok) sent++;
        else console.warn("push failed", r.status, (await r.text()).slice(0, 200));
      } catch (e) { console.warn("push error", (e as Error).message); }
    }
  }

  const claudeKey = S.claude_key || "";
  async function draftBread(day: string) {
    if (!claudeKey) return null;
    const recent = (await db("hk_bread?select=verse&order=day.desc&limit=30")).map((b: any) => b.verse).filter(Boolean);
    const L = ({ id: "Bahasa Indonesia", bt: "Bahasa Batak Toba", en: "English" } as Record<string, string>)[breadLang] || "Bahasa Indonesia";
    const client = new Anthropic({ apiKey: claudeKey });
    const res: any = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content:
        `You write the "Daily Bread" (Renungan Harian) for HKBP Singapore, a Batak Lutheran congregation in Singapore (families, youth, sailors and migrant workers). Write it for ${day} in ${L}. Pick one Bible passage fitting the church year; do not reuse: ${recent.join("; ") || "none"}. Reference in ${L} book names. Short warm title. Body 120-170 words: the key verse briefly, one clear thought, one practical step for today, a one-line prayer. Lutheran, Christ-centred, simple words. Reply with JSON only: {"verse":"...","title":"...","body":"..."}` }],
    } as any);
    if (res.stop_reason === "refusal") { console.warn("Claude declined the draft"); return null; }
    const txt = (res.content || []).map((c: any) => (c.type === "text" ? c.text : "")).join("");
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const b = { day, ...JSON.parse(m[0]), author_name: "Claude (draft)" };
    await db("hk_bread", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify(b) });
    return b;
  }

  // 1. Daily bread
  if (source !== "elders" && claudeKey) {
    // "claude_week": keep 7 days drafted ahead so elders can read them first (at most 2 drafts per run).
    const ahead = source === "claude_week" ? 7 : 0;
    const have = new Set((await db(`hk_bread?day=gte.${today}&day=lte.${addDays(today, ahead)}&select=day`)).map((b: any) => b.day));
    let made = 0;
    for (let i = 0; i <= ahead && made < 2; i++) {
      const d = addDays(today, i);
      if (have.has(d) || (i === 0 && hour < breadHour - 1 && ahead === 0)) continue;
      try { if (await draftBread(d)) made++; } catch (e) { console.warn("draft failed", (e as Error).message); break; }
    }
  }
  if (hour >= breadHour) {
    const [b] = await db(`hk_bread?day=eq.${today}&removed_at=is.null&select=*`);
    if (b && await claim("bread:" + today)) {
      await push(members, { title: `📖 Renungan Harian: ${b.title || ""}`, body: `${b.verse || ""}\n${(b.body || "").slice(0, 160)}`, url: `#/bread/${today}`, tag: "bread" });
      const who = members.filter((m: any) => senders.includes(m.id));
      await push(who, { title: "📲 Kirim renungan ke grup WhatsApp", body: `${b.title || ""}: ketuk untuk membagikan ke grup "Daily Bread".`, url: `#/bread/${today}?wa=1`, tag: "bread-wa" });
    }
  }
  // 2. Birthdays and wedding anniversaries (08:00 to 21:00 only, so a late run never wakes anyone)
  if (hour >= BDAY_HOUR && hour < 21) {
    const md = today.slice(5);
    const first = (n: string) => n.replace(/^(Pdt|St|Sintua|Bapak|Bpk|Ibu|Kak|Bang|Ev|Dr|Kel)\.?\s+/i, "").split(/\s+/)[0];
    const isB = (m: any) => m.dob && m.dob.slice(5) === md, isA = (m: any) => m.wed && m.wed.slice(5) === md;
    // The Secretary's birthday list comes first: the wish uses the first name written on that list.
    const norm = (n: string) => (n || "").toLowerCase().replace(/^(pdt|st|sintua|bapak|bpk|ibu|kak|bang|ev|dr|kel)\.?\s+/, "").replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
    const list = (await db("hk_birthdays?select=name,dob&removed_at=is.null")).filter((x: any) => x.dob && x.dob.slice(5) === md);
    for (const e of list) {
      const n = norm(e.name);
      const m = members.find((x: any) => norm(x.name) === n || (x.alias || "").split(",").some((a: string) => norm(a) === n));
      if (m && await claim(`bday:${today}:${m.id}`))
        await push([m], { title: `Selamat Ulang tahun, ${first(e.name)}!`, body: "Seluruh keluarga HKBP Singapore bersyukur untukmu. Tuhan memberkati dan melindungimu (Bil 6:24).", url: "#/home", tag: "bday" });
    }
    for (const m of members.filter(isB)) {
      if (await claim(`bday:${today}:${m.id}`))
        await push([m], { title: `Selamat Ulang tahun, ${first(m.name)}!`, body: "Seluruh keluarga HKBP Singapore bersyukur untukmu. Tuhan memberkati dan melindungimu (Bil 6:24).", url: "#/home", tag: "bday" });
    }
    for (const m of members.filter(isA)) {
      if (await claim(`anniv:${today}:${m.id}`))
        await push([m], { title: `Selamat ulang tahun pernikahan, ${first(m.name)}! 💍`, body: "Kiranya Tuhan terus memberkati rumah tanggamu. \"Apa yang telah dipersatukan Allah, tidak boleh diceraikan manusia\" (Mat 19:6).", url: "#/home", tag: "anniv" });
    }
    // Each category: the other members get one notice, the leaders get the ready-made wishes for the WhatsApp group.
    const cats = await db("hk_groups?kind=eq.sermon&removed_at=is.null&select=id,name_id");
    for (const g of cats) {
      const inG = members.filter((m: any) => g.id in (m.groups || {}));
      const b = inG.filter(isB), a = inG.filter(isA);
      if (!b.length && !a.length) continue;
      if (!(await claim(`cat:${today}:${g.id}`))) continue;
      const who = new Set([...b, ...a].map((m: any) => m.id));
      const body = [b.length ? `🎂 Ulang tahun: ${b.map((m: any) => m.name).join(", ")}` : "", a.length ? `💍 Ulang tahun pernikahan: ${a.map((m: any) => m.name).join(", ")}` : ""].filter(Boolean).join("\n");
      const leaders = inG.filter((m: any) => ["chair", "tmaker", "ychair", "ytreasurer", "ysecretary"].includes(m.groups[g.id]));
      const lead = new Set(leaders.map((m: any) => m.id));
      await push(inG.filter((m: any) => !who.has(m.id) && !lead.has(m.id)), { title: `Hari ini di ${g.name_id} 🎉`, body: body + "\nUcapkan selamat dan doakan mereka!", url: `#/g/${g.id}?wish=${today}`, tag: "cat-" + g.id });
      await push(leaders, { title: `📲 Kirim ucapan ke grup WA ${g.name_id}`, body: body + "\nKetuk: ucapan sudah disiapkan, tinggal tempel dan kirim.", url: `#/g/${g.id}?wish=${today}`, tag: "catwa-" + g.id });
    }
  }
  // 3. Event reminders
  const now = Date.now();
  const events = await db(`hk_events?starts_at=gt.${new Date(now).toISOString()}&starts_at=lt.${new Date(now + 8 * 864e5).toISOString()}&removed_at=is.null&select=*`);
  for (const e of events.filter((x: any) => x.remind_min > 0 && new Date(x.starts_at).getTime() - x.remind_min * 60e3 <= now)) {
    if (await claim(`event:${e.id}:${e.remind_min}:${e.starts_at}`)) {
      const when = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Singapore", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(e.starts_at));
      await push(audience(e.group_id ? "group:" + e.group_id : "all"), { title: `🗓 ${e.title}`, body: `${when}${e.place ? " · " + e.place : ""}`, url: "#/calendar", tag: "ev-" + e.id });
    }
  }
  // 4. Announcements queued from the app
  for (const o of await db("hk_outbox?sent_at=is.null&select=*&order=id")) {
    await db(`hk_outbox?id=eq.${o.id}`, { method: "PATCH", body: JSON.stringify({ sent_at: new Date().toISOString() }) });
    await push(audience(o.audience), { title: o.title || "HKBP Singapore", body: o.body || "", url: o.url || "#/home", tag: "out-" + o.id });
  }
  return { today, hour, sent, push: pushOn };
}

Deno.serve(async (req) => {
  try {
    const S: Record<string, any> = Object.fromEntries((await db("hk_settings?select=key,value")).map((r: any) => [r.key, r.value]));
    if (!S.cron_key || req.headers.get("x-cron-key") !== S.cron_key) return new Response("forbidden", { status: 403 });
    return Response.json(await run(S));
  }
  catch (e) { console.error(e); return Response.json({ error: (e as Error).message }, { status: 500 }); }
});
