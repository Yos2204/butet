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
  kind text not null check (kind in ('sermon','service','office')),
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
alter table hk_members add column if not exists wed date;            -- wedding date (anniversary wishes)
alter table hk_members add column if not exists cal_token text unique; -- secret part of the member's calendar feed link
alter table hk_groups add column if not exists wa_link text;          -- the category's WhatsApp group invite link
alter table hk_members add column if not exists profile jsonb;        -- first-login answers: married, gender, pelaut, confirmed (picks which categories show)

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

-- App settings set by the admin in the first-time setup pop-up (daily bread source, WhatsApp group, time).
-- claude_key, vapid_private and cron_key are secret: only the notification job and pg_cron read them. All are created on the server (no one types them).
create table if not exists hk_settings (key text primary key, value jsonb, updated_at timestamptz default now());

-- Tata Ibadah (order of service) made in the workbench by Multimedia makers and published for everyone to read.
create table if not exists hk_services (
  id uuid primary key default gen_random_uuid(),
  service_date date, title text, html text not null,
  author_name text, created_at timestamptz default now(), removed_at timestamptz
);

-- Birthdays of people who are not (yet) in the member list, e.g. imported once from a church birthday list.
create table if not exists hk_birthdays (
  id uuid primary key default gen_random_uuid(),
  name text not null, dob date not null, year_known boolean not null default true, note text,
  author_name text, created_at timestamptz default now(), removed_at timestamptz
);

-- Files the Secretary, Treasurer and Chairman upload (letters, reports, minutes). Only office holders and the admin see them.
create table if not exists hk_files (
  id uuid primary key default gen_random_uuid(),
  group_id text not null references hk_groups on delete cascade,
  title text, note text, file_name text, mime text, file_b64 text, size int,
  author_name text, created_at timestamptz default now(), removed_at timestamptz
);

-- Older databases: allow the 'office' kind (Secretary, Treasurer, Chairman).
alter table hk_groups drop constraint if exists hk_groups_kind_check;
alter table hk_groups add constraint hk_groups_kind_check check (kind in ('sermon','service','office'));

alter table hk_posts add column if not exists removed_at timestamptz;
alter table hk_rosters add column if not exists removed_at timestamptz;
alter table hk_bread add column if not exists removed_at timestamptz;
alter table hk_updates add column if not exists removed_at timestamptz;
-- Berita Pelayanan (kind 'berita'): uploaded by the Secretary; other rows are elders' updates.
alter table hk_updates add column if not exists kind text not null default 'update';
alter table hk_updates add column if not exists day date;
alter table hk_events add column if not exists removed_at timestamptz;
alter table hk_push add column if not exists revoked boolean not null default false;

-- Polls for the Youth and Sunday School classes. Teacher Makers write them; any teacher opens and closes them; members vote.
create table if not exists hk_polls (
  id uuid primary key default gen_random_uuid(),
  group_id text not null references hk_groups,
  question text not null, options jsonb not null default '[]', multi boolean not null default false,
  status text not null default 'draft' check (status in ('draft','open','closed')),
  author_name text, created_at timestamptz default now(),
  opened_by text, opened_at timestamptz, removed_at timestamptz
);
create table if not exists hk_votes (
  poll_id uuid not null references hk_polls,
  member_id uuid not null references hk_members,
  choices int[] not null, at timestamptz default now(),
  primary key (poll_id, member_id)
);

