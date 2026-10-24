// HKBP Singapore notification job. GitHub Actions runs it every 15 minutes (.github/workflows/hkbp-notify.yml).
// It sends phone notifications (Web Push) and, if set up, WhatsApp messages:
//  - 06:00 Singapore time: today's Daily Bread to everyone (drafted by Claude if no elder wrote one)
//  - 08:00: a happy-birthday notification to each member on their birthday (only to that member)
//  - event reminders at each event's reminder time, to the event's group (or the whole church)
//  - announcements a chair or elder posted with "send a notification"
// Every message is logged in hk_sent, so nothing is sent twice even if a run repeats.
//
// Secrets (GitHub > Settings > Secrets and variables > Actions):
//   SUPABASE_URL, SUPABASE_SERVICE_KEY            required (service_role key: keep secret, never in the app)
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY           required for phone notifications
//   ANTHROPIC_API_KEY                             optional: drafts the daily bread when none was written
//   WA_TOKEN, WA_PHONE_ID, WA_TEMPLATE            optional: WhatsApp Cloud API (template with one {{1}} body text)
//   APP_URL                                       optional, default https://yos2204.github.io/butet/hkbp/
import webpush from "web-push";

const E = process.env;
const APP = E.APP_URL || "https://yos2204.github.io/butet/hkbp/";
const BREAD_HOUR = +(E.BREAD_HOUR || 6), BDAY_HOUR = +(E.BDAY_HOUR || 8);
const BREAD_LANG = E.BREAD_LANG || "id";
if (!E.SUPABASE_URL || !E.SUPABASE_SERVICE_KEY) { console.log("Supabase secrets not set yet: nothing to do."); process.exit(0); }
const pushOn = !!(E.VAPID_PUBLIC_KEY && E.VAPID_PRIVATE_KEY);
if (pushOn) webpush.setVapidDetails("mailto:" + (E.VAPID_CONTACT || "admin@hkbp-singapore.org"), E.VAPID_PUBLIC_KEY, E.VAPID_PRIVATE_KEY);

const H = { apikey: E.SUPABASE_SERVICE_KEY, authorization: "Bearer " + E.SUPABASE_SERVICE_KEY, "content-type": "application/json" };
const db = async (path, opt = {}) => {
  const r = await fetch(`${E.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`, { ...opt, headers: { ...H, ...(opt.headers || {}) } });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
};
// Claim a message key; false means it was already sent.
const claim = async (key) => (await db("hk_sent", { method: "POST", headers: { Prefer: "return=representation,resolution=ignore-duplicates" }, body: JSON.stringify({ key }) })).length > 0;

const sg = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(new Date());
const part = (k) => sg.find((p) => p.type === k).value;
const today = `${part("year")}-${part("month")}-${part("day")}`;
const hour = +part("hour") % 24;

