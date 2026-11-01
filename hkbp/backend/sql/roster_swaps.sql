-- Tap a name on a roster (YB 2026-11-01): ask a teammate to swap, "can't make it", and the answers.
-- hk_swap(token, op, data):
--   list    open requests that involve me, or that I look after as a roster maker
--   ask     ask a member to take a slot (the slot's own person, or a roster maker for them)
--   answer  the asked member says yes (the roster is changed for them) or no
--   cancel  the asker, or a roster maker, withdraws a request or closes a "can't make it"
--   cant    "I can't make it": kept as open and told to that roster's makers
-- Every change to a roster still passes the double-booking check (hk__roster_clash). No DELETE anywhere:
-- the approval prompt on YB's phone drops migrations that delete rows. Run as three separate migrations
-- (table + helper, hk_swap, grant).

-- 1) table + helper ------------------------------------------------------------------------------------
create table if not exists hk_swaps (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('swap', 'cant')),
  group_id text not null,
  roster_id uuid,
  day date not null,
  job text not null default '',
  who text not null default '',                 -- the name as written in the roster cell
  from_id uuid references hk_members(id),       -- the person in the slot (null when the name matches nobody)
  to_id uuid references hk_members(id),         -- the teammate asked to take it (swap only)
  to_label text,                                -- the name to write in the roster for them
  by_id uuid not null references hk_members(id),
  status text not null default 'open' check (status in ('open', 'accepted', 'declined', 'cancelled')),
  note text,
  created_at timestamptz not null default now(),
  answered_at timestamptz
);
alter table hk_swaps enable row level security;
revoke all on hk_swaps from anon, authenticated;
create index if not exists hk_swaps_open on hk_swaps (day) where status = 'open';

-- Is this roster name this member? (name or alias, same rule as the clash check)
create or replace function hk__is_me(m hk_members, who text) returns boolean language sql stable set search_path = public as $$
  select coalesce(hk__same(hk__pn(m.name), hk__pn(who)) or exists (select 1 from unnest(regexp_split_to_array(coalesce(m.alias, ''), '[,;/]')) a
    where btrim(a) <> '' and hk__same(hk__pn(a), hk__pn(who))), false)
$$;

