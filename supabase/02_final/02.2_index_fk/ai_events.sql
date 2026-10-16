-- ai_events : 외래키 + 인덱스
-- 사용자 삭제 시 비용/사용 이력은 보존하되 소유자만 끊는다(on delete set null) — ai_usage(cascade)와 다른 선택.
alter table public.ai_events drop constraint if exists ai_events_user_id_fkey;
alter table public.ai_events add constraint ai_events_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

-- 기간별 비용/품질 집계(관리자 대시보드)용
create index if not exists idx_ai_events_created_at on public.ai_events (created_at desc);
-- 기능·provider·model 별 집계 필터용
create index if not exists idx_ai_events_feature_provider_model on public.ai_events (feature, provider, model, created_at desc);