-- Lock every table: only the functions (and the server's service key) may touch them.
do $$ declare t text; begin
  foreach t in array array['hk_groups','hk_members','hk_sessions','hk_posts','hk_rosters','hk_bread','hk_updates','hk_events','hk_push','hk_outbox','hk_sent','hk_settings','hk_birthdays','hk_services','hk_files','hk_polls','hk_votes'] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon, authenticated', t);
  end loop;
end $$;

insert into hk_groups (id, kind, name_id, name_bt, name_en, color, icon, sort) values
  ('sekolah-minggu','sermon','Sekolah Minggu','Sikola Minggu','Sunday School','#e8913a','child',1),
  ('remaja','sermon','Remaja','Remaja','Teens','#9333ea','star',2),
  ('naposo','sermon','Naposobulung (Pemuda)','Naposobulung','Youth','#4f6bed','spark',3),
  ('ina','sermon','Ina (Kaum Ibu)','Parompuan / Ina','Mothers','#c94f8a','heart',4),
  ('ama','sermon','Ama (Kaum Bapak)','Ama','Fathers','#1f8a70','shield',5),
  ('pelaut','sermon','Pelaut & Pekerja','Parlayar dohot Pangula','Sailors & Workers','#2a7fb8','anchor',6),
  ('multimedia','service','Multimedia','Multimedia','Multimedia','#7c5cff','screen',11),
  ('jemaat','service','Jemaat','Ruas','Congregation','#0f766e','people',12),
  ('parhalado','service','Parhalado (Penatua & Pendeta)','Parhalado','Elders & Pastor','#8b5a2b','book',13),
  ('band','service','Band','Band','Band','#e11d48','drum',14),
  ('song-leader','service','Song Leader','Song Leader','Song Leader','#ca8a04','mic',15),
  ('musik','service','Pemusik','Pargonsi / Pemusik','Musicians','#0891b2','note',16),
  ('secretary','office','Sekretaris','Sekretaris','Secretary','#334155','file',21),
  ('treasurer','office','Bendahara','Bendahara','Treasurer','#15803d','coins',22),
  ('chairman','office','Ketua','Ketua','Chairman','#9f1239','gavel',23)
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

-- Like hk__me, but for pages anyone may open without signing in: returns an empty member (no rights) instead of an error.
create or replace function hk__who(p_token text) returns hk_members language plpgsql stable security definer set search_path = public as $$
declare m hk_members;
begin
  select mm.* into m from hk_sessions s join hk_members mm on mm.id = s.member_id
   where s.token = p_token and s.expires_at > now() and mm.removed_at is null;
  if m.id is null then m.groups := '{}'; m.is_admin := false; end if;
  return m;
end $$;

create or replace function hk__chair(m hk_members, gid text) returns boolean language sql immutable as $$
  select m.is_admin or coalesce(m.groups ->> gid, '') = 'chair'
$$;

create or replace function hk__elder(m hk_members) returns boolean language sql immutable as $$
  select m.is_admin or m.groups ? 'parhalado'
$$;

-- Secretary, Treasurer and Chairman ("office" categories): only the people the admin put in one of them, and the admin.
create or replace function hk__office(m hk_members) returns boolean language sql stable security definer set search_path = public as $$
  select m.is_admin or exists (select 1 from hk_groups g where g.kind = 'office' and m.groups ? g.id)
$$;

-- Office categories are seen only by office holders and the admin (not by elders automatically).
-- Sermonic categories are seen by their own members, elders and admins. Service sections are seen by everyone.
create or replace function hk__sees(m hk_members, gid text) returns boolean language sql stable security definer set search_path = public as $$
  select case when exists (select 1 from hk_groups g where g.id = gid and g.kind = 'office') then hk__office(m)
    else gid is null or hk__elder(m) or m.groups ? gid
      or exists (select 1 from hk_groups g where g.id = gid and g.kind = 'service') end
$$;

-- Multimedia "maker" (or its chair, or an admin) may publish a Tata Ibadah. A "checker" and everyone else only read it.
create or replace function hk__maker(m hk_members) returns boolean language sql immutable as $$
  select m.is_admin or coalesce(m.groups ->> 'multimedia', '') in ('maker', 'chair')
$$;

-- Youth and Sunday School are run by their teachers. A Teacher Maker ("tmaker") posts materials, news, events and polls;
-- a Teacher ("teacher") reads everything and opens or closes polls in class. Only Makers (and the admin) add teachers.
create or replace function hk__teach(gid text) returns boolean language sql immutable as $$
  select coalesce(gid in ('naposo', 'sekolah-minggu'), false)
$$;

create or replace function hk__teacher(m hk_members, gid text) returns boolean language sql immutable as $$
  select m.is_admin or coalesce(m.groups ->> gid, '') in ('tmaker', 'teacher')
$$;

-- Who may post in a category: the Teacher Makers in Youth and Sunday School, the chair elsewhere, and the admin.
create or replace function hk__poster(m hk_members, gid text) returns boolean language sql immutable as $$
  select case when hk__teach(gid) then m.is_admin or coalesce(m.groups ->> gid, '') = 'tmaker' else hk__chair(m, gid) end
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
  -- Ordinary members (no leader role, not an elder, office holder or admin) may sign in with just their phone number.
  if m.id is not null and m.pass_hash is null and coalesce(p_password, '') = '' and not m.is_admin
     and not exists (select 1 from jsonb_each_text(m.groups) g where g.value <> 'member' or g.key = 'parhalado'
                     or exists (select 1 from hk_groups o where o.id = g.key and o.kind = 'office')) then
    tok := encode(gen_random_bytes(24), 'hex');
    insert into hk_sessions values (tok, m.id, now() + interval '180 days');
    return jsonb_build_object('token', tok);
  end if;
  if m.id is not null and m.pass_hash is null then raise exception 'needs_password'; end if; -- leaders: the app asks them to create one
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
declare m hk_members := hk__me(p_token); el boolean := hk__elder(m); off boolean := hk__office(m);
  hide text[] := case when hk__office(m) then '{}' else (select coalesce(array_agg(id), '{}') from hk_groups where kind = 'office') end;
begin
  return jsonb_build_object(
    'me', jsonb_build_object('id', m.id, 'name', m.name, 'alias', m.alias, 'phone', m.phone, 'dob', m.dob, 'wed', m.wed, 'is_admin', m.is_admin, 'groups', m.groups, 'wa_optin', m.wa_optin, 'profile', m.profile),
    'groups', (select coalesce(jsonb_agg(to_jsonb(g) order by g.sort), '[]') from hk_groups g where g.removed_at is null and (g.kind <> 'office' or off)),
    'posts', (select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at desc), '[]') from
               (select * from hk_posts where removed_at is null and hk__sees(m, group_id) order by created_at desc limit 300) p),
    'rosters', (select coalesce(jsonb_agg((to_jsonb(r) - 'file_b64') || jsonb_build_object('has_file', r.file_b64 is not null) order by r.month desc, r.created_at desc), '[]')
               from hk_rosters r where r.removed_at is null and hk__sees(m, r.group_id) and r.month >= to_char(now() - interval '12 months', 'YYYY-MM')),
    'bread', (select coalesce(jsonb_agg(to_jsonb(b) order by b.day desc), '[]') from hk_bread b
               where b.removed_at is null and b.day >= current_date - 90 and (el or off or b.day <= (now() at time zone 'Asia/Singapore')::date)),
    'updates', (select coalesce(jsonb_agg(to_jsonb(u) order by u.pinned desc, u.created_at desc), '[]') from
               (select * from hk_updates where removed_at is null and (audience = 'all' or el) order by created_at desc limit 150) u),
    'events', (select coalesce(jsonb_agg(to_jsonb(e) order by e.starts_at), '[]') from hk_events e
               where e.removed_at is null and e.starts_at > now() - interval '60 days' and hk__sees(m, e.group_id)),
    'people', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', x.id, 'name', x.name, 'alias', x.alias, 'bday', to_char(x.dob, 'MM-DD'), 'anniv', to_char(x.wed, 'MM-DD'), 'groups', x.groups - hide, 'is_admin', x.is_admin,
                  'phone', case when m.is_admin or exists (select 1 from jsonb_each_text(m.groups) g where g.value in ('chair', 'tmaker') and x.groups ? g.key) then x.phone end,
                  'dob', case when m.is_admin then x.dob end,
                  'wed', case when m.is_admin then x.wed end,
                  'wa_optin', case when m.is_admin then x.wa_optin end,
                  'has_password', case when m.is_admin then x.pass_hash is not null end) order by x.name), '[]') from hk_members x where x.removed_at is null),
    'polls', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'group_id', p.group_id, 'question', p.question, 'options', p.options, 'multi', p.multi,
                  'status', p.status, 'author_name', p.author_name, 'created_at', p.created_at, 'opened_by', p.opened_by, 'opened_at', p.opened_at,
                  'mine', (select to_jsonb(v.choices) from hk_votes v where v.poll_id = p.id and v.member_id = m.id),
                  'voters', (select count(*) from hk_votes v where v.poll_id = p.id),
                  'counts', case when hk__teacher(m, p.group_id) or p.status = 'closed' or exists (select 1 from hk_votes v where v.poll_id = p.id and v.member_id = m.id)
                    then (select coalesce(jsonb_agg((select count(*) from hk_votes v where v.poll_id = p.id and (i - 1) = any (v.choices)) order by i), '[]')
                          from generate_series(1, jsonb_array_length(p.options)) i) end) order by p.created_at desc), '[]')
                from hk_polls p where p.removed_at is null and hk__sees(m, p.group_id) and p.created_at > now() - interval '180 days'
                  and (p.status <> 'draft' or hk__teacher(m, p.group_id))),
    'services', (select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'service_date', v.service_date, 'title', v.title, 'author_name', v.author_name,
                  'created_at', v.created_at, 'size', length(v.html)) order by v.service_date desc nulls last, v.created_at desc), '[]')
                  from (select * from hk_services where removed_at is null order by service_date desc nulls last, created_at desc limit 60) v),
    'birthdays', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'bday', to_char(b.dob, 'MM-DD'),
                  'year', case when b.year_known then extract(year from b.dob)::int end, 'note', b.note) order by to_char(b.dob, 'MM-DD')), '[]')
                  from hk_birthdays b where b.removed_at is null),
    'files', (select coalesce(jsonb_agg((to_jsonb(f) - 'file_b64') order by f.created_at desc), '[]') from hk_files f
                where f.removed_at is null and off and hk__sees(m, f.group_id)),
    'settings', (select coalesce(jsonb_object_agg(key, value), '{}') from hk_settings where key not in ('claude_key', 'vapid_private', 'cron_key'))
                || jsonb_build_object('claude_key_set', exists (select 1 from hk_settings where key = 'claude_key'))
  );
