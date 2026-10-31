// HKBP Singapore notification job, as a Supabase Edge Function.
// The database calls it every 15 minutes (pg_cron + pg_net), and also right away whenever a notification is queued in hk_outbox.
// It sends phone notifications (Web Push):
//  - daily bread at the hour the admin chose in the setup pop-up (default 06:00 Singapore time). When no elder wrote one, the
//    verse of the day is used (YB 2026-10-30, free, no AI): a well-known passage with a short prayer, read from SABDA in all three
//    languages (YB 2026-10-31: Indonesian TB, Batak Toba, English ESV, stored in hk_bread.langs; the app shows the reader's pick);
//    the members picked as WhatsApp senders also get a "tap to post it in the WhatsApp group" notification
//  - 08:00: birthday and wedding-anniversary wishes to the member, a "today in your category" notice to the rest of the category,
//    and to each category leader a "tap to send the wishes to the WhatsApp group" notification
//  - event reminders at each event's reminder time, to the event's category (or the whole church);
//    once anyone has answered the RSVP, only those Going or Maybe are reminded (YB 2026-10-29)
//  - announcements queued from the app ("notify members now", roster duties to the people named) and by the Tata Ibadah watcher
//  - one hour after a member's phone first turns on notifications: their upcoming roster duties, once
//  - 19:00: one push to each birthday person with the wishes members wrote in the app that day (YB 2026-10-29)
//  - duty reminders written for the lock screen (YB 2026-10-30): Saturday 19:00 "Serving tomorrow · <jobs>",
//    Sunday 06:00-10:00 "Serving today · <jobs>", one per member and section, from every roster
//  - Saturday 18:00 weekly digest (YB 2026-10-30): tomorrow's Sunday and preacher, and this week's birthdays
// All texts are in English (YB 2026-10-31), the birthday and anniversary wishes too.
// Every message is logged in hk_sent (or marked sent in hk_outbox), so nothing is sent twice even if two runs overlap.
//
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY are provided by Supabase. Everything else lives in the locked
// hk_settings table: the push keys are created by this job on its first run (the app reads only the public one), and cron_key is
// created by the database. Nothing here uses a paid service.
import webpush from "npm:web-push@3.6.7";

