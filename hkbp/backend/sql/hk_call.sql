-- Video and voice calls from Sada chat (YB 2026-10-31).
-- The phones talk to each other directly (WebRTC); the server only passes the "how to reach me" notes
-- between them (hk_call_sig) and keeps who is in the call (hk_call_peers). Calls are one-to-one in a private
-- chat, or a group call (up to 8 people) in the Makers or Everyone room.
-- Split into small functions with no DELETE: the approval prompt on YB's phone drops migrations that delete rows.
create table if not exists hk_calls (id uuid primary key default gen_random_uuid(), room text not null, caller_id uuid not null references hk_members(id), caller_name text not null, video boolean not null default true, created_at timestamptz not null default now(), answered_at timestamptz, ended_at timestamptz);
alter table hk_calls enable row level security;
create index if not exists hk_calls_room on hk_calls (room) where ended_at is null;
create table if not exists hk_call_peers (call_id uuid not null references hk_calls(id) on delete cascade, member_id uuid not null references hk_members(id), name text not null, joined_at timestamptz, seen_at timestamptz not null default now(), left_at timestamptz, declined boolean not null default false, primary key (call_id, member_id));
create table if not exists hk_call_sig (id bigserial primary key, call_id uuid not null references hk_calls(id) on delete cascade, from_id uuid not null, to_id uuid not null, kind text not null, data jsonb, created_at timestamptz not null default now());
create index if not exists hk_call_sig_to on hk_call_sig (call_id, to_id, id);
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
revoke all on function hk__room_ok(hk_members, text) from public, anon, authenticated;

-- people in the call right now (their phone checked in within 12 seconds)
create or replace function hk__call_here(p_call uuid, p_not uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.member_id, 'name', p.name) order by p.joined_at), '[]'::jsonb) from hk_call_peers p
  where p.call_id = p_call and p.member_id is distinct from p_not and p.joined_at is not null and p.left_at is null and p.seen_at > now() - interval '12 seconds'
$$;
revoke all on function hk__call_here(uuid, uuid) from public, anon, authenticated;

-- a private call ringing me, and group calls going on in rooms I can see
create or replace function hk__call_ring(m hk_members) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  update hk_members set app_seen = now() where id = m.id and (app_seen is null or app_seen < now() - interval '1 minute');
  return jsonb_build_object(
    'ring', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'room', x.room, 'name', x.caller_name, 'caller_id', x.caller_id, 'video', x.video))
      from hk_calls x where x.ended_at is null and x.answered_at is null and x.created_at > now() - interval '60 seconds'
        and x.room ~ '^dm:' and x.caller_id <> m.id and hk__dm_other(x.room, m.id) = x.caller_id
        and jsonb_array_length(hk__call_here(x.id, null)) > 0
        and not exists (select 1 from hk_call_peers p where p.call_id = x.id and p.member_id = m.id)), '[]'::jsonb),
    'live', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'room', x.room, 'video', x.video, 'names', (select jsonb_agg(e ->> 'name') from jsonb_array_elements(hk__call_here(x.id, null)) e)))
      from hk_calls x where x.ended_at is null and x.room in ('all', 'makers') and hk__room_ok(m, x.room)
        and jsonb_array_length(hk__call_here(x.id, null)) > 0), '[]'::jsonb));
end $$;
revoke all on function hk__call_ring(hk_members) from public, anon, authenticated;

-- the push (private call) or the chat line + Makers push (group call)
create or replace function hk__call_notify(m hk_members, c hk_calls) returns void
language plpgsql security definer set search_path = public as $$
declare v_ic text := case when c.video then chr(128249) else chr(128222) end;
begin
  if c.room like 'dm:%' then
    insert into hk_outbox (audience, title, body, url) values ('member:' || hk__dm_other(c.room, m.id), v_ic || ' ' || m.name,
      case when c.video then 'Video call - tap to answer' else 'Voice call - tap to answer' end, '#/call/' || c.id);
  else
    insert into hk_chat (room, member_id, author_name, body) values (c.room, m.id, m.name,
      v_ic || case when c.video then ' Started a video call.' else ' Started a voice call.' end || ' Tap Join at the top of the chat.');
    -- Makers get a push; the Everyone room only gets the chat line, not a push to the whole church
    insert into hk_outbox (audience, title, body, url)
    select 'member:' || x.id, v_ic || ' ' || m.name, 'Group call in Chat Makers - tap to join', '#/call/' || c.id
    from hk_members x where c.room = 'makers' and x.removed_at is null and x.id <> m.id and hk__chat_maker(x)
      and exists (select 1 from hk_push p where p.member_id = x.id and not p.revoked);
  end if;
