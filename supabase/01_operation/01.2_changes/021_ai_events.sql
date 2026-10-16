-- 021_ai_events : LLM 호출 텔레메트리(옵저버빌리티/비용) 테이블 추가
-- 완료된 LLM 호출 1건 = 1행. provider/model/토큰/지연/비용/성공/트레이스ID 를 남겨 비용·품질 관측.
-- ai_usage(행 수 기반 레이트리밋)와 별개 테이블(목적 분리). idempotent.

create table if not exists public.ai_events (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid,
  feature           text not null,
  provider          text not null,
  model             text not null,
  prompt_tokens     integer,
  completion_tokens integer,
  total_tokens      integer,
  latency_ms        integer,
  cost_usd          numeric(12, 6),
  success           boolean not null default true,
  error_code        text,
  request_id        text,
  created_at        timestamptz not null default now()
);

-- FK (사용자 삭제 시 이력 보존: set null)
alter table public.ai_events drop constraint if exists ai_events_user_id_fkey;
alter table public.ai_events add constraint ai_events_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

-- 인덱스
create index if not exists idx_ai_events_created_at on public.ai_events (created_at desc);
create index if not exists idx_ai_events_feature_provider_model on public.ai_events (feature, provider, model, created_at desc);

-- RLS
alter table public.ai_events enable row level security;
drop policy if exists "ai_events_insert_own" on public.ai_events;
drop policy if exists "ai_events_select_own" on public.ai_events;
create policy "ai_events_insert_own" on public.ai_events for insert with check (auth.uid() = user_id);
create policy "ai_events_select_own" on public.ai_events for select using (auth.uid() = user_id);
