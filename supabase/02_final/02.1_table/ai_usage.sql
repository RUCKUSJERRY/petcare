-- ai_usage : AI 기능 호출 로그 (서버측 사용량 제한용)
-- OCR 등 외부 LLM 비용이 드는 기능의 사용자별 호출을 기록해 시간당 횟수를 제한한다.
create table if not exists public.ai_usage (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  kind        text not null,            -- 'ocr' 등 기능 구분
  created_at  timestamptz not null default now()
);
