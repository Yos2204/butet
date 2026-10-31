-- No double booking in rosters (YB 2026-10-31): a person may serve only once per date,
-- across every category, section and roster. The server checks every roster save; the app asks
-- the same check (hk_save 'roster_check') live while a name is typed.

-- A name reduced for comparing: lower case, letters/digits only, church titles dropped.
create or replace function hk__pn(s text) returns text language sql immutable set search_path = public as $$
  select btrim(regexp_replace(regexp_replace(regexp_replace(' ' || regexp_replace(lower(coalesce(s, '')), '[^a-z0-9]+', ' ', 'g') || ' ',
    ' (st|pdt|cst|sintua|bapak|bpk|ibu|bu|pak|kak|bang|ev|dr|br|amang|inang|pnt|guru|mr|mrs|ms|sdr|sdri) ', ' ', 'g'),
    ' (st|pdt|cst|sintua|bapak|bpk|ibu|bu|pak|kak|bang|ev|dr|br|amang|inang|pnt|guru|mr|mrs|ms|sdr|sdri) ', ' ', 'g'), ' +', ' ', 'g'))
$$;

-- Same person? First names equal, and every following word matches or is an initial/short form
-- of the other ("Helmi S" = "Helmi Sihombing", "Ratna" = "Ratna Silitonga"; "Toga Sihombing" <> "Helmi Sihombing").
create or replace function hk__same(a text, b text) returns boolean language plpgsql immutable set search_path = public as $$
declare x text[] := string_to_array(a, ' '); y text[] := string_to_array(b, ' '); i int;
begin
  if coalesce(a, '') = '' or coalesce(b, '') = '' or x[1] <> y[1] or length(x[1]) < 2 then return false; end if;
  for i in 2 .. least(array_length(x, 1), array_length(y, 1)) loop
    if not (left(y[i], length(x[i])) = x[i] or left(x[i], length(y[i])) = y[i]) then return false; end if;
  end loop;
  return true;
end $$;

-- The date in one roster cell ("Minggu, 15 Nov", "1/1/2027", "2026-11-15"), like rowDate() in the app.
create or replace function hk__cell_date(c text, ym text) returns date language plpgsql immutable set search_path = public as $$
declare m text[]; dd int; mo int; y int;
begin
  if c is null or c !~ '\d' then return null; end if;
  m := regexp_match(c, '(20\d{2})-(\d{2})-(\d{2})');
  if m is not null then begin return make_date(m[1]::int, m[2]::int, m[3]::int); exception when others then return null; end; end if;
  m := regexp_match(lower(c), '(?:^|[^0-9a-z])(\d{1,2})[\s/.-]+(\d{1,2}|jan|feb|mar|apr|mei|may|jun|jul|agu|aug|sep|okt|oct|nov|des|dec)[a-z]*(?:[\s/.-]+(\d{2,4}))?');
  if m is null then return null; end if;
  dd := m[1]::int;
  mo := case when m[2] ~ '^\d+$' then m[2]::int else case m[2] when 'jan' then 1 when 'feb' then 2 when 'mar' then 3 when 'apr' then 4 when 'mei' then 5 when 'may' then 5
    when 'jun' then 6 when 'jul' then 7 when 'agu' then 8 when 'aug' then 8 when 'sep' then 9 when 'okt' then 10 when 'oct' then 10 when 'nov' then 11 else 12 end end;
  y := coalesce(m[3]::int, left(coalesce(ym, to_char(now(), 'YYYY')), 4)::int); if y < 100 then y := y + 2000; end if;
  begin return make_date(y, mo, dd); exception when others then return null; end;
end $$;

