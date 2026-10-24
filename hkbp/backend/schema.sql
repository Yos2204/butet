-- HKBP Singapore app: database for Supabase (free tier).
-- Run this whole file once in Supabase > SQL Editor. Running it again is safe.
-- Then create the first admin (only from the SQL Editor, never from the app):
--   select hk_make_admin('Your Name', '81234567', 'a-strong-password');
--
-- How security works: the phones only get the public "anon" key, and that key can
-- only call the hk_* functions below. Every function checks the signed-in member's
-- token and role before it reads or changes anything. Tables are locked otherwise.

create extension if not exists pgcrypto with schema extensions;

create table if not exists hk_groups (
  id text primary key,
  kind text not null check (kind in ('sermon','service')),
  name_id text, name_bt text, name_en text,
  color text, icon text, sort int default 0
);

create table if not exists hk_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  alias text,                          -- other names used on rosters, e.g. "Rina, Kak Rina"
  phone text unique not null,          -- 8 digits, Singapore, no +65
  dob date,
  pass_hash text,
  is_admin boolean not null default false,
  groups jsonb not null default '{}',  -- {"naposo":"member","band":"chair"}
  wa_optin boolean not null default false,
  created_at timestamptz default now()
);

alter table hk_members add column if not exists alias text;

-- Removing something only marks it (removed_at), so mistakes can be undone from the Supabase table editor.
alter table hk_groups add column if not exists removed_at timestamptz;
alter table hk_members add column if not exists removed_at timestamptz;
alter table hk_members add column if not exists setup_code_hash text; -- one-time code to set a first password in the app

create table if not exists hk_sessions (
  token text primary key,
  member_id uuid not null references hk_members on delete cascade,
  expires_at timestamptz not null
);

create table if not exists hk_posts (
  id uuid primary key default gen_random_uuid(),
  group_id text not null references hk_groups on delete cascade,
  kind text not null default 'news',   -- 'sermon' (material) or 'news'
  title text, verse text, body text, day date,
  author_name text, created_at timestamptz default now()
);

create table if not exists hk_rosters (
  id uuid primary key default gen_random_uuid(),
  group_id text not null references hk_groups on delete cascade,
  month text not null,                 -- 'YYYY-MM'
  title text, file_name text, mime text, file_b64 text, link text,
  table_json jsonb, text_content text,
  author_name text, created_at timestamptz default now()
);

create table if not exists hk_bread (
  day date primary key,
  verse text, title text, body text,
  author_name text, updated_at timestamptz default now()
);

create table if not exists hk_updates (
  id uuid primary key default gen_random_uuid(),
  title text, body text,
  audience text not null default 'all', -- 'all' or 'elders'
  pinned boolean not null default false,
  author_name text, created_at timestamptz default now()
);

create table if not exists hk_events (
  id uuid primary key default gen_random_uuid(),
  group_id text references hk_groups on delete cascade, -- null = whole church
  title text not null, starts_at timestamptz not null, ends_at timestamptz,
  place text, notes text, remind_min int not null default 1440,
  author_name text, created_at timestamptz default now()
);

create table if not exists hk_push (
  endpoint text primary key,
  member_id uuid not null references hk_members on delete cascade,
  sub jsonb not null,
  created_at timestamptz default now()
);

create table if not exists hk_outbox (
  id bigserial primary key,
  audience text not null,              -- 'all' | 'elders' | 'group:<id>' | 'member:<uuid>'
  title text, body text, url text,
  created_at timestamptz default now(), sent_at timestamptz
);

create table if not exists hk_sent (key text primary key, at timestamptz default now());

alter table hk_posts add column if not exists removed_at timestamptz;
alter table hk_rosters add column if not exists removed_at timestamptz;
alter table hk_bread add column if not exists removed_at timestamptz;
alter table hk_updates add column if not exists removed_at timestamptz;
alter table hk_events add column if not exists removed_at timestamptz;
alter table hk_push add column if not exists revoked boolean not null default false;

