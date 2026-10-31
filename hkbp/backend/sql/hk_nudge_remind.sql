-- Sada HKBPS: 2-day reminder to YB about numbers that tried to sign in but aren't members yet.
-- Paste into Supabase > SQL Editor (project tbicfofdorwrupzlqgdm) and press Run.
create or replace function hk_nudge_remind() returns int language plpgsql security definer set search_path = public as $$
declare n int; yb uuid; ph text;
begin
  select count(*), string_agg('+65 ' || left(t.phone, 4) || ' ' || right(t.phone, 4), ', ' order by t.last_at desc)
    into n, ph
    from hk_phone_tries t where not exists (select 1 from hk_members h where h.phone = t.phone and h.removed_at is null);
  if n = 0 then return 0; end if;
  select id into yb from hk_members where phone = '85334780' and removed_at is null limit 1;
  if yb is null then return 0; end if;
  insert into hk_outbox (audience, title, body, url) values ('member:' || yb,
    n || case when n = 1 then ' number still not signed in' else ' numbers still not signed in' end,
    'Tap to nudge them on WhatsApp: ' || ph, '#/appstatus');
  return n;
end $$;
revoke all on function hk_nudge_remind() from public, anon, authenticated;
delete from hk_phone_tries where phone = '80001234';
select cron.schedule('hkbp-nudge-remind', '0 2 */2 * *', 'select hk_nudge_remind()');
