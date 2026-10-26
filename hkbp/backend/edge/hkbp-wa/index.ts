// Sends the Tata Ibadah file to the chairman on WhatsApp with no tap (YB 2026-10-26), through Meta's WhatsApp Business (Cloud) API.
//   POST {token, id, sunday}  -> {ok: true, to} | {error}
// token: the maker's Sada sign-in (hk_wb_access decides); id: the file in the church Drive folder (same rule as hkbp-drive: only files in that folder).
// Secrets (Supabase > Edge Functions > Secrets, set by YB, never in the app): WA_TOKEN (permanent system-user token), WA_PHONE_ID (the church number's phone-number ID),
// WA_TEMPLATE (default "tata_ibadah": header DOCUMENT, body "{{1}}" = Sunday, "{{2}}" = file name), WA_LANG (default "id").
// Recipient: hk_settings tata_send_to = {name, phone}. Each file is sent once per day (hk_sent), so a repeated "go" does not spam.
const E = Deno.env.toObject();
const BASE = (E.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = E.SUPABASE_SERVICE_ROLE_KEY || "";
const GRAPH = "https://graph.facebook.com/v21.0";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type", "access-control-allow-methods": "POST, OPTIONS" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "content-type": "application/json" } });
const H = { apikey: KEY, authorization: "Bearer " + KEY, "content-type": "application/json" };
const rpc = async (fn: string, body: unknown) => { const r = await fetch(`${BASE}/rest/v1/rpc/${fn}`, { method: "POST", headers: H, body: JSON.stringify(body) }); return r.ok ? r.json() : null; };
const unent = (s: string) => s.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));

async function setting(key: string): Promise<unknown> {
  const r = await fetch(`${BASE}/rest/v1/hk_settings?key=eq.${key}&select=value`, { headers: H });
  const rows = r.ok ? await r.json() : []; return rows[0] && rows[0].value;
}
async function list(folder: string) {
  const r = await fetch(`https://drive.google.com/embeddedfolderview?id=${folder}`, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error("drive_" + r.status);
  const html = await r.text(); const out: { id: string; name: string; kind: string }[] = [];
  const re = /<div class="flip-entry" id="entry-([\w-]+)"[\s\S]*?<a href="([^"]+)"[\s\S]*?<div class="flip-entry-title">([\s\S]*?)<\/div>/g;
  let m; while ((m = re.exec(html))) {
    const href = unent(m[2]); const kind = /docs\.google\.com\/document/.test(href) ? "gdoc" : /\/folders\//.test(href) ? "folder" : "file";
    if (kind !== "folder") out.push({ id: m[1], name: unent(m[3]).trim(), kind });
  }
  return out;
}
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const mime = (name: string) => /\.pdf$/i.test(name) ? "application/pdf" : /\.doc$/i.test(name) ? "application/msword" : DOCX;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const b = await req.json().catch(() => ({}));
    if (!(await rpc("hk_wb_access", { p_token: String(b.token || "") }))) return json({ error: "not_allowed" }, 403);
    if (!E.WA_TOKEN || !E.WA_PHONE_ID) return json({ error: "not_configured" }, 503);
    const to = (await setting("tata_send_to")) as { name?: string; phone?: string } | null;
    const phone = to && String(to.phone || "").replace(/\D/g, "");
    if (!phone) return json({ error: "no_recipient" }, 404);
    const wa = phone.length === 8 ? "65" + phone : phone;
    const folder = await setting("tata_drive_folder");
    if (typeof folder !== "string" || !/^[\w-]{10,}$/.test(folder)) return json({ error: "no_folder" }, 404);
    const f = (await list(folder)).find((x) => x.id === String(b.id || ""));
    if (!f) return json({ error: "not_in_folder" }, 404);
    const name = f.kind === "gdoc" ? f.name + ".docx" : f.name;
    // once a day per file and recipient
    const sentKey = `wa:${wa}:${f.id}:${new Date().toISOString().slice(0, 10)}`;
    const dup = await fetch(`${BASE}/rest/v1/hk_sent?key=eq.${encodeURIComponent(sentKey)}&select=key`, { headers: H });
    if (dup.ok && (await dup.json()).length) return json({ ok: true, to: to!.name || wa, already: true });
    // 1. the file from Drive
    const url = f.kind === "gdoc" ? `https://docs.google.com/document/d/${f.id}/export?format=docx` : `https://drive.usercontent.google.com/download?id=${f.id}&export=download&confirm=t`;
    const d = await fetch(url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0" } });
    if (!d.ok) return json({ error: "download_" + d.status }, 502);
    const blob = new Blob([await d.arrayBuffer()], { type: mime(name) });
    // 2. upload it to WhatsApp
    const fd = new FormData(); fd.append("messaging_product", "whatsapp"); fd.append("type", blob.type); fd.append("file", blob, name);
    const up = await fetch(`${GRAPH}/${E.WA_PHONE_ID}/media`, { method: "POST", headers: { authorization: "Bearer " + E.WA_TOKEN }, body: fd });
    const upj = await up.json().catch(() => ({}));
    if (!up.ok || !upj.id) return json({ error: "wa_upload", detail: upj.error && upj.error.message }, 502);
    // 3. the approved template with the document as its header
    const msg = {
      messaging_product: "whatsapp", to: wa, type: "template",
      template: { name: E.WA_TEMPLATE || "tata_ibadah", language: { code: E.WA_LANG || "id" }, components: [
        { type: "header", parameters: [{ type: "document", document: { id: upj.id, filename: name } }] },
        { type: "body", parameters: [{ type: "text", text: String(b.sunday || "Minggu ini") }, { type: "text", text: name }] },
      ] },
    };
    const s = await fetch(`${GRAPH}/${E.WA_PHONE_ID}/messages`, { method: "POST", headers: { authorization: "Bearer " + E.WA_TOKEN, "content-type": "application/json" }, body: JSON.stringify(msg) });
    const sj = await s.json().catch(() => ({}));
    if (!s.ok) return json({ error: "wa_send", detail: sj.error && sj.error.message }, 502);
    await fetch(`${BASE}/rest/v1/hk_sent`, { method: "POST", headers: { ...H, prefer: "resolution=ignore-duplicates" }, body: JSON.stringify({ key: sentKey }) });
    return json({ ok: true, to: to!.name || wa });
  } catch (e) { console.error(e); return json({ error: String((e as Error).message || e) }, 500); }
});
