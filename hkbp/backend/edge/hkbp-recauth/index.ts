// Recording upload check (YB 2026-10-30): the church's Google Apps Script asks here whether a Sada sign-in may upload a
// meeting recording to the Tata Ibadah Drive folder (admin, makers and elders may). Returns {ok, name}. No secret is shared.
const E = Deno.env.toObject();
const BASE = (E.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = E.SUPABASE_SERVICE_ROLE_KEY || "";
Deno.serve(async (req) => {
  try {
    const { token } = await req.json().catch(() => ({}));
    if (!token) return Response.json({ ok: false });
    const r = await fetch(`${BASE}/rest/v1/rpc/hk_rec_ok`, { method: "POST", headers: { apikey: KEY, authorization: "Bearer " + KEY, "content-type": "application/json" }, body: JSON.stringify({ p_token: String(token) }) });
    return Response.json(r.ok ? await r.json() : { ok: false });
  } catch (e) { return Response.json({ ok: false }); }
});
