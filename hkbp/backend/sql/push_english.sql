-- Push notifications in English (YB 2026-10-31: "english", after Sada's default language became English).
-- 1. Every notification text the database writes into hk_outbox is switched from Indonesian to English.
--    Each function is patched in place from its live definition; the block stops if any expected text is missing.
--    The birthday and anniversary wishes (written by hkbp-notify) keep the church's own Indonesian wording.
-- 2. The database now also sends the public anon key when it wakes hkbp-notify, so that function can run with
--    "Verify JWT" on, like the other functions. It still checks x-cron-key itself.
-- Applied to the live project as migration push_english.

do $patch$
declare
  r record; src text; i int; n int;
  p text[][] := array[
    -- function, old text, new text, how many times it must appear
    ['hk__chat', $q$'📷 Foto'$q$, $q$'📷 Photo'$q$, '2'],
    ['hk__chat', $q$'💬 Chat Jemaat'$q$, $q$'💬 Church chat'$q$, '1'],
    ['hk__extra', $q$'🙏 Pokok doa baru'$q$, $q$'🙏 New prayer request'$q$, '1'],
    ['hk__extra', $q$then 'Anonim' else$q$, $q$then 'Anonymous' else$q$, '1'],
    ['hk__extra', $q$'⚠️ Tidak bisa bertugas · ' || coalesce((select name_id from hk_groups where id = gid), gid)$q$,
                  $q$'⚠️ Can''t serve · ' || coalesce((select coalesce(nullif(name_en, ''), name_id) from hk_groups where id = gid), gid)$q$, '1'],
    ['hk__extra', $q$' (disampaikan oleh '$q$, $q$' (passed on by '$q$, '1'],
    ['hk__extra', $q$' tidak bisa bertugas '$q$, $q$' can''t serve on '$q$, '1'],
    ['hk__extra', $q$Yang kosong: '$q$, $q$Still open: '$q$, '1'],
    ['hk__extra2', $q$'🔴 LIVE · Ibadah sedang berlangsung'$q$, $q$'🔴 LIVE · The service has started'$q$, '1'],
    ['hk__extra2', $q$'Ikuti slide Tata Ibadah di HP Anda, huruf besar.'$q$, $q$'Follow the Tata Ibadah slides on your phone, in large print.'$q$, '1'],
    ['hk__extra2', $q$'Ketuk untuk membuka.'$q$, $q$'Tap to open.'$q$, '1'],
    ['hk__extra2', $q$'🕊️ Berita Duka'$q$, $q$'🕊️ In loving memory'$q$, '1'],
    ['hk__extra2', $q$left('Telah berpulang ' || btrim(d ->> 'deceased') || ', keluarga dari '$q$, $q$left(btrim(d ->> 'deceased') || ', family of '$q$, '1'],
    ['hk__extra2', $q$'. Mari mendoakan dan menghibur keluarga.'$q$, $q$', has passed away. Let us pray for and comfort the family.'$q$, '1'],
    ['hk__extra2', $q$'Akan berkunjung'$q$, $q$'Will visit'$q$, '1'],
    ['hk__extra2', $q$'Akan membawakan makanan'$q$, $q$'Will bring a meal'$q$, '1'],
    ['hk__extra2', $q$coalesce(' pada ' ||$q$, $q$coalesce(' on ' ||$q$, '2'],
    ['hk__extra2', $q$'💰 Warta Keuangan diperbarui'$q$, $q$'💰 Warta finances updated'$q$, '1'],
    ['hk__extra2', $q$left('Persembahan untuk Warta '$q$, $q$left('Offerings for the Warta of '$q$, '1'],
    ['hk__extra2', $q$' sudah diisi oleh '$q$, $q$' entered by '$q$, '1'],
    ['hk__meet', $q$'📹 Rapat dimulai · '$q$, $q$'📹 Meeting starting · '$q$, '2'],
    ['hk__meet', $q$'📹 Rapat · '$q$, $q$'📹 Meeting · '$q$, '2'],
    ['hk__meet', $q$' mengundang Anda. Ketuk untuk bergabung di Sada.'$q$, $q$' invites you. Tap to join in Sada.'$q$, '1'],
    ['hk__meet', $q$' mengundang para makers. Ketuk untuk bergabung di Sada.'$q$, $q$' invites the makers. Tap to join in Sada.'$q$, '1'],
    ['hk__quiz', $q$'🎯 Kuis Minggu ini sudah dibuka!'$q$, $q$'🎯 This week''s quiz is open!'$q$, '1'],
    ['hk__quiz', $q$' pertanyaan. Siapa yang paling cepat dan tepat?'$q$, $q$' questions. Who will be the fastest to get them right?'$q$, '1'],
    ['hk__ss', $q$'🎨 Slide Sekolah Minggu · '$q$, $q$'🎨 Sunday School slides · '$q$, '1'],
    ['hk__ss', $q$lbl || ' sudah siap ('$q$, $q$lbl || ' slides are ready ('$q$, '1'],
    ['hk__ss', $q$'). Ketuk untuk melihat.'$q$, $q$'). Tap to view.'$q$, '1'],
    ['hk_live_cast', $q$'🔴 LIVE · Ibadah sedang berlangsung'$q$, $q$'🔴 LIVE · The service has started'$q$, '1'],
    ['hk_live_cast', $q$'Ikuti slide Tata Ibadah di HP Anda, huruf besar.'$q$, $q$'Follow the Tata Ibadah slides on your phone, in large print.'$q$, '1'],
    ['hk_live_cast', $q$'Ketuk untuk membuka.'$q$, $q$'Tap to open.'$q$, '1'],
    ['hk_live_cast_key', $q$'🔴 LIVE · Ibadah sedang berlangsung'$q$, $q$'🔴 LIVE · The service has started'$q$, '1'],
    ['hk_live_cast_key', $q$'Ikuti slide Tata Ibadah di HP Anda, huruf besar.'$q$, $q$'Follow the Tata Ibadah slides on your phone, in large print.'$q$, '1'],
    ['hk_live_cast_key', $q$'Ketuk untuk membuka.'$q$, $q$'Tap to open.'$q$, '1']];
begin
  for r in select distinct p[k][1] fn from generate_subscripts(p, 1) k loop
    select pg_get_functiondef(pr.oid) into src from pg_proc pr join pg_namespace ns on ns.oid = pr.pronamespace
      where ns.nspname = 'public' and pr.proname = r.fn and pr.prokind = 'f';
    if src is null then raise exception 'missing function %', r.fn; end if;
    for i in 1 .. array_length(p, 1) loop
      continue when p[i][1] <> r.fn;
      n := (length(src) - length(replace(src, p[i][2], ''))) / length(p[i][2]);
      if n <> p[i][4]::int then raise exception '% has % copies of %, expected %', r.fn, n, p[i][2], p[i][4]; end if;
      src := replace(src, p[i][2], p[i][3]);
    end loop;
    execute src;
  end loop;
end $patch$;

-- The outbox trigger and the 15-minute job: same call as before, plus the public anon key as the JWT.
create or replace function public.hk__kick_notify() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiaWNmb2Zkb3J3cnVwemxxZ2RtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3OTk4OTEsImV4cCI6MjEwODM3NTg5MX0.Wd9o5C6yv_1rtoM0Y1dDRXsRmoUU-gc9IprMUldZ2dI';
begin
  perform net.http_post(
    url := 'https://tbicfofdorwrupzlqgdm.supabase.co/functions/v1/hkbp-notify',
    headers := jsonb_build_object('content-type', 'application/json', 'apikey', anon, 'authorization', 'Bearer ' || anon,
      'x-cron-key', (select value #>> '{}' from hk_settings where key = 'cron_key')),
    body := '{}'::jsonb, timeout_milliseconds := 60000);
  return null;
end $$;

select cron.alter_job((select jobid from cron.job where jobname = 'hkbp-notify'), command := $c$
  select net.http_post(
    url := 'https://tbicfofdorwrupzlqgdm.supabase.co/functions/v1/hkbp-notify',
    headers := jsonb_build_object('content-type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiaWNmb2Zkb3J3cnVwemxxZ2RtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3OTk4OTEsImV4cCI6MjEwODM3NTg5MX0.Wd9o5C6yv_1rtoM0Y1dDRXsRmoUU-gc9IprMUldZ2dI',
      'authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiaWNmb2Zkb3J3cnVwemxxZ2RtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3OTk4OTEsImV4cCI6MjEwODM3NTg5MX0.Wd9o5C6yv_1rtoM0Y1dDRXsRmoUU-gc9IprMUldZ2dI',
      'x-cron-key', (select value #>> '{}' from public.hk_settings where key = 'cron_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000)
$c$);