end $$;
revoke all on function hk__call_notify(hk_members, hk_calls) from public, anon, authenticated;

-- start a call in a room (or hand back the call already going on there)
create or replace function hk__call_start(m hk_members, v_room text, v_video boolean) returns hk_calls
language plpgsql security definer set search_path = public as $$
declare c hk_calls;
begin
  if not hk__room_ok(m, v_room) then raise exception 'not_allowed'; end if;
  update hk_calls x set ended_at = now() where x.ended_at is null and x.created_at < now() - interval '1 minute'
    and not exists (select 1 from hk_call_peers p where p.call_id = x.id and p.left_at is null and p.seen_at > now() - interval '20 seconds');
  select x.* into c from hk_calls x where x.room = v_room and x.ended_at is null
    and exists (select 1 from hk_call_peers p where p.call_id = x.id and p.left_at is null and p.seen_at > now() - interval '12 seconds')
    order by x.created_at desc limit 1;
  if c.id is not null then return c; end if;
  if (select count(*) from hk_calls x where x.caller_id = m.id and x.created_at > now() - interval '1 minute') >= 5 then raise exception 'too_fast'; end if;
  insert into hk_calls (room, caller_id, caller_name, video) values (v_room, m.id, m.name, coalesce(v_video, true)) returning * into c;
  insert into hk_call_peers (call_id, member_id, name, joined_at) values (c.id, m.id, m.name, now());
  perform hk__call_notify(m, c);
  return c;
end $$;
revoke all on function hk__call_start(hk_members, text, boolean) from public, anon, authenticated;

-- the phone checks in every second: notes for me, who is here, and whether the call ended
create or replace function hk__call_poll(m hk_members, c hk_calls, v_after bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  update hk_call_peers set seen_at = now() where call_id = c.id and member_id = m.id and left_at is null;
  if c.ended_at is null and c.answered_at is null and c.caller_id = m.id and c.created_at < now() - interval '50 seconds' then
    -- nobody answered: the call ends and shows as missed
    update hk_calls set ended_at = now() where id = c.id returning * into c;
    update hk_call_peers set left_at = now() where call_id = c.id;
    if c.room like 'dm:%' then insert into hk_chat (room, member_id, author_name, body) values (c.room, m.id, m.name,
      case when c.video then chr(128249) || ' Missed video call' else chr(128222) || ' Missed voice call' end); end if;
  end if;
  return jsonb_build_object('ended', c.ended_at is not null, 'answered', c.answered_at is not null,
    'declined', exists (select 1 from hk_call_peers p where p.call_id = c.id and p.declined),
    'peers', hk__call_here(c.id, m.id),
    'sig', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'from', s.from_id, 'kind', s.kind, 'data', s.data) order by s.id)
      from hk_call_sig s where s.call_id = c.id and s.to_id = m.id and s.id > coalesce(v_after, 0)), '[]'::jsonb));
end $$;
revoke all on function hk__call_poll(hk_members, hk_calls, bigint) from public, anon, authenticated;

