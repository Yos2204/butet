-- Sada HKBPS chat voice notes (2026-10-31).
-- Adds hk_chat.audio (a data: URL, fetched only when played) and audio_ms, and patches the live
-- hk__chat / hk_save / hk_data definitions in place so other recent changes to them are kept.
alter table hk_chat add column if not exists audio text, add column if not exists audio_ms int;

do $mig$
declare s text; o text;
begin
  s := pg_get_functiondef('public.hk__chat(hk_members,text,jsonb)'::regprocedure);
  if s ~ 'chat_audio' then raise notice 'hk__chat already has voice notes'; else
  s := replace(s, 'v_img text := nullif(d ->> ''image'', '''');',
    'v_img text := nullif(d ->> ''image'', ''''); v_aud text := nullif(d ->> ''audio'', ''''); v_ms int := least(greatest(coalesce(nullif(d ->> ''audio_ms'', '''')::int, 0), 0), 600000);');
  s := replace(s, '  update hk_members set app_seen = now() where id = m.id;',
    '  update hk_members set app_seen = now() where id = m.id;
  if p_kind = ''chat_audio'' then   -- a voice note is fetched only when someone plays it
    return jsonb_build_object(''audio'', (select x.audio from hk_chat x where x.id = nullif(d ->> ''id'', '''')::bigint and x.room = v_room and x.removed_at is null));
  end if;');
  s := replace(s, '''image'', c.image, ''reply_to'', c.reply_to,', '''image'', c.image, ''audio_ms'', c.audio_ms, ''has_audio'', c.audio is not null, ''reply_to'', c.reply_to,');
  s := replace(s, '''image'', msg.image, ''reply_to'', msg.reply_to,', '''image'', msg.image, ''audio_ms'', msg.audio_ms, ''has_audio'', msg.audio is not null, ''reply_to'', msg.reply_to,');
  s := replace(s, 'left(coalesce(nullif(r.body, ''''), ''📷''), 80)', 'left(coalesce(nullif(r.body, ''''), case when r.audio is not null then ''🎤'' else ''📷'' end), 80)');
  s := replace(s, 'coalesce(nullif(msg.body, ''''), ''📷 Photo'')', 'coalesce(nullif(msg.body, ''''), case when msg.audio is not null then ''🎤 Voice note'' else ''📷 Photo'' end)');
  s := replace(s, '  if v_body = '''' and v_img is null then raise exception ''empty''; end if;',
    '  if v_aud is not null and (v_aud !~ ''^data:audio/(mp4|webm|ogg|mpeg|aac|x-m4a|wav)[;,]'' or length(v_aud) > 3000000) then raise exception ''bad_audio''; end if;
  if v_body = '''' and v_img is null and v_aud is null then raise exception ''empty''; end if;');
  s := replace(s, 'insert into hk_chat (room, member_id, author_name, body, image, reply_to) values (v_room, m.id, m.name, left(v_body, 1000), v_img, v_reply)',
    'insert into hk_chat (room, member_id, author_name, body, image, reply_to, audio, audio_ms) values (v_room, m.id, m.name, left(v_body, 1000), v_img, v_reply, v_aud, case when v_aud is not null then v_ms end)');
  if s !~ 'chat_audio' or s !~ 'bad_audio' or s !~ 'has_audio'', c\.audio' or s !~ 'has_audio'', msg\.audio' or s !~ 'Voice note' or s !~ 'r\.audio is not null' or s !~ 'v_aud, case' then
    raise exception 'hk__chat patch did not apply cleanly';
  end if;
  execute s; end if;

  s := pg_get_functiondef('public.hk_save'::regproc); o := s;
  s := replace(s, 'if p_kind in (''chat'', ''chat_list'') then', 'if p_kind in (''chat'', ''chat_list'', ''chat_audio'') then');
  if s <> o then execute s; elsif o !~ 'chat_audio' then raise exception 'hk_save patch did not apply'; end if;

  s := pg_get_functiondef('public.hk_data'::regproc); o := s;
  s := replace(s, 'left(coalesce(nullif(z.body, ''''), ''📷 Foto''), 80)', 'left(coalesce(nullif(z.body, ''''), case when z.audio is not null then ''🎤 Voice note'' else ''📷 Foto'' end), 80)');
  if s <> o then execute s; elsif o !~ 'Voice note' then raise exception 'hk_data patch did not apply'; end if;
end $mig$;
