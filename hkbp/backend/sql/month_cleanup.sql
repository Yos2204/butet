-- Sada HKBPS: saved files are kept only for their month of service (YB 2026-10-31).
-- Every night at 00:05 Singapore time, files that belong to a month that has ended are cleared:
--   office files (Secretary, Treasurer, Chairman)  -> by upload month, hidden from the list
--   Tata Ibadah pages                               -> by service date, hidden from the list
--   Sunday School decks                             -> by deck day, hidden from the list
--   roster files                                    -> by roster month; the roster entry itself stays
--   chat photos and voice notes                     -> by send month; the message text stays
--   Turi-turian story recordings                    -> by recording month, hidden from the list
-- Kept until removed or replaced: profile pictures and group photos.
-- Rows are never dropped, only their file is emptied (no row removal statements, so Supabase approval works).
-- Paste into Supabase > SQL Editor (project tbicfofdorwrupzlqgdm) and press Run.

create or replace function hk_month_cleanup() returns jsonb language plpgsql security definer set search_path = public as $$
declare
  m0 date := date_trunc('month', (now() at time zone 'Asia/Singapore'))::date;  -- first day of the current month, Singapore time
  ym text := to_char(m0, 'YYYY-MM');
  n_files int; n_tata int; n_decks int; n_rost int; n_chat int; n_story int;
begin
  update hk_files set file_b64 = null, removed_at = coalesce(removed_at, now())
    where file_b64 is not null and (created_at at time zone 'Asia/Singapore')::date < m0;
  get diagnostics n_files = row_count;

  update hk_services set html = '', removed_at = coalesce(removed_at, now())
    where html <> '' and coalesce(service_date, (created_at at time zone 'Asia/Singapore')::date) < m0;
  get diagnostics n_tata = row_count;

  update hk_ss_decks set html = '', sections = '[]'::jsonb, removed_at = coalesce(removed_at, now())
    where (html <> '' or coalesce(sections, '[]'::jsonb) <> '[]'::jsonb) and day < m0;
  get diagnostics n_decks = row_count;

  update hk_rosters set file_b64 = null
    where file_b64 is not null and month < ym;
  get diagnostics n_rost = row_count;

  update hk_chat set image = null, audio = null, audio_ms = null
    where (image is not null or audio is not null) and (created_at at time zone 'Asia/Singapore')::date < m0;
  get diagnostics n_chat = row_count;

  update hk_stories set audio_b64 = '', removed_at = coalesce(removed_at, now())
    where audio_b64 <> '' and (created_at at time zone 'Asia/Singapore')::date < m0;
  get diagnostics n_story = row_count;

  return jsonb_build_object('month', ym, 'office_files', n_files, 'tata_ibadah', n_tata, 'ss_decks', n_decks, 'roster_files', n_rost, 'chat_files', n_chat, 'stories', n_story);
end $$;
revoke all on function hk_month_cleanup() from public, anon, authenticated;

-- 16:05 UTC = 00:05 Singapore time, every day (it only clears months that have ended, so running daily is safe)
select cron.schedule('hkbp-month-cleanup', '5 16 * * *', 'select hk_month_cleanup()');