const E = Deno.env.toObject();
const BASE = (E.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = E.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON = E.SUPABASE_ANON_KEY || "";
const H = { apikey: KEY, authorization: "Bearer " + KEY, "content-type": "application/json" };
const BDAY_HOUR = 8;
const WISH_HOUR = 19;
const DIGEST_HOUR = 18;
// Birthday and anniversary wishes (the church's wording, in English since YB 2026-10-31): a short title, and the full wish in the body,
// because iPhone cuts long titles short on the lock screen but shows several lines of body text.
const BDAY_TITLE = "🎂 Happy Birthday!";
const ANNIV_TITLE = "💍 Happy Wedding Anniversary!";
const bdayBody = (name: string) => `The Church Council and Congregation of HKBP Singapore wish ${name} a happy birthday. May you always live in faith, love and hope. God bless you.`;
const annivBody = (name: string) => `The Church Council and Congregation of HKBP Singapore wish ${name} a happy wedding anniversary. May you always live in faith, love and hope. God bless you.`;

// Verse of the day: well-known passages (TB book names); never the same within 120 days.
const VERSES = ["Mazmur 23:1-4", "Yohanes 3:16-17", "Roma 8:28", "Filipi 4:6-7", "Yesaya 41:10", "Amsal 3:5-6", "Matius 11:28-30", "Yeremia 29:11", "Mazmur 46:2-4", "2 Korintus 5:17",
  "Galatia 2:20", "Efesus 2:8-10", "Mazmur 121:1-8", "Yesaya 40:29-31", "Matius 6:33-34", "1 Korintus 13:4-7", "Roma 12:1-2", "Mazmur 27:1", "Yosua 1:9", "Filipi 4:13",
  "Mazmur 91:1-2", "1 Petrus 5:7", "Ibrani 11:1", "Yohanes 14:1-3", "Yohanes 14:27", "Roma 5:8", "Mazmur 37:5", "Ratapan 3:22-23", "Mikha 6:8", "Matius 5:14-16",
  "Kolose 3:23", "1 Tesalonika 5:16-18", "Mazmur 139:13-14", "Yakobus 1:5", "Yesaya 26:3", "Mazmur 34:9", "Mazmur 51:12", "1 Yohanes 1:9", "Roma 15:13", "2 Timotius 1:7",
  "Mazmur 19:15", "Yohanes 15:5", "Yohanes 8:12", "Matius 28:19-20", "Lukas 6:31", "Galatia 5:22-23", "Efesus 4:32", "Kolose 3:12-14", "1 Korintus 10:13", "Roma 10:9",
  "Mazmur 103:1-5", "Mazmur 118:24", "Mazmur 16:8", "Mazmur 62:2-3", "Mazmur 32:8", "Amsal 16:3", "Amsal 18:10", "Pengkhotbah 3:1", "Yesaya 43:1-2", "Yesaya 55:8-9",
  "Yeremia 17:7-8", "Habakuk 3:17-18", "Zefanya 3:17", "Matius 7:7-8", "Matius 22:37-39", "Markus 10:45", "Lukas 1:37", "Lukas 12:22-24", "Yohanes 10:10-11", "Yohanes 11:25-26",
  "Yohanes 13:34-35", "Yohanes 16:33", "Kisah Para Rasul 1:8", "Roma 8:38-39", "Roma 12:12", "Roma 12:21", "1 Korintus 15:58", "2 Korintus 4:16-18", "2 Korintus 12:9", "Galatia 6:9",
  "Efesus 3:20-21", "Efesus 6:10-11", "Filipi 1:6", "Filipi 2:3-5", "Filipi 4:4-5", "Filipi 4:19", "Kolose 3:2", "1 Tesalonika 4:13-14", "2 Tesalonika 3:3", "1 Timotius 4:12",
  "2 Timotius 3:16-17", "Titus 3:4-5", "Ibrani 4:15-16", "Ibrani 12:1-2", "Ibrani 13:5-6", "Ibrani 13:8", "Yakobus 1:2-4", "Yakobus 4:8", "1 Petrus 2:9", "1 Petrus 3:15",
  "2 Petrus 3:9", "1 Yohanes 3:1", "1 Yohanes 4:7-8", "1 Yohanes 4:18-19", "Wahyu 3:20", "Wahyu 21:3-4", "Kejadian 1:27", "Kejadian 28:15", "Keluaran 14:14", "Bilangan 6:24-26",
  "Ulangan 31:6", "Ulangan 31:8", "1 Samuel 16:7", "2 Tawarikh 7:14", "Nehemia 8:11", "Ayub 19:25", "Mazmur 4:9", "Mazmur 18:2-3", "Mazmur 25:4-5", "Mazmur 30:6",
  "Mazmur 40:2-4", "Mazmur 42:2-3", "Mazmur 55:23", "Mazmur 63:2", "Mazmur 84:11", "Mazmur 90:12", "Mazmur 100:1-5", "Mazmur 119:105", "Mazmur 127:1", "Mazmur 145:18",
  "Mazmur 147:3", "Amsal 4:23", "Amsal 22:6", "Yesaya 9:5", "Yesaya 12:2", "Yesaya 30:15", "Yesaya 53:5", "Yesaya 58:11", "Yehezkiel 36:26", "Hosea 6:3",
  "Matius 5:3-9", "Matius 6:9-13", "Matius 18:20", "Lukas 2:10-11", "Lukas 15:7", "Yohanes 1:14", "Yohanes 4:24", "Yohanes 6:35", "Roma 3:23-24", "Roma 6:23"];
const PRAYER: Record<string, string> = {
  id: "Doa: Tuhan, terima kasih untuk firman-Mu hari ini. Tolonglah kami hidup menurut firman-Mu dan menjadi berkat bagi sesama. Amin.",
  bt: "Tangiang: Ale Tuhan, mauliate di hata-Mu sadarion. Urupi ma hami mangolu hombar tu hata-Mu jala gabe pasupasu di dongan. Amen.",
  en: "Prayer: Lord, thank you for your word today. Help us to live by it and to be a blessing to others. Amen.",
};

// ---- roster reading: the same rules as the app (app.js: norm, myNames, hit, rowDate) ----
const normN = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
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
const dayLabel = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Singapore", weekday: "long", day: "numeric", month: "short" }).format(new Date(iso + "T12:00:00+08:00"));

async function db(path: string, opt: RequestInit = {}) {
  const r = await fetch(`${BASE}/rest/v1/${path}`, { ...opt, headers: { ...H, ...(opt.headers || {}) } });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
// Claim a message key; false means it was already sent.
const claim = async (key: string) =>
  (await db("hk_sent", { method: "POST", headers: { Prefer: "return=representation,resolution=ignore-duplicates" }, body: JSON.stringify({ key }) })).length > 0;

// The verse of the day in all three languages, read from SABDA's passage API (the same source as hkbp-bible). SABDA understands
// the TB book names in every version and answers with the reference in that version's own words ("John 3:16-17").
const SABDA: Record<string, string> = { id: "tb", bt: "toba", en: "esv" };
const BREAD_TITLE: Record<string, string> = { id: "Ayat Harian", bt: "Ayat Siganup Ari", en: "Verse of the Day" };
const unent = (t: string) => t.replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, "&");
const clean = (t: string) => unent(t).replace(/<[^>]+>/g, "").replace(/^\s*(?:\((?:[IVXL]+\.?|\d+-\d+)\)\s*)+/, "").replace(/\s+/g, " ").trim();
async function sabda(ref: string, l: string) {
  const r = await fetch(`https://alkitab.sabda.org/api/passage.php?passage=${encodeURIComponent(ref)}&version=${SABDA[l]}`, { headers: { "user-agent": "Mozilla/5.0 (Sada HKBPS)" } });
  if (!r.ok) throw new Error("sabda " + r.status);
  const xml = await r.text();
  const out: string[] = []; const vre = /<verse>\s*<number>(\d+)<\/number>(?:\s*<title>[\s\S]*?<\/title>)?\s*<text>([\s\S]*?)<\/text>/g;
  let v; while ((v = vre.exec(xml))) { const t = clean(v[2]); if (t) out.push(`${v[1]} ${t}`); }
  if (!out.length) throw new Error("sabda empty " + l);
  const title = clean((xml.match(/<bible>\s*<title>([\s\S]*?)<\/title>/) || [])[1] || "");
  return { verse: title || ref, title: BREAD_TITLE[l], body: `${out.join(" ")}\n\n${PRAYER[l]}` };
}
async function verseLangs(ref: string, only = Object.keys(SABDA)) {
  const langs: Record<string, any> = {};
  await Promise.all(only.map(async (l) => {
    for (let i = 0; i < 2 && !langs[l]; i++) { try { langs[l] = await sabda(ref, l); } catch (e) { console.warn("verse", l, (e as Error).message); } }
  }));
  return langs;
}
async function verseBread(day: string, lang: string) {
  const recent = new Set((await db(`hk_bread?select=verse&day=gte.${new Date(Date.parse(day) - 120 * 864e5).toISOString().slice(0, 10)}`)).map((b: any) => b.verse));
  const idx = Math.floor(Date.parse(day + "T00:00:00Z") / 864e5);
  let ref = VERSES[idx % VERSES.length];
  for (let i = 1; recent.has(ref) && i < VERSES.length; i++) ref = VERSES[(idx + i * 7) % VERSES.length];
  const langs = await verseLangs(ref);
  const main = langs[lang] || langs.id || langs.en || langs.bt;
  if (!main) throw new Error("bible unavailable");
  // verse keeps the TB reference, so the 120-day check above keeps working whatever the main language is
  const b = { day, verse: ref, title: main.title, body: main.body, langs, author_name: "Ayat Harian" };
  await db("hk_bread", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify(b) });
  return b;
}