-- Every (date, job, name) in a roster table. Date, language, Sunday-name, place, theme and note columns are skipped.
-- Practices (latihan / practice / rehearsal / gladi: a sheet, a row or a column) never count, so they may overlap anything (YB 2026-10-31).
create or replace function hk__roster_slots(tj jsonb, ym text) returns table (day date, job text, who text, pn text) language plpgsql immutable set search_path = public as $$
declare tb jsonb; rws jsonb; hd jsonb; rw jsonb; hi int; r int; j int; dt date; cell text; h text; ch text; p text;
begin
  if jsonb_typeof(tj) is distinct from 'array' then return; end if;
  for tb in select x from jsonb_array_elements(tj) x loop
    rws := tb -> 'rows'; if jsonb_typeof(rws) is distinct from 'array' or jsonb_array_length(rws) < 2 then continue; end if;
    if lower(coalesce(tb ->> 'name', '')) ~ '(latihan|practi[cs]e|rehearsal|gladi)' then continue; end if;  -- practices may overlap (YB 2026-10-31)
    hi := 0;
    for r in 0 .. jsonb_array_length(rws) - 1 loop
      if jsonb_typeof(rws -> r) = 'array' and (select count(*) from jsonb_array_elements(rws -> r) c where btrim(c #>> '{}') <> '') >= 2 then hi := r; exit; end if;
    end loop;
    hd := rws -> hi;
    for r in hi + 1 .. jsonb_array_length(rws) - 1 loop
      rw := rws -> r; if jsonb_typeof(rw) is distinct from 'array' then continue; end if;
      dt := null;
      for j in 0 .. jsonb_array_length(rw) - 1 loop dt := hk__cell_date(rw ->> j, ym); exit when dt is not null; end loop;
      if dt is null then continue; end if;
      -- a practice row: a cell says so, or a practice column (header "Latihan" …) is filled in
      if lower(rw::text) ~ '(latihan|practi[cs]e|rehearsal|gladi)' or exists (select 1 from generate_series(0, jsonb_array_length(rw) - 1) k
        where lower(coalesce(hd ->> k, '')) ~ '(latihan|practi[cs]e|rehearsal|gladi)' and coalesce(btrim(rw ->> k), '') <> '') then continue; end if;
      for j in 0 .. jsonb_array_length(rw) - 1 loop
        cell := rw ->> j; h := coalesce(hd ->> j, '');
        if coalesce(btrim(cell), '') = '' or hk__cell_date(cell, ym) is not null
          or lower(h) ~ '(tanggal|date|hari|bahasa|language|nama minggu|asal|tema|theme|ayat|nas\M|bacaan|catatan|note|keterangan|pengumuman|latihan|practi[cs]e|rehearsal|gladi)' then continue; end if;
        foreach ch in array regexp_split_to_array(cell, '\s*(,|;|/|&|\+|·|•|\n|\s+dan\s+|\s+and\s+)\s*', 'i') loop
          p := hk__pn(ch);
          if length(split_part(p, ' ', 1)) < 2 or p ~ '^\d' then continue; end if;
          day := dt; job := h; who := btrim(ch); pn := p; return next;
        end loop;
      end loop;
    end loop;
  end loop;
end $$;

-- Names in this roster that already serve elsewhere on the same date (another roster, or another job here).
-- Only names that are new in this save count, so an older clash never blocks editing another Sunday.
create or replace function hk__roster_clash(p_rid uuid, p_gid text, tj jsonb, ym text) returns jsonb language sql stable set search_path = public as $$
  with nw as (select * from hk__roster_slots(tj, ym)),
  od as (select s.* from hk_rosters r, hk__roster_slots(r.table_json, r.month) s where r.id = p_rid and r.group_id = p_gid),
  fresh as (select n.* from nw n where not exists (select 1 from od o where o.day = n.day and o.job = n.job and o.pn = n.pn)),
  oth as (select r.group_id, s.* from hk_rosters r, hk__roster_slots(r.table_json, r.month) s
          where r.removed_at is null and r.table_json is not null and r.id is distinct from p_rid
            and r.month in (to_char(to_date(ym || '-01', 'YYYY-MM-DD') - interval '1 month', 'YYYY-MM'), ym, to_char(to_date(ym || '-01', 'YYYY-MM-DD') + interval '1 month', 'YYYY-MM'))),
  hits as (
    select f.day, f.job, f.who, o.group_id as other_group, o.job as other_job, o.who as other_who from fresh f join oth o on o.day = f.day and hk__same(f.pn, o.pn)
    union
    select f.day, f.job, f.who, p_gid, n.job, n.who from fresh f join nw n on n.day = f.day and n.job is distinct from f.job and hk__same(f.pn, n.pn))
  select coalesce(jsonb_agg(jsonb_build_object('day', h.day, 'job', h.job, 'who', h.who, 'group_id', h.other_group,
    'group', coalesce(g.name_id, h.other_group), 'group_en', coalesce(g.name_en, g.name_id, h.other_group), 'other_job', h.other_job, 'other_who', h.other_who) order by h.day, h.who), '[]'::jsonb)
  from (select * from hits limit 40) h left join hk_groups g on g.id = h.other_group
$$;

revoke all on function hk__pn(text), hk__same(text, text), hk__cell_date(text, text), hk__roster_slots(jsonb, text), hk__roster_clash(uuid, text, jsonb, text) from public, anon, authenticated;