end $$;

-- What anyone sees before signing in: daily bread, church-wide updates and events, Tata Ibadah and the service rosters.
-- Categories (Youth, Sunday School, Mothers, ...), the office, member names, phones and birthdays need a sign-in.
create or replace function hk_public() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  return jsonb_build_object(
    'me', null,
    'groups', (select coalesce(jsonb_agg(to_jsonb(g) order by g.sort), '[]') from hk_groups g where g.removed_at is null and g.kind <> 'office'),
    'posts', '[]'::jsonb, 'people', '[]'::jsonb, 'birthdays', '[]'::jsonb, 'files', '[]'::jsonb, 'polls', '[]'::jsonb,
    'rosters', (select coalesce(jsonb_agg((to_jsonb(r) - 'file_b64') || jsonb_build_object('has_file', r.file_b64 is not null) order by r.month desc, r.created_at desc), '[]')
               from hk_rosters r join hk_groups g on g.id = r.group_id and g.kind = 'service'
               where r.removed_at is null and r.month >= to_char(now() - interval '12 months', 'YYYY-MM')),
    'bread', (select coalesce(jsonb_agg(to_jsonb(b) order by b.day desc), '[]') from hk_bread b
               where b.removed_at is null and b.day >= current_date - 90 and b.day <= (now() at time zone 'Asia/Singapore')::date),
    'updates', (select coalesce(jsonb_agg(to_jsonb(u) order by u.pinned desc, u.created_at desc), '[]') from
               (select * from hk_updates where removed_at is null and audience = 'all' order by created_at desc limit 150) u),
    'events', (select coalesce(jsonb_agg(to_jsonb(e) order by e.starts_at), '[]') from hk_events e
               where e.removed_at is null and e.starts_at > now() - interval '60 days'
                 and (e.group_id is null or exists (select 1 from hk_groups g where g.id = e.group_id and g.kind = 'service'))),
    'services', (select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'service_date', v.service_date, 'title', v.title, 'author_name', v.author_name,
                  'created_at', v.created_at, 'size', length(v.html)) order by v.service_date desc nulls last, v.created_at desc), '[]')
                  from (select * from hk_services where removed_at is null order by service_date desc nulls last, created_at desc limit 60) v),
    'settings', (select coalesce(jsonb_object_agg(key, value), '{}') from hk_settings where key in ('bread_source', 'bread_lang', 'bread_hour', 'wa_group_link', 'setup_done', 'vapid_public'))
  );
