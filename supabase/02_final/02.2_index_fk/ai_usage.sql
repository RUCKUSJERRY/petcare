-- ai_usage : 외래키 + 인덱스
alter table public.ai_usage drop constraint if exists ai_usage_user_id_fkey;
alter table public.ai_usage add constraint ai_usage_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

-- 사용자별 최근 호출(시간당 카운트) 조회용
create index if not exists idx_ai_usage_user_kind_at on public.ai_usage (user_id, kind, created_at desc);