-- The roster table with one name in one slot (date + job) replaced by another; null when that slot is not found.
create or replace function hk__swap_tj(tj jsonb, ym text, p_day date, p_job text, p_who text, p_new text) returns jsonb
language plpgsql immutable set search_path = public as $$
declare ti int; r int; j int; hi int; rws jsonb; hd jsonb; rw jsonb; dt date; parts text[]; k int; hitk int; cell text;
begin
  if jsonb_typeof(tj) is distinct from 'array' then return null; end if;
  for ti in 0 .. jsonb_array_length(tj) - 1 loop
    rws := tj -> ti -> 'rows'; if jsonb_typeof(rws) is distinct from 'array' or jsonb_array_length(rws) < 2 then continue; end if;
    hi := 0;
    for r in 0 .. jsonb_array_length(rws) - 1 loop
      if jsonb_typeof(rws -> r) = 'array' and (select count(*) from jsonb_array_elements(rws -> r) c where btrim(c #>> '{}') <> '') >= 2 then hi := r; exit; end if;
    end loop;
    hd := rws -> hi;
    for r in hi + 1 .. jsonb_array_length(rws) - 1 loop
      rw := rws -> r; if jsonb_typeof(rw) is distinct from 'array' then continue; end if;
      dt := null;
      for j in 0 .. jsonb_array_length(rw) - 1 loop dt := hk__cell_date(rw ->> j, ym); exit when dt is not null; end loop;
      if dt is distinct from p_day then continue; end if;
      for j in 0 .. jsonb_array_length(rw) - 1 loop
        if btrim(coalesce(hd ->> j, '')) <> btrim(p_job) then continue; end if;
        cell := coalesce(rw ->> j, '');
        parts := regexp_split_to_array(cell, '\s*(,|;|/|&|\+|·|•|\n|\s+dan\s+|\s+and\s+)\s*', 'i');
        hitk := null;
        for k in 1 .. coalesce(array_length(parts, 1), 0) loop
          if hk__pn(parts[k]) = hk__pn(p_who) or hk__same(hk__pn(parts[k]), hk__pn(p_who)) then hitk := k; exit; end if;
        end loop;
        if hitk is null then continue; end if;
        parts[hitk] := p_new;
        return jsonb_set(tj, array[ti::text, 'rows', r::text, j::text], to_jsonb(array_to_string(array(select x from unnest(parts) x where btrim(x) <> ''), ', ')));
      end loop;
    end loop;
  end loop;
  return null;
end $$;
revoke all on function hk__is_me(hk_members, text), hk__swap_tj(jsonb, text, date, text, text, text) from public, anon, authenticated;

-- 2) hk_swap -------------------------------------------------------------------------------------------
create or replace function hk_swap(p_token text, p_op text, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m hk_members := hk__me(p_token); d jsonb := coalesce(p_data, '{}'); s hk_swaps; ro hk_rosters; tm hk_members; fm hk_members;
  gid text := nullif(d ->> 'group_id', ''); gname text; dlabel text; ntj jsonb; cl jsonb; n int; lbl text; today_sg date := (now() at time zone 'Asia/Singapore')::date;
begin
  if p_op = 'list' then
    return coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'kind', x.kind, 'group_id', x.group_id, 'day', x.day, 'job', x.job, 'who', x.who,
        'from_id', x.from_id, 'to_id', x.to_id, 'to_name', t.name, 'by_name', b.name, 'status', x.status, 'note', x.note, 'at', x.created_at) order by x.day, x.created_at)
      from hk_swaps x left join hk_members t on t.id = x.to_id left join hk_members b on b.id = x.by_id
      where x.day >= today_sg and (x.status = 'open' or x.answered_at > now() - interval '7 days')
        and (x.from_id = m.id or x.to_id = m.id or x.by_id = m.id or hk__roster_ok(m, x.group_id))), '[]'::jsonb);
  end if;

  if p_op = 'answer' or p_op = 'cancel' then
    select * into s from hk_swaps where id = nullif(d ->> 'id', '')::uuid for update;
    if s.id is null then raise exception 'not_found'; end if;
    if s.status <> 'open' then raise exception 'already_done'; end if;
  else
    if gid is null or not exists (select 1 from hk_groups where id = gid) then raise exception 'not_allowed'; end if;
  end if;
  gname := coalesce((select coalesce(nullif(name_en, ''), name_id) from hk_groups where id = coalesce(s.group_id, gid)), coalesce(s.group_id, gid));

  if p_op = 'cancel' then
    if not (s.by_id = m.id or s.from_id = m.id or hk__roster_ok(m, s.group_id)) then raise exception 'not_allowed'; end if;
    update hk_swaps set status = 'cancelled', answered_at = now() where id = s.id;
    if s.kind = 'swap' and s.to_id is not null and s.to_id <> m.id then
      insert into hk_outbox (audience, title, body, url) values ('member:' || s.to_id, '🔁 Swap withdrawn · ' || gname,
        left(m.name || ' withdrew the request to take ' || s.who || '''s ' || s.job || ' on ' || to_char(s.day, 'Dy DD Mon') || '.', 300), '#/duties');
    end if;
    return jsonb_build_object('ok', true);
  end if;

  if p_op = 'answer' then
    if not (s.to_id = m.id or m.is_admin) then raise exception 'not_allowed'; end if;
    dlabel := to_char(s.day, 'Dy DD Mon');
    if not coalesce((d ->> 'ok')::boolean, false) then
      update hk_swaps set status = 'declined', answered_at = now() where id = s.id;
      insert into hk_outbox (audience, title, body, url) values ('member:' || s.by_id, '🔁 Swap declined · ' || gname,
        left(coalesce((select name from hk_members where id = s.to_id), m.name) || ' can''t take ' || s.job || ' on ' || dlabel || '.', 300), '#/duties');
      return jsonb_build_object('ok', true, 'status', 'declined');
    end if;
    select * into ro from hk_rosters where id = s.roster_id and removed_at is null for update;
    if ro.id is null then raise exception 'not_found'; end if;
    ntj := hk__swap_tj(ro.table_json, ro.month, s.day, s.job, s.who, s.to_label);
    if ntj is null then raise exception 'slot_changed'; end if;
    cl := hk__roster_clash(ro.id, ro.group_id, ntj, ro.month);
    if jsonb_array_length(cl) > 0 then raise exception 'roster_clash' using detail = cl::text; end if;
    update hk_rosters set table_json = ntj where id = ro.id;
    update hk_swaps set status = 'accepted', answered_at = now() where id = s.id;
    lbl := coalesce((select name from hk_members where id = s.to_id), s.to_label);
    insert into hk_outbox (audience, title, body, url)
    select 'member:' || x.id, '✅ Swap done · ' || gname, left(lbl || ' takes ' || s.who || '''s ' || s.job || ' on ' || dlabel || '. The roster is updated.', 300), '#/duties'
    from hk_members x where x.removed_at is null and x.id <> m.id and (x.id = s.by_id or x.id = s.from_id or hk__roster_ok(x, s.group_id));
    return jsonb_build_object('ok', true, 'status', 'accepted');
  end if;

  if p_op not in ('ask', 'cant') then raise exception 'unknown_kind'; end if;
  if coalesce(d ->> 'day', '') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(btrim(d ->> 'who'), '') = '' then raise exception 'bad_input'; end if;
  -- only the person in the slot, or someone who makes this roster, may ask for them
  if not (hk__is_me(m, d ->> 'who') or hk__roster_ok(m, gid)) then raise exception 'not_allowed'; end if;
  select x.* into fm from hk_members x where x.removed_at is null and hk__is_me(x, d ->> 'who') order by (x.id = m.id) desc limit 1;
  dlabel := to_char((d ->> 'day')::date, 'Dy DD Mon');

  if p_op = 'cant' then
    insert into hk_swaps (kind, group_id, roster_id, day, job, who, from_id, by_id, note)
    values ('cant', gid, nullif(d ->> 'roster_id', '')::uuid, (d ->> 'day')::date, coalesce(d ->> 'job', ''), btrim(d ->> 'who'), fm.id, m.id, left(nullif(btrim(d ->> 'note'), ''), 300))
    returning * into s;
    insert into hk_outbox (audience, title, body, url)
    select 'member:' || x.id, '⚠️ Can''t serve · ' || gname,
      left(btrim(d ->> 'who') || case when fm.id is distinct from m.id then ' (passed on by ' || m.name || ')' else '' end || ' can''t serve on ' || dlabel
        || coalesce(' (' || nullif(d ->> 'job', '') || ')', '') || '.' || coalesce(E'\n' || nullif(btrim(d ->> 'note'), ''), '') || coalesce(E'\nStill free: ' || nullif(d ->> 'free', ''), ''), 300),
      coalesce(nullif(d ->> 'url', ''), '#/serve')
    from hk_members x where x.removed_at is null and x.id <> m.id and hk__roster_ok(x, gid);
    get diagnostics n = row_count;
    return jsonb_build_object('ok', true, 'told', n, 'id', s.id);
  end if;

  -- ask
  select * into tm from hk_members where id = nullif(d ->> 'to_id', '')::uuid and removed_at is null;
  if tm.id is null then raise exception 'not_found'; end if;
  if hk__is_me(tm, d ->> 'who') then raise exception 'bad_input'; end if;
  select * into ro from hk_rosters where id = nullif(d ->> 'roster_id', '')::uuid and group_id = gid and removed_at is null;
  if ro.id is null then raise exception 'not_found'; end if;
  lbl := nullif(btrim(d ->> 'to_label'), '');
  if lbl is null or not hk__is_me(tm, lbl) then lbl := tm.name; end if;
  ntj := hk__swap_tj(ro.table_json, ro.month, (d ->> 'day')::date, coalesce(d ->> 'job', ''), btrim(d ->> 'who'), lbl);
  if ntj is null then raise exception 'slot_changed'; end if;
  cl := hk__roster_clash(ro.id, ro.group_id, ntj, ro.month);
  if jsonb_array_length(cl) > 0 then raise exception 'roster_clash' using detail = cl::text; end if;
  -- one open request per slot: a new ask replaces the older one
  update hk_swaps set status = 'cancelled', answered_at = now()
   where status = 'open' and kind = 'swap' and roster_id = ro.id and day = (d ->> 'day')::date and job = coalesce(d ->> 'job', '') and hk__pn(who) = hk__pn(d ->> 'who');
  insert into hk_swaps (kind, group_id, roster_id, day, job, who, from_id, to_id, to_label, by_id, note)
  values ('swap', gid, ro.id, (d ->> 'day')::date, coalesce(d ->> 'job', ''), btrim(d ->> 'who'), fm.id, tm.id, lbl, m.id, left(nullif(btrim(d ->> 'note'), ''), 300))
  returning * into s;
  insert into hk_outbox (audience, title, body, url) values ('member:' || tm.id, '🔁 Swap request · ' || gname,
    left(m.name || ' asks you to take ' || case when fm.id = m.id then 'their ' else btrim(d ->> 'who') || '''s ' end || coalesce(nullif(d ->> 'job', ''), 'duty') || ' on ' || dlabel || '.'
      || coalesce(E'\n' || nullif(btrim(d ->> 'note'), ''), '') || E'\nOpen Sada to accept or decline.', 300), '#/duties');
  return jsonb_build_object('ok', true, 'id', s.id);
end $$;

-- 3) grant ---------------------------------------------------------------------------------------------
revoke all on function hk_swap(text, text, jsonb) from public, anon, authenticated;
grant execute on function hk_swap(text, text, jsonb) to anon;