end $$;

-- Admin gives one person a role in one group by phone number (e.g. Multimedia "maker" or "checker").
-- A phone that is not on the member list yet is added with the given name. p_role '' removes the role.
create or replace function hk_set_role(p_token text, p_phone text, p_group text, p_role text, p_name text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare m hk_members := hk__me(p_token); ph text := hk__phone(p_phone); x hk_members;
begin
  if not m.is_admin then raise exception 'not_allowed'; end if;
  if ph !~ '^[3689][0-9]{7}$' then raise exception 'bad_phone'; end if;
  if coalesce(p_role, '') not in ('', 'member', 'chair', 'maker', 'checker', 'tmaker', 'teacher') or not exists (select 1 from hk_groups where id = p_group) then raise exception 'unknown_kind'; end if;
  select * into x from hk_members where phone = ph;
  if x.id is null then
    if coalesce(trim(p_name), '') = '' then raise exception 'need_name'; end if;
    insert into hk_members (name, phone, groups) values (trim(p_name), ph, '{}') returning * into x;
  end if;
  update hk_members set removed_at = null,
    groups = case when coalesce(p_role, '') = '' then groups - p_group else groups || jsonb_build_object(p_group, p_role) end
  where id = x.id returning * into x;
  return jsonb_build_object('id', x.id, 'name', x.name, 'phone', x.phone, 'groups', x.groups);
end $$;

-- Teacher Makers (or the admin) add or remove teachers in Youth or Sunday School by phone number.
-- p_role 'tmaker' = Maker, 'teacher' = reads and opens polls, '' = no longer a teacher (stays a member of the class).
create or replace function hk_set_teacher(p_token text, p_phone text, p_group text, p_role text, p_name text default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare m hk_members := hk__me(p_token); ph text := hk__phone(p_phone); x hk_members;
begin
  if not hk__teach(p_group) or not hk__poster(m, p_group) then raise exception 'not_allowed'; end if;
  if ph !~ '^[3689][0-9]{7}$' then raise exception 'bad_phone'; end if;
  if coalesce(p_role, '') not in ('', 'tmaker', 'teacher') then raise exception 'unknown_kind'; end if;
  select * into x from hk_members where phone = ph;
  if x.id is null then
    if coalesce(trim(p_name), '') = '' then raise exception 'need_name'; end if;
    insert into hk_members (name, phone, groups) values (trim(p_name), ph, '{}') returning * into x;
  end if;
  update hk_members set removed_at = null,
    groups = groups || jsonb_build_object(p_group, case when coalesce(p_role, '') = '' then 'member' else p_role end)
  where id = x.id returning * into x;
  return jsonb_build_object('id', x.id, 'name', x.name, 'phone', x.phone, 'groups', x.groups);
end $$;

-- A teacher opens a poll in class ('open') or ends it ('closed').
create or replace function hk_poll_state(p_token text, p_id uuid, p_status text) returns void language plpgsql security definer set search_path = public as $$
declare m hk_members := hk__me(p_token); gid text;
begin
  select group_id into gid from hk_polls where id = p_id and removed_at is null;
  if gid is null or not hk__teacher(m, gid) or p_status not in ('open', 'closed') then raise exception 'not_allowed'; end if;
  update hk_polls set status = p_status, opened_by = case when p_status = 'open' then m.name else opened_by end,
    opened_at = case when p_status = 'open' then now() else opened_at end where id = p_id;
end $$;

-- A member of the class votes (or changes their vote) while the poll is open. p_choices: option numbers from 0.
create or replace function hk_vote(p_token text, p_id uuid, p_choices jsonb) returns void language plpgsql security definer set search_path = public as $$
declare m hk_members := hk__me(p_token); p hk_polls; c int[];
begin
  select * into p from hk_polls where id = p_id and removed_at is null;
  if p.id is null or p.status <> 'open' or not hk__sees(m, p.group_id) then raise exception 'not_allowed'; end if;
  select array_agg(distinct v::int) into c from jsonb_array_elements_text(p_choices) v;
  if c is null or (not p.multi and array_length(c, 1) <> 1) or exists (select 1 from unnest(c) i where i < 0 or i >= jsonb_array_length(p.options)) then raise exception 'unknown_kind'; end if;
  insert into hk_votes (poll_id, member_id, choices) values (p.id, m.id, c)
  on conflict (poll_id, member_id) do update set choices = excluded.choices, at = now();
end $$;

create or replace function hk_service_html(p_token text, p_id uuid) returns text language plpgsql security definer set search_path = public as $$
declare m hk_members := hk__who(p_token);
begin
  return (select html from hk_services where id = p_id and removed_at is null);
end $$;

create or replace function hk_roster_file(p_token text, p_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare m hk_members := hk__who(p_token);
begin
  return (select jsonb_build_object('file_b64', file_b64, 'mime', mime, 'file_name', file_name) from hk_rosters where id = p_id and removed_at is null and hk__sees(m, group_id));
end $$;

-- Office file: only office holders and the admin may open it.
create or replace function hk_file(p_token text, p_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare m hk_members := hk__me(p_token);
begin
  if not hk__office(m) then raise exception 'not_allowed'; end if;
  return (select jsonb_build_object('file_b64', file_b64, 'mime', mime, 'file_name', file_name) from hk_files where id = p_id and removed_at is null);
end $$;

-- ---------- save and remove, with role checks ----------
create or replace function hk_save(p_token text, p_kind text, p_data jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare m hk_members := hk__me(p_token); d jsonb := p_data; rid uuid := nullif(p_data ->> 'id', '')::uuid; res jsonb; gid text := nullif(p_data ->> 'group_id', '');
begin
  if p_kind = 'post' then
    if not hk__poster(m, gid) then raise exception 'not_allowed'; end if;
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
    if not (case when hk__teach(gid) then hk__poster(m, gid) else hk__elder(m) or (gid is not null and hk__chair(m, gid)) end) or (gid is not null and not hk__sees(m, gid)) then raise exception 'not_allowed'; end if;
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
    if not (exists (select 1 from hk_groups where id = gid and kind = 'office') and (m.is_admin or m.groups ? gid)) then raise exception 'not_allowed'; end if;
    if length(coalesce(d ->> 'file_b64', '')) > 14000000 then raise exception 'file_too_big'; end if;
    insert into hk_files (id, group_id, title, note, file_name, mime, file_b64, size, author_name)
    values (gen_random_uuid(), gid, d ->> 'title', d ->> 'note', d ->> 'file_name', d ->> 'mime', d ->> 'file_b64', (d ->> 'size')::int, m.name)
    returning (to_jsonb(hk_files.*) - 'file_b64') into res;
    if (d ->> 'notify')::boolean then
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
end $$;

create or replace function hk_remove(p_token text, p_kind text, p_id text) returns void language plpgsql security definer set search_path = public as $$
declare m hk_members := hk__me(p_token); gid text;
begin
  if p_kind = 'post' then
    select group_id into gid from hk_posts where id = p_id::uuid;
    if not hk__poster(m, gid) then raise exception 'not_allowed'; end if;
    update hk_posts set removed_at = now() where id = p_id::uuid;
  elsif p_kind = 'roster' then
    select group_id into gid from hk_rosters where id = p_id::uuid;
    if not hk__chair(m, gid) then raise exception 'not_allowed'; end if;
    update hk_rosters set removed_at = now() where id = p_id::uuid;
  elsif p_kind = 'bread' then
    if not hk__elder(m) then raise exception 'not_allowed'; end if;
    update hk_bread set removed_at = now() where day = p_id::date;
  elsif p_kind = 'update' then
    if not (case when exists (select 1 from hk_updates where id = p_id::uuid and kind = 'berita') then hk__chair(m, 'secretary') else hk__elder(m) end) then raise exception 'not_allowed'; end if;
    update hk_updates set removed_at = now() where id = p_id::uuid;
  elsif p_kind = 'event' then
    select group_id into gid from hk_events where id = p_id::uuid;
    if not (case when hk__teach(gid) then hk__poster(m, gid) else hk__elder(m) or (gid is not null and hk__chair(m, gid)) end) then raise exception 'not_allowed'; end if;
    update hk_events set removed_at = now() where id = p_id::uuid;
  elsif p_kind = 'poll' then
    select group_id into gid from hk_polls where id = p_id::uuid;
    if not hk__poster(m, gid) then raise exception 'not_allowed'; end if;
    update hk_polls set removed_at = now() where id = p_id::uuid;
  elsif p_kind = 'service' then
    if not hk__maker(m) then raise exception 'not_allowed'; end if;
    update hk_services set removed_at = now() where id = p_id::uuid;
  elsif p_kind = 'file' then
    select group_id into gid from hk_files where id = p_id::uuid;
    if not (m.is_admin or m.groups ? gid) then raise exception 'not_allowed'; end if;
    update hk_files set removed_at = now() where id = p_id::uuid;
  elsif p_kind = 'birthday' then
    if not hk__elder(m) then raise exception 'not_allowed'; end if;
    update hk_birthdays set removed_at = now() where id = p_id::uuid;
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
    insert into hk_members (name, alias, phone, dob, wed, pass_hash, is_admin, groups, wa_optin)
    values (r ->> 'name', nullif(r ->> 'alias', ''), ph, nullif(r ->> 'dob', '')::date, nullif(r ->> 'wed', '')::date,
            case when coalesce(r ->> 'password', '') <> '' then crypt(r ->> 'password', gen_salt('bf')) end,
            coalesce((r ->> 'is_admin')::boolean, false), coalesce(r -> 'groups', '{}'), coalesce((r ->> 'wa_optin')::boolean, false))
    on conflict (phone) do update set
      name = excluded.name, alias = excluded.alias, dob = coalesce(excluded.dob, hk_members.dob), wed = coalesce(excluded.wed, hk_members.wed),
      pass_hash = coalesce(excluded.pass_hash, hk_members.pass_hash),
      is_admin = case when hk_members.id = m.id then true else excluded.is_admin end,
      -- Office roles (Secretary, Treasurer, Chairman) and teacher roles are only given in the app, so a member list upload keeps them.
      groups = excluded.groups || coalesce((select jsonb_object_agg(e.key, e.value) from jsonb_each(hk_members.groups) e
                 join hk_groups g on g.id = e.key and (g.kind = 'office' or e.value #>> '{}' in ('tmaker', 'teacher'))), '{}'), wa_optin = excluded.wa_optin, removed_at = null;
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

-- Imports a birthday list once. Rows: [{name, dob 'YYYY-MM-DD', year_known, phone}]
-- A row that matches a member (by phone, or by exact name when the member has no birthday yet) fills that member's birthday,
-- so they get their own birthday notification. Other rows go to hk_birthdays. Repeated rows are skipped.
create or replace function hk_birthdays_import(p_token text, p_rows jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare m hk_members := hk__me(p_token); r jsonb; nm text; dd date; yk boolean; mid uuid; n_mem int := 0; n_add int := 0; n_skip int := 0;
begin
  if not hk__elder(m) then raise exception 'not_allowed'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    nm := trim(coalesce(r ->> 'name', '')); dd := nullif(r ->> 'dob', '')::date; yk := coalesce((r ->> 'year_known')::boolean, true);
    if nm = '' or dd is null then n_skip := n_skip + 1; continue; end if;
    mid := null;
    if length(hk__phone(r ->> 'phone')) = 8 then select id into mid from hk_members where phone = hk__phone(r ->> 'phone') and removed_at is null; end if;
    if mid is null then
      select id into mid from hk_members where lower(name) = lower(nm) and removed_at is null and dob is null
        and (select count(*) from hk_members x where lower(x.name) = lower(nm) and x.removed_at is null) = 1;
    end if;
    if mid is not null then
      update hk_members set dob = dd where id = mid and (dob is null or yk); n_mem := n_mem + 1;
    elsif exists (select 1 from hk_birthdays where lower(name) = lower(nm) and to_char(dob, 'MM-DD') = to_char(dd, 'MM-DD') and removed_at is null) then
      n_skip := n_skip + 1;
    else
      insert into hk_birthdays (name, dob, year_known, author_name) values (nm, dd, yk, m.name); n_add := n_add + 1;
    end if;
  end loop;
  return jsonb_build_object('members', n_mem, 'added', n_add, 'skipped', n_skip);
end $$;

-- Admin saves the daily bread and WhatsApp settings. An empty claude_key keeps the saved one.
create or replace function hk_settings_save(p_token text, p_data jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare m hk_members := hk__me(p_token); k text; v jsonb;
begin
  if not m.is_admin then raise exception 'not_allowed'; end if;
  for k, v in select * from jsonb_each(p_data) loop
    if k not in ('bread_source', 'bread_lang', 'bread_hour', 'wa_group_link', 'wa_senders', 'setup_done', 'claude_key') then continue; end if;
    if k = 'claude_key' and coalesce(v #>> '{}', '') = '' then continue; end if;
    insert into hk_settings (key, value) values (k, v) on conflict (key) do update set value = excluded.value, updated_at = now();
  end loop;
  return (select coalesce(jsonb_object_agg(key, value), '{}') from hk_settings where key not in ('claude_key', 'vapid_private', 'cron_key'));
end $$;

-- A category's WhatsApp group link: set by the admin or the category's chair / Teacher Maker.
create or replace function hk_group_walink(p_token text, p_group text, p_link text) returns void language plpgsql security definer set search_path = public as $$
declare m hk_members := hk__me(p_token); l text := nullif(trim(coalesce(p_link, '')), '');
begin
  if not (m.is_admin or coalesce(m.groups ->> p_group, '') in ('chair', 'tmaker')) then raise exception 'not_allowed'; end if;
  if l is not null and l !~ '^https://(chat\.whatsapp\.com|wa\.me|whatsapp\.com)/' then raise exception 'bad_link'; end if;
  update hk_groups set wa_link = l where id = p_group;
end $$;

-- The member's calendar feed link (made once, kept). Phones subscribe to it and update by themselves.
create or replace function hk_cal_token(p_token text) returns text language plpgsql security definer set search_path = public, extensions as $$
declare m hk_members := hk__me(p_token);
begin
  if m.id is null then raise exception 'not_signed_in'; end if;
  if m.cal_token is null then update hk_members set cal_token = encode(gen_random_bytes(18), 'hex') where id = m.id returning cal_token into m.cal_token; end if;
  return m.cal_token;
end $$;

-- Events for a calendar feed (used only by the hkbp-cal Edge Function with the server key).
create or replace function hk_cal_feed(p_cal text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare m hk_members;
begin
  select * into m from hk_members where cal_token = p_cal and removed_at is null;
  if m.id is null then return null; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'starts_at', e.starts_at, 'ends_at', e.ends_at, 'place', e.place, 'notes', e.notes,
            'remind_min', e.remind_min, 'group', coalesce(g.name_id, 'HKBP Singapore'), 'updated', coalesce(e.created_at, now())) order by e.starts_at), '[]')
          from hk_events e left join hk_groups g on g.id = e.group_id
          where e.removed_at is null and e.starts_at > now() - interval '60 days' and e.starts_at < now() + interval '400 days' and hk__sees(m, e.group_id));
end $$;

-- Only these functions are open to the app's public key.
revoke execute on all functions in schema public from public, anon, authenticated;
-- First-login answers (married, gender, Pelaut/Pekerja, confirmed). Only picks which categories the member's view shows.
create or replace function hk_profile_save(p_token text, p jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare m hk_members := hk__me(p_token); v jsonb := '{}'; k text;
begin
  if m.id is null then raise exception 'not_signed_in'; end if;
  foreach k in array array['married', 'male', 'pelaut', 'confirmed'] loop
    if p ? k then v := v || jsonb_build_object(k, (p ->> k)::boolean); end if;
  end loop;
  -- 'serve': the service sections the member picked (second pop-up); Jadwal shows only these.
  if p ? 'serve' then
    v := v || jsonb_build_object('serve', (select coalesce(jsonb_agg(g.id order by g.sort), '[]') from hk_groups g
      where g.kind = 'service' and g.removed_at is null and g.id in (select jsonb_array_elements_text(case when jsonb_typeof(p -> 'serve') = 'array' then p -> 'serve' else '[]' end))));
  end if;
  v := coalesce(m.profile, '{}') || v || jsonb_build_object('at', now());
  update hk_members set profile = v where id = m.id;
  return v;
end $$;

grant execute on function hk_login(text, text), hk_first_password(text, text), hk_logout(text), hk_set_password(text, text, text), hk_data(text),
  hk_roster_file(text, uuid), hk_save(text, text, jsonb), hk_remove(text, text, text), hk_members_upsert(text, jsonb),
  hk_push_save(text, jsonb), hk_push_remove(text, text), hk_birthdays_import(text, jsonb), hk_settings_save(text, jsonb), hk_service_html(text, uuid), hk_set_role(text, text, text, text, text), hk_file(text, uuid),
  hk_set_teacher(text, text, text, text, text), hk_poll_state(text, uuid, text), hk_vote(text, uuid, jsonb), hk_public(), hk_group_walink(text, text, text), hk_cal_token(text), hk_profile_save(text, jsonb) to anon;