-- leaving or declining; a private call ends for both, with a line in the chat
create or replace function hk__call_leave(m hk_members, c hk_calls, p_decline boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_ic text := case when c.video then chr(128249) else chr(128222) end; v_kind text := case when c.video then 'video' else 'voice' end;
begin
  insert into hk_call_peers (call_id, member_id, name, left_at, declined) values (c.id, m.id, m.name, now(), p_decline)
    on conflict (call_id, member_id) do update set left_at = now(), declined = hk_call_peers.declined or p_decline;
  if c.ended_at is not null then return; end if;
  if c.room like 'dm:%' or jsonb_array_length(hk__call_here(c.id, null)) = 0 then
    update hk_calls set ended_at = now() where id = c.id;
    if c.room like 'dm:%' then
      insert into hk_chat (room, member_id, author_name, body) values (c.room, c.caller_id, c.caller_name, v_ic || ' ' ||
        case when c.answered_at is not null then initcap(v_kind) || ' call - ' || greatest(1, ceil(extract(epoch from now() - c.answered_at) / 60))::int || ' min'
             when p_decline then initcap(v_kind) || ' call declined' else 'Missed ' || v_kind || ' call' end);
    end if;
  end if;
end $$;
revoke all on function hk__call_leave(hk_members, hk_calls, boolean) from public, anon, authenticated;

-- the one call the app makes: hk_call(token, op, data)
create or replace function hk_call(p_token text, p_op text, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m hk_members := hk__me(p_token); d jsonb := coalesce(p_data, '{}'); c hk_calls; v_ice jsonb;
begin
  v_ice := coalesce((select value from hk_settings where key = 'call_ice'),
    '[{"urls":["stun:stun.l.google.com:19302","stun:stun1.l.google.com:19302"]},{"urls":"stun:stun.cloudflare.com:3478"}]'::jsonb);
  if p_op = 'ring' then return hk__call_ring(m); end if;
  if p_op = 'start' then
    c := hk__call_start(m, d ->> 'room', (d ->> 'video')::boolean);
    if c.caller_id = m.id and c.created_at > now() - interval '3 seconds' then
      return jsonb_build_object('call', to_jsonb(c), 'me', m.id, 'peers', '[]'::jsonb, 'ice', v_ice); end if;
    p_op := 'join';
  else
    select * into c from hk_calls where id = nullif(d ->> 'id', '')::uuid;
    if c.id is null or not hk__room_ok(m, c.room) then raise exception 'not_allowed'; end if;
  end if;
  if p_op = 'peek' then
    return jsonb_build_object('call', to_jsonb(c), 'me', m.id, 'live', c.ended_at is null and jsonb_array_length(hk__call_here(c.id, m.id)) > 0);
  elsif p_op = 'join' then
    if c.ended_at is not null then raise exception 'call_ended'; end if;
    if jsonb_array_length(hk__call_here(c.id, m.id)) >= 7 then raise exception 'call_full'; end if;
    insert into hk_call_peers (call_id, member_id, name, joined_at) values (c.id, m.id, m.name, now())
      on conflict (call_id, member_id) do update set joined_at = now(), seen_at = now(), left_at = null, declined = false, name = excluded.name;
    if c.caller_id <> m.id and c.answered_at is null then update hk_calls set answered_at = now() where id = c.id returning * into c; end if;
    -- notes from an earlier try are skipped: the phone starts reading after the newest one
    return jsonb_build_object('call', to_jsonb(c), 'me', m.id, 'ice', v_ice, 'peers', hk__call_here(c.id, m.id),
      'after', coalesce((select max(s.id) from hk_call_sig s where s.call_id = c.id and s.to_id = m.id), 0));
  elsif p_op = 'sig' then
    if length(coalesce(d ->> 'data', '')) > 30000 then raise exception 'too_big'; end if;
    if exists (select 1 from hk_call_peers p where p.call_id = c.id and p.member_id = m.id and p.left_at is null)
       and exists (select 1 from hk_call_peers p where p.call_id = c.id and p.member_id = (d ->> 'to')::uuid and p.left_at is null) then
      insert into hk_call_sig (call_id, from_id, to_id, kind, data) values (c.id, m.id, (d ->> 'to')::uuid, left(d ->> 'kind', 20), d -> 'data');
    end if;
    return '{}'::jsonb;
  elsif p_op = 'poll' then return hk__call_poll(m, c, nullif(d ->> 'after', '')::bigint);
  elsif p_op in ('leave', 'decline') then perform hk__call_leave(m, c, p_op = 'decline'); return '{}'::jsonb;
  end if;
  raise exception 'unknown_kind';
end $$;
revoke all on function hk_call(text, text, jsonb) from public;
grant execute on function hk_call(text, text, jsonb) to anon, authenticated;
