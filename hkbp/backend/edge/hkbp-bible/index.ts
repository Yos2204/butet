// Bible passages for the Tata Ibadah workbench (YB 2026-10-27): the Epistel row of the service order usually carries only a reference
// ("EPISTEL: MAZMUR 43: 1-5"), so the workbench asks this function for the verses and makes one slide per verse, Liturgis / Jemaat alternating.
//   POST {ref, lang}  -> {ok: true, ref, book, chapter, lang, version, verses: [{c, v, t}]} | {error, detail}
// ref: as written in the file, in Indonesian, English or Batak Toba (book names and the usual abbreviations of all three are understood;
//      "Mazmur 43: 1-5", "Psalm 43:1–5", "Psalmen 43, 1-5", "Yoh 3:16,18", "Mazmur 42:10-43:2", "Mazmur 23" (whole chapter)).
// lang: id -> Terjemahan Baru (tb), en -> English Standard Version (esv), bbc -> Bibel Batak Toba (toba); anything else -> id.
// Source: SABDA's Alkitab passage API (alkitab.sabda.org/api/passage.php), which has no CORS and silently answers with Genesis for a
// book it does not know, so the book is resolved here first and the answer's book id is checked. Results are cached in hk_bible
// (service role only). Callers: the workbench page (anon key as the JWT, no Sada token needed: scripture is public), the watcher's
// headless render of the same page.
const E = Deno.env.toObject();
const BASE = (E.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = E.SUPABASE_SERVICE_ROLE_KEY || "";
const H = { apikey: KEY, authorization: "Bearer " + KEY, "content-type": "application/json" };
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type", "access-control-allow-methods": "POST, GET, OPTIONS" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "content-type": "application/json", "cache-control": "public, max-age=3600" } });
const VERSION: Record<string, string> = { id: "tb", en: "esv", bbc: "toba" };

// [SABDA/TB name, aliases...] in canon order (index + 1 = SABDA book_id). Aliases: Indonesian (TB, older spellings, abbreviations),
// English (names and abbreviations), Batak Toba (Bibel). Matching ignores case, dots, spaces and hyphens; I/II/III become 1/2/3.
const BOOKS: string[][] = [
  ["Kejadian", "kej", "genesis", "gen", "1 musa", "1musa"],
  ["Keluaran", "kel", "exodus", "exod", "ex", "2 musa"],
  ["Imamat", "im", "leviticus", "lev", "3 musa"],
  ["Bilangan", "bil", "numbers", "num", "4 musa"],
  ["Ulangan", "ul", "deuteronomy", "deut", "5 musa"],
  ["Yosua", "yos", "joshua", "josh", "josua"],
  ["Hakim-hakim", "hakim", "hak", "judges", "judg", "panguhum"],
  ["Rut", "ruth"],
  ["1 Samuel", "1sam", "1 sam"],
  ["2 Samuel", "2sam", "2 sam"],
  ["1 Raja-raja", "1 raja", "1raj", "1 raj", "1 kings", "1 kgs", "1 ki", "1 rajaraja"],
  ["2 Raja-raja", "2 raja", "2raj", "2 raj", "2 kings", "2 kgs", "2 ki", "2 rajaraja"],
  ["1 Tawarikh", "1taw", "1 taw", "1 chronicles", "1 chron", "1 chr", "1 kronika", "1 kron"],
  ["2 Tawarikh", "2taw", "2 taw", "2 chronicles", "2 chron", "2 chr", "2 kronika", "2 kron"],
  ["Ezra", "ezr", "esra"],
  ["Nehemia", "neh", "nehemiah"],
  ["Ester", "est", "esther"],
  ["Ayub", "ayb", "job"],
  ["Mazmur", "mzm", "mz", "psalm", "psalms", "ps", "psa", "pss", "psalmen", "psalmn"],
  ["Amsal", "ams", "proverbs", "prov", "pr", "poda"],
  ["Pengkhotbah", "pengkotbah", "pkh", "ecclesiastes", "eccl", "eccles", "ecc", "parjamita"],
  ["Kidung Agung", "kid", "kidung", "song of songs", "song of solomon", "song", "sos", "canticles", "ende ni angka ende", "endeende", "ende sibaran"],
  ["Yesaya", "yes", "isaiah", "isa", "jesaya"],
  ["Yeremia", "yer", "jeremiah", "jer", "jeremia"],
  ["Ratapan", "rat", "lamentations", "lam", "andung-andung", "andungandung", "andung ni si jeremia", "andung"],
  ["Yehezkiel", "yeh", "ezekiel", "ezek", "eze", "hesekiel"],
  ["Daniel", "dan"],
  ["Hosea", "hos"],
  ["Yoel", "yl", "joel"],
  ["Amos", "am"],
  ["Obaja", "ob", "obadiah", "obad"],
  ["Yunus", "yun", "jonah", "jon", "jona"],
  ["Mikha", "mi", "mik", "micah", "mic", "mika"],
  ["Nahum", "nah"],
  ["Habakuk", "hab", "habakkuk"],
  ["Zefanya", "zef", "zephaniah", "zeph", "sepanya"],
  ["Hagai", "hag", "haggai"],
  ["Zakharia", "za", "zak", "zechariah", "zech", "sakaria"],
  ["Maleakhi", "mal", "malachi", "maleaki"],
  ["Matius", "mat", "mt", "matthew", "matt", "mateus"],
  ["Markus", "mrk", "mr", "mk", "mark"],
  ["Lukas", "luk", "lk", "luke"],
  ["Yohanes", "yoh", "john", "jn", "jhn", "johannes", "joh"],
  ["Kisah Para Rasul", "kisah rasul-rasul", "kisah rasul", "kisah", "kis", "acts", "ac", "ulaon ni apostel", "ulaon ni angka apostel", "ulaon"],
  ["Roma", "rm", "rom", "romans", "roms"],
  ["1 Korintus", "1kor", "1 kor", "1 corinthians", "1 cor", "1 korint"],
  ["2 Korintus", "2kor", "2 kor", "2 corinthians", "2 cor", "2 korint"],
  ["Galatia", "gal", "galatians"],
  ["Efesus", "ef", "ephesians", "eph", "epesus"],
  ["Filipi", "flp", "fil", "philippians", "phil", "php", "pilippi", "pilipi"],
  ["Kolose", "kol", "colossians", "col", "kolosse"],
  ["1 Tesalonika", "1tes", "1 tes", "1 thessalonians", "1 thess", "1 thes", "1 th", "1 tessalonik", "1 tessalonika"],
  ["2 Tesalonika", "2tes", "2 tes", "2 thessalonians", "2 thess", "2 thes", "2 th", "2 tessalonik", "2 tessalonika"],
  ["1 Timotius", "1tim", "1 tim", "1 timothy", "1 ti", "1 timoteus"],
  ["2 Timotius", "2tim", "2 tim", "2 timothy", "2 ti", "2 timoteus"],
  ["Titus", "tit"],
  ["Filemon", "flm", "philemon", "phlm", "phm", "pilemon"],
  ["Ibrani", "ibr", "hebrews", "heb", "heber"],
  ["Yakobus", "yak", "james", "jas", "jakobus"],
  ["1 Petrus", "1ptr", "1 ptr", "1 pet", "1 peter", "1 pt"],
  ["2 Petrus", "2ptr", "2 ptr", "2 pet", "2 peter", "2 pt"],
  ["1 Yohanes", "1yoh", "1 yoh", "1 john", "1 jn", "1 johannes", "1 joh"],
  ["2 Yohanes", "2yoh", "2 yoh", "2 john", "2 jn", "2 johannes", "2 joh"],
  ["3 Yohanes", "3yoh", "3 yoh", "3 john", "3 jn", "3 johannes", "3 joh"],
  ["Yudas", "yud", "jude", "judas"],
  ["Wahyu", "why", "wah", "revelation", "revelations", "rev", "re", "pangungkapon", "pangungkapon ni si johannes"],
];
const ONE_CHAPTER = new Set([31, 57, 63, 64, 65]);
const norm = (s: string) => s.toLowerCase().replace(/^\s*(iii|ii|i)\b/, (m) => String(m.trim().length)).replace(/[.\-\s’']/g, "");
const INDEX: Record<string, number> = {};
BOOKS.forEach((names, i) => names.forEach((n) => { INDEX[norm(n)] = i + 1; }));
function findBook(name: string): number {
  const k = norm(name);
  if (!k) return 0;
  if (INDEX[k]) return INDEX[k];
  // a longer form of a known alias ("Thessalonians" typed as "Thessalonian"), or an alias that starts with what was written
  const hits = new Set<number>();
  Object.keys(INDEX).forEach((a) => { if (k.length >= 3 && (a.startsWith(k) || (k.length >= 5 && k.startsWith(a) && a.length >= 4))) hits.add(INDEX[a]); });
  return hits.size === 1 ? [...hits][0] : 0;
}
// "Mazmur 43: 1-5" -> {book: 19, chapter: "43", verses: "1-5"}; "Yudas 17-23" / "Filemon 4-7" -> chapter 1 of a one-chapter book
function parseRef(ref: string) {
  const s = String(ref || "").replace(/[–—]/g, "-").replace(/\s+/g, " ").trim().replace(/^(?:epistel|epistle|evangelium|ev\.?|gospel|injil|bacaan|reading|nas|khotbah|kotbah|jamita|sermon)\s*[:.\-]?\s*/i, "");
  const m = /^((?:[1-3]|I{1,3})\s*\.?\s*)?([A-Za-zÀ-ÿ’'.\- ]+?)\s*\.?\s*(?=\d)([\d\s:.,;\-]+?)\s*[a-c]?$/.exec(s);
  if (!m) return null;
  const book = findBook((m[1] || "") + " " + m[2]);
  if (!book) return null;
  const rest = m[3].replace(/\s+/g, ""), one = ONE_CHAPTER.has(book);
  let x;
  if ((x = /^(\d+)[:.,;](\d+(?:-(?:\d+:)?\d+)?(?:[,;]\d+(?:-\d+)?)*)$/.exec(rest))) return { book, chapter: x[1], verses: x[2] };   // 43:1-5, 42:10-43:2, 3:16,18
  if ((x = /^(\d+)$/.exec(rest))) return one ? { book, chapter: "1", verses: x[1] } : { book, chapter: x[1], verses: "" };          // 23 (whole chapter) / Jude 17
  if ((x = /^(\d+)-(\d+)$/.exec(rest))) return one ? { book, chapter: "1", verses: rest } : { book, chapter: rest, verses: "" };   // Yudas 17-23 / Mazmur 42-43
  return null;
}
const unent = (t: string) => t.replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, "&");
// "(III.) Luluhon ahu" / "(42-11) Seperti" -> the verse text only; stray tags and footnote marks are dropped
const clean = (t: string) => unent(t).replace(/<[^>]+>/g, "").replace(/^\s*(?:\((?:[IVXL]+\.?|\d+-\d+)\)\s*)+/, "").replace(/\s+/g, " ").trim();

async function fromSabda(passage: string, version: string, book: number) {
  const r = await fetch(`https://alkitab.sabda.org/api/passage.php?passage=${encodeURIComponent(passage)}&version=${version}`, { headers: { "user-agent": "Mozilla/5.0 (Sada HKBPS workbench)" } });
  if (!r.ok) throw new Error("sabda_" + r.status);
  const xml = await r.text();
  const verses: { c: number; v: number; t: string }[] = [];
  const bookRe = /<book name="([^"]*)">\s*<book_id>(\d+)<\/book_id>[\s\S]*?<chap>(\d+)<\/chap>\s*<verses>([\s\S]*?)<\/verses>/g;
  let b;
  while ((b = bookRe.exec(xml))) {
    if (+b[2] !== book) throw new Error("book_mismatch");
    const c = +b[3], vre = /<verse>\s*<number>(\d+)<\/number>(?:\s*<title>[\s\S]*?<\/title>)?\s*<text>([\s\S]*?)<\/text>/g;
    let v;
    while ((v = vre.exec(b[4]))) { const t = clean(v[2]); if (t) verses.push({ c, v: +v[1], t }); }
  }
  if (!verses.length) throw new Error(/<error>|not found|tidak ditemukan/i.test(xml) ? "not_found" : "empty");
  // a chapter the book does not have comes back as chapter 1 (SABDA answers "Mazmur 999" with Psalm 1)
  if (verses[0].c !== +String(passage.split(" ").pop()).split(/[:\-]/)[0]) throw new Error("not_found");
  return verses;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const u = new URL(req.url);
    const b = req.method === "GET" ? { ref: u.searchParams.get("ref"), lang: u.searchParams.get("lang") } : await req.json().catch(() => ({}));
    const lang = VERSION[String(b.lang || "")] ? String(b.lang) : "id";
    const version = VERSION[lang];
    const p = parseRef(String(b.ref || ""));
    if (!p) return json({ error: "bad_ref", detail: "The reference was not understood: " + String(b.ref || "") }, 400);
    const name = BOOKS[p.book - 1][0];
    const passage = `${name} ${p.chapter}` + (p.verses ? `:${p.verses}` : "");
    const key = `${version}:${passage}`;
    const hit = await fetch(`${BASE}/rest/v1/hk_bible?key=eq.${encodeURIComponent(key)}&select=value`, { headers: H });
    const rows = hit.ok ? await hit.json() : [];
    if (rows[0] && rows[0].value) return json(rows[0].value);
    const verses = await fromSabda(passage, version, p.book);
    const out = { ok: true, ref: passage.replace(":", ": "), book: name, book_id: p.book, chapter: p.chapter, lang, version, verses, source: "alkitab.sabda.org" };
    await fetch(`${BASE}/rest/v1/hk_bible?on_conflict=key`, { method: "POST", headers: { ...H, prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ key, value: out }) }).catch(() => {});
    return json(out);
  } catch (e) {
    const msg = String((e as Error).message || e);
    return json({ error: msg === "book_mismatch" || msg === "not_found" || msg === "empty" ? "not_found" : "fetch", detail: msg }, msg.startsWith("sabda_") ? 502 : 404);
  }
});
