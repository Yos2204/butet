-- Video and voice calls from Sada chat (YB 2026-10-31).
-- The phones talk to each other directly (WebRTC); the server only passes the "how to reach me" notes
-- between them (hk_call_sig) and keeps who is in the call (hk_call_peers). Calls are one-to-one in a private
-- chat, or a group call (up to 8 people) in the Makers or Everyone room.
create table if not exists hk_calls (
  id uuid primary key default gen_random_uuid(),
  room text not null,
  caller_id uuid not null references hk_members(id),
  caller_name text not null,
  video boolean not null default true,
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz
);
create index if not exists hk_calls_room on hk_calls (room) where ended_at is null;
create table if not exists hk_call_peers (
  call_id uuid not null references hk_calls(id) on delete cascade,
  member_id uuid not null references hk_members(id),
  name text not null,
  joined_at timestamptz,
  seen_at timestamptz not null default now(),
  left_at timestamptz,
  declined boolean not null default false,
  primary key (call_id, member_id)
);
create table if not exists hk_call_sig (
  id bigserial primary key,
  call_id uuid not null references hk_calls(id) on delete cascade,
  from_id uuid not null,
  to_id uuid not null,
  kind text not null,
  data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists hk_call_sig_to on hk_call_sig (call_id, to_id, id);
alter table hk_calls enable row level security;
alter table hk_call_peers enable row level security;
alter table hk_call_sig enable row level security;

-- May this member use this chat room? Same rule as hk__chat.
create or replace function hk__room_ok(m hk_members, v_room text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_other uuid;
begin
  if m.id is null or v_room is null then return false; end if;
  if v_room ~ '^dm:[0-9a-f-]{36}:[0-9a-f-]{36}$' then
    v_other := hk__dm_other(v_room, m.id);
    return v_other is not null and exists (select 1 from hk_members where id = v_other and removed_at is null);
  end if;
  return v_room = 'all' or (v_room = 'makers' and hk__chat_maker(m));
end $$;

create or replace function hk_call(p_token text, p_op text, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m hk_members := hk__me(p_token); d jsonb := coalesce(p_data, '{}'); c hk_calls; v_room text; v_dm boolean; v_other uuid;
  v_id uuid := nullif(d ->> 'id', '')::uuid; v_ice jsonb; n int;
begin
  v_ice := coalesce((select value from hk_settings where key = 'call_ice'),
    '[{"urls":["stun:stun.l.google.com:19302","stun:stun1.l.google.com:19302"]},{"urls":"stun:stun.cloudflare.com:3478"}]'::jsonb);
  -- a person stays "in the call" while their phone checks in (every second or two)
  if p_op = 'ring' then
    update hk_members set app_seen = now() where id = m.id and (app_seen is null or app_seen < now() - interval '1 minute');
    return jsonb_build_object(
      'ring', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'room', x.room, 'name', x.caller_name, 'caller_id', x.caller_id, 'video', x.video))
        from hk_calls x where x.ended_at is null and x.answered_at is null and x.created_at > now() - interval '60 seconds'
          and x.room ~ '^dm:' and x.caller_id <> m.id and hk__dm_other(x.room, m.id) = x.caller_id
          and exists (select 1 from hk_call_peers p where p.call_id = x.id and p.member_id = x.caller_id and p.left_at is null and p.seen_at > now() - interval '12 seconds')
          and not exists (select 1 from hk_call_peers p where p.call_id = x.id and p.member_id = m.id)), '[]'::jsonb),
      'live', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'room', x.room, 'video', x.video,
            'names', (select jsonb_agg(p.name order by p.joined_at) from hk_call_peers p where p.call_id = x.id and p.joined_at is not null and p.left_at is null and p.seen_at > now() - interval '12 seconds')))
        from hk_calls x where x.ended_at is null and x.room in ('all', 'makers') and hk__room_ok(m, x.room)
          and exists (select 1 from hk_call_peers p where p.call_id = x.id and p.joined_at is not null and p.left_at is null and p.seen_at > now() - interval '12 seconds')), '[]'::jsonb));
  end if;

  if p_op = 'start' then
    v_room := d ->> 'room';
    if not hk__room_ok(m, v_room) then raise exception 'not_allowed'; end if;
    v_dm := v_room like 'dm:%';
    -- tidy up: old notes, and calls nobody is in any more
    delete from hk_call_sig where created_at < now() - interval '1 day';
    update hk_calls x set ended_at = now() where x.ended_at is null and x.created_at < now() - interval '1 minute'
      and not exists (select 1 from hk_call_peers p where p.call_id = x.id and p.left_at is null and p.seen_at > now() - interval '20 seconds');
    -- a call already going on in this room: join that one instead of starting a second
    select x.* into c from hk_calls x where x.room = v_room and x.ended_at is null
      and exists (select 1 from hk_call_peers p where p.call_id = x.id and p.left_at is null and p.seen_at > now() - interval '12 seconds')
      order by x.created_at desc limit 1;
    if c.id is not null then v_id := c.id; p_op := 'join';
    else
      if (select count(*) from hk_calls x where x.caller_id = m.id and x.created_at > now() - interval '1 minute') >= 5 then raise exception 'too_fast'; end if;
      insert into hk_calls (room, caller_id, caller_name, video) values (v_room, m.id, m.name, coalesce((d ->> 'video')::boolean, true)) returning * into c;
      insert into hk_call_peers (call_id, member_id, name, joined_at) values (c.id, m.id, m.name, now());
      if v_dm then
        v_other := hk__dm_other(v_room, m.id);
        insert into hk_outbox (audience, title, body, url) values ('member:' || v_other,
          case when c.video then '📹 ' else '📞 ' end || m.name,
          case when c.video then 'Video call · tap to answer' else 'Voice call · tap to answer' end, '#/call/' || c.id);
      else
        insert into hk_chat (room, member_id, author_name, body) values (v_room, m.id, m.name,
          case when c.video then '📹 Started a video call. Tap “Join” at the top of the chat.' else '📞 Started a voice call. Tap “Join” at the top of the chat.' end);
        insert into hk_outbox (audience, title, body, url)
        select 'member:' || x.id, case when c.video then '📹 ' else '📞 ' end || m.name, case when v_room = 'makers' then 'Group call in Chat Makers · tap to join' else 'Group call in Church chat · tap to join' end, '#/call/' || c.id
        from hk_members x where x.removed_at is null and x.id <> m.id and v_room = 'makers' and hk__chat_maker(x)  -- the Everyone room only gets the chat line, not a push to the whole church
          and exists (select 1 from hk_push p where p.member_id = x.id and not p.revoked);
      end if;
      return jsonb_build_object('call', to_jsonb(c), 'me', m.id, 'peers', '[]'::jsonb, 'ice', v_ice);
    end if;
  end if;

  select * into c from hk_calls where id = v_id;
  if c.id is null or not hk__room_ok(m, c.room) then raise exception 'not_allowed'; end if;

  if p_op = 'peek' then
    return jsonb_build_object('call', to_jsonb(c), 'me', m.id,
      'live', c.ended_at is null and exists (select 1 from hk_call_peers p where p.call_id = c.id and p.member_id <> m.id and p.left_at is null and p.seen_at > now() - interval '12 seconds'));
  end if;

  if p_op = 'join' then
    if c.ended_at is not null then raise exception 'call_ended'; end if;
    select count(*) into n from hk_call_peers p where p.call_id = c.id and p.member_id <> m.id and p.joined_at is not null and p.left_at is null and p.seen_at > now() - interval '12 seconds';
    if n >= 7 then raise exception 'call_full'; end if;
    insert into hk_call_peers (call_id, member_id, name, joined_at) values (c.id, m.id, m.name, now())
      on conflict (call_id, member_id) do update set joined_at = now(), seen_at = now(), left_at = null, declined = false, name = excluded.name;
    if c.caller_id <> m.id and c.answered_at is null then update hk_calls set answered_at = now() where id = c.id returning * into c; end if;
    -- notes left for me in an earlier try are stale now
    delete from hk_call_sig where call_id = c.id and (to_id = m.id or from_id = m.id);
    return jsonb_build_object('call', to_jsonb(c), 'me', m.id, 'ice', v_ice,
      'peers', coalesce((select jsonb_agg(jsonb_build_object('id', p.member_id, 'name', p.name)) from hk_call_peers p
        where p.call_id = c.id and p.member_id <> m.id and p.joined_at is not null and p.left_at is null and p.seen_at > now() - interval '12 seconds'), '[]'::jsonb));
  end if;

  if p_op = 'sig' then
    if length(coalesce(d ->> 'data', '')) > 30000 then raise exception 'too_big'; end if;
    if not exists (select 1 from hk_call_peers p where p.call_id = c.id and p.member_id = m.id and p.left_at is null)
       or not exists (select 1 from hk_call_peers p where p.call_id = c.id and p.member_id = (d ->> 'to')::uuid and p.left_at is null) then return '{}'::jsonb; end if;
    insert into hk_call_sig (call_id, from_id, to_id, kind, data) values (c.id, m.id, (d ->> 'to')::uuid, left(d ->> 'kind', 20), d -> 'data');
    return '{}'::jsonb;
  end if;

  if p_op = 'poll' then
    update hk_call_peers set seen_at = now() where call_id = c.id and member_id = m.id and left_at is null;
    if c.ended_at is null and c.answered_at is null and c.caller_id = m.id and c.created_at < now() - interval '50 seconds' then
      -- nobody answered: the call ends and shows as missed
      update hk_calls set ended_at = now() where id = c.id returning * into c;
      update hk_call_peers set left_at = now() where call_id = c.id;
      if c.room like 'dm:%' then insert into hk_chat (room, member_id, author_name, body) values (c.room, m.id, m.name, case when c.video then '📹 Missed video call' else '📞 Missed voice call' end); end if;
    end if;
    return jsonb_build_object('ended', c.ended_at is not null, 'answered', c.answered_at is not null,
      'declined', exists (select 1 from hk_call_peers p where p.call_id = c.id and p.declined),
      'peers', coalesce((select jsonb_agg(jsonb_build_object('id', p.member_id, 'name', p.name)) from hk_call_peers p
        where p.call_id = c.id and p.member_id <> m.id and p.joined_at is not null and p.left_at is null and p.seen_at > now() - interval '12 seconds'), '[]'::jsonb),
      'sig', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'from', s.from_id, 'kind', s.kind, 'data', s.data) order by s.id)
        from hk_call_sig s where s.call_id = c.id and s.to_id = m.id and s.id > coalesce(nullif(d ->> 'after', '')::bigint, 0)), '[]'::jsonb));
  end if;

  if p_op in ('leave', 'decline') then
    insert into hk_call_peers (call_id, member_id, name, left_at, declined) values (c.id, m.id, m.name, now(), p_op = 'decline')
      on conflict (call_id, member_id) do update set left_at = now(), declined = hk_call_peers.declined or p_op = 'decline';
    if c.ended_at is null and not exists (select 1 from hk_call_peers p where p.call_id = c.id and p.joined_at is not null and p.left_at is null and p.seen_at > now() - interval '12 seconds')
       or (c.room like 'dm:%' and c.ended_at is null) then
      update hk_calls set ended_at = now() where id = c.id;
      if c.room like 'dm:%' then
        insert into hk_chat (room, member_id, author_name, body) values (c.room, c.caller_id, c.caller_name,
          case when c.answered_at is not null then (case when c.video then '📹 Video call · ' else '📞 Voice call · ' end) || greatest(1, ceil(extract(epoch from now() - c.answered_at) / 60))::int || ' min'
               when p_op = 'decline' then (case when c.video then '📹 Video call declined' else '📞 Voice call declined' end)
               else (case when c.video then '📹 Missed video call' else '📞 Missed voice call' end) end);
      end if;
    end if;
    return '{}'::jsonb;
  end if;
  raise exception 'unknown_kind';
end $$;
revoke all on function hk_call(text, text, jsonb) from public;
grant execute on function hk_call(text, text, jsonb) to anon, authenticated;
revoke all on function hk__room_ok(hk_members, text) from public, anon, authenticated;
