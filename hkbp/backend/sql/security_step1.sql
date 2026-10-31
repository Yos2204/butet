-- Security check step 1 (YB 2026-10-31). Applied to the live project as migrations security_step1_*; kept here so the repo shows what the database runs.
-- 1. The admin always needs a password or Face ID: no more phone-number-only sign-in for the admin account.
--    (hk_phone_check and hk_login in schema.sql; hk_first_password refuses the admin, whose password is changed only inside the app.)
-- 2. Leftover table permissions removed. Row security already blocked them; this removes them for good.
revoke all on hk_bible, hk_call_peers, hk_call_sig, hk_calls, hk_group_photos, hk_wa_log from anon, authenticated;
-- 3. Fixed search path for two helper functions (Supabase advisor warning 0011).
alter function hk__dm_other(text, uuid) set search_path = public;
alter function hk__pic(text, text, jsonb) set search_path = public;
-- 4. hk_ai_kick is a trigger; nobody needs to call it through the API.
revoke execute on function hk_ai_kick() from public, anon, authenticated;
