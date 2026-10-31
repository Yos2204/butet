-- Category chats (YB 2026-10-31): room 'g:<group id>' for the members of that category or section; the admin sees all.
-- Applied live as small migrations that patch the live function text (hk__chat, hk_data, hk__extra, hk__room_ok,
-- hk__call_ring, hk__call_notify) in place, so other threads' changes to those functions are kept.
create or replace function hk__chat_room_ok(m hk_members, v_room text) returns boolean
language sql stable security definer set search_path = public as $$
  select m.id is not null and m.removed_at is null and (
    v_room = 'all'
    or (v_room = 'makers' and hk__chat_maker(m))
    or (v_room like 'g:%' and exists (select 1 from hk_groups g where g.id = substr(v_room, 3) and g.removed_at is null)
        and (coalesce(m.is_admin, false) or coalesce(m.groups, '{}'::jsonb) ? substr(v_room, 3))))
$$;
revoke all on function hk__chat_room_ok(hk_members, text) from public, anon, authenticated;

alter table hk_chat add constraint hk_chat_room_check2 check (room = any (array['makers', 'all']) or room ~ '^dm:[0-9a-f-]{36}:[0-9a-f-]{36}$' or room ~ '^g:[a-z0-9-]{1,40}$') not valid;
alter table hk_chat validate constraint hk_chat_room_check2;
alter table hk_chat drop constraint hk_chat_room_check;

-- hk__chat: room check, who is online and who gets the push now go through hk__chat_room_ok; push title "💬 <category>"
do $do$
declare s text := pg_get_functiondef('hk__chat'::regproc); o text := s;
begin
  s := replace(s, $q$elsif v_room is null or v_room not in ('makers', 'all') or (v_room = 'makers' and not hk__chat_maker(m)) then raise exception 'not_allowed'; end if;$q$,
                  $q$elsif not coalesce(hk__chat_room_ok(m, v_room), false) then raise exception 'not_allowed'; end if;$q$);
  s := replace(s, $q$(v_room = 'all' or hk__chat_maker(x))$q$, $q$hk__chat_room_ok(x, v_room)$q$);
  s := replace(s, $q$case when v_room = 'makers' then $q$, $q$case when v_room like 'g:%' then chr(128172) || ' ' || coalesce((select g.name_en from hk_groups g where g.id = substr(v_room, 3)), 'Chat') when v_room = 'makers' then $q$);
  if s = o then raise exception 'patch did not apply'; end if;
  execute s;
end $do$;

-- hk_data: chat_last also lists every category room the member may use ("g:<id>": newest message id, 0 if none);
-- hk__extra: reactions only in rooms you may use
do $do$
declare s text := pg_get_functiondef('hk_data'::regproc); o text := s; e text := pg_get_functiondef('hk__extra'::regproc); eo text := e;
begin
  s := replace(s, $q$'makers', case when hk__chat_maker(m) then (select max(id) from hk_chat where room = 'makers' and removed_at is null) end)$q$,
    $q$'makers', case when hk__chat_maker(m) then (select max(id) from hk_chat where room = 'makers' and removed_at is null) end)
      || coalesce((select jsonb_object_agg('g:' || g.id, coalesce((select max(z.id) from hk_chat z where z.room = 'g:' || g.id and z.removed_at is null), 0))
           from hk_groups g where g.removed_at is null and hk__chat_room_ok(m, 'g:' || g.id)), '{}'::jsonb)$q$);
  e := replace(e, $q$(v = 'makers' and not hk__chat_maker(m))$q$, $q$(v not like 'dm:%' and not coalesce(hk__chat_room_ok(m, v), false))$q$);
  if s = o or e = eo then raise exception 'patch did not apply'; end if;
  execute s; execute e;
end $do$;

-- calls: allowed in category rooms; group calls there push the category's members
do $do$
declare a text := pg_get_functiondef('hk__room_ok'::regproc); r text := pg_get_functiondef('hk__call_ring'::regproc); n text := pg_get_functiondef('hk__call_notify'::regproc);
begin
  a := replace(a, $q$return v_room = 'all' or (v_room = 'makers' and hk__chat_maker(m));$q$, $q$return coalesce(hk__chat_room_ok(m, v_room), false);$q$);
  r := replace(r, $q$x.room in ('all', 'makers')$q$, $q$x.room !~ '^dm:'$q$);
  n := replace(n, $q$'Group call in Chat Makers - tap to join'$q$, $q$case when c.room = 'makers' then 'Group call in Chat Makers - tap to join' else 'Group call in ' || coalesce((select g.name_en from hk_groups g where g.id = substr(c.room, 3)), 'Chat') || ' - tap to join' end$q$);
  n := replace(n, $q$c.room = 'makers' and x.removed_at is null and x.id <> m.id and hk__chat_maker(x)$q$, $q$c.room <> 'all' and x.removed_at is null and x.id <> m.id and hk__chat_room_ok(x, c.room)$q$);
  execute a; execute r; execute n;
end $do$;