-- Lock every table: only the functions (and the server's service key) may touch them.
do $$ declare t text; begin
  foreach t in array array['hk_groups','hk_members','hk_sessions','hk_posts','hk_rosters','hk_bread','hk_updates','hk_events','hk_push','hk_outbox','hk_sent'] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon, authenticated', t);
  end loop;
end $$;

insert into hk_groups (id, kind, name_id, name_bt, name_en, color, icon, sort) values
  ('sekolah-minggu','sermon','Sekolah Minggu','Sikola Minggu','Sunday School','#e8913a','child',1),
  ('naposo','sermon','Naposobulung (Pemuda)','Naposobulung','Youth','#4f6bed','spark',2),
  ('ina','sermon','Ina (Kaum Ibu)','Parompuan / Ina','Mothers','#c94f8a','heart',3),
  ('ama','sermon','Ama (Kaum Bapak)','Ama','Fathers','#1f8a70','shield',4),
  ('pelaut','sermon','Pelaut & Pekerja','Parlayar dohot Pangula','Sailors & Workers','#2a7fb8','anchor',5),
  ('multimedia','service','Multimedia','Multimedia','Multimedia','#7c5cff','screen',11),
  ('jemaat','service','Jemaat','Ruas','Congregation','#0f766e','people',12),
  ('parhalado','service','Parhalado (Penatua & Pendeta)','Parhalado','Elders & Pastor','#8b5a2b','book',13),
  ('band','service','Band','Band','Band','#e11d48','drum',14),
  ('song-leader','service','Song Leader','Song Leader','Song Leader','#ca8a04','mic',15),
  ('musik','service','Pemusik','Pargonsi / Pemusik','Musicians','#0891b2','note',16)
on conflict (id) do nothing;

-- ---------- helpers (not callable from the app) ----------
create or replace function hk__phone(p text) returns text language sql immutable as $$
  select case when length(d) = 10 and left(d, 2) = '65' then right(d, 8) else d end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) x
$$;

create or replace function hk__me(p_token text) returns hk_members language plpgsql security definer set search_path = public, extensions as $$
declare m hk_members;
begin
  select mm.* into m from hk_sessions s join hk_members mm on mm.id = s.member_id
   where s.token = p_token and s.expires_at > now() and mm.removed_at is null;
  if m.id is null then raise exception 'not_signed_in'; end if;
  return m;
end $$;

create or replace function hk__chair(m hk_members, gid text) returns boolean language sql immutable as $$
  select m.is_admin or coalesce(m.groups ->> gid, '') = 'chair'
$$;

create or replace function hk__elder(m hk_members) returns boolean language sql immutable as $$
  select m.is_admin or m.groups ? 'parhalado'
$$;

-- Sermonic categories are seen by their own members, elders and admins. Service sections are seen by everyone.
create or replace function hk__sees(m hk_members, gid text) returns boolean language sql stable security definer set search_path = public as $$
  select gid is null or hk__elder(m) or m.groups ? gid
      or exists (select 1 from hk_groups g where g.id = gid and g.kind = 'service')
$$;

create or replace function hk__json(r anyelement) returns jsonb language sql immutable as $$ select to_jsonb(r) $$;

-- ---------- admin setup (SQL Editor only) ----------
create or replace function hk_make_admin(p_name text, p_phone text, p_password text) returns text language plpgsql security definer set search_path = public, extensions as $$
begin
  if hk__phone(p_phone) !~ '^[3689][0-9]{7}$' then raise exception 'Use your 8-digit Singapore phone number'; end if;
  if length(coalesce(p_password, '')) < 6 or p_password in ('your-password', 'TYPE-YOUR-PASSWORD') then raise exception 'Replace TYPE-YOUR-PASSWORD with your own password (at least 6 characters)'; end if;
  insert into hk_members (name, phone, pass_hash, is_admin, groups)
  values (p_name, hk__phone(p_phone), crypt(p_password, gen_salt('bf')), true, '{"parhalado":"chair"}')
  on conflict (phone) do update set is_admin = true, pass_hash = excluded.pass_hash, name = excluded.name;
  return 'Admin ready: ' || hk__phone(p_phone);
end $$;

-- ---------- sign in ----------
create or replace function hk_login(p_phone text, p_password text) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare m hk_members; tok text;
begin
  perform pg_sleep(0.3); -- slows down password guessing
  select * into m from hk_members where phone = hk__phone(p_phone) and removed_at is null;
  if m.id is not null and m.pass_hash is null then raise exception 'needs_password'; end if; -- the app then asks them to create one
  if m.id is null or m.pass_hash <> crypt(coalesce(p_password, ''), m.pass_hash) then
    raise exception 'bad_login';
  end if;
  tok := encode(gen_random_bytes(24), 'hex');
  insert into hk_sessions values (tok, m.id, now() + interval '180 days');
  return jsonb_build_object('token', tok);
