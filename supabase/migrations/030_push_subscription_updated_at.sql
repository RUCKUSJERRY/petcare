-- ============================================================
--  030: 푸시 구독 갱신 시각(updated_at) 추적
--  멀티 디바이스 발송과 만료(404/410) 자동 정리는 이미 동작한다.
--  다만 브라우저가 410 없이 조용히 endpoint를 교체/만료시키는 경우가 있어,
--  마지막으로 (재)구독·갱신된 시각을 기록해 두면 오래 방치된 죽은 구독을
--  추후 일괄 정리(관측/운영)할 수 있다.
--  재구독(upsert) 시 코드에서 updated_at 을 now()로 갱신한다. (idempotent)
-- ============================================================

alter table public.push_subscriptions
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_push_sub_updated_at on public.push_subscriptions (updated_at);
