-- Log of every hkbp-wa attempt (check / download / wa_upload / wa_send / sent), written by the edge function with the service role.
-- No RLS policies on purpose: the app never reads it; admins read it in the Supabase dashboard or via Claude.
create table if not exists public.hk_wa_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  ok boolean not null,
  step text not null,
  detail text,
  file text,
  to_phone text
);
alter table public.hk_wa_log enable row level security;