const members = await db("hk_members?select=id,name,phone,dob,is_admin,groups,wa_optin");
const subs = await db("hk_push?select=endpoint,member_id,sub");
const audience = (a) => {
  if (a === "all") return members;
  if (a === "elders") return members.filter((m) => m.is_admin || "parhalado" in (m.groups || {}));
  if (a.startsWith("group:")) { const g = a.slice(6); return members.filter((m) => g in (m.groups || {})); }
  if (a.startsWith("member:")) return members.filter((m) => m.id === a.slice(7));
  return [];
};
let sent = 0;
async function push(people, payload) {
  if (!pushOn) return;
  const ids = new Set(people.map((m) => m.id));
  for (const s of subs.filter((x) => ids.has(x.member_id))) {
    try { await webpush.sendNotification(s.sub, JSON.stringify(payload), { TTL: 6 * 3600 }); sent++; }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await db(`hk_push?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: "DELETE" }); else console.warn("push failed", e.statusCode || e.message); }
  }
}
async function whatsapp(people, text) {
  if (!(E.WA_TOKEN && E.WA_PHONE_ID && E.WA_TEMPLATE)) return;
  // Template parameters may not contain new lines, so lines are joined with " · ".
  const param = text.replace(/\s*\n+\s*/g, " · ").replace(/ {4,}/g, " ").slice(0, 1000);
  for (const m of people.filter((x) => x.wa_optin && x.phone)) {
    const r = await fetch(`https://graph.facebook.com/v21.0/${E.WA_PHONE_ID}/messages`, {
      method: "POST", headers: { authorization: "Bearer " + E.WA_TOKEN, "content-type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: "65" + m.phone, type: "template", template: { name: E.WA_TEMPLATE, language: { code: E.WA_LANG || "id" }, components: [{ type: "body", parameters: [{ type: "text", text: param }] }] } }),
    });
    if (!r.ok) console.warn("whatsapp failed", m.phone.slice(-4), r.status, (await r.text()).slice(0, 200));
  }
}
async function draftBread() {
  if (!E.ANTHROPIC_API_KEY) return null;
  const recent = (await db(`hk_bread?select=verse&order=day.desc&limit=30`)).map((b) => b.verse).filter(Boolean);
  const L = { id: "Bahasa Indonesia", bt: "Bahasa Batak Toba", en: "English" }[BREAD_LANG];
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "content-type": "application/json", "x-api-key": E.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-opus-5-5", max_tokens: 1200, messages: [{ role: "user", content:
      `You write the "Daily Bread" (Renungan Harian) for HKBP Singapore, a Batak Lutheran congregation in Singapore. Write it for ${today} in ${L}. Pick one Bible passage fitting the church year; do not reuse: ${recent.join("; ") || "none"}. Reference in ${L} book names. Short warm title. Body 120-170 words: the key verse briefly, one clear thought, one practical step for today, a one-line prayer. Lutheran, Christ-centred, simple words. Reply with JSON only: {"verse":"...","title":"...","body":"..."}` }] }),
  });
  const j = await r.json(); if (!r.ok) { console.warn("Claude failed", j.error && j.error.message); return null; }
  const m = (j.content || []).map((c) => c.text || "").join("").match(/\{[\s\S]*\}/); if (!m) return null;
  const b = { day: today, ...JSON.parse(m[0]), author_name: "Claude (draft)" };
  await db("hk_bread", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify(b) });
  return b;
}

// 1. Daily bread
if (hour >= BREAD_HOUR) {
  let [b] = await db(`hk_bread?day=eq.${today}&select=*`);
  if (!b) b = await draftBread();
  if (b && await claim("bread:" + today)) {
    await push(members, { title: `📖 Renungan Harian: ${b.title || ""}`, body: `${b.verse || ""}\n${(b.body || "").slice(0, 160)}`, url: `#/bread/${today}`, tag: "bread" });
    await whatsapp(members, `${b.title || ""} (${b.verse || ""})\n${b.body || ""}\n${APP}#/bread/${today}`);
  }
}
// 2. Birthdays: only to the member who has the birthday
if (hour >= BDAY_HOUR) {
  for (const m of members.filter((x) => x.dob && x.dob.slice(5) === today.slice(5))) {
    if (await claim(`bday:${today}:${m.id}`)) {
      const first = m.name.replace(/^(Pdt|St|Bapak|Ibu|Kak|Bang|Ev|Dr)\.?\s+/i, "").split(/\s+/)[0];
      await push([m], { title: `Selamat ulang tahun, ${first}! 🎉`, body: "Seluruh keluarga HKBP Singapore bersyukur untukmu. Tuhan memberkati dan melindungimu (Bil 6:24).", url: "#/home", tag: "bday" });
    }
  }
}
// 3. Event reminders
const now = Date.now();
const events = await db(`hk_events?starts_at=gt.${new Date(now).toISOString()}&starts_at=lt.${new Date(now + 8 * 864e5).toISOString()}&select=*`);
for (const e of events.filter((x) => x.remind_min > 0 && new Date(x.starts_at).getTime() - x.remind_min * 60e3 <= now)) {
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
// Housekeeping
await db(`hk_sent?at=lt.${new Date(now - 60 * 864e5).toISOString()}`, { method: "DELETE" });
console.log(`Done ${today} ${hour}:00 SGT. Notifications sent: ${sent}.`);
