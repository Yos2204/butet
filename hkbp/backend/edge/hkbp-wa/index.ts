// Sends the Tata Ibadah file to the chairman on WhatsApp with no tap (YB 2026-10-26), through Meta's WhatsApp Business (Cloud) API.
//   POST {token, id, sunday}  -> {ok: true, to} | {error}
// token: the maker's Sada sign-in (hk_wb_access decides); id: the file in the church Drive folder (same rule as hkbp-drive: only files in that folder).
// Two ways to send, picked by which secrets exist (Supabase > Edge Functions > Secrets; never in the app):
//   Twilio (YB chose a Twilio virtual number, 2026-10-26): TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM ("whatsapp:+1..."), TWILIO_CONTENT_SID (approved content template:
//     twilio/media with body variables {{1}} Sunday, {{2}} file name, and media "https://<project>.supabase.co/storage/v1/object/public/tata-wa/{{3}}").
//     The file is copied into the public bucket tata-wa under an unguessable name so WhatsApp can fetch it, and removed again after a day.
//   Meta Cloud API directly (the route in use since 2026-10-27, free Meta test number): WA_TOKEN (permanent system-user token), WA_PHONE_ID (or hk_settings wa_phone_id), WA_TEMPLATE (default "tata_ibadah": header DOCUMENT, body {{1}} Sunday, {{2}} file name), WA_LANG (default "id").
// Recipient: hk_settings tata_send_to = {name, phone}. Each file is sent once per day (hk_sent), so a repeated "go" does not spam.
// POST {token, dry: true, id} stores the file and returns its public URL without sending (for checking the setup).
// POST {token, check: true} checks the Meta token, phone number and template status without sending.
// Every attempt (check, download, upload, send) is recorded in hk_wa_log (service role only; see backend/sql/hk_wa_log.sql).
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
// every attempt is recorded in hk_wa_log (service role only) so the maker's failures can be read without their phone
async function log(ok: boolean, step: string, detail?: unknown, file?: string, to?: string) {
  try { await fetch(`${BASE}/rest/v1/hk_wa_log`, { method: "POST", headers: H, body: JSON.stringify({ ok, step, detail: detail == null ? null : String(typeof detail === "string" ? detail : JSON.stringify(detail)).slice(0, 2000), file: file || null, to_phone: to || null }) }); } catch (e) { console.warn("log", e); }
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
// the public bucket is created by this function on first use (25 MB cap, documents only)
async function ensureBucket() {
  const r = await fetch(`${BASE}/storage/v1/bucket`, { method: "POST", headers: H, body: JSON.stringify({ id: "tata-wa", name: "tata-wa", public: true, file_size_limit: 26214400, allowed_mime_types: ["application/pdf", "application/msword", DOCX] }) });
  if (!r.ok && r.status !== 409) { const t = await r.text(); if (!/already exists/i.test(t)) throw new Error("bucket_" + r.status + " " + t); }
}
// files parked for WhatsApp are removed after a day
async function cleanupOld() {
  try {
    const r = await fetch(`${BASE}/storage/v1/object/list/tata-wa`, { method: "POST", headers: H, body: JSON.stringify({ prefix: "", limit: 100 }) });
    if (!r.ok) return;
    const old = ((await r.json()) as { name: string; created_at: string }[]).filter((o) => Date.now() - Date.parse(o.created_at) > 864e5).map((o) => o.name);
    if (old.length) await fetch(`${BASE}/storage/v1/object/tata-wa`, { method: "DELETE", headers: H, body: JSON.stringify({ prefixes: old }) });
  } catch (e) { console.warn("cleanup", e); }
}
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const mime = (name: string) => /\.pdf$/i.test(name) ? "application/pdf" : /\.doc$/i.test(name) ? "application/msword" : DOCX;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const b = await req.json().catch(() => ({}));
    if (!(await rpc("hk_wb_access", { p_token: String(b.token || "") }))) return json({ error: "not_allowed" }, 403);
    const twilio = !!(E.TWILIO_SID && E.TWILIO_TOKEN && E.TWILIO_FROM && E.TWILIO_CONTENT_SID);
    // Meta: the token is a secret (WA_TOKEN); the phone number id is only an identifier, so it may live in hk_settings wa_phone_id instead of a secret
    const PHONE_ID = String(E.WA_PHONE_ID || (await setting("wa_phone_id")) || "");
    if (!twilio && !(E.WA_TOKEN && PHONE_ID) && !b.dry) return json({ error: "not_configured" }, 503);
    // POST {token, check: true} proves the Meta setup without sending: the token against the phone number id, and the template's review status
    // (WABA id from WA_WABA_ID or hk_settings wa_waba_id). Nothing secret is returned.
    if (b.check) {
      if (!(E.WA_TOKEN && PHONE_ID)) return json({ error: "not_configured" }, 503);
      const A = { authorization: "Bearer " + E.WA_TOKEN };
      const p = await fetch(`${GRAPH}/${PHONE_ID}?fields=display_phone_number,verified_name,quality_rating,platform_type`, { headers: A });
      const pj = await p.json().catch(() => ({}));
      const waba = String(E.WA_WABA_ID || (await setting("wa_waba_id")) || "");
      let template: unknown = null;
      if (waba) {
        const t = await fetch(`${GRAPH}/${waba}/message_templates?name=${encodeURIComponent(E.WA_TEMPLATE || "tata_ibadah")}&fields=name,status,language,rejected_reason,category`, { headers: A });
        template = await t.json().catch(() => ({}));
      }
      await log(p.ok, "check", { phone: pj, template });
      return json({ ok: p.ok, phone: pj, template, phone_id: PHONE_ID, waba });
    }
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
    if (!d.ok) { await log(false, "download", d.status, name, wa); return json({ error: "download_" + d.status }, 502); }
    const blob = new Blob([await d.arrayBuffer()], { type: mime(name) });
    if (twilio || b.dry) {
      // 2a. park the file where WhatsApp can fetch it (public bucket, unguessable name), then send the content template through Twilio
      const ext = (name.match(/\.(pdf|docx?)$/i) || [".docx"])[0].toLowerCase();
      const key = crypto.randomUUID().replace(/-/g, "") + ext;
      await ensureBucket();
      const put = await fetch(`${BASE}/storage/v1/object/tata-wa/${key}`, { method: "POST", headers: { apikey: KEY, authorization: "Bearer " + KEY, "content-type": blob.type, "x-upsert": "true" }, body: blob });
      if (!put.ok) return json({ error: "store_" + put.status, detail: await put.text() }, 502);
      const pub = `${BASE}/storage/v1/object/public/tata-wa/${key}`;
      await cleanupOld();
      if (b.dry) return json({ ok: true, dry: true, to: to!.name || wa, url: pub, twilio, size: blob.size });
      const form = new URLSearchParams({ From: E.TWILIO_FROM, To: "whatsapp:+" + wa, ContentSid: E.TWILIO_CONTENT_SID, ContentVariables: JSON.stringify({ "1": String(b.sunday || "Minggu ini"), "2": name, "3": key }) });
      const t = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${E.TWILIO_SID}/Messages.json`, { method: "POST", headers: { authorization: "Basic " + btoa(`${E.TWILIO_SID}:${E.TWILIO_TOKEN}`), "content-type": "application/x-www-form-urlencoded" }, body: form });
      const tj = await t.json().catch(() => ({}));
      if (!t.ok) return json({ error: "twilio_send", detail: tj.message || tj.error_message }, 502);
      await fetch(`${BASE}/rest/v1/hk_sent`, { method: "POST", headers: { ...H, prefer: "resolution=ignore-duplicates" }, body: JSON.stringify({ key: sentKey }) });
      return json({ ok: true, to: to!.name || wa, sid: tj.sid });
    }
    // 2b. Meta Cloud API: upload it to WhatsApp
    const fd = new FormData(); fd.append("messaging_product", "whatsapp"); fd.append("type", blob.type); fd.append("file", blob, name);
    const up = await fetch(`${GRAPH}/${PHONE_ID}/media`, { method: "POST", headers: { authorization: "Bearer " + E.WA_TOKEN }, body: fd });
    const upj = await up.json().catch(() => ({}));
    if (!up.ok || !upj.id) { await log(false, "wa_upload", upj.error || upj, name, wa); return json({ error: "wa_upload", detail: upj.error && upj.error.message }, 502); }
    // 3. the approved template with the document as its header
    const msg = {
      messaging_product: "whatsapp", to: wa, type: "template",
      template: { name: E.WA_TEMPLATE || "tata_ibadah", language: { code: E.WA_LANG || "id" }, components: [
        { type: "header", parameters: [{ type: "document", document: { id: upj.id, filename: name } }] },
        { type: "body", parameters: [{ type: "text", text: String(b.sunday || "Minggu ini") }, { type: "text", text: name }] },
      ] },
    };
    const s = await fetch(`${GRAPH}/${PHONE_ID}/messages`, { method: "POST", headers: { authorization: "Bearer " + E.WA_TOKEN, "content-type": "application/json" }, body: JSON.stringify(msg) });
    const sj = await s.json().catch(() => ({}));
    if (!s.ok) { await log(false, "wa_send", sj.error || sj, name, wa); return json({ error: "wa_send", detail: sj.error && sj.error.message }, 502); }
    await fetch(`${BASE}/rest/v1/hk_sent`, { method: "POST", headers: { ...H, prefer: "resolution=ignore-duplicates" }, body: JSON.stringify({ key: sentKey }) });
    await log(true, "sent", sj.messages && sj.messages[0] && sj.messages[0].id, name, wa);
    return json({ ok: true, to: to!.name || wa });
  } catch (e) { console.error(e); return json({ error: String((e as Error).message || e) }, 500); }
});
