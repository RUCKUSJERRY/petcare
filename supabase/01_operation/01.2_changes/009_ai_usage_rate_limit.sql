-- AI 기능(OCR 등) 서버측 사용량 제한용 로그 테이블 추가.
--  - 사용자별 시간당 호출 횟수를 세어 외부 LLM(Gemini) 비용/쿼터 남용을 방지한다.
--  모두 idempotent.

-- 1) 테이블
create table if not exists public.ai_usage (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  kind        text not null,
  created_at  timestamptz not null default now()
);

-- 2) FK + 인덱스
alter table public.ai_usage drop constraint if exists ai_usage_user_id_fkey;
alter table public.ai_usage add constraint ai_usage_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
create index if not exists idx_ai_usage_user_kind_at on public.ai_usage (user_id, kind, created_at desc);

-- 3) RLS (본인 사용기록만 조회/생성)
alter table public.ai_usage enable row level security;
drop policy if exists "ai_usage_select_own" on public.ai_usage;
drop policy if exists "ai_usage_insert_own" on public.ai_usage;
create policy "ai_usage_select_own" on public.ai_usage for select using (auth.uid() = user_id);
create policy "ai_usage_insert_own" on public.ai_usage for insert with check (auth.uid() = user_id);