async function run(S: Record<string, any>) {
  const sg = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(new Date());
  const part = (k: string) => sg.find((p) => p.type === k)!.value;
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  const hour = +part("hour") % 24;
  const addDays = (iso: string, n: number) => new Date(Date.parse(iso + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
  const weekday = new Date(today + "T12:00:00Z").getUTCDay();   // 0 = Sunday, 6 = Saturday

  const source = S.bread_source || "elders";            // verse | elders (older claude_* settings count as verse)
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
  const subs = await db("hk_push?select=endpoint,member_id,sub,created_at&revoked=is.false");
  const audience = (a: string) => {
    if (a === "all") return members;
    if (a === "elders") return members.filter((m: any) => m.is_admin || "parhalado" in (m.groups || {}));
    if (a.startsWith("group:")) { const g = a.slice(6); return members.filter((m: any) => g in (m.groups || {})); }
    // the Makers of a category only (e.g. makers:multimedia = the Multimedia makers and chair, plus the admin), used by the Tata Ibadah watcher
    if (a.startsWith("makers:")) { const g = a.slice(7); return members.filter((m: any) => m.is_admin || ["maker", "chair", "tmaker", "ychair", "ytreasurer", "ysecretary"].includes((m.groups || {})[g])); }
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

  // 1. Daily bread: an elder's devotion if there is one, otherwise the verse of the day (free) an hour before sending.
  if (source !== "elders" && hour >= breadHour - 1) {
    const [have] = await db(`hk_bread?day=eq.${today}&select=day`);
    if (!have) { try { await verseBread(today, breadLang); } catch (e) { console.warn("verse of the day failed", (e as Error).message); } }
  }
  if (hour >= breadHour) {
    const [b] = await db(`hk_bread?day=eq.${today}&removed_at=is.null&select=*`);
    // a verse of the day made before the three languages, or with one that SABDA did not answer: fill in what is missing
    const miss = b && b.author_name === "Ayat Harian" && b.verse ? Object.keys(SABDA).filter((l) => !(b.langs || {})[l]) : [];
    if (miss.length) {
      try { const got = await verseLangs(b.verse, miss); if (Object.keys(got).length) { b.langs = { ...(b.langs || {}), ...got }; await db(`hk_bread?day=eq.${today}`, { method: "PATCH", body: JSON.stringify({ langs: b.langs }) }); } }
      catch (e) { console.warn("verse langs", (e as Error).message); }
    }
    if (b && await claim("bread:" + today)) {
      const pb = (b.author_name === "Ayat Harian" && b.langs && b.langs.en) || b;   // the push is in English
      await push(members, { title: `📖 ${pb.title || "Daily Bread"} · ${pb.verse || ""}`, body: (pb.body || "").slice(0, 220), url: `#/bread/${today}`, tag: "bread" });
      const who = members.filter((m: any) => senders.includes(m.id));
      await push(who, { title: "📲 Share the devotion in the WhatsApp group", body: `${pb.title || ""}: tap to share it in the "Daily Bread" group.`, url: `#/bread/${today}?wa=1`, tag: "bread-wa" });
    }
  }
  // 2. Birthdays and wedding anniversaries (08:00 to 21:00 only, so a late run never wakes anyone)
  if (hour >= BDAY_HOUR && hour < 21) {
    const md = today.slice(5);
    const isB = (m: any) => m.dob && m.dob.slice(5) === md, isA = (m: any) => m.wed && m.wed.slice(5) === md;
    // The Secretary's birthday list comes first: the wish uses the name written on that list.
    const norm = (n: string) => (n || "").toLowerCase().replace(/^(pdt|st|sintua|bapak|bpk|ibu|kak|bang|ev|dr|kel)\.?\s+/, "").replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
    const list = (await db("hk_birthdays?select=name,dob&removed_at=is.null")).filter((x: any) => x.dob && x.dob.slice(5) === md);
    for (const e of list) {
      const n = norm(e.name);
      const m = members.find((x: any) => norm(x.name) === n || (x.alias || "").split(",").some((a: string) => norm(a) === n));
      if (m && await claim(`bday:${today}:${m.id}`))
        await push([m], { title: BDAY_TITLE, body: bdayBody(e.name.trim()), url: "#/home", tag: "bday" });
    }
    for (const m of members.filter(isB)) {
      if (await claim(`bday:${today}:${m.id}`))
        await push([m], { title: BDAY_TITLE, body: bdayBody(m.name.trim()), url: "#/home", tag: "bday" });
    }
    for (const m of members.filter(isA)) {
      if (await claim(`anniv:${today}:${m.id}`))
        await push([m], { title: ANNIV_TITLE, body: annivBody(m.name.trim()), url: "#/home", tag: "anniv" });
    }
    // Each category: the other members get one notice, the leaders get the ready-made wishes for the WhatsApp group.
    const cats = await db("hk_groups?kind=eq.sermon&removed_at=is.null&select=id,name_id,name_en");
    for (const g of cats) {
      const inG = members.filter((m: any) => g.id in (m.groups || {})); const gn = g.name_en || g.name_id;
      const b = inG.filter(isB), a = inG.filter(isA);
      if (!b.length && !a.length) continue;
      if (!(await claim(`cat:${today}:${g.id}`))) continue;
      const who = new Set([...b, ...a].map((m: any) => m.id));
      const body = [b.length ? `🎂 Birthday: ${b.map((m: any) => m.name).join(", ")}` : "", a.length ? `💍 Wedding anniversary: ${a.map((m: any) => m.name).join(", ")}` : ""].filter(Boolean).join("\n");
      const leaders = inG.filter((m: any) => ["chair", "tmaker", "ychair", "ytreasurer", "ysecretary"].includes(m.groups[g.id]));
      const lead = new Set(leaders.map((m: any) => m.id));
      await push(inG.filter((m: any) => !who.has(m.id) && !lead.has(m.id)), { title: `Today in ${gn} 🎉`, body: body + "\nWish them well and pray for them!", url: `#/g/${g.id}?wish=${today}`, tag: "cat-" + g.id });
      await push(leaders, { title: `📲 Send the wishes to the ${gn} WhatsApp group`, body: body + "\nTap: the wishes are ready, just paste and send.", url: `#/g/${g.id}?wish=${today}`, tag: "catwa-" + g.id });
    }
  }
  // 3. Event reminders, written for the lock screen: the time first in the title (YB 2026-10-30).
  //    Once anyone has answered the RSVP, only those Going or Maybe are reminded.
  const now = Date.now();
  const events = await db(`hk_events?starts_at=gt.${new Date(now).toISOString()}&starts_at=lt.${new Date(now + 8 * 864e5).toISOString()}&removed_at=is.null&select=*`);
  for (const e of events.filter((x: any) => x.remind_min > 0 && new Date(x.starts_at).getTime() - x.remind_min * 60e3 <= now)) {
    if (await claim(`event:${e.id}:${e.remind_min}:${e.starts_at}`)) {
      const t0 = new Date(e.starts_at);
      const hm = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Singapore", hour: "2-digit", minute: "2-digit" }).format(t0);
      const end = e.ends_at ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Singapore", hour: "2-digit", minute: "2-digit" }).format(new Date(e.ends_at)) : "";
      const day = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Singapore", weekday: "long", day: "numeric", month: "long" }).format(t0);
      const rs = (await db(`hk_rsvp?select=member_id,status&event_id=eq.${e.id}`)) || [];
      const coming = new Set(rs.filter((r: any) => r.status === "going" || r.status === "maybe").map((r: any) => r.member_id));
      const base = audience(e.group_id ? "group:" + e.group_id : "all");
      const who = rs.length ? base.filter((m: any) => coming.has(m.id)) : base;
      const going = rs.filter((r: any) => r.status === "going").length;
      await push(who, { title: `🗓 ${hm}${end ? "–" + end : ""} · ${e.title}`, body: `${day}${e.place ? "\n📍 " + e.place : ""}${going ? `\n✓ ${going} going` : ""}`, url: "#/calendar", tag: "ev-" + e.id });
    }
  }
  // 4. Announcements queued from the app. Each row is claimed by marking it sent only if nobody else has,
  //    so a run started by a new notification and the 15-minute run never send the same one twice.
  for (const o of await db("hk_outbox?sent_at=is.null&select=*&order=id")) {
    const got = await db(`hk_outbox?id=eq.${o.id}&sent_at=is.null`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ sent_at: new Date().toISOString() }) });
    if (!got || !got.length) continue;
    await push(audience(o.audience), { title: o.title || "HKBP Singapore", body: o.body || "", url: o.url || "#/home", tag: "out-" + o.id });
  }
  // 5. Roster duties for people who turned on notifications (YB 2026-10-28): one hour after a member's phone first signs up,
  //    they get one message with their upcoming duties in every section's roster (sent once per member, 08:00 to 21:00).
  const gname = Object.fromEntries((await db("hk_groups?select=id,name_id,name_en")).map((g: any) => [g.id, g.name_en || g.name_id]));
  if (pushOn && hour >= BDAY_HOUR && hour < 21) {
    const first: Record<string, string> = {};
    for (const s of subs) if (!first[s.member_id] || s.created_at < first[s.member_id]) first[s.member_id] = s.created_at;
    const ready = Object.keys(first).filter((id) => Date.parse(first[id]) <= now - 3600e3);
    if (ready.length) {
      const done = new Set((await db(`hk_sent?select=key&key=like.dutyintro:*`)).map((r: any) => r.key));
      const todo = ready.filter((id) => !done.has("dutyintro:" + id));
      if (todo.length) {
        const rosters = await db(`hk_rosters?select=group_id,month,table_json&removed_at=is.null&month=gte.${today.slice(0, 7)}`);
        for (const id of todo) {
          const p = members.find((m: any) => m.id === id); if (!p) continue;
          if (!(await claim("dutyintro:" + id))) continue;
          const names = namesOf(p, members); const lines: [string, string][] = [];
          for (const r of rosters) for (const tb of r.table_json || []) {
            const rows: string[][] = tb.rows || []; const hi = Math.max(0, rows.findIndex((x) => x.filter(Boolean).length >= 2)); const head = rows[hi] || [];
            rows.forEach((row, i) => {
              if (i <= hi) return; const iso = rowDate(row, r.month); if (!iso || iso < today) return;
              const jobs = row.map((c, j) => (hitN(c, names) && head[j] && head[j] !== c ? head[j] : null)).filter(Boolean);
              if (jobs.length) lines.push([iso, `${dayLabel(iso)} · ${gname[r.group_id] || r.group_id} · ${jobs.join(", ")}`]);
            });
          }
          if (!lines.length) continue;
          lines.sort((a, b) => a[0].localeCompare(b[0]));
          await push([p], { title: "📅 Your service roster", body: "You're serving:\n" + lines.slice(0, 8).map((x) => x[1]).join("\n"), url: "#/serve", tag: "duties" });
        }
      }
    }
  }
  // 6. Birthday wishes written in the app (YB 2026-10-29): at 19:00, one push to each birthday person with that day's wishes.
  if (pushOn && hour >= WISH_HOUR && hour < 21) {
    const ws = (await db(`hk_wishes?select=to_member,from_name,body&day=eq.${today}&order=id`)) || [];
    const by: Record<string, any[]> = {};
    for (const w of ws) (by[w.to_member] = by[w.to_member] || []).push(w);
    for (const [id, list] of Object.entries(by)) {
      const p = members.find((m: any) => m.id === id); if (!p) continue;
      if (!(await claim(`wishes:${today}:${id}`))) continue;
      const first = list.slice(0, 3).map((w: any) => `${w.from_name}: "${String(w.body).slice(0, 60)}"`).join("\n");
      await push([p], { title: `🎂 ${list.length} birthday ${list.length === 1 ? "wish" : "wishes"} for you`, body: first + (list.length > 3 ? `\n+${list.length - 3} more · tap to read them all` : ""), url: "#/home", tag: "wishes" });
    }
  }
  // 7. Duty reminders for the lock screen (YB 2026-10-30): Saturday 19:00-21:00 for tomorrow, Sunday 06:00-10:00 for today.
  //    The jobs come first in the title, like a ticket: "📅 Serving today · Slides". One push per member and section.
  const dutyDay = weekday === 6 && hour >= 19 && hour < 21 ? addDays(today, 1) : weekday === 0 && hour >= 6 && hour < 10 ? today : null;
  if (pushOn && dutyDay) {
    const when = dutyDay === today ? "today" : "tomorrow";
    const rosters = await db(`hk_rosters?select=group_id,month,table_json&removed_at=is.null&month=eq.${dutyDay.slice(0, 7)}`);
    const withPush = new Set(subs.map((s: any) => s.member_id));
    for (const p of members.filter((m: any) => withPush.has(m.id))) {
      const names = namesOf(p, members); const by: Record<string, string[]> = {};
      for (const r of rosters) for (const tb of r.table_json || []) {
        const rows: string[][] = tb.rows || []; const hi = Math.max(0, rows.findIndex((x) => x.filter(Boolean).length >= 2)); const head = rows[hi] || [];
        rows.forEach((row, i) => {
          if (i <= hi || rowDate(row, r.month) !== dutyDay) return;
          const jobs = row.map((c, j) => (j && hitN(c, names) && head[j] && head[j] !== c ? head[j] : null)).filter(Boolean) as string[];
          if (jobs.length) by[r.group_id] = [...new Set([...(by[r.group_id] || []), ...jobs])];
        });
      }
      for (const [gid, jobs] of Object.entries(by)) {
        if (!(await claim(`duty:${dutyDay}:${when}:${gid}:${p.id}`))) continue;
        await push([p], { title: `📅 ${when === "today" ? "Serving today" : "Serving tomorrow"} · ${jobs.join(", ")}`,
          body: `${gname[gid] || gid} · ${dayLabel(dutyDay)}\nThe roster and the Tata Ibadah are in Sada. God bless your service.`, url: "#/home", tag: `duty-${gid}` });
      }
    }
  }
  // 8. Saturday digest (YB 2026-10-30), 18:00-19:00: tomorrow's Sunday and preacher, and the birthdays of the coming week.
  if (pushOn && weekday === 6 && hour >= DIGEST_HOUR && hour < 19 && await claim("digest:" + today)) {
    const sun = addDays(today, 1);
    const [lit] = (await db(`hk_liturgy?day=eq.${sun}&removed_at=is.null&select=name,preacher,topic&order=updated_at.desc&limit=1`)) || [];
    const week = new Set(Array.from({ length: 7 }, (_, i) => addDays(today, i + 1).slice(5)));
    const bdays = [...new Set([...members.filter((m: any) => m.dob && week.has(m.dob.slice(5))).map((m: any) => m.name),
      ...((await db("hk_birthdays?select=name,dob&removed_at=is.null")) || []).filter((x: any) => x.dob && week.has(x.dob.slice(5))).map((x: any) => x.name)])];
    const lines = [lit && lit.preacher ? `🎤 ${lit.preacher}` : "", lit && lit.topic ? `“${lit.topic}”` : "",
      bdays.length ? `🎂 Birthdays this week: ${bdays.slice(0, 6).join(", ")}${bdays.length > 6 ? ` +${bdays.length - 6}` : ""}` : "",
      "The Tata Ibadah, hymns and readings are in Sada → This Sunday."].filter(Boolean);
    await push(members, { title: `🗓 Tomorrow: ${lit ? ((n) => (/^minggu/i.test(n) ? n : "Sunday " + n))(lit.name.split(" · ")[0]) : "Sunday service"}`, body: lines.join("\n"), url: "#/sunday", tag: "digest" });
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
