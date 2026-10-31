// Face ID / fingerprint for the Sada HKBPS sign-in (YB 2026-10-31): it fills in the member's saved phone number. Passkeys (WebAuthn) kept by the phone itself:
// iPhone uses Face ID or Touch ID, Android uses face unlock or the fingerprint. The phone never sends the face or
// the fingerprint anywhere; it only signs a one-time challenge with a key that stays on the phone (and its iCloud
// Keychain / Google Password Manager), and this function checks the signature with the public key saved here.
//
// POST { action, ... }
//   reg_options  { token }                 -> { cid, options }   (a signed-in member adds Face ID on this phone)
//   reg_verify   { token, cid, response, device } -> { ok }
//   login_options {}                       -> { cid, options }
//   login_verify { cid, response }         -> { phone }   (the member's saved number; the app fills it in, no session)
//   list         { token }                 -> { keys: [{ id, device, created_at, last_used }] }
//   remove       { token, id }             -> { ok }
//   ping         {}                        -> { ok }   (the app shows the button only when this answers)
// Tables: hk_passkeys, hk_passkey_challenges (schema.sql). verify_jwt is off: the session token is the check.
import {
  generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse,
} from "npm:@simplewebauthn/server@13.1.1";

const E = Deno.env.toObject();
const BASE = (E.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = E.SUPABASE_SERVICE_ROLE_KEY || "";
const H = { apikey: KEY, authorization: "Bearer " + KEY, "content-type": "application/json" };
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type", "access-control-allow-methods": "POST, OPTIONS" };
// The app's address decides the passkey's home (RP ID). Only the live app may use it.
const ORIGINS: Record<string, string> = { "https://yos2204.github.io": "yos2204.github.io" };

async function db(path: string, opt: RequestInit = {}) {
  const r = await fetch(`${BASE}/rest/v1/${path}`, { ...opt, headers: { ...H, ...(opt.headers || {}) } });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
}
const b64u = (u: Uint8Array) => btoa(String.fromCharCode(...u)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const uuidBytes = (id: string) => Uint8Array.from(id.replace(/-/g, "").match(/../g)!.map((h) => parseInt(h, 16)));
const enc = encodeURIComponent;
class Fail extends Error {}

async function me(token: string) {
  if (!token || !/^[0-9a-f]{48}$/.test(token)) throw new Fail("not_signed_in");
  const [s] = await db(`hk_sessions?token=eq.${token}&expires_at=gt.${enc(new Date().toISOString())}&select=member_id`);
  if (!s) throw new Fail("not_signed_in");
  const [m] = await db(`hk_members?id=eq.${s.member_id}&removed_at=is.null&select=id,name,phone`);
  if (!m) throw new Fail("not_signed_in");
  return m;
}
async function newChallenge(kind: string, challenge: string, member_id: string | null) {
  // Old unused challenges are cleared on the way.
  await db(`hk_passkey_challenges?created_at=lt.${enc(new Date(Date.now() - 600e3).toISOString())}`, { method: "DELETE" });
  const [c] = await db("hk_passkey_challenges", { method: "POST", headers: { prefer: "return=representation" }, body: JSON.stringify({ kind, challenge, member_id }) });
  return c.id as string;
}
async function takeChallenge(cid: string, kind: string) {
  if (!/^[0-9a-f-]{36}$/.test(cid || "")) throw new Fail("expired");
  const [c] = await db(`hk_passkey_challenges?id=eq.${cid}&kind=eq.${kind}`, { method: "DELETE", headers: { prefer: "return=representation" } });
  if (!c || Date.parse(c.created_at) < Date.now() - 300e3) throw new Fail("expired");
  return c;
}

async function handle(b: any, origin: string, rpID: string) {
  switch (b.action) {
    case "ping": return { ok: true };
    case "reg_options": {
      const m = await me(b.token);
      const mine = await db(`hk_passkeys?member_id=eq.${m.id}&select=id,transports`);
      const options = await generateRegistrationOptions({
        rpName: "Sada HKBPS", rpID, userID: uuidBytes(m.id), userName: "+65 " + m.phone, userDisplayName: m.name,
        attestationType: "none", timeout: 120000,
        excludeCredentials: mine.map((k: any) => ({ id: k.id, transports: k.transports || undefined })),
        authenticatorSelection: { authenticatorAttachment: "platform", residentKey: "required", userVerification: "required" },
        supportedAlgorithmIDs: [-7, -257],
      });
      return { cid: await newChallenge("reg", options.challenge, m.id), options };
    }
    case "reg_verify": {
      const m = await me(b.token);
      const c = await takeChallenge(b.cid, "reg");
      if (c.member_id !== m.id) throw new Fail("expired");
      const v = await verifyRegistrationResponse({ response: b.response, expectedChallenge: c.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true });
      if (!v.verified || !v.registrationInfo) throw new Fail("bad_passkey");
      const k = v.registrationInfo.credential;
      await db("hk_passkeys?on_conflict=id", { method: "POST", headers: { prefer: "resolution=merge-duplicates" }, body: JSON.stringify({
        id: k.id, member_id: m.id, public_key: b64u(k.publicKey), counter: k.counter, transports: k.transports || null,
        device: String(b.device || "").slice(0, 60) || null, created_at: new Date().toISOString(),
      }) });
      return { ok: true };
    }
    case "login_options": {
      const options = await generateAuthenticationOptions({ rpID, userVerification: "required", timeout: 120000 });
      return { cid: await newChallenge("login", options.challenge, null), options };
    }
    case "login_verify": {
      const c = await takeChallenge(b.cid, "login");
      const id = String((b.response && b.response.id) || "");
      const [k] = id ? await db(`hk_passkeys?id=eq.${enc(id)}&select=*`) : [];
      if (!k) throw new Fail("no_passkey");
      const [m] = await db(`hk_members?id=eq.${k.member_id}&removed_at=is.null&select=id,phone`);
      if (!m) throw new Fail("no_passkey");
      const v = await verifyAuthenticationResponse({
        response: b.response, expectedChallenge: c.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true,
        credential: { id: k.id, publicKey: unb64u(k.public_key), counter: Number(k.counter) || 0, transports: k.transports || undefined },
      });
      if (!v.verified) throw new Fail("bad_passkey");
      await db(`hk_passkeys?id=eq.${enc(k.id)}`, { method: "PATCH", body: JSON.stringify({ counter: v.authenticationInfo.newCounter, last_used: new Date().toISOString() }) });
      // Face ID only fills in the saved phone number (YB 2026-10-31): no session here, sign-in goes on through hk_login.
      return { phone: m.phone };
    }
    case "list": {
      const m = await me(b.token);
      return { keys: await db(`hk_passkeys?member_id=eq.${m.id}&select=id,device,created_at,last_used&order=created_at.desc`) };
    }
    case "remove": {
      const m = await me(b.token);
      await db(`hk_passkeys?id=eq.${enc(String(b.id || ""))}&member_id=eq.${m.id}`, { method: "DELETE" });
      return { ok: true };
    }
  }
  throw new Fail("bad_action");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const out = (j: unknown, status = 200) => new Response(JSON.stringify(j), { status, headers: { ...CORS, "content-type": "application/json" } });
  const origin = req.headers.get("origin") || "";
  const rpID = ORIGINS[origin];
  if (!rpID) return out({ error: "bad_origin" }, 403);
  try { return out(await handle(await req.json(), origin, rpID)); }
  catch (e) {
    if (e instanceof Fail) return out({ error: e.message }, 400);
    console.error(e); return out({ error: "bad_passkey", detail: String((e as Error).message || e).slice(0, 200) }, 400);
  }
});
