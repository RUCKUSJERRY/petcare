-- ai_usage : RLS (본인 사용기록만 조회/생성)
alter table public.ai_usage enable row level security;
drop policy if exists "ai_usage_select_own" on public.ai_usage;
drop policy if exists "ai_usage_insert_own" on public.ai_usage;
create policy "ai_usage_select_own" on public.ai_usage for select using (auth.uid() = user_id);
create policy "ai_usage_insert_own" on public.ai_usage for insert with check (auth.uid() = user_id);
