// Sends the Tata Ibadah file to the chairman on WhatsApp with no tap (YB 2026-10-26), through Meta's WhatsApp Business (Cloud) API.
//   POST {token, id, sunday}  -> {ok: true, to} | {error}
// token: the maker's Sada sign-in (hk_wb_access decides); id: the file in the church Drive folder (same rule as hkbp-drive: only files in that folder).
// Two ways to send, picked by which secrets exist (Supabase > Edge Functions > Secrets; never in the app):
//   Twilio (YB chose a Twilio virtual number, 2026-10-26): TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM ("whatsapp:+1..."), TWILIO_CONTENT_SID (approved content template:
//     twilio/media with body variables {{1}} Sunday, {{2}} file name, and media "https://<project>.supabase.co/storage/v1/object/public/tata-wa/{{3}}").
//     The file is copied into the public bucket tata-wa under an unguessable name so WhatsApp can fetch it, and removed again after a day.
//   Meta Cloud API directly (the route in use since 2026-10-27, free Meta test number): WA_TOKEN (permanent system-user token), WA_PHONE_ID (or hk_settings wa_phone_id), WA_TEMPLATE (default "tata_ibadah": header DOCUMENT, body {{1}} Sunday, {{2}} file name), WA_LANG (default "id"), WA_PIN (optional two-step PIN used to register the number on first send).
// Recipient: hk_settings tata_send_to = {name, phone}. Each file is sent once per day (hk_sent), so a repeated "go" does not spam;
// the Tata Ibadah watcher (hkbp-tata, an internal caller) passes force: true because it only calls when the file really changed.
// POST {token, dry: true, id} stores the file and returns its public URL without sending (for checking the setup).
// POST {token, check: true} checks the Meta token, phone number, account and template status without sending.
// POST {test: {to, what}} (database callers only) proves delivery to one phone: what = "hello" sends Meta's pre-approved hello_world template,
//   "text" a plain text, "document" the last published Tata Ibadah file as a plain document (the last two need that phone to have written to the number within 24 h).
// Callers: a Multimedia maker's Sada token, or the database (pg_net) with header x-cron-key = hk_settings cron_key (same as hkbp-notify) plus the public anon key as the JWT.
// Until the template is approved, a plain document message is tried instead (works only within 24 h of the chairman writing to the number).
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
    // who may call: a Multimedia maker's Sada sign-in (hk_wb_access), or the database itself (pg_cron / pg_net) with the same x-cron-key as hkbp-notify
    const cronKey = String((await setting("cron_key")) || "");
    const internal = !!cronKey && req.headers.get("x-cron-key") === cronKey;
    if (!internal && !(await rpc("hk_wb_access", { p_token: String(b.token || "") }))) return json({ error: "not_allowed" }, 403);
    const twilio = !!(E.TWILIO_SID && E.TWILIO_TOKEN && E.TWILIO_FROM && E.TWILIO_CONTENT_SID);
    // Meta: the token is a secret (WA_TOKEN); the phone number id is only an identifier, so it may live in hk_settings wa_phone_id instead of a secret
    const PHONE_ID = String(E.WA_PHONE_ID || (await setting("wa_phone_id")) || "");
    if (!twilio && !(E.WA_TOKEN && PHONE_ID) && !b.dry) {
      // which pieces are missing (names only, never values), so a mistyped secret name can be spotted from the log
      const have = { WA_TOKEN: !!E.WA_TOKEN, phone_id: !!PHONE_ID, env_wa_names: Object.keys(E).filter((k) => /^(WA|TWILIO)/i.test(k)).join(",") };
      await log(false, "not_configured", have);
      return json({ error: "not_configured", ...have }, 503);
    }
    // Meta Cloud API helpers: upload a file to WhatsApp, send one message
    const upload = async (blob: Blob, name: string) => {
      const fd = new FormData(); fd.append("messaging_product", "whatsapp"); fd.append("type", blob.type); fd.append("file", blob, name);
      const up = await fetch(`${GRAPH}/${PHONE_ID}/media`, { method: "POST", headers: { authorization: "Bearer " + E.WA_TOKEN }, body: fd });
      return { ok: up.ok, j: await up.json().catch(() => ({})) };
    };
    const send = async (body: unknown) => { const r = await fetch(`${GRAPH}/${PHONE_ID}/messages`, { method: "POST", headers: { authorization: "Bearer " + E.WA_TOKEN, "content-type": "application/json" }, body: JSON.stringify(body) }); return { ok: r.ok, j: await r.json().catch(() => ({})) }; };
    const drive = async (f: { id: string; name: string; kind: string }) => {
      const name = f.kind === "gdoc" ? f.name + ".docx" : f.name;
      const url = f.kind === "gdoc" ? `https://docs.google.com/document/d/${f.id}/export?format=docx` : `https://drive.usercontent.google.com/download?id=${f.id}&export=download&confirm=t`;
      const d = await fetch(url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0" } });
      return { ok: d.ok, status: d.status, name, blob: d.ok ? new Blob([await d.arrayBuffer()], { type: mime(name) }) : null };
    };
    // POST {test: {to, what, text}} from the database only: one message to one phone, so delivery can be proven on that phone.
    // A Meta test number can only reach its verified test recipients ((#131030) otherwise); text/document also need the 24-hour window.
    if (b.test && internal) {
      if (!(E.WA_TOKEN && PHONE_ID)) return json({ error: "not_configured" }, 503);
      const t = typeof b.test === "object" ? b.test : {};
      const dest = String(t.to || "").replace(/\D/g, ""); const num = dest.length === 8 ? "65" + dest : dest;
      if (num.length < 10) return json({ error: "no_to" }, 400);
      const what = String(t.what || "hello"); let body: unknown; let fname: string | undefined;
      if (what === "document") {
        const w = (await setting("tata_watch")) as { id?: string } | null; const folder = await setting("tata_drive_folder");
        const f = w && w.id && typeof folder === "string" ? (await list(folder)).find((x) => x.id === w.id) : null;
        if (!f) return json({ error: "no_published_file" }, 404);
        const d = await drive(f); fname = d.name;
        if (!d.ok || !d.blob) { await log(false, "download", d.status, d.name, num); return json({ error: "download_" + d.status }, 502); }
        const u = await upload(d.blob, d.name);
        if (!u.ok || !u.j.id) { await log(false, "wa_upload", u.j.error || u.j, d.name, num); return json({ error: "wa_upload", detail: u.j.error && u.j.error.message }, 502); }
        body = { messaging_product: "whatsapp", to: num, type: "document", document: { id: u.j.id, filename: d.name, caption: `Tes · ${d.name}` } };
      } else if (what === "text") body = { messaging_product: "whatsapp", to: num, type: "text", text: { body: String(t.text || "Tes dari Sada HKBPS") } };
      else body = { messaging_product: "whatsapp", to: num, type: "template", template: { name: "hello_world", language: { code: "en_US" } } };
      const r = await send(body);
      const id = r.ok && r.j.messages && r.j.messages[0] && r.j.messages[0].id;
      await log(r.ok, "test_" + what, r.ok ? id : (r.j.error || r.j), fname, num);
      return json(r.ok ? { ok: true, to: num, id } : { error: "wa_send", detail: r.j.error && r.j.error.message, code: r.j.error && r.j.error.code }, r.ok ? 200 : 502);
    }
    // POST {token, check: true} proves the Meta setup without sending: the token against the phone number id, and the template's review status
    // (WABA id from WA_WABA_ID or hk_settings wa_waba_id). Nothing secret is returned.
    if (b.check) {
      if (!(E.WA_TOKEN && PHONE_ID)) return json({ error: "not_configured" }, 503);
      const A = { authorization: "Bearer " + E.WA_TOKEN };
      const p = await fetch(`${GRAPH}/${PHONE_ID}?fields=display_phone_number,verified_name,quality_rating,platform_type`, { headers: A });
      const pj = await p.json().catch(() => ({}));
      const waba = String(E.WA_WABA_ID || (await setting("wa_waba_id")) || "");
      let template: unknown = null, account: unknown = null, numbers: unknown = null;
      if (waba) {
        const t = await fetch(`${GRAPH}/${waba}/message_templates?name=${encodeURIComponent(E.WA_TEMPLATE || "tata_ibadah")}&fields=name,status,language,rejected_reason,category`, { headers: A });
        template = await t.json().catch(() => ({}));
        // the account itself and its numbers, as the token sees them (a "(#10) Viewer cannot access ... Account" on send means the token's system user is not assigned to this account)
        account = await (await fetch(`${GRAPH}/${waba}?fields=id,name,account_review_status,ownership_type,is_enabled_for_insights`, { headers: A })).json().catch(() => ({}));
        numbers = await (await fetch(`${GRAPH}/${waba}/phone_numbers?fields=id,display_phone_number,verified_name,status,platform_type,code_verification_status`, { headers: A })).json().catch(() => ({}));
      }
      const me = await (await fetch(`${GRAPH}/me?fields=id,name`, { headers: A })).json().catch(() => ({}));
      await log(p.ok, "check", { phone: pj, template, account, numbers, me });
      return json({ ok: p.ok, phone: pj, template, account, numbers, me, phone_id: PHONE_ID, waba });
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
    if (dup.ok && (await dup.json()).length && !(internal && b.force)) return json({ ok: true, to: to!.name || wa, already: true });
    // 1. the file from Drive
    const d = await drive(f);
    if (!d.ok || !d.blob) { await log(false, "download", d.status, name, wa); return json({ error: "download_" + d.status }, 502); }
    const blob = d.blob;
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
    let u = await upload(blob, name);
    // (#133010) Account not registered: a number must be registered on the Cloud API once before it can send (two-step PIN: WA_PIN secret, else derived from the phone number id). Register, then try again.
    if (!u.ok && u.j.error && u.j.error.code === 133010) {
      const pin = String(E.WA_PIN || PHONE_ID.slice(-6)).padStart(6, "0");
      const reg = await fetch(`${GRAPH}/${PHONE_ID}/register`, { method: "POST", headers: { authorization: "Bearer " + E.WA_TOKEN, "content-type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", pin }) });
      const rj = await reg.json().catch(() => ({}));
      await log(reg.ok, "register", rj.error || rj, name, wa);
      if (reg.ok) u = await upload(blob, name);
    }
    const upj = u.j;
    if (!u.ok || !upj.id) { await log(false, "wa_upload", upj.error || upj, name, wa); return json({ error: "wa_upload", detail: upj.error && upj.error.message }, 502); }
    // 3. the approved template with the document as its header
    const msg = {
      messaging_product: "whatsapp", to: wa, type: "template",
      template: { name: E.WA_TEMPLATE || "tata_ibadah", language: { code: E.WA_LANG || "id" }, components: [
        { type: "header", parameters: [{ type: "document", document: { id: upj.id, filename: name } }] },
        { type: "body", parameters: [{ type: "text", text: String(b.sunday || "Minggu ini") }, { type: "text", text: name }] },
      ] },
    };
    let r = await send(msg);
    // While the template is still in Meta's review (132001 "does not exist", 132015 paused, 132012 format), a plain document message still goes through
    // if the chairman has written to the number in the last 24 hours (WhatsApp's customer-service window). Outside it Meta answers 131047; the log says so.
    if (!r.ok && r.j.error && [132001, 132015, 132012, 132000].includes(r.j.error.code)) {
      await log(false, "wa_send_template", r.j.error, name, wa);
      r = await send({ messaging_product: "whatsapp", to: wa, type: "document", document: { id: upj.id, filename: name, caption: `Tata Ibadah ${String(b.sunday || "Minggu ini")} · ${name}` } });
    }
    const sj = r.j;
    if (!r.ok) { await log(false, "wa_send", sj.error || sj, name, wa); return json({ error: "wa_send", detail: sj.error && sj.error.message }, 502); }
    await fetch(`${BASE}/rest/v1/hk_sent`, { method: "POST", headers: { ...H, prefer: "resolution=ignore-duplicates" }, body: JSON.stringify({ key: sentKey }) });
    await log(true, "sent", sj.messages && sj.messages[0] && sj.messages[0].id, name, wa);
    return json({ ok: true, to: to!.name || wa });
  } catch (e) { console.error(e); return json({ error: String((e as Error).message || e) }, 500); }
});
