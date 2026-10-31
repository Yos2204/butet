-- The verse of the day in Indonesian, Batak Toba and English (YB 2026-10-31): {id|bt|en: {verse, title, body}}, written by hkbp-notify.
-- hk_data / hk_public already return whole hk_bread rows (to_jsonb), so the app gets langs without other changes.
-- Applied to the live project as migration bread_langs.
alter table public.hk_bread add column if not exists langs jsonb;