end $$;

-- First sign-in with a one-time setup code (given by the admin): sets the member's own password.
-- First sign-in: a member on the list who has no password yet creates their own (no code needed).
create or replace function hk_first_password(p_phone text, p_password text) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare m hk_members; tok text;
begin
  perform pg_sleep(0.5);
  select * into m from hk_members where phone = hk__phone(p_phone) and removed_at is null;
  if m.id is null or m.pass_hash is not null then raise exception 'bad_login'; end if;
  if length(coalesce(p_password, '')) < 6 then raise exception 'short_password'; end if;
  update hk_members set pass_hash = crypt(p_password, gen_salt('bf')), setup_code_hash = null where id = m.id and pass_hash is null;
  if not found then raise exception 'bad_login'; end if;
  tok := encode(gen_random_bytes(24), 'hex');
  insert into hk_sessions values (tok, m.id, now() + interval '180 days');
  return jsonb_build_object('token', tok);
end $$;

create or replace function hk_logout(p_token text) returns void language sql security definer set search_path = public as $$
  update hk_sessions set expires_at = now() where token = p_token
$$;

create or replace function hk_set_password(p_token text, p_old text, p_new text) returns void language plpgsql security definer set search_path = public, extensions as $$
declare m hk_members := hk__me(p_token);
begin
  if length(coalesce(p_new, '')) < 6 then raise exception 'short_password'; end if;
  if m.pass_hash <> crypt(coalesce(p_old, ''), m.pass_hash) then raise exception 'bad_login'; end if;
  update hk_members set pass_hash = crypt(p_new, gen_salt('bf')) where id = m.id;
end $$;

-- ---------- everything the signed-in member may see, in one call ----------
create or replace function hk_data(p_token text) returns jsonb language plpgsql security definer set search_path = public as $$
declare m hk_members := hk__me(p_token); el boolean := hk__elder(m);
begin
  return jsonb_build_object(
    'me', jsonb_build_object('id', m.id, 'name', m.name, 'alias', m.alias, 'phone', m.phone, 'dob', m.dob, 'is_admin', m.is_admin, 'groups', m.groups, 'wa_optin', m.wa_optin),
    'groups', (select coalesce(jsonb_agg(to_jsonb(g) order by g.sort), '[]') from hk_groups g where g.removed_at is null),
    'posts', (select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at desc), '[]') from
               (select * from hk_posts where removed_at is null and hk__sees(m, group_id) order by created_at desc limit 300) p),
    'rosters', (select coalesce(jsonb_agg((to_jsonb(r) - 'file_b64') || jsonb_build_object('has_file', r.file_b64 is not null) order by r.month desc, r.created_at desc), '[]')
               from hk_rosters r where r.removed_at is null and r.month >= to_char(now() - interval '12 months', 'YYYY-MM')),
    'bread', (select coalesce(jsonb_agg(to_jsonb(b) order by b.day desc), '[]') from hk_bread b
               where b.removed_at is null and b.day >= current_date - 90 and (el or b.day <= (now() at time zone 'Asia/Singapore')::date)),
    'updates', (select coalesce(jsonb_agg(to_jsonb(u) order by u.pinned desc, u.created_at desc), '[]') from
               (select * from hk_updates where removed_at is null and (audience = 'all' or el) order by created_at desc limit 150) u),
    'events', (select coalesce(jsonb_agg(to_jsonb(e) order by e.starts_at), '[]') from hk_events e
               where e.removed_at is null and e.starts_at > now() - interval '60 days' and hk__sees(m, e.group_id)),
    'people', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', x.id, 'name', x.name, 'alias', x.alias, 'bday', to_char(x.dob, 'MM-DD'), 'groups', x.groups, 'is_admin', x.is_admin,
                  'phone', case when m.is_admin or exists (select 1 from jsonb_each_text(m.groups) g where g.value = 'chair' and x.groups ? g.key) then x.phone end,
                  'dob', case when m.is_admin then x.dob end,
                  'wa_optin', case when m.is_admin then x.wa_optin end,
                  'has_password', case when m.is_admin then x.pass_hash is not null end) order by x.name), '[]') from hk_members x where x.removed_at is null)
  );
end $$;

