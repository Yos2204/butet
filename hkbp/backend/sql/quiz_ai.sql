-- Teens Quiz Workbench (YB 2026-10-31): Claude writes the Remaja quiz from the lesson materials.
-- 1. hk__extra2 "ai": the quiz makers of a category (admin, tmaker, teacher, chair, maker) may queue task 'quiz'.
--    (Only the two lines marked -- quiz changed; the rest of the function is as before.)
-- 2. hk_ai_kick: a 'quiz' job wakes the hkbp-quiz function (Verify JWT on: anon JWT + cron key); other tasks go to hkbp-ai as before.
-- Applied to the live project as migration quiz_ai; kept here so the repo shows what the database runs.

create or replace function public.hk_ai_kick() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare fn text := case when new.task = 'quiz' then 'hkbp-quiz' else 'hkbp-ai' end;
  anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiaWNmb2Zkb3J3cnVwemxxZ2RtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3OTk4OTEsImV4cCI6MjEwODM3NTg5MX0.Wd9o5C6yv_1rtoM0Y1dDRXsRmoUU-gc9IprMUldZ2dI';
begin
  perform net.http_post(url := 'https://tbicfofdorwrupzlqgdm.supabase.co/functions/v1/' || fn,
    headers := jsonb_build_object('content-type', 'application/json', 'apikey', anon, 'authorization', 'Bearer ' || anon,
      'x-cron-key', (select value #>> '{}' from hk_settings where key = 'cron_key')),
    body := jsonb_build_object('id', new.id), timeout_milliseconds := 120000);
  return new;
end $$;

-- hk__extra2: see the live definition; the 'ai' branch now reads
--   if v = 'quiz' and not (m.is_admin or coalesce(m.groups ->> (d -> 'input' ->> 'group_id'), '') in ('tmaker', 'teacher', 'chair', 'maker')) then raise exception 'not_allowed'; end if;  -- quiz
--   if v not in ('roster', 'questions', 'meaning', 'receipt', 'rpp', 'quiz') then raise exception 'bad_task'; end if;  -- quiz

-- 3. hk_ai_jobs.task may be 'quiz' (migration quiz_ai_task_check)
alter table public.hk_ai_jobs drop constraint if exists hk_ai_jobs_task_check;
alter table public.hk_ai_jobs add constraint hk_ai_jobs_task_check check (task = any (array['roster'::text, 'questions'::text, 'meaning'::text, 'receipt'::text, 'rpp'::text, 'quiz'::text]));
