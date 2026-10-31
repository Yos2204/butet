// Sunday School deck reader (YB 2026-10-30): opens a slide deck in the church's shared Drive folder (Google Slides or .pptx)
// and returns each slide's text boxes in order, with the layout name and whether the slide has a picture.
// op "theme": the deck's colour theme and fonts. op "list": the decks in the Sunday School folder (newest first).
// op "image": one picture of one slide (for lyric pictures), as a data URL.
// Used to learn the Sunday School slide format, and by the Sunday School workbench to start from last week's deck.
// Who may call: the database / another function with x-cron-key, or a Sunday School maker's app session (x-token).
import JSZip from "npm:jszip@3.10.1";

const E = Deno.env.toObject();
const BASE = (E.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = E.SUPABASE_SERVICE_ROLE_KEY || "";
const H = { apikey: KEY, authorization: "Bearer " + KEY, "content-type": "application/json" };
const FOLDER = "1unTZJUkk4y_eImP8h62OXdFFDe_G6p25";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type, x-cron-key, x-token", "access-control-allow-methods": "POST, OPTIONS" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "content-type": "application/json" } });
const unent = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));

async function allowed(req: Request) {
  const r = await fetch(`${BASE}/rest/v1/hk_settings?key=eq.cron_key&select=value`, { headers: H }); const [s] = r.ok ? await r.json() : [];
  if (s && req.headers.get("x-cron-key") === s.value) return true;
  const tok = req.headers.get("x-token"); if (!tok) return false;
  const q = await fetch(`${BASE}/rest/v1/rpc/hk_ss_maker`, { method: "POST", headers: H, body: JSON.stringify({ p_token: tok }) });
  return q.ok && (await q.json()) === true;
}

async function zipOf(id: string, google: boolean) {
  const url = google ? `https://docs.google.com/presentation/d/${id}/export/pptx` : `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`;
  const r = await fetch(url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error("download_" + r.status);
  return await JSZip.loadAsync(new Uint8Array(await r.arrayBuffer()));
}
const slideNames = (zip: any) => Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => +a.match(/\d+/)![0] - +b.match(/\d+/)![0]);

