// Reads the church's shared Google Drive folder for the Tata Ibadah (YB 2026-10-26, Jarvis "go").
// The folder is shared "anyone with the link · viewer"; its ID is in hk_settings (key tata_drive_folder).
// Only a signed-in Multimedia maker or the admin may use it (hk_wb_access), and only files inside that folder can be downloaded.
//   POST {token}            -> {files: [{id, name, kind, modified}]}
//   POST {token, id}        -> the file itself (.pdf / .docx / Google Doc exported as .docx)
const E = Deno.env.toObject();
const BASE = (E.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = E.SUPABASE_SERVICE_ROLE_KEY || "";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type", "access-control-allow-methods": "POST, OPTIONS", "access-control-expose-headers": "x-name" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "content-type": "application/json" } });
const rpc = async (fn: string, body: unknown) => { const r = await fetch(`${BASE}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: KEY, authorization: "Bearer " + KEY, "content-type": "application/json" }, body: JSON.stringify(body) }); return r.ok ? r.json() : null; };
const unent = (s: string) => s.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));

async function setting(key: string): Promise<unknown> {
  const r = await fetch(`${BASE}/rest/v1/hk_settings?key=eq.${key}&select=value`, { headers: { apikey: KEY, authorization: "Bearer " + KEY } });
  const rows = r.ok ? await r.json() : []; return rows[0] && rows[0].value;
}
async function folderId(): Promise<string> {
  const v = await setting("tata_drive_folder");
  return typeof v === "string" && /^[\w-]{10,}$/.test(v) ? v : "";
}
// Who gets the Tata Ibadah on WhatsApp after Jarvis "go" builds the preview (hk_settings tata_send_to = {name, phone}); YB 2026-10-26: the chairman.
async function sendTo(): Promise<{ name: string; phone: string } | null> {
  const v = (await setting("tata_send_to")) as { name?: unknown; phone?: unknown } | null;
  const phone = v && String(v.phone || "").replace(/\D/g, "");
  return phone ? { name: String(v!.name || ""), phone } : null;
}
const link = (f: { id: string; kind: string }) => f.kind === "gdoc" ? `https://docs.google.com/document/d/${f.id}/view` : `https://drive.google.com/file/d/${f.id}/view`;
async function list(folder: string) {
  const r = await fetch(`https://drive.google.com/embeddedfolderview?id=${folder}`, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error("drive_" + r.status);
  const html = await r.text(); const out: { id: string; name: string; kind: string; modified: string }[] = [];
  const re = /<div class="flip-entry" id="entry-([\w-]+)"[\s\S]*?<a href="([^"]+)"[\s\S]*?<div class="flip-entry-title">([\s\S]*?)<\/div>[\s\S]*?<div class="flip-entry-last-modified"><div>([\s\S]*?)<\/div>/g;
  let m; while ((m = re.exec(html))) {
    const href = unent(m[2]); const kind = /docs\.google\.com\/document/.test(href) ? "gdoc" : /\/folders\//.test(href) ? "folder" : "file";
    if (kind !== "folder") out.push({ id: m[1], name: unent(m[3]).trim(), kind, modified: unent(m[4]).trim() });
  }
  return out;
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const b = await req.json().catch(() => ({}));
    if (!(await rpc("hk_wb_access", { p_token: String(b.token || "") }))) return json({ error: "not_allowed" }, 403);
    const folder = await folderId(); if (!folder) return json({ error: "no_folder" }, 404);
    const files = await list(folder);
    if (!b.id) return json({ files: files.map((f) => ({ ...f, link: link(f) })), send_to: await sendTo() });
    const f = files.find((x) => x.id === b.id); if (!f) return json({ error: "not_in_folder" }, 404);
    const url = f.kind === "gdoc" ? `https://docs.google.com/document/d/${f.id}/export?format=docx` : `https://drive.usercontent.google.com/download?id=${f.id}&export=download&confirm=t`;
    const r = await fetch(url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0" } });
    if (!r.ok) return json({ error: "download_" + r.status }, 502);
    const name = f.kind === "gdoc" ? f.name + ".docx" : f.name;
    return new Response(r.body, { headers: { ...CORS, "content-type": r.headers.get("content-type") || "application/octet-stream", "x-name": encodeURIComponent(name) } });
  } catch (e) { console.error(e); return json({ error: String((e as Error).message || e) }, 500); }
});
