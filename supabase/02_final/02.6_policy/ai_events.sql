-- ai_events : RLS
-- 쓰기는 본인 user_id 로만(각 기능이 사용자 세션으로 best-effort 기록). 집계 조회는 관리자가
-- service role(RLS 우회)로 하므로 일반 select 정책은 '본인 것만'으로 최소화한다.
-- (시스템/크론의 user_id=null 기록은 service role 로 들어오며 RLS 를 우회한다.)
alter table public.ai_events enable row level security;
drop policy if exists "ai_events_insert_own" on public.ai_events;
drop policy if exists "ai_events_select_own" on public.ai_events;
create policy "ai_events_insert_own" on public.ai_events for insert with check (auth.uid() = user_id);
create policy "ai_events_select_own" on public.ai_events for select using (auth.uid() = user_id);