async function deck(id: string, google: boolean) {
  const zip = await zipOf(id, google); const out = [];
  for (const n of slideNames(zip)) {
    const xml = await zip.file(n)!.async("string");
    const rels = await (zip.file(n.replace("slides/", "slides/_rels/") + ".rels")?.async("string") || Promise.resolve(""));
    const layout = (rels.match(/slideLayouts\/(slideLayout\d+)\.xml/) || [])[1] || "";
    let layoutName = "";
    if (layout) { const lx = await (zip.file(`ppt/slideLayouts/${layout}.xml`)?.async("string") || Promise.resolve("")); layoutName = (lx.match(/<p:cSld name="([^"]*)"/) || [])[1] || ""; }
    const boxes: string[] = [];
    for (const sp of xml.split(/<p:sp>|<p:sp /).slice(1)) {
      const paras = sp.split(/<a:p>|<a:p /).slice(1).map((p) => unent((p.match(/<a:t>([^<]*)<\/a:t>/g) || []).map((t) => t.replace(/<\/?a:t>/g, "")).join("")).trim());
      const txt = paras.join("\n").replace(/\n{3,}/g, "\n\n").trim(); if (txt) boxes.push(txt);
    }
    out.push({ n: out.length + 1, layout: layoutName, pictures: (xml.match(/<p:pic>/g) || []).length, background: /<p:bg>/.test(xml), boxes });
  }
  return out;
}

async function theme(id: string, google: boolean) {
  const zip = await zipOf(id, google);
  const th = await (zip.file("ppt/theme/theme1.xml")?.async("string") || Promise.resolve(""));
  const colors: Record<string, string> = {};
  for (const k of ["dk1", "lt1", "dk2", "lt2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6"]) { const m = th.match(new RegExp(`<a:${k}>[\\s\\S]*?(?:srgbClr val="([0-9A-Fa-f]{6})"|sysClr[^>]*lastClr="([0-9A-Fa-f]{6})")`)); if (m) colors[k] = "#" + (m[1] || m[2]); }
  const fonts = { major: (th.match(/<a:majorFont>\s*<a:latin typeface="([^"]*)"/) || [])[1] || "", minor: (th.match(/<a:minorFont>\s*<a:latin typeface="([^"]*)"/) || [])[1] || "" };
  // per slide: background fill colour (if solid) and the text colours and fonts actually used
  const slides = [];
  for (const n of slideNames(zip).slice(0, 12)) {
    const xml = await zip.file(n)!.async("string");
    const bg = (xml.match(/<p:bg>[\s\S]*?srgbClr val="([0-9A-Fa-f]{6})"/) || [])[1] || "";
    const bgImg = /<p:bg>[\s\S]*?<a:blip/.test(xml);
    const textColors = [...new Set((xml.match(/<a:rPr[^>]*>[\s\S]*?<a:solidFill><a:srgbClr val="([0-9A-Fa-f]{6})"/g) || []).map((x) => "#" + x.slice(-6)))];
    const faces = [...new Set((xml.match(/<a:latin typeface="([^"]*)"/g) || []).map((x) => x.replace(/.*typeface="|"$/g, "")))];
    const sizes = [...new Set((xml.match(/<a:rPr[^>]* sz="(\d+)"/g) || []).map((x) => +(x.match(/sz="(\d+)"/) || [])[1] / 100))].sort((a, b) => b - a);
    slides.push({ n: slides.length + 1, bg: bg ? "#" + bg : "", bgImage: bgImg, textColors, fonts: faces, sizes });
  }
  const media = Object.keys(zip.files).filter((f) => f.startsWith("ppt/media/")).length;
  return { colors, fonts, slides, media };
}

async function list() {
  const r = await fetch(`https://drive.google.com/embeddedfolderview?id=${FOLDER}`, { headers: { "user-agent": "Mozilla/5.0" } });
  const html = await r.text(); const out = [];
  const re = /<div class="flip-entry" id="entry-([\w-]+)"[\s\S]*?<a href="([^"]+)"[\s\S]*?<div class="flip-entry-title">([\s\S]*?)<\/div>(?:[\s\S]*?<div class="flip-entry-last-modified"><div>([\s\S]*?)<\/div>)?/g;
  let m; while ((m = re.exec(html))) {
    const href = unent(m[2]); const name = unent(m[3]).trim();
    const google = /docs\.google\.com\/presentation/.test(href); if (!google && !/\.pptx$/i.test(name)) continue;
    const lang = /batak/i.test(name) ? "bt" : /indonesia/i.test(name) ? "id" : /english/i.test(name) ? "en" : "";
    out.push({ id: m[1], name, google, lang, modified: unent(m[4] || "").trim() });
  }
  return out;
}

async function image(id: string, google: boolean, slide: number, index: number) {
  const zip = await zipOf(id, google); const n = slideNames(zip)[slide - 1]; if (!n) throw new Error("no_slide");
  const rels = await (zip.file(n.replace("slides/", "slides/_rels/") + ".rels")?.async("string") || Promise.resolve(""));
  const xml = await zip.file(n)!.async("string");
  const ids = [...xml.matchAll(/<p:pic>[\s\S]*?r:embed="([^"]+)"/g)].map((x) => x[1]);
  const rid = ids[index || 0]; if (!rid) throw new Error("no_picture");
  const target = (rels.match(new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`)) || rels.match(new RegExp(`Target="([^"]+)"[^>]*Id="${rid}"`)) || [])[1];
  if (!target) throw new Error("no_target");
  const path = "ppt/" + target.replace(/^\.\.\//, "");
  const f = zip.file(path); if (!f) throw new Error("no_file");
  const b64 = await f.async("base64"); const ext = path.split(".").pop()!.toLowerCase();
  return { dataUrl: `data:image/${ext === "jpg" ? "jpeg" : ext};base64,${b64}`, bytes: Math.round(b64.length * 0.75) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    if (!(await allowed(req))) return json({ error: "not_allowed" }, 403);
    const b = await req.json().catch(() => ({})) as Record<string, unknown>;
    if (b.op === "list") return json({ decks: await list() });
    const id = String(b.id || ""); if (!/^[\w-]{20,}$/.test(id)) return json({ error: "bad_id" }, 400);
    if (b.op === "theme") return json(await theme(id, !!b.google));
    if (b.op === "image") return json(await image(id, !!b.google, Number(b.slide || 1), Number(b.index || 0)));
    return json({ slides: await deck(id, !!b.google) });
  } catch (e) { return json({ error: String((e as Error).message || e) }, 500); }
});