create or replace function hk_roster_file(p_token text, p_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare m hk_members := hk__me(p_token);
begin
  return (select jsonb_build_object('file_b64', file_b64, 'mime', mime, 'file_name', file_name) from hk_rosters where id = p_id and removed_at is null);
end $$;

-- ---------- save and remove, with role checks ----------
create or replace function hk_save(p_token text, p_kind text, p_data jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare m hk_members := hk__me(p_token); d jsonb := p_data; rid uuid := nullif(p_data ->> 'id', '')::uuid; res jsonb; gid text := nullif(p_data ->> 'group_id', '');
begin
  if p_kind = 'post' then
    if not hk__chair(m, gid) then raise exception 'not_allowed'; end if;
    insert into hk_posts (id, group_id, kind, title, verse, body, day, author_name)
    values (coalesce(rid, gen_random_uuid()), gid, coalesce(d ->> 'kind', 'news'), d ->> 'title', d ->> 'verse', d ->> 'body', nullif(d ->> 'day', '')::date, m.name)
    on conflict (id) do update set kind = excluded.kind, title = excluded.title, verse = excluded.verse, body = excluded.body, day = excluded.day
      where hk_posts.group_id = gid
    returning to_jsonb(hk_posts.*) into res;
    if (d ->> 'notify')::boolean then insert into hk_outbox (audience, title, body, url) values ('group:' || gid, d ->> 'title', left(coalesce(d ->> 'body', ''), 180), '#/g/' || gid); end if;

  elsif p_kind = 'roster' then
    if not hk__chair(m, gid) then raise exception 'not_allowed'; end if;
    if length(coalesce(d ->> 'file_b64', '')) > 6000000 then raise exception 'file_too_big'; end if;
    insert into hk_rosters (id, group_id, month, title, file_name, mime, file_b64, link, table_json, text_content, author_name)
    values (coalesce(rid, gen_random_uuid()), gid, d ->> 'month', d ->> 'title', d ->> 'file_name', d ->> 'mime', d ->> 'file_b64', d ->> 'link', d -> 'table_json', d ->> 'text_content', m.name)
    returning (to_jsonb(hk_rosters.*) - 'file_b64') into res;
    if (d ->> 'notify')::boolean then insert into hk_outbox (audience, title, body, url) values ('group:' || gid, coalesce(d ->> 'title', 'Roster'), 'New roster: ' || (d ->> 'month'), '#/s/' || gid); end if;

  elsif p_kind = 'bread' then
    if not hk__elder(m) then raise exception 'not_allowed'; end if;
    insert into hk_bread (day, verse, title, body, author_name) values ((d ->> 'day')::date, d ->> 'verse', d ->> 'title', d ->> 'body', m.name)
    on conflict (day) do update set verse = excluded.verse, title = excluded.title, body = excluded.body, author_name = excluded.author_name, updated_at = now(), removed_at = null
    returning to_jsonb(hk_bread.*) into res;

  elsif p_kind = 'update' then
    if not hk__elder(m) then raise exception 'not_allowed'; end if;
    insert into hk_updates (id, title, body, audience, pinned, author_name)
    values (coalesce(rid, gen_random_uuid()), d ->> 'title', d ->> 'body', coalesce(d ->> 'audience', 'all'), coalesce((d ->> 'pinned')::boolean, false), m.name)
    on conflict (id) do update set title = excluded.title, body = excluded.body, audience = excluded.audience, pinned = excluded.pinned
    returning to_jsonb(hk_updates.*) into res;
    if (d ->> 'notify')::boolean then insert into hk_outbox (audience, title, body, url) values (case when d ->> 'audience' = 'elders' then 'elders' else 'all' end, d ->> 'title', left(coalesce(d ->> 'body', ''), 180), '#/elders'); end if;

  elsif p_kind = 'event' then
    if not (hk__elder(m) or (gid is not null and hk__chair(m, gid))) then raise exception 'not_allowed'; end if;
    insert into hk_events (id, group_id, title, starts_at, ends_at, place, notes, remind_min, author_name)
    values (coalesce(rid, gen_random_uuid()), gid, d ->> 'title', (d ->> 'starts_at')::timestamptz, nullif(d ->> 'ends_at', '')::timestamptz, d ->> 'place', d ->> 'notes', coalesce((d ->> 'remind_min')::int, 1440), m.name)
    on conflict (id) do update set group_id = excluded.group_id, title = excluded.title, starts_at = excluded.starts_at, ends_at = excluded.ends_at, place = excluded.place, notes = excluded.notes, remind_min = excluded.remind_min
    returning to_jsonb(hk_events.*) into res;

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
end $$;

create or replace function hk_remove(p_token text, p_kind text, p_id text) returns void language plpgsql security definer set search_path = public as $$
declare m hk_members := hk__me(p_token); gid text;
begin
  if p_kind = 'post' then
    select group_id into gid from hk_posts where id = p_id::uuid;
    if not hk__chair(m, gid) then raise exception 'not_allowed'; end if;
    update hk_posts set removed_at = now() where id = p_id::uuid;
  elsif p_kind = 'roster' then
    select group_id into gid from hk_rosters where id = p_id::uuid;
    if not hk__chair(m, gid) then raise exception 'not_allowed'; end if;
    update hk_rosters set removed_at = now() where id = p_id::uuid;
  elsif p_kind = 'bread' then
    if not hk__elder(m) then raise exception 'not_allowed'; end if;
    update hk_bread set removed_at = now() where day = p_id::date;
  elsif p_kind = 'update' then
    if not hk__elder(m) then raise exception 'not_allowed'; end if;
    update hk_updates set removed_at = now() where id = p_id::uuid;
  elsif p_kind = 'event' then
    select group_id into gid from hk_events where id = p_id::uuid;
    if not (hk__elder(m) or (gid is not null and hk__chair(m, gid))) then raise exception 'not_allowed'; end if;
    update hk_events set removed_at = now() where id = p_id::uuid;
  elsif p_kind = 'group' then
    if not m.is_admin then raise exception 'not_allowed'; end if;
    update hk_groups set removed_at = now() where id = p_id;
  elsif p_kind = 'member' then
    if not m.is_admin or p_id::uuid = m.id then raise exception 'not_allowed'; end if;
    update hk_members set removed_at = now() where id = p_id::uuid;
    update hk_sessions set expires_at = now() where member_id = p_id::uuid;
  else
    raise exception 'unknown_kind';
  end if;
end $$;

-- Admin uploads the member list. Rows: [{name, phone, dob, password, groups:{...}, is_admin, wa_optin}]
-- A row without a password keeps the member's current password.
create or replace function hk_members_upsert(p_token text, p_rows jsonb) returns int language plpgsql security definer set search_path = public, extensions as $$
declare m hk_members := hk__me(p_token); r jsonb; n int := 0; ph text;
begin
  if not m.is_admin then raise exception 'not_allowed'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    ph := hk__phone(r ->> 'phone');
    if length(ph) <> 8 then continue; end if;
    insert into hk_members (name, alias, phone, dob, pass_hash, is_admin, groups, wa_optin)
    values (r ->> 'name', nullif(r ->> 'alias', ''), ph, nullif(r ->> 'dob', '')::date,
            case when coalesce(r ->> 'password', '') <> '' then crypt(r ->> 'password', gen_salt('bf')) end,
            coalesce((r ->> 'is_admin')::boolean, false), coalesce(r -> 'groups', '{}'), coalesce((r ->> 'wa_optin')::boolean, false))
    on conflict (phone) do update set
      name = excluded.name, alias = excluded.alias, dob = coalesce(excluded.dob, hk_members.dob),
      pass_hash = coalesce(excluded.pass_hash, hk_members.pass_hash),
      is_admin = case when hk_members.id = m.id then true else excluded.is_admin end,
      groups = excluded.groups, wa_optin = excluded.wa_optin, removed_at = null;
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function hk_push_save(p_token text, p_sub jsonb) returns void language plpgsql security definer set search_path = public as $$
declare m hk_members := hk__me(p_token);
begin
  insert into hk_push (endpoint, member_id, sub) values (p_sub ->> 'endpoint', m.id, p_sub)
  on conflict (endpoint) do update set member_id = excluded.member_id, sub = excluded.sub, revoked = false;
end $$;

create or replace function hk_push_remove(p_token text, p_endpoint text) returns void language plpgsql security definer set search_path = public as $$
declare m hk_members := hk__me(p_token);
begin
  update hk_push set revoked = true where endpoint = p_endpoint and member_id = m.id;
end $$;

-- Only these functions are open to the app's public key.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function hk_login(text, text), hk_first_password(text, text), hk_logout(text), hk_set_password(text, text, text), hk_data(text),
  hk_roster_file(text, uuid), hk_save(text, text, jsonb), hk_remove(text, text, text), hk_members_upsert(text, jsonb),
  hk_push_save(text, jsonb), hk_push_remove(text, text) to anon;
