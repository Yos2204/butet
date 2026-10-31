-- Sada HKBPS pictures for categories and sections, and two saved pictures each (YB 2026-10-31).
-- * Every category and section can have its own picture, like members' profile photos. The admin and that group's
--   makers (whoever may post or make its roster) set it. Stored in its own small table so hk_data's group list stays
--   light; hk_data sends the shown ones as group_photos {group_id: data URL}.
-- * Members, categories and sections keep at most 2 pictures: the one shown (photo) and one saved earlier (photo_prev).
--   A new picture pushes the shown one into photo_prev and the older saved one is dropped. "Use" swaps the two,
--   "Remove" clears the shown one (the saved one takes its place).
-- hk_save / hk__extra / hk_data are patched in place so other recent changes to them are kept.
create table if not exists hk_group_photos (
  group_id text primary key references hk_groups(id),
  photo text,
  photo_prev text,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table hk_group_photos enable row level security;
alter table hk_members add column if not exists photo_prev text;

-- The two-picture rule, shared by members and groups. d: {photo: data URL | ''} or {use: 'prev'} or {drop: 'prev'}.
-- Returns the new {shown, saved}.
create or replace function hk__pic(cur text, prev text, d jsonb) returns text[] language plpgsql immutable as $f$
declare v text := coalesce(d ->> 'photo', '');
begin
  if d ->> 'use' = 'prev' then
    if prev is null then raise exception 'not_found'; end if;
    return array[prev, cur];
  elsif d ->> 'drop' = 'prev' then
    return array[cur, null];
  elsif v = '' then
    return array[prev, null];
  end if;
  if v !~ '^data:image/(jpeg|png|webp);base64,' or length(v) > 80000 then raise exception 'bad_image'; end if;
  return array[v, coalesce(cur, prev)];
end $f$;

do $mig$
declare s text; o text;
begin
  s := pg_get_functiondef('public.hk_save'::regproc); o := s;
  s := replace(s, 'if p_kind in (''photo'', ''rsvp'',', 'if p_kind in (''photo'', ''group_photo'', ''photo_saved'', ''rsvp'',');
  if s <> o then execute s; elsif o !~ 'photo_saved' then raise exception 'hk_save patch did not apply'; end if;

  s := pg_get_functiondef('public.hk__extra(hk_members,text,jsonb)'::regprocedure); o := s;
  s := replace(s, '    v := coalesce(d ->> ''photo'', '''');
    if v <> '''' and (v !~ ''^data:image/(jpeg|png|webp);base64,'' or length(v) > 80000) then raise exception ''bad_image''; end if;
    update hk_members set photo = nullif(v, '''') where id = m.id;
    return jsonb_build_object(''ok'', true);',
'    update hk_members x set photo = q.p[1], photo_prev = q.p[2] from (select hk__pic(m.photo, m.photo_prev, d) p) q where x.id = m.id;
    return jsonb_build_object(''ok'', true);
  elsif p_kind = ''group_photo'' then                         -- a category''s or section''s picture, by the admin or its makers
    gid := d ->> ''group_id'';
    if not exists (select 1 from hk_groups where id = gid and removed_at is null) then raise exception ''not_found''; end if;
    if not (coalesce(m.is_admin, false) or hk__poster(m, gid) or hk__roster_ok(m, gid)) then raise exception ''not_allowed''; end if;
    insert into hk_group_photos (group_id) values (gid) on conflict (group_id) do nothing;
    update hk_group_photos x set photo = q.p[1], photo_prev = q.p[2], updated_by = m.id, updated_at = now()
      from (select hk__pic(y.photo, y.photo_prev, d) p from hk_group_photos y where y.group_id = gid) q where x.group_id = gid;
    return jsonb_build_object(''ok'', true);
  elsif p_kind = ''photo_saved'' then                         -- the two saved pictures, for the picture sheet
    gid := nullif(d ->> ''group_id'', '''');
    if gid is null then return jsonb_build_object(''photo'', m.photo, ''prev'', m.photo_prev); end if;
    if not (coalesce(m.is_admin, false) or hk__poster(m, gid) or hk__roster_ok(m, gid)) then raise exception ''not_allowed''; end if;
    return (select jsonb_build_object(''photo'', y.photo, ''prev'', y.photo_prev) from hk_group_photos y where y.group_id = gid);');
  if s <> o then execute s; elsif o !~ 'photo_saved' then raise exception 'hk__extra patch did not apply'; end if;

  s := pg_get_functiondef('public.hk_data'::regproc); o := s;
  s := replace(s, '    ''rsvps'', (select',
'    ''group_photos'', (select coalesce(jsonb_object_agg(gp.group_id, gp.photo), ''{}''::jsonb) from hk_group_photos gp join hk_groups g on g.id = gp.group_id
      where gp.photo is not null and g.removed_at is null and (g.kind <> ''office'' or off)),
    ''rsvps'', (select');
  if s <> o then execute s; elsif o !~ 'group_photos' then raise exception 'hk_data patch did not apply'; end if;
end $mig$;
