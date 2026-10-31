-- hk_save: 'roster_check' (live check while typing a name) and the same check before every roster save
-- (YB 2026-10-31: nobody twice on one date). Same as the live function otherwise.
CREATE OR REPLACE FUNCTION public.hk_save(p_token text, p_kind text, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare m hk_members := hk__me(p_token); d jsonb := p_data; rid uuid := nullif(p_data ->> 'id', '')::uuid; res jsonb; gid text := nullif(p_data ->> 'group_id', '');
begin
  if p_kind in ('chat', 'chat_list', 'chat_audio') then return hk__chat(m, p_kind, d); end if;
  if p_kind in ('meet', 'meet_notes') then return hk__meet(m, p_kind, d); end if;
  if p_kind in ('ss_deck', 'ss_html') then return hk__ss(m, p_kind, d); end if;
  if p_kind = 'view_as' then return hk__view_as(m, d); end if;
  if p_kind = 'roster_check' then
    if not hk__roster_ok(m, gid) then raise exception 'not_allowed'; end if;
    return hk__roster_clash(rid, gid, d -> 'table_json', d ->> 'month');
  end if;
  if p_kind in ('live_code_get', 'live_code_new') then return hk__livecode(m, p_kind, d); end if;
  if p_kind in ('quiz_list', 'quiz_save', 'quiz_status', 'quiz_delete', 'quiz_answer', 'quiz_results') then return hk__quiz(m, p_kind, d); end if;
  if p_kind in ('visit_list', 'visit_save', 'usage_log', 'usage_report') then return hk__visit_usage(m, p_kind, d); end if;
  if p_kind in ('rpp_list', 'rpp_save', 'rpp_delete') then return hk__rpp(m, p_kind, d); end if;
  if p_kind in ('lit_list', 'lit_get', 'lit_save', 'lit_delete') then return hk__lit(m, p_kind, d); end if;
  if p_kind in ('doc_list', 'doc_get', 'doc_save') then return hk__docs(m, p_kind, d); end if;
  if p_kind = 'bible_stats' then return hk__bible_stats(m, d); end if;
  if p_kind in ('songs_list', 'songs_upsert', 'song_delete') then return hk__songs(m, p_kind, d); end if;
  if p_kind in ('photo', 'group_photo', 'photo_saved', 'rsvp', 'chat_react', 'prayer', 'pray', 'prayer_answered', 'wish', 'checkin', 'swap') then return hk__extra(m, p_kind, d); end if;
  if p_kind in ('story', 'story_audio', 'voyage', 'voyage_home', 'live_push', 'live_stop', 'live_get', 'grief', 'grief_help', 'grief_close', 'care_optin', 'ai', 'ai_get', 'fin_notify') then return hk__extra2(m, p_kind, d); end if;
  if p_kind = 'post' then
    if not hk__poster(m, gid) then raise exception 'not_allowed'; end if;
    insert into hk_posts (id, group_id, kind, title, verse, body, day, author_name)
    values (coalesce(rid, gen_random_uuid()), gid, coalesce(d ->> 'kind', 'news'), d ->> 'title', d ->> 'verse', d ->> 'body', nullif(d ->> 'day', '')::date, m.name)
    on conflict (id) do update set kind = excluded.kind, title = excluded.title, verse = excluded.verse, body = excluded.body, day = excluded.day
      where hk_posts.group_id = gid
    returning to_jsonb(hk_posts.*) into res;
    if (d ->> 'notify')::boolean then insert into hk_outbox (audience, title, body, url) values ('group:' || gid, d ->> 'title', left(coalesce(d ->> 'body', ''), 180), '#/g/' || gid); end if;

  elsif p_kind = 'roster' then
    if not hk__roster_ok(m, gid) then raise exception 'not_allowed'; end if;
    res := hk__roster_clash(rid, gid, d -> 'table_json', d ->> 'month');
    if jsonb_array_length(res) > 0 then raise exception 'roster_clash' using detail = res::text; end if;
    if length(coalesce(d ->> 'file_b64', '')) > 6000000 then raise exception 'file_too_big'; end if;
    insert into hk_rosters (id, group_id, month, title, file_name, mime, file_b64, link, table_json, text_content, author_name)
    values (coalesce(rid, gen_random_uuid()), gid, d ->> 'month', d ->> 'title', d ->> 'file_name', d ->> 'mime', d ->> 'file_b64', d ->> 'link', d -> 'table_json', d ->> 'text_content', m.name)
    on conflict (id) do update set title = excluded.title, table_json = excluded.table_json, text_content = excluded.text_content, author_name = excluded.author_name
      where hk_rosters.group_id = excluded.group_id and hk_rosters.month = excluded.month
    returning (to_jsonb(hk_rosters.*) - 'file_b64') into res;
    if jsonb_typeof(d -> 'notify_list') = 'array' then
      insert into hk_outbox (audience, title, body, url)
      select 'member:' || (x ->> 'member'), left(coalesce(x ->> 'title', d ->> 'title', 'Roster'), 120), left(coalesce(x ->> 'body', ''), 600), '#/s/' || gid
      from (select x from jsonb_array_elements(d -> 'notify_list') x limit 200) l
      where exists (select 1 from hk_members mm where mm.id::text = l.x ->> 'member' and mm.removed_at is null);
    elsif (d ->> 'notify')::boolean then insert into hk_outbox (audience, title, body, url) values ('group:' || gid, coalesce(d ->> 'title', 'Roster'), 'New roster: ' || (d ->> 'month'), '#/s/' || gid); end if;

  elsif p_kind = 'bread' then
    if not hk__chair(m, 'parhalado') then raise exception 'not_allowed'; end if;
    insert into hk_bread (day, verse, title, body, author_name) values ((d ->> 'day')::date, d ->> 'verse', d ->> 'title', d ->> 'body', m.name)
    on conflict (day) do update set verse = excluded.verse, title = excluded.title, body = excluded.body, author_name = excluded.author_name, updated_at = now(), removed_at = null
    returning to_jsonb(hk_bread.*) into res;

  elsif p_kind = 'update' then
    if (d ->> 'kind') = 'berita' then
      if not hk__chair(m, 'secretary') then raise exception 'not_allowed'; end if;
      if exists (select 1 from hk_updates where id = rid and kind <> 'berita') then raise exception 'not_allowed'; end if;
    else
      if not hk__elder(m) then raise exception 'not_allowed'; end if;
      if exists (select 1 from hk_updates where id = rid and kind = 'berita') then raise exception 'not_allowed'; end if;
    end if;
    insert into hk_updates (id, kind, day, title, body, audience, pinned, author_name)
    values (coalesce(rid, gen_random_uuid()), case when d ->> 'kind' = 'berita' then 'berita' else 'update' end, nullif(d ->> 'day', '')::date, d ->> 'title', d ->> 'body',
      case when d ->> 'kind' = 'berita' then 'all' else coalesce(d ->> 'audience', 'all') end, coalesce((d ->> 'pinned')::boolean, false), m.name)
    on conflict (id) do update set title = excluded.title, body = excluded.body, audience = excluded.audience, pinned = excluded.pinned, day = excluded.day
    returning to_jsonb(hk_updates.*) into res;
    if (d ->> 'notify')::boolean then insert into hk_outbox (audience, title, body, url) values (case when d ->> 'audience' = 'elders' then 'elders' else 'all' end, d ->> 'title', left(coalesce(d ->> 'body', ''), 180), case when d ->> 'kind' = 'berita' then '#/berita' else '#/elders' end); end if;

  elsif p_kind = 'event' then
    if not hk__maker(m) then raise exception 'not_allowed'; end if;  -- events: Multimedia makers only
    insert into hk_events (id, group_id, title, starts_at, ends_at, place, notes, remind_min, author_name)
    values (coalesce(rid, gen_random_uuid()), gid, d ->> 'title', (d ->> 'starts_at')::timestamptz, nullif(d ->> 'ends_at', '')::timestamptz, d ->> 'place', d ->> 'notes', coalesce((d ->> 'remind_min')::int, 1440), m.name)
    on conflict (id) do update set group_id = excluded.group_id, title = excluded.title, starts_at = excluded.starts_at, ends_at = excluded.ends_at, place = excluded.place, notes = excluded.notes, remind_min = excluded.remind_min
    returning to_jsonb(hk_events.*) into res;
    if (d ->> 'notify')::boolean then
      insert into hk_outbox (audience, title, body, url) values (case when gid is null then 'all' else 'group:' || gid end, '🗓 ' || (d ->> 'title'),
        to_char((d ->> 'starts_at')::timestamptz at time zone 'Asia/Singapore', 'DD/MM/YYYY HH24:MI') || coalesce(' · ' || nullif(d ->> 'place', ''), ''), '#/calendar');
    end if;

  elsif p_kind = 'poll' then
    if not hk__poster(m, gid) then raise exception 'not_allowed'; end if;
    if jsonb_typeof(d -> 'options') <> 'array' or jsonb_array_length(d -> 'options') not between 2 and 12 or coalesce(trim(d ->> 'question'), '') = '' then raise exception 'unknown_kind'; end if;
    insert into hk_polls (id, group_id, question, options, multi, status, author_name)
    values (coalesce(rid, gen_random_uuid()), gid, trim(d ->> 'question'), d -> 'options', coalesce((d ->> 'multi')::boolean, false),
            case when d ->> 'status' = 'open' then 'open' else 'draft' end, m.name)
    on conflict (id) do update set question = excluded.question, options = excluded.options, multi = excluded.multi
      where hk_polls.group_id = gid and not exists (select 1 from hk_votes v where v.poll_id = hk_polls.id)
    returning to_jsonb(hk_polls.*) into res;
    if (d ->> 'notify')::boolean then insert into hk_outbox (audience, title, body, url) values ('group:' || gid, '📊 ' || (d ->> 'question'), '', '#/g/' || gid || '?tab=polls'); end if;

  elsif p_kind = 'service' then
    if not hk__maker(m) then raise exception 'not_allowed'; end if;
    if length(coalesce(d ->> 'html', '')) > 9000000 then raise exception 'file_too_big'; end if;
    insert into hk_services (id, service_date, title, html, author_name)
    values (coalesce(rid, gen_random_uuid()), nullif(d ->> 'service_date', '')::date, d ->> 'title', d ->> 'html', m.name)
    on conflict (id) do update set service_date = excluded.service_date, title = excluded.title, html = excluded.html, author_name = excluded.author_name, removed_at = null
    returning (to_jsonb(hk_services.*) - 'html') into res;
    if (d ->> 'notify')::boolean then insert into hk_outbox (audience, title, body, url) values ('all', '⛪ ' || coalesce(d ->> 'title', 'Tata Ibadah'), coalesce(d ->> 'service_date', ''), '#/tata'); end if;

  elsif p_kind = 'file' then
    -- An office holder uploads into their own category; the admin into any of them.
    if not ((exists (select 1 from hk_groups where id = gid and kind = 'office') and (m.is_admin or m.groups ? gid)) or hk__files_ok(m, gid)) then raise exception 'not_allowed'; end if;
    if coalesce(d ->> 'link', '') <> '' and (d ->> 'link') !~ '^https://' then raise exception 'bad_link'; end if;
    if length(coalesce(d ->> 'file_b64', '')) > 14000000 then raise exception 'file_too_big'; end if;
    insert into hk_files (id, group_id, title, note, file_name, mime, file_b64, size, author_name, link, day)
    values (gen_random_uuid(), gid, d ->> 'title', d ->> 'note', d ->> 'file_name', d ->> 'mime', d ->> 'file_b64', (d ->> 'size')::int, m.name, nullif(d ->> 'link', ''), nullif(d ->> 'day', '')::date)
    returning (to_jsonb(hk_files.*) - 'file_b64') into res;
    if (d ->> 'notify')::boolean and gid in ('naposo', 'band') then
      insert into hk_outbox (audience, title, body, url) values ('group:' || gid, case when coalesce(d ->> 'link', '') <> '' then '🎬 ' else '📎 ' end || coalesce(d ->> 'title', d ->> 'file_name', 'File'), m.name, case when gid = 'naposo' then '#/g/naposo?tab=files' else '#/s/' || gid end);
    elsif (d ->> 'notify')::boolean then
      insert into hk_outbox (audience, title, body, url) select 'member:' || x.id, '📎 ' || coalesce(d ->> 'title', d ->> 'file_name'), m.name, '#/o/' || gid
      from hk_members x where x.removed_at is null and x.id <> m.id and hk__office(x);
    end if;

  elsif p_kind = 'birthday' then
    if not hk__elder(m) then raise exception 'not_allowed'; end if;
    insert into hk_birthdays (id, name, dob, year_known, note, author_name)
    values (coalesce(rid, gen_random_uuid()), d ->> 'name', (d ->> 'dob')::date, coalesce((d ->> 'year_known')::boolean, true), d ->> 'note', m.name)
    on conflict (id) do update set name = excluded.name, dob = excluded.dob, year_known = excluded.year_known, note = excluded.note, removed_at = null
    returning to_jsonb(hk_birthdays.*) into res;

  elsif p_kind = 'group' then
    if not m.is_admin then raise exception 'not_allowed'; end if;
    insert into hk_groups (id, kind, name_id, name_bt, name_en, color, icon, sort)
    values (d ->> 'id', coalesce(d ->> 'kind', 'service'), d ->> 'name_id', d ->> 'name_bt', d ->> 'name_en', coalesce(d ->> 'color', '#475569'), coalesce(d ->> 'icon', 'star'), coalesce((d ->> 'sort')::int, 50))
    on conflict (id) do update set name_id = excluded.name_id, name_bt = excluded.name_bt, name_en = excluded.name_en, color = excluded.color, icon = excluded.icon, removed_at = null
    returning to_jsonb(hk_groups.*) into res;
  else
    raise exception 'unknown_kind';
  end if;
  return res;
end $function$;
