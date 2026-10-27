// WhatsApp delivery receipts for Sada HKBPS (Meta Cloud API webhook).
// Meta calls this URL for every status change of a message we sent (sent → delivered → read, or failed with the reason)
// and for every message someone writes to our number. Each event is written to hk_wa_log, so the log shows what really
// reached a phone, not only that Meta accepted the request:
//   step status_sent | status_delivered | status_read | status_failed   (detail: message id, errors; to_phone: the recipient)
//   step inbound                                                         (someone wrote to the number: opens the 24-hour window)
// Setup (once, by the admin): Meta app > WhatsApp > Configuration > Webhook:
//   Callback URL  https://<project>.supabase.co/functions/v1/hkbp-wa-hook
//   Verify token  any phrase, saved also as the Edge Function secret WA_HOOK_TOKEN (never in the repo or the app)
//   then subscribe to the "messages" field.
// Security: GET must carry that verify token; POST is checked against X-Hub-Signature-256 when the secret WA_APP_SECRET
// (the Meta app's App secret) exists, else the event is logged with signed:false. Nothing is sent from here; the function only writes the log.
const E = Deno.env.toObject();
const BASE = (E.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = E.SUPABASE_SERVICE_ROLE_KEY || "";
const H = { apikey: KEY, authorization: "Bearer " + KEY, "content-type": "application/json" };

async function log(ok: boolean, step: string, detail: unknown, to?: string) {
  try { await fetch(`${BASE}/rest/v1/hk_wa_log`, { method: "POST", headers: H, body: JSON.stringify({ ok, step, detail: JSON.stringify(detail).slice(0, 2000), to_phone: to || null }) }); } catch (e) { console.warn("log", e); }
}
async function signed(raw: string, sig: string | null) {
  if (!E.WA_APP_SECRET) return null;                       // not configured: unknown
  if (!sig || !sig.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(E.WA_APP_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  const hex = Array.from(mac).map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === sig.slice(7).toLowerCase();
}

Deno.serve(async (req) => {
  const u = new URL(req.url);
  // Meta's one-time verification of the callback URL
  if (req.method === "GET") {
    const ok = !!E.WA_HOOK_TOKEN && u.searchParams.get("hub.mode") === "subscribe" && u.searchParams.get("hub.verify_token") === E.WA_HOOK_TOKEN;
    await log(ok, "hook_verify", { mode: u.searchParams.get("hub.mode"), token_ok: ok, token_set: !!E.WA_HOOK_TOKEN });
    return ok ? new Response(u.searchParams.get("hub.challenge") || "", { status: 200 }) : new Response("forbidden", { status: 403 });
  }
  if (req.method !== "POST") return new Response("ok");
  const raw = await req.text();
  const sig = await signed(raw, req.headers.get("x-hub-signature-256"));
  if (sig === false) { await log(false, "hook_bad_signature", { len: raw.length }); return new Response("forbidden", { status: 403 }); }
  let body: any = {}; try { body = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }
  for (const entry of body.entry || []) for (const ch of entry.changes || []) {
    const v = ch.value || {};
    for (const s of v.statuses || []) {
      const err = (s.errors || []).map((e: any) => ({ code: e.code, title: e.title, detail: e.error_data && e.error_data.details }));
      await log(s.status !== "failed", "status_" + String(s.status || "unknown"), { id: s.id, at: s.timestamp, conversation: s.conversation && s.conversation.origin && s.conversation.origin.type, errors: err, signed: sig }, s.recipient_id);
    }
    for (const m of v.messages || []) {
      // someone wrote to the number: from now on a plain (non-template) message can reach them for 24 hours
      await log(true, "inbound", { id: m.id, type: m.type, at: m.timestamp, text: m.text && String(m.text.body || "").slice(0, 120), signed: sig }, m.from);
    }
  }
  return new Response("ok");                                // Meta retries anything that is not a 200 quickly
});
