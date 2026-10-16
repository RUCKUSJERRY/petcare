-- ai_events : LLM 호출 텔레메트리(옵저버빌리티/비용) 로그
-- ai_usage(행 수로 레이트리밋)와 목적이 다르다. 여기는 '완료된 호출 1건 = 1행'으로
-- provider/model/토큰/지연/비용/성공여부/트레이스ID 를 남겨 비용·품질을 관측한다.
-- 쓰기는 각 기능(챗·OCR 등)이 best-effort 로, 집계 조회는 관리자(service role)가 한다.
create table if not exists public.ai_events (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid,                       -- 호출 사용자(시스템/크론 호출은 null). 삭제돼도 비용이력 보존 위해 set null
  feature           text not null,              -- 기능 구분: 'chat' | 'ocr' | 'parse' ...
  provider          text not null,              -- 'upstage' | 'gemini' | 'openai' ...
  model             text not null,
  prompt_tokens     integer,                    -- 미상이면 null (0 과 구분)
  completion_tokens integer,
  total_tokens      integer,
  latency_ms        integer,
  cost_usd          numeric(12, 6),             -- 단가 미상이면 null (비용 날조 금지)
  success           boolean not null default true,
  error_code        text,                       -- 실패 시 분류 코드/메시지 요약
  request_id        text,                       -- 요청→툴콜→모델호출 상관 추적 ID
  created_at        timestamptz not null default now()
);
